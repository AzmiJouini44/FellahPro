import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export function TaskMissing({ locale }: { locale: Locale }) {
  const text = getDictionary(locale).tasks;
  return <section className="plot-state-card"><h1>{text.errors.notFound}</h1>
    <Link className="button button-secondary" href={`/${locale}/app/tasks`}>{text.back}</Link>
  </section>;
}
