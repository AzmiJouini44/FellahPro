import {
  activityKinds, canManageActivities, canReadActivities, parseActivityState,
  validateActivityFilters, validateActivityInput,
  type ActivityErrors, type ActivityFilterInput, type ActivityFilters,
  type ActivityKind, type RawActivityInput,
} from "./activity-validation";
import { isUuid } from "./validation";

export type ActivityRecord = {
  id: string; name: string; kind: ActivityKind; is_active: boolean;
  created_at: string; updated_at: string;
};
export type ActivityOption = Pick<ActivityRecord, "id" | "name" | "is_active">;
export type ActivityActor = { farmId: string; role: string | null } | null;
export type ActivityWrite = { name: string; kind: ActivityKind; is_active: boolean };
export type DatabaseResult<T> = { data: T | null; error: { code: string } | null };
export type ActivityFailure = "forbidden" | "invalid" | "invalidFilters" | "notFound" | "dependency" | "failed";
export type ActivityResult<T> = { ok: true; data: T } | { ok: false; reason: ActivityFailure; errors?: ActivityErrors };
export type ActivityList = { rows: ActivityRecord[]; count: number; filters: ActivityFilters };
export type ActivityRelated = {
  plots: Array<{ id: string; name: string }>;
  cycles: Array<{ id: string; crop_name: string; started_on: string }>;
  plotCount: number; cycleCount: number;
};
export type ActivitySummary = { total: number; active: number; inactive: number; byKind: Record<ActivityKind, number> };

// The SSR-only adapter implements this boundary. Its actor is constructed from
// authenticated membership, never from action arguments. Tests exercise the
// same authorization/orchestration without substituting validation for RLS.
export interface ActivityRepository {
  list(farmId: string, filters: ActivityFilters): Promise<DatabaseResult<{ rows: ActivityRecord[]; count: number }>>;
  find(farmId: string, id: string): Promise<DatabaseResult<ActivityRecord>>;
  insert(farmId: string, input: ActivityWrite): Promise<DatabaseResult<ActivityRecord>>;
  update(farmId: string, id: string, input: Partial<ActivityWrite>): Promise<DatabaseResult<ActivityRecord>>;
  remove(farmId: string, id: string): Promise<DatabaseResult<{ id: string }>>;
  related(farmId: string, id: string): Promise<DatabaseResult<ActivityRelated>>;
  count(farmId: string, filter?: { kind?: ActivityKind; active?: boolean }): Promise<DatabaseResult<number>>;
}

async function safeCall<T>(call: () => Promise<DatabaseResult<T>>): Promise<DatabaseResult<T>> {
  try { return await call(); } catch { return { data: null, error: { code: "network" } }; }
}

function result<T>(response: DatabaseResult<T>): ActivityResult<T> {
  if (response.error) return { ok: false, reason: response.error.code === "23503" ? "dependency" : "failed" };
  return response.data === null ? { ok: false, reason: "notFound" } : { ok: true, data: response.data };
}

export function createActivityService(actor: ActivityActor, repository: ActivityRepository) {
  const readable = actor !== null && isUuid(actor.farmId) && canReadActivities(actor.role);
  const writable = readable && canManageActivities(actor!.role);
  const denied = { ok: false, reason: "forbidden" } as const;
  const invalid = { ok: false, reason: "invalid" } as const;

  return {
    async list(input: ActivityFilterInput = {}): Promise<ActivityResult<ActivityList>> {
      if (!readable) return denied;
      const validated = validateActivityFilters(input);
      if (!validated.success) return { ok: false, reason: "invalidFilters" };
      const response = result(await safeCall(() => repository.list(actor!.farmId, validated.data)));
      return response.ok ? { ok: true, data: { ...response.data, filters: validated.data } } : response;
    },
    async get(id: string): Promise<ActivityResult<ActivityRecord>> {
      if (!readable) return denied;
      if (!isUuid(id)) return { ok: false, reason: "notFound" };
      return result(await safeCall(() => repository.find(actor!.farmId, id)));
    },
    async related(id: string): Promise<ActivityResult<ActivityRelated>> {
      if (!readable) return denied;
      if (!isUuid(id)) return { ok: false, reason: "notFound" };
      const parent = result(await safeCall(() => repository.find(actor!.farmId, id)));
      if (!parent.ok) return parent;
      return result(await safeCall(() => repository.related(actor!.farmId, id)));
    },
    async create(input: RawActivityInput): Promise<ActivityResult<ActivityRecord>> {
      if (!writable) return denied;
      const validated = validateActivityInput(input);
      if (!validated.success) return { ok: false, reason: "invalid", errors: validated.errors };
      const { name, kind, isActive } = validated.data;
      return result(await safeCall(() => repository.insert(actor!.farmId, { name, kind, is_active: isActive })));
    },
    async update(id: string, input: RawActivityInput): Promise<ActivityResult<ActivityRecord>> {
      if (!writable) return denied;
      if (!isUuid(id)) return { ok: false, reason: "notFound" };
      const validated = validateActivityInput(input);
      if (!validated.success) return { ok: false, reason: "invalid", errors: validated.errors };
      const { name, kind, isActive } = validated.data;
      return result(await safeCall(() => repository.update(actor!.farmId, id, { name, kind, is_active: isActive })));
    },
    async setActive(id: string, value: unknown): Promise<ActivityResult<ActivityRecord>> {
      if (!writable) return denied;
      if (!isUuid(id)) return { ok: false, reason: "notFound" };
      const active = parseActivityState(value);
      if (active === undefined) return invalid;
      return result(await safeCall(() => repository.update(actor!.farmId, id, { is_active: active })));
    },
    async remove(id: string): Promise<ActivityResult<{ id: string }>> {
      if (!writable) return denied;
      if (!isUuid(id)) return { ok: false, reason: "notFound" };
      return result(await safeCall(() => repository.remove(actor!.farmId, id)));
    },
    async summary(): Promise<ActivityResult<ActivitySummary>> {
      if (!readable) return denied;
      const counts = await Promise.all([
        safeCall(() => repository.count(actor!.farmId)),
        safeCall(() => repository.count(actor!.farmId, { active: true })),
        safeCall(() => repository.count(actor!.farmId, { active: false })),
        ...activityKinds.map((kind) => safeCall(() => repository.count(actor!.farmId, { kind }))),
      ]);
      if (counts.some((count) => count.error || count.data === null)) return { ok: false, reason: "failed" };
      return { ok: true, data: {
        total: counts[0].data!, active: counts[1].data!, inactive: counts[2].data!,
        byKind: Object.fromEntries(activityKinds.map((kind, index) => [kind, counts[index + 3].data!])) as Record<ActivityKind, number>,
      } };
    },
  };
}
