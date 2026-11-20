import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Locale } from "@/i18n/config";
import { ACTIVITY_PAGE_SIZE, escapeActivitySearch, type ActivityFilterInput } from "@/lib/activity-validation";
import {
  createActivityService, type ActivityRecord, type ActivityRepository,
  type ActivityOption, type DatabaseResult,
} from "@/lib/activity-service";
import { isUuid } from "@/lib/validation";
import { getCurrentWorkspace } from "@/lib/workspace";
import { createClient } from "@/utils/supabase/server";

const columns = "id, name, kind, is_active, created_at, updated_at";

function createRepository(supabase: SupabaseClient): ActivityRepository {
  return {
    async list(farmId, filters) {
      let query = supabase.from("activities").select(columns, { count: "exact" }).eq("farm_id", farmId);
      if (filters.search) query = query.ilike("name", "%" + escapeActivitySearch(filters.search) + "%");
      if (filters.kind) query = query.eq("kind", filters.kind);
      if (filters.active) query = query.eq("is_active", filters.active === "true");
      if (filters.createdFrom) query = query.gte("created_at", filters.createdFrom + "T00:00:00.000Z");
      if (filters.createdTo) query = query.lte("created_at", filters.createdTo + "T23:59:59.999999Z");
      const start = (filters.page - 1) * ACTIVITY_PAGE_SIZE;
      const response = await query.order("created_at", { ascending: false }).order("id", { ascending: false })
        .range(start, start + ACTIVITY_PAGE_SIZE - 1).returns<ActivityRecord[]>();
      return { data: { rows: response.data ?? [], count: response.count ?? 0 }, error: response.error };
    },
    async find(farmId, id) {
      return await supabase.from("activities").select(columns).eq("farm_id", farmId).eq("id", id).maybeSingle<ActivityRecord>();
    },
    async insert(farmId, input) {
      return await supabase.from("activities").insert({ farm_id: farmId, ...input }).select(columns).single<ActivityRecord>();
    },
    async update(farmId, id, input) {
      return await supabase.from("activities").update(input).eq("farm_id", farmId).eq("id", id).select(columns).maybeSingle<ActivityRecord>();
    },
    async remove(farmId, id) {
      return await supabase.from("activities").delete().eq("farm_id", farmId).eq("id", id).select("id").maybeSingle<{ id: string }>();
    },
    async related(farmId, id) {
      const [plots, cycles] = await Promise.all([
        supabase.from("plots").select("id, name", { count: "exact" }).eq("farm_id", farmId).eq("activity_id", id)
          .order("name").order("id").limit(50).returns<Array<{ id: string; name: string }>>(),
        supabase.from("crop_cycles").select("id, crop_name, started_on", { count: "exact" }).eq("farm_id", farmId).eq("activity_id", id)
          .order("started_on", { ascending: false }).order("id").limit(50).returns<Array<{ id: string; crop_name: string; started_on: string }>>(),
      ]);
      return { data: { plots: plots.data ?? [], cycles: cycles.data ?? [], plotCount: plots.count ?? 0, cycleCount: cycles.count ?? 0 }, error: plots.error ?? cycles.error };
    },
    async count(farmId, filter = {}) {
      let query = supabase.from("activities").select("id", { count: "exact", head: true }).eq("farm_id", farmId);
      if (filter.kind) query = query.eq("kind", filter.kind);
      if (filter.active !== undefined) query = query.eq("is_active", filter.active);
      const response = await query;
      return { data: response.count, error: response.error };
    },
  };
}

export async function getActivityContext(locale: Locale) {
  const workspace = await getCurrentWorkspace(locale);
  const supabase = await createClient();
  const actor = workspace.farm ? { farmId: workspace.farm.id, role: workspace.role } : null;
  return { workspace, service: createActivityService(actor, createRepository(supabase)) };
}

export async function listCurrentFarmActivities(locale: Locale, filters: ActivityFilterInput = {}) {
  const { workspace, service } = await getActivityContext(locale);
  return { workspace, result: await service.list(filters) };
}

export async function getCurrentFarmActivity(locale: Locale, id: string) {
  const { workspace, service } = await getActivityContext(locale);
  const result = await service.get(id);
  const related = result.ok ? await service.related(id) : null;
  return { workspace, result, related };
}

// Options include inactive records: they remain valid historical references.
// Fetch in pages so the API's default row limit cannot erase a selected option.
export async function getActivityOptions(supabase: SupabaseClient, farmId: string): Promise<DatabaseResult<ActivityOption[]>> {
  const options: ActivityOption[] = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await supabase.from("activities").select("id, name, is_active").eq("farm_id", farmId)
      .order("name").order("id").range(start, start + 499).returns<ActivityOption[]>();
    if (error) return { data: null, error };
    options.push(...(data ?? []));
    if (!data || data.length < 500) return { data: options, error: null };
  }
}

export async function listCurrentFarmActivityOptions(locale: Locale) {
  const workspace = await getCurrentWorkspace(locale);
  if (!workspace.farm) return { workspace, data: [] as ActivityOption[], error: null };
  const response = await getActivityOptions(await createClient(), workspace.farm.id);
  return { workspace, data: response.data ?? [], error: response.error };
}

export async function isCurrentFarmActivity(supabase: SupabaseClient, farmId: string, id: string | null | undefined) {
  if (id === undefined || id === null) return true;
  if (!isUuid(id)) return false;
  const { data, error } = await supabase.from("activities").select("id").eq("farm_id", farmId).eq("id", id).maybeSingle();
  return !error && data !== null;
}
