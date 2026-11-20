import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ActivityKindBadge, ActivityStatus } from "@/components/activity-status";
import { ActivityBreadcrumbs } from "@/components/activity-breadcrumbs";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { listCurrentFarmActivities } from "@/lib/activities";
import { ACTIVITY_PAGE_SIZE, activityKinds, activityListQuery, canManageActivities } from "@/lib/activity-validation";
import { formatCount, formatUtcDate } from "@/lib/format";

export const instant = false;

export default async function ActivitiesPage({ params, searchParams }: PageProps<"/[locale]/app/activities">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const query = await searchParams;
  const { workspace, result } = await listCurrentFarmActivities(locale, {
    search: query.search, kind: query.kind, active: query.active,
    createdFrom: query.createdFrom, createdTo: query.createdTo, page: query.page,
  });
  if (!workspace.farm) redirect(`/${locale}/onboarding`);
  const text = getDictionary(locale).activities;
  const owner = canManageActivities(workspace.role);
  const filters = result.ok ? result.data.filters : null;
  const hasFilters = filters && Boolean(filters.search || filters.kind || filters.active || filters.createdFrom || filters.createdTo);
  const success = typeof query.success === "string" && Object.hasOwn(text.success, query.success)
    ? text.success[query.success as keyof typeof text.success] : null;
  const value = (key: "search" | "kind" | "active" | "createdFrom" | "createdTo") =>
    filters?.[key] ?? (typeof query[key] === "string" ? query[key] : "");
  return <div className="activities-page">
    <ActivityBreadcrumbs locale={locale} />
    <section className="module-heading">
      <div><p className="eyebrow">{text.eyebrow}</p><h1>{text.title}</h1><p>{text.description}</p></div>
      {owner ? <Link className="button button-primary" href={`/${locale}/app/activities/new`}>＋ {text.add}</Link> : null}
    </section>
    {success ? <p className="form-message success" role="status">{success}</p> : null}
    {query.error === "forbidden" ? <p className="form-message error" role="alert">{text.errors.forbidden}</p> : null}
    {!owner ? <p className="read-only-notice">{text.readOnly}</p> : null}
    <form method="get" className="activity-filters">
      <div className="form-field activity-search"><label htmlFor="activity-search">{text.filters.search}</label>
        <input id="activity-search" name="search" type="search" maxLength={120} defaultValue={value("search")} placeholder={text.filters.searchPlaceholder} /></div>
      <div className="form-field"><label htmlFor="filter-activity-kind">{text.filters.kind}</label>
        <select id="filter-activity-kind" name="kind" defaultValue={value("kind")}><option value="">{text.all}</option>
          {activityKinds.map((kind) => <option key={kind} value={kind}>{text.kinds[kind]}</option>)}
        </select></div>
      <div className="form-field"><label htmlFor="filter-activity-active">{text.filters.active}</label>
        <select id="filter-activity-active" name="active" defaultValue={value("active")}>
          <option value="">{text.all}</option><option value="true">{text.active}</option><option value="false">{text.inactive}</option>
        </select></div>
      <div className="form-field"><label htmlFor="activity-created-from">{text.filters.from}</label>
        <input id="activity-created-from" name="createdFrom" type="date" defaultValue={value("createdFrom")} aria-describedby="activity-date-hint" /></div>
      <div className="form-field"><label htmlFor="activity-created-to">{text.filters.to}</label>
        <input id="activity-created-to" name="createdTo" type="date" defaultValue={value("createdTo")} aria-describedby="activity-date-hint" /></div>
      <p className="field-hint activity-date-hint" id="activity-date-hint">{text.filters.dateHint}</p>
      <div className="form-actions activity-filter-actions"><button className="button button-primary" type="submit">{text.filters.apply}</button>
        <Link className="button button-secondary" href={`/${locale}/app/activities`}>{text.filters.clear}</Link></div>
    </form>
    {!result.ok ? <section className="plot-state-card is-error" role="alert"><h2>{result.reason === "invalidFilters" ? text.errors.invalidFilters : text.errors.loadFailed}</h2></section>
      : result.data.rows.length === 0 ? <section className="plot-state-card">
        <h2>{hasFilters || result.data.filters.page > 1 ? text.noResults : text.emptyTitle}</h2><p>{text.emptyDescription}</p>
        {owner && !hasFilters && result.data.filters.page === 1 ? <Link className="button button-primary" href={`/${locale}/app/activities/new`}>{text.add}</Link> : null}
      </section> : <section aria-label={text.title}>
        <p className="plot-count"><strong>{formatCount(result.data.count, locale)}</strong> {text.count}</p>
        <div className="activity-grid">{result.data.rows.map((activity) => <Link className="activity-card" key={activity.id} href={`/${locale}/app/activities/${activity.id}`}>
          <div className="activity-card-heading"><h2>{activity.name}</h2><ActivityStatus locale={locale} active={activity.is_active} /></div>
          <ActivityKindBadge locale={locale} kind={activity.kind} />
          <small>{text.details.createdAt}: {formatUtcDate(activity.created_at, locale)}</small>
        </Link>)}</div>
      </section>}
    {result.ok && (result.data.filters.page > 1 || result.data.count > ACTIVITY_PAGE_SIZE) ? <nav className="activity-pagination" aria-label={text.filters.page}>
      {result.data.filters.page > 1 ? <Link className="button button-secondary" href={`/${locale}/app/activities${activityListQuery(result.data.filters, result.data.filters.page - 1)}`}>{text.filters.previous}</Link> : null}
      <span>{text.filters.page} {formatCount(result.data.filters.page, locale)}</span>
      {result.data.filters.page * ACTIVITY_PAGE_SIZE < result.data.count ? <Link className="button button-secondary" href={`/${locale}/app/activities${activityListQuery(result.data.filters, result.data.filters.page + 1)}`}>{text.filters.next}</Link> : null}
    </nav> : null}
  </div>;
}
