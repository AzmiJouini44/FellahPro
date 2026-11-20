"use client";

import Link from "next/link";
import { useState } from "react";
import { logout } from "@/app/[locale]/actions";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export function MobileMoreNavigation({ locale }: { locale: Locale }) {
  const dictionary = getDictionary(locale);
  const [open, setOpen] = useState(false);
  return (
    <details
      className="mobile-more-navigation"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        {dictionary.appShell.mobileMore} <span aria-hidden="true">⋯</span>
      </summary>
      <div className="mobile-more-panel">
        <nav aria-label={dictionary.nav.mainLabel}>
          <Link
            href={`/${locale}/app/activities`}
            onClick={() => setOpen(false)}
          >
            {dictionary.nav.activities}
          </Link>
        </nav>
        <form action={logout}>
          <input name="locale" type="hidden" value={locale} />
          <button type="submit">{dictionary.auth.logout}</button>
        </form>
      </div>
    </details>
  );
}
