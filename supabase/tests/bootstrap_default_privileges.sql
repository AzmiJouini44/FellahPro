-- Disposable PostgreSQL 17+ only. The suite rolls back every probe and ACL change.
-- Requires the Supabase anon/authenticated/service_role roles and storage schema.
\set ON_ERROR_STOP on
begin;
do $$
begin
  if current_user <> 'postgres' then raise exception 'run this suite as the postgres creation role'; end if;
  if current_setting('server_version_num')::integer < 170000 then raise exception 'PostgreSQL 17+ is required to test MAINTAIN privileges'; end if;
end; $$;
-- Reconstruct the observed schema-only grants inside this transaction even
-- when roles.sql has already been applied to the validation database.
alter default privileges for role postgres in schema public
  grant all privileges on tables to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema storage
  grant all privileges on tables to postgres, anon, authenticated, service_role;
create temporary table bootstrap_other_defaults as
select coalesce(jsonb_agg(to_jsonb(d) order by d.oid),'[]'::jsonb) as definitions
from pg_default_acl d
where not (d.defaclrole='postgres'::regrole and d.defaclnamespace='public'::regnamespace and d.defaclobjtype='r');
create function pg_temp.assert_true(ok boolean, message text) returns void language plpgsql as $$
begin if ok is not true then raise exception '%', message; end if; end; $$;
create function pg_temp.expect_error(command text, expected text) returns void language plpgsql as $$
declare actual text;
begin
  begin execute command; exception when others then actual := sqlstate; end;
  if actual is distinct from expected then raise exception 'expected SQLSTATE %, got % for %', expected, coalesce(actual,'success'), command; end if;
end; $$;

-- Case A: exact observed defaults. RLS does not protect TRUNCATE.
select pg_temp.assert_true(not exists (
  select 1 from pg_default_acl d join pg_roles r on r.oid=d.defaclrole
  cross join lateral aclexplode(d.defaclacl) a
  where r.rolname='postgres' and d.defaclobjtype='r' and d.defaclnamespace=0
    and (a.grantee=0 or a.grantee in ('anon'::regrole,'authenticated'::regrole))), 'unexpected global client table defaults; inspect before using a schema-only bootstrap');
create table public.acl_before (id integer);
alter table public.acl_before enable row level security;
insert into public.acl_before values (1);
select pg_temp.assert_true((select bool_and(has_table_privilege('authenticated','public.acl_before',p))
  from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) p), 'hosted table defaults not faithfully reproduced');
set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.acl_before), 'default-deny RLS did not hide the probe row');
truncate table public.acl_before;
reset role;
select pg_temp.assert_true((select count(*)=0 from public.acl_before), 'TRUNCATE was unexpectedly stopped by RLS');

\ir ../roles.sql
create table public.acl_after (id integer);
insert into public.acl_after values (1);
select pg_temp.assert_true((select bool_and(not has_table_privilege(r,'public.acl_after',p))
  from unnest(array['anon','authenticated']) r cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) p), 'schema-only bootstrap did not remove all client table defaults');
select pg_temp.assert_true((select bool_and(has_table_privilege('service_role','public.acl_after',p))
  from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) p), 'service role defaults were modified');
set local role authenticated;
select pg_temp.expect_error('truncate table public.acl_after','42501');
reset role;
select pg_temp.assert_true((select count(*)=1 from public.acl_after), 'denied truncate removed a row');
-- Existing objects keep the grants captured when they were created.
select pg_temp.assert_true(has_table_privilege('authenticated','public.acl_before','TRUNCATE'), 'ALTER DEFAULT PRIVILEGES unexpectedly changed an existing table');

create table storage.acl_storage_after (id integer);
select pg_temp.assert_true((select bool_and(has_table_privilege(r,'storage.acl_storage_after',p))
  from unnest(array['anon','authenticated']) r cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) p), 'public bootstrap changed storage-specific defaults');
select pg_temp.assert_true((select coalesce(jsonb_agg(to_jsonb(d) order by d.oid),'[]'::jsonb)
  from pg_default_acl d where not (d.defaclrole='postgres'::regrole and d.defaclnamespace='public'::regnamespace and d.defaclobjtype='r'))
  = (select definitions from bootstrap_other_defaults), 'bootstrap changed defaults outside postgres/public/tables');

-- Case B: hypothetical GLOBAL + schema grants. A per-schema REVOKE cannot
-- subtract the global contribution. This is NOT the hosted catalog state.
create schema acl_other;
alter default privileges for role postgres in schema acl_other grant select on tables to authenticated;
alter default privileges for role postgres grant all privileges on tables to anon, authenticated;
alter default privileges for role postgres in schema public grant all privileges on tables to anon, authenticated;
\ir ../roles.sql
create table public.acl_global_survives (id integer);
create table acl_other.acl_global_survives (id integer);
select pg_temp.assert_true((select bool_and(has_table_privilege(r,'public.acl_global_survives',p))
  from unnest(array['anon','authenticated']) r cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) p), 'global grants were incorrectly treated as removed by a schema revoke');
select pg_temp.assert_true(has_table_privilege('authenticated','acl_other.acl_global_survives','TRUNCATE'), 'global grants did not reach another schema');

-- A GLOBAL revoke fixes future objects in every schema, not just public.
alter default privileges for role postgres revoke all privileges on tables from anon, authenticated;
create table public.acl_global_revoked (id integer);
create table acl_other.acl_global_revoked (id integer);
create table storage.acl_global_revoked (id integer);
select pg_temp.assert_true(not has_table_privilege('authenticated','public.acl_global_revoked','UPDATE')
  and not has_table_privilege('authenticated','public.acl_global_revoked','TRUNCATE'), 'global revoke failed for public');
select pg_temp.assert_true(has_table_privilege('authenticated','acl_other.acl_global_revoked','SELECT')
  and not has_table_privilege('authenticated','acl_other.acl_global_revoked','TRUNCATE')
  and not has_table_privilege('anon','acl_other.acl_global_revoked','SELECT'), 'global revoke did not remove global rights in the other schema while retaining its explicit SELECT');
select pg_temp.assert_true(has_table_privilege('authenticated','storage.acl_global_revoked','TRUNCATE'), 'global revoke removed a separate schema-specific storage grant');
select pg_temp.assert_true(has_table_privilege('authenticated','acl_other.acl_global_survives','TRUNCATE'), 'global revoke unexpectedly changed an existing object');
rollback;
\echo 'PASS: hosted schema-only correction, global additive counterexample, cross-schema scope, and nonretroactive semantics.'
