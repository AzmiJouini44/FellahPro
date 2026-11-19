export type PlotRole = "owner" | "worker" | "accountant";

export type PlotInput = {
  name: string;
  areaHectares: number;
  notes: string | null;
};

export type PlotValidationErrors = {
  name?: "invalid";
  areaHectares?: "invalid";
  notes?: "too_long";
};

type PlotValidationResult =
  | { success: true; data: PlotInput }
  | { success: false; errors: PlotValidationErrors };

const MAX_AREA_HECTARES = 999_999_999.999;
const MAX_NOTES_LENGTH = 2_000;

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[،,٫]/g, ".");
}

export function validatePlotInput(input: {
  name: unknown;
  areaHectares: unknown;
  notes: unknown;
}): PlotValidationResult {
  const name = readString(input.name).trim().replace(/\s+/g, " ");
  const areaText = normalizeDigits(readString(input.areaHectares).trim());
  const notesText = readString(input.notes).trim();
  const errors: PlotValidationErrors = {};

  if (name.length < 2 || name.length > 120) {
    errors.name = "invalid";
  }

  if (!/^\d{1,9}(?:\.\d{1,3})?$/.test(areaText)) {
    errors.areaHectares = "invalid";
  }

  const areaHectares = Number(areaText);

  if (
    !Number.isFinite(areaHectares) ||
    areaHectares < 0 ||
    areaHectares > MAX_AREA_HECTARES
  ) {
    errors.areaHectares = "invalid";
  }

  if (notesText.length > MAX_NOTES_LENGTH) {
    errors.notes = "too_long";
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      name,
      areaHectares,
      notes: notesText.length > 0 ? notesText : null,
    },
  };
}

export function canEditPlots(role: string | null): role is "owner" | "worker" {
  return role === "owner" || role === "worker";
}

export function canDeletePlots(role: string | null): role is "owner" {
  return role === "owner";
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}
