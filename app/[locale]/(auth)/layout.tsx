import Link from "next/link";
import { notFound } from "next/navigation";

import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { LanguageSelector } from "@/components/language-selector";

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
      <header className="auth-header">
        <Link className="brand" href={`/${locale}`} aria-label="FellahPro">
          <span className="brand-mark" aria-hidden="true">F</span>
          <span>FellahPro</span>
        </Link>
        <LanguageSelector locale={locale} labels={getDictionary(locale).languageSelector} compact />
      </header>
      {children}
    </main>
  );
}
