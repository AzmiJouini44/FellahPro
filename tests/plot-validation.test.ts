import assert from "node:assert/strict";
import test from "node:test";

import {
  canDeletePlots,
  canEditPlots,
  isUuid,
  validatePlotInput,
} from "../lib/plot-validation";

test("plot input accepts schema-supported fields and normalizes values", () => {
  const result = validatePlotInput({
    name: "  Oliveraie   nord  ",
    areaHectares: "12,375",
    notes: "  Accès par la route nord.  ",
  });

  assert.deepEqual(result, {
    success: true,
    data: {
      name: "Oliveraie nord",
      areaHectares: 12.375,
      notes: "Accès par la route nord.",
    },
  });
});

test("plot input accepts Arabic digits and an empty optional note", () => {
  const result = validatePlotInput({
    name: "قطعة الزيتون",
    areaHectares: "١٢٫٥",
    notes: " ",
  });

  assert.deepEqual(result, {
    success: true,
    data: {
      name: "قطعة الزيتون",
      areaHectares: 12.5,
      notes: null,
    },
  });
});

test("plot input rejects invalid names, precision, bounds, and oversized notes", () => {
  const result = validatePlotInput({
    name: "x",
    areaHectares: "1.2345",
    notes: "n".repeat(2001),
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.deepEqual(result.errors, {
      name: "invalid",
      areaHectares: "invalid",
      notes: "too_long",
    });
  }

  assert.equal(
    validatePlotInput({ name: "Valid", areaHectares: "1000000000", notes: "" })
      .success,
    false,
  );
});

test("plot role capabilities match the existing RLS policy matrix", () => {
  assert.equal(canEditPlots("owner"), true);
  assert.equal(canEditPlots("worker"), true);
  assert.equal(canEditPlots("accountant"), false);
  assert.equal(canDeletePlots("owner"), true);
  assert.equal(canDeletePlots("worker"), false);
  assert.equal(canDeletePlots("accountant"), false);
});

test("plot identifiers must be UUIDs before database access", () => {
  assert.equal(isUuid("34000000-0000-0000-0000-000000000001"), true);
  assert.equal(isUuid("../../another-farm"), false);
  assert.equal(isUuid("not-a-uuid"), false);
});
