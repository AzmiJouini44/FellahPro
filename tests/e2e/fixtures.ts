import type { BrowserContext } from "@playwright/test";

export const mockOrigin = "http://127.0.0.1:54329";
export const farmId = "10000000-0000-4000-8000-000000000001";
export const plotId = "20000000-0000-4000-8000-000000000001";
export const memberIds = {
  owner: "30000000-0000-4000-8000-000000000001",
  worker: "30000000-0000-4000-8000-000000000002",
  accountant: "30000000-0000-4000-8000-000000000003",
  newcomer: "30000000-0000-4000-8000-000000000004",
} as const;

export function mockUser(id: string) {
  return { id, email: "farmer@example.test", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
}

export async function signInFixture(context: BrowserContext, role: keyof typeof memberIds = "owner") {
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  // Fictional session accepted only by the loopback mock's /auth/v1/user. The
  // production app still calls Supabase for authentication; no auth bypass is
  // added to application code.
  const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: memberIds[role], email: "farmer@example.test", role: "authenticated", aud: "authenticated", exp: expires, iat: expires - 3600 })}.${Buffer.from("local-test-signature").toString("base64url")}`;
  const session = { access_token: token, refresh_token: "local-test-refresh", expires_at: expires, expires_in: 3600, token_type: "bearer", user: mockUser(memberIds[role]) };
  await context.addCookies([{ name: "sb-127-auth-token", value: `base64-${encode(session)}`, url: "http://127.0.0.1:3100", sameSite: "Lax" }]);
}
