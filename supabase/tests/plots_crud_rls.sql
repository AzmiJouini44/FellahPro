\set ON_ERROR_STOP on

begin;

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
select
  '00000000-0000-0000-0000-000000000000',
  user_data.id,
  'authenticated',
  'authenticated',
  user_data.email,
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  '',
  '',
  '',
  ''
from (values
  ('14000000-0000-0000-0000-000000000001'::uuid, 'plots-owner-a@example.test'),
  ('14000000-0000-0000-0000-000000000002'::uuid, 'plots-worker-a@example.test'),
  ('14000000-0000-0000-0000-000000000003'::uuid, 'plots-accountant-a@example.test'),
  ('14000000-0000-0000-0000-000000000004'::uuid, 'plots-owner-b@example.test')
) as user_data(id, email);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"14000000-0000-0000-0000-000000000001","role":"authenticated"}';

insert into public.farms (id, name)
values ('24000000-0000-0000-0000-000000000001', 'Plots farm A');

set local request.jwt.claims =
  '{"sub":"14000000-0000-0000-0000-000000000004","role":"authenticated"}';

insert into public.farms (id, name)
values ('24000000-0000-0000-0000-000000000002', 'Plots farm B');

reset role;

insert into public.farm_members (farm_id, user_id, role)
values
  (
    '24000000-0000-0000-0000-000000000001',
    '14000000-0000-0000-0000-000000000002',
    'worker'
  ),
  (
    '24000000-0000-0000-0000-000000000001',
    '14000000-0000-0000-0000-000000000003',
    'accountant'
  );

-- Owners can create, list, and update plots in their own farm.
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"14000000-0000-0000-0000-000000000001","role":"authenticated"}';

insert into public.plots (id, farm_id, name, area_hectares, notes)
values (
  '34000000-0000-0000-0000-000000000001',
  '24000000-0000-0000-0000-000000000001',
  'Owner plot',
  2.125,
  'Initial note'
);

update public.plots
set name = 'Owner plot updated', notes = 'Updated note'
where id = '34000000-0000-0000-0000-000000000001';

do $$
begin
  if not exists (
    select 1 from public.plots
    where id = '34000000-0000-0000-0000-000000000001'
      and farm_id = '24000000-0000-0000-0000-000000000001'
      and name = 'Owner plot updated'
      and area_hectares = 2.125
      and notes = 'Updated note'
  ) then
    raise exception 'owner plot create, list, or update failed';
  end if;
end;
$$;

-- Workers can create, list, and update production plots, but cannot delete.
set local request.jwt.claims =
  '{"sub":"14000000-0000-0000-0000-000000000002","role":"authenticated"}';

insert into public.plots (id, farm_id, name, area_hectares)
values (
  '34000000-0000-0000-0000-000000000002',
  '24000000-0000-0000-0000-000000000001',
  'Worker plot',
  1.500
);

update public.plots
set area_hectares = 1.750
where id = '34000000-0000-0000-0000-000000000002';

do $$
declare
  deleted_rows integer;
begin
  if not exists (
    select 1 from public.plots
    where id = '34000000-0000-0000-0000-000000000002'
      and area_hectares = 1.750
  ) then
    raise exception 'worker plot create, list, or update failed';
  end if;

  delete from public.plots
  where id = '34000000-0000-0000-0000-000000000002';
  get diagnostics deleted_rows = row_count;

  if deleted_rows <> 0 then
    raise exception 'worker deleted a plot';
  end if;
end;
$$;

-- Accountants can list plots but cannot create, update, or delete them.
set local request.jwt.claims =
  '{"sub":"14000000-0000-0000-0000-000000000003","role":"authenticated"}';

do $$
declare
  changed_rows integer;
begin
  if (select count(*) from public.plots) <> 2 then
    raise exception 'accountant could not list farm plots';
  end if;

  begin
    insert into public.plots (farm_id, name, area_hectares)
    values ('24000000-0000-0000-0000-000000000001', 'Forbidden plot', 1);
    raise exception 'accountant created a plot';
  exception
    when insufficient_privilege then null;
  end;

  update public.plots
  set name = 'Forbidden update'
  where id = '34000000-0000-0000-0000-000000000001';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'accountant updated a plot';
  end if;

  delete from public.plots
  where id = '34000000-0000-0000-0000-000000000001';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'accountant deleted a plot';
  end if;
end;
$$;

-- A user from Farm B cannot read or mutate Farm A plots, including by using a
-- valid Farm A plot UUID in a manipulated URL or form submission.
set local request.jwt.claims =
  '{"sub":"14000000-0000-0000-0000-000000000004","role":"authenticated"}';

do $$
declare
  changed_rows integer;
begin
  if exists (
    select 1 from public.plots
    where id = '34000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'Farm B owner read a Farm A plot';
  end if;

  update public.plots
  set name = 'Cross-farm update'
  where id = '34000000-0000-0000-0000-000000000001';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'Farm B owner updated a Farm A plot';
  end if;

  delete from public.plots
  where id = '34000000-0000-0000-0000-000000000001';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'Farm B owner deleted a Farm A plot';
  end if;

  begin
    insert into public.plots (farm_id, name, area_hectares)
    values ('24000000-0000-0000-0000-000000000001', 'Cross-farm plot', 1);
    raise exception 'Farm B owner inserted a Farm A plot';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

-- Owners can delete unreferenced plots. A plot referenced by a crop cycle is
-- protected by the existing foreign key and remains intact after rejection.
set local request.jwt.claims =
  '{"sub":"14000000-0000-0000-0000-000000000001","role":"authenticated"}';

insert into public.activities (id, farm_id, name, kind)
values (
  '35000000-0000-0000-0000-000000000001',
  '24000000-0000-0000-0000-000000000001',
  'Crop activity',
  'culture'
);

insert into public.plots (id, farm_id, activity_id, name, area_hectares)
values (
  '34000000-0000-0000-0000-000000000003',
  '24000000-0000-0000-0000-000000000001',
  '35000000-0000-0000-0000-000000000001',
  'Referenced plot',
  3
);

insert into public.crop_cycles (
  id,
  farm_id,
  activity_id,
  plot_id,
  crop_name,
  started_on,
  expected_harvest_on,
  cultivated_area_hectares
)
values (
  '36000000-0000-0000-0000-000000000001',
  '24000000-0000-0000-0000-000000000001',
  '35000000-0000-0000-0000-000000000001',
  '34000000-0000-0000-0000-000000000003',
  'Wheat',
  '2026-11-19',
  '2027-06-01',
  3
);

do $$
begin
  begin
    delete from public.plots
    where id = '34000000-0000-0000-0000-000000000003';
    raise exception 'referenced plot was deleted';
  exception
    when foreign_key_violation then null;
  end;

  if not exists (
    select 1 from public.plots
    where id = '34000000-0000-0000-0000-000000000003'
  ) then
    raise exception 'rejected referenced-plot deletion changed persisted data';
  end if;
end;
$$;

delete from public.crop_cycles
where id = '36000000-0000-0000-0000-000000000001';

delete from public.plots
where id in (
  '34000000-0000-0000-0000-000000000001',
  '34000000-0000-0000-0000-000000000002',
  '34000000-0000-0000-0000-000000000003'
);

do $$
begin
  if exists (
    select 1 from public.plots
    where farm_id = '24000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'owner could not delete unreferenced plots';
  end if;
end;
$$;

rollback;
