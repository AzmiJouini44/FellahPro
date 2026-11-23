export const locales = ["fr", "ar", "aeb"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "fr";

export const localeNames: Record<Locale, string> = {
  fr: "Français",
  ar: "العربية",
  aeb: "تونسي",
};

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function getDirection(locale: Locale) {
  return locale === "fr" ? "ltr" : "rtl";
}

// The existing profiles.locale constraint accepts only fr/ar. Tunisian Arabic
// is a presentation preference kept in the locale cookie, without a migration.
export function getProfileLocale(locale: Locale): "fr" | "ar" {
  return locale === "fr" ? "fr" : "ar";
}
