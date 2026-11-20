import assert from "node:assert/strict";
import test from "node:test";
import type { ActivityOption, DatabaseResult } from "../lib/activity-service";
import {
  createOperationService,
  type OperationActor,
  type OperationRecord,
  type OperationDetail,
  type OperationRepository,
  type OperationWrite,
  type OperationPlot,
  type OperationCycle,
  type OperationTask,
  type OperationExpense,
} from "../lib/operation-service";
import {
  OPERATION_PAGE_SIZE,
  type OperationFilters,
} from "../lib/operation-validation";

const FARM = "2a000000-0000-0000-0000-000000000001";
const OTHER_FARM = "2a000000-0000-0000-0000-000000000002";
const USER = "1a000000-0000-0000-0000-000000000001";
const PLOT = "4a000000-0000-0000-0000-000000000001";
const PLOT2 = "4a000000-0000-0000-0000-000000000002";
const ACTIVITY = "3a000000-0000-0000-0000-000000000001";
const ALT = "3a000000-0000-0000-0000-000000000002";
const CYCLE = "5a000000-0000-0000-0000-000000000001";
const UNCATEGORIZED = "5a000000-0000-0000-0000-000000000002";
const TASK = "8a000000-0000-0000-0000-000000000001";
const ANIMAL_TASK = "8a000000-0000-0000-0000-000000000002";
const EXPENSE = "9a000000-0000-0000-0000-000000000001";
const OP = "aa000000-0000-0000-0000-000000000001";
const FOREIGN = "aa000000-0000-0000-0000-000000000099";
const stamp = "2026-11-20T12:00:00Z";
const now = () => new Date(stamp);
const raw = {
  operationType: "irrigation",
  performedOn: "2026-11-20",
  plotId: PLOT,
  cycleId: "",
  activityId: "",
  taskId: "",
  expenseLineId: "",
  description: "",
  notes: "",
  quantity: "",
  unit: "",
};
const ok = <T>(data: T | null): DatabaseResult<T> => ({ data, error: null });
type Stored = OperationRecord & { farm: string };
class Repository implements OperationRepository {
  calls: Array<{
    method: string;
    farm: string;
    id?: string;
    input?: OperationWrite;
  }> = [];
  failure: string | null = null;
  rows: Stored[] = [this.row(OP), { ...this.row(FOREIGN), farm: OTHER_FARM }];
  expenseRow: OperationExpense = {
    id: EXPENSE,
    description: "Recorded irrigation expense",
    amount: "25.375",
    transaction_id: "6a000000-0000-0000-0000-000000000001",
    activity_id: ACTIVITY,
    crop_cycle_id: null,
    transaction_date: "2026-11-01",
    reference: "INV-1",
    operation_id: null,
  };
  row(id: string): Stored {
    return {
      id,
      farm: FARM,
      operation_type: "irrigation",
      performed_on: "2026-11-20",
      plot_id: PLOT,
      crop_cycle_id: null,
      activity_id: null,
      related_task_id: null,
      expense_line_id: null,
      description: null,
      notes: null,
      quantity: null,
      unit: null,
      created_at: stamp,
      updated_at: stamp,
    };
  }
  detail(row: Stored): OperationDetail {
    return {
      ...row,
      plot_name: "North",
      crop_name: row.crop_cycle_id ? "Olives" : null,
      activity_name: row.activity_id ? "Category" : null,
      task_title: row.related_task_id ? "Irrigate" : null,
      expense_amount: row.expense_line_id ? this.expenseRow.amount : null,
      expense_description: row.expense_line_id
        ? this.expenseRow.description
        : null,
      expense_transaction_id: row.expense_line_id
        ? this.expenseRow.transaction_id
        : null,
      expense_reference: null,
      expense_date: null,
    };
  }
  async find(farm: string, id: string) {
    this.calls.push({ method: "find", farm, id });
    const row = this.rows.find((row) => row.farm === farm && row.id === id);
    return ok(row ? this.detail(row) : null);
  }
  async list(farm: string, filters: OperationFilters) {
    this.calls.push({ method: "list", farm });
    const rows = this.rows.filter(
      (row) =>
        row.farm === farm &&
        (!filters.type || row.operation_type === filters.type) &&
        (!filters.plotId || row.plot_id === filters.plotId) &&
        (!filters.cycleId || row.crop_cycle_id === filters.cycleId) &&
        (!filters.taskId || row.related_task_id === filters.taskId) &&
        (!filters.from || row.performed_on >= filters.from) &&
        (!filters.to || row.performed_on <= filters.to) &&
        (!filters.search || row.description?.includes(filters.search)),
    );
    const start = (filters.page - 1) * OPERATION_PAGE_SIZE;
    return ok({
      rows: rows
        .slice(start, start + OPERATION_PAGE_SIZE)
        .map((row) => this.detail(row)),
      count: rows.length,
    });
  }
  async insert(farm: string, input: OperationWrite) {
    this.calls.push({ method: "insert", farm, input });
    if (this.failure) return { data: null, error: { code: this.failure } };
    const row = {
      ...this.row("aa000000-0000-0000-0000-000000000010"),
      ...input,
      farm,
    };
    this.rows.push(row);
    return ok({ id: row.id });
  }
  async update(farm: string, id: string, input: OperationWrite) {
    this.calls.push({ method: "update", farm, id, input });
    if (this.failure) return { data: null, error: { code: this.failure } };
    const row = this.rows.find((row) => row.farm === farm && row.id === id);
    if (row) Object.assign(row, input);
    return ok(row ? { id } : null);
  }
  async remove(farm: string, id: string) {
    this.calls.push({ method: "remove", farm, id });
    const row = this.rows.find((row) => row.farm === farm && row.id === id);
    if (row) this.rows = this.rows.filter((other) => other !== row);
    return ok(row ? { id } : null);
  }
  async plot(farm: string, id: string) {
    this.calls.push({ method: "plot", farm, id });
    return ok<OperationPlot>(
      farm === FARM && [PLOT, PLOT2].includes(id)
        ? { id, name: "North", activity_id: ACTIVITY }
        : null,
    );
  }
  async cycle(farm: string, id: string) {
    this.calls.push({ method: "cycle", farm, id });
    return ok<OperationCycle>(
      farm === FARM && [CYCLE, UNCATEGORIZED].includes(id)
        ? {
            id,
            crop_name: "Olives",
            plot_id: PLOT,
            activity_id: id === CYCLE ? ACTIVITY : null,
            started_on: "2026-01-01",
          }
        : null,
    );
  }
  async activity(farm: string, id: string) {
    this.calls.push({ method: "activity", farm, id });
    return ok<ActivityOption>(
      farm === FARM && [ACTIVITY, ALT].includes(id)
        ? { id, name: "Historic", is_active: false }
        : null,
    );
  }
  async task(farm: string, id: string) {
    this.calls.push({ method: "task", farm, id });
    return ok<OperationTask>(
      farm === FARM && [TASK, ANIMAL_TASK].includes(id)
        ? {
            id,
            title: "Irrigate",
            crop_cycle_id: id === TASK ? CYCLE : null,
            activity_id: ACTIVITY,
            animal_group_id: id === ANIMAL_TASK ? FOREIGN : null,
          }
        : null,
    );
  }
  async expense(farm: string, id: string) {
    this.calls.push({ method: "expense", farm, id });
    return ok<OperationExpense>(
      farm === FARM && id === EXPENSE ? this.expenseRow : null,
    );
  }
  async options(farm: string) {
    this.calls.push({ method: "options", farm });
    return ok({
      plots: [],
      cycles: [],
      activities: [],
      tasks: [],
      expenses: [],
    });
  }
  async locations(farm: string) {
    this.calls.push({ method: "locations", farm });
    return ok({ plots: [], cycles: [] });
  }
}
function setup(role: string | null = "owner") {
  const repository = new Repository();
  return {
    repository,
    service: createOperationService(
      { farmId: FARM, userId: USER, role },
      repository,
      now,
    ),
  };
}

test("owners/workers create and edit dated work with allowlisted fields and server-controlled farm/audit", async () => {
  for (const role of ["owner", "worker"]) {
    const { service, repository } = setup(role);
    const forged = {
      ...raw,
      farm_id: OTHER_FARM,
      created_by: FOREIGN,
      role: "owner",
      amount: 999,
      created_at: "1900-01-01",
    };
    const created = await service.create(forged);
    assert.ok(created.ok);
    if (!created.ok) continue;
    const write = repository.calls.at(-1)!;
    assert.equal(write.farm, FARM);
    for (const field of [
      "farm_id",
      "created_by",
      "created_at",
      "role",
      "amount",
    ])
      assert.ok(!(field in write.input!));
    assert.ok(
      (
        await service.update(created.data.id, {
          ...raw,
          description: "Done",
          quantity: "12.500",
          unit: "m3",
        })
      ).ok,
    );
    const changed = repository.rows.find((row) => row.id === created.data.id)!;
    assert.equal(changed.quantity, "12.500");
    assert.ok(repository.calls.every((call) => call.farm === FARM));
  }
});
test("accountants read without mutations, workers cannot delete, and missing/unknown membership fails closed", async () => {
  const accountant = setup("accountant");
  assert.ok((await accountant.service.list()).ok);
  assert.ok((await accountant.service.get(OP)).ok);
  accountant.repository.calls = [];
  for (const result of [
    await accountant.service.create(raw),
    await accountant.service.update(OP, raw),
    await accountant.service.remove(OP),
    await accountant.service.defaults(),
  ])
    assert.equal(result.ok, false);
  assert.equal(accountant.repository.calls.length, 0);
  assert.equal((await setup("worker").service.remove(OP)).ok, false);
  for (const actor of [
    null,
    { farmId: FARM, userId: USER, role: "admin" },
    { farmId: FARM, userId: "forged", role: "owner" },
  ] satisfies OperationActor[]) {
    const repo = new Repository();
    const service = createOperationService(actor, repo, now);
    for (const response of [
      await service.list(),
      await service.get(OP),
      await service.create(raw),
      await service.update(OP, raw),
      await service.remove(OP),
      await service.options(),
      await service.locations(),
      await service.defaults(),
    ])
      assert.equal(response.ok, false);
    assert.equal(repo.calls.length, 0);
  }
});
test("every selected reference stays in the authorized farm and a crop cycle must belong to the plot", async () => {
  const { service, repository } = setup();
  for (const patch of [
    { plotId: FOREIGN },
    { cycleId: FOREIGN },
    { activityId: FOREIGN },
    { taskId: FOREIGN },
    { expenseLineId: FOREIGN },
    { plotId: PLOT2, cycleId: CYCLE },
  ]) {
    repository.calls = [];
    assert.equal((await service.create({ ...raw, ...patch })).ok, false);
    assert.ok(!repository.calls.some((call) => call.method === "insert"));
    assert.ok(repository.calls.every((call) => call.farm === FARM));
  }
  assert.ok((await service.create({ ...raw, cycleId: UNCATEGORIZED })).ok);
  assert.ok(
    (await service.create({ ...raw, taskId: ANIMAL_TASK })).ok,
    "an explicit same-farm task link does not rewrite its existing context",
  );
});
test("operation category is an explicit classification without rewriting a plot or cycle", async () => {
  const { service, repository } = setup();
  assert.ok(
    (await service.create({ ...raw, cycleId: CYCLE, activityId: ALT })).ok,
  );
  assert.equal(repository.calls.at(-1)?.input?.activity_id, ALT);
  assert.ok(
    repository.calls.every(
      (call) =>
        !["updatePlot", "updateCycle", "updateTask"].includes(call.method),
    ),
  );
});
test("explicit expense attribution validates category/cycle and accepts only a free or own existing line", async () => {
  const { service, repository } = setup();
  assert.ok(
    (
      await service.create({
        ...raw,
        activityId: ACTIVITY,
        expenseLineId: EXPENSE,
      })
    ).ok,
  );
  assert.equal(
    (await service.create({ ...raw, expenseLineId: EXPENSE })).ok,
    false,
  );
  assert.equal(
    (await service.create({ ...raw, activityId: ALT, expenseLineId: EXPENSE }))
      .ok,
    false,
  );
  repository.expenseRow.crop_cycle_id = CYCLE;
  assert.equal(
    (
      await service.create({
        ...raw,
        activityId: ACTIVITY,
        expenseLineId: EXPENSE,
      })
    ).ok,
    false,
  );
  repository.expenseRow.operation_id = OP;
  assert.deepEqual(
    await service.create({
      ...raw,
      activityId: ACTIVITY,
      cycleId: CYCLE,
      expenseLineId: EXPENSE,
    }),
    { ok: false, reason: "expenseUsed", errors: { expenseLineId: "used" } },
  );
  assert.ok(
    (
      await service.update(OP, {
        ...raw,
        activityId: ACTIVITY,
        cycleId: CYCLE,
        expenseLineId: EXPENSE,
      })
    ).ok,
  );
});
test("workers preserve an existing expense while editing notes but cannot relink, unlink or reclassify it", async () => {
  const { service, repository } = setup("worker");
  repository.rows[0].activity_id = ACTIVITY;
  repository.rows[0].expense_line_id = EXPENSE;
  const input = {
    ...raw,
    activityId: ACTIVITY,
    expenseLineId: EXPENSE,
    notes: "New observation",
  };
  assert.ok((await service.update(OP, input)).ok);
  assert.equal(
    (await service.update(OP, { ...input, expenseLineId: "" })).ok,
    false,
  );
  assert.equal(
    (await service.update(OP, { ...input, activityId: ALT })).ok,
    false,
  );
  assert.equal((await service.create(input)).ok, false);
});
test("costs read the linked ledger amount; recording/deleting an operation never writes a ledger or completes tasks", async () => {
  const { service, repository } = setup();
  repository.rows[0].expense_line_id = EXPENSE;
  let detail = await service.get(OP);
  assert.ok(detail.ok);
  if (detail.ok) assert.equal(detail.data.expense_amount, "25.375");
  repository.expenseRow.amount = "30.125";
  detail = await service.get(OP);
  assert.ok(detail.ok);
  if (detail.ok) assert.equal(detail.data.expense_amount, "30.125");
  assert.ok((await service.remove(OP)).ok);
  assert.equal(repository.expenseRow.amount, "30.125");
  assert.ok(
    repository.calls.every((call) => ["find", "remove"].includes(call.method)),
  );
});
test("foreign or malformed operation URLs never expand options/references or perform mutations", async () => {
  const { service, repository } = setup();
  for (const id of ["../farm-b", FOREIGN])
    for (const result of [
      await service.get(id),
      await service.update(id, raw),
      await service.remove(id),
      await service.options(id),
    ])
      assert.equal(result.ok, false);
  assert.ok(
    repository.calls.every(
      (call) => call.method === "find" && call.farm === FARM,
    ),
  );
});
test("plot/cycle/task defaults come from verified records and keep uncategorized cycles unclassified", async () => {
  const { service } = setup();
  const cycle = await service.defaults({ cycleId: CYCLE });
  assert.ok(cycle.ok);
  if (cycle.ok)
    assert.deepEqual(cycle.data, {
      plotId: PLOT,
      cycleId: CYCLE,
      activityId: ACTIVITY,
      taskId: "",
    });
  const task = await service.defaults({ taskId: TASK });
  assert.ok(task.ok);
  if (task.ok) assert.equal(task.data.plotId, PLOT);
  const unclassified = await service.defaults({ cycleId: UNCATEGORIZED });
  assert.ok(unclassified.ok);
  if (unclassified.ok) assert.equal(unclassified.data.activityId, "");
  assert.equal(
    (await service.defaults({ plotId: PLOT2, cycleId: CYCLE })).ok,
    false,
  );
  assert.equal((await service.defaults({ plotId: FOREIGN })).ok, false);
  assert.equal((await service.defaults({ taskId: ANIMAL_TASK })).ok, true);
});
test("history filters and pagination stay scoped and preserve accurate matching totals", async () => {
  const { service, repository } = setup();
  repository.rows[0].crop_cycle_id = CYCLE;
  repository.rows[0].related_task_id = TASK;
  repository.rows[0].description = "Irrigation 50%";
  const result = await service.list({
    cycleId: CYCLE,
    taskId: TASK,
    type: "irrigation",
    from: "2026-11-20",
    to: "2026-11-20",
    search: "50%",
  });
  assert.ok(result.ok);
  if (result.ok) {
    assert.equal(result.data.count, 1);
    assert.equal(result.data.filters.plotId, PLOT);
  }
  for (let i = 0; i < 30; i++)
    repository.rows.push(
      repository.row(
        `aa000000-0000-0000-0000-${String(100 + i).padStart(12, "0")}`,
      ),
    );
  const second = await service.list({ page: "2" });
  assert.ok(second.ok);
  if (second.ok) {
    assert.equal(second.data.count, 31);
    assert.equal(second.data.rows.length, 7);
  }
  assert.equal(
    (await service.list({ plotId: PLOT2, cycleId: CYCLE })).ok,
    false,
  );
  assert.equal((await service.list({ taskId: FOREIGN })).ok, false);
});
test("database reference races, duplicate expense claims and private network errors return safe errors", async () => {
  const { service, repository } = setup();
  repository.failure = "23505";
  assert.deepEqual(await service.create(raw), {
    ok: false,
    reason: "expenseUsed",
    errors: { expenseLineId: "used" },
  });
  repository.failure = "23514";
  assert.deepEqual(await service.create(raw), { ok: false, reason: "related" });
  repository.find = async () => {
    throw Error("private SQL diagnostic");
  };
  assert.deepEqual(await service.get(OP), { ok: false, reason: "failed" });
});
