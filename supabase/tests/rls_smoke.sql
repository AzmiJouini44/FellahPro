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

-- A worker can see the transaction but cannot delete it.
set local request.jwt.claims =
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}';

do $$
declare
  deleted_rows integer;
begin
  delete from public.transactions
  where id = '50000000-0000-0000-0000-000000000001';
  get diagnostics deleted_rows = row_count;

  if deleted_rows <> 0 then
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
