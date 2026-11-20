import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export function OperationBreadcrumbs({
  locale,
  operation,
  current,
}: {
  locale: Locale;
  operation?: { id: string; label: string };
  current?: string;
}) {
  const dictionary = getDictionary(locale);
  const items: Array<{ label: string; href?: string }> = [
    { label: dictionary.nav.overview, href: `/${locale}/app` },
    {
      label: dictionary.operations.title,
      href: operation || current ? `/${locale}/app/operations` : undefined,
    },
  ];
  if (operation)
    items.push({
      label: operation.label,
      href: current ? `/${locale}/app/operations/${operation.id}` : undefined,
    });
  if (current) items.push({ label: current });
  return (
    <nav
      className="activity-breadcrumbs"
      aria-label={dictionary.operations.breadcrumbs}
    >
      <ol>
        {items.map((item, index) => (
          <li key={index}>
            {item.href ? (
              <Link href={item.href}>{item.label}</Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
export function OperationMissing({ locale }: { locale: Locale }) {
  const text = getDictionary(locale).operations;
  return (
    <section className="plot-state-card">
      <h1>{text.missing}</h1>
      <Link
        className="button button-secondary"
        href={`/${locale}/app/operations`}
      >
        {text.back}
      </Link>
    </section>
  );
}
