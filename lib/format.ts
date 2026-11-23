import type { Locale } from "../i18n/config";

export function getNumberLocale(locale: Locale) {
  return locale === "fr" ? "fr-TN" : "ar-TN";
}

export function formatCount(count: number, locale: Locale) {
  return new Intl.NumberFormat(getNumberLocale(locale)).format(count);
}

export function formatUtcDate(date: string, locale: Locale) {
  return new Intl.DateTimeFormat(getNumberLocale(locale), { dateStyle: "medium", timeZone: "UTC" }).format(new Date(date));
}

export function formatTnd(amount: number, locale: Locale) {
  return new Intl.NumberFormat(getNumberLocale(locale), {
    style: "currency",
    currency: "TND",
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(amount);
}

export function formatAreaHectares(area: number, locale: Locale) {
  return new Intl.NumberFormat(getNumberLocale(locale), {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(area);
}

export function formatDate(date: string, locale: Locale) {
  return new Intl.DateTimeFormat(getNumberLocale(locale), {
    dateStyle: "medium",
  }).format(new Date(date));
}
