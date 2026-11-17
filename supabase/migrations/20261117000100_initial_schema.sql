-- FellahPro Mission 1 foundation. Review before applying.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  locale text not null default 'fr' check (locale in ('fr', 'ar')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Public application profile attached to a Supabase Auth user.';

create table public.farms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  currency text not null default 'TND' check (currency = 'TND'),
  is_demo boolean not null default false,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.farms is 'Farm workspaces; demo workspaces are flagged and excluded from reporting.';

create table public.farm_members (
  farm_id uuid not null references public.farms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'worker' check (role in ('owner', 'worker', 'accountant')),
  joined_at timestamptz not null default now(),
  primary key (farm_id, user_id)
);

comment on table public.farm_members is 'Membership and role assignments that control access to a farm.';

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  kind text not null check (kind in ('culture', 'elevage', 'commerce', 'autre')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, farm_id)
);

comment on table public.activities is 'Farm activities used as the primary profitability dimension.';

create table public.plots (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  activity_id uuid,
  name text not null check (length(btrim(name)) > 0),
  area_hectares numeric(12,3) not null default 0 check (area_hectares >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, farm_id),
  foreign key (activity_id, farm_id)
    references public.activities (id, farm_id)
);

comment on table public.plots is 'Physical farm plots, optionally assigned to a cultivation activity.';

create table public.crop_cycles (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  activity_id uuid not null,
  plot_id uuid not null,
  crop_name text not null check (length(btrim(crop_name)) > 0),
  started_on date not null,
  ended_on date,
  status text not null default 'planned'
    check (status in ('planned', 'active', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_on is null or ended_on >= started_on),
  unique (id, farm_id),
  unique (id, farm_id, activity_id),
  foreign key (activity_id, farm_id)
    references public.activities (id, farm_id),
  foreign key (plot_id, farm_id)
    references public.plots (id, farm_id)
);

comment on table public.crop_cycles is 'Cultivation cycles that connect a crop, plot, and activity over time.';

create table public.animal_groups (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  activity_id uuid not null,
  name text not null check (length(btrim(name)) > 0),
  species text not null check (length(btrim(species)) > 0),
  head_count integer not null default 0 check (head_count >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, farm_id),
  unique (id, farm_id, activity_id),
  foreign key (activity_id, farm_id)
    references public.activities (id, farm_id)
);

comment on table public.animal_groups is 'Groups of animals tracked together for husbandry and profitability.';

create table public.animal_events (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  animal_group_id uuid not null,
  kind text not null
    check (kind in ('naissance', 'achat', 'vente', 'deces', 'transfert', 'soin', 'autre')),
  event_date date not null default current_date,
  quantity integer not null default 1 check (quantity >= 0),
  notes text,
  created_at timestamptz not null default now(),
  foreign key (animal_group_id, farm_id)
    references public.animal_groups (id, farm_id)
);

comment on table public.animal_events is 'Dated births, purchases, sales, losses, transfers, and care events for animal groups.';

create table public.parties (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  kind text not null check (kind in ('fournisseur', 'client')),
  phone text,
  email text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, farm_id)
);

comment on table public.parties is 'Farm suppliers and customers referenced by financial transactions.';

create table public.products (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  sku text,
  unit text not null default 'unite' check (length(btrim(unit)) > 0),
  minimum_stock numeric(14,3) not null default 0 check (minimum_stock >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, farm_id),
  unique (farm_id, sku)
);

comment on table public.products is 'Farm-specific products and supplies whose stock is derived from movements.';

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  activity_id uuid not null,
  crop_cycle_id uuid,
  animal_group_id uuid,
  party_id uuid,
  kind text not null check (kind in ('depense', 'revenu')),
  transaction_date date not null default current_date,
  reference text,
  notes text,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(crop_cycle_id, animal_group_id) <= 1),
  unique (id, farm_id),
  foreign key (activity_id, farm_id)
    references public.activities (id, farm_id),
  foreign key (crop_cycle_id, farm_id, activity_id)
    references public.crop_cycles (id, farm_id, activity_id),
  foreign key (animal_group_id, farm_id, activity_id)
    references public.animal_groups (id, farm_id, activity_id),
  foreign key (party_id, farm_id)
    references public.parties (id, farm_id)
);

comment on table public.transactions is 'Central expense and revenue ledger headers, always linked to an activity.';

create table public.transaction_lines (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  transaction_id uuid not null,
  product_id uuid,
  description text not null check (length(btrim(description)) > 0),
  quantity numeric(14,3) not null default 1 check (quantity >= 0),
  unit_price numeric(12,3) not null default 0 check (unit_price >= 0),
  amount numeric(12,3) generated always as ((quantity * unit_price)::numeric(12,3)) stored
    check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (id, farm_id),
  foreign key (transaction_id, farm_id)
    references public.transactions (id, farm_id) on delete cascade,
  foreign key (product_id, farm_id)
    references public.products (id, farm_id)
);

comment on table public.transaction_lines is 'Non-negative line items whose totals form each ledger transaction amount.';

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  transaction_id uuid not null,
  amount numeric(12,3) not null check (amount >= 0),
  paid_on date not null default current_date,
  method text not null default 'especes'
    check (method in ('especes', 'virement', 'cheque', 'carte', 'autre')),
  reference text,
  notes text,
  created_at timestamptz not null default now(),
  foreign key (transaction_id, farm_id)
    references public.transactions (id, farm_id) on delete cascade
);

comment on table public.payments is 'Settlements received or paid against central ledger transactions.';

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  product_id uuid not null,
  activity_id uuid,
  crop_cycle_id uuid,
  animal_group_id uuid,
  transaction_line_id uuid,
  kind text not null
    check (kind in ('entree', 'sortie', 'ajustement_positif', 'ajustement_negatif')),
  quantity numeric(14,3) not null check (quantity >= 0),
  moved_on date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  check (num_nonnulls(crop_cycle_id, animal_group_id) <= 1),
  check (crop_cycle_id is null or activity_id is not null),
  check (animal_group_id is null or activity_id is not null),
  foreign key (product_id, farm_id)
    references public.products (id, farm_id),
  foreign key (activity_id, farm_id)
    references public.activities (id, farm_id),
  foreign key (crop_cycle_id, farm_id, activity_id)
    references public.crop_cycles (id, farm_id, activity_id),
  foreign key (animal_group_id, farm_id, activity_id)
    references public.animal_groups (id, farm_id, activity_id),
  foreign key (transaction_line_id, farm_id)
    references public.transaction_lines (id, farm_id)
);

comment on table public.inventory_movements is 'Signed-by-kind stock ledger used to derive current product quantities.';

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  activity_id uuid,
  crop_cycle_id uuid,
  animal_group_id uuid,
  assigned_to uuid references public.profiles (id) on delete set null,
  title text not null check (length(btrim(title)) > 0),
  description text,
  due_on date,
  status text not null default 'a_faire'
    check (status in ('a_faire', 'en_cours', 'terminee', 'annulee')),
  priority text not null default 'normale'
    check (priority in ('basse', 'normale', 'haute')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(crop_cycle_id, animal_group_id) <= 1),
  check (crop_cycle_id is null or activity_id is not null),
  check (animal_group_id is null or activity_id is not null),
  foreign key (activity_id, farm_id)
    references public.activities (id, farm_id),
  foreign key (crop_cycle_id, farm_id, activity_id)
    references public.crop_cycles (id, farm_id, activity_id),
  foreign key (animal_group_id, farm_id, activity_id)
    references public.animal_groups (id, farm_id, activity_id),
  foreign key (farm_id, assigned_to)
    references public.farm_members (farm_id, user_id)
);

comment on table public.tasks is 'Farm work items that may be attached to an activity, crop cycle, or animal group.';

-- Keep common audit timestamps consistent.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.prevent_created_by_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'created_by cannot be changed';
  end if;

  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'farms', 'activities', 'plots', 'crop_cycles',
    'animal_groups', 'parties', 'products', 'transactions', 'tasks'
  ]
  loop
    execute format(
      'create trigger set_%I_updated_at before update on public.%I '
      'for each row execute function public.set_updated_at()',
      table_name,
      table_name
    );
  end loop;
end;
$$;

create trigger protect_farm_created_by
  before update on public.farms
  for each row execute function public.prevent_created_by_change();

create trigger protect_transaction_created_by
  before update on public.transactions
  for each row execute function public.prevent_created_by_change();

-- Create a profile for every Auth user. Metadata is optional and untrusted.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone, locale)
  values (
    new.id,
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'phone'), ''),
    case when new.raw_user_meta_data ->> 'locale' = 'ar' then 'ar' else 'fr' end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The creator receives the first owner membership without a client-side race.
create or replace function public.add_farm_creator_as_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.farm_members (farm_id, user_id, role)
  values (new.id, new.created_by, 'owner');

  return new;
end;
$$;

create trigger on_farm_created
  after insert on public.farms
  for each row execute function public.add_farm_creator_as_owner();

-- SECURITY DEFINER avoids farm_members policy recursion. Each function has a
-- fixed search_path and returns only an authorization boolean.
create or replace function public.is_farm_member(target_farm_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.farm_members
    where farm_id = target_farm_id
      and user_id = (select auth.uid())
  );
$$;

create or replace function public.is_farm_owner(target_farm_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.farm_members
    where farm_id = target_farm_id
      and user_id = (select auth.uid())
      and role = 'owner'
  );
$$;

create or replace function public.shares_farm(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.farm_members mine
    join public.farm_members theirs using (farm_id)
    where mine.user_id = (select auth.uid())
      and theirs.user_id = target_user_id
  );
$$;

revoke all on function public.is_farm_member(uuid) from public, anon;
revoke all on function public.is_farm_owner(uuid) from public, anon;
revoke all on function public.shares_farm(uuid) from public, anon;
grant execute on function public.is_farm_member(uuid) to authenticated;
grant execute on function public.is_farm_owner(uuid) to authenticated;
grant execute on function public.shares_farm(uuid) to authenticated;

-- Index the membership lookup and every farm_id used by RLS.
create index farm_members_user_farm_idx on public.farm_members (user_id, farm_id);
create index farm_members_farm_role_idx on public.farm_members (farm_id, role);
create index activities_farm_idx on public.activities (farm_id);
create index plots_farm_idx on public.plots (farm_id);
create index crop_cycles_farm_idx on public.crop_cycles (farm_id);
create index animal_groups_farm_idx on public.animal_groups (farm_id);
create index animal_events_farm_idx on public.animal_events (farm_id);
create index parties_farm_idx on public.parties (farm_id);
create index products_farm_idx on public.products (farm_id);
create index transactions_farm_activity_date_idx
  on public.transactions (farm_id, activity_id, transaction_date);
create index transaction_lines_farm_transaction_idx
  on public.transaction_lines (farm_id, transaction_id);
create index payments_farm_transaction_idx
  on public.payments (farm_id, transaction_id);
create index inventory_movements_farm_product_date_idx
  on public.inventory_movements (farm_id, product_id, moved_on);
create index tasks_farm_idx on public.tasks (farm_id);

alter table public.profiles enable row level security;
alter table public.farms enable row level security;
alter table public.farm_members enable row level security;
alter table public.activities enable row level security;
alter table public.plots enable row level security;
alter table public.crop_cycles enable row level security;
alter table public.animal_groups enable row level security;
alter table public.animal_events enable row level security;
alter table public.parties enable row level security;
alter table public.products enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_lines enable row level security;
alter table public.payments enable row level security;
alter table public.tasks enable row level security;

create policy "users can read relevant profiles"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or public.shares_farm(id)
  );

create policy "users can update their profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "members can read farms"
  on public.farms for select to authenticated
  using (public.is_farm_member(id));

create policy "users can create farms"
  on public.farms for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy "owners can update farms"
  on public.farms for update to authenticated
  using (public.is_farm_owner(id))
  with check (public.is_farm_owner(id));

create policy "owners can delete farms"
  on public.farms for delete to authenticated
  using (public.is_farm_owner(id));

create policy "members can read farm membership"
  on public.farm_members for select to authenticated
  using (public.is_farm_member(farm_id));

create policy "owners can add farm members"
  on public.farm_members for insert to authenticated
  with check (public.is_farm_owner(farm_id));

create policy "owners can update farm members"
  on public.farm_members for update to authenticated
  using (public.is_farm_owner(farm_id))
  with check (public.is_farm_owner(farm_id));

create policy "owners can remove farm members"
  on public.farm_members for delete to authenticated
  using (public.is_farm_owner(farm_id));

-- Operational tables share the same farm-membership boundary. Roles can be
-- narrowed later without changing the schema.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'activities', 'plots', 'crop_cycles', 'animal_groups', 'animal_events',
    'parties', 'products', 'inventory_movements',
    'transaction_lines', 'payments', 'tasks'
  ]
  loop
    execute format(
      'create policy "members can read %1$s" on public.%1$I '
      'for select to authenticated using (public.is_farm_member(farm_id))',
      table_name
    );
    execute format(
      'create policy "members can create %1$s" on public.%1$I '
      'for insert to authenticated with check (public.is_farm_member(farm_id))',
      table_name
    );
    execute format(
      'create policy "members can update %1$s" on public.%1$I '
      'for update to authenticated using (public.is_farm_member(farm_id)) '
      'with check (public.is_farm_member(farm_id))',
      table_name
    );
    execute format(
      'create policy "members can delete %1$s" on public.%1$I '
      'for delete to authenticated using (public.is_farm_member(farm_id))',
      table_name
    );
  end loop;
end;
$$;

create policy "members can read transactions"
  on public.transactions for select to authenticated
  using (public.is_farm_member(farm_id));

create policy "members can create their transactions"
  on public.transactions for insert to authenticated
  with check (
    public.is_farm_member(farm_id)
    and created_by = (select auth.uid())
  );

create policy "members can update transactions"
  on public.transactions for update to authenticated
  using (public.is_farm_member(farm_id))
  with check (public.is_farm_member(farm_id));

create policy "members can delete transactions"
  on public.transactions for delete to authenticated
  using (public.is_farm_member(farm_id));

-- Financial views are authoritative for application and future AI consumers.
create view public.v_activity_pnl
with (security_invoker = true)
as
with transaction_totals as (
  select
    transaction_id,
    farm_id,
    coalesce(sum(amount), 0::numeric)::numeric(12,3) as total
  from public.transaction_lines
  group by transaction_id, farm_id
), activity_totals as (
  select
    transactions.farm_id,
    transactions.activity_id,
    coalesce(sum(transaction_totals.total)
      filter (where transactions.kind = 'revenu'), 0::numeric)::numeric(12,3) as revenue,
    coalesce(sum(transaction_totals.total)
      filter (where transactions.kind = 'depense'), 0::numeric)::numeric(12,3) as expenses
  from public.transactions
  left join transaction_totals
    on transaction_totals.transaction_id = transactions.id
   and transaction_totals.farm_id = transactions.farm_id
  group by transactions.farm_id, transactions.activity_id
)
select
  activities.farm_id,
  activities.id as activity_id,
  activities.name as activity_name,
  activities.kind as activity_kind,
  coalesce(activity_totals.revenue, 0::numeric)::numeric(12,3) as revenue,
  coalesce(activity_totals.expenses, 0::numeric)::numeric(12,3) as expenses,
  (coalesce(activity_totals.revenue, 0::numeric)
    - coalesce(activity_totals.expenses, 0::numeric))::numeric(12,3) as profit
from public.activities
join public.farms on farms.id = activities.farm_id
left join activity_totals
  on activity_totals.farm_id = activities.farm_id
 and activity_totals.activity_id = activities.id
where not farms.is_demo;

comment on view public.v_activity_pnl is 'Non-demo revenue, expense, and profit totals calculated per activity.';

create view public.v_stock_levels
with (security_invoker = true)
as
select
  products.farm_id,
  products.id as product_id,
  products.name as product_name,
  products.unit,
  products.minimum_stock,
  coalesce(sum(
    case inventory_movements.kind
      when 'entree' then inventory_movements.quantity
      when 'ajustement_positif' then inventory_movements.quantity
      when 'sortie' then -inventory_movements.quantity
      when 'ajustement_negatif' then -inventory_movements.quantity
    end
  ), 0::numeric)::numeric(14,3) as quantity_on_hand
from public.products
join public.farms on farms.id = products.farm_id
left join public.inventory_movements
  on inventory_movements.farm_id = products.farm_id
 and inventory_movements.product_id = products.id
where not farms.is_demo
group by
  products.farm_id,
  products.id,
  products.name,
  products.unit,
  products.minimum_stock;

comment on view public.v_stock_levels is 'Non-demo product stock derived exclusively from inventory movements.';

create view public.v_debts
with (security_invoker = true)
as
with transaction_totals as (
  select
    transaction_id,
    farm_id,
    coalesce(sum(amount), 0::numeric)::numeric(12,3) as total
  from public.transaction_lines
  group by transaction_id, farm_id
), payment_totals as (
  select
    transaction_id,
    farm_id,
    coalesce(sum(amount), 0::numeric)::numeric(12,3) as paid
  from public.payments
  group by transaction_id, farm_id
)
select
  transactions.farm_id,
  transactions.id as transaction_id,
  transactions.transaction_date,
  transactions.kind as transaction_kind,
  case transactions.kind
    when 'revenu' then 'a_recevoir'
    when 'depense' then 'a_payer'
  end as debt_kind,
  transactions.party_id,
  parties.name as party_name,
  coalesce(transaction_totals.total, 0::numeric)::numeric(12,3) as total_amount,
  coalesce(payment_totals.paid, 0::numeric)::numeric(12,3) as paid_amount,
  greatest(
    coalesce(transaction_totals.total, 0::numeric)
      - coalesce(payment_totals.paid, 0::numeric),
    0::numeric
  )::numeric(12,3) as outstanding_amount
from public.transactions
join public.farms on farms.id = transactions.farm_id
left join public.parties
  on parties.id = transactions.party_id
 and parties.farm_id = transactions.farm_id
left join transaction_totals
  on transaction_totals.transaction_id = transactions.id
 and transaction_totals.farm_id = transactions.farm_id
left join payment_totals
  on payment_totals.transaction_id = transactions.id
 and payment_totals.farm_id = transactions.farm_id
where not farms.is_demo
  and coalesce(transaction_totals.total, 0::numeric)
    > coalesce(payment_totals.paid, 0::numeric);

comment on view public.v_debts is 'Non-demo outstanding customer receivables and supplier payables.';

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on table
  public.profiles,
  public.farms,
  public.farm_members,
  public.activities,
  public.plots,
  public.crop_cycles,
  public.animal_groups,
  public.animal_events,
  public.parties,
  public.products,
  public.inventory_movements,
  public.transactions,
  public.transaction_lines,
  public.payments,
  public.tasks
to authenticated;

grant select on table
  public.v_activity_pnl,
  public.v_stock_levels,
  public.v_debts
to authenticated;
