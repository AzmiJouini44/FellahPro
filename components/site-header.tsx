import Link from "next/link";

import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

type SiteHeaderProps = {
  locale: Locale;
  isAuthenticated?: boolean;
};

export function SiteHeader({ locale, isAuthenticated = false }: SiteHeaderProps) {
  const dictionary = getDictionary(locale);
  const alternateLocale = locale === "fr" ? "ar" : "fr";

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
          <Link
            className="language-link"
            href={`/${alternateLocale}`}
            aria-label={dictionary.nav.languageLabel}
          >
            {dictionary.nav.language}
          </Link>
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
