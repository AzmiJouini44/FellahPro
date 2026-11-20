\set ON_ERROR_STOP on

begin;

-- Disposable fixtures; the entire suite rolls back. Application checks use
-- authenticated identities and existing RLS, never a service-role connection.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''
from (values
  ('19000000-0000-0000-0000-000000000001'::uuid, 'livestock-owner-a@example.test'),
  ('19000000-0000-0000-0000-000000000002'::uuid, 'livestock-worker@example.test'),
  ('19000000-0000-0000-0000-000000000003'::uuid, 'livestock-accountant@example.test'),
  ('19000000-0000-0000-0000-000000000004'::uuid, 'livestock-owner-b@example.test')
) as u(id, email);
set local role authenticated;
set local request.jwt.claims = '{"sub":"19000000-0000-0000-0000-000000000001","role":"authenticated"}';
insert into public.farms (id, name) values ('29000000-0000-0000-0000-000000000001', 'Livestock A');
set local request.jwt.claims = '{"sub":"19000000-0000-0000-0000-000000000004","role":"authenticated"}';
insert into public.farms (id, name) values ('29000000-0000-0000-0000-000000000002', 'Livestock B');
insert into public.activities (id, farm_id, name, kind) values ('39000000-0000-0000-0000-000000000003', '29000000-0000-0000-0000-000000000002', 'B livestock', 'elevage');
insert into public.animal_groups (id, farm_id, activity_id, name, species, opening_count)
values ('69000000-0000-0000-0000-000000000009', '29000000-0000-0000-0000-000000000002', '39000000-0000-0000-0000-000000000003', 'B private', 'Ovins', 999);
insert into public.animal_events (id, farm_id, animal_group_id, kind, quantity, event_date)
values ('79000000-0000-0000-0000-000000000009', '29000000-0000-0000-0000-000000000002', '69000000-0000-0000-0000-000000000009', 'achat', 1, '2026-01-01');
reset role;
insert into public.farm_members (farm_id, user_id, role) values
  ('29000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000002', 'worker'),
  ('29000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000003', 'accountant');
set local role authenticated;
set local request.jwt.claims = '{"sub":"19000000-0000-0000-0000-000000000001","role":"authenticated"}';
insert into public.activities (id, farm_id, name, kind, is_active) values
  ('39000000-0000-0000-0000-000000000001', '29000000-0000-0000-0000-000000000001', 'A livestock', 'elevage', true),
  ('39000000-0000-0000-0000-000000000002', '29000000-0000-0000-0000-000000000001', 'A inactive trade', 'commerce', false);
insert into public.animal_groups (id, farm_id, activity_id, name, species, opening_count) values
  ('69000000-0000-0000-0000-000000000001', '29000000-0000-0000-0000-000000000001', '39000000-0000-0000-0000-000000000001', 'Historical group', 'Ovins', 10),
  ('69000000-0000-0000-0000-000000000002', '29000000-0000-0000-0000-000000000001', '39000000-0000-0000-0000-000000000001', 'Task-linked group', 'Ovins', 4),
  ('69000000-0000-0000-0000-000000000003', '29000000-0000-0000-0000-000000000001', '39000000-0000-0000-0000-000000000001', 'Ledger group', 'Bovins', 0),
  ('69000000-0000-0000-0000-000000000004', '29000000-0000-0000-0000-000000000001', '39000000-0000-0000-0000-000000000001', 'Inventory group', 'Bovins', 1),
  ('69000000-0000-0000-0000-000000000006', '29000000-0000-0000-0000-000000000001', '39000000-0000-0000-0000-000000000001', 'Negative balance', 'Caprins', 1);
insert into public.animal_events (id, farm_id, animal_group_id, kind, quantity, event_date, notes) values
  ('79000000-0000-0000-0000-000000000001', '29000000-0000-0000-0000-000000000001', '69000000-0000-0000-0000-000000000001', 'naissance', 3, '2026-01-01', 'Original birth'),
  ('79000000-0000-0000-0000-000000000002', '29000000-0000-0000-0000-000000000001', '69000000-0000-0000-0000-000000000001', 'achat', 4, '2026-01-02', null),
  ('79000000-0000-0000-0000-000000000003', '29000000-0000-0000-0000-000000000001', '69000000-0000-0000-0000-000000000001', 'vente', 2, '2026-01-03', null),
  ('79000000-0000-0000-0000-000000000004', '29000000-0000-0000-0000-000000000001', '69000000-0000-0000-0000-000000000001', 'deces', 1, '2026-01-04', null),
  ('79000000-0000-0000-0000-000000000005', '29000000-0000-0000-0000-000000000001', '69000000-0000-0000-0000-000000000001', 'transfert', 99, '2026-01-05', null),
  ('79000000-0000-0000-0000-000000000006', '29000000-0000-0000-0000-000000000001', '69000000-0000-0000-0000-000000000001', 'soin', 99, '2026-01-06', null),
  ('79000000-0000-0000-0000-000000000007', '29000000-0000-0000-0000-000000000001', '69000000-0000-0000-0000-000000000001', 'autre', 99, '2026-01-07', null),
  ('79000000-0000-0000-0000-000000000008', '29000000-0000-0000-0000-000000000001', '69000000-0000-0000-0000-000000000006', 'vente', 2, '2026-01-08', null);
insert into public.tasks (id, farm_id, activity_id, animal_group_id, title)
values ('89000000-0000-0000-0000-000000000001', '29000000-0000-0000-0000-000000000001', '39000000-0000-0000-0000-000000000001', '69000000-0000-0000-0000-000000000002', 'Check linked group');
insert into public.transactions (id, farm_id, activity_id, animal_group_id, kind, transaction_date) values
  ('49000000-0000-0000-0000-000000000001', '29000000-0000-0000-0000-000000000001', '39000000-0000-0000-0000-000000000001', '69000000-0000-0000-0000-000000000003', 'depense', '2026-01-02'),
  ('49000000-0000-0000-0000-000000000002', '29000000-0000-0000-0000-000000000001', '39000000-0000-0000-0000-000000000001', '69000000-0000-0000-0000-000000000003', 'revenu', '2026-01-03');
insert into public.transaction_lines (id, farm_id, transaction_id, description, quantity, unit_price) values
  ('99000000-0000-0000-0000-000000000001', '29000000-0000-0000-0000-000000000001', '49000000-0000-0000-0000-000000000001', 'Recorded livestock purchase', 2, 12.125),
  ('99000000-0000-0000-0000-000000000002', '29000000-0000-0000-0000-000000000001', '49000000-0000-0000-0000-000000000002', 'Recorded livestock sale', 3, 10);
insert into public.payments (farm_id, transaction_id, amount)
values ('29000000-0000-0000-0000-000000000001', '49000000-0000-0000-0000-000000000001', 24.250);
insert into public.products (id, farm_id, name) values ('59000000-0000-0000-0000-000000000001', '29000000-0000-0000-0000-000000000001', 'Feed');
insert into public.inventory_movements (farm_id, product_id, activity_id, animal_group_id, kind, quantity)
values ('29000000-0000-0000-0000-000000000001', '59000000-0000-0000-0000-000000000001', '39000000-0000-0000-0000-000000000001', '69000000-0000-0000-0000-000000000004', 'entree', 1);

do $$
declare temporary_id uuid; changed integer;
begin
  if (select count(*) from public.animal_groups) <> 5 or (select count(*) from public.animal_events) <> 8 then raise exception 'owner list isolation failed'; end if;
  if (select current_count from public.v_animal_group_counts where animal_group_id = '69000000-0000-0000-0000-000000000001') <> 14 then
    raise exception 'opening + births/purchases - sales/deaths or neutral-event semantics changed'; end if;
  if (select current_count from public.v_animal_group_counts where animal_group_id = '69000000-0000-0000-0000-000000000006') <> -1 then raise exception 'negative ledger balance was hidden or clamped'; end if;
  if (select sum(current_count) from public.v_animal_group_counts) <> 18 then raise exception 'farm count total includes another farm'; end if;
  insert into public.animal_groups (farm_id, activity_id, name, species, opening_count)
  values ('29000000-0000-0000-0000-000000000001', '39000000-0000-0000-0000-000000000002', 'Temporary 50%', 'Ovins', 0) returning id into temporary_id;
  update public.animal_groups set name = 'Updated 50%', species = 'Caprins', opening_count = 2, is_active = false, updated_at = '2000-01-01' where id = temporary_id;
  if not exists (select 1 from public.animal_groups where id = temporary_id and name = 'Updated 50%' and species = 'Caprins' and opening_count = 2 and not is_active and updated_at = now()) then raise exception 'owner edit/inactive activity/audit trigger failed'; end if;
  if (select count(*) from public.animal_groups where name ilike '%50\%%' and species ilike '%Caprins%' and not is_active) <> 1 then raise exception 'combined group filters failed'; end if;
  delete from public.animal_groups where id = temporary_id; get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'unreferenced owner group deletion failed'; end if;
  update public.animal_groups set name = 'Historical renamed', opening_count = 11, is_active = false where id = '69000000-0000-0000-0000-000000000001';
  if (select current_count from public.v_animal_group_counts where animal_group_id = '69000000-0000-0000-0000-000000000001') <> 15 then raise exception 'inactive group count or explicit opening-count change failed'; end if;
  if not exists (select 1 from public.animal_events where id = '79000000-0000-0000-0000-000000000001' and kind = 'naissance' and quantity = 3 and event_date = '2026-01-01' and notes = 'Original birth')
    or (select count(*) from public.animal_events where animal_group_id = '69000000-0000-0000-0000-000000000001') <> 7 then raise exception 'group edit rewrote historical events'; end if;
  update public.animal_groups set opening_count = 10 where id = '69000000-0000-0000-0000-000000000001';
  if (select count(*) from public.animal_events where animal_group_id = '69000000-0000-0000-0000-000000000001' and kind = 'achat' and event_date between '2026-01-01' and '2026-01-03') <> 1 then raise exception 'event history filters failed'; end if;
  -- Financial information comes from actual generated line amounts, including
  -- settled transactions which v_debts deliberately excludes.
  if (select sum(l.amount) from public.transaction_lines l join public.transactions t on t.id = l.transaction_id and t.farm_id = l.farm_id
    where t.animal_group_id = '69000000-0000-0000-0000-000000000003' and t.kind = 'depense') <> 24.250 then raise exception 'recorded purchase amount changed'; end if;
  if (select sum(l.amount) from public.transaction_lines l join public.transactions t on t.id = l.transaction_id and t.farm_id = l.farm_id
    where t.animal_group_id = '69000000-0000-0000-0000-000000000003' and t.kind = 'revenu') <> 30 then raise exception 'recorded sale amount changed'; end if;
  if exists (select 1 from public.v_debts where transaction_id = '49000000-0000-0000-0000-000000000001') then raise exception 'settled fixture is unexpectedly in debt view'; end if;
  if (select count(*) from public.tasks where animal_group_id = '69000000-0000-0000-0000-000000000002') <> 1 then raise exception 'linked task navigation source failed'; end if;
end;
$$;

-- Each fixture has exactly one dependency category, so every deletion guard is
-- tested independently. No automatic cascading of history or unassignment.
do $$
declare group_id uuid;
begin
  foreach group_id in array array['69000000-0000-0000-0000-000000000001'::uuid, '69000000-0000-0000-0000-000000000002'::uuid,
    '69000000-0000-0000-0000-000000000003'::uuid, '69000000-0000-0000-0000-000000000004'::uuid] loop
    begin
      delete from public.animal_groups where id = group_id;
      if not found then raise exception 'deletion dependency check did not target a real group'; end if;
      raise exception 'dependent group % was deleted', group_id;
    exception when foreign_key_violation then null;
    end;
  end loop;
  begin
    update public.animal_groups set activity_id = '39000000-0000-0000-0000-000000000002' where id = '69000000-0000-0000-0000-000000000002';
    raise exception 'task-linked group activity changed inconsistently';
  exception when foreign_key_violation then null;
  end;
  begin
    insert into public.animal_groups (farm_id, activity_id, name, species) values ('29000000-0000-0000-0000-000000000001', '39000000-0000-0000-0000-000000000003', 'Invalid activity', 'Ovins');
    raise exception 'foreign activity accepted on group INSERT';
  exception when foreign_key_violation then null;
  end;
  begin
    update public.animal_groups set activity_id = '39000000-0000-0000-0000-000000000003' where id = '69000000-0000-0000-0000-000000000006';
    raise exception 'foreign activity accepted on group UPDATE';
  exception when foreign_key_violation then null;
  end;
  begin
    insert into public.animal_events (farm_id, animal_group_id, kind, quantity) values ('29000000-0000-0000-0000-000000000001', '69000000-0000-0000-0000-000000000001', 'birth', 1);
    raise exception 'invented event kind accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.animal_events (farm_id, animal_group_id, kind, quantity) values ('29000000-0000-0000-0000-000000000001', '69000000-0000-0000-0000-000000000001', 'achat', -1);
    raise exception 'negative event quantity accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.animal_groups (farm_id, activity_id, name, species, opening_count) values ('29000000-0000-0000-0000-000000000001', '39000000-0000-0000-0000-000000000001', 'Invalid opening', 'Ovins', -1);
    raise exception 'negative opening count accepted';
  exception when check_violation then null;
  end;
end;
$$;

-- A forged JWT role never replaces membership authorization. Structural group
-- writes remain owner-only; existing SQL event UPDATE permission is preserved,
-- although the application exposes INSERT-only event history.
set local request.jwt.claims = '{"sub":"19000000-0000-0000-0000-000000000002","role":"owner"}';
do $$
declare changed integer; event_id uuid;
begin
  if (select count(*) from public.animal_groups) <> 5 or (select count(*) from public.v_animal_group_counts) <> 5 then raise exception 'worker read isolation failed'; end if;
  begin
    insert into public.animal_groups (farm_id, activity_id, name, species) values ('29000000-0000-0000-0000-000000000001', '39000000-0000-0000-0000-000000000001', 'Worker group', 'Ovins');
    raise exception 'worker created a structural group';
  exception when insufficient_privilege then null;
  end;
  update public.animal_groups set opening_count = 999 where id = '69000000-0000-0000-0000-000000000001'; get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'worker updated a group'; end if;
  delete from public.animal_groups where id = '69000000-0000-0000-0000-000000000006'; get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'worker deleted a group'; end if;
  insert into public.animal_events (farm_id, animal_group_id, kind, quantity, event_date, notes)
  values ('29000000-0000-0000-0000-000000000001', '69000000-0000-0000-0000-000000000001', 'naissance', 1, '2026-01-09', 'Worker entry') returning id into event_id;
  update public.animal_events set notes = 'Explicit SQL edit (existing permission)' where id = event_id; get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'existing worker SQL event permission regressed'; end if;
  delete from public.animal_events where id = event_id; get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'worker deleted history'; end if;
  if (select current_count from public.v_animal_group_counts where animal_group_id = '69000000-0000-0000-0000-000000000001') <> 15 then raise exception 'worker event not reflected in count view'; end if;
  if (select count(*) from public.transaction_lines l join public.transactions t on t.id = l.transaction_id and t.farm_id = l.farm_id
    where t.animal_group_id = '69000000-0000-0000-0000-000000000003') <> 2 then raise exception 'permitted worker ledger read failed'; end if;
end;
$$;
set local request.jwt.claims = '{"sub":"19000000-0000-0000-0000-000000000003","role":"owner"}';
do $$
declare changed integer;
begin
  if (select count(*) from public.animal_groups) <> 5 or (select count(*) from public.animal_events) <> 9 then raise exception 'accountant read failed'; end if;
  begin
    insert into public.animal_events (farm_id, animal_group_id, kind) values ('29000000-0000-0000-0000-000000000001', '69000000-0000-0000-0000-000000000001', 'soin');
    raise exception 'accountant recorded an event';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.animal_groups (farm_id, activity_id, name, species) values ('29000000-0000-0000-0000-000000000001', '39000000-0000-0000-0000-000000000001', 'Accountant group', 'Ovins');
    raise exception 'accountant created a group';
  exception when insufficient_privilege then null;
  end;
  update public.animal_groups set name = 'Forbidden' where id = '69000000-0000-0000-0000-000000000001'; get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'accountant edited group'; end if;
  delete from public.animal_groups where id = '69000000-0000-0000-0000-000000000006'; get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'accountant deleted group'; end if;
  update public.animal_events set notes = 'Forbidden' where id = '79000000-0000-0000-0000-000000000001'; get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'accountant rewrote event'; end if;
  delete from public.animal_events where id = '79000000-0000-0000-0000-000000000001'; get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'accountant deleted history'; end if;
end;
$$;

-- Cross-farm event references fail for owners and workers on INSERT/UPDATE,
-- while direct reads/mutations of foreign rows remain invisible.
do $$
declare member_id uuid; changed integer;
begin
  foreach member_id in array array['19000000-0000-0000-0000-000000000001'::uuid, '19000000-0000-0000-0000-000000000002'::uuid] loop
    perform set_config('request.jwt.claims', json_build_object('sub', member_id, 'role', 'owner')::text, true);
    if exists (select 1 from public.animal_groups where farm_id = '29000000-0000-0000-0000-000000000002')
      or exists (select 1 from public.animal_events where farm_id = '29000000-0000-0000-0000-000000000002')
      or exists (select 1 from public.v_animal_group_counts where farm_id = '29000000-0000-0000-0000-000000000002') then raise exception 'foreign livestock visible'; end if;
    update public.animal_events set notes = 'Foreign edit' where id = '79000000-0000-0000-0000-000000000009'; get diagnostics changed = row_count;
    if changed <> 0 then raise exception 'foreign event edited'; end if;
    delete from public.animal_groups where id = '69000000-0000-0000-0000-000000000009'; get diagnostics changed = row_count;
    if changed <> 0 then raise exception 'foreign group deleted'; end if;
    begin
      insert into public.animal_events (farm_id, animal_group_id, kind) values ('29000000-0000-0000-0000-000000000001', '69000000-0000-0000-0000-000000000009', 'achat');
      raise exception 'cross-farm event reference accepted on INSERT';
    exception when foreign_key_violation then null;
    end;
    begin
      update public.animal_events set animal_group_id = '69000000-0000-0000-0000-000000000009' where id = '79000000-0000-0000-0000-000000000001';
      if not found then raise exception 'cross-farm reference UPDATE missed target'; end if;
      raise exception 'cross-farm event reference accepted on UPDATE';
    exception when foreign_key_violation then null;
    end;
    begin
      insert into public.animal_events (farm_id, animal_group_id, kind) values ('29000000-0000-0000-0000-000000000002', '69000000-0000-0000-0000-000000000009', 'achat');
      raise exception 'foreign farm event INSERT accepted';
    exception when insufficient_privilege then null;
    end;
    begin
      update public.animal_events set farm_id = '29000000-0000-0000-0000-000000000002', animal_group_id = '69000000-0000-0000-0000-000000000009' where id = '79000000-0000-0000-0000-000000000001';
      raise exception 'event moved to unauthorized farm';
    exception when insufficient_privilege then null;
    end;
  end loop;
end;
$$;
set local request.jwt.claims = '{"sub":"19000000-0000-0000-0000-000000000004","role":"authenticated"}';
do $$
declare changed integer;
begin
  if (select count(*) from public.animal_groups) <> 1 or (select count(*) from public.animal_events) <> 1
    or (select sum(current_count) from public.v_animal_group_counts) <> 1000 then raise exception 'Farm B can read Farm A livestock'; end if;
  if exists (select 1 from public.tasks) or exists (select 1 from public.transaction_lines) then raise exception 'Farm B can read Farm A related work or financial amounts'; end if;
  update public.animal_groups set name = 'B edit of A' where id = '69000000-0000-0000-0000-000000000001'; get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Farm B edited Farm A group'; end if;
end;
$$;

reset role;
set local role anon;
set local request.jwt.claims = '{}';
do $$
begin
  begin perform * from public.animal_groups; raise exception 'anonymous group read accepted'; exception when insufficient_privilege then null; end;
  begin perform * from public.animal_events; raise exception 'anonymous event read accepted'; exception when insufficient_privilege then null; end;
  begin perform * from public.v_animal_group_counts; raise exception 'anonymous count read accepted'; exception when insufficient_privilege then null; end;
end;
$$;

rollback;
