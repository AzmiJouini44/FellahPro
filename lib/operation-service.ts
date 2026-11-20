import type { ActivityOption, DatabaseResult } from "./activity-service";
import { isUuid } from "./validation";
import {
  canReadOperations,
  canEditOperations,
  canDeleteOperations,
  canLinkOperationExpenses,
  operationId,
  validateOperationFilters,
  validateOperationInput,
  type OperationRaw,
  type OperationInput,
  type OperationErrors,
  type OperationFilterRaw,
  type OperationFilters,
  type OperationType,
  type OperationUnit,
} from "./operation-validation";

export type OperationRecord = {
  id: string;
  operation_type: OperationType;
  performed_on: string;
  plot_id: string;
  crop_cycle_id: string | null;
  activity_id: string | null;
  related_task_id: string | null;
  expense_line_id: string | null;
  description: string | null;
  notes: string | null;
  quantity: string | number | null;
  unit: OperationUnit | null;
  created_at: string;
  updated_at: string;
};
export type OperationDetail = OperationRecord & {
  plot_name: string;
  crop_name: string | null;
  activity_name: string | null;
  task_title: string | null;
  expense_description: string | null;
  expense_amount: number | string | null;
  expense_transaction_id: string | null;
  expense_reference: string | null;
  expense_date: string | null;
};
export type OperationWrite = Omit<
  OperationRecord,
  "id" | "created_at" | "updated_at"
>;
export type OperationPlot = {
  id: string;
  name: string;
  activity_id: string | null;
};
export type OperationCycle = {
  id: string;
  crop_name: string;
  plot_id: string;
  activity_id: string | null;
  started_on: string;
};
export type OperationTask = {
  id: string;
  title: string;
  crop_cycle_id: string | null;
  activity_id: string | null;
  animal_group_id: string | null;
};
export type OperationExpense = {
  id: string;
  description: string;
  amount: string | number;
  transaction_id: string;
  activity_id: string;
  crop_cycle_id: string | null;
  transaction_date: string;
  reference: string | null;
  operation_id: string | null;
};
export type OperationOptions = {
  plots: OperationPlot[];
  cycles: OperationCycle[];
  activities: ActivityOption[];
  tasks: OperationTask[];
  expenses: OperationExpense[];
};
export type OperationDefaults = {
  plotId: string;
  cycleId: string;
  activityId: string;
  taskId: string;
};
export type OperationActor = {
  farmId: string;
  userId: string;
  role: string | null;
} | null;
export type OperationFailure =
  | "forbidden"
  | "notFound"
  | "invalid"
  | "invalidFilters"
  | "related"
  | "expenseUsed"
  | "failed";
export type OperationResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: OperationFailure; errors?: OperationErrors };
export interface OperationRepository {
  list(
    farmId: string,
    filters: OperationFilters,
  ): Promise<DatabaseResult<{ rows: OperationDetail[]; count: number }>>;
  find(farmId: string, id: string): Promise<DatabaseResult<OperationDetail>>;
  insert(
    farmId: string,
    input: OperationWrite,
  ): Promise<DatabaseResult<{ id: string }>>;
  update(
    farmId: string,
    id: string,
    input: OperationWrite,
  ): Promise<DatabaseResult<{ id: string }>>;
  remove(farmId: string, id: string): Promise<DatabaseResult<{ id: string }>>;
  plot(farmId: string, id: string): Promise<DatabaseResult<OperationPlot>>;
  cycle(farmId: string, id: string): Promise<DatabaseResult<OperationCycle>>;
  activity(farmId: string, id: string): Promise<DatabaseResult<ActivityOption>>;
  task(farmId: string, id: string): Promise<DatabaseResult<OperationTask>>;
  expense(
    farmId: string,
    id: string,
  ): Promise<DatabaseResult<OperationExpense>>;
  locations(
    farmId: string,
  ): Promise<DatabaseResult<Pick<OperationOptions, "plots" | "cycles">>>;
  options(
    farmId: string,
    operationId?: string,
    includeExpenses?: boolean,
  ): Promise<DatabaseResult<OperationOptions>>;
}
async function safe<T>(
  call: () => Promise<DatabaseResult<T>>,
): Promise<DatabaseResult<T>> {
  try {
    return await call();
  } catch {
    return { data: null, error: { code: "network" } };
  }
}
function result<T>(value: DatabaseResult<T>): OperationResult<T> {
  if (value.error) {
    if (value.error.code === "23505")
      return {
        ok: false,
        reason: "expenseUsed",
        errors: { expenseLineId: "used" },
      };
    return {
      ok: false,
      reason: ["23503", "23514"].includes(value.error.code)
        ? "related"
        : "failed",
    };
  }
  return value.data === null
    ? { ok: false, reason: "notFound" }
    : { ok: true, data: value.data };
}

export function createOperationService(
  actor: OperationActor,
  repository: OperationRepository,
  now: () => Date = () => new Date(),
) {
  const readable =
    actor !== null &&
    isUuid(actor.farmId) &&
    isUuid(actor.userId) &&
    canReadOperations(actor.role);
  const editable = readable && canEditOperations(actor!.role);
  const denied = { ok: false, reason: "forbidden" } as const;
  const failed = { ok: false, reason: "failed" } as const;
  async function parent(id: string): Promise<OperationResult<OperationDetail>> {
    if (!readable) return denied;
    if (!isUuid(id)) return { ok: false, reason: "notFound" };
    return result(await safe(() => repository.find(actor!.farmId, id)));
  }
  async function resolve(
    input: OperationInput,
    operationId?: string,
  ): Promise<OperationResult<OperationWrite>> {
    const farm = actor!.farmId;
    const plot = await safe(() => repository.plot(farm, input.plotId));
    if (plot.error) return failed;
    if (!plot.data)
      return { ok: false, reason: "invalid", errors: { plotId: "invalid" } };
    if (input.cycleId) {
      const cycle = await safe(() => repository.cycle(farm, input.cycleId!));
      if (cycle.error) return failed;
      if (!cycle.data || cycle.data.plot_id !== plot.data.id)
        return {
          ok: false,
          reason: "invalid",
          errors: { cycleId: "mismatch" },
        };
    }
    if (input.activityId) {
      const activity = await safe(() =>
        repository.activity(farm, input.activityId!),
      );
      if (activity.error) return failed;
      if (!activity.data)
        return {
          ok: false,
          reason: "invalid",
          errors: { activityId: "invalid" },
        };
    }
    if (input.taskId) {
      const task = await safe(() => repository.task(farm, input.taskId!));
      if (task.error) return failed;
      if (!task.data)
        return { ok: false, reason: "invalid", errors: { taskId: "invalid" } };
    }
    if (input.expenseLineId) {
      const expense = await safe(() =>
        repository.expense(farm, input.expenseLineId!),
      );
      if (expense.error) return failed;
      if (!expense.data)
        return {
          ok: false,
          reason: "invalid",
          errors: { expenseLineId: "invalid" },
        };
      if (
        expense.data.operation_id &&
        expense.data.operation_id !== operationId
      )
        return {
          ok: false,
          reason: "expenseUsed",
          errors: { expenseLineId: "used" },
        };
      if (
        expense.data.activity_id !== input.activityId ||
        (expense.data.crop_cycle_id &&
          expense.data.crop_cycle_id !== input.cycleId)
      ) {
        return {
          ok: false,
          reason: "invalid",
          errors: { expenseLineId: "mismatch" },
        };
      }
    }
    return {
      ok: true,
      data: {
        operation_type: input.operationType,
        performed_on: input.performedOn,
        plot_id: plot.data.id,
        crop_cycle_id: input.cycleId,
        activity_id: input.activityId,
        related_task_id: input.taskId,
        expense_line_id: input.expenseLineId,
        description: input.description,
        notes: input.notes,
        quantity: input.quantity,
        unit: input.unit,
      },
    };
  }
  return {
    get: parent,
    async list(
      raw: OperationFilterRaw = {},
    ): Promise<
      OperationResult<{
        rows: OperationDetail[];
        count: number;
        filters: OperationFilters;
      }>
    > {
      if (!readable) return denied;
      const filters = validateOperationFilters(raw);
      if (!filters) return { ok: false, reason: "invalidFilters" };
      if (filters.plotId) {
        const plot = await safe(() =>
          repository.plot(actor!.farmId, filters.plotId),
        );
        if (plot.error) return failed;
        if (!plot.data) return { ok: false, reason: "invalidFilters" };
      }
      if (filters.cycleId) {
        const cycle = await safe(() =>
          repository.cycle(actor!.farmId, filters.cycleId),
        );
        if (cycle.error) return failed;
        if (
          !cycle.data ||
          (filters.plotId && cycle.data.plot_id !== filters.plotId)
        )
          return { ok: false, reason: "invalidFilters" };
        filters.plotId = cycle.data.plot_id;
      }
      if (filters.taskId) {
        const task = await safe(() =>
          repository.task(actor!.farmId, filters.taskId),
        );
        if (task.error) return failed;
        if (!task.data) return { ok: false, reason: "invalidFilters" };
      }
      const response = result(
        await safe(() => repository.list(actor!.farmId, filters)),
      );
      return response.ok
        ? { ok: true, data: { ...response.data, filters } }
        : response;
    },
    async create(raw: OperationRaw): Promise<OperationResult<{ id: string }>> {
      if (!editable) return denied;
      const validated = validateOperationInput(raw, now());
      if (!validated.success)
        return { ok: false, reason: "invalid", errors: validated.errors };
      if (
        validated.data.expenseLineId &&
        !canLinkOperationExpenses(actor!.role)
      )
        return denied;
      const input = await resolve(validated.data);
      return input.ok
        ? result(await safe(() => repository.insert(actor!.farmId, input.data)))
        : input;
    },
    async update(
      id: string,
      raw: OperationRaw,
    ): Promise<OperationResult<{ id: string }>> {
      if (!editable) return denied;
      const existing = await parent(id);
      if (!existing.ok) return existing;
      const validated = validateOperationInput(raw, now());
      if (!validated.success)
        return { ok: false, reason: "invalid", errors: validated.errors };
      if (
        !canLinkOperationExpenses(actor!.role) &&
        (validated.data.expenseLineId !== existing.data.expense_line_id ||
          (existing.data.expense_line_id &&
            (validated.data.activityId !== existing.data.activity_id ||
              validated.data.cycleId !== existing.data.crop_cycle_id)))
      )
        return denied;
      const input = await resolve(validated.data, existing.data.id);
      return input.ok
        ? result(
            await safe(() =>
              repository.update(actor!.farmId, existing.data.id, input.data),
            ),
          )
        : input;
    },
    async remove(id: string): Promise<OperationResult<{ id: string }>> {
      if (!readable || !canDeleteOperations(actor!.role)) return denied;
      const existing = await parent(id);
      return existing.ok
        ? result(
            await safe(() =>
              repository.remove(actor!.farmId, existing.data.id),
            ),
          )
        : existing;
    },
    async options(id?: string): Promise<OperationResult<OperationOptions>> {
      if (!readable) return denied;
      if (id !== undefined) {
        const existing = await parent(id);
        if (!existing.ok) return existing;
      }
      return result(
        await safe(() =>
          repository.options(
            actor!.farmId,
            id,
            canLinkOperationExpenses(actor!.role),
          ),
        ),
      );
    },
    async locations(): Promise<
      OperationResult<Pick<OperationOptions, "plots" | "cycles">>
    > {
      if (!readable) return denied;
      return result(await safe(() => repository.locations(actor!.farmId)));
    },
    async defaults(
      raw: { plotId?: unknown; cycleId?: unknown; taskId?: unknown } = {},
    ): Promise<OperationResult<OperationDefaults>> {
      if (!editable) return denied;
      let plotId = operationId(raw.plotId);
      let cycleId = operationId(raw.cycleId);
      const taskId = operationId(raw.taskId);
      if (plotId === undefined || cycleId === undefined || taskId === undefined)
        return { ok: false, reason: "notFound" };
      let activityId: string | null = null;
      if (taskId) {
        const task = await safe(() => repository.task(actor!.farmId, taskId));
        if (task.error) return failed;
        if (!task.data) return { ok: false, reason: "notFound" };
        cycleId ||= task.data.crop_cycle_id;
        activityId = task.data.activity_id;
      }
      if (cycleId) {
        const cycle = await safe(() =>
          repository.cycle(actor!.farmId, cycleId!),
        );
        if (cycle.error) return failed;
        if (!cycle.data || (plotId && plotId !== cycle.data.plot_id))
          return { ok: false, reason: "notFound" };
        plotId = cycle.data.plot_id;
        activityId ??= cycle.data.activity_id;
      }
      if (plotId) {
        const plot = await safe(() => repository.plot(actor!.farmId, plotId!));
        if (plot.error) return failed;
        if (!plot.data) return { ok: false, reason: "notFound" };
        if (!cycleId) activityId ??= plot.data.activity_id;
      }
      return {
        ok: true,
        data: {
          plotId: plotId || "",
          cycleId: cycleId || "",
          activityId: activityId || "",
          taskId: taskId || "",
        },
      };
    },
  };
}
