import Link from "next/link";
import { notFound } from "next/navigation";

import { isLocale } from "@/i18n/config";

export default async function AuthLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return (
    <main className="auth-shell">
      <Link className="brand auth-brand" href={`/${locale}`} aria-label="FellahPro">
        <span className="brand-mark" aria-hidden="true">
          F
        </span>
        <span>FellahPro</span>
      </Link>
      {children}
    </main>
  );
}
