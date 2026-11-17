import "server-only";

import type { Locale } from "@/i18n/config";
import { requireAuthenticatedContext } from "@/lib/auth";

type Profile = {
  full_name: string | null;
  locale: string;
};

type Farm = {
  id: string;
  name: string;
  currency: string;
  is_demo: boolean;
};

export async function getCurrentWorkspace(locale: Locale) {
  const { supabase, user } = await requireAuthenticatedContext(locale);
  const [profileResult, farmResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, locale")
      .eq("id", user.id)
      .maybeSingle<Profile>(),
    supabase
      .from("farms")
      .select("id, name, currency, is_demo")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<Farm>(),
  ]);

  if (profileResult.error) {
    throw new Error("Unable to load the current profile.");
  }

  if (farmResult.error) {
    throw new Error("Unable to load the current farm.");
  }

  let role: string | null = null;

  if (farmResult.data) {
    const membershipResult = await supabase
      .from("farm_members")
      .select("role")
      .eq("farm_id", farmResult.data.id)
      .eq("user_id", user.id)
      .maybeSingle<{ role: string }>();

    if (membershipResult.error) {
      throw new Error("Unable to load the current farm membership.");
    }

    role = membershipResult.data?.role ?? null;
  }

  return {
    user,
    profile: profileResult.data,
    farm: farmResult.data,
    role,
  };
}
