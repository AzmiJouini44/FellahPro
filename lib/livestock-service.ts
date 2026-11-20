import type { ActivityOption, DatabaseResult } from "./activity-service";
import type { TaskRecord } from "./task-service";
import { isUuid } from "./validation";
import {
  animalCount, canManageAnimalGroups, canReadLivestock, canRecordAnimalEvents,
  validateEventFilters, validateEventInput, validateGroupFilters, validateGroupInput,
  type AnimalEventKind, type GroupInput, type EventInput, type GroupRaw, type EventRaw,
  type LivestockErrors, type GroupFilters, type EventFilters, type GroupFilterRaw, type EventFilterRaw,
} from "./livestock-validation";

export type AnimalGroup = {
  id: string; name: string; species: string; opening_count: number; activity_id: string;
  is_active: boolean; created_at: string; updated_at: string;
};
export type GroupWrite = { name: string; species: string; opening_count: number; activity_id: string; is_active: boolean };
export type AnimalBalance = { animal_group_id: string; current_count: string | number };
export type CountedGroup = AnimalGroup & { current_count: string };
export type AnimalEvent = { id: string; animal_group_id: string; kind: AnimalEventKind; event_date: string; quantity: number; notes: string | null; created_at: string };
export type EventWrite = { animal_group_id: string; kind: AnimalEventKind; event_date: string; quantity: number; notes: string | null };
export type RecentAnimalEvent = AnimalEvent & { group: { name: string } | null };
export type LivestockLedgerLine = { id: string; description: string; amount: number | string;
  transaction: { id: string; kind: "depense" | "revenu"; transaction_date: string; reference: string | null } };
export type PageData<T> = { rows: T[]; count: number };
export type LivestockActor = { farmId: string; role: string | null } | null;
export type LivestockFailure = "forbidden" | "notFound" | "invalid" | "invalidFilters" | "dependency" | "failed";
export type LivestockResult<T> = { ok: true; data: T } | { ok: false; reason: LivestockFailure; errors?: LivestockErrors };
export type LivestockSummary = { groups: number; active: number; animals: string; negativeGroups: number;
  bySpecies: Array<{ species: string; groups: number; animals: string }>; recent: RecentAnimalEvent[] };

export interface LivestockRepository {
  list(farmId: string, filters: GroupFilters): Promise<DatabaseResult<PageData<AnimalGroup>>>;
  find(farmId: string, id: string): Promise<DatabaseResult<AnimalGroup>>;
  allGroups(farmId: string): Promise<DatabaseResult<AnimalGroup[]>>;
  balances(farmId: string, ids?: string[]): Promise<DatabaseResult<AnimalBalance[]>>;
  insert(farmId: string, input: GroupWrite): Promise<DatabaseResult<AnimalGroup>>;
  update(farmId: string, id: string, input: GroupWrite): Promise<DatabaseResult<AnimalGroup>>;
  remove(farmId: string, id: string): Promise<DatabaseResult<{ id: string }>>;
  activity(farmId: string, id: string): Promise<DatabaseResult<ActivityOption>>;
  activities(farmId: string): Promise<DatabaseResult<ActivityOption[]>>;
  events(farmId: string, groupId: string, filters: EventFilters): Promise<DatabaseResult<PageData<AnimalEvent>>>;
  insertEvent(farmId: string, input: EventWrite): Promise<DatabaseResult<AnimalEvent>>;
  recentEvents(farmId: string): Promise<DatabaseResult<RecentAnimalEvent[]>>;
  tasks(farmId: string, groupId: string): Promise<DatabaseResult<PageData<Pick<TaskRecord, "id" | "title" | "status" | "due_on">>>>;
  ledger(farmId: string, groupId: string, page: number): Promise<DatabaseResult<PageData<LivestockLedgerLine>>>;
}

async function safe<T>(call: () => Promise<DatabaseResult<T>>): Promise<DatabaseResult<T>> {
  try { return await call(); } catch { return { data: null, error: { code: "network" } }; }
}
function result<T>(value: DatabaseResult<T>): LivestockResult<T> {
  if (value.error) return { ok: false, reason: value.error.code === "23503" ? "dependency" : "failed" };
  return value.data === null ? { ok: false, reason: "notFound" } : { ok: true, data: value.data };
}
function withBalances(groups: AnimalGroup[], balances: AnimalBalance[]): CountedGroup[] | null {
  const counts = new Map(balances.map((row) => [row.animal_group_id, animalCount(row.current_count)]));
  if (groups.some((group) => counts.get(group.id) === undefined || counts.get(group.id) === null)) return null;
  return groups.map((group) => ({ ...group, current_count: counts.get(group.id)! }));
}

export function createLivestockService(actor: LivestockActor, repository: LivestockRepository, now: () => Date = () => new Date()) {
  const readable = actor !== null && isUuid(actor.farmId) && canReadLivestock(actor.role);
  const owner = readable && canManageAnimalGroups(actor!.role);
  const recorder = readable && canRecordAnimalEvents(actor!.role);
  const denied = { ok: false, reason: "forbidden" } as const;
  const failed = { ok: false, reason: "failed" } as const;
  async function parent(id: string): Promise<LivestockResult<AnimalGroup>> {
    if (!readable) return denied;
    if (!isUuid(id)) return { ok: false, reason: "notFound" };
    return result(await safe(() => repository.find(actor!.farmId, id)));
  }
  async function write(input: GroupInput): Promise<LivestockResult<GroupWrite>> {
    const activity = await safe(() => repository.activity(actor!.farmId, input.activityId));
    if (activity.error) return failed;
    if (!activity.data) return { ok: false, reason: "invalid", errors: { activityId: "invalid" } };
    return { ok: true, data: { name: input.name, species: input.species, opening_count: input.openingCount,
      activity_id: input.activityId, is_active: input.isActive } };
  }
  return {
    async list(raw: GroupFilterRaw = {}): Promise<LivestockResult<PageData<CountedGroup> & { filters: GroupFilters }>> {
      if (!readable) return denied;
      const filters = validateGroupFilters(raw);
      if (!filters) return { ok: false, reason: "invalidFilters" };
      const groups = result(await safe(() => repository.list(actor!.farmId, filters)));
      if (!groups.ok) return groups;
      if (!groups.data.rows.length) return { ok: true, data: { ...groups.data, rows: [], filters } };
      const balances = await safe(() => repository.balances(actor!.farmId, groups.data.rows.map((group) => group.id)));
      if (balances.error || !balances.data) return failed;
      const rows = withBalances(groups.data.rows, balances.data);
      return rows ? { ok: true, data: { rows, count: groups.data.count, filters } } : failed;
    },
    async get(id: string): Promise<LivestockResult<CountedGroup & { activity: ActivityOption | null }>> {
      const group = await parent(id);
      if (!group.ok) return group;
      const [balances, activity] = await Promise.all([
        safe(() => repository.balances(actor!.farmId, [id])), safe(() => repository.activity(actor!.farmId, group.data.activity_id)),
      ]);
      if (balances.error || !balances.data || activity.error) return failed;
      const rows = withBalances([group.data], balances.data);
      return rows ? { ok: true, data: { ...rows[0], activity: activity.data } } : failed;
    },
    async create(raw: GroupRaw): Promise<LivestockResult<AnimalGroup>> {
      if (!owner) return denied;
      const validated = validateGroupInput(raw);
      if (!validated.success) return { ok: false, reason: "invalid", errors: validated.errors };
      const data = await write(validated.data);
      return data.ok ? result(await safe(() => repository.insert(actor!.farmId, data.data))) : data;
    },
    async update(id: string, raw: GroupRaw): Promise<LivestockResult<AnimalGroup>> {
      if (!owner) return denied;
      const group = await parent(id);
      if (!group.ok) return group;
      const validated = validateGroupInput(raw);
      if (!validated.success) return { ok: false, reason: "invalid", errors: validated.errors };
      const data = await write(validated.data);
      return data.ok ? result(await safe(() => repository.update(actor!.farmId, id, data.data))) : data;
    },
    async remove(id: string): Promise<LivestockResult<{ id: string }>> {
      if (!owner) return denied;
      const group = await parent(id);
      return group.ok ? result(await safe(() => repository.remove(actor!.farmId, id))) : group;
    },
    async options(): Promise<LivestockResult<ActivityOption[]>> {
      if (!readable) return denied;
      return result(await safe(() => repository.activities(actor!.farmId)));
    },
    async events(id: string, raw: EventFilterRaw = {}): Promise<LivestockResult<PageData<AnimalEvent> & { filters: EventFilters }>> {
      const group = await parent(id);
      if (!group.ok) return group;
      const filters = validateEventFilters(raw);
      if (!filters) return { ok: false, reason: "invalidFilters" };
      const response = result(await safe(() => repository.events(actor!.farmId, id, filters)));
      return response.ok ? { ok: true, data: { ...response.data, filters } } : response;
    },
    async recordEvent(id: string, raw: EventRaw): Promise<LivestockResult<AnimalEvent>> {
      if (!recorder) return denied;
      const group = await parent(id);
      if (!group.ok) return group;
      const validated = validateEventInput(raw, now());
      if (!validated.success) return { ok: false, reason: "invalid", errors: validated.errors };
      const input: EventInput = validated.data;
      // Only INSERT is exposed for event history. No existing event is rewritten.
      return result(await safe(() => repository.insertEvent(actor!.farmId, {
        animal_group_id: group.data.id, kind: input.kind, event_date: input.eventDate, quantity: input.quantity, notes: input.notes,
      })));
    },
    async tasks(id: string) {
      const group = await parent(id);
      return group.ok ? result(await safe(() => repository.tasks(actor!.farmId, id))) : group;
    },
    async ledger(id: string, rawPage: unknown = "1"): Promise<LivestockResult<PageData<LivestockLedgerLine>>> {
      const group = await parent(id);
      if (!group.ok) return group;
      const filters = validateGroupFilters({ page: rawPage });
      if (!filters) return { ok: false, reason: "invalidFilters" };
      return result(await safe(() => repository.ledger(actor!.farmId, id, filters.page)));
    },
    async summary(): Promise<LivestockResult<LivestockSummary>> {
      if (!readable) return denied;
      const [groups, balances, recent] = await Promise.all([
        safe(() => repository.allGroups(actor!.farmId)), safe(() => repository.balances(actor!.farmId)), safe(() => repository.recentEvents(actor!.farmId)),
      ]);
      if (groups.error || !groups.data || balances.error || !balances.data || recent.error || !recent.data) return failed;
      const counted = withBalances(groups.data, balances.data);
      if (!counted) return failed;
      const species = new Map<string, { groups: number; animals: bigint }>();
      let animals = BigInt(0); let negativeGroups = 0;
      for (const group of counted) {
        const number = BigInt(group.current_count); animals += number;
        if (number < BigInt(0)) negativeGroups++;
        const type = species.get(group.species) ?? { groups: 0, animals: BigInt(0) };
        type.groups++; type.animals += number; species.set(group.species, type);
      }
      return { ok: true, data: { groups: counted.length, active: counted.filter((group) => group.is_active).length,
        animals: animals.toString(), negativeGroups,
        bySpecies: [...species].map(([name, type]) => ({ species: name, groups: type.groups, animals: type.animals.toString() })), recent: recent.data } };
    },
  };
}
