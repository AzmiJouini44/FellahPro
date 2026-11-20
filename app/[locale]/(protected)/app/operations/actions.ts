"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getOperationContext } from "@/lib/operations";
import type { OperationResult } from "@/lib/operation-service";
import type { OperationField } from "@/lib/operation-validation";

export type OperationActionState = {
  message: string | null;
  errors?: Partial<Record<OperationField, string>>;
};
function localeFrom(form: FormData): Locale {
  const locale = form.get("locale");
  return typeof locale === "string" && isLocale(locale)
    ? locale
    : defaultLocale;
}
function inputFrom(form: FormData) {
  return {
    operationType: form.get("operationType"),
    performedOn: form.get("performedOn"),
    plotId: form.get("plotId"),
    cycleId: form.get("cycleId"),
    activityId: form.get("activityId"),
    taskId: form.get("taskId"),
    expenseLineId: form.get("expenseLineId"),
    description: form.get("description"),
    notes: form.get("notes"),
    quantity: form.get("quantity"),
    unit: form.get("unit"),
  };
}
function failure(
  locale: Locale,
  result: Extract<OperationResult<unknown>, { ok: false }>,
): OperationActionState {
  const text = getDictionary(locale).operations.errors;
  const errors: OperationActionState["errors"] = {};
  for (const field of Object.keys(result.errors ?? {}) as OperationField[]) {
    const code = result.errors![field];
    errors[field] =
      code === "used"
        ? text.expenseUsed
        : code === "future" || code === "pair" || code === "mismatch"
          ? text[code]
          : text.fields[field];
  }
  return { message: text[result.reason], errors };
}
async function context(locale: Locale) {
  const context = await getOperationContext(locale);
  if (!context.workspace.farm) redirect(`/${locale}/onboarding`);
  return context;
}
export async function createOperation(
  _state: OperationActionState,
  form: FormData,
): Promise<OperationActionState> {
  const locale = localeFrom(form);
  const { service } = await context(locale);
  const result = await service.create(inputFrom(form));
  if (!result.ok) return failure(locale, result);
  revalidatePath(`/${locale}/app`, "layout");
  redirect(`/${locale}/app/operations/${result.data.id}?success=created`);
}
export async function updateOperation(
  id: string,
  _state: OperationActionState,
  form: FormData,
): Promise<OperationActionState> {
  const locale = localeFrom(form);
  const { service } = await context(locale);
  const result = await service.update(id, inputFrom(form));
  if (!result.ok) return failure(locale, result);
  revalidatePath(`/${locale}/app`, "layout");
  redirect(`/${locale}/app/operations/${result.data.id}?success=updated`);
}
export async function deleteOperation(
  id: string,
  _state: OperationActionState,
  form: FormData,
): Promise<OperationActionState> {
  const locale = localeFrom(form);
  const { service } = await context(locale);
  const result = await service.remove(id);
  if (!result.ok) return failure(locale, result);
  revalidatePath(`/${locale}/app`, "layout");
  redirect(`/${locale}/app/operations?success=deleted`);
}
