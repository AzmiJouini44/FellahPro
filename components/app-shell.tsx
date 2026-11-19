import Link from "next/link";

import { logout } from "@/app/[locale]/actions";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

import { SubmitButton } from "./submit-button";
import { AppNavLink } from "./app-nav-link";

type AppShellProps = {
  children: React.ReactNode;
  locale: Locale;
  email: string | null;
  farmName: string;
};

export function AppShell({ children, locale, email, farmName }: AppShellProps) {
  const dictionary = getDictionary(locale);
  const alternateLocale = locale === "fr" ? "ar" : "fr";

  return (
    <div className="app-frame">
      <aside className="app-sidebar">
        <Link className="brand app-brand" href={`/${locale}/app`} aria-label="FellahPro">
          <span className="brand-mark" aria-hidden="true">
            F
          </span>
          <span>FellahPro</span>
        </Link>
        <div className="workspace-chip">
          <span>{dictionary.appShell.workspaceLabel}</span>
          <strong>{farmName}</strong>
        </div>
        <nav className="app-nav" aria-label={dictionary.nav.mainLabel}>
          <AppNavLink className="app-nav-link" href={`/${locale}/app#overview`}>
            <span aria-hidden="true">⌂</span>
            {dictionary.nav.overview}
          </AppNavLink>
          <AppNavLink className="app-nav-link" href={`/${locale}/app#farm`} match="none">
            <span aria-hidden="true">◇</span>
            {dictionary.nav.farm}
          </AppNavLink>
          <AppNavLink className="app-nav-link" href={`/${locale}/app/plots`} match="prefix">
            <span aria-hidden="true">▱</span>
            {dictionary.nav.plots}
          </AppNavLink>
        </nav>
        <div className="sidebar-footer">
          <div className="account-summary">
            <span>{dictionary.appShell.accountLabel}</span>
            {email ? <strong dir="ltr">{email}</strong> : null}
          </div>
          <Link
            className="language-link"
            href={`/${alternateLocale}/app`}
            aria-label={dictionary.nav.languageLabel}
          >
            {dictionary.nav.language}
          </Link>
          <form action={logout}>
            <input name="locale" type="hidden" value={locale} />
            <SubmitButton
              className="button button-secondary button-full"
              pendingLabel={dictionary.auth.logoutPending}
            >
              {dictionary.auth.logout}
            </SubmitButton>
          </form>
        </div>
      </aside>
      <div className="app-stage">
        <header className="mobile-app-header">
          <Link className="brand" href={`/${locale}/app`} aria-label="FellahPro">
            <span className="brand-mark" aria-hidden="true">
              F
            </span>
            <span>FellahPro</span>
          </Link>
          <Link
            className="language-link"
            href={`/${alternateLocale}/app`}
            aria-label={dictionary.nav.languageLabel}
          >
            {dictionary.nav.language}
          </Link>
        </header>
        <main className="app-content">{children}</main>
        <nav className="mobile-bottom-nav" aria-label={dictionary.nav.mainLabel}>
          <AppNavLink href={`/${locale}/app#overview`}>
            <span aria-hidden="true">⌂</span>
            {dictionary.appShell.mobileHome}
          </AppNavLink>
          <AppNavLink href={`/${locale}/app/plots`} match="prefix">
            <span aria-hidden="true">▱</span>
            {dictionary.appShell.mobilePlots}
          </AppNavLink>
          <form action={logout}>
            <input name="locale" type="hidden" value={locale} />
            <button type="submit">
              <span aria-hidden="true">↪</span>
              {dictionary.auth.logout}
            </button>
          </form>
        </nav>
      </div>
    </div>
  );
}
