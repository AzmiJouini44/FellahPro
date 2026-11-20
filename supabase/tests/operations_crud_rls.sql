\set ON_ERROR_STOP on
begin;

-- All fixtures and temporary assertion helpers disappear on rollback.
create function pg_temp.assert_true(ok boolean, message text) returns void language plpgsql as $$
begin if ok is not true then raise exception '%', message; end if; end; $$;
create function pg_temp.expect_error(command text, expected text) returns void language plpgsql as $$
declare actual text;
begin
  begin execute command; exception when others then actual := sqlstate; end;
  if actual is distinct from expected then raise exception 'expected SQLSTATE %, got % for %', expected, coalesce(actual, 'success'), command; end if;
end; $$;
create function pg_temp.affected(command text, expected integer) returns void language plpgsql as $$
declare changed integer;
begin execute command; get diagnostics changed = row_count;
  if changed <> expected then raise exception 'expected % affected rows, got % for %', expected, changed, command; end if;
end; $$;

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''
from (values
  ('1a000000-0000-0000-0000-000000000001'::uuid, 'operations-owner@example.test'),
  ('1a000000-0000-0000-0000-000000000002'::uuid, 'operations-worker@example.test'),
  ('1a000000-0000-0000-0000-000000000003'::uuid, 'operations-accountant@example.test'),
  ('1a000000-0000-0000-0000-000000000004'::uuid, 'operations-other@example.test'),
  ('1a000000-0000-0000-0000-000000000005'::uuid, 'operations-former@example.test')
) u(id, email);
set local role authenticated;
set local request.jwt.claims = '{"sub":"1a000000-0000-0000-0000-000000000004","role":"authenticated"}';
insert into public.farms (id, name) values ('2a000000-0000-0000-0000-000000000002', 'Operations B');
insert into public.activities (id, farm_id, name, kind) values ('3a000000-0000-0000-0000-000000000003', '2a000000-0000-0000-0000-000000000002', 'B private', 'culture');
insert into public.plots (id, farm_id, name) values ('4a000000-0000-0000-0000-000000000003', '2a000000-0000-0000-0000-000000000002', 'B private');
insert into public.crop_cycles (id, farm_id, plot_id, crop_name, started_on, expected_harvest_on) values
  ('5a000000-0000-0000-0000-000000000003', '2a000000-0000-0000-0000-000000000002', '4a000000-0000-0000-0000-000000000003', 'B private', '2026-01-01', '2026-12-01');
insert into public.tasks (id, farm_id, title) values ('6a000000-0000-0000-0000-000000000003', '2a000000-0000-0000-0000-000000000002', 'B private');
insert into public.transactions (id, farm_id, activity_id, kind) values
  ('7a000000-0000-0000-0000-000000000007', '2a000000-0000-0000-0000-000000000002', '3a000000-0000-0000-0000-000000000003', 'depense');
insert into public.transaction_lines (id, farm_id, transaction_id, description) values
  ('8a000000-0000-0000-0000-000000000007', '2a000000-0000-0000-0000-000000000002', '7a000000-0000-0000-0000-000000000007', 'B private');
insert into public.agricultural_operations (id, farm_id, plot_id, operation_type, performed_on, description) values
  ('9a000000-0000-0000-0000-000000000009', '2a000000-0000-0000-0000-000000000002', '4a000000-0000-0000-0000-000000000003', 'labour', '2026-01-01', 'B private');
set local request.jwt.claims = '{"sub":"1a000000-0000-0000-0000-000000000001","role":"authenticated"}';
insert into public.farms (id, name) values ('2a000000-0000-0000-0000-000000000001', 'Operations A');
insert into public.farm_members (farm_id, user_id, role) values
  ('2a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000002', 'worker'),
  ('2a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000003', 'accountant'),
  ('2a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000005', 'worker');
delete from public.farm_members where user_id = '1a000000-0000-0000-0000-000000000005';
insert into public.activities (id, farm_id, name, kind, is_active) values
  ('3a000000-0000-0000-0000-000000000001', '2a000000-0000-0000-0000-000000000001', 'A crops', 'culture', true),
  ('3a000000-0000-0000-0000-000000000002', '2a000000-0000-0000-0000-000000000001', 'A independent inactive', 'autre', false);
insert into public.plots (id, farm_id, activity_id, name, area_hectares) values
  ('4a000000-0000-0000-0000-000000000001', '2a000000-0000-0000-0000-000000000001', '3a000000-0000-0000-0000-000000000001', 'A olives', 10),
  ('4a000000-0000-0000-0000-000000000002', '2a000000-0000-0000-0000-000000000001', null, 'A other plot', 10);
insert into public.crop_cycles (id, farm_id, plot_id, activity_id, crop_name, started_on, expected_harvest_on) values
  ('5a000000-0000-0000-0000-000000000001', '2a000000-0000-0000-0000-000000000001', '4a000000-0000-0000-0000-000000000001', '3a000000-0000-0000-0000-000000000001', 'A olives', '2026-01-01', '2026-12-01'),
  ('5a000000-0000-0000-0000-000000000002', '2a000000-0000-0000-0000-000000000001', '4a000000-0000-0000-0000-000000000002', null, 'A unclassified', '2026-01-01', '2026-12-01');
insert into public.tasks (id, farm_id, title) values ('6a000000-0000-0000-0000-000000000001', '2a000000-0000-0000-0000-000000000001', 'Irrigate');
insert into public.animal_groups (id, farm_id, activity_id, name, species) values
  ('aa000000-0000-0000-0000-000000000001', '2a000000-0000-0000-0000-000000000001', '3a000000-0000-0000-0000-000000000001', 'Existing animals', 'Ovins');
insert into public.transactions (id, farm_id, activity_id, kind, crop_cycle_id, animal_group_id) values
  ('7a000000-0000-0000-0000-000000000001', '2a000000-0000-0000-0000-000000000001', '3a000000-0000-0000-0000-000000000001', 'depense', null, null),
  ('7a000000-0000-0000-0000-000000000002', '2a000000-0000-0000-0000-000000000001', '3a000000-0000-0000-0000-000000000001', 'depense', '5a000000-0000-0000-0000-000000000001', null),
  ('7a000000-0000-0000-0000-000000000003', '2a000000-0000-0000-0000-000000000001', '3a000000-0000-0000-0000-000000000001', 'revenu', null, null),
  ('7a000000-0000-0000-0000-000000000004', '2a000000-0000-0000-0000-000000000001', '3a000000-0000-0000-0000-000000000001', 'depense', null, 'aa000000-0000-0000-0000-000000000001'),
  ('7a000000-0000-0000-0000-000000000005', '2a000000-0000-0000-0000-000000000001', '3a000000-0000-0000-0000-000000000002', 'depense', null, null),
  ('7a000000-0000-0000-0000-000000000006', '2a000000-0000-0000-0000-000000000001', '3a000000-0000-0000-0000-000000000001', 'depense', null, null);
insert into public.transaction_lines (id, farm_id, transaction_id, description, quantity, unit_price)
select ('8a000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, '2a000000-0000-0000-0000-000000000001',
  ('7a000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, 'Recorded expense ' || n, 2, 12.125 from generate_series(1, 6) n;

-- Owner CRUD, every operation type, history search, explicit independent
-- classification and an unclassified cycle. No task/ledger side effects.
insert into public.agricultural_operations (id, farm_id, plot_id, crop_cycle_id, activity_id, related_task_id, expense_line_id,
  operation_type, performed_on, description, notes, quantity, unit, updated_at) values
  ('9a000000-0000-0000-0000-000000000001', '2a000000-0000-0000-0000-000000000001', '4a000000-0000-0000-0000-000000000001',
    '5a000000-0000-0000-0000-000000000001', '3a000000-0000-0000-0000-000000000001', '6a000000-0000-0000-0000-000000000001', '8a000000-0000-0000-0000-000000000001',
    'irrigation', '2026-01-10', 'Water 50%', 'Original work', 2.125, 'm3', '2000-01-01'),
  ('9a000000-0000-0000-0000-000000000002', '2a000000-0000-0000-0000-000000000001', '4a000000-0000-0000-0000-000000000002',
    '5a000000-0000-0000-0000-000000000002', null, null, null, 'preparation_sol', '2026-01-01', null, null, null, null, now()),
  ('9a000000-0000-0000-0000-000000000003', '2a000000-0000-0000-0000-000000000001', '4a000000-0000-0000-0000-000000000001',
    '5a000000-0000-0000-0000-000000000001', '3a000000-0000-0000-0000-000000000002', null, null, 'autre', '2026-01-11', null, null, null, null, now());
insert into public.agricultural_operations (farm_id, plot_id, operation_type, performed_on)
select '2a000000-0000-0000-0000-000000000001', '4a000000-0000-0000-0000-000000000001', kind, '2026-01-12'
from unnest(array['labour', 'fertilisation', 'taille', 'plantation', 'recolte']) kind;
select pg_temp.assert_true((select count(*) = 8 from public.agricultural_operations), 'owner read isolation / operation types');
select pg_temp.assert_true((select count(*) = 1 from public.v_agricultural_operations where search_text ilike '%50\%%'
  and operation_type = 'irrigation' and performed_on between '2026-01-01' and '2026-01-31'
  and plot_id = '4a000000-0000-0000-0000-000000000001' and crop_cycle_id = '5a000000-0000-0000-0000-000000000001'), 'combined history filters');
select pg_temp.affected($sql$update public.agricultural_operations set notes = 'Edited work', quantity = 3.125 where id = '9a000000-0000-0000-0000-000000000001'$sql$, 1);
select pg_temp.assert_true((select notes = 'Edited work' and quantity = 3.125 and updated_at = now() and expense_amount = 24.250
  from public.v_agricultural_operations where id = '9a000000-0000-0000-0000-000000000001'), 'owner edit/audit/ledger amount');
select pg_temp.assert_true((select count(*) = 6 from public.transactions) and (select count(*) = 6 from public.transaction_lines)
  and (select sum(expenses) = 121.250 from public.v_activity_pnl)
  and (select status = 'a_faire' from public.tasks where id = '6a000000-0000-0000-0000-000000000001'), 'operation changed ledger totals or task status');

-- Direct authenticated SQL cannot bypass foreign keys, financial semantics,
-- quantity pairing, audit permissions, or owner-controlled attribution.
do $$
declare command text;
begin
  foreach command in array array[
    'operation_type = ''invented''', 'quantity = 0', 'quantity = null', 'unit = null', 'unit = ''EUR''',
    'description = '' ''', 'description = repeat(''x'', 241)', 'notes = repeat(''x'', 2001)', 'performed_on = ''infinity'''
  ] loop
    perform pg_temp.expect_error('update public.agricultural_operations set ' || command || ' where id = ''9a000000-0000-0000-0000-000000000001''', '23514');
  end loop;
  foreach command in array array['farm_id = ''2a000000-0000-0000-0000-000000000002''',
    'created_by = ''1a000000-0000-0000-0000-000000000002''', 'created_at = now()', 'updated_at = now()', 'id = gen_random_uuid()'] loop
    perform pg_temp.expect_error('update public.agricultural_operations set ' || command || ' where id = ''9a000000-0000-0000-0000-000000000001''', '42501');
  end loop;
  foreach command in array array['plot_id = ''4a000000-0000-0000-0000-000000000003''', 'crop_cycle_id = ''5a000000-0000-0000-0000-000000000003''',
    'activity_id = ''3a000000-0000-0000-0000-000000000003''', 'related_task_id = ''6a000000-0000-0000-0000-000000000003''',
    'crop_cycle_id = ''5a000000-0000-0000-0000-000000000002'''] loop
    perform pg_temp.expect_error('update public.agricultural_operations set ' || command || ' where id = ''9a000000-0000-0000-0000-000000000003''', '23503');
  end loop;
end; $$;
select pg_temp.expect_error($sql$insert into public.agricultural_operations (farm_id, plot_id, operation_type, performed_on, created_by)
  values ('2a000000-0000-0000-0000-000000000001', '4a000000-0000-0000-0000-000000000001', 'labour', '2026-01-01', '1a000000-0000-0000-0000-000000000002')$sql$, '42501');
select pg_temp.expect_error($sql$insert into public.agricultural_operations (farm_id, plot_id, operation_type, performed_on)
  values ('2a000000-0000-0000-0000-000000000001', '4a000000-0000-0000-0000-000000000003', 'labour', '2026-01-01')$sql$, '23503');
select pg_temp.expect_error($sql$update public.agricultural_operations set expense_line_id = '8a000000-0000-0000-0000-000000000007'
  where id = '9a000000-0000-0000-0000-000000000003'$sql$, '23503');
do $$
declare line_id uuid;
begin
  foreach line_id in array array['8a000000-0000-0000-0000-000000000003'::uuid, '8a000000-0000-0000-0000-000000000004'::uuid,
    '8a000000-0000-0000-0000-000000000005'::uuid] loop
    perform pg_temp.expect_error(format('update public.agricultural_operations set expense_line_id = %L where id = ''9a000000-0000-0000-0000-000000000001''', line_id), '23514');
  end loop;
end; $$;
select pg_temp.expect_error($sql$update public.agricultural_operations set activity_id = '3a000000-0000-0000-0000-000000000001',
  expense_line_id = '8a000000-0000-0000-0000-000000000002' where id = '9a000000-0000-0000-0000-000000000002'$sql$, '23514');
select pg_temp.expect_error($sql$update public.agricultural_operations set activity_id = '3a000000-0000-0000-0000-000000000001',
  expense_line_id = '8a000000-0000-0000-0000-000000000001' where id = '9a000000-0000-0000-0000-000000000003'$sql$, '23505');
select pg_temp.expect_error($sql$insert into public.agricultural_operations (farm_id, plot_id, activity_id, expense_line_id, operation_type, performed_on)
  values ('2a000000-0000-0000-0000-000000000001', '4a000000-0000-0000-0000-000000000001', '3a000000-0000-0000-0000-000000000001',
  '8a000000-0000-0000-0000-000000000001', 'labour', '2026-01-01')$sql$, '23505');
select pg_temp.expect_error($sql$update public.transactions set kind = 'revenu' where id = '7a000000-0000-0000-0000-000000000001'$sql$, '23514');
select pg_temp.expect_error($sql$update public.transactions set activity_id = '3a000000-0000-0000-0000-000000000002' where id = '7a000000-0000-0000-0000-000000000001'$sql$, '23514');
select pg_temp.expect_error($sql$update public.transactions set animal_group_id = 'aa000000-0000-0000-0000-000000000001' where id = '7a000000-0000-0000-0000-000000000001'$sql$, '23514');
select pg_temp.expect_error($sql$update public.transaction_lines set transaction_id = '7a000000-0000-0000-0000-000000000006' where id = '8a000000-0000-0000-0000-000000000001'$sql$, '23514');
select pg_temp.affected($sql$update public.transaction_lines set unit_price = 13 where id = '8a000000-0000-0000-0000-000000000001'$sql$, 1);
select pg_temp.assert_true((select expense_amount = 26 from public.v_agricultural_operations where id = '9a000000-0000-0000-0000-000000000001'), 'amount is stale instead of live ledger value');

-- Explicit owner linking, unlinking and relinking are supported.
select pg_temp.affected($sql$update public.agricultural_operations set expense_line_id = null where id = '9a000000-0000-0000-0000-000000000001'$sql$, 1);
select pg_temp.affected($sql$update public.agricultural_operations set expense_line_id = '8a000000-0000-0000-0000-000000000001' where id = '9a000000-0000-0000-0000-000000000001'$sql$, 1);
select pg_temp.affected($sql$update public.agricultural_operations set expense_line_id = '8a000000-0000-0000-0000-000000000002' where id = '9a000000-0000-0000-0000-000000000001'$sql$, 1);
select pg_temp.affected($sql$update public.agricultural_operations set expense_line_id = '8a000000-0000-0000-0000-000000000001' where id = '9a000000-0000-0000-0000-000000000001'$sql$, 1);

-- Forged JWT roles do not replace real membership roles. Workers edit field
-- data on an attributed operation without touching its financial context.
set local request.jwt.claims = '{"sub":"1a000000-0000-0000-0000-000000000002","role":"owner"}';
insert into public.agricultural_operations (id, farm_id, plot_id, operation_type, performed_on) values
  ('9a000000-0000-0000-0000-000000000004', '2a000000-0000-0000-0000-000000000001', '4a000000-0000-0000-0000-000000000001', 'recolte', '2026-01-14');
select pg_temp.affected($sql$update public.agricultural_operations set notes = 'Worker field edit', activity_id = '3a000000-0000-0000-0000-000000000001',
  crop_cycle_id = '5a000000-0000-0000-0000-000000000001', expense_line_id = '8a000000-0000-0000-0000-000000000001'
  where id = '9a000000-0000-0000-0000-000000000001'$sql$, 1);
select pg_temp.affected($sql$update public.agricultural_operations set description = 'Worker updated' where id = '9a000000-0000-0000-0000-000000000004'$sql$, 1);
select pg_temp.affected($sql$delete from public.agricultural_operations where id = '9a000000-0000-0000-0000-000000000004'$sql$, 0);
select pg_temp.expect_error($sql$update public.agricultural_operations set expense_line_id = null where id = '9a000000-0000-0000-0000-000000000001'$sql$, '42501');
select pg_temp.expect_error($sql$update public.agricultural_operations set activity_id = null where id = '9a000000-0000-0000-0000-000000000001'$sql$, '42501');
select pg_temp.expect_error($sql$update public.agricultural_operations set crop_cycle_id = null where id = '9a000000-0000-0000-0000-000000000001'$sql$, '42501');
select pg_temp.expect_error($sql$update public.agricultural_operations set expense_line_id = '8a000000-0000-0000-0000-000000000006',
  activity_id = '3a000000-0000-0000-0000-000000000001' where id = '9a000000-0000-0000-0000-000000000004'$sql$, '42501');
select pg_temp.expect_error($sql$insert into public.agricultural_operations (farm_id, plot_id, activity_id, expense_line_id, operation_type, performed_on)
  values ('2a000000-0000-0000-0000-000000000001', '4a000000-0000-0000-0000-000000000001', '3a000000-0000-0000-0000-000000000001',
  '8a000000-0000-0000-0000-000000000006', 'labour', '2026-01-01')$sql$, '42501');
select pg_temp.assert_true((select count(*) = 9 from public.v_agricultural_operations) and
  (select count(*) = 4 from public.v_agricultural_operation_expenses), 'worker view isolation');

set local request.jwt.claims = '{"sub":"1a000000-0000-0000-0000-000000000003","role":"owner"}';
select pg_temp.assert_true((select count(*) = 9 from public.v_agricultural_operations), 'accountant read');
select pg_temp.affected($sql$update public.agricultural_operations set notes = 'forbidden' where id = '9a000000-0000-0000-0000-000000000001'$sql$, 0);
select pg_temp.affected($sql$delete from public.agricultural_operations where id = '9a000000-0000-0000-0000-000000000001'$sql$, 0);
select pg_temp.expect_error($sql$insert into public.agricultural_operations (farm_id, plot_id, operation_type, performed_on)
  values ('2a000000-0000-0000-0000-000000000001', '4a000000-0000-0000-0000-000000000001', 'labour', '2026-01-01')$sql$, '42501');
select pg_temp.expect_error($sql$update public.transactions set kind = 'revenu' where id = '7a000000-0000-0000-0000-000000000001'$sql$, '23514');

-- Farm B's legitimate owner cannot see or modify A; a former member has no
-- operation/expense visibility. Anonymous access lacks relation permission.
set local request.jwt.claims = '{"sub":"1a000000-0000-0000-0000-000000000004","role":"owner"}';
select pg_temp.assert_true((select count(*) = 1 from public.agricultural_operations) and (select count(*) = 1 from public.v_agricultural_operations)
  and (select count(*) = 1 from public.v_agricultural_operation_expenses), 'farm B isolation');
select pg_temp.affected($sql$update public.agricultural_operations set notes = 'cross farm' where id = '9a000000-0000-0000-0000-000000000001'$sql$, 0);
select pg_temp.affected($sql$delete from public.agricultural_operations where id = '9a000000-0000-0000-0000-000000000001'$sql$, 0);
select pg_temp.expect_error($sql$insert into public.agricultural_operations (farm_id, plot_id, operation_type, performed_on)
  values ('2a000000-0000-0000-0000-000000000001', '4a000000-0000-0000-0000-000000000001', 'labour', '2026-01-01')$sql$, '42501');
set local request.jwt.claims = '{"sub":"1a000000-0000-0000-0000-000000000005","role":"owner"}';
select pg_temp.assert_true((select count(*) = 0 from public.agricultural_operations) and (select count(*) = 0 from public.v_agricultural_operations)
  and (select count(*) = 0 from public.v_agricultural_operation_expenses), 'former member visibility');
set local role anon;
select pg_temp.expect_error('select * from public.agricultural_operations', '42501');
select pg_temp.expect_error('select * from public.v_agricultural_operations', '42501');
select pg_temp.expect_error('select * from public.v_agricultural_operation_expenses', '42501');
set local role authenticated;
set local request.jwt.claims = '{"sub":"1a000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- Restrictive parent deletes preserve history. Deleting a task merely clears
-- its optional link; deleting an operation leaves the original ledger intact.
select pg_temp.expect_error($sql$delete from public.plots where id = '4a000000-0000-0000-0000-000000000002'$sql$, '23503');
select pg_temp.expect_error($sql$delete from public.crop_cycles where id = '5a000000-0000-0000-0000-000000000002'$sql$, '23503');
select pg_temp.expect_error($sql$delete from public.activities where id = '3a000000-0000-0000-0000-000000000002'$sql$, '23503');
select pg_temp.expect_error($sql$delete from public.transaction_lines where id = '8a000000-0000-0000-0000-000000000001'$sql$, '23503');
select pg_temp.expect_error($sql$delete from public.transactions where id = '7a000000-0000-0000-0000-000000000001'$sql$, '23503');
select pg_temp.affected($sql$delete from public.tasks where id = '6a000000-0000-0000-0000-000000000001'$sql$, 1);
select pg_temp.assert_true((select related_task_id is null and notes = 'Worker field edit' from public.agricultural_operations
  where id = '9a000000-0000-0000-0000-000000000001'), 'task deletion lost operation history');
select pg_temp.affected($sql$delete from public.agricultural_operations where id = '9a000000-0000-0000-0000-000000000001'$sql$, 1);
select pg_temp.assert_true((select count(*) = 6 from public.transaction_lines) and (select count(*) = 6 from public.transactions)
  and (select sum(expenses) = 123.000 from public.v_activity_pnl), 'deleting work changed the ledger');

-- Auth/profile deletion clears audit identity without losing operation data
-- after an explicit transfer to a second owner, preserving Mission 1 policy.
insert into public.farm_members (farm_id, user_id, role) values
  ('2a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000004', 'owner');
reset role;
delete from auth.users where id = '1a000000-0000-0000-0000-000000000001';
select pg_temp.assert_true((select created_by is null from public.agricultural_operations where id = '9a000000-0000-0000-0000-000000000002'), 'profile deletion did not clear audit identity');
set local role authenticated;
set local request.jwt.claims = '{"sub":"1a000000-0000-0000-0000-000000000004","role":"authenticated"}';
select pg_temp.affected($sql$delete from public.farms where id = '2a000000-0000-0000-0000-000000000001'$sql$, 1);
select pg_temp.assert_true((select count(*) = 1 from public.agricultural_operations), 'whole-farm deletion did not cascade safely');
reset role;
rollback;
\echo 'Agricultural operations CRUD/RLS suite passed (fixtures rolled back).'
