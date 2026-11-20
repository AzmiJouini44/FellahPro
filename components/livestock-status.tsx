import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getNumberLocale } from "@/lib/format";

export function formatAnimalCount(value: string, locale: Locale) {
  return new Intl.NumberFormat(getNumberLocale(locale)).format(BigInt(value));
}
export function AnimalGroupStatus({ locale, active }: { locale: Locale; active: boolean }) {
  const text = getDictionary(locale).livestock;
  return <span className={`activity-status ${active ? "is-active" : "is-inactive"}`}>{active ? text.active : text.inactive}</span>;
}
export function AnimalGroupCount({ locale, count }: { locale: Locale; count: string }) {
  return <strong className={BigInt(count) < BigInt(0) ? "livestock-count is-negative" : "livestock-count"}>{formatAnimalCount(count, locale)}</strong>;
}
