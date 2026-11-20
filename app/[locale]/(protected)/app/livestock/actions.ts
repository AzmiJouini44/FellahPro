"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getLivestockContext } from "@/lib/livestock";
import type { LivestockResult } from "@/lib/livestock-service";
import type { LivestockField } from "@/lib/livestock-validation";

export type LivestockActionState = { message: string | null; errors?: Partial<Record<LivestockField, string>> };
function localeFrom(form: FormData): Locale {
  const value = form.get("locale");
  return typeof value === "string" && isLocale(value) ? value : defaultLocale;
}
function groupInput(form: FormData) {
  return { name: form.get("name"), species: form.get("species"), openingCount: form.get("openingCount"), activityId: form.get("activityId"), isActive: form.get("isActive") };
}
function failure(locale: Locale, result: Extract<LivestockResult<unknown>, { ok: false }>): LivestockActionState {
  const text = getDictionary(locale).livestock.errors;
  const errors: LivestockActionState["errors"] = {};
  for (const field of Object.keys(result.errors ?? {}) as LivestockField[]) errors[field] = result.errors![field] === "future" ? text.future : text.fields[field];
  return { message: text[result.reason], errors };
}
async function context(locale: Locale) {
  const context = await getLivestockContext(locale);
  if (!context.workspace.farm) redirect(`/${locale}/onboarding`);
  return context;
}
export async function createAnimalGroup(_state: LivestockActionState, form: FormData): Promise<LivestockActionState> {
  const locale = localeFrom(form); const { service } = await context(locale);
  const result = await service.create(groupInput(form));
  if (!result.ok) return failure(locale, result);
  revalidatePath(`/${locale}/app`, "layout");
  redirect(`/${locale}/app/livestock/${result.data.id}?success=created`);
}
export async function updateAnimalGroup(id: string, _state: LivestockActionState, form: FormData): Promise<LivestockActionState> {
  const locale = localeFrom(form); const { service } = await context(locale);
  const result = await service.update(id, groupInput(form));
  if (!result.ok) return failure(locale, result);
  revalidatePath(`/${locale}/app`, "layout");
  redirect(`/${locale}/app/livestock/${result.data.id}?success=updated`);
}
export async function deleteAnimalGroup(id: string, _state: LivestockActionState, form: FormData): Promise<LivestockActionState> {
  const locale = localeFrom(form); const { service } = await context(locale);
  const result = await service.remove(id);
  if (!result.ok) return failure(locale, result);
  revalidatePath(`/${locale}/app`, "layout");
  redirect(`/${locale}/app/livestock?success=deleted`);
}
export async function recordAnimalEvent(groupId: string, _state: LivestockActionState, form: FormData): Promise<LivestockActionState> {
  const locale = localeFrom(form); const { service } = await context(locale);
  const result = await service.recordEvent(groupId, { kind: form.get("kind"), eventDate: form.get("eventDate"), quantity: form.get("quantity"), notes: form.get("notes") });
  if (!result.ok) return failure(locale, result);
  revalidatePath(`/${locale}/app`, "layout");
  redirect(`/${locale}/app/livestock/${groupId}?success=event#events`);
}
