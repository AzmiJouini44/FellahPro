import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export function ActivityBreadcrumbs({ locale, activity, current }: {
  locale: Locale; activity?: { id: string; name: string }; current?: string;
}) {
  const dictionary = getDictionary(locale);
  const items: Array<{ label: string; href?: string }> = [
    { label: dictionary.nav.overview, href: `/${locale}/app` },
    { label: dictionary.activities.title, href: activity || current ? `/${locale}/app/activities` : undefined },
  ];
  if (activity) items.push({ label: activity.name, href: current ? `/${locale}/app/activities/${activity.id}` : undefined });
  if (current) items.push({ label: current });
  return <nav className="activity-breadcrumbs" aria-label={dictionary.activities.breadcrumbs}><ol>
    {items.map((item, index) => <li key={index}>{item.href ? <Link href={item.href}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}</li>)}
  </ol></nav>;
}
