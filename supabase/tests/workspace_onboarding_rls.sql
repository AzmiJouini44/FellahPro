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
  ('12000000-0000-0000-0000-000000000001'::uuid, 'workspace-a@example.test'),
  ('12000000-0000-0000-0000-000000000002'::uuid, 'workspace-b@example.test'),
  ('12000000-0000-0000-0000-000000000003'::uuid, 'workspace-none@example.test')
) as user_data(id, email);

-- User A creates the oldest farm. Mission 1 intentionally leaves that farm
-- visible to its creator even if their membership is later removed.
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"12000000-0000-0000-0000-000000000001","role":"authenticated"}';

insert into public.farms (id, name, created_at)
values (
  '22000000-0000-0000-0000-000000000001',
  'Former creator farm A',
  '2026-01-01 00:00:00+00'
);

-- User B creates two later farms. User A will be a valid member of both, so
-- Farm B must win the oldest-current-membership ordering.
set local request.jwt.claims =
  '{"sub":"12000000-0000-0000-0000-000000000002","role":"authenticated"}';

insert into public.farms (id, name, created_at)
values
  (
    '22000000-0000-0000-0000-000000000002',
    'Current member farm B',
    '2026-02-01 00:00:00+00'
  ),
  (
    '22000000-0000-0000-0000-000000000003',
    'Newer member farm C',
    '2026-03-01 00:00:00+00'
  );

reset role;

insert into public.farm_members (farm_id, user_id, role)
values
  (
    '22000000-0000-0000-0000-000000000001',
    '12000000-0000-0000-0000-000000000002',
    'owner'
  ),
  (
    '22000000-0000-0000-0000-000000000002',
    '12000000-0000-0000-0000-000000000001',
    'worker'
  ),
  (
    '22000000-0000-0000-0000-000000000003',
    '12000000-0000-0000-0000-000000000001',
    'accountant'
  );

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"12000000-0000-0000-0000-000000000001","role":"authenticated"}';

delete from public.farm_members
where farm_id = '22000000-0000-0000-0000-000000000001'
  and user_id = '12000000-0000-0000-0000-000000000001';

do $$
declare
  selected_workspace record;
  visible_farm_count integer;
begin
  select count(*) into visible_farm_count from public.farms;

  if visible_farm_count <> 3 then
    raise exception 'creator visibility precondition failed: expected 3 visible farms, found %',
      visible_farm_count;
  end if;

  select * into selected_workspace from public.get_current_workspace();

  if selected_workspace.farm_id <> '22000000-0000-0000-0000-000000000002'::uuid
    or selected_workspace.farm_name <> 'Current member farm B'
    or selected_workspace.member_role <> 'worker' then
    raise exception 'workspace did not select the oldest actual membership';
  end if;
end;
$$;

-- A user with a profile but no memberships has no current workspace. The
-- application maps this empty result to its locale-specific onboarding route.
set local request.jwt.claims =
  '{"sub":"12000000-0000-0000-0000-000000000003","role":"authenticated"}';

do $$
begin
  if exists (select 1 from public.get_current_workspace()) then
    raise exception 'a user without memberships received a current workspace';
  end if;
end;
$$;

-- First-farm creation remains functional and is idempotent. The first call
-- creates the owner membership through the Mission 1 trigger; the second call
-- returns the same farm rather than creating another one.
do $$
declare
  first_farm_id uuid;
  second_farm_id uuid;
  selected_workspace record;
begin
  first_farm_id := public.create_first_farm('First onboarding farm');
  second_farm_id := public.create_first_farm('Unwanted duplicate farm');

  if first_farm_id <> second_farm_id then
    raise exception 'repeated onboarding created more than one first farm';
  end if;

  if (
    select count(*)
    from public.farm_members
    where user_id = '12000000-0000-0000-0000-000000000003'
  ) <> 1 then
    raise exception 'onboarding did not create exactly one membership';
  end if;

  select * into selected_workspace from public.get_current_workspace();

  if selected_workspace.farm_id <> first_farm_id
    or selected_workspace.farm_name <> 'First onboarding farm'
    or selected_workspace.member_role <> 'owner' then
    raise exception 'first-farm onboarding did not create an owner workspace';
  end if;
end;
$$;

rollback;
