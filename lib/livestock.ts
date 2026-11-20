import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Locale } from "@/i18n/config";
import { getActivityOptions } from "@/lib/activities";
import type { ActivityOption, DatabaseResult } from "@/lib/activity-service";
import { escapeActivitySearch } from "@/lib/activity-validation";
import { getCurrentWorkspace } from "@/lib/workspace";
import { createClient } from "@/utils/supabase/server";
import { createLivestockService, type AnimalGroup, type AnimalEvent, type AnimalBalance,
  type RecentAnimalEvent, type LivestockLedgerLine, type LivestockRepository } from "@/lib/livestock-service";
import { LIVESTOCK_PAGE_SIZE } from "@/lib/livestock-validation";
import type { TaskRecord } from "@/lib/task-service";

const groupColumns = "id, name, species, opening_count, activity_id, is_active, created_at, updated_at";
const eventColumns = "id, animal_group_id, kind, event_date, quantity, notes, created_at";

async function allPages<T>(read: (start: number, end: number) => PromiseLike<DatabaseResult<T[]> & { count: number | null }>): Promise<DatabaseResult<T[]>> {
  const rows: T[] = [];
  for (let start = 0; ; ) {
    const response = await read(start, start + 499);
    if (response.error) return { data: null, error: response.error };
    const page = response.data ?? []; rows.push(...page); start += page.length;
    if (!page.length || (response.count !== null ? start >= response.count : page.length < 500)) return { data: rows, error: null };
  }
}

function createRepository(client: SupabaseClient): LivestockRepository {
  return {
    async list(farmId, filters) {
      let query = client.from("animal_groups").select(groupColumns, { count: "exact" }).eq("farm_id", farmId);
      if (filters.search) query = query.ilike("name", "%" + escapeActivitySearch(filters.search) + "%");
      if (filters.species) query = query.ilike("species", "%" + escapeActivitySearch(filters.species) + "%");
      if (filters.active) query = query.eq("is_active", filters.active === "true");
      const start = (filters.page - 1) * LIVESTOCK_PAGE_SIZE;
      const response = await query.order("name").order("id").range(start, start + LIVESTOCK_PAGE_SIZE - 1).returns<AnimalGroup[]>();
      return { data: { rows: response.data ?? [], count: response.count ?? 0 }, error: response.error };
    },
    async find(farmId, id) {
      return await client.from("animal_groups").select(groupColumns).eq("farm_id", farmId).eq("id", id).maybeSingle<AnimalGroup>();
    },
    allGroups(farmId) {
      return allPages((start, end) => client.from("animal_groups").select(groupColumns, { count: "exact" }).eq("farm_id", farmId).order("id").range(start, end).returns<AnimalGroup[]>());
    },
    async balances(farmId, ids) {
      if (ids?.length === 0) return { data: [], error: null };
      return await allPages((start, end) => {
        let query = client.from("v_animal_group_counts").select("animal_group_id, current_count", { count: "exact" }).eq("farm_id", farmId);
        if (ids) query = query.in("animal_group_id", ids);
        return query.order("animal_group_id").range(start, end).returns<AnimalBalance[]>();
      });
    },
    async insert(farmId, input) {
      return await client.from("animal_groups").insert({ ...input, farm_id: farmId }).select(groupColumns).single<AnimalGroup>();
    },
    async update(farmId, id, input) {
      return await client.from("animal_groups").update(input).eq("farm_id", farmId).eq("id", id).select(groupColumns).maybeSingle<AnimalGroup>();
    },
    async remove(farmId, id) {
      return await client.from("animal_groups").delete().eq("farm_id", farmId).eq("id", id).select("id").maybeSingle<{ id: string }>();
    },
    async activity(farmId, id) {
      return await client.from("activities").select("id, name, is_active").eq("farm_id", farmId).eq("id", id).maybeSingle<ActivityOption>();
    },
    activities(farmId) { return getActivityOptions(client, farmId); },
    async events(farmId, groupId, filters) {
      let query = client.from("animal_events").select(eventColumns, { count: "exact" }).eq("farm_id", farmId).eq("animal_group_id", groupId);
      if (filters.kind) query = query.eq("kind", filters.kind);
      if (filters.from) query = query.gte("event_date", filters.from);
      if (filters.to) query = query.lte("event_date", filters.to);
      const start = (filters.page - 1) * LIVESTOCK_PAGE_SIZE;
      const response = await query.order("event_date", { ascending: false }).order("created_at", { ascending: false }).order("id")
        .range(start, start + LIVESTOCK_PAGE_SIZE - 1).returns<AnimalEvent[]>();
      return { data: { rows: response.data ?? [], count: response.count ?? 0 }, error: response.error };
    },
    async insertEvent(farmId, input) {
      return await client.from("animal_events").insert({ ...input, farm_id: farmId }).select(eventColumns).single<AnimalEvent>();
    },
    async recentEvents(farmId) {
      return await client.from("animal_events").select(eventColumns + ", group:animal_groups(name)").eq("farm_id", farmId)
        .order("event_date", { ascending: false }).order("created_at", { ascending: false }).order("id").limit(5).returns<RecentAnimalEvent[]>();
    },
    async tasks(farmId, groupId) {
      const response = await client.from("tasks").select("id, title, status, due_on", { count: "exact" }).eq("farm_id", farmId).eq("animal_group_id", groupId)
        .order("created_at", { ascending: false }).order("id").limit(10).returns<Array<Pick<TaskRecord, "id" | "title" | "status" | "due_on">>>();
      return { data: { rows: response.data ?? [], count: response.count ?? 0 }, error: response.error };
    },
    async ledger(farmId, groupId, page) {
      // Amount is generated by PostgreSQL on the existing ledger line. Do not
      // infer event prices, or use v_debts (which excludes settled transactions).
      const start = (page - 1) * LIVESTOCK_PAGE_SIZE;
      const response = await client.from("transaction_lines").select(
        "id, description, amount, transaction:transactions!inner(id, kind, transaction_date, reference)", { count: "exact" },
      ).eq("farm_id", farmId).eq("transaction.farm_id", farmId).eq("transaction.animal_group_id", groupId)
        .order("created_at", { ascending: false }).order("id").range(start, start + LIVESTOCK_PAGE_SIZE - 1).returns<LivestockLedgerLine[]>();
      return { data: { rows: response.data ?? [], count: response.count ?? 0 }, error: response.error };
    },
  };
}

export async function getLivestockContext(locale: Locale) {
  const workspace = await getCurrentWorkspace(locale);
  const actor = workspace.farm ? { farmId: workspace.farm.id, role: workspace.role } : null;
  return { workspace, service: createLivestockService(actor, createRepository(await createClient())) };
}
