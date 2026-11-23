import Link from "next/link";

import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { LanguageSelector } from "./language-selector";

type SiteHeaderProps = {
  locale: Locale;
  isAuthenticated?: boolean;
};

export function SiteHeader({ locale, isAuthenticated = false }: SiteHeaderProps) {
  const dictionary = getDictionary(locale);

  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="brand" href={`/${locale}`} aria-label="FellahPro">
          <span className="brand-mark" aria-hidden="true">
            F
          </span>
          <span>FellahPro</span>
        </Link>
        <nav className="header-actions" aria-label={dictionary.nav.mainLabel}>
          <LanguageSelector locale={locale} labels={dictionary.languageSelector} compact />
          <Link
            className="button button-small button-secondary"
            href={isAuthenticated ? `/${locale}/app` : `/${locale}/login`}
          >
            {isAuthenticated ? dictionary.nav.workspace : dictionary.nav.login}
          </Link>
        </nav>
      </div>
    </header>
  );
}
