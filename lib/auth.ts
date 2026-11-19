import "server-only";

import { redirect } from "next/navigation";

import type { Locale } from "@/i18n/config";
import { createClient } from "@/utils/supabase/server";

export type AuthenticatedUser = {
  id: string;
  email: string | null;
};

export async function getAuthenticatedContext() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;

  if (error || !data || typeof id !== "string" || id.length === 0) {
    return null;
  }

  const email = typeof data.claims.email === "string" ? data.claims.email : null;

  return {
    supabase,
    user: { id, email } satisfies AuthenticatedUser,
  };
}

export async function requireAuthenticatedContext(locale: Locale) {
  const context = await getAuthenticatedContext();

  if (!context) {
    redirect(`/${locale}/login`);
  }

  return context;
}
