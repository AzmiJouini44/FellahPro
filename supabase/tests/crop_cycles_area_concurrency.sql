\set ON_ERROR_STOP on

-- dblink opens independent PostgreSQL sessions so both orderings exercise
-- actual row-lock waits instead of sequential statements in one transaction.
select exists (
  select 1 from pg_catalog.pg_extension where extname = 'dblink'
) as dblink_preexisting
\gset
select exists (
  select 1 from pg_catalog.pg_namespace where nspname = 'extensions'
) as extensions_schema_preexisting
\gset

-- IF NOT EXISTS does not relocate an extension installed in another schema.
-- Check its actual namespace before creating schemas or changing fixtures.
do $$
declare
  dblink_schema name;
begin
  select n.nspname into dblink_schema
  from pg_catalog.pg_extension as e
  join pg_catalog.pg_namespace as n on n.oid = e.extnamespace
  where e.extname = 'dblink';

  if found and dblink_schema <> 'extensions' then
    raise exception 'concurrency test requires dblink in schema "extensions"; found schema "%"',
      dblink_schema;
  end if;
end;
$$;

create schema if not exists extensions;
create extension if not exists dblink with schema extensions;

-- A failed run closes its dblink sessions (rolling back open remote
-- transactions), but may leave committed fixtures or helper functions. Make
-- the next run self-cleaning while still requiring a disposable database.
drop function if exists public.test_insert_cycle_for_concurrency(uuid, numeric);
drop function if exists public.test_reduce_plot_area_for_concurrency(numeric);
delete from public.farms
where id = '26000000-0000-0000-0000-000000000001';
delete from auth.users
where id = '16000000-0000-0000-0000-000000000001';

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

select extensions.dblink_connect(
  'cycle_connection',
  format(
    'host=127.0.0.1 port=%s dbname=%s user=%s application_name=mission3b_cycle_connection',
    current_setting('port'), current_database(), current_user
  )
);
select extensions.dblink_connect(
  'plot_connection',
  format(
    'host=127.0.0.1 port=%s dbname=%s user=%s application_name=mission3b_plot_connection',
    current_setting('port'), current_database(), current_user
  )
);

-- Capture the PIDs from these exact connections rather than identifying
-- waiters or blockers by application_name alone.
create temporary table crop_cycle_concurrency_connections as
select cycle_session.pid as cycle_pid, plot_session.pid as plot_pid
from extensions.dblink('cycle_connection', 'select pg_backend_pid()') as cycle_session(pid integer)
cross join extensions.dblink('plot_connection', 'select pg_backend_pid()') as plot_session(pid integer);

-- Ordering A: the cycle insert holds FOR SHARE on the plot. The concurrent
-- area reduction must wait, then observe the committed cycle and be rejected.
select extensions.dblink_exec('cycle_connection', 'begin');
select extensions.dblink_exec(
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
select extensions.dblink_send_query(
  'plot_connection',
  'select public.test_reduce_plot_area_for_concurrency(5)'
);

do $$
declare
  deadline timestamptz := clock_timestamp() + interval '10 seconds';
begin
  loop
    perform pg_catalog.pg_stat_clear_snapshot();
    exit when exists (
      select 1
      from pg_catalog.pg_stat_activity as waiter
      cross join pg_temp.crop_cycle_concurrency_connections as connections
      where waiter.pid = connections.plot_pid
        and waiter.wait_event_type = 'Lock'
        and connections.cycle_pid = any(pg_catalog.pg_blocking_pids(waiter.pid))
    );

    if clock_timestamp() >= deadline then
      raise exception 'ordering A did not block the plot reduction on the cycle transaction within 10 seconds';
    end if;

    perform pg_sleep(0.01);
  end loop;
end;
$$;

select extensions.dblink_exec('cycle_connection', 'commit');

do $$
declare
  outcome text;
begin
  select result into outcome
  from extensions.dblink_get_result('plot_connection') as result(result text);

  if outcome <> 'rejected' then
    raise exception 'ordering A plot reduction was not rejected: %', outcome;
  end if;

  -- libpq requires one extra fetch returning an empty set before the named
  -- connection can accept another command.
  perform result
  from extensions.dblink_get_result('plot_connection') as result(result text);
end;
$$;

delete from public.crop_cycles
where id = '46000000-0000-0000-0000-000000000001';
update public.plots
set area_hectares = 10
where id = '36000000-0000-0000-0000-000000000001';

-- Ordering B: the plot reduction holds FOR NO KEY UPDATE first. The cycle
-- insert must wait, then read the committed smaller area and be rejected.
select extensions.dblink_exec('plot_connection', 'begin');
select extensions.dblink_exec(
  'plot_connection',
  $$
    update public.plots
    set area_hectares = 5
    where id = '36000000-0000-0000-0000-000000000001'
  $$
);
select extensions.dblink_send_query(
  'cycle_connection',
  $$
    select public.test_insert_cycle_for_concurrency(
      '46000000-0000-0000-0000-000000000002',
      8
    )
  $$
);

do $$
declare
  deadline timestamptz := clock_timestamp() + interval '10 seconds';
begin
  loop
    perform pg_catalog.pg_stat_clear_snapshot();
    exit when exists (
      select 1
      from pg_catalog.pg_stat_activity as waiter
      cross join pg_temp.crop_cycle_concurrency_connections as connections
      where waiter.pid = connections.cycle_pid
        and waiter.wait_event_type = 'Lock'
        and connections.plot_pid = any(pg_catalog.pg_blocking_pids(waiter.pid))
    );

    if clock_timestamp() >= deadline then
      raise exception 'ordering B did not block the cycle insert on the plot transaction within 10 seconds';
    end if;

    perform pg_sleep(0.01);
  end loop;
end;
$$;

select extensions.dblink_exec('plot_connection', 'commit');

do $$
declare
  outcome text;
begin
  select result into outcome
  from extensions.dblink_get_result('cycle_connection') as result(result text);

  if outcome <> 'rejected' then
    raise exception 'ordering B crop-cycle insert was not rejected: %', outcome;
  end if;

  perform result
  from extensions.dblink_get_result('cycle_connection') as result(result text);
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

select extensions.dblink_disconnect('cycle_connection');
select extensions.dblink_disconnect('plot_connection');

drop table pg_temp.crop_cycle_concurrency_connections;

drop function public.test_insert_cycle_for_concurrency(uuid, numeric);
drop function public.test_reduce_plot_area_for_concurrency(numeric);

delete from public.farms
where id = '26000000-0000-0000-0000-000000000001';
delete from auth.users
where id = '16000000-0000-0000-0000-000000000001';

\if :dblink_preexisting
\else
drop extension dblink;
\endif

\if :extensions_schema_preexisting
\else
drop schema extensions;
\endif
