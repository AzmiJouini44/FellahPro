\set ON_ERROR_STOP on

begin;

-- Administrative fixture setup only; every application check below uses RLS.
-- The transaction rolls back users, memberships, parents, and tasks together.
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
  ('18000000-0000-0000-0000-000000000001'::uuid, 'tasks-owner-a@example.test'),
  ('18000000-0000-0000-0000-000000000002'::uuid, 'tasks-worker@example.test'),
  ('18000000-0000-0000-0000-000000000003'::uuid, 'tasks-accountant@example.test'),
  ('18000000-0000-0000-0000-000000000004'::uuid, 'tasks-owner-b@example.test')
) as u(id, email);

set local role authenticated;
set local request.jwt.claims = '{"sub":"18000000-0000-0000-0000-000000000001","role":"authenticated"}';
insert into public.farms (id, name) values ('28000000-0000-0000-0000-000000000001', 'Tasks farm A');
set local request.jwt.claims = '{"sub":"18000000-0000-0000-0000-000000000004","role":"authenticated"}';
insert into public.farms (id, name) values ('28000000-0000-0000-0000-000000000002', 'Tasks farm B');
reset role;
insert into public.farm_members (farm_id, user_id, role) values
  ('28000000-0000-0000-0000-000000000001', '18000000-0000-0000-0000-000000000002', 'worker'),
  ('28000000-0000-0000-0000-000000000001', '18000000-0000-0000-0000-000000000003', 'accountant');

set local role authenticated;
set local request.jwt.claims = '{"sub":"18000000-0000-0000-0000-000000000004","role":"authenticated"}';
insert into public.activities (id, farm_id, name, kind)
values ('38000000-0000-0000-0000-000000000003', '28000000-0000-0000-0000-000000000002', 'Private B', 'culture');
insert into public.plots (id, farm_id, name, area_hectares)
values ('48000000-0000-0000-0000-000000000002', '28000000-0000-0000-0000-000000000002', 'B plot', 10);
insert into public.crop_cycles (id, farm_id, activity_id, plot_id, crop_name, started_on, expected_harvest_on, cultivated_area_hectares)
values ('58000000-0000-0000-0000-000000000003', '28000000-0000-0000-0000-000000000002', '38000000-0000-0000-0000-000000000003', '48000000-0000-0000-0000-000000000002', 'B olives', '2026-01-01', '2026-12-01', 1);
insert into public.animal_groups (id, farm_id, activity_id, name, species)
values ('68000000-0000-0000-0000-000000000002', '28000000-0000-0000-0000-000000000002', '38000000-0000-0000-0000-000000000003', 'B animals', 'Sheep');
insert into public.tasks (id, farm_id, title, due_on)
values ('78000000-0000-0000-0000-000000000008', '28000000-0000-0000-0000-000000000002', 'Private B task', '2026-11-19');

set local request.jwt.claims = '{"sub":"18000000-0000-0000-0000-000000000001","role":"authenticated"}';
insert into public.activities (id, farm_id, name, kind, is_active) values
  ('38000000-0000-0000-0000-000000000001', '28000000-0000-0000-0000-000000000001', 'A olives', 'culture', true),
  ('38000000-0000-0000-0000-000000000002', '28000000-0000-0000-0000-000000000001', 'A inactive trade', 'commerce', false);
insert into public.plots (id, farm_id, name, area_hectares)
values ('48000000-0000-0000-0000-000000000001', '28000000-0000-0000-0000-000000000001', 'A plot', 10);
insert into public.crop_cycles (id, farm_id, activity_id, plot_id, crop_name, started_on, expected_harvest_on, cultivated_area_hectares) values
  ('58000000-0000-0000-0000-000000000001', '28000000-0000-0000-0000-000000000001', '38000000-0000-0000-0000-000000000001', '48000000-0000-0000-0000-000000000001', 'A olives', '2026-01-01', '2026-12-01', 1),
  ('58000000-0000-0000-0000-000000000002', '28000000-0000-0000-0000-000000000001', null, '48000000-0000-0000-0000-000000000001', 'Unclassified cycle', '2026-01-01', '2026-12-01', 1);
insert into public.animal_groups (id, farm_id, activity_id, name, species)
values ('68000000-0000-0000-0000-000000000001', '28000000-0000-0000-0000-000000000001', '38000000-0000-0000-0000-000000000002', 'A animals', 'Sheep');
insert into public.tasks (id, farm_id, title, description, due_on, status, priority, assigned_to, activity_id, crop_cycle_id, animal_group_id) values
  ('78000000-0000-0000-0000-000000000001', '28000000-0000-0000-0000-000000000001', 'Overdue 50%', 'Check irrigation', '2026-11-19', 'a_faire', 'haute', '18000000-0000-0000-0000-000000000002', '38000000-0000-0000-0000-000000000001', '58000000-0000-0000-0000-000000000001', null),
  ('78000000-0000-0000-0000-000000000002', '28000000-0000-0000-0000-000000000001', 'Today', null, '2026-11-20', 'en_cours', 'normale', '18000000-0000-0000-0000-000000000003', '38000000-0000-0000-0000-000000000002', null, '68000000-0000-0000-0000-000000000001'),
  ('78000000-0000-0000-0000-000000000003', '28000000-0000-0000-0000-000000000001', 'Upcoming', null, '2026-11-26', 'a_faire', 'basse', '18000000-0000-0000-0000-000000000001', null, null, null),
  ('78000000-0000-0000-0000-000000000004', '28000000-0000-0000-0000-000000000001', 'Later', null, '2026-11-27', 'a_faire', 'normale', null, null, null, null),
  ('78000000-0000-0000-0000-000000000005', '28000000-0000-0000-0000-000000000001', 'Completed history', null, '2026-11-19', 'terminee', 'normale', null, null, null, null),
  ('78000000-0000-0000-0000-000000000006', '28000000-0000-0000-0000-000000000001', 'Cancelled history', null, '2026-11-18', 'annulee', 'normale', null, null, null, null),
  ('78000000-0000-0000-0000-000000000007', '28000000-0000-0000-0000-000000000001', 'Without due date', null, null, 'a_faire', 'normale', null, null, null, null);

-- Owner CRUD, all status/priority transitions, optional clearing and audit trigger.
do $$
declare task_id uuid; state text; importance text; changed integer;
begin
  if (select count(*) from public.tasks) <> 7 then raise exception 'owner list leaked another farm or lost tasks'; end if;
  insert into public.tasks (farm_id, title, description, due_on, activity_id, crop_cycle_id, assigned_to)
  values ('28000000-0000-0000-0000-000000000001', 'Editable task', 'Instructions', '2026-11-19', '38000000-0000-0000-0000-000000000001', '58000000-0000-0000-0000-000000000001', '18000000-0000-0000-0000-000000000002')
  returning id into task_id;
  foreach state in array array['a_faire', 'en_cours', 'terminee', 'annulee'] loop
    foreach importance in array array['basse', 'normale', 'haute'] loop
      update public.tasks set status = state, priority = importance, updated_at = '2000-01-01' where id = task_id;
      if not exists (select 1 from public.tasks where id = task_id and status = state and priority = importance and updated_at = now()
        and due_on = '2026-11-19' and description = 'Instructions' and crop_cycle_id = '58000000-0000-0000-0000-000000000001') then
        raise exception 'owner status/priority edit damaged fields or audit trigger';
      end if;
    end loop;
  end loop;
  update public.tasks set title = 'Reassigned', activity_id = '38000000-0000-0000-0000-000000000002', crop_cycle_id = null,
    animal_group_id = '68000000-0000-0000-0000-000000000001', assigned_to = '18000000-0000-0000-0000-000000000003'
  where id = task_id;
  if not exists (select 1 from public.tasks where id = task_id and title = 'Reassigned' and animal_group_id is not null and assigned_to = '18000000-0000-0000-0000-000000000003') then
    raise exception 'owner could not reassign to a same-farm accountant and inactive non-culture activity';
  end if;
  update public.tasks set description = null, due_on = null, assigned_to = null, activity_id = null, animal_group_id = null where id = task_id;
  if not exists (select 1 from public.tasks where id = task_id and num_nonnulls(description, due_on, assigned_to, activity_id, crop_cycle_id, animal_group_id) = 0) then
    raise exception 'optional fields could not be cleared';
  end if;
  delete from public.tasks where id = task_id;
  get diagnostics changed = row_count;
  if changed <> 1 or exists (select 1 from public.tasks where id = task_id) then raise exception 'owner deletion failed'; end if;
  if not exists (select 1 from public.crop_cycles where id = '58000000-0000-0000-0000-000000000001')
    or not exists (select 1 from public.animal_groups where id = '68000000-0000-0000-0000-000000000001') then
    raise exception 'task deletion removed a parent record';
  end if;
end;
$$;

-- Fixed calendar dates keep reminder expectations independent of execution time.
do $$
begin
  if (select count(*) from public.tasks where status in ('a_faire', 'en_cours')) <> 5
    or (select count(*) from public.tasks where status in ('a_faire', 'en_cours') and due_on = '2026-11-20') <> 1
    or (select count(*) from public.tasks where status in ('a_faire', 'en_cours') and due_on < '2026-11-20') <> 1
    or (select count(*) from public.tasks where status = 'terminee') <> 1
    or (select count(*) from public.tasks where status in ('a_faire', 'en_cours') and due_on between '2026-11-20' and '2026-11-26') <> 2 then
    raise exception 'farm reminder counts include cancelled/completed history, null dates, or foreign tasks';
  end if;
  if (select count(*) from public.tasks where title ilike '%50\%%' and priority = 'haute' and status = 'a_faire'
    and assigned_to = '18000000-0000-0000-0000-000000000002' and due_on between '2026-11-19' and '2026-11-20') <> 1 then
    raise exception 'combined literal-title/priority/status/assignee/date filter failed';
  end if;
end;
$$;

-- INSERT and UPDATE each exercise one invalid relationship at a time. Valid
-- activity values isolate the crop/group composite-FK checks from activity FK.
do $$
declare variant integer; operation text; task_id uuid; activity uuid; cycle uuid; animal uuid; assignee uuid;
begin
  insert into public.tasks (farm_id, title) values ('28000000-0000-0000-0000-000000000001', 'Reference test') returning id into task_id;
  foreach operation in array array['insert', 'update'] loop
    for variant in 1..8 loop
      activity := null; cycle := null; animal := null; assignee := null;
      case variant
        when 1 then activity := '38000000-0000-0000-0000-000000000003'; -- foreign activity
        when 2 then activity := '38000000-0000-0000-0000-000000000001'; cycle := '58000000-0000-0000-0000-000000000003'; -- foreign cycle
        when 3 then activity := '38000000-0000-0000-0000-000000000002'; animal := '68000000-0000-0000-0000-000000000002'; -- foreign group
        when 4 then assignee := '18000000-0000-0000-0000-000000000004'; -- foreign farm member
        when 5 then assignee := '18000000-0000-0000-0000-000000000099'; -- nonexistent member
        when 6 then activity := '38000000-0000-0000-0000-000000000002'; cycle := '58000000-0000-0000-0000-000000000001'; -- same-farm cycle/activity mismatch
        when 7 then activity := '38000000-0000-0000-0000-000000000001'; animal := '68000000-0000-0000-0000-000000000001'; -- same-farm group/activity mismatch
        when 8 then activity := '38000000-0000-0000-0000-000000000001'; cycle := '58000000-0000-0000-0000-000000000002'; -- unclassified cycle
      end case;
      begin
        if operation = 'insert' then
          insert into public.tasks (farm_id, title, activity_id, crop_cycle_id, animal_group_id, assigned_to)
          values ('28000000-0000-0000-0000-000000000001', 'Invalid reference', activity, cycle, animal, assignee);
        else
          update public.tasks set activity_id = activity, crop_cycle_id = cycle, animal_group_id = animal, assigned_to = assignee where id = task_id;
          if not found then raise exception 'reference UPDATE did not target a real row'; end if;
        end if;
        raise exception 'invalid reference variant % % was accepted', variant, operation;
      exception when foreign_key_violation then null;
      end;
    end loop;
  end loop;
  delete from public.tasks where id = task_id;
end;
$$;

-- Existing CHECK constraints still reject competing links, missing activity,
-- blank titles, unknown status and priority (including redundant overdue).
do $$
declare task_id uuid; variant integer; bad_state text; bad_priority text; activity uuid; cycle uuid; animal uuid; task_title text;
begin
  insert into public.tasks (farm_id, title) values ('28000000-0000-0000-0000-000000000001', 'Constraint test') returning id into task_id;
  for variant in 1..6 loop
    bad_state := 'a_faire'; bad_priority := 'normale'; activity := null; cycle := null; animal := null; task_title := 'Invalid values';
    case variant
      when 1 then activity := '38000000-0000-0000-0000-000000000001'; cycle := '58000000-0000-0000-0000-000000000001'; animal := '68000000-0000-0000-0000-000000000001';
      when 2 then cycle := '58000000-0000-0000-0000-000000000001';
      when 3 then animal := '68000000-0000-0000-0000-000000000001';
      when 4 then bad_state := 'overdue';
      when 5 then bad_priority := 'urgent';
      when 6 then task_title := ' ';
    end case;
    begin
      insert into public.tasks (farm_id, title, status, priority, activity_id, crop_cycle_id, animal_group_id)
      values ('28000000-0000-0000-0000-000000000001', task_title, bad_state, bad_priority, activity, cycle, animal);
      raise exception 'invalid CHECK variant % INSERT was accepted', variant;
    exception when check_violation then null;
    end;
    begin
      update public.tasks set title = task_title, status = bad_state, priority = bad_priority, activity_id = activity, crop_cycle_id = cycle, animal_group_id = animal where id = task_id;
      if not found then raise exception 'constraint UPDATE did not target a real row'; end if;
      raise exception 'invalid CHECK variant % UPDATE was accepted', variant;
    exception when check_violation then null;
    end;
  end loop;
  delete from public.tasks where id = task_id;
end;
$$;

-- Worker can create and edit farm tasks, even when another member is assigned.
-- Claiming owner in the JWT cannot grant DELETE permission.
set local request.jwt.claims = '{"sub":"18000000-0000-0000-0000-000000000002","role":"owner"}';
do $$
declare task_id uuid; changed integer;
begin
  if (select count(*) from public.tasks) <> 7 then raise exception 'worker read isolation failed'; end if;
  if (select count(*) from public.farm_members fm join public.profiles p on p.id = fm.user_id
    where fm.farm_id = '28000000-0000-0000-0000-000000000001') <> 3 then raise exception 'same-farm assignee profiles are not visible'; end if;
  insert into public.tasks (farm_id, title, assigned_to)
  values ('28000000-0000-0000-0000-000000000001', 'Worker task', '18000000-0000-0000-0000-000000000003') returning id into task_id;
  update public.tasks set title = 'Worker edit', status = 'en_cours', priority = 'haute', due_on = '2026-11-20' where id = task_id;
  if not exists (select 1 from public.tasks where id = task_id and title = 'Worker edit' and status = 'en_cours' and priority = 'haute' and due_on = '2026-11-20') then
    raise exception 'worker create/edit failed';
  end if;
  update public.tasks set status = 'en_cours' where id = '78000000-0000-0000-0000-000000000003';
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'worker cannot edit a task assigned to a different member'; end if;
  delete from public.tasks where id in (task_id, '78000000-0000-0000-0000-000000000001');
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'worker deleted own or another member task'; end if;
end;
$$;

-- Accountant can read, with INSERT rejected and UPDATE/DELETE affecting zero.
set local request.jwt.claims = '{"sub":"18000000-0000-0000-0000-000000000003","role":"owner"}';
do $$
declare changed integer;
begin
  if (select count(*) from public.tasks) <> 8 then raise exception 'accountant read failed'; end if;
  begin
    insert into public.tasks (farm_id, title) values ('28000000-0000-0000-0000-000000000001', 'Forbidden accountant task');
    raise exception 'accountant created a task';
  exception when insufficient_privilege then null;
  end;
  update public.tasks set title = 'Forbidden accountant edit', status = 'terminee' where id = '78000000-0000-0000-0000-000000000002';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'accountant updated an assigned task'; end if;
  delete from public.tasks where id = '78000000-0000-0000-0000-000000000002';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'accountant deleted an assigned task'; end if;
end;
$$;

-- In both directions no farm member can read, mutate, create in, or move tasks
-- into the other farm, even with a valid foreign UUID.
do $$
declare member_id uuid; home uuid; foreign_farm uuid; home_task uuid; foreign_task uuid; changed integer;
begin
  foreach member_id in array array['18000000-0000-0000-0000-000000000001'::uuid, '18000000-0000-0000-0000-000000000002'::uuid, '18000000-0000-0000-0000-000000000004'::uuid] loop
    perform set_config('request.jwt.claims', json_build_object('sub', member_id, 'role', 'owner')::text, true);
    if member_id = '18000000-0000-0000-0000-000000000004' then
      home := '28000000-0000-0000-0000-000000000002'; foreign_farm := '28000000-0000-0000-0000-000000000001';
      home_task := '78000000-0000-0000-0000-000000000008'; foreign_task := '78000000-0000-0000-0000-000000000001';
    else
      home := '28000000-0000-0000-0000-000000000001'; foreign_farm := '28000000-0000-0000-0000-000000000002';
      home_task := '78000000-0000-0000-0000-000000000001'; foreign_task := '78000000-0000-0000-0000-000000000008';
    end if;
    if exists (select 1 from public.tasks where id = foreign_task or farm_id = foreign_farm) then raise exception 'foreign tasks visible to %', member_id; end if;
    update public.tasks set title = 'Foreign edit' where id = foreign_task;
    get diagnostics changed = row_count;
    if changed <> 0 then raise exception 'foreign task UPDATE succeeded'; end if;
    delete from public.tasks where id = foreign_task;
    get diagnostics changed = row_count;
    if changed <> 0 then raise exception 'foreign task DELETE succeeded'; end if;
    begin
      insert into public.tasks (farm_id, title) values (foreign_farm, 'Foreign create');
      raise exception 'foreign farm INSERT succeeded';
    exception when insufficient_privilege then null;
    end;
    begin
      -- Clear references so only farm authorization controls this test.
      update public.tasks set farm_id = foreign_farm, activity_id = null, crop_cycle_id = null, animal_group_id = null, assigned_to = null where id = home_task and farm_id = home;
      if not found then raise exception 'farm-move UPDATE did not target an authorized row'; end if;
      raise exception 'task moved into unauthorized farm';
    exception when insufficient_privilege then null;
    end;
  end loop;
end;
$$;

-- Membership deletion unassigns work instead of deleting it. Stale references
-- fail after the member leaves, and that former member loses read/write access.
set local request.jwt.claims = '{"sub":"18000000-0000-0000-0000-000000000001","role":"authenticated"}';
delete from public.farm_members where farm_id = '28000000-0000-0000-0000-000000000001' and user_id = '18000000-0000-0000-0000-000000000002';
do $$
begin
  if not exists (select 1 from public.tasks where id = '78000000-0000-0000-0000-000000000001' and assigned_to is null and farm_id = '28000000-0000-0000-0000-000000000001') then
    raise exception 'membership deletion removed task or failed to clear assignee';
  end if;
  begin
    update public.tasks set assigned_to = '18000000-0000-0000-0000-000000000002' where id = '78000000-0000-0000-0000-000000000001';
    raise exception 'stale departed assignee was accepted';
  exception when foreign_key_violation then null;
  end;
end;
$$;
set local request.jwt.claims = '{"sub":"18000000-0000-0000-0000-000000000002","role":"owner"}';
do $$
declare changed integer;
begin
  if exists (select 1 from public.tasks) then raise exception 'former member retains task visibility'; end if;
  update public.tasks set status = 'terminee' where id = '78000000-0000-0000-0000-000000000001';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'former member retains UPDATE permission'; end if;
  begin
    insert into public.tasks (farm_id, title) values ('28000000-0000-0000-0000-000000000001', 'Former member task');
    raise exception 'former member retains INSERT permission';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
set local role anon;
set local request.jwt.claims = '{}';
do $$
begin
  begin
    perform * from public.tasks;
    raise exception 'anonymous task SELECT succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.tasks (farm_id, title) values ('28000000-0000-0000-0000-000000000001', 'Anonymous task');
    raise exception 'anonymous task INSERT succeeded';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;
