\set ON_ERROR_STOP on
-- Disposable database only. Two independent authenticated sessions exercise
-- real waits on ledger rows and the unique expense attribution constraint.
select exists(select 1 from pg_catalog.pg_extension where extname = 'dblink') as dblink_preexisting \gset
select exists(select 1 from pg_catalog.pg_namespace where nspname = 'extensions') as schema_preexisting \gset
do $$
declare actual name;
begin
  select n.nspname into actual from pg_catalog.pg_extension e join pg_catalog.pg_namespace n on n.oid = e.extnamespace where e.extname = 'dblink';
  if found and actual <> 'extensions' then raise exception 'operations concurrency test requires dblink in extensions; found %', actual; end if;
end; $$;
create schema if not exists extensions;
create extension if not exists dblink with schema extensions;

-- ON_ERROR_STOP disconnects remote sessions/rolls back open transactions on
-- failure. Previously committed fixtures/helpers may remain: discard a failed
-- disposable DB, or rerun (which removes these fixture IDs/helper first).
drop function if exists public.test_operation_expense_concurrency(text, uuid);
delete from public.farms where id = '2b000000-0000-0000-0000-000000000001';
delete from auth.users where id = '1b000000-0000-0000-0000-000000000001';
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
values ('00000000-0000-0000-0000-000000000000', '1b000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
  'operation-concurrency@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
insert into public.farms (id, name, created_by) values
  ('2b000000-0000-0000-0000-000000000001', 'Operations concurrency', '1b000000-0000-0000-0000-000000000001');
insert into public.activities (id, farm_id, name, kind) values
  ('3b000000-0000-0000-0000-000000000001', '2b000000-0000-0000-0000-000000000001', 'Crops', 'culture');
insert into public.plots (id, farm_id, name) values ('4b000000-0000-0000-0000-000000000001', '2b000000-0000-0000-0000-000000000001', 'Field');
insert into public.transactions (id, farm_id, activity_id, kind) values
  ('7b000000-0000-0000-0000-000000000001', '2b000000-0000-0000-0000-000000000001', '3b000000-0000-0000-0000-000000000001', 'depense');
insert into public.transaction_lines (id, farm_id, transaction_id, description, quantity, unit_price) values
  ('8b000000-0000-0000-0000-000000000001', '2b000000-0000-0000-0000-000000000001', '7b000000-0000-0000-0000-000000000001', 'Existing expense', 2, 12.125);

-- Security invoker: statements below run with the remote authenticated owner,
-- through the production RLS/trigger path. Only expected SQLSTATEs are caught.
create function public.test_operation_expense_concurrency(action text, operation_id uuid)
returns text language plpgsql set search_path = '' as $$
declare changed integer;
begin
  if action = 'insert' then
    insert into public.agricultural_operations (id, farm_id, plot_id, activity_id, expense_line_id, operation_type, performed_on)
    values (operation_id, '2b000000-0000-0000-0000-000000000001', '4b000000-0000-0000-0000-000000000001',
      '3b000000-0000-0000-0000-000000000001', '8b000000-0000-0000-0000-000000000001', 'labour', '2026-01-01');
  elsif action = 'update' then
    update public.agricultural_operations set expense_line_id = '8b000000-0000-0000-0000-000000000001'
      where id = operation_id and farm_id = '2b000000-0000-0000-0000-000000000001';
  elsif action = 'reclassify' then
    update public.transactions set kind = 'revenu' where id = '7b000000-0000-0000-0000-000000000001'
      and farm_id = '2b000000-0000-0000-0000-000000000001';
  else raise exception 'unknown test action %', action;
  end if;
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'test action % affected % rows', action, changed; end if;
  return '00000';
exception when check_violation or unique_violation then return sqlstate;
end; $$;

select extensions.dblink_connect('operation_writer', format('host=127.0.0.1 port=%s dbname=%s user=%s application_name=mission5_operation_writer', current_setting('port'), current_database(), current_user));
select extensions.dblink_connect('ledger_writer', format('host=127.0.0.1 port=%s dbname=%s user=%s application_name=mission5_ledger_writer', current_setting('port'), current_database(), current_user));
create temporary table operation_test_connections (name text primary key, pid integer not null);
insert into operation_test_connections select 'operation_writer', pid from extensions.dblink('operation_writer', 'select pg_backend_pid()') r(pid integer);
insert into operation_test_connections select 'ledger_writer', pid from extensions.dblink('ledger_writer', 'select pg_backend_pid()') r(pid integer);
select extensions.dblink_exec(name, 'set role authenticated') from operation_test_connections;
select extensions.dblink_exec(name, $$set request.jwt.claims = '{"sub":"1b000000-0000-0000-0000-000000000001","role":"authenticated"}'$$) from operation_test_connections;
select extensions.dblink_exec(name, $$set statement_timeout = '15s'$$) from operation_test_connections;

create function pg_temp.wait_operation_lock(waiter text, blocker text, label text) returns void language plpgsql as $$
declare deadline timestamptz := clock_timestamp() + interval '10 seconds'; diagnostics text;
begin
  loop
    perform pg_catalog.pg_stat_clear_snapshot();
    if exists (select 1 from pg_catalog.pg_stat_activity a
      join pg_temp.operation_test_connections w on w.pid = a.pid and w.name = waiter
      join pg_temp.operation_test_connections b on b.name = blocker
      where a.wait_event_type = 'Lock' and b.pid = any(pg_catalog.pg_blocking_pids(a.pid))) then return; end if;
    if extensions.dblink_is_busy(waiter) = 0 or clock_timestamp() >= deadline then
      select concat(a.state, '/', a.wait_event_type, '/', a.wait_event, '/blockers=', pg_catalog.pg_blocking_pids(a.pid)) into diagnostics
      from pg_catalog.pg_stat_activity a join pg_temp.operation_test_connections c on c.pid = a.pid where c.name = waiter;
      raise exception '%: % never blocked on % within 10 seconds (state: %)', label, waiter, blocker, diagnostics;
    end if;
    perform pg_sleep(0.01);
  end loop;
end; $$;
create function pg_temp.operation_outcome(connection text, expected text) returns void language plpgsql as $$
declare actual text; result_count integer; deadline timestamptz := clock_timestamp() + interval '10 seconds';
begin
  while extensions.dblink_is_busy(connection) = 1 loop
    if clock_timestamp() >= deadline then raise exception '% did not finish after its blocker committed', connection; end if;
    perform pg_sleep(0.01);
  end loop;
  select result into actual from extensions.dblink_get_result(connection) r(result text);
  get diagnostics result_count = row_count;
  if result_count <> 1 or actual is distinct from expected then raise exception '% expected %, got % (% rows)', connection, expected, actual, result_count; end if;
  -- Drain libpq's final empty result before reusing the connection.
  perform result from extensions.dblink_get_result(connection) r(result text);
end; $$;

-- A: operation attribution locks first; a concurrent reclassification waits,
-- then sees the committed reference and rejects the incompatible new kind.
select extensions.dblink_exec('operation_writer', 'begin');
select * from extensions.dblink('operation_writer', $$select public.test_operation_expense_concurrency('insert', '9b000000-0000-0000-0000-000000000001')$$) r(result text);
select extensions.dblink_send_query('ledger_writer', $$select public.test_operation_expense_concurrency('reclassify', null)$$);
select pg_temp.wait_operation_lock('ledger_writer', 'operation_writer', 'ordering A');
select extensions.dblink_exec('operation_writer', 'commit');
select pg_temp.operation_outcome('ledger_writer', '23514');
do $$ begin
  if not exists(select 1 from public.agricultural_operations where id = '9b000000-0000-0000-0000-000000000001' and expense_line_id = '8b000000-0000-0000-0000-000000000001')
    or not exists(select 1 from public.transactions where id = '7b000000-0000-0000-0000-000000000001' and kind = 'depense') then raise exception 'ordering A final state'; end if;
end; $$;
delete from public.agricultural_operations where farm_id = '2b000000-0000-0000-0000-000000000001';

-- B: reclassification locks first; INSERT waits, rereads the committed header
-- and rejects attributing a revenue line as an expense.
select extensions.dblink_exec('ledger_writer', 'begin');
select extensions.dblink_exec('ledger_writer', $$update public.transactions set kind = 'revenu' where id = '7b000000-0000-0000-0000-000000000001'$$);
select extensions.dblink_send_query('operation_writer', $$select public.test_operation_expense_concurrency('insert', '9b000000-0000-0000-0000-000000000002')$$);
select pg_temp.wait_operation_lock('operation_writer', 'ledger_writer', 'ordering B');
select extensions.dblink_exec('ledger_writer', 'commit');
select pg_temp.operation_outcome('operation_writer', '23514');
do $$ begin
  if exists(select 1 from public.agricultural_operations where farm_id = '2b000000-0000-0000-0000-000000000001')
    or not exists(select 1 from public.transactions where id = '7b000000-0000-0000-0000-000000000001' and kind = 'revenu') then raise exception 'ordering B final state'; end if;
end; $$;
update public.transactions set kind = 'depense' where id = '7b000000-0000-0000-0000-000000000001';

-- C: two independent operations claim the same expense. The second waits on
-- the unique index/transaction and is rejected; only one attribution survives.
select extensions.dblink_exec('operation_writer', 'begin');
select * from extensions.dblink('operation_writer', $$select public.test_operation_expense_concurrency('insert', '9b000000-0000-0000-0000-000000000003')$$) r(result text);
select extensions.dblink_send_query('ledger_writer', $$select public.test_operation_expense_concurrency('insert', '9b000000-0000-0000-0000-000000000004')$$);
select pg_temp.wait_operation_lock('ledger_writer', 'operation_writer', 'ordering C');
select extensions.dblink_exec('operation_writer', 'commit');
select pg_temp.operation_outcome('ledger_writer', '23505');
do $$ begin
  if (select count(*) from public.agricultural_operations where farm_id = '2b000000-0000-0000-0000-000000000001') <> 1
    or not exists(select 1 from public.agricultural_operations where id = '9b000000-0000-0000-0000-000000000003' and expense_line_id = '8b000000-0000-0000-0000-000000000001') then raise exception 'ordering C final state'; end if;
end; $$;
delete from public.agricultural_operations where farm_id = '2b000000-0000-0000-0000-000000000001';

-- D: the same protection applies when editing an existing operation, rather
-- than inserting a new record, while the ledger changes concurrently.
insert into public.agricultural_operations (id, farm_id, plot_id, activity_id, operation_type, performed_on)
values ('9b000000-0000-0000-0000-000000000005', '2b000000-0000-0000-0000-000000000001', '4b000000-0000-0000-0000-000000000001',
  '3b000000-0000-0000-0000-000000000001', 'irrigation', '2026-01-01');
select extensions.dblink_exec('ledger_writer', 'begin');
select extensions.dblink_exec('ledger_writer', $$update public.transactions set kind = 'revenu' where id = '7b000000-0000-0000-0000-000000000001'$$);
select extensions.dblink_send_query('operation_writer', $$select public.test_operation_expense_concurrency('update', '9b000000-0000-0000-0000-000000000005')$$);
select pg_temp.wait_operation_lock('operation_writer', 'ledger_writer', 'ordering D');
select extensions.dblink_exec('ledger_writer', 'commit');
select pg_temp.operation_outcome('operation_writer', '23514');
do $$ begin
  if not exists(select 1 from public.agricultural_operations where id = '9b000000-0000-0000-0000-000000000005' and expense_line_id is null and operation_type = 'irrigation')
    or not exists(select 1 from public.transactions where id = '7b000000-0000-0000-0000-000000000001' and kind = 'revenu')
    or (select count(*) from public.transactions where farm_id = '2b000000-0000-0000-0000-000000000001') <> 1
    or not exists(select 1 from public.transaction_lines where id = '8b000000-0000-0000-0000-000000000001' and amount = 24.250) then raise exception 'ordering D final state / ledger changed unexpectedly'; end if;
end; $$;

select extensions.dblink_disconnect('operation_writer');
select extensions.dblink_disconnect('ledger_writer');
drop table pg_temp.operation_test_connections;
drop function pg_temp.wait_operation_lock(text, text, text);
drop function pg_temp.operation_outcome(text, text);
drop function public.test_operation_expense_concurrency(text, uuid);
delete from public.farms where id = '2b000000-0000-0000-0000-000000000001';
delete from auth.users where id = '1b000000-0000-0000-0000-000000000001';
\if :dblink_preexisting
\else
drop extension dblink;
\endif
\if :schema_preexisting
\else
drop schema extensions;
\endif
\echo 'Operations expense concurrency suite passed (four real lock waits; fixtures removed).'
