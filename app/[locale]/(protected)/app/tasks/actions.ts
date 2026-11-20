"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getTaskContext } from "@/lib/tasks";
import type { TaskResult } from "@/lib/task-service";
import type { TaskField } from "@/lib/task-validation";

export type TaskActionState = { message: string | null; errors?: Partial<Record<TaskField, string>> };

function localeFrom(form: FormData): Locale {
  const locale = form.get("locale");
  return typeof locale === "string" && isLocale(locale) ? locale : defaultLocale;
}

function inputFrom(form: FormData) {
  return {
    title: form.get("title"), description: form.get("description"), dueOn: form.get("dueOn"),
    status: form.get("status"), priority: form.get("priority"), assignedTo: form.get("assignedTo"),
    activityId: form.get("activityId"), cropCycleId: form.get("cropCycleId"), animalGroupId: form.get("animalGroupId"),
  };
}

function failure(locale: Locale, result: Extract<TaskResult<unknown>, { ok: false }>): TaskActionState {
  const messages = getDictionary(locale).tasks.errors;
  const errors: TaskActionState["errors"] = {};
  for (const field of Object.keys(result.errors ?? {}) as TaskField[]) {
    const code = result.errors![field];
    errors[field] = code === "exclusive" || code === "mismatch" || code === "unclassified"
      ? messages[code] : messages.fields[field];
  }
  return { message: messages[result.reason], errors };
}

async function context(locale: Locale) {
  const context = await getTaskContext(locale);
  if (!context.workspace.farm) redirect(`/${locale}/onboarding`);
  return context;
}

function invalidate(locale: Locale) {
  revalidatePath(`/${locale}/app`, "layout");
}

export async function createTask(_state: TaskActionState, form: FormData): Promise<TaskActionState> {
  const locale = localeFrom(form);
  const { service } = await context(locale);
  const result = await service.create(inputFrom(form));
  if (!result.ok) return failure(locale, result);
  invalidate(locale);
  redirect(`/${locale}/app/tasks/${result.data.id}?success=created`);
}

export async function updateTask(id: string, _state: TaskActionState, form: FormData): Promise<TaskActionState> {
  const locale = localeFrom(form);
  const { service } = await context(locale);
  const result = await service.update(id, inputFrom(form));
  if (!result.ok) return failure(locale, result);
  invalidate(locale);
  redirect(`/${locale}/app/tasks/${result.data.id}?success=updated`);
}

export async function setTaskStatus(id: string, _state: TaskActionState, form: FormData): Promise<TaskActionState> {
  const locale = localeFrom(form);
  const { service } = await context(locale);
  const result = await service.setStatus(id, form.get("status"));
  if (!result.ok) return failure(locale, result);
  invalidate(locale);
  redirect(`/${locale}/app/tasks/${result.data.id}?success=status`);
}

export async function deleteTask(id: string, _state: TaskActionState, form: FormData): Promise<TaskActionState> {
  const locale = localeFrom(form);
  const { service } = await context(locale);
  const result = await service.remove(id);
  if (!result.ok) return failure(locale, result);
  invalidate(locale);
  redirect(`/${locale}/app/tasks?success=deleted`);
}
