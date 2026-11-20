import assert from "node:assert/strict";
import test from "node:test";
import { ACTIVITY_PAGE_SIZE, type ActivityFilters } from "../lib/activity-validation";
import {
  createActivityService, type ActivityRecord, type ActivityRepository,
  type ActivityWrite, type DatabaseResult,
} from "../lib/activity-service";

const FARM_A = "20000000-0000-0000-0000-000000000001";
const FARM_B = "20000000-0000-0000-0000-000000000002";
const ACTIVITY_A = "30000000-0000-0000-0000-000000000001";
const ACTIVITY_B = "30000000-0000-0000-0000-000000000002";
const stamp = "2026-11-01T12:00:00.000Z";
const valid = { name: "Olives", kind: "culture", isActive: "true" };
type Stored = ActivityRecord & { farmId: string };
const ok = <T>(data: T | null): DatabaseResult<T> => ({ data, error: null });

class Repository implements ActivityRepository {
  calls: Array<{ operation: string; farmId: string; id?: string }> = [];
  failure: string | null = null;
  rows: Stored[] = [
    { id: ACTIVITY_A, farmId: FARM_A, name: "Olives", kind: "culture", is_active: true, created_at: stamp, updated_at: stamp },
    { id: ACTIVITY_B, farmId: FARM_B, name: "Private", kind: "commerce", is_active: true, created_at: stamp, updated_at: stamp },
  ];
  async find(farmId: string, id: string) {
    this.calls.push({ operation: "find", farmId, id });
    return ok<ActivityRecord>(this.rows.find((row) => row.farmId === farmId && row.id === id) ?? null);
  }
  async list(farmId: string, filters: ActivityFilters) {
    this.calls.push({ operation: "list", farmId });
    const rows = this.rows.filter((row) => row.farmId === farmId &&
      (!filters.search || row.name.toLowerCase().includes(filters.search.toLowerCase())) &&
      (!filters.kind || row.kind === filters.kind) &&
      (!filters.active || row.is_active === (filters.active === "true")) &&
      (!filters.createdFrom || row.created_at >= filters.createdFrom) &&
      (!filters.createdTo || row.created_at.slice(0, 10) <= filters.createdTo));
    const start = (filters.page - 1) * ACTIVITY_PAGE_SIZE;
    return ok({ rows: rows.slice(start, start + ACTIVITY_PAGE_SIZE), count: rows.length });
  }
  async insert(farmId: string, input: ActivityWrite) {
    this.calls.push({ operation: "insert", farmId });
    const row: Stored = { ...input, farmId, id: "30000000-0000-0000-0000-000000000003", created_at: stamp, updated_at: stamp };
    this.rows.push(row);
    return ok<ActivityRecord>(row);
  }
  async update(farmId: string, id: string, input: Partial<ActivityWrite>) {
    this.calls.push({ operation: "update", farmId, id });
    if (this.failure) return { data: null, error: { code: this.failure } };
    const row = this.rows.find((row) => row.farmId === farmId && row.id === id);
    if (!row) return ok<ActivityRecord>(null);
    Object.assign(row, input);
    return ok<ActivityRecord>(row);
  }
  async remove(farmId: string, id: string) {
    this.calls.push({ operation: "remove", farmId, id });
    if (this.failure) return { data: null, error: { code: this.failure } };
    const row = this.rows.find((row) => row.farmId === farmId && row.id === id);
    if (row) this.rows = this.rows.filter((item) => item !== row);
    return ok(row ? { id } : null);
  }
  async related(farmId: string, id: string) {
    this.calls.push({ operation: "related", farmId, id });
    return ok({ plots: [], cycles: [], plotCount: 0, cycleCount: 0 });
  }
  async count(farmId: string, filter: { kind?: ActivityRecord["kind"]; active?: boolean } = {}) {
    this.calls.push({ operation: "count", farmId });
    if (this.failure) return { data: null, error: { code: this.failure } };
    return ok(this.rows.filter((row) => row.farmId === farmId &&
      (filter.kind === undefined || row.kind === filter.kind) &&
      (filter.active === undefined || row.is_active === filter.active)).length);
  }
}

test("owner application operations create, read, edit, deactivate, reactivate and delete categories", async () => {
  const repo = new Repository();
  const service = createActivityService({ farmId: FARM_A, role: "owner" }, repo);
  const created = await service.create({ ...valid, name: "  Vente  " });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const id = created.data.id;
  assert.equal((await service.get(id)).ok, true);
  const updated = await service.update(id, { ...valid, name: "Vente directe" });
  assert.equal(updated.ok && updated.data.name, "Vente directe");
  const inactive = await service.setActive(id, "false");
  assert.equal(inactive.ok && inactive.data.is_active, false);
  assert.equal((await service.get(id)).ok, true, "inactive history remains readable");
  const reactivated = await service.setActive(id, "true");
  assert.equal(reactivated.ok && reactivated.data.is_active, true);
  assert.equal((await service.remove(id)).ok, true);
  assert.deepEqual(await service.get(id), { ok: false, reason: "notFound" });
  assert.ok(repo.calls.every((call) => call.farmId === FARM_A));
});

test("workers and accountants can read but every category mutation is rejected before database access", async () => {
  for (const role of ["worker", "accountant"]) {
    const repo = new Repository();
    const service = createActivityService({ farmId: FARM_A, role }, repo);
    assert.equal((await service.list()).ok, true);
    assert.equal((await service.get(ACTIVITY_A)).ok, true);
    repo.calls = [];
    for (const result of [await service.create(valid), await service.update(ACTIVITY_A, valid),
      await service.setActive(ACTIVITY_A, "false"), await service.remove(ACTIVITY_A)]) {
      assert.deepEqual(result, { ok: false, reason: "forbidden" });
    }
    assert.deepEqual(repo.calls, []);
  }
});

test("missing membership and unknown roles fail closed, including read and statistics paths", async () => {
  for (const actor of [null, { farmId: FARM_A, role: null }, { farmId: FARM_A, role: "admin" }]) {
    const repo = new Repository();
    const service = createActivityService(actor, repo);
    for (const result of [await service.list(), await service.get(ACTIVITY_A), await service.create(valid),
      await service.summary(), await service.related(ACTIVITY_A)]) assert.equal(result.ok, false);
    assert.deepEqual(repo.calls, []);
  }
});

test("invalid UUIDs never reach queries; other-farm records cannot be read, mutated or expanded", async () => {
  const repo = new Repository();
  const service = createActivityService({ farmId: FARM_A, role: "owner" }, repo);
  for (const id of ["../other-farm", "invalid"]) {
    for (const result of [await service.get(id), await service.update(id, valid), await service.remove(id),
      await service.setActive(id, "false"), await service.related(id)]) assert.equal(result.ok, false);
  }
  assert.equal(repo.calls.length, 0);
  for (const result of [await service.get(ACTIVITY_B), await service.update(ACTIVITY_B, valid),
    await service.remove(ACTIVITY_B), await service.setActive(ACTIVITY_B, "false"), await service.related(ACTIVITY_B)]) {
    assert.deepEqual(result, { ok: false, reason: "notFound" });
  }
  assert.ok(repo.calls.every((call) => call.farmId === FARM_A));
  assert.ok(!repo.calls.some((call) => call.operation === "related"));
  assert.equal(repo.rows.find((row) => row.id === ACTIVITY_B)?.name, "Private");
});

test("submitted ownership and audit fields are excluded from the application write payload", async () => {
  const repo = new Repository();
  const service = createActivityService({ farmId: FARM_A, role: "owner" }, repo);
  const forged = { ...valid, farm_id: FARM_B, user_id: "intruder", role: "owner", created_at: "1900-01-01", id: ACTIVITY_B };
  const created = await service.create(forged);
  assert.ok(created.ok);
  if (created.ok) {
    assert.notEqual(created.data.id, ACTIVITY_B);
    assert.equal(created.data.created_at, stamp);
    assert.equal((created.data as Stored).farmId, FARM_A);
    assert.ok(!("user_id" in created.data));
    assert.ok(!("farm_id" in created.data));
  }
});

test("search, kind, inactive and creation-date filters are combined within the selected farm", async () => {
  const repo = new Repository();
  repo.rows[0].is_active = false;
  const service = createActivityService({ farmId: FARM_A, role: "accountant" }, repo);
  const result = await service.list({ search: "OLI", kind: "culture", active: "false", createdFrom: "2026-11-01", createdTo: "2026-11-01" });
  assert.ok(result.ok);
  if (result.ok) assert.deepEqual(result.data.rows.map((row) => row.id), [ACTIVITY_A]);
  assert.equal((await service.list({ search: "Private" })).ok, true);
  const page = await service.list({ page: "2" });
  if (page.ok) assert.equal(page.data.rows.length, 0);
  repo.calls = [];
  assert.deepEqual(await service.list({ createdFrom: "2026-02-30" }), { ok: false, reason: "invalidFilters" });
  assert.deepEqual(repo.calls, []);
});

test("dependency errors preserve the category and unexpected failures return safe application errors", async () => {
  const repo = new Repository();
  const service = createActivityService({ farmId: FARM_A, role: "owner" }, repo);
  repo.failure = "23503";
  assert.deepEqual(await service.remove(ACTIVITY_A), { ok: false, reason: "dependency" });
  assert.ok(repo.rows.some((row) => row.id === ACTIVITY_A));
  repo.failure = "42501";
  assert.deepEqual(await service.update(ACTIVITY_A, valid), { ok: false, reason: "failed" });
  repo.find = async () => { throw new Error("private database diagnostic"); };
  assert.deepEqual(await service.get(ACTIVITY_A), { ok: false, reason: "failed" });
});

test("dashboard statistics count all kinds and active states only for the selected farm", async () => {
  const repo = new Repository();
  repo.rows.push({ ...repo.rows[0], id: "30000000-0000-0000-0000-000000000004", kind: "elevage", is_active: false });
  const service = createActivityService({ farmId: FARM_A, role: "worker" }, repo);
  assert.deepEqual(await service.summary(), { ok: true, data: {
    total: 2, active: 1, inactive: 1, byKind: { culture: 1, elevage: 1, commerce: 0, autre: 0 },
  } });
  assert.equal(repo.calls.length, 7);
  assert.ok(repo.calls.every((call) => call.farmId === FARM_A));
  repo.failure = "network";
  assert.deepEqual(await service.summary(), { ok: false, reason: "failed" });
});
