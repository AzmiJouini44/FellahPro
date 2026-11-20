import assert from "node:assert/strict";
import test from "node:test";
import { animalCount, animalEventKinds, canManageAnimalGroups, canReadLivestock, canRecordAnimalEvents,
  validateEventFilters, validateEventInput, validateGroupFilters, validateGroupInput } from "../lib/livestock-validation";

const activity = "39000000-0000-0000-0000-000000000001";
const group = { name: "  Brebis   du nord ", species: " Ovins ", openingCount: "١٢", activityId: activity, isActive: "true" };
const event = { kind: "naissance", eventDate: "٢٠٢٦-١١-٢٠", quantity: "۲", notes: "  Nouveau lot  " };
const now = new Date("2026-11-20T12:00:00Z");

test("groups validate real schema fields, Arabic integers and a mandatory economic activity", () => {
  assert.deepEqual(validateGroupInput(group), { success: true, data: { name: "Brebis du nord", species: "Ovins", openingCount: 12, activityId: activity, isActive: true } });
  for (const change of [{ name: " " }, { name: "a".repeat(121) }, { species: {} }, { species: "a".repeat(81) },
    { openingCount: "-1" }, { openingCount: "2.5" }, { openingCount: "2147483648" }, { openingCount: "" },
    { openingCount: 12 }, { activityId: "" }, { activityId: "foreign" }, { isActive: true }]) {
    assert.equal(validateGroupInput({ ...group, ...change }).success, false);
  }
  assert.equal(validateGroupInput({ ...group, openingCount: "0", isActive: "false" }).success, true);
});

test("all seven existing event kinds are supported without inventing counted transfers or adjustments", () => {
  for (const kind of animalEventKinds) assert.equal(validateEventInput({ ...event, kind }, now).success, true);
  const result = validateEventInput(event, now);
  assert.deepEqual(result, { success: true, data: { kind: "naissance", eventDate: "2026-11-20", quantity: 2, notes: "Nouveau lot" } });
  for (const change of [{ kind: "ajustement_positif" }, { quantity: "-2" }, { quantity: "1e2" }, { quantity: "1.1" },
    { quantity: "2147483648" }, { notes: {} }, { notes: "n".repeat(2001) }, { eventDate: "2026-02-30" }]) {
    assert.equal(validateEventInput({ ...event, ...change }, now).success, false);
  }
  for (const kind of ["naissance", "achat", "vente", "deces"]) assert.equal(validateEventInput({ ...event, kind, quantity: "0" }, now).success, false);
  for (const kind of ["transfert", "soin", "autre"]) assert.equal(validateEventInput({ ...event, kind, quantity: "0" }, now).success, true);
});

test("historical event dates are real calendar days and cannot be future in Tunisia", () => {
  assert.equal(validateEventInput({ ...event, eventDate: "2024-02-29" }, now).success, true);
  assert.equal(validateEventInput({ ...event, eventDate: "0000-01-01" }, now).success, false);
  const future = validateEventInput({ ...event, eventDate: "2026-11-21" }, now);
  assert.equal(future.success, false);
  if (!future.success) assert.equal(future.errors.eventDate, "future");
  assert.equal(validateEventInput(event, new Date("2026-11-19T23:00:00Z")).success, true);
  assert.equal(validateEventInput(event, new Date("2026-11-19T22:59:59Z")).success, false);
});

test("livestock permissions distinguish structural groups from event recording", () => {
  for (const role of ["owner", "worker", "accountant"]) assert.equal(canReadLivestock(role), true);
  assert.equal(canManageAnimalGroups("owner"), true);
  assert.equal(canManageAnimalGroups("worker"), false);
  assert.equal(canRecordAnimalEvents("worker"), true);
  assert.equal(canRecordAnimalEvents("accountant"), false);
  assert.equal(canReadLivestock("admin"), false);
});

test("group and event filters reject malformed shapes, dates and pages", () => {
  assert.deepEqual(validateGroupFilters({ search: " Brebis ", species: " Ovins ", active: "false", page: "2" }), { search: "Brebis", species: "Ovins", active: "false", page: 2 });
  for (const raw of [{ search: [] }, { active: "yes" }, { species: "s".repeat(81) }, { page: "0" }, { page: "1000000" }]) assert.equal(validateGroupFilters(raw), null);
  assert.deepEqual(validateEventFilters({ kind: "vente", from: "٢٠٢٦-٠١-٠١", to: "2026-11-20" }), { kind: "vente", from: "2026-01-01", to: "2026-11-20", page: 1 });
  for (const raw of [{ kind: "birth" }, { from: "2026-02-30" }, { from: "2026-11-20", to: "2026-01-01" }, { page: [] }]) assert.equal(validateEventFilters(raw), null);
});

test("SQL animal balances retain negative values and exact bigints, rejecting rounded numeric JSON", () => {
  assert.equal(animalCount(-3), "-3");
  assert.equal(animalCount("9007199254740993"), "9007199254740993");
  assert.equal(animalCount(9007199254740992), null);
  assert.equal(animalCount("1.5"), null);
});
