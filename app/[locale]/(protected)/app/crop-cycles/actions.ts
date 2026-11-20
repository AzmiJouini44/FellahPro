"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { defaultLocale, isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import {
  canDeleteCropCycles,
  canEditCropCycles,
  validateAreaWithinPlot,
  validateCropCycleInput,
  type CropCycleValidationErrors,
} from "@/lib/crop-cycle-validation";
import { isUuid } from "@/lib/plot-validation";
import { getCurrentWorkspace } from "@/lib/workspace";
import { createClient } from "@/utils/supabase/server";

export type CropCycleActionState = {
  message: string | null;
  errors?: Partial<
    Record<
      | "plotId"
      | "cropName"
      | "plantedOn"
      | "expectedHarvestOn"
      | "actualHarvestOn"
      | "cultivatedAreaHectares"
      | "status"
      | "notes",
      string
    >
  >;
};

type TrustedPlot = {
  id: string;
  area_hectares: number;
  activity_id: string | null;
};

function getLocale(formData: FormData): Locale {
  const locale = formData.get("locale");
  return typeof locale === "string" && isLocale(locale) ? locale : defaultLocale;
}

function localizeValidationErrors(
  locale: Locale,
  errors: CropCycleValidationErrors,
): CropCycleActionState["errors"] {
  const messages = getDictionary(locale).cropCycles.errors;

  return {
    ...(errors.plotId ? { plotId: messages.invalidPlot } : {}),
    ...(errors.cropName ? { cropName: messages.invalidCropName } : {}),
    ...(errors.plantedOn ? { plantedOn: messages.invalidDate } : {}),
    ...(errors.expectedHarvestOn
      ? {
          expectedHarvestOn:
            errors.expectedHarvestOn === "date_order"
              ? messages.invalidDateRange
              : messages.invalidDate,
        }
      : {}),
    ...(errors.actualHarvestOn
      ? {
          actualHarvestOn:
            errors.actualHarvestOn === "required"
              ? messages.actualRequired
              : errors.actualHarvestOn === "date_order"
                ? messages.invalidDateRange
                : messages.actualOnlyCompleted,
        }
      : {}),
    ...(errors.cultivatedAreaHectares
      ? { cultivatedAreaHectares: messages.invalidArea }
      : {}),
    ...(errors.status ? { status: messages.invalidStatus } : {}),
    ...(errors.notes ? { notes: messages.notesTooLong } : {}),
  };
}

async function getMutationWorkspace(locale: Locale) {
  const workspace = await getCurrentWorkspace(locale);
  if (!workspace.farm) redirect(`/${locale}/onboarding`);
  return { ...workspace, farm: workspace.farm };
}

function readCycleInput(formData: FormData) {
  return validateCropCycleInput({
    plotId: formData.get("plotId"),
    cropName: formData.get("cropName"),
    plantedOn: formData.get("plantedOn"),
    expectedHarvestOn: formData.get("expectedHarvestOn"),
    actualHarvestOn: formData.get("actualHarvestOn"),
    cultivatedAreaHectares: formData.get("cultivatedAreaHectares"),
    status: formData.get("status"),
    notes: formData.get("notes"),
  });
}

async function getTrustedPlot(farmId: string, plotId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plots")
    .select("id, area_hectares, activity_id")
    .eq("farm_id", farmId)
    .eq("id", plotId)
    .maybeSingle<TrustedPlot>();

  return { supabase, plot: data, error };
}

function revalidateCropCyclePaths(locale: Locale, cycleId?: string) {
  revalidatePath(`/${locale}/app`);
  revalidatePath(`/${locale}/app/crop-cycles`);
  if (cycleId) revalidatePath(`/${locale}/app/crop-cycles/${cycleId}`);
}

export async function createCropCycle(
  _previousState: CropCycleActionState,
  formData: FormData,
): Promise<CropCycleActionState> {
  const locale = getLocale(formData);
  const dictionary = getDictionary(locale).cropCycles;
  const validated = readCycleInput(formData);

  if (!validated.success) {
    return {
      message: dictionary.errors.invalidForm,
      errors: localizeValidationErrors(locale, validated.errors),
    };
  }

  const workspace = await getMutationWorkspace(locale);
  if (!canEditCropCycles(workspace.role)) {
    return { message: dictionary.errors.forbiddenEdit };
  }

  const { supabase, plot, error: plotError } = await getTrustedPlot(
    workspace.farm.id,
    validated.data.plotId,
  );
  if (plotError || !plot) return { message: dictionary.errors.invalidPlot };

  if (
    !validateAreaWithinPlot(
      validated.data.cultivatedAreaHectares,
      plot.area_hectares,
    )
  ) {
    return {
      message: dictionary.errors.invalidForm,
      errors: { cultivatedAreaHectares: dictionary.errors.areaExceedsPlot },
    };
  }

  const { data, error } = await supabase
    .from("crop_cycles")
    .insert({
      farm_id: workspace.farm.id,
      activity_id: plot.activity_id,
      plot_id: plot.id,
      crop_name: validated.data.cropName,
      started_on: validated.data.plantedOn,
      expected_harvest_on: validated.data.expectedHarvestOn,
      actual_harvest_on: validated.data.actualHarvestOn,
      cultivated_area_hectares: validated.data.cultivatedAreaHectares,
      status: validated.data.status,
      notes: validated.data.notes,
    })
    .select("id")
    .single<{ id: string }>();

  if (error?.code === "23514") {
    return { message: dictionary.errors.areaOrDateChanged };
  }
  if (error || !data) return { message: dictionary.errors.createFailed };

  revalidateCropCyclePaths(locale, data.id);
  redirect(`/${locale}/app/crop-cycles/${data.id}?success=created`);
}

export async function updateCropCycle(
  cycleId: string,
  _previousState: CropCycleActionState,
  formData: FormData,
): Promise<CropCycleActionState> {
  const locale = getLocale(formData);
  const dictionary = getDictionary(locale).cropCycles;
  if (!isUuid(cycleId)) return { message: dictionary.errors.notFound };

  const validated = readCycleInput(formData);
  if (!validated.success) {
    return {
      message: dictionary.errors.invalidForm,
      errors: localizeValidationErrors(locale, validated.errors),
    };
  }

  const workspace = await getMutationWorkspace(locale);
  if (!canEditCropCycles(workspace.role)) {
    return { message: dictionary.errors.forbiddenEdit };
  }

  const { supabase, plot, error: plotError } = await getTrustedPlot(
    workspace.farm.id,
    validated.data.plotId,
  );
  if (plotError || !plot) return { message: dictionary.errors.invalidPlot };

  if (
    !validateAreaWithinPlot(
      validated.data.cultivatedAreaHectares,
      plot.area_hectares,
    )
  ) {
    return {
      message: dictionary.errors.invalidForm,
      errors: { cultivatedAreaHectares: dictionary.errors.areaExceedsPlot },
    };
  }

  const { data, error } = await supabase
    .from("crop_cycles")
    .update({
      activity_id: plot.activity_id,
      plot_id: plot.id,
      crop_name: validated.data.cropName,
      started_on: validated.data.plantedOn,
      expected_harvest_on: validated.data.expectedHarvestOn,
      actual_harvest_on: validated.data.actualHarvestOn,
      cultivated_area_hectares: validated.data.cultivatedAreaHectares,
      status: validated.data.status,
      notes: validated.data.notes,
    })
    .eq("farm_id", workspace.farm.id)
    .eq("id", cycleId)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error?.code === "23514") {
    return { message: dictionary.errors.areaOrDateChanged };
  }
  if (error?.code === "23503") {
    return { message: dictionary.errors.updateRelated };
  }
  if (error) return { message: dictionary.errors.updateFailed };
  if (!data) return { message: dictionary.errors.notFound };

  revalidateCropCyclePaths(locale, cycleId);
  redirect(`/${locale}/app/crop-cycles/${cycleId}?success=updated`);
}

export async function deleteCropCycle(
  cycleId: string,
  _previousState: CropCycleActionState,
  formData: FormData,
): Promise<CropCycleActionState> {
  const locale = getLocale(formData);
  const dictionary = getDictionary(locale).cropCycles;
  if (!isUuid(cycleId)) return { message: dictionary.errors.notFound };

  const workspace = await getMutationWorkspace(locale);
  if (!canDeleteCropCycles(workspace.role)) {
    return { message: dictionary.errors.forbiddenDelete };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crop_cycles")
    .delete()
    .eq("farm_id", workspace.farm.id)
    .eq("id", cycleId)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error?.code === "23503") {
    return { message: dictionary.errors.deleteRelated };
  }
  if (error) return { message: dictionary.errors.deleteFailed };
  if (!data) return { message: dictionary.errors.notFound };

  revalidateCropCyclePaths(locale);
  redirect(`/${locale}/app/crop-cycles?success=deleted`);
}
