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
  ('11000000-0000-0000-0000-000000000001'::uuid, 'onboarding-a@example.test'),
  ('11000000-0000-0000-0000-000000000002'::uuid, 'onboarding-b@example.test')
) as user_data(id, email);

-- Simulate legacy Auth users whose automatic profiles are missing.
delete from public.profiles
where id in (
  '11000000-0000-0000-0000-000000000001',
  '11000000-0000-0000-0000-000000000002'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"11000000-0000-0000-0000-000000000001","role":"authenticated"}';

insert into public.profiles (id, full_name, locale)
values (
  '11000000-0000-0000-0000-000000000001',
  'Onboarding User A',
  'fr'
);

-- The application uses an upsert so the same operation also updates a profile
-- that already exists, while retaining the own-profile RLS boundary.
insert into public.profiles (id, full_name, locale)
values (
  '11000000-0000-0000-0000-000000000001',
  'Onboarding User A Updated',
  'ar'
)
on conflict (id) do update
set full_name = excluded.full_name,
    locale = excluded.locale;

do $$
begin
  begin
    insert into public.profiles (id, full_name, locale)
    values (
      '11000000-0000-0000-0000-000000000002',
      'Onboarding User B',
      'fr'
    );
    raise exception 'user A created user B profile';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;

do $$
begin
  if not exists (
    select 1 from public.profiles
    where id = '11000000-0000-0000-0000-000000000001'
      and full_name = 'Onboarding User A Updated'
      and locale = 'ar'
  ) then
    raise exception 'user A could not create and update their own profile';
  end if;

  if exists (
    select 1 from public.profiles
    where id = '11000000-0000-0000-0000-000000000002'
  ) then
    raise exception 'cross-user profile insert was not rejected';
  end if;
end;
$$;

rollback;
