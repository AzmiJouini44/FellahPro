import { isUuid } from "./validation";
import { getTaskDates, isTaskDate } from "./task-validation";

export const animalEventKinds = ["naissance", "achat", "vente", "deces", "transfert", "soin", "autre"] as const;
export type AnimalEventKind = (typeof animalEventKinds)[number];
export const LIVESTOCK_PAGE_SIZE = 24;
export type GroupInput = { name: string; species: string; openingCount: number; activityId: string; isActive: boolean };
export type EventInput = { kind: AnimalEventKind; eventDate: string; quantity: number; notes: string | null };
export type GroupRaw = Record<keyof GroupInput, unknown>;
export type EventRaw = Record<keyof EventInput, unknown>;
export type LivestockField = keyof GroupInput | keyof EventInput;
export type LivestockErrors = Partial<Record<LivestockField, "invalid" | "future">>;

export function canReadLivestock(role: string | null) {
  return role === "owner" || role === "worker" || role === "accountant";
}
export function canManageAnimalGroups(role: string | null) { return role === "owner"; }
export function canRecordAnimalEvents(role: string | null) { return role === "owner" || role === "worker"; }
export function isAnimalEventKind(value: unknown): value is AnimalEventKind {
  return typeof value === "string" && animalEventKinds.includes(value as AnimalEventKind);
}
export function normalizeLivestockDigits(value: string) {
  return value.replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}
function text(value: unknown) {
  return value === undefined || value === null ? "" : typeof value === "string" ? value.trim() : null;
}
function integer(value: unknown) {
  const string = typeof value === "string" ? normalizeLivestockDigits(value.trim()) : "";
  if (!/^\d{1,10}$/.test(string)) return null;
  const number = Number(string);
  return Number.isSafeInteger(number) && number <= 2147483647 ? number : null;
}

export function validateGroupInput(raw: GroupRaw):
  | { success: true; data: GroupInput } | { success: false; errors: LivestockErrors } {
  const name = text(raw.name)?.replace(/\s+/g, " ") ?? "";
  const species = text(raw.species)?.replace(/\s+/g, " ") ?? "";
  const activityId = text(raw.activityId);
  const openingCount = integer(raw.openingCount);
  const isActive = raw.isActive === "true" ? true : raw.isActive === "false" ? false : null;
  const errors: LivestockErrors = {};
  if (name.length < 2 || name.length > 120) errors.name = "invalid";
  if (species.length < 2 || species.length > 80) errors.species = "invalid";
  if (!isUuid(activityId)) errors.activityId = "invalid";
  if (openingCount === null) errors.openingCount = "invalid";
  if (isActive === null) errors.isActive = "invalid";
  if (Object.keys(errors).length || !isUuid(activityId) || openingCount === null || isActive === null) return { success: false, errors };
  return { success: true, data: { name, species, activityId, openingCount, isActive } };
}

export function validateEventInput(raw: EventRaw, now: Date = new Date()):
  | { success: true; data: EventInput } | { success: false; errors: LivestockErrors } {
  const eventDate = normalizeLivestockDigits(text(raw.eventDate) ?? "");
  const quantity = integer(raw.quantity);
  const notes = text(raw.notes);
  const errors: LivestockErrors = {};
  if (!isAnimalEventKind(raw.kind)) errors.kind = "invalid";
  if (!isTaskDate(eventDate)) errors.eventDate = "invalid";
  else if (eventDate > getTaskDates(now).today) errors.eventDate = "future";
  if (quantity === null || (quantity === 0 && ["naissance", "achat", "vente", "deces"].includes(String(raw.kind)))) errors.quantity = "invalid";
  if (notes === null || notes.length > 2000) errors.notes = "invalid";
  if (Object.keys(errors).length || !isAnimalEventKind(raw.kind) || quantity === null) return { success: false, errors };
  return { success: true, data: { kind: raw.kind, eventDate, quantity, notes: notes || null } };
}

export type GroupFilters = { search: string; species: string; active: "" | "true" | "false"; page: number };
export type EventFilters = { kind: "" | AnimalEventKind; from: string; to: string; page: number };
export type GroupFilterRaw = Partial<Record<keyof GroupFilters, unknown>>;
export type EventFilterRaw = Partial<Record<keyof EventFilters, unknown>>;
function page(value: unknown) {
  const string = text(value);
  return string === "" ? 1 : string && /^[1-9]\d{0,5}$/.test(string) ? Number(string) : null;
}
export function validateGroupFilters(raw: GroupFilterRaw): GroupFilters | null {
  const search = text(raw.search); const species = text(raw.species); const active = text(raw.active); const number = page(raw.page);
  if (search === null || search.length > 120 || species === null || species.length > 80 ||
    (active !== "" && active !== "true" && active !== "false") || number === null) return null;
  return { search, species, active, page: number };
}
export function validateEventFilters(raw: EventFilterRaw): EventFilters | null {
  const kind = text(raw.kind); const from = text(raw.from); const to = text(raw.to); const number = page(raw.page);
  if (kind === null || (kind && !isAnimalEventKind(kind)) || from === null || to === null || number === null) return null;
  const start = normalizeLivestockDigits(from); const end = normalizeLivestockDigits(to);
  if ((start && !isTaskDate(start)) || (end && !isTaskDate(end)) || (start && end && start > end)) return null;
  return { kind: kind as EventFilters["kind"], from: start, to: end, page: number };
}
export function livestockQuery(values: Record<string, string | number>, changes: Record<string, string | number> = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...values, ...changes })) {
    if (value !== "" && value !== 1) params.set(key, String(value));
  }
  return params.size ? "?" + params.toString() : "";
}

// PostgreSQL bigint counts may arrive as strings or numbers. Reject unsafe
// numeric JSON rather than displaying an already-rounded animal balance.
export function animalCount(value: string | number): string | null {
  if (typeof value === "number" && !Number.isSafeInteger(value)) return null;
  const string = String(value);
  return /^-?\d+$/.test(string) ? BigInt(string).toString() : null;
}
