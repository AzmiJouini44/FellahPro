import assert from "node:assert/strict";
import test from "node:test";
import {
  canDeleteTasks, canEditTasks, getTaskDates, getTaskDueState, taskPriorities,
  taskStatuses, taskListQuery, taskQuery, validateTaskFilters, validateTaskInput,
} from "../lib/task-validation";

const input = {
  title: "  Vérifier   l’irrigation  ", description: "", dueOn: "",
  activityId: "", cropCycleId: "", animalGroupId: "", assignedTo: "",
  status: "a_faire", priority: "normale",
};
const id = "10000000-0000-0000-0000-000000000001";

test("task validation accepts existing statuses/priorities and optional fields without new schema values", () => {
  for (const status of taskStatuses) for (const priority of taskPriorities) {
    const result = validateTaskInput({ ...input, status, priority });
    assert.ok(result.success);
    if (result.success) {
      assert.equal(result.data.title, "Vérifier l’irrigation");
      for (const key of ["description", "dueOn", "activityId", "cropCycleId", "animalGroupId", "assignedTo"] as const) {
        assert.equal(result.data[key], null);
      }
    }
  }
});

test("tasks accept past due dates and Arabic calendar digits without confusing due dates with audit timestamps", () => {
  const result = validateTaskInput({ ...input, title: "مراقبة الري", dueOn: "٢٠٢٤-٠٢-٢٩", description: "  ملاحظات  " });
  assert.ok(result.success);
  if (result.success) {
    assert.equal(result.data.dueOn, "2024-02-29");
    assert.equal(result.data.description, "ملاحظات");
  }
  assert.equal(validateTaskInput({ ...input, dueOn: "2026-02-30" }).success, false);
  assert.equal(validateTaskInput({ ...input, dueOn: "0000-01-01" }).success, false);
});

test("task inputs reject malformed fields, redundant overdue status, invalid priorities and competing links", () => {
  for (const change of [
    { title: " " }, { title: "x" }, { title: "x".repeat(121) }, { title: {} },
    { description: "d".repeat(2001) }, { description: {} }, { dueOn: [] },
    { status: "overdue" }, { status: "completed" }, { priority: "urgent" },
    { activityId: "../farm-b" }, { cropCycleId: "invalid" }, { animalGroupId: {} }, { assignedTo: "owner" },
  ]) assert.equal(validateTaskInput({ ...input, ...change }).success, false);
  const both = validateTaskInput({ ...input, cropCycleId: id, animalGroupId: id });
  assert.ok(!both.success);
  if (!both.success) assert.equal(both.errors.cropCycleId, "exclusive");
  assert.equal(canEditTasks("owner"), true);
  assert.equal(canEditTasks("worker"), true);
  assert.equal(canEditTasks("accountant"), false);
  assert.equal(canDeleteTasks("worker"), false);
  assert.equal(canDeleteTasks("owner"), true);
});

test("reminders switch at Tunisian midnight, including leap-day and year boundaries", () => {
  assert.equal(getTaskDates(new Date("2026-11-19T22:59:59Z")).today, "2026-11-19");
  assert.deepEqual(getTaskDates(new Date("2026-11-19T23:00:00Z")), { today: "2026-11-20", upcomingThrough: "2026-11-26" });
  assert.equal(getTaskDates(new Date("2024-02-28T12:00:00Z")).upcomingThrough, "2024-03-05");
  assert.equal(getTaskDates(new Date("2026-12-29T12:00:00Z")).upcomingThrough, "2027-01-04");
});

test("overdue/upcoming indicators exclude completed and cancelled tasks and handle no due date", () => {
  const dates = getTaskDates(new Date("2026-11-20T12:00:00Z"));
  const state = (due_on: string | null, status: (typeof taskStatuses)[number] = "a_faire") => getTaskDueState({ due_on, status }, dates);
  assert.equal(state("2026-11-19"), "overdue");
  assert.equal(state("2026-11-20"), "today");
  assert.equal(state("2026-11-26", "en_cours"), "upcoming");
  assert.equal(state("2026-11-27"), "scheduled");
  assert.equal(state(null), "noDue");
  assert.equal(state("2026-11-01", "terminee"), "completed");
  assert.equal(state("2026-11-01", "annulee"), "cancelled");
});

test("task filters validate UUIDs, dates, pagination and canonical view values", () => {
  for (const changes of [
    { view: ["mine"] }, { status: "overdue" }, { priority: "high" }, { assignee: "intruder" },
    { animalGroupId: "../private" }, { animalGroupId: [id] },
    { dueFrom: "2026-02-30" }, { dueFrom: "2026-12-01", dueTo: "2026-01-01" },
    { page: "0" }, { page: "1e2" }, { page: "1000000" }, { search: "x".repeat(121) },
  ]) assert.equal(validateTaskFilters(changes).success, false);
  const validated = validateTaskFilters({ view: "mine", assignee: "unassigned", animalGroupId: id, status: "en_cours", priority: "haute", dueFrom: "٢٠٢٦-١١-٢٠", page: "2" });
  assert.ok(validated.success);
  if (validated.success) {
    const query = taskQuery(validated.data, id, getTaskDates(new Date("2026-11-20T12:00:00Z")));
    assert.equal(query.assignedTo, id, "mine uses the server identity, not the submitted assignee");
    assert.equal(query.dueFrom, "2026-11-20");
    assert.equal(query.animalGroupId, id);
    assert.match(taskListQuery(validated.data, { page: 3 }), /animalGroupId=/);
    assert.match(taskListQuery(validated.data, { view: "all", page: 1 }), /priority=haute/);
  }
});
