import assert from "node:assert/strict";
import test from "node:test";
import type { ActivityOption, DatabaseResult } from "../lib/activity-service";
import { createLivestockService, type AnimalGroup, type AnimalEvent, type AnimalBalance,
  type LivestockRepository, type GroupWrite, type EventWrite, type LivestockActor, type LivestockLedgerLine } from "../lib/livestock-service";
import { LIVESTOCK_PAGE_SIZE, type GroupFilters, type EventFilters } from "../lib/livestock-validation";

const A = "29000000-0000-0000-0000-000000000001";
const B = "29000000-0000-0000-0000-000000000002";
const ACTIVITY = "39000000-0000-0000-0000-000000000001";
const GROUP = "69000000-0000-0000-0000-000000000001";
const OTHER = "69000000-0000-0000-0000-000000000002";
const FOREIGN = "69000000-0000-0000-0000-000000000003";
const stamp = "2026-11-20T12:00:00Z";
const clock = () => new Date(stamp);
const raw = { name: "Brebis", species: "Ovins", activityId: ACTIVITY, openingCount: "10", isActive: "true" };
const eventRaw = { kind: "naissance", eventDate: "2026-11-20", quantity: "2", notes: "Recorded birth" };
const ok = <T>(data: T | null): DatabaseResult<T> => ({ data, error: null });
type Stored = AnimalGroup & { farmId: string };
class Repository implements LivestockRepository {
  calls: Array<{ operation: string; farmId: string; id?: string; input?: unknown }> = [];
  failure: string | null = null;
  groups: Stored[] = [this.group(GROUP, A), { ...this.group(OTHER, A), species: "Bovins", is_active: false }, this.group(FOREIGN, B)];
  counts: AnimalBalance[] = [{ animal_group_id: GROUP, current_count: "12" }, { animal_group_id: OTHER, current_count: "-2" }, { animal_group_id: FOREIGN, current_count: "999" }];
  history: AnimalEvent[] = [{ id: "79000000-0000-0000-0000-000000000001", animal_group_id: GROUP, kind: "achat", event_date: "2026-01-01", quantity: 2, notes: "Original", created_at: stamp }];
  group(id: string, farmId: string): Stored { return { id, farmId, name: "Brebis", species: "Ovins", activity_id: ACTIVITY, opening_count: 10, is_active: true, created_at: stamp, updated_at: stamp }; }
  async find(farmId: string, id: string) { this.calls.push({ operation: "find", farmId, id }); return ok<AnimalGroup>(this.groups.find((group) => group.farmId === farmId && group.id === id) ?? null); }
  async allGroups(farmId: string) { this.calls.push({ operation: "allGroups", farmId }); return ok<AnimalGroup[]>(this.groups.filter((group) => group.farmId === farmId)); }
  async list(farmId: string, filters: GroupFilters) {
    this.calls.push({ operation: "list", farmId });
    const rows = this.groups.filter((group) => group.farmId === farmId && (!filters.search || group.name.includes(filters.search)) &&
      (!filters.species || group.species.includes(filters.species)) && (!filters.active || group.is_active === (filters.active === "true")));
    const start = (filters.page - 1) * LIVESTOCK_PAGE_SIZE;
    return ok({ rows: rows.slice(start, start + LIVESTOCK_PAGE_SIZE), count: rows.length });
  }
  async balances(farmId: string, ids?: string[]) {
    this.calls.push({ operation: "balances", farmId });
    if (this.failure) return { data: null, error: { code: this.failure } };
    return ok(this.counts.filter((row) => this.groups.some((group) => group.farmId === farmId && group.id === row.animal_group_id) && (!ids || ids.includes(row.animal_group_id))));
  }
  async activity(farmId: string, id: string) { this.calls.push({ operation: "activity", farmId, id }); return ok<ActivityOption>(farmId === A && id === ACTIVITY ? { id, name: "Historic category", is_active: false } : null); }
  async activities(farmId: string) { this.calls.push({ operation: "activities", farmId }); return ok<ActivityOption[]>([]); }
  async insert(farmId: string, input: GroupWrite) { this.calls.push({ operation: "insert", farmId, input }); const group = { ...this.group("69000000-0000-0000-0000-000000000010", farmId), ...input }; this.groups.push(group); return ok<AnimalGroup>(group); }
  async update(farmId: string, id: string, input: GroupWrite) {
    this.calls.push({ operation: "update", farmId, id, input });
    if (this.failure) return { data: null, error: { code: this.failure } };
    const group = this.groups.find((row) => row.farmId === farmId && row.id === id);
    if (group) Object.assign(group, input); return ok<AnimalGroup>(group ?? null);
  }
  async remove(farmId: string, id: string) {
    this.calls.push({ operation: "remove", farmId, id });
    if (this.failure) return { data: null, error: { code: this.failure } };
    const group = this.groups.find((row) => row.farmId === farmId && row.id === id);
    if (group) this.groups = this.groups.filter((row) => row !== group); return ok(group ? { id } : null);
  }
  async events(farmId: string, id: string, filters: EventFilters) {
    this.calls.push({ operation: "events", farmId, id });
    const rows = this.history.filter((row) => row.animal_group_id === id && (!filters.kind || row.kind === filters.kind) &&
      (!filters.from || row.event_date >= filters.from) && (!filters.to || row.event_date <= filters.to));
    return ok({ rows: rows.slice((filters.page - 1) * LIVESTOCK_PAGE_SIZE, filters.page * LIVESTOCK_PAGE_SIZE), count: rows.length });
  }
  async insertEvent(farmId: string, input: EventWrite) {
    this.calls.push({ operation: "insertEvent", farmId, input });
    if (this.failure) return { data: null, error: { code: this.failure } };
    const row = { ...input, id: "79000000-0000-0000-0000-000000000002", created_at: stamp }; this.history.push(row); return ok(row);
  }
  async recentEvents(farmId: string) { this.calls.push({ operation: "recent", farmId }); return ok(this.history.map((row) => ({ ...row, group: { name: "Brebis" } }))); }
  async tasks(farmId: string, id: string) { this.calls.push({ operation: "tasks", farmId, id }); return ok({ rows: [{ id: "89000000-0000-0000-0000-000000000001", title: "Check group", status: "a_faire" as const, due_on: null }], count: 1 }); }
  async ledger(farmId: string, id: string) { this.calls.push({ operation: "ledger", farmId, id }); return ok<{ rows: LivestockLedgerLine[]; count: number }>({ rows: [{ id: "99000000-0000-0000-0000-000000000001", description: "Recorded purchase", amount: "125.375", transaction: { id: "49000000-0000-0000-0000-000000000001", kind: "depense", transaction_date: "2026-01-01", reference: "INV-1" } }], count: 1 }); }
}
function setup(role: string | null = "owner") { const repository = new Repository(); return { repository, service: createLivestockService({ farmId: A, role }, repository, clock) }; }

test("owner group CRUD permits inactive same-farm activities and allowlists writes", async () => {
  const { repository, service } = setup();
  const forged = { ...raw, farm_id: B, role: "worker", created_at: "1900-01-01", current_count: 999 };
  const created = await service.create(forged);
  assert.ok(created.ok); if (!created.ok) return;
  const write = repository.calls.find((call) => call.operation === "insert")!;
  assert.equal(write.farmId, A); assert.deepEqual(Object.keys(write.input as object).sort(), ["activity_id", "is_active", "name", "opening_count", "species"]);
  const updated = await service.update(created.data.id, { ...raw, name: "Archived", isActive: "false" });
  assert.equal(updated.ok && updated.data.is_active, false);
  assert.ok((await service.remove(created.data.id)).ok);
  assert.ok(repository.calls.every((call) => call.farmId === A));
});

test("workers record events but cannot manage groups; accountants read without any write access", async () => {
  for (const role of ["worker", "accountant"]) {
    const { service, repository } = setup(role);
    assert.ok((await service.list()).ok); assert.ok((await service.get(GROUP)).ok); assert.ok((await service.events(GROUP)).ok);
    repository.calls = [];
    for (const response of [await service.create(raw), await service.update(GROUP, raw), await service.remove(GROUP)]) assert.deepEqual(response, { ok: false, reason: "forbidden" });
    assert.equal(repository.calls.length, 0);
    assert.equal((await service.recordEvent(GROUP, eventRaw)).ok, role === "worker");
  }
});

test("new events append to history and use only the authorized parent and supported fields", async () => {
  const { service, repository } = setup(); const original = structuredClone(repository.history);
  const forged = { ...eventRaw, farm_id: B, animal_group_id: FOREIGN, created_at: "1900-01-01", amount: "999" };
  const created = await service.recordEvent(GROUP, forged);
  assert.ok(created.ok); assert.deepEqual(repository.history.slice(0, original.length), original);
  assert.equal(repository.history.at(-1)?.animal_group_id, GROUP);
  const input = repository.calls.at(-1)!.input as object;
  assert.deepEqual(Object.keys(input).sort(), ["animal_group_id", "event_date", "kind", "notes", "quantity"]);
  await service.update(GROUP, { ...raw, name: "Renamed group", openingCount: "15" });
  assert.deepEqual(repository.history.slice(0, original.length), original);
});

test("cross-farm targets and invalid UUIDs never expand history, tasks, finances or mutate data", async () => {
  const { service, repository } = setup();
  for (const id of ["../private", FOREIGN]) {
    for (const response of [await service.get(id), await service.events(id), await service.tasks(id), await service.ledger(id),
      await service.recordEvent(id, eventRaw), await service.update(id, raw), await service.remove(id)]) assert.equal(response.ok, false);
  }
  assert.ok(repository.calls.every((call) => call.operation === "find" && call.farmId === A));
  repository.calls = [];
  assert.equal((await service.create({ ...raw, activityId: FOREIGN })).ok, false);
  assert.ok(!repository.calls.some((call) => call.operation === "insert"));
});

test("group lists and summaries use SQL balances, keep negative alerts and include inactive history", async () => {
  const { service } = setup();
  const rows = await service.list({ species: "Bovins", active: "false" });
  assert.ok(rows.ok); if (rows.ok) { assert.equal(rows.data.count, 1); assert.equal(rows.data.rows[0].current_count, "-2"); }
  const summary = await service.summary(); assert.ok(summary.ok);
  if (summary.ok) {
    assert.equal(summary.data.animals, "10"); assert.equal(summary.data.groups, 2); assert.equal(summary.data.active, 1); assert.equal(summary.data.negativeGroups, 1);
    assert.deepEqual(summary.data.bySpecies, [{ species: "Ovins", groups: 1, animals: "12" }, { species: "Bovins", groups: 1, animals: "-2" }]);
  }
});

test("missing, unsafe or failed SQL counts return errors instead of fabricated balances", async () => {
  for (const value of ["missing", "unsafe", "database"]) {
    const { service, repository } = setup();
    if (value === "missing") repository.counts = [];
    if (value === "unsafe") repository.counts[0].current_count = 9007199254740992;
    if (value === "database") repository.failure = "42501";
    assert.deepEqual(await service.get(GROUP), { ok: false, reason: "failed" });
    assert.deepEqual(await service.summary(), { ok: false, reason: "failed" });
  }
});

test("group and event pagination keeps exact totals while summaries include records beyond page one", async () => {
  const { service, repository } = setup();
  for (let index = 0; index < 30; index++) {
    const id = `69000000-0000-0000-0000-${String(100 + index).padStart(12, "0")}`;
    repository.groups.push(repository.group(id, A));
    repository.counts.push({ animal_group_id: id, current_count: "1" });
    repository.history.push({ ...repository.history[0], id: `79000000-0000-0000-0000-${String(100 + index).padStart(12, "0")}` });
  }
  const first = await service.list(); const second = await service.list({ page: "2" });
  assert.ok(first.ok && second.ok);
  if (first.ok && second.ok) {
    assert.equal(first.data.rows.length, LIVESTOCK_PAGE_SIZE); assert.equal(second.data.rows.length, 8);
    assert.equal(first.data.count, 32); assert.equal(second.data.count, 32);
    assert.equal(new Set([...first.data.rows, ...second.data.rows].map((row) => row.id)).size, 32);
  }
  const events = await service.events(GROUP, { page: "2" });
  assert.ok(events.ok); if (events.ok) { assert.equal(events.data.rows.length, 7); assert.equal(events.data.count, 31); }
  const summary = await service.summary();
  assert.ok(summary.ok); if (summary.ok) { assert.equal(summary.data.groups, 32); assert.equal(summary.data.animals, "40"); }
});

test("event filters and invalid submissions fail safely without inserting history", async () => {
  const { service, repository } = setup();
  const response = await service.events(GROUP, { kind: "achat", from: "2026-01-01", to: "2026-02-01" });
  assert.ok(response.ok); if (response.ok) assert.equal(response.data.count, 1);
  assert.equal((await service.recordEvent(GROUP, { ...eventRaw, quantity: "-1" })).ok, false);
  assert.equal((await service.recordEvent(GROUP, { ...eventRaw, eventDate: "2026-11-21" })).ok, false);
  assert.equal((await service.events(GROUP, { kind: "birth" })).ok, false);
  assert.ok(!repository.calls.some((call) => call.operation === "insertEvent"));
});

test("linked tasks and recorded ledger amounts remain read-only and scoped for all member roles", async () => {
  for (const role of ["owner", "worker", "accountant"]) {
    const { service, repository } = setup(role);
    assert.ok((await service.tasks(GROUP)).ok);
    const ledger = await service.ledger(GROUP); assert.ok(ledger.ok);
    if (ledger.ok) assert.equal(ledger.data.rows[0].amount, "125.375");
    assert.ok(repository.calls.every((call) => call.farmId === A));
    assert.ok(!repository.calls.some((call) => ["insert", "update", "insertEvent"].includes(call.operation)));
  }
});

test("dependency and network errors preserve groups/history and expose no private diagnostics", async () => {
  const { service, repository } = setup(); repository.failure = "23503";
  assert.deepEqual(await service.remove(GROUP), { ok: false, reason: "dependency" });
  assert.equal(repository.groups.length, 3); assert.equal(repository.history.length, 1);
  assert.deepEqual(await service.recordEvent(GROUP, eventRaw), { ok: false, reason: "dependency" });
  repository.find = async () => { throw Error("private database error"); };
  assert.deepEqual(await service.get(GROUP), { ok: false, reason: "failed" });
});

test("missing or unknown memberships fail closed at every livestock entry point", async () => {
  for (const actor of [null, { farmId: A, role: null }, { farmId: A, role: "admin" }] satisfies LivestockActor[]) {
    const repository = new Repository(); const service = createLivestockService(actor, repository, clock);
    for (const response of [await service.list(), await service.get(GROUP), await service.create(raw), await service.update(GROUP, raw),
      await service.remove(GROUP), await service.events(GROUP), await service.recordEvent(GROUP, eventRaw), await service.options(), await service.tasks(GROUP),
      await service.ledger(GROUP), await service.summary()]) assert.equal(response.ok, false);
    assert.equal(repository.calls.length, 0);
  }
});
