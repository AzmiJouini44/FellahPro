import { isUuid } from "./validation";
import { getTaskDates, isTaskDate } from "./task-validation";

export const operationTypes = [
  "preparation_sol",
  "labour",
  "irrigation",
  "fertilisation",
  "taille",
  "plantation",
  "recolte",
  "autre",
] as const;
export const operationUnits = [
  "kg",
  "t",
  "l",
  "m3",
  "ha",
  "heure",
  "unite",
] as const;
export const OPERATION_PAGE_SIZE = 24;
export type OperationType = (typeof operationTypes)[number];
export type OperationUnit = (typeof operationUnits)[number];
export type OperationInput = {
  operationType: OperationType;
  performedOn: string;
  plotId: string;
  cycleId: string | null;
  activityId: string | null;
  taskId: string | null;
  expenseLineId: string | null;
  description: string | null;
  notes: string | null;
  quantity: string | null;
  unit: OperationUnit | null;
};
export type OperationRaw = Record<keyof OperationInput, unknown>;
export type OperationField = keyof OperationInput;
export type OperationErrors = Partial<
  Record<OperationField, "invalid" | "future" | "pair" | "mismatch" | "used">
>;
export function canReadOperations(role: string | null) {
  return role === "owner" || role === "worker" || role === "accountant";
}
export function canEditOperations(role: string | null) {
  return role === "owner" || role === "worker";
}
export function canDeleteOperations(role: string | null) {
  return role === "owner";
}
export function canLinkOperationExpenses(role: string | null) {
  return role === "owner";
}
export function isOperationType(value: unknown): value is OperationType {
  return (
    typeof value === "string" && operationTypes.includes(value as OperationType)
  );
}
export function operationDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}
function text(value: unknown) {
  return value == null ? "" : typeof value === "string" ? value.trim() : null;
}
export function operationId(value: unknown): string | null | undefined {
  const id = text(value);
  return id === "" ? null : id && isUuid(id) ? id.toLowerCase() : undefined;
}
export function validateOperationInput(
  raw: OperationRaw,
  now: Date = new Date(),
):
  | { success: true; data: OperationInput }
  | { success: false; errors: OperationErrors } {
  const errors: OperationErrors = {};
  const date = operationDigits(text(raw.performedOn) ?? "");
  if (!isOperationType(raw.operationType)) errors.operationType = "invalid";
  if (!isTaskDate(date)) errors.performedOn = "invalid";
  else if (date > getTaskDates(now).today) errors.performedOn = "future";
  const ids = {
    plotId: operationId(raw.plotId),
    cycleId: operationId(raw.cycleId),
    activityId: operationId(raw.activityId),
    taskId: operationId(raw.taskId),
    expenseLineId: operationId(raw.expenseLineId),
  };
  for (const key of Object.keys(ids) as Array<keyof typeof ids>)
    if (ids[key] === undefined || (key === "plotId" && !ids[key]))
      errors[key] = "invalid";
  const description = text(raw.description);
  const notes = text(raw.notes);
  if (description === null || description.length > 240)
    errors.description = "invalid";
  if (notes === null || notes.length > 2000) errors.notes = "invalid";
  const quantityText = text(raw.quantity);
  const quantity =
    quantityText === null
      ? null
      : operationDigits(quantityText).replace(/[،,٫]/g, ".");
  const unit = text(raw.unit);
  if (
    quantity === null ||
    (quantity &&
      (!/^\d{1,11}(\.\d{1,3})?$/.test(quantity) || Number(quantity) <= 0))
  )
    errors.quantity = "invalid";
  if (
    unit === null ||
    (unit && !operationUnits.includes(unit as OperationUnit))
  )
    errors.unit = "invalid";
  if (Boolean(quantity) !== Boolean(unit)) {
    errors.quantity ??= "pair";
    errors.unit ??= "pair";
  }
  if (
    Object.keys(errors).length ||
    !isOperationType(raw.operationType) ||
    !ids.plotId
  )
    return { success: false, errors };
  return {
    success: true,
    data: {
      operationType: raw.operationType,
      performedOn: date,
      plotId: ids.plotId,
      cycleId: ids.cycleId ?? null,
      activityId: ids.activityId ?? null,
      taskId: ids.taskId ?? null,
      expenseLineId: ids.expenseLineId ?? null,
      description: description || null,
      notes: notes || null,
      quantity: quantity || null,
      unit: unit ? (unit as OperationUnit) : null,
    },
  };
}

export type OperationFilters = {
  search: string;
  type: OperationType | "";
  from: string;
  to: string;
  plotId: string;
  cycleId: string;
  taskId: string;
  page: number;
};
export type OperationFilterRaw = Partial<
  Record<keyof OperationFilters, unknown>
>;
export function validateOperationFilters(
  raw: OperationFilterRaw,
): OperationFilters | null {
  const search = text(raw.search);
  const type = text(raw.type);
  const page = text(raw.page);
  const fromText = text(raw.from);
  const toText = text(raw.to);
  const from = fromText === null ? null : operationDigits(fromText);
  const to = toText === null ? null : operationDigits(toText);
  const plotId = operationId(raw.plotId);
  const cycleId = operationId(raw.cycleId);
  const taskId = operationId(raw.taskId);
  if (
    search === null ||
    search.length > 120 ||
    type === null ||
    (type && !isOperationType(type)) ||
    page === null ||
    (page && !/^[1-9]\d{0,5}$/.test(page)) ||
    from === null ||
    to === null ||
    (from && !isTaskDate(from)) ||
    (to && !isTaskDate(to)) ||
    (from && to && from > to) ||
    plotId === undefined ||
    cycleId === undefined ||
    taskId === undefined
  )
    return null;
  return {
    search,
    type: type as OperationFilters["type"],
    from,
    to,
    plotId: plotId || "",
    cycleId: cycleId || "",
    taskId: taskId || "",
    page: page ? Number(page) : 1,
  };
}
export function operationListQuery(
  filters: Partial<OperationFilters>,
  changes: Partial<OperationFilters> = {},
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, ...changes }))
    if (value && !(key === "page" && value === 1))
      params.set(key, String(value));
  return params.size ? "?" + params.toString() : "";
}
