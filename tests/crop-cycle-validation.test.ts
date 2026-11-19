import assert from "node:assert/strict";
import test from "node:test";

import {
  canDeleteCropCycles,
  canEditCropCycles,
  validateAreaWithinPlot,
  validateCropCycleInput,
} from "../lib/crop-cycle-validation";

const validInput = {
  plotId: "34000000-0000-0000-0000-000000000001",
  cropName: "Blé dur",
  plantedOn: "2026-11-01",
  expectedHarvestOn: "2027-06-15",
  actualHarvestOn: "",
  cultivatedAreaHectares: "2,375",
  status: "active",
  notes: "Parcelle irriguée",
};

test("crop cycle validation accepts schema fields and French decimals", () => {
  assert.deepEqual(validateCropCycleInput(validInput), {
    success: true,
    data: {
      plotId: validInput.plotId,
      cropName: "Blé dur",
      plantedOn: "2026-11-01",
      expectedHarvestOn: "2027-06-15",
      actualHarvestOn: null,
      cultivatedAreaHectares: 2.375,
      status: "active",
      notes: "Parcelle irriguée",
    },
  });
});

test("crop cycle validation accepts Arabic digits for dates and area", () => {
  const result = validateCropCycleInput({
    ...validInput,
    cropName: "قمح صلب",
    plantedOn: "٢٠٢٦-١١-٠١",
    expectedHarvestOn: "٢٠٢٧-٠٦-١٥",
    cultivatedAreaHectares: "٢٫٣٧٥",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.plantedOn, "2026-11-01");
    assert.equal(result.data.cultivatedAreaHectares, 2.375);
  }
});

test("expected and actual harvest dates cannot precede planting", () => {
  const expected = validateCropCycleInput({
    ...validInput,
    expectedHarvestOn: "2026-10-31",
  });
  assert.equal(expected.success, false);
  if (!expected.success) assert.equal(expected.errors.expectedHarvestOn, "date_order");

  const actual = validateCropCycleInput({
    ...validInput,
    status: "completed",
    actualHarvestOn: "2026-10-31",
  });
  assert.equal(actual.success, false);
  if (!actual.success) assert.equal(actual.errors.actualHarvestOn, "date_order");
});

test("completed cycles require an actual harvest and other statuses reject one", () => {
  const missing = validateCropCycleInput({ ...validInput, status: "completed" });
  assert.equal(missing.success, false);
  if (!missing.success) assert.equal(missing.errors.actualHarvestOn, "required");

  const premature = validateCropCycleInput({
    ...validInput,
    actualHarvestOn: "2027-06-10",
  });
  assert.equal(premature.success, false);
  if (!premature.success) assert.equal(premature.errors.actualHarvestOn, "invalid");
});

test("plot IDs, precision, notes, and plot-area limits are enforced", () => {
  const result = validateCropCycleInput({
    ...validInput,
    plotId: "../../another-farm",
    cultivatedAreaHectares: "1.2345",
    notes: "n".repeat(2001),
  });
  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.errors.plotId, "invalid");
    assert.equal(result.errors.cultivatedAreaHectares, "invalid");
    assert.equal(result.errors.notes, "too_long");
  }
  assert.equal(validateAreaWithinPlot(2.5, 2.5), true);
  assert.equal(validateAreaWithinPlot(2.501, 2.5), false);
});

test("crop cycle role capabilities match existing RLS", () => {
  assert.equal(canEditCropCycles("owner"), true);
  assert.equal(canEditCropCycles("worker"), true);
  assert.equal(canEditCropCycles("accountant"), false);
  assert.equal(canDeleteCropCycles("owner"), true);
  assert.equal(canDeleteCropCycles("worker"), false);
  assert.equal(canDeleteCropCycles("accountant"), false);
});
