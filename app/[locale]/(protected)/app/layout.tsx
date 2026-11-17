import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { isLocale } from "@/i18n/config";
import { getCurrentWorkspace } from "@/lib/workspace";
import { getMissingWorkspaceRedirect } from "@/lib/workspace-routing";

export const instant = false;

export default async function AuthenticatedAppLayout({
  children,
  params,
}: LayoutProps<"/[locale]/app">) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const workspace = await getCurrentWorkspace(locale);

  if (!workspace.profile || !workspace.farm) {
    redirect(
      getMissingWorkspaceRedirect(
        locale,
        workspace.profile !== null,
        workspace.farm !== null,
      ) ?? `/${locale}/onboarding`,
    );
  }

  return (
    <AppShell
      locale={locale}
      email={workspace.user.email}
      farmName={workspace.farm.name}
    >
      {children}
    </AppShell>
  );
}
