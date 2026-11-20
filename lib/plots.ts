import "server-only";

import type { Locale } from "@/i18n/config";
import { isUuid } from "@/lib/plot-validation";
import { getCurrentWorkspace } from "@/lib/workspace";
import { createClient } from "@/utils/supabase/server";
import { getActivityOptions } from "@/lib/activities";
import type { ActivityOption } from "@/lib/activity-service";

export type PlotRecord = {
  id: string;
  activity_id: string | null;
  name: string;
  area_hectares: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export async function listCurrentFarmPlots(locale: Locale) {
  const workspace = await getCurrentWorkspace(locale);

  if (!workspace.farm) {
    return { workspace, plots: [] as PlotRecord[], error: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plots")
    .select("id, activity_id, name, area_hectares, notes, created_at, updated_at")
    .eq("farm_id", workspace.farm.id)
    .order("name", { ascending: true })
    .returns<PlotRecord[]>();

  return { workspace, plots: data ?? [], error };
}

export async function getCurrentFarmPlot(locale: Locale, plotId: string) {
  const workspace = await getCurrentWorkspace(locale);

  if (!workspace.farm || !isUuid(plotId)) {
    return { workspace, plot: null, activities: [] as ActivityOption[], error: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plots")
    .select("id, activity_id, name, area_hectares, notes, created_at, updated_at")
    .eq("farm_id", workspace.farm.id)
    .eq("id", plotId)
    .maybeSingle<PlotRecord>();

  const options = await getActivityOptions(supabase, workspace.farm.id);
  return { workspace, plot: data, activities: options.data ?? [], error: error ?? options.error };
}
