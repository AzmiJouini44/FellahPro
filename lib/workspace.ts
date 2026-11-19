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

type WorkspaceRow = {
  farm_id: string;
  farm_name: string;
  currency: string;
  is_demo: boolean;
  member_role: string;
};

export async function getCurrentWorkspace(locale: Locale) {
  const { supabase, user } = await requireAuthenticatedContext(locale);
  const [profileResult, workspaceResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, locale")
      .eq("id", user.id)
      .maybeSingle<Profile>(),
    supabase.rpc("get_current_workspace").maybeSingle<WorkspaceRow>(),
  ]);

  if (profileResult.error) {
    throw new Error("Unable to load the current profile.");
  }

  if (workspaceResult.error) {
    throw new Error("Unable to load the current workspace.");
  }

  const workspace = workspaceResult.data;
  const farm: Farm | null = workspace
    ? {
        id: workspace.farm_id,
        name: workspace.farm_name,
        currency: workspace.currency,
        is_demo: workspace.is_demo,
      }
    : null;

  return {
    user,
    profile: profileResult.data,
    farm,
    role: workspace?.member_role ?? null,
  };
}
