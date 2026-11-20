import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Locale } from "@/i18n/config";
import { getActivityOptions } from "@/lib/activities";
import { escapeActivitySearch } from "@/lib/activity-validation";
import type { ActivityOption, DatabaseResult } from "@/lib/activity-service";
import {
  createTaskService, type TaskRecord, type TaskRepository, type TaskMember,
  type TaskCycle, type TaskGroup,
} from "@/lib/task-service";
import { TASK_PAGE_SIZE, type TaskFilterInput, type TaskQuery } from "@/lib/task-validation";
import { getCurrentWorkspace } from "@/lib/workspace";
import { createClient } from "@/utils/supabase/server";

const columns = "id, title, description, due_on, status, priority, activity_id, crop_cycle_id, animal_group_id, assigned_to, created_at, updated_at";
type MemberRow = { user_id: string; role: string; profile: { full_name: string | null } | null };
type Page<T> = DatabaseResult<T[]> & { count?: number | null };

async function readPages<T>(read: (start: number, end: number) => PromiseLike<Page<T>>): Promise<DatabaseResult<T[]>> {
  const rows: T[] = [];
  for (let start = 0; ; ) {
    const page = await read(start, start + 499);
    if (page.error) return { data: null, error: page.error };
    const data = page.data ?? [];
    rows.push(...data);
    start += data.length;
    if (!data.length || (page.count !== null && page.count !== undefined ? start >= page.count : data.length < 500)) {
      return { data: rows, error: null };
    }
  }
}

function memberOption(row: MemberRow): TaskMember {
  return { id: row.user_id, name: row.profile?.full_name ?? null, role: row.role };
}

function createRepository(client: SupabaseClient): TaskRepository {
  function query(farmId: string, filters: TaskQuery, head = false) {
    let request = client.from("tasks").select(columns, { count: "exact", head }).eq("farm_id", farmId);
    if (filters.search) request = request.ilike("title", "%" + escapeActivitySearch(filters.search) + "%");
    if (filters.status) request = request.eq("status", filters.status);
    if (filters.priority) request = request.eq("priority", filters.priority);
    if (filters.animalGroupId) request = request.eq("animal_group_id", filters.animalGroupId);
    if (filters.pendingOnly) request = request.in("status", ["a_faire", "en_cours"]);
    if (filters.assignedTo === null) request = request.is("assigned_to", null);
    else if (filters.assignedTo !== undefined) request = request.eq("assigned_to", filters.assignedTo);
    if (filters.dueFrom) request = request.gte("due_on", filters.dueFrom);
    if (filters.dueTo) request = request.lte("due_on", filters.dueTo);
    if (filters.dueBefore) request = request.lt("due_on", filters.dueBefore);
    return request;
  }

  async function members(farmId: string): Promise<DatabaseResult<TaskMember[]>> {
    const response = await readPages((start, end) =>
      client.from("farm_members").select("user_id, role, profile:profiles(full_name)", { count: "exact" })
        .eq("farm_id", farmId).order("user_id").range(start, end).returns<MemberRow[]>());
    return { data: response.data?.map(memberOption) ?? null, error: response.error };
  }

  return {
    async list(farmId, filters) {
      const start = ((filters.page ?? 1) - 1) * TASK_PAGE_SIZE;
      const response = await query(farmId, filters)
        .order("due_on", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false }).order("id")
        .range(start, start + TASK_PAGE_SIZE - 1).returns<TaskRecord[]>();
      return { data: { rows: response.data ?? [], count: response.count ?? 0 }, error: response.error };
    },
    async find(farmId, id) {
      return await client.from("tasks").select(columns).eq("farm_id", farmId).eq("id", id).maybeSingle<TaskRecord>();
    },
    async insert(farmId, input) {
      return await client.from("tasks").insert({ ...input, farm_id: farmId }).select(columns).single<TaskRecord>();
    },
    async update(farmId, id, input) {
      return await client.from("tasks").update(input).eq("farm_id", farmId).eq("id", id).select(columns).maybeSingle<TaskRecord>();
    },
    async remove(farmId, id) {
      return await client.from("tasks").delete().eq("farm_id", farmId).eq("id", id).select("id").maybeSingle<{ id: string }>();
    },
    async count(farmId, filters) {
      const response = await query(farmId, filters, true);
      return { data: response.count, error: response.error };
    },
    async activity(farmId, id) {
      return await client.from("activities").select("id, name, is_active").eq("farm_id", farmId).eq("id", id).maybeSingle<ActivityOption>();
    },
    async cycle(farmId, id) {
      return await client.from("crop_cycles").select("id, crop_name, started_on, activity_id").eq("farm_id", farmId).eq("id", id).maybeSingle<TaskCycle>();
    },
    async group(farmId, id) {
      return await client.from("animal_groups").select("id, name, activity_id").eq("farm_id", farmId).eq("id", id).maybeSingle<TaskGroup>();
    },
    async member(farmId, id) {
      const response = await client.from("farm_members").select("user_id, role, profile:profiles(full_name)")
        .eq("farm_id", farmId).eq("user_id", id).maybeSingle<MemberRow>();
      return { data: response.data ? memberOption(response.data) : null, error: response.error };
    },
    members,
    async options(farmId) {
      const [activities, cycles, groups, team] = await Promise.all([
        getActivityOptions(client, farmId),
        readPages((start, end) => client.from("crop_cycles").select("id, crop_name, started_on, activity_id", { count: "exact" })
          .eq("farm_id", farmId).order("started_on", { ascending: false }).order("id").range(start, end).returns<TaskCycle[]>()),
        readPages((start, end) => client.from("animal_groups").select("id, name, activity_id", { count: "exact" })
          .eq("farm_id", farmId).order("name").order("id").range(start, end).returns<TaskGroup[]>()),
        members(farmId),
      ]);
      return { data: {
        activities: activities.data ?? [], cycles: cycles.data ?? [], groups: groups.data ?? [], members: team.data ?? [],
      }, error: activities.error ?? cycles.error ?? groups.error ?? team.error };
    },
  };
}

export async function getTaskContext(locale: Locale) {
  const workspace = await getCurrentWorkspace(locale);
  const actor = workspace.farm ? { farmId: workspace.farm.id, userId: workspace.user.id, role: workspace.role } : null;
  return { workspace, service: createTaskService(actor, createRepository(await createClient())) };
}

export async function listCurrentFarmTasks(locale: Locale, filters: TaskFilterInput) {
  const { workspace, service } = await getTaskContext(locale);
  const [result, members] = await Promise.all([service.list(filters), service.members()]);
  return { workspace, result, members };
}

export async function getCurrentFarmTask(locale: Locale, id: string) {
  const { workspace, service } = await getTaskContext(locale);
  return { workspace, result: await service.get(id) };
}
