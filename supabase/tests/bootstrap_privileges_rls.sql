-- Disposable PostgreSQL 17+ only; apply roles.sql before the five migrations.
-- Authenticated JWT subjects below are fixtures; every fixture rolls back.
\set ON_ERROR_STOP on
begin;
do $$
begin
  if current_user <> 'postgres' then raise exception 'run this suite as the postgres creation role'; end if;
  if current_setting('server_version_num')::integer < 170000 then raise exception 'PostgreSQL 17+ is required to test MAINTAIN privileges'; end if;
end; $$;
create function pg_temp.assert_true(ok boolean, message text) returns void language plpgsql as $$
begin if ok is not true then raise exception '%', message; end if; end; $$;
create function pg_temp.expect_error(command text, expected text) returns void language plpgsql as $$
declare actual text;
begin
  begin execute command; exception when others then actual := sqlstate; end;
  if actual is distinct from expected then raise exception 'expected SQLSTATE %, got % for %', expected, coalesce(actual,'success'), command; end if;
end; $$;
create function pg_temp.affected(command text, expected integer) returns void language plpgsql as $$
declare changed integer;
begin execute command; get diagnostics changed=row_count;
  if changed<>expected then raise exception 'expected % affected rows, got % for %',expected,changed,command; end if;
end; $$;

-- Effective permissions (table grants, column grants, PUBLIC and membership),
-- not merely the text of GRANT statements or explicit ACL array entries.
do $$
declare t record; col record; permission text; f record; permitted boolean;
begin
  if (select count(*) from pg_class where relnamespace='public'::regnamespace and relkind='r')<>16 then raise exception 'expected exactly 16 application tables'; end if;
  for t in select oid,relname,relrowsecurity from pg_class where relnamespace='public'::regnamespace and relkind='r' loop
    perform pg_temp.assert_true(t.relrowsecurity,'RLS missing on '||t.relname);
    perform pg_temp.assert_true(has_table_privilege('authenticated',t.oid,'SELECT'),'member SELECT missing on '||t.relname);
    foreach permission in array array['TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] loop
      perform pg_temp.assert_true(not has_table_privilege('authenticated',t.oid,permission),'unintended authenticated '||permission||' on '||t.relname);
    end loop;
    foreach permission in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] loop
      perform pg_temp.assert_true(not has_table_privilege('anon',t.oid,permission),'unintended anonymous '||permission||' on '||t.relname);
    end loop;
    if t.relname in ('farm_members','agricultural_operations') then
      perform pg_temp.assert_true(not has_table_privilege('authenticated',t.oid,'UPDATE'),'table-wide UPDATE overrides column restriction on '||t.relname);
    else
      perform pg_temp.assert_true(has_table_privilege('authenticated',t.oid,'UPDATE'),'expected ordinary table UPDATE grant missing on '||t.relname);
    end if;
  end loop;
  for t in select oid,relname,reloptions from pg_class where relnamespace='public'::regnamespace and relkind='v' loop
    perform pg_temp.assert_true(has_table_privilege('authenticated',t.oid,'SELECT'),'view SELECT missing');
    perform pg_temp.assert_true('security_invoker=true'=any(t.reloptions),'view does not use caller RLS: '||t.relname);
    foreach permission in array array['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] loop
      perform pg_temp.assert_true(not has_table_privilege('authenticated',t.oid,permission),'view has unintended write/admin privilege');
    end loop;
    perform pg_temp.assert_true(not has_table_privilege('anon',t.oid,'SELECT'),'anonymous view SELECT');
  end loop;
  for col in select attname from pg_attribute where attrelid='public.farm_members'::regclass and attnum>0 and not attisdropped loop
    perform pg_temp.assert_true(has_column_privilege('authenticated','public.farm_members',col.attname,'UPDATE')=(col.attname='role'),'farm_members effective column UPDATE: '||col.attname);
  end loop;
  for col in select attname from pg_attribute where attrelid='public.agricultural_operations'::regclass and attnum>0 and not attisdropped loop
    permitted:=col.attname=any(array['plot_id','crop_cycle_id','activity_id','related_task_id','expense_line_id','operation_type','performed_on','description','notes','quantity','unit']);
    perform pg_temp.assert_true(has_column_privilege('authenticated','public.agricultural_operations',col.attname,'UPDATE')=permitted,'operation effective column UPDATE: '||col.attname);
  end loop;
  for f in select oid,proname,prosecdef,proconfig from pg_proc where pronamespace='public'::regnamespace loop
    permitted:=f.proname=any(array['is_farm_member','is_farm_owner','farm_role','shares_farm','get_current_workspace','create_first_farm']);
    perform pg_temp.assert_true(has_function_privilege('authenticated',f.oid,'EXECUTE')=permitted,'incorrect function EXECUTE: '||f.proname);
    perform pg_temp.assert_true(not has_function_privilege('anon',f.oid,'EXECUTE'),'anonymous function EXECUTE: '||f.proname);
    perform pg_temp.assert_true('search_path=""'=any(f.proconfig),'function search_path not fixed: '||f.proname);
  end loop;
  perform pg_temp.assert_true((select count(*)=10 from pg_proc where pronamespace='public'::regnamespace and prosecdef),'security-definer count differs');
  perform pg_temp.assert_true(not has_schema_privilege('authenticated','public','CREATE'),'application role can create public objects');
  perform pg_temp.assert_true((select not rolbypassrls and not rolsuper from pg_roles where rolname='authenticated'),'application role bypasses RLS');
end; $$;

insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token)
select '00000000-0000-0000-0000-000000000000',id,'authenticated','authenticated',email,'',now(),
  '{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now(),'','','',''
from (values
  ('1c000000-0000-0000-0000-000000000001'::uuid,'acl-owner-a@example.test'),
  ('1c000000-0000-0000-0000-000000000002'::uuid,'acl-worker@example.test'),
  ('1c000000-0000-0000-0000-000000000003'::uuid,'acl-accountant@example.test'),
  ('1c000000-0000-0000-0000-000000000004'::uuid,'acl-owner-b@example.test')
) u(id,email);
set local role authenticated;
set local request.jwt.claims='{"sub":"1c000000-0000-0000-0000-000000000004","role":"authenticated"}';
insert into public.farms (id,name) values ('2c000000-0000-0000-0000-000000000002','Permission farm B');
insert into public.plots (id,farm_id,name) values ('4c000000-0000-0000-0000-000000000002','2c000000-0000-0000-0000-000000000002','B plot');
insert into public.agricultural_operations (id,farm_id,plot_id,operation_type,performed_on) values
  ('9c000000-0000-0000-0000-000000000002','2c000000-0000-0000-0000-000000000002','4c000000-0000-0000-0000-000000000002','irrigation','2026-01-01');
set local request.jwt.claims='{"sub":"1c000000-0000-0000-0000-000000000001","role":"authenticated"}';
insert into public.farms (id,name) values ('2c000000-0000-0000-0000-000000000001','Permission farm A');
insert into public.farm_members (farm_id,user_id,role) values
  ('2c000000-0000-0000-0000-000000000001','1c000000-0000-0000-0000-000000000002','worker'),
  ('2c000000-0000-0000-0000-000000000001','1c000000-0000-0000-0000-000000000003','accountant');
insert into public.activities (id,farm_id,name,kind) values
  ('3c000000-0000-0000-0000-000000000001','2c000000-0000-0000-0000-000000000001','Crops','culture');
insert into public.plots (id,farm_id,name,activity_id) values
  ('4c000000-0000-0000-0000-000000000001','2c000000-0000-0000-0000-000000000001','A plot','3c000000-0000-0000-0000-000000000001');
insert into public.transactions (id,farm_id,activity_id,kind) values
  ('7c000000-0000-0000-0000-000000000001','2c000000-0000-0000-0000-000000000001','3c000000-0000-0000-0000-000000000001','depense');
insert into public.agricultural_operations (id,farm_id,plot_id,operation_type,performed_on) values
  ('9c000000-0000-0000-0000-000000000001','2c000000-0000-0000-0000-000000000001','4c000000-0000-0000-0000-000000000001','irrigation','2026-01-01');
select pg_temp.affected($q$update public.farm_members set role='accountant' where user_id='1c000000-0000-0000-0000-000000000002'$q$,1);
select pg_temp.affected($q$update public.farm_members set role='worker' where user_id='1c000000-0000-0000-0000-000000000002'$q$,1);
select pg_temp.expect_error($q$update public.farm_members set farm_id=farm_id where user_id='1c000000-0000-0000-0000-000000000002'$q$,'42501');
select pg_temp.expect_error($q$update public.farm_members set user_id=user_id where user_id='1c000000-0000-0000-0000-000000000002'$q$,'42501');
select pg_temp.expect_error($q$update public.farm_members set joined_at=now() where user_id='1c000000-0000-0000-0000-000000000002'$q$,'42501');
select pg_temp.expect_error($q$update public.farm_members set role='worker' where user_id='1c000000-0000-0000-0000-000000000001'$q$,'23514');
select pg_temp.affected($q$update public.agricultural_operations set notes='Owner edit',quantity=2.125,unit='m3' where id='9c000000-0000-0000-0000-000000000001'$q$,1);
do $$
declare assignment text;
begin
  foreach assignment in array array['id=gen_random_uuid()','farm_id=farm_id','created_by=created_by','created_at=now()','updated_at=now()'] loop
    perform pg_temp.expect_error('update public.agricultural_operations set '||assignment||' where id=''9c000000-0000-0000-0000-000000000001''','42501');
  end loop;
end; $$;
select pg_temp.expect_error('truncate table public.agricultural_operations','42501');
select pg_temp.expect_error('select public.guard_last_farm_owner()','42501');
select pg_temp.expect_error('select public.guard_agricultural_operation_expense()','42501');
select pg_temp.expect_error($q$select public.assert_transaction_not_overpaid('2c000000-0000-0000-0000-000000000001','7c000000-0000-0000-0000-000000000001')$q$,'42501');

-- Worker: field CRUD subset works; structural membership/financial updates,
-- protected columns, deletion and whole-table truncation remain denied.
set local request.jwt.claims='{"sub":"1c000000-0000-0000-0000-000000000002","role":"owner"}';
insert into public.agricultural_operations (id,farm_id,plot_id,operation_type,performed_on) values
  ('9c000000-0000-0000-0000-000000000003','2c000000-0000-0000-0000-000000000001','4c000000-0000-0000-0000-000000000001','recolte','2026-01-02');
select pg_temp.affected($q$update public.agricultural_operations set notes='Worker edit' where id='9c000000-0000-0000-0000-000000000001'$q$,1);
select pg_temp.affected($q$delete from public.agricultural_operations where id='9c000000-0000-0000-0000-000000000001'$q$,0);
select pg_temp.affected($q$update public.farm_members set role='owner' where user_id='1c000000-0000-0000-0000-000000000002'$q$,0);
select pg_temp.expect_error($q$update public.agricultural_operations set id=gen_random_uuid() where id='9c000000-0000-0000-0000-000000000001'$q$,'42501');
select pg_temp.expect_error('truncate table public.agricultural_operations','42501');
insert into public.transaction_lines (id,farm_id,transaction_id,description,quantity,unit_price) values
  ('8c000000-0000-0000-0000-000000000001','2c000000-0000-0000-0000-000000000001','7c000000-0000-0000-0000-000000000001','Recorded input',2,3);
select pg_temp.affected($q$update public.transaction_lines set unit_price=4 where id='8c000000-0000-0000-0000-000000000001'$q$,0);
select pg_temp.affected($q$delete from public.transaction_lines where id='8c000000-0000-0000-0000-000000000001'$q$,0);
select pg_temp.assert_true((select count(*)=2 from public.v_agricultural_operations),'worker read/farm isolation');
set local row_security=off;
select pg_temp.expect_error('select count(*) from public.agricultural_operations','42501');
set local row_security=on;

-- Accountant: field operations read-only; permitted financial updates work.
set local request.jwt.claims='{"sub":"1c000000-0000-0000-0000-000000000003","role":"owner"}';
select pg_temp.assert_true((select count(*)=2 from public.v_agricultural_operations),'accountant read/farm isolation');
select pg_temp.expect_error($q$insert into public.agricultural_operations (farm_id,plot_id,operation_type,performed_on) values ('2c000000-0000-0000-0000-000000000001','4c000000-0000-0000-0000-000000000001','labour','2026-01-01')$q$,'42501');
select pg_temp.affected($q$update public.agricultural_operations set notes='Forbidden accountant edit' where id='9c000000-0000-0000-0000-000000000001'$q$,0);
select pg_temp.affected($q$delete from public.agricultural_operations where id='9c000000-0000-0000-0000-000000000001'$q$,0);
select pg_temp.affected($q$update public.farm_members set role='owner' where user_id='1c000000-0000-0000-0000-000000000003'$q$,0);
select pg_temp.affected($q$update public.transactions set notes='Accountant edit' where id='7c000000-0000-0000-0000-000000000001'$q$,1);
select pg_temp.affected($q$update public.transaction_lines set unit_price=4 where id='8c000000-0000-0000-0000-000000000001'$q$,1);
select pg_temp.assert_true((select amount=8 from public.transaction_lines where id='8c000000-0000-0000-0000-000000000001'),'permitted financial update');
select pg_temp.expect_error('truncate table public.agricultural_operations','42501');

-- A legitimate owner of B cannot read or change A's field work.
set local request.jwt.claims='{"sub":"1c000000-0000-0000-0000-000000000004","role":"owner"}';
select pg_temp.assert_true((select count(*)=1 from public.v_agricultural_operations),'other-farm owner isolation');
select pg_temp.affected($q$update public.agricultural_operations set notes='Cross farm' where id='9c000000-0000-0000-0000-000000000001'$q$,0);
select pg_temp.affected($q$delete from public.agricultural_operations where id='9c000000-0000-0000-0000-000000000001'$q$,0);
select pg_temp.expect_error($q$insert into public.agricultural_operations (farm_id,plot_id,operation_type,performed_on) values ('2c000000-0000-0000-0000-000000000001','4c000000-0000-0000-0000-000000000001','labour','2026-01-01')$q$,'42501');
set local request.jwt.claims='{"sub":"1c000000-0000-0000-0000-000000000001","role":"authenticated"}';
select pg_temp.affected($q$delete from public.agricultural_operations where id='9c000000-0000-0000-0000-000000000003'$q$,1);
select pg_temp.affected($q$delete from public.agricultural_operations where id='9c000000-0000-0000-0000-000000000001'$q$,1);
reset role;
select pg_temp.assert_true((select count(*)=1 from public.agricultural_operations),'owner deletion or denied writes changed wrong data');
rollback;
\echo 'PASS: effective table/column ACLs, all role paths, RLS, TRUNCATE denial, and protected functions (fixtures rolled back).'
