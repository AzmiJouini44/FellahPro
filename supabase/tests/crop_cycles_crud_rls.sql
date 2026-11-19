\set ON_ERROR_STOP on

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
select
  '00000000-0000-0000-0000-000000000000', user_data.id,
  'authenticated', 'authenticated', user_data.email, '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  now(), now(), '', '', '', ''
from (values
  ('15000000-0000-0000-0000-000000000001'::uuid, 'cycles-owner-a@example.test'),
  ('15000000-0000-0000-0000-000000000002'::uuid, 'cycles-worker-a@example.test'),
  ('15000000-0000-0000-0000-000000000003'::uuid, 'cycles-accountant-a@example.test'),
  ('15000000-0000-0000-0000-000000000004'::uuid, 'cycles-owner-b@example.test')
) as user_data(id, email);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"15000000-0000-0000-0000-000000000001","role":"authenticated"}';

insert into public.farms (id, name)
values ('25000000-0000-0000-0000-000000000001', 'Cycles farm A');

set local request.jwt.claims =
  '{"sub":"15000000-0000-0000-0000-000000000004","role":"authenticated"}';

insert into public.farms (id, name)
values ('25000000-0000-0000-0000-000000000002', 'Cycles farm B');

reset role;

insert into public.farm_members (farm_id, user_id, role)
values
  ('25000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000002', 'worker'),
  ('25000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000003', 'accountant');

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"15000000-0000-0000-0000-000000000001","role":"authenticated"}';

insert into public.plots (id, farm_id, name, area_hectares)
values
  ('35000000-0000-0000-0000-000000000001', '25000000-0000-0000-0000-000000000001', 'North plot', 5),
  ('35000000-0000-0000-0000-000000000002', '25000000-0000-0000-0000-000000000001', 'South plot', 3);

-- Owners can create complete crop-cycle records without an activity while the
-- Activities module is deferred.
insert into public.crop_cycles (
  id, farm_id, plot_id, crop_name, started_on, expected_harvest_on,
  cultivated_area_hectares, status, notes
)
values (
  '45000000-0000-0000-0000-000000000001',
  '25000000-0000-0000-0000-000000000001',
  '35000000-0000-0000-0000-000000000001',
  'Durum wheat', '2026-11-01', '2027-06-15', 4.5, 'planned', 'Owner cycle'
);

do $$
begin
  if not exists (
    select 1 from public.crop_cycles
    where id = '45000000-0000-0000-0000-000000000001'
      and activity_id is null
      and expected_harvest_on = '2027-06-15'
      and cultivated_area_hectares = 4.5
  ) then
    raise exception 'owner could not create or list a standalone crop cycle';
  end if;
end;
$$;

-- Database constraints reject bad date ranges, missing completion dates, and
-- cultivated areas larger than the selected plot.
do $$
begin
  begin
    insert into public.crop_cycles (
      farm_id, plot_id, crop_name, started_on, expected_harvest_on,
      cultivated_area_hectares, status
    ) values (
      '25000000-0000-0000-0000-000000000001',
      '35000000-0000-0000-0000-000000000001',
      'Bad dates', '2026-11-01', '2026-10-31', 1, 'planned'
    );
    raise exception 'cycle with reversed dates was inserted';
  exception when check_violation then null;
  end;

  begin
    insert into public.crop_cycles (
      farm_id, plot_id, crop_name, started_on, expected_harvest_on,
      actual_harvest_on, cultivated_area_hectares, status
    ) values (
      '25000000-0000-0000-0000-000000000001',
      '35000000-0000-0000-0000-000000000001',
      'Premature actual', '2026-11-01', '2027-06-15', '2027-06-12', 1, 'active'
    );
    raise exception 'active cycle with actual harvest was inserted';
  exception when check_violation then null;
  end;

  begin
    insert into public.crop_cycles (
      farm_id, plot_id, crop_name, started_on, expected_harvest_on,
      cultivated_area_hectares, status
    ) values (
      '25000000-0000-0000-0000-000000000001',
      '35000000-0000-0000-0000-000000000001',
      'Missing actual', '2026-11-01', '2027-06-15', 1, 'completed'
    );
    raise exception 'completed cycle without actual harvest was inserted';
  exception when check_violation then null;
  end;

  begin
    insert into public.crop_cycles (
      farm_id, plot_id, crop_name, started_on, expected_harvest_on,
      cultivated_area_hectares, status
    ) values (
      '25000000-0000-0000-0000-000000000001',
      '35000000-0000-0000-0000-000000000001',
      'Too large', '2026-11-01', '2027-06-15', 5.001, 'planned'
    );
    raise exception 'cycle larger than its plot was inserted';
  exception when check_violation then null;
  end;
end;
$$;

-- Plot resizing cannot invalidate a persisted crop-cycle area.
do $$
begin
  begin
    update public.plots
    set area_hectares = 4
    where id = '35000000-0000-0000-0000-000000000001';
    raise exception 'plot was made smaller than an existing crop cycle';
  exception when check_violation then null;
  end;
end;
$$;

-- Workers can create and edit production cycles but cannot delete them.
set local request.jwt.claims =
  '{"sub":"15000000-0000-0000-0000-000000000002","role":"authenticated"}';

insert into public.crop_cycles (
  id, farm_id, plot_id, crop_name, started_on, expected_harvest_on,
  actual_harvest_on, cultivated_area_hectares, status
)
values (
  '45000000-0000-0000-0000-000000000002',
  '25000000-0000-0000-0000-000000000001',
  '35000000-0000-0000-0000-000000000002',
  'Tomatoes', '2026-03-01', '2026-07-15', '2026-07-12', 2.5, 'completed'
);

update public.crop_cycles
set crop_name = 'Processing tomatoes', notes = 'Worker update'
where id = '45000000-0000-0000-0000-000000000002';

do $$
declare
  changed_rows integer;
begin
  if not exists (
    select 1 from public.crop_cycles
    where id = '45000000-0000-0000-0000-000000000002'
      and crop_name = 'Processing tomatoes'
  ) then
    raise exception 'worker could not create, list, or edit a crop cycle';
  end if;

  delete from public.crop_cycles
  where id = '45000000-0000-0000-0000-000000000002';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then raise exception 'worker deleted a crop cycle'; end if;
end;
$$;

-- Accountants can read but cannot create, edit, or delete cycles.
set local request.jwt.claims =
  '{"sub":"15000000-0000-0000-0000-000000000003","role":"authenticated"}';

do $$
declare
  changed_rows integer;
begin
  if (select count(*) from public.crop_cycles) <> 2 then
    raise exception 'accountant could not list farm crop cycles';
  end if;

  begin
    insert into public.crop_cycles (
      farm_id, plot_id, crop_name, started_on, expected_harvest_on,
      cultivated_area_hectares, status
    ) values (
      '25000000-0000-0000-0000-000000000001',
      '35000000-0000-0000-0000-000000000001',
      'Forbidden', '2026-01-01', '2026-02-01', 1, 'planned'
    );
    raise exception 'accountant created a crop cycle';
  exception
    when insufficient_privilege or foreign_key_violation then null;
  end;

  update public.crop_cycles set crop_name = 'Forbidden update'
  where id = '45000000-0000-0000-0000-000000000001';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then raise exception 'accountant updated a crop cycle'; end if;

  delete from public.crop_cycles
  where id = '45000000-0000-0000-0000-000000000001';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then raise exception 'accountant deleted a crop cycle'; end if;
end;
$$;

-- Farm B cannot read or mutate Farm A cycles and cannot use a Farm A ID or
-- plot in manipulated submissions.
set local request.jwt.claims =
  '{"sub":"15000000-0000-0000-0000-000000000004","role":"authenticated"}';

insert into public.plots (id, farm_id, name, area_hectares)
values ('35000000-0000-0000-0000-000000000003', '25000000-0000-0000-0000-000000000002', 'Farm B plot', 2);

do $$
declare
  changed_rows integer;
begin
  if exists (
    select 1 from public.crop_cycles
    where id = '45000000-0000-0000-0000-000000000001'
  ) then raise exception 'Farm B read a Farm A crop cycle'; end if;

  update public.crop_cycles set crop_name = 'Cross-farm update'
  where id = '45000000-0000-0000-0000-000000000001';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then raise exception 'Farm B updated a Farm A crop cycle'; end if;

  delete from public.crop_cycles
  where id = '45000000-0000-0000-0000-000000000001';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then raise exception 'Farm B deleted a Farm A crop cycle'; end if;

  begin
    insert into public.crop_cycles (
      farm_id, plot_id, crop_name, started_on, expected_harvest_on,
      cultivated_area_hectares, status
    ) values (
      '25000000-0000-0000-0000-000000000002',
      '35000000-0000-0000-0000-000000000001',
      'Cross-farm plot', '2026-01-01', '2026-02-01', 1, 'planned'
    );
    raise exception 'Farm B created a cycle on a Farm A plot';
  exception when foreign_key_violation then null;
  end;
end;
$$;

-- Owners can delete unreferenced cycles. Existing operational foreign keys
-- block deletion when a task references the cycle.
set local request.jwt.claims =
  '{"sub":"15000000-0000-0000-0000-000000000001","role":"authenticated"}';

insert into public.activities (id, farm_id, name, kind)
values ('55000000-0000-0000-0000-000000000001', '25000000-0000-0000-0000-000000000001', 'Crop activity', 'culture');

insert into public.plots (id, farm_id, activity_id, name, area_hectares)
values (
  '35000000-0000-0000-0000-000000000004',
  '25000000-0000-0000-0000-000000000001',
  '55000000-0000-0000-0000-000000000001',
  'Linked plot', 2
);

insert into public.crop_cycles (
  id, farm_id, activity_id, plot_id, crop_name, started_on,
  expected_harvest_on, cultivated_area_hectares, status
)
values (
  '45000000-0000-0000-0000-000000000003',
  '25000000-0000-0000-0000-000000000001',
  '55000000-0000-0000-0000-000000000001',
  '35000000-0000-0000-0000-000000000004',
  'Linked crop', '2026-01-01', '2026-06-01', 1.5, 'active'
);

insert into public.tasks (
  id, farm_id, activity_id, crop_cycle_id, title
)
values (
  '65000000-0000-0000-0000-000000000001',
  '25000000-0000-0000-0000-000000000001',
  '55000000-0000-0000-0000-000000000001',
  '45000000-0000-0000-0000-000000000003',
  'Linked task'
);

do $$
begin
  begin
    delete from public.crop_cycles
    where id = '45000000-0000-0000-0000-000000000003';
    raise exception 'linked crop cycle was deleted';
  exception when foreign_key_violation then null;
  end;
end;
$$;

delete from public.tasks
where id = '65000000-0000-0000-0000-000000000001';

delete from public.crop_cycles
where id in (
  '45000000-0000-0000-0000-000000000001',
  '45000000-0000-0000-0000-000000000002',
  '45000000-0000-0000-0000-000000000003'
);

do $$
begin
  if exists (
    select 1 from public.crop_cycles
    where farm_id = '25000000-0000-0000-0000-000000000001'
  ) then raise exception 'owner could not delete unreferenced crop cycles'; end if;
end;
$$;

rollback;
