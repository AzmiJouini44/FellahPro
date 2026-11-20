import type { ActivityOption, DatabaseResult } from "./activity-service";
import { isUuid } from "./validation";
import {
  canReadTasks, canEditTasks, canDeleteTasks, getTaskDates, isTaskStatus,
  taskQuery, validateTaskFilters, validateTaskInput,
  type RawTaskInput, type TaskErrors, type TaskFilters, type TaskFilterInput,
  type TaskStatus, type TaskPriority, type TaskInput, type TaskQuery, type TaskDates,
} from "./task-validation";

export type TaskRecord = {
  id: string; title: string; description: string | null; due_on: string | null;
  status: TaskStatus; priority: TaskPriority; activity_id: string | null;
  crop_cycle_id: string | null; animal_group_id: string | null; assigned_to: string | null;
  created_at: string; updated_at: string;
};
export type TaskWrite = Omit<TaskRecord, "id" | "created_at" | "updated_at">;
export type TaskMember = { id: string; name: string | null; role: string };
export type TaskCycle = { id: string; crop_name: string; started_on: string; activity_id: string | null };
export type TaskGroup = { id: string; name: string; activity_id: string };
export type TaskOptions = { activities: ActivityOption[]; cycles: TaskCycle[]; groups: TaskGroup[]; members: TaskMember[] };
export type TaskDetail = TaskRecord & {
  activity: ActivityOption | null; cycle: TaskCycle | null; group: TaskGroup | null; member: TaskMember | null;
};
export type TaskActor = { farmId: string; userId: string; role: string | null } | null;
export type TaskFailure = "forbidden" | "notFound" | "invalid" | "invalidFilters" | "related" | "failed";
export type TaskResult<T> = { ok: true; data: T } | { ok: false; reason: TaskFailure; errors?: TaskErrors };
export type TaskSummary = { pending: number; dueToday: number; overdue: number; completed: number; upcoming: number; dates: TaskDates };
export type TaskList = { rows: TaskRecord[]; count: number; filters: TaskFilters; dates: TaskDates };

export interface TaskRepository {
  list(farmId: string, query: TaskQuery): Promise<DatabaseResult<{ rows: TaskRecord[]; count: number }>>;
  find(farmId: string, id: string): Promise<DatabaseResult<TaskRecord>>;
  insert(farmId: string, input: TaskWrite): Promise<DatabaseResult<TaskRecord>>;
  update(farmId: string, id: string, input: Partial<TaskWrite>): Promise<DatabaseResult<TaskRecord>>;
  remove(farmId: string, id: string): Promise<DatabaseResult<{ id: string }>>;
  count(farmId: string, query: TaskQuery): Promise<DatabaseResult<number>>;
  activity(farmId: string, id: string): Promise<DatabaseResult<ActivityOption>>;
  cycle(farmId: string, id: string): Promise<DatabaseResult<TaskCycle>>;
  group(farmId: string, id: string): Promise<DatabaseResult<TaskGroup>>;
  member(farmId: string, id: string): Promise<DatabaseResult<TaskMember>>;
  members(farmId: string): Promise<DatabaseResult<TaskMember[]>>;
  options(farmId: string): Promise<DatabaseResult<TaskOptions>>;
}

async function safe<T>(call: () => Promise<DatabaseResult<T>>): Promise<DatabaseResult<T>> {
  try { return await call(); } catch { return { data: null, error: { code: "network" } }; }
}
function result<T>(response: DatabaseResult<T>): TaskResult<T> {
  if (response.error) return { ok: false, reason: ["23503", "23514"].includes(response.error.code) ? "related" : "failed" };
  return response.data === null ? { ok: false, reason: "notFound" } : { ok: true, data: response.data };
}

export function createTaskService(actor: TaskActor, repository: TaskRepository, now: () => Date = () => new Date()) {
  const readable = actor !== null && isUuid(actor.farmId) && isUuid(actor.userId) && canReadTasks(actor.role);
  const editable = readable && canEditTasks(actor!.role);
  const denied = { ok: false, reason: "forbidden" } as const;

  async function resolveWrite(input: TaskInput): Promise<TaskResult<TaskWrite>> {
    const farmId = actor!.farmId;
    let activityId = input.activityId;
    if (input.cropCycleId) {
      const response = await safe(() => repository.cycle(farmId, input.cropCycleId!));
      if (response.error) return { ok: false, reason: "failed" };
      if (!response.data) return { ok: false, reason: "invalid", errors: { cropCycleId: "invalid" } };
      if (!response.data.activity_id) return { ok: false, reason: "invalid", errors: { cropCycleId: "unclassified" } };
      if (activityId && activityId !== response.data.activity_id) {
        return { ok: false, reason: "invalid", errors: { activityId: "mismatch" } };
      }
      activityId = response.data.activity_id;
    }
    if (input.animalGroupId) {
      const response = await safe(() => repository.group(farmId, input.animalGroupId!));
      if (response.error) return { ok: false, reason: "failed" };
      if (!response.data) return { ok: false, reason: "invalid", errors: { animalGroupId: "invalid" } };
      if (activityId && activityId !== response.data.activity_id) {
        return { ok: false, reason: "invalid", errors: { activityId: "mismatch" } };
      }
      activityId = response.data.activity_id;
    }
    if (activityId) {
      const response = await safe(() => repository.activity(farmId, activityId!));
      if (response.error) return { ok: false, reason: "failed" };
      if (!response.data) return { ok: false, reason: "invalid", errors: { activityId: "invalid" } };
    }
    if (input.assignedTo) {
      const response = await safe(() => repository.member(farmId, input.assignedTo!));
      if (response.error) return { ok: false, reason: "failed" };
      if (!response.data) return { ok: false, reason: "invalid", errors: { assignedTo: "invalid" } };
    }
    return { ok: true, data: {
      title: input.title, description: input.description, due_on: input.dueOn,
      status: input.status, priority: input.priority, activity_id: activityId,
      crop_cycle_id: input.cropCycleId, animal_group_id: input.animalGroupId, assigned_to: input.assignedTo,
    } };
  }

  return {
    async list(input: TaskFilterInput = {}): Promise<TaskResult<TaskList>> {
      if (!readable) return denied;
      const validated = validateTaskFilters(input);
      if (!validated.success) return { ok: false, reason: "invalidFilters" };
      const filters = validated.data;
      if (filters.view === "mine") filters.assignee = actor!.userId;
      if (filters.view === "completed") filters.status = "terminee";
      if (filters.assignee && filters.assignee !== "unassigned" && filters.view !== "mine") {
        const member = await safe(() => repository.member(actor!.farmId, filters.assignee));
        if (member.error) return { ok: false, reason: "failed" };
        if (!member.data) return { ok: false, reason: "invalidFilters" };
      }
      const dates = getTaskDates(now());
      const response = result(await safe(() => repository.list(actor!.farmId, taskQuery(filters, actor!.userId, dates))));
      return response.ok ? { ok: true, data: { ...response.data, filters, dates } } : response;
    },
    async get(id: string): Promise<TaskResult<TaskDetail>> {
      if (!readable) return denied;
      if (!isUuid(id)) return { ok: false, reason: "notFound" };
      const response = result(await safe(() => repository.find(actor!.farmId, id)));
      if (!response.ok) return response;
      const task = response.data;
      const [activity, cycle, group, member] = await Promise.all([
        task.activity_id ? safe(() => repository.activity(actor!.farmId, task.activity_id!)) : Promise.resolve({ data: null, error: null }),
        task.crop_cycle_id ? safe(() => repository.cycle(actor!.farmId, task.crop_cycle_id!)) : Promise.resolve({ data: null, error: null }),
        task.animal_group_id ? safe(() => repository.group(actor!.farmId, task.animal_group_id!)) : Promise.resolve({ data: null, error: null }),
        task.assigned_to ? safe(() => repository.member(actor!.farmId, task.assigned_to!)) : Promise.resolve({ data: null, error: null }),
      ]);
      if ([activity, cycle, group, member].some((item) => item.error)) return { ok: false, reason: "failed" };
      return { ok: true, data: { ...task, activity: activity.data, cycle: cycle.data, group: group.data, member: member.data } };
    },
    async create(raw: RawTaskInput): Promise<TaskResult<TaskRecord>> {
      if (!editable) return denied;
      const validated = validateTaskInput(raw);
      if (!validated.success) return { ok: false, reason: "invalid", errors: validated.errors };
      const write = await resolveWrite(validated.data);
      if (!write.ok) return write;
      return result(await safe(() => repository.insert(actor!.farmId, write.data)));
    },
    async update(id: string, raw: RawTaskInput): Promise<TaskResult<TaskRecord>> {
      if (!editable) return denied;
      if (!isUuid(id)) return { ok: false, reason: "notFound" };
      // Check the target before expanding browser-supplied association IDs.
      const existing = result(await safe(() => repository.find(actor!.farmId, id)));
      if (!existing.ok) return existing;
      const validated = validateTaskInput(raw);
      if (!validated.success) return { ok: false, reason: "invalid", errors: validated.errors };
      const write = await resolveWrite(validated.data);
      if (!write.ok) return write;
      return result(await safe(() => repository.update(actor!.farmId, id, write.data)));
    },
    async setStatus(id: string, status: unknown): Promise<TaskResult<TaskRecord>> {
      if (!editable) return denied;
      if (!isUuid(id)) return { ok: false, reason: "notFound" };
      if (!isTaskStatus(status)) return { ok: false, reason: "invalid", errors: { status: "invalid" } };
      return result(await safe(() => repository.update(actor!.farmId, id, { status })));
    },
    async remove(id: string): Promise<TaskResult<{ id: string }>> {
      if (!readable || !canDeleteTasks(actor!.role)) return denied;
      if (!isUuid(id)) return { ok: false, reason: "notFound" };
      return result(await safe(() => repository.remove(actor!.farmId, id)));
    },
    async options(): Promise<TaskResult<TaskOptions>> {
      if (!readable) return denied;
      return result(await safe(() => repository.options(actor!.farmId)));
    },
    async members(): Promise<TaskResult<TaskMember[]>> {
      if (!readable) return denied;
      return result(await safe(() => repository.members(actor!.farmId)));
    },
    async summary(): Promise<TaskResult<TaskSummary>> {
      if (!readable) return denied;
      const dates = getTaskDates(now());
      const queries: TaskQuery[] = [
        { pendingOnly: true },
        { pendingOnly: true, dueFrom: dates.today, dueTo: dates.today },
        { pendingOnly: true, dueBefore: dates.today },
        { status: "terminee" },
        { pendingOnly: true, dueFrom: dates.today, dueTo: dates.upcomingThrough },
      ];
      const counts = await Promise.all(queries.map((query) => safe(() => repository.count(actor!.farmId, query))));
      if (counts.some((count) => count.error || count.data === null)) return { ok: false, reason: "failed" };
      return { ok: true, data: {
        pending: counts[0].data!, dueToday: counts[1].data!, overdue: counts[2].data!,
        completed: counts[3].data!, upcoming: counts[4].data!,
        dates,
      } };
    },
  };
}
