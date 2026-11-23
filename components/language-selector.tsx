"use client";

import { useId, useState, useTransition } from "react";

import { setLocalePreference } from "@/app/[locale]/language-actions";
import { getDirection, isLocale, localeNames, locales, type Locale } from "@/i18n/config";
import { getLocalizedHref } from "@/i18n/preference";

type LanguageSelectorProps = {
  locale: Locale;
  labels: { label: string; pending: string; error: string };
  compact?: boolean;
};

export function LanguageSelector({ locale, labels, compact = false }: LanguageSelectorProps) {
  const id = useId();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  function changeLanguage(value: string) {
    if (!isLocale(value) || value === locale) return;
    const href = getLocalizedHref(
      window.location.pathname + window.location.search + window.location.hash,
      value,
    );
    setFailed(false);
    startTransition(async () => {
      try {
        if (!(await setLocalePreference(value))) {
          setFailed(true);
          return;
        }
        // A full same-origin navigation updates the locale root layout and its
        // direction together. Supabase's session cookies stay untouched.
        window.location.assign(href);
      } catch {
        setFailed(true);
      }
    });
  }

  return (
    <div className={`language-selector${compact ? " language-selector-compact" : ""}`}>
      <label htmlFor={id}>{labels.label}</label>
      <select
        id={id}
        value={locale}
        dir={getDirection(locale)}
        onChange={(event) => changeLanguage(event.target.value)}
        disabled={pending}
        aria-busy={pending}
        aria-describedby={failed ? `${id}-error` : undefined}
      >
        {locales.map((option) => (
          <option key={option} value={option} lang={option} dir={getDirection(option)}>
            {localeNames[option]}
          </option>
        ))}
      </select>
      <span className="sr-only" role="status">{pending ? labels.pending : ""}</span>
      {failed ? <p id={`${id}-error`} role="alert" className="field-error">{labels.error}</p> : null}
    </div>
  );
}
