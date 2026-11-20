import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";

import type { Locale } from "@/i18n/config";
import {
  isCropCycleStatus,
  type CropCycleStatus,
} from "@/lib/crop-cycle-validation";
import { isUuid } from "@/lib/plot-validation";
import { getCurrentWorkspace } from "@/lib/workspace";
import { createClient } from "@/utils/supabase/server";
import { getActivityOptions } from "@/lib/activities";
import type { ActivityOption } from "@/lib/activity-service";

export type CropCyclePlot = {
  id: string;
  name: string;
  area_hectares: number;
  activity_id: string | null;
};

type CropCycleRow = {
  id: string;
  activity_id: string | null;
  plot_id: string;
  crop_name: string;
  started_on: string;
  expected_harvest_on: string;
  actual_harvest_on: string | null;
  cultivated_area_hectares: number;
  status: CropCycleStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CropCycleRecord = CropCycleRow & {
  plot: CropCyclePlot | null;
};

export type CropCycleFilters = {
  status: CropCycleStatus | null;
  plotId: string | null;
  crop: string;
};

function normalizeFilters(input: {
  status?: string;
  plotId?: string;
  crop?: string;
}): CropCycleFilters {
  const status = input.status && isCropCycleStatus(input.status) ? input.status : null;
  const plotId = input.plotId && isUuid(input.plotId) ? input.plotId : null;

  return {
    status,
    plotId,
    crop: (input.crop ?? "").trim().slice(0, 80),
  };
}

function attachPlots(rows: CropCycleRow[], plots: CropCyclePlot[]) {
  const plotsById = new Map(plots.map((plot) => [plot.id, plot]));
  return rows.map((row) => ({ ...row, plot: plotsById.get(row.plot_id) ?? null }));
}

export async function listCurrentFarmCropCycles(
  locale: Locale,
  inputFilters: { status?: string; plotId?: string; crop?: string } = {},
) {
  const workspace = await getCurrentWorkspace(locale);
  const filters = normalizeFilters(inputFilters);

  if (!workspace.farm) {
    return {
      workspace,
      cycles: [] as CropCycleRecord[],
      plots: [] as CropCyclePlot[],
      filters,
      error: null as PostgrestError | null,
    };
  }

  const supabase = await createClient();
  let cyclesQuery = supabase
    .from("crop_cycles")
    .select(
      "id, activity_id, plot_id, crop_name, started_on, expected_harvest_on, actual_harvest_on, cultivated_area_hectares, status, notes, created_at, updated_at",
    )
    .eq("farm_id", workspace.farm.id)
    .order("started_on", { ascending: false });

  if (filters.status) cyclesQuery = cyclesQuery.eq("status", filters.status);
  if (filters.plotId) cyclesQuery = cyclesQuery.eq("plot_id", filters.plotId);
  if (filters.crop) cyclesQuery = cyclesQuery.ilike("crop_name", `%${filters.crop}%`);

  const [cyclesResult, plotsResult] = await Promise.all([
    cyclesQuery.returns<CropCycleRow[]>(),
    supabase
      .from("plots")
      .select("id, name, area_hectares, activity_id")
      .eq("farm_id", workspace.farm.id)
      .order("name")
      .returns<CropCyclePlot[]>(),
  ]);

  const plots = plotsResult.data ?? [];
  return {
    workspace,
    cycles: attachPlots(cyclesResult.data ?? [], plots),
    plots,
    filters,
    error: cyclesResult.error ?? plotsResult.error,
  };
}

export async function getCurrentFarmCropCycle(locale: Locale, cycleId: string) {
  const workspace = await getCurrentWorkspace(locale);

  if (!workspace.farm || !isUuid(cycleId)) {
    return {
      workspace,
      cycle: null as CropCycleRecord | null,
      activities: [] as ActivityOption[],
      plots: [] as CropCyclePlot[],
      error: null as PostgrestError | null,
    };
  }

  const supabase = await createClient();
  const [cycleResult, plotsResult, activitiesResult] = await Promise.all([
    supabase
      .from("crop_cycles")
      .select(
        "id, activity_id, plot_id, crop_name, started_on, expected_harvest_on, actual_harvest_on, cultivated_area_hectares, status, notes, created_at, updated_at",
      )
      .eq("farm_id", workspace.farm.id)
      .eq("id", cycleId)
      .maybeSingle<CropCycleRow>(),
    supabase
      .from("plots")
      .select("id, name, area_hectares, activity_id")
      .eq("farm_id", workspace.farm.id)
      .order("name")
      .returns<CropCyclePlot[]>(),
    getActivityOptions(supabase, workspace.farm.id),
  ]);

  const plots = plotsResult.data ?? [];
  return {
    workspace,
    cycle: cycleResult.data ? attachPlots([cycleResult.data], plots)[0] : null,
    activities: activitiesResult.data ?? [],
    plots,
    error: cycleResult.error ?? plotsResult.error ?? activitiesResult.error,
  };
}

export async function listCurrentFarmCropCyclePlots(locale: Locale) {
  const workspace = await getCurrentWorkspace(locale);
  if (!workspace.farm) {
    return { workspace, plots: [] as CropCyclePlot[], activities: [] as ActivityOption[], error: null as PostgrestError | null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plots")
    .select("id, name, area_hectares, activity_id")
    .eq("farm_id", workspace.farm.id)
    .order("name")
    .returns<CropCyclePlot[]>();

  const activities = await getActivityOptions(supabase, workspace.farm.id);
  return { workspace, plots: data ?? [], activities: activities.data ?? [], error: error ?? activities.error };
}

export async function getCropCycleSummary(farmId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crop_cycles")
    .select("status, actual_harvest_on")
    .eq("farm_id", farmId)
    .returns<Array<{ status: CropCycleStatus; actual_harvest_on: string | null }>>();

  if (error) {
    return { total: 0, active: 0, planned: 0, recentHarvests: 0, error };
  }

  const rows = data ?? [];
  const recentThreshold = new Date();
  recentThreshold.setUTCDate(recentThreshold.getUTCDate() - 30);
  const thresholdDate = recentThreshold.toISOString().slice(0, 10);

  return {
    total: rows.length,
    active: rows.filter((row) => row.status === "active").length,
    planned: rows.filter((row) => row.status === "planned").length,
    recentHarvests: rows.filter(
      (row) =>
        row.status === "completed" &&
        row.actual_harvest_on !== null &&
        row.actual_harvest_on >= thresholdDate,
    ).length,
    error: null,
  };
}
