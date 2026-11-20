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

-- With ON_ERROR_STOP, a failed psql run closes its dblink sessions and rolls
-- back open remote transactions. Already-committed fixtures, helper functions,
-- and a newly installed extension/schema may remain. Rerunning removes stale
-- fixtures/functions; discard the disposable database after a failed run to
-- guarantee full cleanup (a rerun preserves any now-preexisting extension).
drop function if exists public.test_insert_cycle_for_concurrency(uuid, numeric);
drop function if exists public.test_update_cycle_for_concurrency(uuid, numeric);
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

create function public.test_update_cycle_for_concurrency(cycle_id uuid, cycle_area numeric)
returns text
language plpgsql
set search_path = ''
as $$
begin
  begin
    update public.crop_cycles
    set cultivated_area_hectares = cycle_area
    where id = cycle_id
      and farm_id = '26000000-0000-0000-0000-000000000001';
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

  if outcome is distinct from 'rejected' then
    raise exception 'ordering A plot reduction was not rejected: %', outcome;
  end if;

  -- libpq requires one extra fetch returning an empty set before the named
  -- connection can accept another command.
  perform result
  from extensions.dblink_get_result('plot_connection') as result(result text);
end;
$$;

do $$
begin
  if not exists (
    select 1 from public.crop_cycles
    where id = '46000000-0000-0000-0000-000000000001'
      and cultivated_area_hectares = 8
  ) then
    raise exception 'ordering A did not commit the crop-cycle insert';
  end if;

  if not exists (
    select 1 from public.plots
    where id = '36000000-0000-0000-0000-000000000001'
      and area_hectares = 10
  ) then
    raise exception 'ordering A changed the plot area despite rejecting the resize';
  end if;
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

  if outcome is distinct from 'rejected' then
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

-- A committed cycle with area 4 fits both the original plot (10) and the
-- proposed smaller plot (5). Only its concurrent increase to 8 conflicts.
update public.plots
set area_hectares = 10
where id = '36000000-0000-0000-0000-000000000001';
insert into public.crop_cycles (
  id, farm_id, plot_id, crop_name, started_on, expected_harvest_on,
  cultivated_area_hectares, status
) values (
  '46000000-0000-0000-0000-000000000003',
  '26000000-0000-0000-0000-000000000001',
  '36000000-0000-0000-0000-000000000001',
  'Existing concurrency crop', '2026-11-01', '2027-06-01', 4, 'active'
);

-- Ordering C: an UPDATE of the existing cycle holds the plot lock first.
-- The resize must wait, then reject an area below the committed cycle's 8.
select extensions.dblink_exec('cycle_connection', 'begin');
select extensions.dblink_exec(
  'cycle_connection',
  $$
    update public.crop_cycles
    set cultivated_area_hectares = 8
    where id = '46000000-0000-0000-0000-000000000003'
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
      raise exception 'ordering C did not block the plot reduction on the cycle UPDATE transaction within 10 seconds';
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

  if outcome is distinct from 'rejected' then
    raise exception 'ordering C plot reduction after crop-cycle UPDATE was not rejected: %', outcome;
  end if;

  perform result
  from extensions.dblink_get_result('plot_connection') as result(result text);

  if not exists (
    select 1 from public.crop_cycles
    where id = '46000000-0000-0000-0000-000000000003'
      and cultivated_area_hectares = 8
  ) then
    raise exception 'ordering C did not commit the crop-cycle area increase';
  end if;

  if not exists (
    select 1 from public.plots
    where id = '36000000-0000-0000-0000-000000000001'
      and area_hectares = 10
  ) then
    raise exception 'ordering C changed the plot area despite rejecting the resize';
  end if;
end;
$$;

-- Reset the committed cycle so the next resize is valid before the UPDATE.
update public.crop_cycles
set cultivated_area_hectares = 4
where id = '46000000-0000-0000-0000-000000000003';

-- Ordering D: the resize locks first. The existing cycle's UPDATE must wait,
-- reread the committed plot area (5), and reject its proposed increase to 8.
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
    select public.test_update_cycle_for_concurrency(
      '46000000-0000-0000-0000-000000000003',
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
      raise exception 'ordering D did not block the cycle UPDATE on the plot transaction within 10 seconds';
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

  if outcome is distinct from 'rejected' then
    raise exception 'ordering D crop-cycle UPDATE was not rejected: %', outcome;
  end if;

  perform result
  from extensions.dblink_get_result('cycle_connection') as result(result text);

  if not exists (
    select 1 from public.crop_cycles
    where id = '46000000-0000-0000-0000-000000000003'
      and cultivated_area_hectares = 4
  ) then
    raise exception 'ordering D changed the crop-cycle area despite rejecting the UPDATE';
  end if;

  if not exists (
    select 1 from public.plots
    where id = '36000000-0000-0000-0000-000000000001'
      and area_hectares = 5
  ) then
    raise exception 'ordering D did not commit the plot-area reduction';
  end if;
end;
$$;

select extensions.dblink_disconnect('cycle_connection');
select extensions.dblink_disconnect('plot_connection');

drop table pg_temp.crop_cycle_concurrency_connections;

drop function public.test_insert_cycle_for_concurrency(uuid, numeric);
drop function public.test_update_cycle_for_concurrency(uuid, numeric);
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
