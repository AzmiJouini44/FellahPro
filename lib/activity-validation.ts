import { isUuid } from "./validation";

export const activityKinds = ["culture", "elevage", "commerce", "autre"] as const;
export type ActivityKind = (typeof activityKinds)[number];
export type ActivityInput = { name: string; kind: ActivityKind; isActive: boolean };
export type ActivityErrors = Partial<Record<"name" | "kind" | "isActive", "invalid">>;
export type RawActivityInput = { name: unknown; kind: unknown; isActive: unknown };

export function isActivityKind(value: string): value is ActivityKind {
  return activityKinds.includes(value as ActivityKind);
}

export function canManageActivities(role: string | null) {
  return role === "owner";
}

export function canReadActivities(role: string | null) {
  return role === "owner" || role === "worker" || role === "accountant";
}

export function parseActivityState(value: unknown) {
  return value === "true" ? true : value === "false" ? false : undefined;
}

export function validateActivityInput(input: RawActivityInput):
  | { success: true; data: ActivityInput }
  | { success: false; errors: ActivityErrors } {
  const name = typeof input.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
  const kind = typeof input.kind === "string" ? input.kind : "";
  const isActive = parseActivityState(input.isActive);
  const errors: ActivityErrors = {};
  if (name.length < 2 || name.length > 120) errors.name = "invalid";
  if (!isActivityKind(kind)) errors.kind = "invalid";
  if (isActive === undefined) errors.isActive = "invalid";
  if (Object.keys(errors).length || !isActivityKind(kind) || isActive === undefined) {
    return { success: false, errors };
  }
  return { success: true, data: { name, kind, isActive } };
}

// Missing means preserve on UPDATE (or use the server-derived default on INSERT).
// An explicitly submitted empty string means unassign, which both FKs support.
export function validateActivityAssignment(value: unknown):
  | { success: true; activityId: string | null | undefined }
  | { success: false } {
  if (value === undefined) return { success: true, activityId: undefined };
  if (typeof value !== "string") return { success: false };
  const id = value.trim();
  return !id || isUuid(id)
    ? { success: true, activityId: id || null }
    : { success: false };
}

export function activityAssignmentPatch(activityId: string | null | undefined) {
  return activityId === undefined ? {} : { activity_id: activityId };
}

export function newCycleActivity(activityId: string | null | undefined, plotActivityId: string | null) {
  return activityId === undefined ? plotActivityId : activityId;
}

export const ACTIVITY_PAGE_SIZE = 24;
export type ActivityFilters = {
  search: string;
  kind: ActivityKind | "";
  active: "" | "true" | "false";
  createdFrom: string;
  createdTo: string;
  page: number;
};
export type ActivityFilterInput = Partial<Record<keyof ActivityFilters, unknown>>;

function readFilter(value: unknown) {
  return value === undefined || value === "" ? "" : typeof value === "string" ? value.trim() : null;
}

function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.slice(0, 4) === "0000") return false;
  const date = new Date(value + "T00:00:00.000Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateActivityFilters(input: ActivityFilterInput):
  | { success: true; data: ActivityFilters }
  | { success: false } {
  const search = readFilter(input.search);
  const kind = readFilter(input.kind);
  const active = readFilter(input.active);
  const createdFrom = readFilter(input.createdFrom);
  const createdTo = readFilter(input.createdTo);
  const pageText = readFilter(input.page);
  if (search === null || search.length > 120 || kind === null || (kind && !isActivityKind(kind)) ||
      active === null || (active !== "" && active !== "true" && active !== "false") ||
      createdFrom === null || (createdFrom && !isDate(createdFrom)) ||
      createdTo === null || (createdTo && !isDate(createdTo)) ||
      (createdFrom && createdTo && createdFrom > createdTo) || pageText === null ||
      (pageText && !/^[1-9]\d{0,5}$/.test(pageText))) {
    return { success: false };
  }
  return { success: true, data: {
    search, kind: kind as ActivityFilters["kind"], active,
    createdFrom, createdTo, page: pageText ? Number(pageText) : 1,
  } };
}

export function escapeActivitySearch(value: string) {
  return value.replace(/[\\%_]/g, (character) => "\\" + character);
}

export function activityListQuery(filters: ActivityFilters, page: number) {
  const params = new URLSearchParams();
  for (const key of ["search", "kind", "active", "createdFrom", "createdTo"] as const) {
    if (filters[key]) params.set(key, filters[key]);
  }
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? "?" + query : "";
}
