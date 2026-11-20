import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export function LivestockBreadcrumbs({ locale, group, current }: { locale: Locale; group?: { id: string; name: string }; current?: string }) {
  const dictionary = getDictionary(locale);
  const items: Array<{ label: string; href?: string }> = [
    { label: dictionary.nav.overview, href: `/${locale}/app` },
    { label: dictionary.livestock.title, href: group || current ? `/${locale}/app/livestock` : undefined },
  ];
  if (group) items.push({ label: group.name, href: current ? `/${locale}/app/livestock/${group.id}` : undefined });
  if (current) items.push({ label: current });
  return <nav className="activity-breadcrumbs" aria-label={dictionary.livestock.breadcrumbs}><ol>
    {items.map((item, index) => <li key={index}>{item.href ? <Link href={item.href}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}</li>)}
  </ol></nav>;
}

export function LivestockMissing({ locale }: { locale: Locale }) {
  const text = getDictionary(locale).livestock;
  return <section className="plot-state-card"><h1>{text.missing}</h1><Link className="button button-secondary" href={`/${locale}/app/livestock`}>{text.back}</Link></section>;
}
