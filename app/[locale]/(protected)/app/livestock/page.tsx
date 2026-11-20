import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LivestockBreadcrumbs } from "@/components/livestock-breadcrumbs";
import { LivestockPagination } from "@/components/livestock-pagination";
import { AnimalGroupCount, AnimalGroupStatus } from "@/components/livestock-status";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formatCount } from "@/lib/format";
import { getLivestockContext } from "@/lib/livestock";
import { canManageAnimalGroups, livestockQuery } from "@/lib/livestock-validation";

export const instant = false;

export default async function LivestockPage({ params, searchParams }: PageProps<"/[locale]/app/livestock">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { workspace, service } = await getLivestockContext(locale);
  if (!workspace.farm) redirect(`/${locale}/onboarding`);
  const query = await searchParams;
  const result = await service.list({ search: query.search, species: query.species, active: query.active, page: query.page });
  const text = getDictionary(locale).livestock; const owner = canManageAnimalGroups(workspace.role);
  const base = `/${locale}/app/livestock`;
  const filters = result.ok ? result.data.filters : null;
  const value = (key: "search" | "species" | "active") => filters?.[key] ?? (typeof query[key] === "string" ? query[key] : "");
  const hasFilters = filters && Boolean(filters.search || filters.species || filters.active || filters.page > 1);
  const success = typeof query.success === "string" && Object.hasOwn(text.success, query.success) ? text.success[query.success as keyof typeof text.success] : null;
  return <div className="livestock-page">
    <LivestockBreadcrumbs locale={locale} />
    <section className="module-heading"><div><p className="eyebrow">{text.eyebrow}</p><h1>{text.title}</h1><p>{text.description}</p></div>
      {owner ? <Link className="button button-primary" href={`${base}/new`}>＋ {text.add}</Link> : null}</section>
    {success ? <p className="form-message success" role="status">{success}</p> : null}
    {query.error === "forbidden" ? <p className="form-message error" role="alert">{text.errors.forbidden}</p> : null}
    {!owner ? <p className="read-only-notice">{text.readOnly}</p> : null}
    <form key={JSON.stringify(filters)} method="get" className="livestock-filters">
      <div className="form-field"><label htmlFor="group-search">{text.filters.search}</label><input id="group-search" type="search" name="search" maxLength={120} defaultValue={value("search")} /></div>
      <div className="form-field"><label htmlFor="group-species-filter">{text.filters.species}</label><input id="group-species-filter" name="species" type="search" maxLength={80} defaultValue={value("species")} /></div>
      <div className="form-field"><label htmlFor="group-active-filter">{text.filters.state}</label>
        <select id="group-active-filter" name="active" defaultValue={value("active")}><option value="">{text.all}</option><option value="true">{text.active}</option><option value="false">{text.inactive}</option></select></div>
      <div className="form-actions livestock-full-width"><button type="submit" className="button button-primary">{text.filters.apply}</button><Link className="button button-secondary" href={base}>{text.filters.clear}</Link></div>
    </form>
    <p className="field-hint">{text.countHint}</p>
    {!result.ok ? <section className="plot-state-card is-error" role="alert"><h2>{result.reason === "invalidFilters" ? text.errors.invalidFilters : text.errors.load}</h2></section>
      : !result.data.rows.length ? <section className="plot-state-card"><h2>{hasFilters ? text.noResults : text.empty}</h2><p>{text.emptyHint}</p>
        {owner && !hasFilters ? <Link className="button button-primary" href={`${base}/new`}>{text.add}</Link> : null}</section>
        : <section aria-label={text.title}><p className="plot-count"><strong>{formatCount(result.data.count, locale)}</strong> {text.groups}</p>
          <div className="livestock-grid">{result.data.rows.map((group) => <Link key={group.id} href={`${base}/${group.id}`} className="livestock-card">
            <div className="activity-card-heading"><h2 dir="auto">{group.name}</h2><AnimalGroupStatus locale={locale} active={group.is_active} /></div>
            <span className="livestock-species" dir="auto">{group.species}</span>
            <div className="livestock-balance"><span>{text.count}</span><AnimalGroupCount locale={locale} count={group.current_count} /></div>
            {BigInt(group.current_count) < BigInt(0) ? <small className="field-error">{text.negative}</small> : null}
          </Link>)}</div></section>}
    {result.ok ? <LivestockPagination locale={locale} page={result.data.filters.page} count={result.data.count} label={text.title}
      href={(page) => base + livestockQuery(result.data.filters, { page })} /> : null}
  </div>;
}
