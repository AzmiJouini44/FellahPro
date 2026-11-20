"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getActivityContext } from "@/lib/activities";
import type { ActivityResult } from "@/lib/activity-service";

export type ActivityActionState = {
  message: string | null;
  errors?: Partial<Record<"name" | "kind" | "isActive", string>>;
};

function localeFrom(form: FormData): Locale {
  const locale = form.get("locale");
  return typeof locale === "string" && isLocale(locale) ? locale : defaultLocale;
}

function inputFrom(form: FormData) {
  return { name: form.get("name"), kind: form.get("kind"), isActive: form.get("isActive") };
}

function failure(locale: Locale, result: Extract<ActivityResult<unknown>, { ok: false }>): ActivityActionState {
  const messages = getDictionary(locale).activities.errors;
  return {
    message: messages[result.reason],
    errors: result.errors ? {
      ...(result.errors.name ? { name: messages.invalidName } : {}),
      ...(result.errors.kind ? { kind: messages.invalidKind } : {}),
      ...(result.errors.isActive ? { isActive: messages.invalidState } : {}),
    } : undefined,
  };
}

async function context(locale: Locale) {
  const context = await getActivityContext(locale);
  if (!context.workspace.farm) redirect(`/${locale}/onboarding`);
  return context;
}

function invalidate(locale: Locale) {
  // Names/status appear on activity pages, linked records, and the dashboard.
  revalidatePath(`/${locale}/app`, "layout");
}

export async function createActivity(_state: ActivityActionState, form: FormData): Promise<ActivityActionState> {
  const locale = localeFrom(form);
  const { service } = await context(locale);
  const result = await service.create(inputFrom(form));
  if (!result.ok) return failure(locale, result);
  invalidate(locale);
  redirect(`/${locale}/app/activities/${result.data.id}?success=created`);
}

export async function updateActivity(id: string, _state: ActivityActionState, form: FormData): Promise<ActivityActionState> {
  const locale = localeFrom(form);
  const { service } = await context(locale);
  const result = await service.update(id, inputFrom(form));
  if (!result.ok) return failure(locale, result);
  invalidate(locale);
  redirect(`/${locale}/app/activities/${result.data.id}?success=updated`);
}

export async function setActivityActive(id: string, _state: ActivityActionState, form: FormData): Promise<ActivityActionState> {
  const locale = localeFrom(form);
  const { service } = await context(locale);
  const result = await service.setActive(id, form.get("isActive"));
  if (!result.ok) return failure(locale, result);
  invalidate(locale);
  redirect(`/${locale}/app/activities/${result.data.id}?success=${result.data.is_active ? "activated" : "deactivated"}`);
}

export async function deleteActivity(id: string, _state: ActivityActionState, form: FormData): Promise<ActivityActionState> {
  const locale = localeFrom(form);
  const { service } = await context(locale);
  const result = await service.remove(id);
  if (!result.ok) return failure(locale, result);
  invalidate(locale);
  redirect(`/${locale}/app/activities?success=deleted`);
}
