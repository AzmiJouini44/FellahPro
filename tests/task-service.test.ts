import assert from "node:assert/strict";
import test from "node:test";
import type { ActivityOption, DatabaseResult } from "../lib/activity-service";
import {
  createTaskService, type TaskActor, type TaskCycle, type TaskGroup,
  type TaskMember, type TaskRecord, type TaskRepository, type TaskWrite,
} from "../lib/task-service";
import { TASK_PAGE_SIZE, taskStatuses, type TaskQuery } from "../lib/task-validation";

const FARM_A = "28000000-0000-0000-0000-000000000001";
const FARM_B = "28000000-0000-0000-0000-000000000002";
const OWNER = "18000000-0000-0000-0000-000000000001";
const WORKER = "18000000-0000-0000-0000-000000000002";
const ACCOUNTANT = "18000000-0000-0000-0000-000000000003";
const FOREIGN_MEMBER = "18000000-0000-0000-0000-000000000004";
const ACTIVITY = "38000000-0000-0000-0000-000000000001";
const OTHER_ACTIVITY = "38000000-0000-0000-0000-000000000002";
const CYCLE = "68000000-0000-0000-0000-000000000001";
const UNCATEGORIZED = "68000000-0000-0000-0000-000000000002";
const GROUP = "78000000-0000-0000-0000-000000000001";
const FOREIGN = "98000000-0000-0000-0000-000000000009";
const TASK = "98000000-0000-0000-0000-000000000001";
const clock = () => new Date("2026-11-20T12:00:00Z");
const raw = { title: "Check irrigation", description: "", status: "a_faire", priority: "normale", dueOn: "",
  activityId: "", cropCycleId: "", animalGroupId: "", assignedTo: "" };
const ok = <T>(data: T | null): DatabaseResult<T> => ({ data, error: null });
type Stored = TaskRecord & { farmId: string };

class Repository implements TaskRepository {
  calls: Array<{ operation: string; farmId: string; id?: string; query?: TaskQuery; write?: Partial<TaskWrite> }> = [];
  failure: string | null = null;
  rows: Stored[] = [
    this.row(TASK, "a_faire", "2026-11-19", WORKER),
    this.row("98000000-0000-0000-0000-000000000002", "en_cours", "2026-11-20"),
    this.row("98000000-0000-0000-0000-000000000003", "a_faire", "2026-11-26", OWNER),
    this.row("98000000-0000-0000-0000-000000000004", "a_faire", "2026-11-27"),
    this.row("98000000-0000-0000-0000-000000000005", "terminee", "2026-11-01"),
    this.row("98000000-0000-0000-0000-000000000006", "annulee", "2026-11-01"),
    this.row("98000000-0000-0000-0000-000000000007", "en_cours", null),
    { ...this.row(FOREIGN, "a_faire", "2026-11-01", FOREIGN_MEMBER), farmId: FARM_B },
  ];
  row(id: string, status: TaskRecord["status"], due_on: string | null, assigned_to: string | null = null): Stored {
    return { id, farmId: FARM_A, title: "Check irrigation", description: null, status, due_on, assigned_to,
      priority: "normale", activity_id: null, crop_cycle_id: null, animal_group_id: null,
      created_at: "2026-11-01T12:00:00Z", updated_at: "2026-11-01T12:00:00Z" };
  }
  filtered(farmId: string, query: TaskQuery) {
    return this.rows.filter((row) => row.farmId === farmId &&
      (!query.search || row.title.toLowerCase().includes(query.search.toLowerCase())) &&
      (!query.status || row.status === query.status) && (!query.priority || row.priority === query.priority) &&
      (!query.pendingOnly || row.status === "a_faire" || row.status === "en_cours") &&
      (query.assignedTo === undefined || row.assigned_to === query.assignedTo) &&
      (!query.dueFrom || (row.due_on !== null && row.due_on >= query.dueFrom)) &&
      (!query.dueTo || (row.due_on !== null && row.due_on <= query.dueTo)) &&
      (!query.dueBefore || (row.due_on !== null && row.due_on < query.dueBefore)));
  }
  async list(farmId: string, query: TaskQuery) {
    this.calls.push({ operation: "list", farmId, query });
    const rows = this.filtered(farmId, query);
    const start = ((query.page ?? 1) - 1) * TASK_PAGE_SIZE;
    return ok({ rows: rows.slice(start, start + TASK_PAGE_SIZE), count: rows.length });
  }
  async find(farmId: string, id: string) {
    this.calls.push({ operation: "find", farmId, id });
    return ok<TaskRecord>(this.rows.find((row) => row.farmId === farmId && row.id === id) ?? null);
  }
  async insert(farmId: string, write: TaskWrite) {
    this.calls.push({ operation: "insert", farmId, write });
    if (this.failure) return { data: null, error: { code: this.failure } };
    const row = { ...this.row("98000000-0000-0000-0000-000000000010", write.status, write.due_on), ...write, farmId };
    this.rows.push(row);
    return ok<TaskRecord>(row);
  }
  async update(farmId: string, id: string, write: Partial<TaskWrite>) {
    this.calls.push({ operation: "update", farmId, id, write });
    if (this.failure) return { data: null, error: { code: this.failure } };
    const row = this.rows.find((row) => row.farmId === farmId && row.id === id);
    if (row) Object.assign(row, write);
    return ok<TaskRecord>(row ?? null);
  }
  async remove(farmId: string, id: string) {
    this.calls.push({ operation: "remove", farmId, id });
    const row = this.rows.find((row) => row.farmId === farmId && row.id === id);
    if (row) this.rows = this.rows.filter((item) => item !== row);
    return ok(row ? { id } : null);
  }
  async count(farmId: string, query: TaskQuery) {
    this.calls.push({ operation: "count", farmId, query });
    if (this.failure) return { data: null, error: { code: this.failure } };
    return ok(this.filtered(farmId, query).length);
  }
  async activity(farmId: string, id: string) {
    this.calls.push({ operation: "activity", farmId, id });
    return ok<ActivityOption>(farmId === FARM_A && [ACTIVITY, OTHER_ACTIVITY].includes(id) ? { id, name: "Historic activity", is_active: false } : null);
  }
  async cycle(farmId: string, id: string) {
    this.calls.push({ operation: "cycle", farmId, id });
    return ok<TaskCycle>(farmId === FARM_A && [CYCLE, UNCATEGORIZED].includes(id) ? {
      id, crop_name: "Olives", started_on: "2026-01-01", activity_id: id === CYCLE ? ACTIVITY : null,
    } : null);
  }
  async group(farmId: string, id: string) {
    this.calls.push({ operation: "group", farmId, id });
    return ok<TaskGroup>(farmId === FARM_A && id === GROUP ? { id, name: "Existing herd", activity_id: OTHER_ACTIVITY } : null);
  }
  async member(farmId: string, id: string) {
    this.calls.push({ operation: "member", farmId, id });
    return ok<TaskMember>(farmId === FARM_A && [OWNER, WORKER, ACCOUNTANT].includes(id) ? { id, name: "Farm member", role: id === OWNER ? "owner" : id === WORKER ? "worker" : "accountant" } : null);
  }
  async members(farmId: string) {
    this.calls.push({ operation: "members", farmId });
    return ok<TaskMember[]>([{ id: OWNER, name: "Owner", role: "owner" }]);
  }
  async options(farmId: string) {
    this.calls.push({ operation: "options", farmId });
    return ok({ activities: [], cycles: [], groups: [], members: [] });
  }
}

function setup(role: string | null = "owner", userId = OWNER) {
  const repository = new Repository();
  return { repository, service: createTaskService({ farmId: FARM_A, userId, role }, repository, clock) };
}

test("owner and worker create/edit tasks with server-controlled farm and allowlisted fields", async () => {
  for (const role of ["owner", "worker"]) {
    const { service, repository } = setup(role);
    const forged = { ...raw, farm_id: FARM_B, role: "owner", user_id: FOREIGN_MEMBER, created_at: "1900-01-01", assignedTo: WORKER };
    const created = await service.create(forged);
    assert.ok(created.ok);
    if (!created.ok) continue;
    assert.notEqual(created.data.created_at, forged.created_at);
    const write = repository.calls.find((call) => call.operation === "insert")!;
    assert.equal(write.farmId, FARM_A);
    assert.ok(!("farm_id" in write.write!) && !("role" in write.write!) && !("created_at" in write.write!));
    const edited = await service.update(created.data.id, { ...raw, title: "Updated", priority: "haute", dueOn: "2026-11-20" });
    assert.equal(edited.ok && edited.data.priority, "haute");
    assert.ok(repository.calls.every((call) => call.farmId === FARM_A));
  }
});

test("owner deletes tasks; worker/accountant mutations respect the existing matrix", async () => {
  const owner = setup();
  assert.ok((await owner.service.remove(TASK)).ok);
  const worker = setup("worker", WORKER);
  assert.deepEqual(await worker.service.remove(TASK), { ok: false, reason: "forbidden" });
  const accountant = setup("accountant", ACCOUNTANT);
  assert.ok((await accountant.service.list()).ok);
  assert.ok((await accountant.service.get(TASK)).ok);
  accountant.repository.calls = [];
  for (const result of [await accountant.service.create(raw), await accountant.service.update(TASK, raw),
    await accountant.service.setStatus(TASK, "terminee"), await accountant.service.remove(TASK)]) {
    assert.deepEqual(result, { ok: false, reason: "forbidden" });
  }
  assert.equal(accountant.repository.calls.length, 0);
});

test("status changes use only existing values and leave relationships and due dates intact", async () => {
  const { service, repository } = setup("worker", WORKER);
  repository.rows[0].assigned_to = ACCOUNTANT;
  repository.rows[0].activity_id = ACTIVITY;
  for (const status of taskStatuses) {
    const changed = await service.setStatus(TASK, status);
    assert.ok(changed.ok);
    if (changed.ok) {
      assert.equal(changed.data.status, status);
      assert.equal(changed.data.assigned_to, ACCOUNTANT);
      assert.equal(changed.data.activity_id, ACTIVITY);
      assert.equal(changed.data.due_on, "2026-11-19");
    }
    assert.deepEqual(repository.calls.at(-1)?.write, { status });
  }
  assert.equal((await service.setStatus(TASK, "overdue")).ok, false);
});

test("same-farm assignees may have any member role; non-members and cross-farm references are rejected", async () => {
  const { service, repository } = setup();
  assert.ok((await service.create({ ...raw, assignedTo: ACCOUNTANT })).ok);
  for (const change of [
    { assignedTo: FOREIGN_MEMBER }, { activityId: FOREIGN }, { cropCycleId: FOREIGN }, { animalGroupId: FOREIGN },
  ]) {
    repository.calls = [];
    const result = await service.create({ ...raw, ...change });
    assert.ok(!result.ok);
    assert.ok(!repository.calls.some((call) => call.operation === "insert"));
    assert.ok(repository.calls.every((call) => call.farmId === FARM_A));
  }
});

test("crop/animal links derive matching activity on the server and preserve inactive economic references", async () => {
  const { service } = setup();
  const crop = await service.create({ ...raw, cropCycleId: CYCLE });
  assert.equal(crop.ok && crop.data.activity_id, ACTIVITY);
  const animal = await service.create({ ...raw, animalGroupId: GROUP });
  assert.equal(animal.ok && animal.data.activity_id, OTHER_ACTIVITY);
  const mismatch = await service.create({ ...raw, cropCycleId: CYCLE, activityId: OTHER_ACTIVITY });
  assert.ok(!mismatch.ok);
  if (!mismatch.ok) assert.equal(mismatch.errors?.activityId, "mismatch");
  const unclassified = await service.create({ ...raw, cropCycleId: UNCATEGORIZED });
  assert.ok(!unclassified.ok);
  if (!unclassified.ok) assert.equal(unclassified.errors?.cropCycleId, "unclassified");
  assert.equal((await service.create({ ...raw, cropCycleId: CYCLE, animalGroupId: GROUP })).ok, false);
});

test("task editing can explicitly unassign optional fields without modifying parent records", async () => {
  const { service, repository } = setup();
  repository.rows[0] = { ...repository.rows[0], activity_id: ACTIVITY, crop_cycle_id: CYCLE, assigned_to: WORKER };
  const result = await service.update(TASK, raw);
  assert.ok(result.ok);
  if (result.ok) for (const key of ["activity_id", "crop_cycle_id", "animal_group_id", "assigned_to", "due_on"] as const) {
    assert.equal(result.data[key], null);
  }
  assert.deepEqual(repository.calls.at(-1)?.operation, "update");
});

test("invalid and foreign task UUIDs never expand or modify another farm's records", async () => {
  const { service, repository } = setup();
  for (const id of ["../farm-b", "invalid"]) {
    assert.equal((await service.get(id)).ok, false);
    assert.equal((await service.update(id, raw)).ok, false);
    assert.equal((await service.remove(id)).ok, false);
    assert.equal((await service.setStatus(id, "terminee")).ok, false);
  }
  assert.equal(repository.calls.length, 0);
  assert.deepEqual(await service.get(FOREIGN), { ok: false, reason: "notFound" });
  assert.deepEqual(await service.update(FOREIGN, raw), { ok: false, reason: "notFound" });
  assert.deepEqual(await service.setStatus(FOREIGN, "terminee"), { ok: false, reason: "notFound" });
  assert.deepEqual(await service.remove(FOREIGN), { ok: false, reason: "notFound" });
  assert.ok(repository.calls.every((call) => call.farmId === FARM_A));
});

test("pending/today/overdue/completed/upcoming counts use real matching farm records and exclude cancelled history", async () => {
  const { service } = setup("accountant", ACCOUNTANT);
  assert.deepEqual(await service.summary(), { ok: true, data: {
    pending: 5, dueToday: 1, overdue: 1, completed: 1, upcoming: 2,
    dates: { today: "2026-11-20", upcomingThrough: "2026-11-26" },
  } });
  for (const [view, expected] of [["overdue", 1], ["upcoming", 2], ["completed", 1], ["pending", 5]] as const) {
    const result = await service.list({ view });
    assert.ok(result.ok);
    if (result.ok) assert.equal(result.data.count, expected);
  }
});

test("task pagination preserves exact totals and dashboard counts beyond the first page", async () => {
  const { service, repository } = setup();
  for (let i = 0; i < 30; i++) repository.rows.push(repository.row(
    `98000000-0000-0000-0000-${String(100 + i).padStart(12, "0")}`, "a_faire", "2026-11-20",
  ));
  const first = await service.list({ page: "1" });
  const second = await service.list({ page: "2" });
  assert.ok(first.ok && second.ok);
  if (first.ok && second.ok) {
    assert.equal(first.data.rows.length, TASK_PAGE_SIZE);
    assert.equal(second.data.rows.length, 37 - TASK_PAGE_SIZE);
    assert.equal(first.data.count, 37);
    assert.equal(second.data.count, 37);
    assert.equal(new Set([...first.data.rows, ...second.data.rows].map((row) => row.id)).size, 37);
  }
  const summary = await service.summary();
  assert.ok(summary.ok);
  if (summary.ok) {
    assert.equal(summary.data.pending, 35);
    assert.equal(summary.data.dueToday, 31);
  }
});

test("summary links and counts share one Tunisian calendar day when a request spans midnight", async () => {
  const repository = new Repository();
  let calls = 0;
  const service = createTaskService({ farmId: FARM_A, userId: OWNER, role: "owner" }, repository,
    () => new Date(calls++ === 0 ? "2026-11-19T22:59:59Z" : "2026-11-19T23:00:01Z"));
  const result = await service.summary();
  assert.ok(result.ok);
  if (result.ok) {
    assert.equal(result.data.dates.today, "2026-11-19");
    assert.equal(result.data.dueToday, 1);
    assert.equal(result.data.overdue, 0);
  }
  assert.equal(calls, 1);
});

test("mine is bound to authenticated identity, even when assignee/user/farm parameters are manipulated", async () => {
  const { service, repository } = setup();
  const forged = { view: "mine", assignee: FOREIGN_MEMBER, userId: FOREIGN_MEMBER, farmId: FARM_B };
  const result = await service.list(forged);
  assert.ok(result.ok);
  if (result.ok) {
    assert.equal(result.data.rows.length, 1);
    assert.equal(result.data.rows[0].assigned_to, OWNER);
    assert.equal(result.data.filters.assignee, OWNER);
  }
  assert.equal(repository.calls.at(-1)?.query?.assignedTo, OWNER);
  assert.equal(repository.calls.at(-1)?.farmId, FARM_A);
  assert.equal((await service.list({ assignee: FOREIGN_MEMBER })).ok, false);
});

test("search, priority, due dates and unassigned filters combine; invalid input never reaches the database", async () => {
  const { service, repository } = setup();
  repository.rows[1].priority = "haute";
  const result = await service.list({ search: "irrigation", priority: "haute", dueFrom: "2026-11-20", dueTo: "2026-11-20", assignee: "unassigned" });
  assert.ok(result.ok);
  if (result.ok) assert.equal(result.data.count, 1);
  const page = await service.list({ page: "2" });
  if (page.ok) assert.equal(page.data.rows.length, 0);
  repository.calls = [];
  assert.equal((await service.create({ ...raw, title: "", priority: "urgent" })).ok, false);
  assert.equal((await service.list({ dueFrom: "2026-02-30" })).ok, false);
  assert.equal(repository.calls.length, 0);
});

test("missing membership or unexpected roles fail closed for all read/write/options/statistics entry points", async () => {
  for (const actor of [null, { farmId: FARM_A, userId: OWNER, role: null }, { farmId: FARM_A, userId: OWNER, role: "admin" }] satisfies TaskActor[]) {
    const repository = new Repository();
    const service = createTaskService(actor, repository, clock);
    for (const result of [await service.list(), await service.get(TASK), await service.create(raw),
      await service.update(TASK, raw), await service.remove(TASK), await service.setStatus(TASK, "terminee"),
      await service.summary(), await service.options(), await service.members()]) assert.equal(result.ok, false);
    assert.equal(repository.calls.length, 0);
  }
});

test("membership/reference races and database/network failures return safe errors without fabricated counts", async () => {
  const { service, repository } = setup();
  repository.failure = "23503";
  assert.deepEqual(await service.create({ ...raw, assignedTo: WORKER }), { ok: false, reason: "related" });
  repository.failure = "42501";
  assert.deepEqual(await service.setStatus(TASK, "terminee"), { ok: false, reason: "failed" });
  assert.deepEqual(await service.summary(), { ok: false, reason: "failed" });
  repository.find = async () => { throw new Error("private diagnostic"); };
  assert.deepEqual(await service.get(TASK), { ok: false, reason: "failed" });
});
