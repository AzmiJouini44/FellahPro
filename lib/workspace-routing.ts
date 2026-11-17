import type { Locale } from "@/i18n/config";

export function getMissingWorkspaceRedirect(
  locale: Locale,
  hasProfile: boolean,
  hasFarmMembership: boolean,
) {
  return hasProfile && hasFarmMembership ? null : `/${locale}/onboarding`;
}
