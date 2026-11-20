-- Dated field work is separate from economic activity categories.
-- These composite keys let native FKs protect plot/cycle and task farm scope.
alter table public.crop_cycles add constraint crop_cycles_id_farm_plot_key unique (id, farm_id, plot_id);
alter table public.tasks add constraint tasks_id_farm_key unique (id, farm_id);

create table public.agricultural_operations (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  plot_id uuid not null,
  crop_cycle_id uuid,
  activity_id uuid,
  related_task_id uuid,
  expense_line_id uuid unique,
  operation_type text not null check (operation_type in (
    'preparation_sol', 'labour', 'irrigation', 'fertilisation', 'taille', 'plantation', 'recolte', 'autre'
  )),
  performed_on date not null check (performed_on between date '0001-01-01' and date '9999-12-31'),
  description text check (description is null or (length(btrim(description)) > 0 and length(description) <= 240)),
  notes text check (notes is null or length(notes) <= 2000),
  quantity numeric(14,3),
  unit text check (unit in ('kg', 't', 'l', 'm3', 'ha', 'heure', 'unite')),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((quantity is null and unit is null) or (quantity is not null and quantity > 0 and unit is not null)),
  foreign key (plot_id, farm_id) references public.plots(id, farm_id),
  foreign key (crop_cycle_id, farm_id, plot_id) references public.crop_cycles(id, farm_id, plot_id),
  foreign key (activity_id, farm_id) references public.activities(id, farm_id),
  foreign key (related_task_id, farm_id) references public.tasks(id, farm_id) on delete set null (related_task_id),
  foreign key (expense_line_id, farm_id) references public.transaction_lines(id, farm_id)
);

create index agricultural_operations_farm_date_idx on public.agricultural_operations(farm_id, performed_on desc, id);
create index agricultural_operations_plot_date_idx on public.agricultural_operations(farm_id, plot_id, performed_on desc);
create index agricultural_operations_cycle_date_idx on public.agricultural_operations(farm_id, crop_cycle_id, performed_on desc) where crop_cycle_id is not null;
create index agricultural_operations_task_idx on public.agricultural_operations(farm_id, related_task_id) where related_task_id is not null;

create trigger set_agricultural_operations_updated_at before update on public.agricultural_operations
for each row execute function public.set_updated_at();
create trigger prevent_agricultural_operation_creator_change before update of created_by on public.agricultural_operations
for each row execute function public.prevent_created_by_change();

-- Financial attribution references one existing whole expense line. No price,
-- estimated cost or duplicated financial amount is stored on an operation.
create function public.guard_agricultural_operation_expense()
returns trigger language plpgsql set search_path = '' as $$
declare expense record;
begin
  if tg_table_name = 'agricultural_operations' then
    if tg_op = 'UPDATE' and new.farm_id is distinct from old.farm_id then
      raise check_violation using message = 'an agricultural operation cannot change farms';
    end if;
    -- Workers can edit field notes without acquiring financial UPDATE locks.
    -- Changing financial attribution is owner-only; unchanged links are already
    -- protected by the parent guards below, so they need no repeated lock.
    if tg_op = 'UPDATE' and new.expense_line_id is not distinct from old.expense_line_id
      and new.activity_id is not distinct from old.activity_id
      and new.crop_cycle_id is not distinct from old.crop_cycle_id then return new; end if;
    if (new.expense_line_id is not null or (tg_op = 'UPDATE' and old.expense_line_id is not null))
      and public.farm_role(new.farm_id) is distinct from 'owner' then
      raise insufficient_privilege using message = 'only owners can change operation expense attribution';
    end if;
    if new.expense_line_id is not null then
      -- SHARE conflicts with non-key ledger updates. The join locks the header
      -- and line before checking their context; parent guards never lock ops.
      select t.kind, t.activity_id, t.crop_cycle_id, t.animal_group_id into expense
      from public.transaction_lines l
      join public.transactions t on t.id = l.transaction_id and t.farm_id = l.farm_id
      where l.id = new.expense_line_id and l.farm_id = new.farm_id
      for share of t, l;
      if not found then raise foreign_key_violation using message = 'expense line must belong to the same farm'; end if;
      if expense.kind <> 'depense' or expense.animal_group_id is not null
        or expense.activity_id is distinct from new.activity_id
        or (expense.crop_cycle_id is not null and expense.crop_cycle_id is distinct from new.crop_cycle_id) then
        raise check_violation using message = 'expense line does not match the operation category or crop cycle';
      end if;
    end if;
  elsif tg_table_name = 'transactions' then
    if exists (
      select 1 from public.agricultural_operations o
      join public.transaction_lines l on l.id = o.expense_line_id and l.farm_id = o.farm_id
      where l.transaction_id = old.id and l.farm_id = old.farm_id
        and (new.kind <> 'depense' or new.animal_group_id is not null
          or new.activity_id is distinct from o.activity_id
          or (new.crop_cycle_id is not null and new.crop_cycle_id is distinct from o.crop_cycle_id))
    ) then raise check_violation using message = 'ledger change would invalidate an agricultural operation expense link'; end if;
  elsif tg_table_name = 'transaction_lines' then
    if new.transaction_id is distinct from old.transaction_id and exists (
      select 1 from public.agricultural_operations o where o.expense_line_id = old.id and o.farm_id = old.farm_id
    ) then raise check_violation using message = 'unlink an agricultural operation before moving its expense line'; end if;
  end if;
  return new;
end;
$$;

create trigger guard_agricultural_operation_expense before insert or update of farm_id, crop_cycle_id, activity_id, expense_line_id
on public.agricultural_operations for each row execute function public.guard_agricultural_operation_expense();
create trigger guard_transaction_operation_expenses before update of kind, activity_id, crop_cycle_id, animal_group_id
on public.transactions for each row execute function public.guard_agricultural_operation_expense();
create trigger guard_line_operation_expense before update of transaction_id
on public.transaction_lines for each row execute function public.guard_agricultural_operation_expense();
revoke execute on function public.guard_agricultural_operation_expense() from public, anon, authenticated;

alter table public.agricultural_operations enable row level security;
create policy "members can read agricultural operations" on public.agricultural_operations for select to authenticated
using (public.farm_role(farm_id) is not null);
create policy "owners and workers can create agricultural operations" on public.agricultural_operations for insert to authenticated
with check (public.farm_role(farm_id) in ('owner', 'worker') and created_by = (select auth.uid())
  and (expense_line_id is null or public.farm_role(farm_id) = 'owner'));
create policy "owners and workers can update agricultural operations" on public.agricultural_operations for update to authenticated
using (public.farm_role(farm_id) in ('owner', 'worker')) with check (public.farm_role(farm_id) in ('owner', 'worker'));
create policy "owners can delete agricultural operations" on public.agricultural_operations for delete to authenticated
using (public.farm_role(farm_id) = 'owner');

revoke all on public.agricultural_operations from anon;
grant select, insert, delete on public.agricultural_operations to authenticated;
grant update (plot_id, crop_cycle_id, activity_id, related_task_id, expense_line_id, operation_type, performed_on, description, notes, quantity, unit)
on public.agricultural_operations to authenticated;

create view public.v_agricultural_operations with (security_invoker = true) as
select o.*, p.name as plot_name, c.crop_name, a.name as activity_name,
  task.title as task_title, l.description as expense_description, l.amount as expense_amount,
  t.id as expense_transaction_id, t.reference as expense_reference, t.transaction_date as expense_date,
  concat_ws(' ', p.name, c.crop_name, o.description, o.notes) as search_text
from public.agricultural_operations o
join public.plots p on p.id = o.plot_id and p.farm_id = o.farm_id
left join public.crop_cycles c on c.id = o.crop_cycle_id and c.farm_id = o.farm_id
left join public.activities a on a.id = o.activity_id and a.farm_id = o.farm_id
left join public.tasks task on task.id = o.related_task_id and task.farm_id = o.farm_id
left join public.transaction_lines l on l.id = o.expense_line_id and l.farm_id = o.farm_id
left join public.transactions t on t.id = l.transaction_id and t.farm_id = l.farm_id;

create view public.v_agricultural_operation_expenses with (security_invoker = true) as
select l.id, l.farm_id, l.description, l.amount, t.id as transaction_id,
  t.activity_id, t.crop_cycle_id, t.reference, t.transaction_date, o.id as operation_id
from public.transaction_lines l
join public.transactions t on t.id = l.transaction_id and t.farm_id = l.farm_id
left join public.agricultural_operations o on o.expense_line_id = l.id and o.farm_id = l.farm_id
where t.kind = 'depense' and t.animal_group_id is null;

revoke all on public.v_agricultural_operations, public.v_agricultural_operation_expenses from anon;
grant select on public.v_agricultural_operations, public.v_agricultural_operation_expenses to authenticated;
comment on table public.agricultural_operations is 'Dated field work, separate from economic activity categories. Financial links never create ledger entries.';
comment on column public.agricultural_operations.expense_line_id is 'Optional unique attribution of one existing whole expense line; its generated ledger amount remains the source of truth.';
comment on column public.agricultural_operations.activity_id is 'Optional same-farm classification, initially suggested from the crop cycle or plot; no parent is reclassified.';
