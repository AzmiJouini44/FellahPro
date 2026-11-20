\set ON_ERROR_STOP on

begin;

-- All fixtures and checks run in this rolled-back transaction.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
select '00000000-0000-0000-0000-000000000000', u.id,
  'authenticated', 'authenticated', u.email, '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  now(), now(), '', '', '', ''
from (values
  ('17000000-0000-0000-0000-000000000001'::uuid, 'activities-owner-a@example.test'),
  ('17000000-0000-0000-0000-000000000002'::uuid, 'activities-worker@example.test'),
  ('17000000-0000-0000-0000-000000000003'::uuid, 'activities-accountant@example.test'),
  ('17000000-0000-0000-0000-000000000004'::uuid, 'activities-owner-b@example.test')
) as u(id, email);

set local role authenticated;
set local request.jwt.claims = '{"sub":"17000000-0000-0000-0000-000000000001","role":"authenticated"}';
insert into public.farms (id, name)
values ('27000000-0000-0000-0000-000000000001', 'Activities farm A');
set local request.jwt.claims = '{"sub":"17000000-0000-0000-0000-000000000004","role":"authenticated"}';
insert into public.farms (id, name)
values ('27000000-0000-0000-0000-000000000002', 'Activities farm B');
insert into public.activities (id, farm_id, name, kind)
values ('37000000-0000-0000-0000-000000000005', '27000000-0000-0000-0000-000000000002', 'Farm B private category', 'commerce');

reset role;
insert into public.farm_members (farm_id, user_id, role) values
  ('27000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000002', 'worker'),
  ('27000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000003', 'accountant');
set local role authenticated;
set local request.jwt.claims = '{"sub":"17000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- Owner CRUD and all four existing kind values.
insert into public.activities (id, farm_id, name, kind, is_active, created_at) values
  ('37000000-0000-0000-0000-000000000001', '27000000-0000-0000-0000-000000000001', 'Olives 50%', 'culture', true, '2026-01-01T00:00:00Z'),
  ('37000000-0000-0000-0000-000000000002', '27000000-0000-0000-0000-000000000001', 'Livestock category', 'elevage', true, '2026-02-01T00:00:00Z'),
  ('37000000-0000-0000-0000-000000000003', '27000000-0000-0000-0000-000000000001', 'Historic sales', 'commerce', false, '2026-03-01T00:00:00Z'),
  ('37000000-0000-0000-0000-000000000004', '27000000-0000-0000-0000-000000000001', 'Other category', 'autre', true, '2026-04-01T00:00:00Z');

do $$
declare
  temporary_id uuid;
begin
  update public.activities set name = 'Olives 50% updated', is_active = false, updated_at = '2000-01-01'
  where id = '37000000-0000-0000-0000-000000000001';
  if not exists (
    select 1 from public.activities where id = '37000000-0000-0000-0000-000000000001'
      and name = 'Olives 50% updated' and not is_active and updated_at = now()
  ) then raise exception 'owner edit, deactivation or updated_at trigger failed'; end if;
  update public.activities set is_active = true where id = '37000000-0000-0000-0000-000000000001';
  if not exists (select 1 from public.activities where id = '37000000-0000-0000-0000-000000000001' and is_active) then
    raise exception 'owner reactivation failed';
  end if;

  if (select count(*) from public.activities
      where farm_id = '27000000-0000-0000-0000-000000000001'
        and kind = 'culture' and is_active and name ilike '%50\%%'
        and created_at >= '2026-01-01T00:00:00Z' and created_at < '2026-01-02T00:00:00Z') <> 1 then
    raise exception 'combined name/kind/state/creation-date filtering failed';
  end if;
  if (select count(*) from public.v_activity_pnl
      where farm_id = '27000000-0000-0000-0000-000000000001') <> 4 then
    raise exception 'activity reporting view lost categories';
  end if;

  insert into public.activities (farm_id, name, kind)
  values ('27000000-0000-0000-0000-000000000001', 'Unreferenced', 'autre')
  returning id into temporary_id;
  delete from public.activities where id = temporary_id;
  if exists (select 1 from public.activities where id = temporary_id) then
    raise exception 'owner could not delete an unreferenced activity';
  end if;

  begin
    update public.activities set farm_id = '27000000-0000-0000-0000-000000000002'
    where id = '37000000-0000-0000-0000-000000000004';
    raise exception 'owner moved a category into an unauthorized farm';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.activities (farm_id, name, kind)
    values ('27000000-0000-0000-0000-000000000001', ' ', 'culture');
    raise exception 'blank activity name was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.activities (farm_id, name, kind)
    values ('27000000-0000-0000-0000-000000000001', 'Invalid kind', 'field_operation');
    raise exception 'incompatible activity kind was accepted';
  exception when check_violation then null;
  end;
end;
$$;

-- Both non-owner roles can read inactive history, but cannot mutate categories.
-- A forged JWT role does not override the actual membership role.
do $$
declare
  member_id uuid;
  changed integer;
begin
  foreach member_id in array array[
    '17000000-0000-0000-0000-000000000002'::uuid,
    '17000000-0000-0000-0000-000000000003'::uuid
  ] loop
    perform set_config('request.jwt.claims', json_build_object('sub', member_id, 'role', 'owner')::text, true);
    if (select count(*) from public.activities where farm_id = '27000000-0000-0000-0000-000000000001') <> 4
       or not exists (select 1 from public.activities where id = '37000000-0000-0000-0000-000000000003' and not is_active) then
      raise exception 'member cannot read economic categories or inactive history';
    end if;
    begin
      insert into public.activities (farm_id, name, kind)
      values ('27000000-0000-0000-0000-000000000001', 'Forbidden creation', 'culture');
      raise exception 'non-owner created a category';
    exception when insufficient_privilege then null;
    end;
    update public.activities set name = 'Forbidden edit', is_active = false
    where id = '37000000-0000-0000-0000-000000000001';
    get diagnostics changed = row_count;
    if changed <> 0 then raise exception 'non-owner edited/deactivated a category'; end if;
    update public.activities set is_active = true where id = '37000000-0000-0000-0000-000000000003';
    get diagnostics changed = row_count;
    if changed <> 0 then raise exception 'non-owner reactivated a category'; end if;
    delete from public.activities where id = '37000000-0000-0000-0000-000000000004';
    get diagnostics changed = row_count;
    if changed <> 0 then raise exception 'non-owner deleted a category'; end if;
  end loop;
end;
$$;

-- Workers retain operational assignment permissions, including inactive and
-- non-culture categories. Plot changes do not rewrite historical cycle links.
set local request.jwt.claims = '{"sub":"17000000-0000-0000-0000-000000000002","role":"authenticated"}';
insert into public.plots (id, farm_id, activity_id, name, area_hectares)
values ('47000000-0000-0000-0000-000000000001', '27000000-0000-0000-0000-000000000001', '37000000-0000-0000-0000-000000000003', 'Worker plot', 5);
insert into public.crop_cycles (
  id, farm_id, activity_id, plot_id, crop_name, started_on, expected_harvest_on, cultivated_area_hectares
) values (
  '67000000-0000-0000-0000-000000000001', '27000000-0000-0000-0000-000000000001',
  '37000000-0000-0000-0000-000000000001', '47000000-0000-0000-0000-000000000001',
  'Worker crop', '2026-01-01', '2026-06-01', 2
);
update public.plots set activity_id = '37000000-0000-0000-0000-000000000002'
where id = '47000000-0000-0000-0000-000000000001';
update public.crop_cycles set notes = 'Unrelated edit'
where id = '67000000-0000-0000-0000-000000000001';
do $$
begin
  if not exists (select 1 from public.crop_cycles
      where id = '67000000-0000-0000-0000-000000000001'
        and activity_id = '37000000-0000-0000-0000-000000000001' and notes = 'Unrelated edit') then
    raise exception 'plot reassignment or unrelated crop edit overwrote the cycle activity';
  end if;
end;
$$;
update public.plots set activity_id = null where id = '47000000-0000-0000-0000-000000000001';
update public.crop_cycles set activity_id = null where id = '67000000-0000-0000-0000-000000000001';
do $$
begin
  if not exists (select 1 from public.plots where id = '47000000-0000-0000-0000-000000000001' and activity_id is null)
     or not exists (select 1 from public.crop_cycles where id = '67000000-0000-0000-0000-000000000001' and activity_id is null) then
    raise exception 'worker could not explicitly unassign nullable activity links';
  end if;
end;
$$;
update public.plots set activity_id = '37000000-0000-0000-0000-000000000003' where id = '47000000-0000-0000-0000-000000000001';
update public.crop_cycles set activity_id = '37000000-0000-0000-0000-000000000003' where id = '67000000-0000-0000-0000-000000000001';

set local request.jwt.claims = '{"sub":"17000000-0000-0000-0000-000000000003","role":"authenticated"}';
do $$
declare changed integer;
begin
  update public.plots set activity_id = null where id = '47000000-0000-0000-0000-000000000001';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'accountant changed a plot assignment'; end if;
  update public.crop_cycles set activity_id = null where id = '67000000-0000-0000-0000-000000000001';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'accountant changed a cycle assignment'; end if;
end;
$$;

-- Farm B cannot discover or mutate Farm A categories, including through IDs.
set local request.jwt.claims = '{"sub":"17000000-0000-0000-0000-000000000004","role":"authenticated"}';
do $$
declare changed integer;
begin
  if exists (select 1 from public.activities where farm_id = '27000000-0000-0000-0000-000000000001')
     or exists (select 1 from public.v_activity_pnl where farm_id = '27000000-0000-0000-0000-000000000001') then
    raise exception 'farm B can read farm A categories or financial aggregates';
  end if;
  update public.activities set name = 'Cross-farm edit' where id = '37000000-0000-0000-0000-000000000001';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'cross-farm activity UPDATE succeeded'; end if;
  delete from public.activities where id = '37000000-0000-0000-0000-000000000001';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'cross-farm activity DELETE succeeded'; end if;
  begin
    insert into public.activities (farm_id, name, kind)
    values ('27000000-0000-0000-0000-000000000001', 'Cross-farm create', 'culture');
    raise exception 'cross-farm activity INSERT succeeded';
  exception when insufficient_privilege then null;
  end;
end;
$$;

set local role anon;
do $$
begin
  begin
    perform 1 from public.activities;
    raise exception 'anonymous activity read succeeded';
  exception when insufficient_privilege then null;
  end;
end;
$$;
set local role authenticated;
set local request.jwt.claims = '{"sub":"17000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- Isolate each dependent table behind its own category so no other foreign key
-- can mask a missing deletion restriction. Also test cross-farm INSERT/UPDATE
-- references for every table carrying an activity FK.
insert into public.plots (id, farm_id, name, area_hectares)
values ('47000000-0000-0000-0000-000000000003', '27000000-0000-0000-0000-000000000001', 'Dependency plot without activity', 4);
insert into public.products (id, farm_id, name)
values ('57000000-0000-0000-0000-000000000001', '27000000-0000-0000-0000-000000000001', 'Dependency supply');

do $$
declare
  dependency text;
  activity uuid;
  insert_sql text;
  linked_count integer;
  farm uuid := '27000000-0000-0000-0000-000000000001';
  foreign_activity uuid := '37000000-0000-0000-0000-000000000005';
begin
  foreach dependency in array array['plots', 'crop_cycles', 'animal_groups', 'transactions', 'inventory_movements', 'tasks'] loop
    insert into public.activities (farm_id, name, kind)
    values (farm, 'Dependency: ' || dependency, 'commerce') returning id into activity;
    case dependency
      when 'plots' then insert_sql := $sql$
        insert into public.plots (farm_id, activity_id, name, area_hectares) values ($1, $2, 'Dependency plot', 4)
      $sql$;
      when 'crop_cycles' then insert_sql := $sql$
        insert into public.crop_cycles (farm_id, activity_id, plot_id, crop_name, started_on, expected_harvest_on, cultivated_area_hectares)
        values ($1, $2, '47000000-0000-0000-0000-000000000003', 'Dependency crop', '2026-01-01', '2026-06-01', 1)
      $sql$;
      when 'animal_groups' then insert_sql := $sql$
        insert into public.animal_groups (farm_id, activity_id, name, species) values ($1, $2, 'Dependency herd', 'sheep')
      $sql$;
      when 'transactions' then insert_sql := $sql$
        insert into public.transactions (farm_id, activity_id, kind) values ($1, $2, 'depense')
      $sql$;
      when 'inventory_movements' then insert_sql := $sql$
        insert into public.inventory_movements (farm_id, activity_id, product_id, kind, quantity)
        values ($1, $2, '57000000-0000-0000-0000-000000000001', 'entree', 1)
      $sql$;
      when 'tasks' then insert_sql := $sql$
        insert into public.tasks (farm_id, activity_id, title) values ($1, $2, 'Dependency work item')
      $sql$;
    end case;

    begin
      execute insert_sql using farm, foreign_activity;
      raise exception 'cross-farm activity INSERT reference accepted by %', dependency;
    exception when foreign_key_violation then null;
    end;
    execute insert_sql using farm, activity;
    begin
      execute format('update public.%I set activity_id = $1 where farm_id = $2 and activity_id = $3', dependency)
      using foreign_activity, farm, activity;
      raise exception 'cross-farm activity UPDATE reference accepted by %', dependency;
    exception when foreign_key_violation then null;
    end;

    begin
      delete from public.activities where id = activity;
      raise exception 'activity deletion was not blocked by %', dependency;
    exception when foreign_key_violation then null;
    end;
    update public.activities set is_active = false where id = activity;
    if not exists (select 1 from public.activities where id = activity and not is_active) then
      raise exception 'could not deactivate category referenced by %', dependency;
    end if;
    execute format('select count(*) from public.%I where farm_id = $1 and activity_id = $2', dependency)
    into linked_count using farm, activity;
    if linked_count <> 1 then raise exception 'deactivation or failed FK mutation changed history in %', dependency; end if;
    update public.activities set is_active = true where id = activity;
  end loop;
end;
$$;

-- A cycle with dependent records cannot be reassigned or unassigned silently.
update public.crop_cycles set activity_id = '37000000-0000-0000-0000-000000000001'
where id = '67000000-0000-0000-0000-000000000001';
insert into public.tasks (farm_id, activity_id, crop_cycle_id, title)
values ('27000000-0000-0000-0000-000000000001', '37000000-0000-0000-0000-000000000001',
  '67000000-0000-0000-0000-000000000001', 'Preserve cycle assignment');
do $$
begin
  begin
    update public.crop_cycles set activity_id = null where id = '67000000-0000-0000-0000-000000000001';
    raise exception 'cycle with dependent task was unassigned';
  exception when foreign_key_violation then null;
  end;
  begin
    update public.crop_cycles set activity_id = '37000000-0000-0000-0000-000000000002'
    where id = '67000000-0000-0000-0000-000000000001';
    raise exception 'cycle with dependent task was reassigned';
  exception when foreign_key_violation then null;
  end;
  if not exists (select 1 from public.crop_cycles where id = '67000000-0000-0000-0000-000000000001'
      and activity_id = '37000000-0000-0000-0000-000000000001') then
    raise exception 'failed reassignment did not preserve the existing activity';
  end if;
end;
$$;

rollback;
