import { notFound } from "next/navigation";

import { isLocale } from "@/i18n/config";
import { requireAuthenticatedContext } from "@/lib/auth";

export const instant = false;

export default async function ProtectedLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  await requireAuthenticatedContext(locale);

  return children;
}
