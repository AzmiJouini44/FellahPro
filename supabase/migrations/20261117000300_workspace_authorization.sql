-- Mission 2 workspace selection and concurrency-safe first-farm onboarding.

create or replace function public.get_current_workspace()
returns table (
  farm_id uuid,
  farm_name text,
  currency text,
  is_demo boolean,
  member_role text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    farms.id,
    farms.name,
    farms.currency,
    farms.is_demo,
    farm_members.role
  from public.farm_members
  join public.farms on farms.id = farm_members.farm_id
  where farm_members.user_id = (select auth.uid())
  order by farms.created_at, farm_members.joined_at, farms.id
  limit 1;
$$;

comment on function public.get_current_workspace() is
  'Returns the oldest farm for which the authenticated user has a current membership.';

create or replace function public.create_first_farm(p_name text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_farm_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_name is null
    or length(btrim(p_name)) < 2
    or length(btrim(p_name)) > 120 then
    raise exception 'Farm name must contain between 2 and 120 characters.'
      using errcode = '23514';
  end if;

  -- Every concurrent onboarding request for one user locks the same profile.
  -- The later request sees the membership committed by the first request and
  -- returns that farm instead of inserting another one.
  perform 1
  from public.profiles
  where id = current_user_id
  for update;

  if not found then
    raise exception 'The authenticated profile does not exist.'
      using errcode = '23503';
  end if;

  select workspace.farm_id
  into current_farm_id
  from public.get_current_workspace() as workspace;

  if current_farm_id is not null then
    return current_farm_id;
  end if;

  insert into public.farms (name)
  values (btrim(p_name))
  returning id into current_farm_id;

  return current_farm_id;
end;
$$;

comment on function public.create_first_farm(text) is
  'Atomically returns an existing member farm or creates the authenticated user first farm.';

revoke all on function public.get_current_workspace() from public, anon;
revoke all on function public.create_first_farm(text) from public, anon;

grant execute on function public.get_current_workspace() to authenticated;
grant execute on function public.create_first_farm(text) to authenticated;
