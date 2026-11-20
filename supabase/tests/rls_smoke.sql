\set ON_ERROR_STOP on

begin;

-- Deterministic identities used only inside this rolled-back smoke test.
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
  ('10000000-0000-0000-0000-000000000001'::uuid, 'rls-a@example.test'),
  ('10000000-0000-0000-0000-000000000002'::uuid, 'rls-b@example.test'),
  ('10000000-0000-0000-0000-000000000003'::uuid, 'rls-worker@example.test'),
  ('10000000-0000-0000-0000-000000000004'::uuid, 'rls-owner-2@example.test')
) as user_data(id, email);

-- A farm creator must see the inserted row before the owner-membership AFTER
-- trigger has made them a member (the INSERT ... RETURNING RLS edge case).
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}';

do $$
declare
  returned_id uuid;
begin
  insert into public.farms (id, name, is_demo)
  values ('20000000-0000-0000-0000-000000000001', 'Demo farm A', true)
  returning id into returned_id;

  if returned_id <> '20000000-0000-0000-0000-000000000001'::uuid then
    raise exception 'farm INSERT ... RETURNING did not return the new farm';
  end if;
end;
$$;

reset role;

-- Seed records needed by the role, account-deletion, payment, and view checks.
insert into public.farm_members (farm_id, user_id, role)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'worker'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'owner');

insert into public.activities (id, farm_id, name, kind)
values (
  '30000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'Demo activity',
  'commerce'
);

insert into public.plots (id, farm_id, activity_id, name, area_hectares)
values (
  '31000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  'Farm A plot',
  1.5
);

insert into public.crop_cycles (
  id,
  farm_id,
  activity_id,
  plot_id,
  crop_name,
  started_on,
  expected_harvest_on,
  cultivated_area_hectares,
  status
)
values (
  '32000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '31000000-0000-0000-0000-000000000001',
  'Farm A crop',
  '2026-01-01',
  '2026-06-01',
  1.5,
  'active'
);

insert into public.animal_groups (
  id,
  farm_id,
  activity_id,
  name,
  species,
  opening_count
)
values (
  '33000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  'Farm A herd',
  'bovin',
  4
);

insert into public.animal_events (
  id,
  farm_id,
  animal_group_id,
  kind,
  quantity,
  notes
)
values (
  '34000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '33000000-0000-0000-0000-000000000001',
  'achat',
  2,
  'Farm A animal event'
);

insert into public.parties (id, farm_id, name, kind, phone)
values (
  '35000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'Farm A customer',
  'client',
  '+21600000000'
);

insert into public.products (id, farm_id, name, minimum_stock)
values (
  '40000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'Demo product',
  10
);

insert into public.transactions (
  id,
  farm_id,
  activity_id,
  kind,
  created_by
)
values (
  '50000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  'revenu',
  '10000000-0000-0000-0000-000000000001'
);

insert into public.transaction_lines (
  id,
  farm_id,
  transaction_id,
  description,
  quantity,
  unit_price
)
values (
  '60000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  'Demo sale',
  1,
  100
);

insert into public.payments (
  id,
  farm_id,
  transaction_id,
  amount
)
values (
  '65000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  25
);

insert into public.inventory_movements (
  id,
  farm_id,
  product_id,
  kind,
  quantity
)
values (
  '70000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  'sortie',
  5
);

insert into public.tasks (id, farm_id, assigned_to, title)
values (
  '80000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Account deletion assignment check'
);

-- User B is not a member of farm A and cannot read it.
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}';

do $$
begin
  if exists (
    select 1
    from public.farms
    where id = '20000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'user B can read farm A';
  end if;
end;
$$;

-- Give B a separate farm, then prove its sole owner cannot leave it.
insert into public.farms (id, name)
values ('20000000-0000-0000-0000-000000000002', 'Farm B');

-- Membership in farm B must not expose important records from farm A.
do $$
declare
  changed_rows integer;
begin
  if exists (
    select 1 from public.farm_members
    where farm_id = '20000000-0000-0000-0000-000000000001'
  ) or exists (
    select 1 from public.activities
    where farm_id = '20000000-0000-0000-0000-000000000001'
  ) or exists (
    select 1 from public.products
    where farm_id = '20000000-0000-0000-0000-000000000001'
  ) or exists (
    select 1 from public.plots
    where farm_id = '20000000-0000-0000-0000-000000000001'
  ) or exists (
    select 1 from public.crop_cycles
    where farm_id = '20000000-0000-0000-0000-000000000001'
  ) or exists (
    select 1 from public.animal_groups
    where farm_id = '20000000-0000-0000-0000-000000000001'
  ) or exists (
    select 1 from public.animal_events
    where farm_id = '20000000-0000-0000-0000-000000000001'
  ) or exists (
    select 1 from public.parties
    where farm_id = '20000000-0000-0000-0000-000000000001'
  ) or exists (
    select 1 from public.transactions
    where farm_id = '20000000-0000-0000-0000-000000000001'
  ) or exists (
    select 1 from public.transaction_lines
    where farm_id = '20000000-0000-0000-0000-000000000001'
  ) or exists (
    select 1 from public.payments
    where farm_id = '20000000-0000-0000-0000-000000000001'
  ) or exists (
    select 1 from public.inventory_movements
    where farm_id = '20000000-0000-0000-0000-000000000001'
  ) or exists (
    select 1 from public.tasks
    where farm_id = '20000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'farm B owner can read farm A data';
  end if;

  update public.farm_members
  set role = 'accountant'
  where farm_id = '20000000-0000-0000-0000-000000000001'
    and user_id = '10000000-0000-0000-0000-000000000003';
  get diagnostics changed_rows = row_count;

  if changed_rows <> 0 then
    raise exception 'farm B owner changed a farm A membership role';
  end if;

  update public.plots
  set name = 'Farm B update'
  where id = '31000000-0000-0000-0000-000000000001';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'farm B owner updated a farm A plot';
  end if;

  update public.crop_cycles
  set crop_name = 'Farm B update'
  where id = '32000000-0000-0000-0000-000000000001';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'farm B owner updated a farm A crop cycle';
  end if;

  update public.animal_groups
  set name = 'Farm B update'
  where id = '33000000-0000-0000-0000-000000000001';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'farm B owner updated a farm A animal group';
  end if;

  update public.animal_events
  set notes = 'Farm B update'
  where id = '34000000-0000-0000-0000-000000000001';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'farm B owner updated a farm A animal event';
  end if;

  update public.parties
  set phone = '+21611111111'
  where id = '35000000-0000-0000-0000-000000000001';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'farm B owner updated a farm A party';
  end if;

  delete from public.animal_events
  where id = '34000000-0000-0000-0000-000000000001';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'farm B owner deleted a farm A animal event';
  end if;

  delete from public.crop_cycles
  where id = '32000000-0000-0000-0000-000000000001';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'farm B owner deleted a farm A crop cycle';
  end if;

  delete from public.plots
  where id = '31000000-0000-0000-0000-000000000001';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'farm B owner deleted a farm A plot';
  end if;

  delete from public.animal_groups
  where id = '33000000-0000-0000-0000-000000000001';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'farm B owner deleted a farm A animal group';
  end if;

  delete from public.parties
  where id = '35000000-0000-0000-0000-000000000001';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'farm B owner deleted a farm A party';
  end if;
end;
$$;

do $$
begin
  begin
    delete from public.farm_members
    where farm_id = '20000000-0000-0000-0000-000000000002'
      and user_id = '10000000-0000-0000-0000-000000000002';
    raise exception 'last owner was allowed to leave';
  exception
    when check_violation then null;
  end;
end;
$$;

-- A sole owner also cannot demote their own membership through UPDATE.
do $$
begin
  begin
    update public.farm_members
    set role = 'worker'
    where farm_id = '20000000-0000-0000-0000-000000000002'
      and user_id = '10000000-0000-0000-0000-000000000002';
    raise exception 'last owner was allowed to demote themselves';
  exception
    when check_violation then null;
  end;

  if not exists (
    select 1 from public.farm_members
    where farm_id = '20000000-0000-0000-0000-000000000002'
      and user_id = '10000000-0000-0000-0000-000000000002'
      and role = 'owner'
  ) then
    raise exception 'failed last-owner demotion changed the membership';
  end if;
end;
$$;

-- Deleting an Auth account that is the sole owner of an existing farm is
-- rejected. The account, profile, farm, and membership must all remain.
reset role;

do $$
begin
  begin
    delete from auth.users
    where id = '10000000-0000-0000-0000-000000000002';
    raise exception 'sole-owner Auth account deletion was allowed';
  exception
    when check_violation then null;
  end;

  if not exists (
    select 1 from auth.users
    where id = '10000000-0000-0000-0000-000000000002'
  ) or not exists (
    select 1 from public.profiles
    where id = '10000000-0000-0000-0000-000000000002'
  ) or not exists (
    select 1 from public.farms
    where id = '20000000-0000-0000-0000-000000000002'
  ) or not exists (
    select 1 from public.farm_members
    where farm_id = '20000000-0000-0000-0000-000000000002'
      and user_id = '10000000-0000-0000-0000-000000000002'
      and role = 'owner'
  ) then
    raise exception 'rejected sole-owner account deletion changed persisted data';
  end if;
end;
$$;

-- Membership identities are immutable even to a privileged database caller,
-- so moving an owner row cannot bypass the last-owner invariant.
do $$
begin
  begin
    update public.farm_members
    set farm_id = '20000000-0000-0000-0000-000000000002'
    where farm_id = '20000000-0000-0000-0000-000000000001'
      and user_id = '10000000-0000-0000-0000-000000000001';
    raise exception 'owner membership was moved to another farm';
  exception
    when check_violation then null;
  end;

  if not exists (
    select 1 from public.farm_members
    where farm_id = '20000000-0000-0000-0000-000000000001'
      and user_id = '10000000-0000-0000-0000-000000000001'
      and role = 'owner'
  ) then
    raise exception 'failed owner move did not preserve the original membership';
  end if;
end;
$$;

-- Authenticated owners may update roles in their own farm, but identity
-- columns are not granted for update.
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}';

do $$
declare
  changed_rows integer;
begin
  begin
    update public.farm_members
    set user_id = '10000000-0000-0000-0000-000000000002'
    where farm_id = '20000000-0000-0000-0000-000000000001'
      and user_id = '10000000-0000-0000-0000-000000000003';
    raise exception 'authenticated owner changed a membership user_id';
  exception
    when insufficient_privilege then null;
  end;

  update public.farm_members
  set role = 'accountant'
  where farm_id = '20000000-0000-0000-0000-000000000001'
    and user_id = '10000000-0000-0000-0000-000000000003';
  get diagnostics changed_rows = row_count;

  if changed_rows <> 1 then
    raise exception 'owner could not update a member role in their farm';
  end if;

  update public.farm_members
  set role = 'worker'
  where farm_id = '20000000-0000-0000-0000-000000000001'
    and user_id = '10000000-0000-0000-0000-000000000003';

  -- Self-demotion is allowed because the second owner remains. The caller
  -- immediately loses owner-only permissions and needs another owner to be
  -- promoted again.
  update public.farm_members
  set role = 'accountant'
  where farm_id = '20000000-0000-0000-0000-000000000001'
    and user_id = '10000000-0000-0000-0000-000000000001';
  get diagnostics changed_rows = row_count;

  if changed_rows <> 1 or not exists (
    select 1 from public.farm_members
    where farm_id = '20000000-0000-0000-0000-000000000001'
      and user_id = '10000000-0000-0000-0000-000000000001'
      and role = 'accountant'
  ) or not exists (
    select 1 from public.farm_members
    where farm_id = '20000000-0000-0000-0000-000000000001'
      and user_id = '10000000-0000-0000-0000-000000000004'
      and role = 'owner'
  ) then
    raise exception 'owner could not demote themselves while another owner remained';
  end if;
end;
$$;

-- The remaining owner can promote the self-demoted member again.
set local request.jwt.claims =
  '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}';

do $$
declare
  changed_rows integer;
begin
  update public.farm_members
  set role = 'owner'
  where farm_id = '20000000-0000-0000-0000-000000000001'
    and user_id = '10000000-0000-0000-0000-000000000001';
  get diagnostics changed_rows = row_count;

  if changed_rows <> 1 or not exists (
    select 1 from public.farm_members
    where farm_id = '20000000-0000-0000-0000-000000000001'
      and user_id = '10000000-0000-0000-0000-000000000001'
      and role = 'owner'
  ) then
    raise exception 'remaining owner could not restore a self-demoted owner';
  end if;
end;
$$;

-- A non-owner cannot promote themselves or update membership identities.
set local request.jwt.claims =
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}';

do $$
declare
  changed_rows integer;
begin
  update public.farm_members
  set role = 'owner'
  where farm_id = '20000000-0000-0000-0000-000000000001'
    and user_id = '10000000-0000-0000-0000-000000000003';
  get diagnostics changed_rows = row_count;

  if changed_rows <> 0 then
    raise exception 'worker changed their own membership role';
  end if;

  begin
    update public.farm_members
    set user_id = '10000000-0000-0000-0000-000000000002'
    where farm_id = '20000000-0000-0000-0000-000000000001'
      and user_id = '10000000-0000-0000-0000-000000000003';
    raise exception 'worker changed a membership user_id';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

-- Deleting a farm with exactly one owner must cascade through its membership.
set local request.jwt.claims =
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}';

do $$
declare
  deleted_rows integer;
begin
  delete from public.farms
  where id = '20000000-0000-0000-0000-000000000002';
  get diagnostics deleted_rows = row_count;

  if deleted_rows <> 1 then
    raise exception 'sole-owner farm was not deleted';
  end if;
end;
$$;

reset role;

do $$
begin
  if exists (
    select 1 from public.farms
    where id = '20000000-0000-0000-0000-000000000002'
  ) or exists (
    select 1 from public.farm_members
    where farm_id = '20000000-0000-0000-0000-000000000002'
  ) then
    raise exception 'farm deletion did not cascade through memberships';
  end if;
end;
$$;

-- Workers may create financial records, but cannot update or delete them.
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}';

do $$
declare
  changed_rows integer;
begin
  insert into public.transactions (
    id,
    farm_id,
    activity_id,
    kind,
    created_by
  ) values (
    '50000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'depense',
    '10000000-0000-0000-0000-000000000003'
  );

  insert into public.transaction_lines (
    id,
    farm_id,
    transaction_id,
    description,
    quantity,
    unit_price
  ) values (
    '60000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000002',
    'Worker-created expense',
    1,
    10
  );

  insert into public.payments (
    id,
    farm_id,
    transaction_id,
    amount
  ) values (
    '65000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000002',
    5
  );

  update public.transactions
  set notes = 'worker update'
  where id = '50000000-0000-0000-0000-000000000002';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'worker updated a transaction';
  end if;

  update public.transaction_lines
  set description = 'worker update'
  where id = '60000000-0000-0000-0000-000000000002';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'worker updated a transaction line';
  end if;

  update public.payments
  set amount = 4
  where id = '65000000-0000-0000-0000-000000000002';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'worker updated a payment';
  end if;

  delete from public.payments
  where id = '65000000-0000-0000-0000-000000000002';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'worker deleted a payment';
  end if;

  delete from public.transaction_lines
  where id = '60000000-0000-0000-0000-000000000002';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'worker deleted a transaction line';
  end if;

  delete from public.transactions
  where id = '50000000-0000-0000-0000-000000000002';
  get diagnostics changed_rows = row_count;

  if changed_rows <> 0 then
    raise exception 'worker deleted a transaction';
  end if;
end;
$$;

-- A payment greater than the line total must be rejected.
set local request.jwt.claims =
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}';

do $$
begin
  begin
    insert into public.payments (farm_id, transaction_id, amount)
    values (
      '20000000-0000-0000-0000-000000000001',
      '50000000-0000-0000-0000-000000000001',
      100.001
    );
    raise exception 'overpayment was accepted';
  exception
    when check_violation then null;
  end;
end;
$$;

-- Deleting a creator succeeds when another owner remains. Audit references and
-- the task assignment are cleared instead of blocking the Auth cascade.
reset role;
delete from auth.users
where id = '10000000-0000-0000-0000-000000000001';

do $$
begin
  if (select created_by is not null from public.farms
      where id = '20000000-0000-0000-0000-000000000001') then
    raise exception 'farm created_by was not cleared';
  end if;

  if (select created_by is not null from public.transactions
      where id = '50000000-0000-0000-0000-000000000001') then
    raise exception 'transaction created_by was not cleared';
  end if;

  if (select assigned_to is not null from public.tasks
      where id = '80000000-0000-0000-0000-000000000001') then
    raise exception 'task assigned_to was not cleared';
  end if;
end;
$$;

-- Demo rows remain present in every requested reporting view. This also checks
-- that negative stock is visible and marked low.
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}';

do $$
begin
  if not exists (
    select 1 from public.v_activity_pnl
    where farm_id = '20000000-0000-0000-0000-000000000001'
      and is_demo
  ) then
    raise exception 'demo farm missing from v_activity_pnl';
  end if;

  if not exists (
    select 1 from public.v_stock_levels
    where farm_id = '20000000-0000-0000-0000-000000000001'
      and is_demo
      and quantity_on_hand = -5
      and is_low
  ) then
    raise exception 'demo or negative stock missing from v_stock_levels';
  end if;

  if not exists (
    select 1 from public.v_debts
    where farm_id = '20000000-0000-0000-0000-000000000001'
      and is_demo
  ) then
    raise exception 'demo farm missing from v_debts';
  end if;
end;
$$;

rollback;
