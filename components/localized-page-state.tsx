"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { defaultLocale, isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { LanguageSelector } from "./language-selector";

export function LocalizedPageState({ retry }: { retry?: () => void }) {
  const params = useParams<{ locale?: string }>();
  const locale = params.locale && isLocale(params.locale) ? params.locale : defaultLocale;
  const dictionary = getDictionary(locale);

  return (
    <main className="auth-shell">
      <header className="auth-header">
        <Link className="brand" href={`/${locale}`}>FellahPro</Link>
        <LanguageSelector locale={locale} labels={dictionary.languageSelector} compact />
      </header>
      <section className="auth-card">
        <h1>{retry ? dictionary.system.errorTitle : dictionary.system.notFoundTitle}</h1>
        <p>{retry ? dictionary.system.errorDescription : dictionary.system.notFoundDescription}</p>
        {retry ? (
          <button className="button button-primary" onClick={retry}>{dictionary.system.retry}</button>
        ) : (
          <Link className="button button-primary" href={`/${locale}`}>{dictionary.system.home}</Link>
        )}
      </section>
    </main>
  );
}
