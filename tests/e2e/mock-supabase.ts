import { createServer } from "node:http";

import { farmId, memberIds, mockUser, plotId } from "./fixtures";

type RequestRecord = { method: string; path: string; body: Record<string, unknown> | null };
let requests: RequestRecord[] = [];
let onboarded = false;
let profileError = false;
const plot = { id: plotId, activity_id: null, name: "قطعة الزيتون", area_hectares: 2.5, notes: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" };
const server = createServer(async (request, response) => {
  const url = new URL(request.url!, "http://127.0.0.1:54329");
  const send = (data: unknown, status = 200, count?: number) => {
    response.writeHead(status, { "content-type": "application/json", ...(count !== undefined ? { "content-range": count ? `0-${count - 1}/${count}` : "*/0" } : {}) });
    response.end(JSON.stringify(data));
  };
  let raw = "";
  for await (const chunk of request) raw += chunk;
  const body = raw ? JSON.parse(raw) : null;
  if (url.pathname === "/health") return send({ ok: true });
  if (url.pathname === "/__test/reset") { requests = []; onboarded = false; profileError = false; return send({ ok: true }); }
  if (url.pathname === "/__test/profile-error") { profileError = true; return send({ ok: true }); }
  if (url.pathname === "/__test/requests") return send(requests);
  requests.push({ method: request.method!, path: url.pathname, body });
  const token = request.headers.authorization?.replace(/^Bearer /i, "");
  let id: string | undefined;
  try { id = JSON.parse(Buffer.from(token!.split(".")[1], "base64url").toString()).sub; } catch { /* No fictional session. */ }
  if (url.pathname === "/auth/v1/signup") return send({ user: mockUser(memberIds.newcomer) });
  if (!id || !Object.values<string>(memberIds).includes(id)) return send({ message: "Missing test session" }, 401);
  if (url.pathname === "/auth/v1/user") return send(mockUser(id));
  if (url.pathname === "/rest/v1/profiles") {
    if (profileError) return send({ message: "Intentional fixture failure" }, 503);
    if (request.method === "POST") return send(null, 201);
    return send({ full_name: "فلاّح التجربة", locale: "ar" });
  }
  if (url.pathname === "/rest/v1/rpc/create_first_farm") { onboarded = true; return send(farmId); }
  if (url.pathname === "/rest/v1/rpc/get_current_workspace") {
    const role = Object.entries(memberIds).find(([, value]) => value === id)![0];
    return send(id === memberIds.newcomer && !onboarded ? null : { farm_id: farmId, farm_name: "ضيعة التجربة", currency: "TND", is_demo: false, member_role: role === "newcomer" ? "owner" : role });
  }
  if (url.pathname.startsWith("/rest/v1/") && (request.method === "GET" || request.method === "HEAD")) {
    // All business reads must still be scoped by the real server-side loader.
    if (url.searchParams.get("farm_id") !== `eq.${farmId}`) return send({ message: "Unscoped test query" }, 403);
    if (url.pathname === "/rest/v1/plots") {
      return send(url.searchParams.has("id") ? plot : [plot], 200, 1);
    }
    return send([], 200, 0);
  }
  return send({ message: "Unexpected mock request" }, 400);
});
server.listen(54329, "127.0.0.1");
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => server.close(() => process.exit(0)));
