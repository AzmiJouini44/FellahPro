import type { Locale } from "../i18n/config";

export function getNumberLocale(locale: Locale) {
  return locale === "ar" ? "ar-TN" : "fr-TN";
}

export function formatTnd(amount: number, locale: Locale) {
  return new Intl.NumberFormat(getNumberLocale(locale), {
    style: "currency",
    currency: "TND",
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(amount);
}
