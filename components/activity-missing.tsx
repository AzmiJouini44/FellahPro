import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export function ActivityMissing({ locale }: { locale: Locale }) {
  const text = getDictionary(locale).activities;
  return <section className="plot-state-card"><h1>{text.errors.notFound}</h1>
    <Link className="button button-secondary" href={`/${locale}/app/activities`}>{text.back}</Link>
  </section>;
}
