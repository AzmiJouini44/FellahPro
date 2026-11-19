-- Mission 3B exposes crop cycles before the Activities UI exists. Keep an
-- existing plot activity when one is available, but allow standalone cycles
-- until Mission 3C can assign an activity explicitly.
alter table public.crop_cycles
  alter column activity_id drop not null;

-- The initial schema had one ambiguous end date. Preserve existing data while
-- separating planning from the actual harvest date used by completed cycles.
alter table public.crop_cycles
  rename column ended_on to actual_harvest_on;

alter table public.crop_cycles
  drop constraint crop_cycles_check;

alter table public.crop_cycles
  add column expected_harvest_on date,
  add column cultivated_area_hectares numeric(12,3),
  add column notes text;

update public.crop_cycles as crop_cycle
set
  expected_harvest_on = coalesce(crop_cycle.actual_harvest_on, crop_cycle.started_on),
  cultivated_area_hectares = plot.area_hectares
from public.plots as plot
where plot.id = crop_cycle.plot_id
  and plot.farm_id = crop_cycle.farm_id;

update public.crop_cycles
set actual_harvest_on = null
where status <> 'completed';

update public.crop_cycles
set actual_harvest_on = expected_harvest_on
where status = 'completed'
  and actual_harvest_on is null;

alter table public.crop_cycles
  alter column expected_harvest_on set not null,
  alter column cultivated_area_hectares set default 0,
  alter column cultivated_area_hectares set not null,
  add constraint crop_cycles_expected_harvest_check
    check (expected_harvest_on >= started_on),
  add constraint crop_cycles_actual_harvest_check
    check (actual_harvest_on is null or actual_harvest_on >= started_on),
  add constraint crop_cycles_completed_harvest_check
    check (status <> 'completed' or actual_harvest_on is not null),
  add constraint crop_cycles_actual_status_check
    check (actual_harvest_on is null or status = 'completed'),
  add constraint crop_cycles_cultivated_area_check
    check (cultivated_area_hectares >= 0),
  add constraint crop_cycles_notes_length_check
    check (notes is null or length(notes) <= 2000);

create index crop_cycles_farm_status_idx
  on public.crop_cycles (farm_id, status);

create index crop_cycles_farm_plot_idx
  on public.crop_cycles (farm_id, plot_id);

create or replace function public.enforce_crop_cycle_plot_area()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  plot_area numeric(12,3);
begin
  select plots.area_hectares
  into plot_area
  from public.plots
  where plots.id = new.plot_id
    and plots.farm_id = new.farm_id
  for key share;

  if not found then
    raise foreign_key_violation using
      message = 'crop cycle plot must belong to the same farm';
  end if;

  if new.cultivated_area_hectares > plot_area then
    raise check_violation using
      message = 'cultivated area cannot exceed plot area';
  end if;

  return new;
end;
$$;

create trigger enforce_crop_cycle_plot_area
before insert or update of farm_id, plot_id, cultivated_area_hectares
on public.crop_cycles
for each row execute function public.enforce_crop_cycle_plot_area();

-- Keep the invariant true when a plot is resized as well. The plot row lock
-- serializes this check with concurrent crop-cycle writes.
create or replace function public.guard_plot_area_for_crop_cycles()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.crop_cycles
    where crop_cycles.farm_id = old.farm_id
      and crop_cycles.plot_id = old.id
      and crop_cycles.cultivated_area_hectares > new.area_hectares
  ) then
    raise check_violation using
      message = 'plot area cannot be smaller than an existing crop cycle area';
  end if;

  return new;
end;
$$;

create trigger guard_plot_area_for_crop_cycles
before update of area_hectares
on public.plots
for each row execute function public.guard_plot_area_for_crop_cycles();

revoke execute on function public.enforce_crop_cycle_plot_area()
  from public, anon, authenticated;
revoke execute on function public.guard_plot_area_for_crop_cycles()
  from public, anon, authenticated;

comment on column public.crop_cycles.activity_id is
  'Optional until a cultivation activity is assigned; preserved from the selected plot when available.';
comment on column public.crop_cycles.expected_harvest_on is
  'Farmer-planned harvest date, never earlier than planting.';
comment on column public.crop_cycles.actual_harvest_on is
  'Observed harvest date; required when a cycle is completed.';
comment on column public.crop_cycles.cultivated_area_hectares is
  'Area used by this cycle, constrained not to exceed its plot area.';
