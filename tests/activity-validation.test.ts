import assert from "node:assert/strict";
import test from "node:test";
import {
  activityAssignmentPatch, activityKinds, activityListQuery, canManageActivities,
  escapeActivitySearch, newCycleActivity, validateActivityAssignment,
  validateActivityFilters, validateActivityInput,
} from "../lib/activity-validation";

test("economic activities accept exactly the existing kinds and normalize names", () => {
  for (const kind of activityKinds) {
    assert.deepEqual(validateActivityInput({ name: "  نشاط   فلاحي  ", kind, isActive: "true" }), {
      success: true, data: { name: "نشاط فلاحي", kind, isActive: true },
    });
  }
  assert.equal(validateActivityInput({ name: "Olives", kind: "culture", isActive: "false" }).success, true);
});

test("activity fields reject nonstrings, unknown kinds, invalid booleans and name bounds", () => {
  for (const name of [null, {}, " ", "x", "x".repeat(121)]) {
    assert.equal(validateActivityInput({ name, kind: "culture", isActive: "true" }).success, false);
  }
  for (const isActive of [null, true, "on", "owner", ""]) {
    assert.equal(validateActivityInput({ name: "Olives", kind: "culture", isActive }).success, false);
  }
  assert.equal(validateActivityInput({ name: "Olives", kind: "field_operation", isActive: "true" }).success, false);
  for (const role of ["worker", "accountant", "admin", null]) assert.equal(canManageActivities(role), false);
  assert.equal(canManageActivities("owner"), true);
});

test("activity assignment distinguishes preservation, explicit unassignment and UUID selection", () => {
  const id = "30000000-0000-0000-0000-000000000001";
  assert.deepEqual(validateActivityAssignment(undefined), { success: true, activityId: undefined });
  assert.deepEqual(validateActivityAssignment(""), { success: true, activityId: null });
  assert.deepEqual(validateActivityAssignment(id), { success: true, activityId: id });
  for (const value of [null, {}, "../other-farm", "inherit", "not-a-uuid"]) {
    assert.equal(validateActivityAssignment(value).success, false);
  }
  assert.deepEqual(activityAssignmentPatch(undefined), {});
  assert.deepEqual(activityAssignmentPatch(null), { activity_id: null });
  assert.deepEqual(activityAssignmentPatch(id), { activity_id: id });
  assert.equal(newCycleActivity(undefined, id), id);
  assert.equal(newCycleActivity(null, id), null);
  assert.equal(newCycleActivity(id, null), id);
});

test("creation-date filters validate real dates, ranges, pagination and submitted shapes", () => {
  const valid = validateActivityFilters({ search: " olives ", kind: "culture", active: "false", createdFrom: "2026-01-01", createdTo: "2026-12-31", page: "2" });
  assert.equal(valid.success, true);
  if (valid.success) {
    assert.equal(valid.data.search, "olives");
    assert.equal(activityListQuery(valid.data, 3), "?search=olives&kind=culture&active=false&createdFrom=2026-01-01&createdTo=2026-12-31&page=3");
  }
  for (const input of [
    { kind: "unknown" }, { active: "yes" }, { search: "x".repeat(121) },
    { createdFrom: "2026-02-30" }, { createdTo: "0000-01-01" },
    { createdFrom: "2026-12-01", createdTo: "2026-01-01" },
    { page: "0" }, { page: "-1" }, { page: "1e2" }, { page: "1000000" }, { kind: ["culture"] },
  ]) assert.equal(validateActivityFilters(input).success, false);
  assert.equal(validateActivityFilters({ createdFrom: "2024-02-29" }).success, true);
  assert.equal(escapeActivitySearch("50%_\\"), "50\\%\\_\\\\");
});
