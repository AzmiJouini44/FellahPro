\set ON_ERROR_STOP on

-- dblink opens independent PostgreSQL sessions so both orderings exercise
-- actual row-lock waits instead of sequential statements in one transaction.
create extension if not exists dblink;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  '16000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated', 'cycles-concurrency@example.test', '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  now(), now(), '', '', '', ''
);

insert into public.farms (id, name, created_by)
values (
  '26000000-0000-0000-0000-000000000001',
  'Crop cycle concurrency farm',
  '16000000-0000-0000-0000-000000000001'
);

insert into public.plots (id, farm_id, name, area_hectares)
values (
  '36000000-0000-0000-0000-000000000001',
  '26000000-0000-0000-0000-000000000001',
  'Concurrency plot',
  10
);

create function public.test_reduce_plot_area_for_concurrency(new_area numeric)
returns text
language plpgsql
set search_path = ''
as $$
begin
  begin
    update public.plots
    set area_hectares = new_area
    where id = '36000000-0000-0000-0000-000000000001';
    return 'unexpected-success';
  exception
    when check_violation then return 'rejected';
  end;
end;
$$;

create function public.test_insert_cycle_for_concurrency(cycle_id uuid, cycle_area numeric)
returns text
language plpgsql
set search_path = ''
as $$
begin
  begin
    insert into public.crop_cycles (
      id, farm_id, plot_id, crop_name, started_on, expected_harvest_on,
      cultivated_area_hectares, status
    ) values (
      cycle_id,
      '26000000-0000-0000-0000-000000000001',
      '36000000-0000-0000-0000-000000000001',
      'Concurrency crop', '2026-11-01', '2027-06-01', cycle_area, 'active'
    );
    return 'unexpected-success';
  exception
    when check_violation then return 'rejected';
  end;
end;
$$;

select dblink_connect(
  'cycle_connection',
  format(
    'host=127.0.0.1 port=%s dbname=%s user=%s application_name=mission3b_cycle_connection',
    current_setting('port'), current_database(), current_user
  )
);
select dblink_connect(
  'plot_connection',
  format(
    'host=127.0.0.1 port=%s dbname=%s user=%s application_name=mission3b_plot_connection',
    current_setting('port'), current_database(), current_user
  )
);

-- Ordering A: the cycle insert holds FOR SHARE on the plot. The concurrent
-- area reduction must wait, then observe the committed cycle and be rejected.
select dblink_exec('cycle_connection', 'begin');
select dblink_exec(
  'cycle_connection',
  $$
    insert into public.crop_cycles (
      id, farm_id, plot_id, crop_name, started_on, expected_harvest_on,
      cultivated_area_hectares, status
    ) values (
      '46000000-0000-0000-0000-000000000001',
      '26000000-0000-0000-0000-000000000001',
      '36000000-0000-0000-0000-000000000001',
      'Lock first crop', '2026-11-01', '2027-06-01', 8, 'active'
    )
  $$
);
select dblink_send_query(
  'plot_connection',
  'select public.test_reduce_plot_area_for_concurrency(5)'
);
select pg_sleep(0.5);

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_stat_activity
    where application_name = 'mission3b_plot_connection'
      and wait_event_type = 'Lock'
  ) then
    raise exception 'ordering A did not block the plot reduction on the cycle-held plot lock';
  end if;
end;
$$;

select dblink_exec('cycle_connection', 'commit');

do $$
declare
  outcome text;
begin
  select result into outcome
  from dblink_get_result('plot_connection') as result(result text);

  if outcome <> 'rejected' then
    raise exception 'ordering A plot reduction was not rejected: %', outcome;
  end if;

  -- libpq requires one extra fetch returning an empty set before the named
  -- connection can accept another command.
  perform result
  from dblink_get_result('plot_connection') as result(result text);
end;
$$;

delete from public.crop_cycles
where id = '46000000-0000-0000-0000-000000000001';
update public.plots
set area_hectares = 10
where id = '36000000-0000-0000-0000-000000000001';

-- Ordering B: the plot reduction holds FOR NO KEY UPDATE first. The cycle
-- insert must wait, then read the committed smaller area and be rejected.
select dblink_exec('plot_connection', 'begin');
select dblink_exec(
  'plot_connection',
  $$
    update public.plots
    set area_hectares = 5
    where id = '36000000-0000-0000-0000-000000000001'
  $$
);
select dblink_send_query(
  'cycle_connection',
  $$
    select public.test_insert_cycle_for_concurrency(
      '46000000-0000-0000-0000-000000000002',
      8
    )
  $$
);
select pg_sleep(0.5);

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_stat_activity
    where application_name = 'mission3b_cycle_connection'
      and wait_event_type = 'Lock'
  ) then
    raise exception 'ordering B did not block the cycle insert on the plot-held lock';
  end if;
end;
$$;

select dblink_exec('plot_connection', 'commit');

do $$
declare
  outcome text;
begin
  select result into outcome
  from dblink_get_result('cycle_connection') as result(result text);

  if outcome <> 'rejected' then
    raise exception 'ordering B crop-cycle insert was not rejected: %', outcome;
  end if;

  perform result
  from dblink_get_result('cycle_connection') as result(result text);
end;
$$;

do $$
begin
  if exists (
    select 1 from public.crop_cycles
    where id = '46000000-0000-0000-0000-000000000002'
  ) then
    raise exception 'ordering B left an oversized crop cycle behind';
  end if;

  if not exists (
    select 1 from public.plots
    where id = '36000000-0000-0000-0000-000000000001'
      and area_hectares = 5
  ) then
    raise exception 'ordering B did not commit the plot-area reduction';
  end if;
end;
$$;

select dblink_disconnect('cycle_connection');
select dblink_disconnect('plot_connection');

drop function public.test_insert_cycle_for_concurrency(uuid, numeric);
drop function public.test_reduce_plot_area_for_concurrency(numeric);

delete from public.farms
where id = '26000000-0000-0000-0000-000000000001';
delete from auth.users
where id = '16000000-0000-0000-0000-000000000001';
