import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formatCount } from "@/lib/format";
import { LIVESTOCK_PAGE_SIZE } from "@/lib/livestock-validation";

export function LivestockPagination({ locale, page, count, href, label }: {
  locale: Locale; page: number; count: number; href: (page: number) => string; label: string;
}) {
  if (page === 1 && count <= LIVESTOCK_PAGE_SIZE) return null;
  const text = getDictionary(locale).livestock.filters;
  return <nav className="activity-pagination" aria-label={`${label} · ${text.page}`}>
    {page > 1 ? <Link className="button button-secondary" href={href(page - 1)}>{text.previous}</Link> : null}
    <span>{text.page} {formatCount(page, locale)}</span>
    {page * LIVESTOCK_PAGE_SIZE < count ? <Link className="button button-secondary" href={href(page + 1)}>{text.next}</Link> : null}
  </nav>;
}
