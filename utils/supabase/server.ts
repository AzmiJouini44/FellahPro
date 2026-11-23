import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";

import { getSupabasePublicConfig } from "@/utils/supabase/config";

export async function createClient() {
  // Session initialization reads the clock in a background promise. Keep the
  // entire authenticated client lifecycle outside Cache Components prefetches.
  await connection();
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabasePublicConfig();

  return createServerClient(
    url,
    publishableKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components cannot write cookies. The request proxy refreshes
            // the session before rendering and writes refreshed cookies instead.
          }
        },
      },
    },
  );
}
