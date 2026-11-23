import { defaultLocale, isLocale, type Locale } from "./config";

export const localeCookieName = "fellahpro_locale";

export function getPreferredLocale(value: string | undefined): Locale {
  return value && isLocale(value) ? value : defaultLocale;
}

export function getLocaleCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  } as const;
}

// Only replace the locale segment. Preserve record IDs, repeated filters,
// pagination, encoded text and the fragment exactly as the browser supplied it.
export function getLocalizedHref(href: string, locale: Locale): string {
  if (!isLocale(locale)) throw new TypeError("Unsupported locale");
  if (!href.startsWith("/") || href.startsWith("//") || /[\\\r\n]/.test(href)) {
    return `/${locale}`;
  }
  const [, pathname, suffix] = href.match(/^([^?#]*)([\s\S]*)$/)!;
  const segments = pathname.split("/");
  if (isLocale(segments[1])) segments[1] = locale;
  else segments.splice(1, 0, locale);
  return segments.join("/") + suffix;
}
