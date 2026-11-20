import { isUuid } from "@/lib/plot-validation";
import { validateActivityAssignment } from "./activity-validation";

export const cropCycleStatuses = [
  "planned",
  "active",
  "completed",
  "cancelled",
] as const;

export type CropCycleStatus = (typeof cropCycleStatuses)[number];

export type CropCycleInput = {
  plotId: string;
  cropName: string;
  plantedOn: string;
  expectedHarvestOn: string;
  actualHarvestOn: string | null;
  cultivatedAreaHectares: number;
  status: CropCycleStatus;
  notes: string | null;
  activityId?: string | null;
};

export type CropCycleValidationErrors = Partial<
  Record<
    | "plotId"
    | "activityId"
    | "cropName"
    | "plantedOn"
    | "expectedHarvestOn"
    | "actualHarvestOn"
    | "cultivatedAreaHectares"
    | "status"
    | "notes",
    "invalid" | "too_long" | "required" | "date_order" | "exceeds_plot"
  >
>;

type CropCycleValidationResult =
  | { success: true; data: CropCycleInput }
  | { success: false; errors: CropCycleValidationErrors };

const MAX_AREA_HECTARES = 999_999_999.999;
const MAX_NOTES_LENGTH = 2_000;

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

function normalizeDecimal(value: string) {
  return normalizeDigits(value).replace(/[،,٫]/g, ".");
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isCropCycleStatus(value: string): value is CropCycleStatus {
  return cropCycleStatuses.includes(value as CropCycleStatus);
}

export function validateCropCycleInput(input: {
  plotId: unknown;
  cropName: unknown;
  plantedOn: unknown;
  expectedHarvestOn: unknown;
  actualHarvestOn: unknown;
  cultivatedAreaHectares: unknown;
  status: unknown;
  notes: unknown;
  activityId?: unknown;
}): CropCycleValidationResult {
  const plotId = readString(input.plotId).trim();
  const cropName = readString(input.cropName).trim().replace(/\s+/g, " ");
  const plantedOn = normalizeDigits(readString(input.plantedOn).trim());
  const expectedHarvestOn = normalizeDigits(
    readString(input.expectedHarvestOn).trim(),
  );
  const actualHarvestText = normalizeDigits(
    readString(input.actualHarvestOn).trim(),
  );
  const areaText = normalizeDecimal(
    readString(input.cultivatedAreaHectares).trim(),
  );
  const statusText = readString(input.status).trim();
  const notesText = readString(input.notes).trim();
  const errors: CropCycleValidationErrors = {};
  const assignment = validateActivityAssignment(input.activityId);
  if (!assignment.success) errors.activityId = "invalid";

  if (!isUuid(plotId)) errors.plotId = "invalid";
  if (cropName.length < 2 || cropName.length > 120) errors.cropName = "invalid";
  if (!isIsoDate(plantedOn)) errors.plantedOn = "invalid";
  if (!isIsoDate(expectedHarvestOn)) errors.expectedHarvestOn = "invalid";
  if (!isCropCycleStatus(statusText)) errors.status = "invalid";

  const area = Number(areaText);
  if (
    !/^\d{1,9}(?:\.\d{1,3})?$/.test(areaText) ||
    !Number.isFinite(area) ||
    area < 0 ||
    area > MAX_AREA_HECTARES
  ) {
    errors.cultivatedAreaHectares = "invalid";
  }

  if (notesText.length > MAX_NOTES_LENGTH) errors.notes = "too_long";

  if (
    isIsoDate(plantedOn) &&
    isIsoDate(expectedHarvestOn) &&
    expectedHarvestOn < plantedOn
  ) {
    errors.expectedHarvestOn = "date_order";
  }

  let actualHarvestOn: string | null = null;
  if (statusText === "completed") {
    if (!actualHarvestText) {
      errors.actualHarvestOn = "required";
    } else if (!isIsoDate(actualHarvestText)) {
      errors.actualHarvestOn = "invalid";
    } else if (isIsoDate(plantedOn) && actualHarvestText < plantedOn) {
      errors.actualHarvestOn = "date_order";
    } else {
      actualHarvestOn = actualHarvestText;
    }
  } else if (actualHarvestText) {
    errors.actualHarvestOn = "invalid";
  }

  if (Object.keys(errors).length > 0 || !isCropCycleStatus(statusText)) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      plotId,
      cropName,
      plantedOn,
      expectedHarvestOn,
      actualHarvestOn,
      cultivatedAreaHectares: area,
      status: statusText,
      notes: notesText || null,
      ...(assignment.success && assignment.activityId !== undefined ? { activityId: assignment.activityId } : {}),
    },
  };
}

export function validateAreaWithinPlot(
  cultivatedAreaHectares: number,
  plotAreaHectares: number,
) {
  return cultivatedAreaHectares <= plotAreaHectares;
}

export function canEditCropCycles(role: string | null): role is "owner" | "worker" {
  return role === "owner" || role === "worker";
}

export function canDeleteCropCycles(role: string | null): role is "owner" {
  return role === "owner";
}
