import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export function TaskBreadcrumbs({ locale, task, current }: {
  locale: Locale; task?: { id: string; title: string }; current?: string;
}) {
  const dictionary = getDictionary(locale);
  const items: Array<{ label: string; href?: string }> = [
    { label: dictionary.nav.overview, href: `/${locale}/app` },
    { label: dictionary.nav.tasks, href: task || current ? `/${locale}/app/tasks` : undefined },
  ];
  if (task) items.push({ label: task.title, href: current ? `/${locale}/app/tasks/${task.id}` : undefined });
  if (current) items.push({ label: current });
  return <nav className="activity-breadcrumbs" aria-label={dictionary.tasks.breadcrumbs}><ol>
    {items.map((item, index) => <li key={index}>{item.href ? <Link href={item.href}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}</li>)}
  </ol></nav>;
}
