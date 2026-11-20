import assert from "node:assert/strict";
import test from "node:test";
import {
  canDeleteOperations,
  canEditOperations,
  canLinkOperationExpenses,
  canReadOperations,
  operationListQuery,
  operationTypes,
  operationUnits,
  validateOperationFilters,
  validateOperationInput,
} from "../lib/operation-validation";

const plot = "4a000000-0000-0000-0000-000000000001";
const now = new Date("2026-11-20T12:00:00Z");
const raw = {
  operationType: "irrigation",
  performedOn: "2026-11-20",
  plotId: plot,
  cycleId: "",
  activityId: "",
  taskId: "",
  expenseLineId: "",
  description: "",
  notes: "",
  quantity: "",
  unit: "",
};

test("field operations accept all types and keep optional details out of the required flow", () => {
  for (const operationType of operationTypes) {
    const result = validateOperationInput({ ...raw, operationType }, now);
    assert.ok(result.success);
    if (result.success)
      for (const field of [
        "cycleId",
        "activityId",
        "taskId",
        "expenseLineId",
        "description",
        "notes",
        "quantity",
        "unit",
      ] as const)
        assert.equal(result.data[field], null);
  }
  for (const patch of [
    { operationType: "culture" },
    { plotId: "" },
    { plotId: "../private" },
    { notes: [] },
    { description: "d".repeat(241) },
    { notes: "n".repeat(2001) },
  ]) {
    assert.equal(
      validateOperationInput({ ...raw, ...patch }, now).success,
      false,
    );
  }
});
test("quantities retain three decimal precision, normalize Arabic digits and require an explicit unit", () => {
  for (const unit of operationUnits)
    assert.equal(
      validateOperationInput({ ...raw, quantity: "١٢٫٥٢٥", unit }, now).success,
      true,
    );
  const result = validateOperationInput(
    { ...raw, performedOn: "٢٠٢٦-١١-٢٠", quantity: "۱۲,۵۲۵", unit: "m3" },
    now,
  );
  assert.ok(result.success);
  if (result.success) {
    assert.equal(result.data.quantity, "12.525");
    assert.equal(result.data.performedOn, "2026-11-20");
  }
  assert.equal(
    validateOperationInput(
      { ...raw, quantity: "99999999999.999", unit: "kg" },
      now,
    ).success,
    true,
  );
  for (const quantity of [
    "0",
    "-1",
    "1e3",
    "1.0001",
    "100000000000",
    "",
    "NaN",
  ])
    assert.equal(
      validateOperationInput({ ...raw, quantity, unit: "kg" }, now).success,
      false,
    );
  assert.equal(
    validateOperationInput({ ...raw, quantity: "12" }, now).success,
    false,
  );
  assert.equal(
    validateOperationInput({ ...raw, quantity: "12", unit: "money" }, now)
      .success,
    false,
  );
});
test("performed dates are historical Tunisian calendar days, including leap and midnight boundaries", () => {
  assert.equal(
    validateOperationInput({ ...raw, performedOn: "2024-02-29" }, now).success,
    true,
  );
  for (const performedOn of [
    "2026-02-30",
    "0000-01-01",
    "infinity",
    "2026-11-21",
  ])
    assert.equal(
      validateOperationInput({ ...raw, performedOn }, now).success,
      false,
    );
  assert.equal(
    validateOperationInput(raw, new Date("2026-11-19T23:00:00Z")).success,
    true,
  );
  const result = validateOperationInput(raw, new Date("2026-11-19T22:59:59Z"));
  assert.ok(!result.success);
  if (!result.success) assert.equal(result.errors.performedOn, "future");
});
test("filters validate dates, references and paging, preserving plot/cycle/task context across pages", () => {
  for (const input of [
    { plotId: [] },
    { cycleId: "../farm" },
    { type: "elevage" },
    { from: "2026-02-30" },
    { from: "2026-12-01", to: "2026-01-01" },
    { page: "0" },
    { page: "1e2" },
    { search: "x".repeat(121) },
  ])
    assert.equal(validateOperationFilters(input), null);
  const filters = validateOperationFilters({
    plotId: plot.toUpperCase(),
    taskId: plot,
    from: "٢٠٢٦-٠١-٠١",
    page: "2",
  });
  assert.ok(filters);
  if (filters) {
    assert.equal(filters.plotId, plot);
    assert.equal(filters.from, "2026-01-01");
    const query = new URLSearchParams(operationListQuery(filters, { page: 3 }));
    assert.equal(query.get("taskId"), plot);
    assert.equal(query.get("page"), "3");
  }
});
test("operations role capabilities keep accountants read-only and expense attribution owner-only", () => {
  for (const role of ["owner", "worker", "accountant"])
    assert.equal(canReadOperations(role), true);
  assert.equal(canEditOperations("worker"), true);
  assert.equal(canDeleteOperations("worker"), false);
  assert.equal(canLinkOperationExpenses("owner"), true);
  assert.equal(canLinkOperationExpenses("worker"), false);
  assert.equal(canEditOperations("accountant"), false);
  assert.equal(canReadOperations("admin"), false);
});
