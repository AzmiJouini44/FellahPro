import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Locale } from "@/i18n/config";
import type { ActivityOption, DatabaseResult } from "@/lib/activity-service";
import { escapeActivitySearch } from "@/lib/activity-validation";
import {
  createOperationService,
  type OperationRepository,
  type OperationDetail,
  type OperationPlot,
  type OperationCycle,
  type OperationTask,
  type OperationExpense,
} from "@/lib/operation-service";
import { OPERATION_PAGE_SIZE } from "@/lib/operation-validation";
import { getCurrentWorkspace } from "@/lib/workspace";
import { createClient } from "@/utils/supabase/server";

const columns =
  "id, operation_type, performed_on, plot_id, crop_cycle_id, activity_id, related_task_id, expense_line_id, description, notes, quantity, unit, created_at, updated_at, plot_name, crop_name, activity_name, task_title, expense_description, expense_amount, expense_transaction_id, expense_reference, expense_date";
const expenseColumns =
  "id, description, amount, transaction_id, activity_id, crop_cycle_id, transaction_date, reference, operation_id";
async function allPages<T>(
  read: (
    start: number,
    end: number,
  ) => PromiseLike<DatabaseResult<T[]> & { count: number | null }>,
): Promise<DatabaseResult<T[]>> {
  const rows: T[] = [];
  for (let start = 0; ; ) {
    const response = await read(start, start + 499);
    if (response.error) return { data: null, error: response.error };
    const page = response.data ?? [];
    rows.push(...page);
    start += page.length;
    if (
      !page.length ||
      (response.count !== null ? start >= response.count : page.length < 500)
    )
      return { data: rows, error: null };
  }
}
function createRepository(client: SupabaseClient): OperationRepository {
  async function locations(farm: string) {
    const [plots, cycles] = await Promise.all([
      allPages((start, end) =>
        client
          .from("plots")
          .select("id, name, activity_id", { count: "exact" })
          .eq("farm_id", farm)
          .order("name")
          .order("id")
          .range(start, end)
          .returns<OperationPlot[]>(),
      ),
      allPages((start, end) =>
        client
          .from("crop_cycles")
          .select("id, crop_name, plot_id, activity_id, started_on", {
            count: "exact",
          })
          .eq("farm_id", farm)
          .order("started_on", { ascending: false })
          .order("id")
          .range(start, end)
          .returns<OperationCycle[]>(),
      ),
    ]);
    return {
      data: { plots: plots.data ?? [], cycles: cycles.data ?? [] },
      error: plots.error ?? cycles.error,
    };
  }
  return {
    locations,
    async list(farm, filters) {
      let query = client
        .from("v_agricultural_operations")
        .select(columns, { count: "exact" })
        .eq("farm_id", farm);
      if (filters.search)
        query = query.ilike(
          "search_text",
          "%" + escapeActivitySearch(filters.search) + "%",
        );
      if (filters.type) query = query.eq("operation_type", filters.type);
      if (filters.from) query = query.gte("performed_on", filters.from);
      if (filters.to) query = query.lte("performed_on", filters.to);
      if (filters.plotId) query = query.eq("plot_id", filters.plotId);
      if (filters.cycleId) query = query.eq("crop_cycle_id", filters.cycleId);
      if (filters.taskId) query = query.eq("related_task_id", filters.taskId);
      const start = (filters.page - 1) * OPERATION_PAGE_SIZE;
      const response = await query
        .order("performed_on", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id")
        .range(start, start + OPERATION_PAGE_SIZE - 1)
        .returns<OperationDetail[]>();
      return {
        data: { rows: response.data ?? [], count: response.count ?? 0 },
        error: response.error,
      };
    },
    async find(farm, id) {
      return await client
        .from("v_agricultural_operations")
        .select(columns)
        .eq("farm_id", farm)
        .eq("id", id)
        .maybeSingle<OperationDetail>();
    },
    async insert(farm, input) {
      return await client
        .from("agricultural_operations")
        .insert({ ...input, farm_id: farm })
        .select("id")
        .single<{ id: string }>();
    },
    async update(farm, id, input) {
      return await client
        .from("agricultural_operations")
        .update(input)
        .eq("farm_id", farm)
        .eq("id", id)
        .select("id")
        .maybeSingle<{ id: string }>();
    },
    async remove(farm, id) {
      return await client
        .from("agricultural_operations")
        .delete()
        .eq("farm_id", farm)
        .eq("id", id)
        .select("id")
        .maybeSingle<{ id: string }>();
    },
    async plot(farm, id) {
      return await client
        .from("plots")
        .select("id, name, activity_id")
        .eq("farm_id", farm)
        .eq("id", id)
        .maybeSingle<OperationPlot>();
    },
    async cycle(farm, id) {
      return await client
        .from("crop_cycles")
        .select("id, crop_name, plot_id, activity_id, started_on")
        .eq("farm_id", farm)
        .eq("id", id)
        .maybeSingle<OperationCycle>();
    },
    async activity(farm, id) {
      return await client
        .from("activities")
        .select("id, name, is_active")
        .eq("farm_id", farm)
        .eq("id", id)
        .maybeSingle<ActivityOption>();
    },
    async task(farm, id) {
      return await client
        .from("tasks")
        .select("id, title, crop_cycle_id, activity_id, animal_group_id")
        .eq("farm_id", farm)
        .eq("id", id)
        .maybeSingle<OperationTask>();
    },
    async expense(farm, id) {
      return await client
        .from("v_agricultural_operation_expenses")
        .select(expenseColumns)
        .eq("farm_id", farm)
        .eq("id", id)
        .maybeSingle<OperationExpense>();
    },
    async options(farm, id, includeExpenses = false) {
      const [places, activities, tasks, expenses] = await Promise.all([
        locations(farm),
        allPages((start, end) =>
          client
            .from("activities")
            .select("id, name, is_active", { count: "exact" })
            .eq("farm_id", farm)
            .order("name")
            .order("id")
            .range(start, end)
            .returns<ActivityOption[]>(),
        ),
        allPages((start, end) =>
          client
            .from("tasks")
            .select("id, title, crop_cycle_id, activity_id, animal_group_id", {
              count: "exact",
            })
            .eq("farm_id", farm)
            .order("title")
            .order("id")
            .range(start, end)
            .returns<OperationTask[]>(),
        ),
        includeExpenses
          ? allPages((start, end) => {
              let query = client
                .from("v_agricultural_operation_expenses")
                .select(expenseColumns, { count: "exact" })
                .eq("farm_id", farm);
              query = id
                ? query.or("operation_id.is.null,operation_id.eq." + id)
                : query.is("operation_id", null);
              return query
                .order("transaction_date", { ascending: false })
                .order("id")
                .range(start, end)
                .returns<OperationExpense[]>();
            })
          : Promise.resolve({ data: [] as OperationExpense[], error: null }),
      ]);
      return {
        data: {
          plots: places.data.plots,
          cycles: places.data.cycles,
          activities: activities.data ?? [],
          tasks: tasks.data ?? [],
          expenses: expenses.data ?? [],
        },
        error:
          places.error ?? activities.error ?? tasks.error ?? expenses.error,
      };
    },
  };
}
export async function getOperationContext(locale: Locale) {
  const workspace = await getCurrentWorkspace(locale);
  const actor = workspace.farm
    ? {
        farmId: workspace.farm.id,
        userId: workspace.user.id,
        role: workspace.role,
      }
    : null;
  return {
    workspace,
    service: createOperationService(
      actor,
      createRepository(await createClient()),
    ),
  };
}
