import { isUuid } from "./validation";

export const taskStatuses = ["a_faire", "en_cours", "terminee", "annulee"] as const;
export const taskPriorities = ["basse", "normale", "haute"] as const;
export const taskViews = ["all", "pending", "upcoming", "overdue", "completed", "mine"] as const;
export type TaskStatus = (typeof taskStatuses)[number];
export type TaskPriority = (typeof taskPriorities)[number];
export type TaskView = (typeof taskViews)[number];
export const TASK_PAGE_SIZE = 24;
export const TASK_TIME_ZONE = "Africa/Tunis";
export const TASK_REFRESH_MS = 60_000;

export type TaskInput = {
  title: string;
  description: string | null;
  dueOn: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  activityId: string | null;
  cropCycleId: string | null;
  animalGroupId: string | null;
  assignedTo: string | null;
};
export type RawTaskInput = Record<keyof TaskInput, unknown>;
export type TaskField = keyof TaskInput;
export type TaskFieldError = "invalid" | "tooLong" | "exclusive" | "mismatch" | "unclassified";
export type TaskErrors = Partial<Record<TaskField, TaskFieldError>>;

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === "string" && taskStatuses.includes(value as TaskStatus);
}

export function isTaskPriority(value: unknown): value is TaskPriority {
  return typeof value === "string" && taskPriorities.includes(value as TaskPriority);
}

export function canReadTasks(role: string | null) {
  return role === "owner" || role === "worker" || role === "accountant";
}

export function canEditTasks(role: string | null) {
  return role === "owner" || role === "worker";
}

export function canDeleteTasks(role: string | null) {
  return role === "owner";
}

export function isPendingTask(status: TaskStatus) {
  return status === "a_faire" || status === "en_cours";
}

function optionalText(value: unknown): string | null {
  if (value === undefined || value === null) return "";
  return typeof value === "string" ? value.trim() : null;
}

function normalizeDateDigits(value: string) {
  return value.replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

export function isTaskDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const date = new Date(value + "T00:00:00.000Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateTaskInput(input: RawTaskInput):
  | { success: true; data: TaskInput }
  | { success: false; errors: TaskErrors } {
  const errors: TaskErrors = {};
  const title = typeof input.title === "string" ? input.title.trim().replace(/\s+/g, " ") : "";
  const description = optionalText(input.description);
  const dueText = optionalText(input.dueOn);
  const dueOn = dueText === null ? null : normalizeDateDigits(dueText);
  if (title.length < 2 || title.length > 120) errors.title = "invalid";
  if (description === null || description.length > 2000) errors.description = "tooLong";
  if (dueOn === null || (dueOn && !isTaskDate(dueOn))) errors.dueOn = "invalid";
  if (!isTaskStatus(input.status)) errors.status = "invalid";
  if (!isTaskPriority(input.priority)) errors.priority = "invalid";
  const ids: Record<"activityId" | "cropCycleId" | "animalGroupId" | "assignedTo", string | null> = {
    activityId: null, cropCycleId: null, animalGroupId: null, assignedTo: null,
  };
  for (const key of ["activityId", "cropCycleId", "animalGroupId", "assignedTo"] as const) {
    const value = optionalText(input[key]);
    if (value === null || (value && !isUuid(value))) errors[key] = "invalid";
    else ids[key] = value || null;
  }
  if (ids.cropCycleId && ids.animalGroupId) {
    errors.cropCycleId = "exclusive";
    errors.animalGroupId = "exclusive";
  }
  if (Object.keys(errors).length || !isTaskStatus(input.status) || !isTaskPriority(input.priority)) {
    return { success: false, errors };
  }
  return { success: true, data: {
    title, description: description || null, dueOn: dueOn || null,
    status: input.status, priority: input.priority, ...ids,
  } };
}

// due_on is a calendar date. All farm reminders use the Tunisian day, not the
// browser/server machine's local zone. The window is seven days including today.
export function getTaskDates(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: TASK_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((value) => value.type === type)!.value;
  const today = part("year") + "-" + part("month") + "-" + part("day");
  const through = new Date(today + "T00:00:00.000Z");
  through.setUTCDate(through.getUTCDate() + 6);
  return { today, upcomingThrough: through.toISOString().slice(0, 10) };
}
export type TaskDates = ReturnType<typeof getTaskDates>;
export type TaskDueState = "overdue" | "today" | "upcoming" | "scheduled" | "noDue" | "completed" | "cancelled";

export function getTaskDueState(task: { status: TaskStatus; due_on: string | null }, dates: TaskDates): TaskDueState {
  if (task.status === "terminee") return "completed";
  if (task.status === "annulee") return "cancelled";
  if (!task.due_on) return "noDue";
  if (task.due_on < dates.today) return "overdue";
  if (task.due_on === dates.today) return "today";
  return task.due_on <= dates.upcomingThrough ? "upcoming" : "scheduled";
}

export type TaskFilters = {
  search: string; status: "" | TaskStatus; priority: "" | TaskPriority;
  assignee: string; animalGroupId: string; dueFrom: string; dueTo: string; view: TaskView; page: number;
};
export type TaskFilterInput = Partial<Record<keyof TaskFilters, unknown>>;
export type TaskQuery = {
  search?: string; status?: TaskStatus; priority?: TaskPriority;
  assignedTo?: string | null; dueFrom?: string; dueTo?: string; dueBefore?: string;
  pendingOnly?: boolean; page?: number;
  animalGroupId?: string;
};

export function validateTaskFilters(input: TaskFilterInput):
  | { success: true; data: TaskFilters }
  | { success: false } {
  const search = optionalText(input.search);
  const status = optionalText(input.status);
  const priority = optionalText(input.priority);
  const assignee = optionalText(input.assignee);
  const animalGroupId = optionalText(input.animalGroupId);
  const from = optionalText(input.dueFrom);
  const to = optionalText(input.dueTo);
  const dueFrom = from === null ? null : normalizeDateDigits(from);
  const dueTo = to === null ? null : normalizeDateDigits(to);
  const viewText = optionalText(input.view);
  const view = viewText || "all";
  const page = optionalText(input.page);
  if (search === null || search.length > 120 || status === null || (status && !isTaskStatus(status)) ||
      priority === null || (priority && !isTaskPriority(priority)) ||
      assignee === null || (assignee && assignee !== "unassigned" && !isUuid(assignee)) ||
      animalGroupId === null || (animalGroupId && !isUuid(animalGroupId)) ||
      dueFrom === null || (dueFrom && !isTaskDate(dueFrom)) || dueTo === null || (dueTo && !isTaskDate(dueTo)) ||
      (dueFrom && dueTo && dueFrom > dueTo) || viewText === null || !taskViews.includes(view as TaskView) ||
      page === null || (page && !/^[1-9]\d{0,5}$/.test(page))) return { success: false };
  return { success: true, data: {
    search, status: status as TaskFilters["status"], priority: priority as TaskFilters["priority"],
    assignee, animalGroupId, dueFrom, dueTo, view: view as TaskView, page: page ? Number(page) : 1,
  } };
}

export function taskQuery(filters: TaskFilters, userId: string, dates: TaskDates): TaskQuery {
  const query: TaskQuery = { page: filters.page };
  if (filters.search) query.search = filters.search;
  if (filters.status) query.status = filters.status;
  if (filters.priority) query.priority = filters.priority;
  if (filters.animalGroupId) query.animalGroupId = filters.animalGroupId;
  if (filters.assignee) query.assignedTo = filters.assignee === "unassigned" ? null : filters.assignee;
  if (filters.dueFrom) query.dueFrom = filters.dueFrom;
  if (filters.dueTo) query.dueTo = filters.dueTo;
  if (filters.view === "mine") query.assignedTo = userId;
  if (filters.view === "completed") query.status = "terminee";
  if (["pending", "upcoming", "overdue"].includes(filters.view)) query.pendingOnly = true;
  if (filters.view === "overdue") query.dueBefore = dates.today;
  if (filters.view === "upcoming") {
    query.dueFrom = filters.dueFrom > dates.today ? filters.dueFrom : dates.today;
    query.dueTo = filters.dueTo && filters.dueTo < dates.upcomingThrough ? filters.dueTo : dates.upcomingThrough;
  }
  return query;
}

export function taskListQuery(filters: TaskFilters, changes: Partial<TaskFilters> = {}) {
  const next = { ...filters, ...changes };
  const params = new URLSearchParams();
  for (const key of ["search", "status", "priority", "assignee", "animalGroupId", "dueFrom", "dueTo"] as const) {
    if (next[key]) params.set(key, next[key]);
  }
  if (next.view !== "all") params.set("view", next.view);
  if (next.page > 1) params.set("page", String(next.page));
  return params.size ? "?" + params.toString() : "";
}
