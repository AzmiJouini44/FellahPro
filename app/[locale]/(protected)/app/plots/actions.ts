"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { defaultLocale, isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import {
  canDeletePlots,
  canEditPlots,
  isUuid,
  validatePlotInput,
  type PlotValidationErrors,
} from "@/lib/plot-validation";
import { getCurrentWorkspace } from "@/lib/workspace";
import { createClient } from "@/utils/supabase/server";

export type PlotActionState = {
  message: string | null;
  errors?: {
    name?: string;
    areaHectares?: string;
    notes?: string;
  };
};

function getLocale(formData: FormData): Locale {
  const locale = formData.get("locale");
  return typeof locale === "string" && isLocale(locale) ? locale : defaultLocale;
}

function localizeValidationErrors(
  locale: Locale,
  errors: PlotValidationErrors,
): PlotActionState["errors"] {
  const messages = getDictionary(locale).plots.errors;

  return {
    ...(errors.name ? { name: messages.invalidName } : {}),
    ...(errors.areaHectares ? { areaHectares: messages.invalidArea } : {}),
    ...(errors.notes ? { notes: messages.notesTooLong } : {}),
  };
}

async function getMutationWorkspace(locale: Locale) {
  const workspace = await getCurrentWorkspace(locale);

  if (!workspace.farm) {
    redirect(`/${locale}/onboarding`);
  }

  return { ...workspace, farm: workspace.farm };
}

function readPlotInput(formData: FormData) {
  return validatePlotInput({
    name: formData.get("name"),
    areaHectares: formData.get("areaHectares"),
    notes: formData.get("notes"),
  });
}

export async function createPlot(
  _previousState: PlotActionState,
  formData: FormData,
): Promise<PlotActionState> {
  const locale = getLocale(formData);
  const dictionary = getDictionary(locale);
  const validated = readPlotInput(formData);

  if (!validated.success) {
    return {
      message: dictionary.plots.errors.invalidForm,
      errors: localizeValidationErrors(locale, validated.errors),
    };
  }

  const workspace = await getMutationWorkspace(locale);

  if (!canEditPlots(workspace.role)) {
    return { message: dictionary.plots.errors.forbiddenEdit };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plots")
    .insert({
      farm_id: workspace.farm.id,
      name: validated.data.name,
      area_hectares: validated.data.areaHectares,
      notes: validated.data.notes,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    return { message: dictionary.plots.errors.createFailed };
  }

  revalidatePath(`/${locale}/app`);
  revalidatePath(`/${locale}/app/plots`);
  redirect(`/${locale}/app/plots/${data.id}?success=created`);
}

export async function updatePlot(
  plotId: string,
  _previousState: PlotActionState,
  formData: FormData,
): Promise<PlotActionState> {
  const locale = getLocale(formData);
  const dictionary = getDictionary(locale);
  const validated = readPlotInput(formData);

  if (!isUuid(plotId)) {
    return { message: dictionary.plots.errors.notFound };
  }

  if (!validated.success) {
    return {
      message: dictionary.plots.errors.invalidForm,
      errors: localizeValidationErrors(locale, validated.errors),
    };
  }

  const workspace = await getMutationWorkspace(locale);

  if (!canEditPlots(workspace.role)) {
    return { message: dictionary.plots.errors.forbiddenEdit };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plots")
    .update({
      name: validated.data.name,
      area_hectares: validated.data.areaHectares,
      notes: validated.data.notes,
    })
    .eq("farm_id", workspace.farm.id)
    .eq("id", plotId)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) {
    return { message: dictionary.plots.errors.updateFailed };
  }

  if (!data) {
    return { message: dictionary.plots.errors.notFound };
  }

  revalidatePath(`/${locale}/app`);
  revalidatePath(`/${locale}/app/plots`);
  revalidatePath(`/${locale}/app/plots/${plotId}`);
  redirect(`/${locale}/app/plots/${plotId}?success=updated`);
}

export async function deletePlot(
  plotId: string,
  _previousState: PlotActionState,
  formData: FormData,
): Promise<PlotActionState> {
  const locale = getLocale(formData);
  const dictionary = getDictionary(locale);

  if (!isUuid(plotId)) {
    return { message: dictionary.plots.errors.notFound };
  }

  const workspace = await getMutationWorkspace(locale);

  if (!canDeletePlots(workspace.role)) {
    return { message: dictionary.plots.errors.forbiddenDelete };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plots")
    .delete()
    .eq("farm_id", workspace.farm.id)
    .eq("id", plotId)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error?.code === "23503") {
    return { message: dictionary.plots.errors.deleteRelated };
  }

  if (error) {
    return { message: dictionary.plots.errors.deleteFailed };
  }

  if (!data) {
    return { message: dictionary.plots.errors.notFound };
  }

  revalidatePath(`/${locale}/app`);
  revalidatePath(`/${locale}/app/plots`);
  redirect(`/${locale}/app/plots?success=deleted`);
}
