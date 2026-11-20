import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ActivityMissing } from "@/components/activity-missing";
import { ActivityBreadcrumbs } from "@/components/activity-breadcrumbs";
import { ActivityStatus, ActivityKindBadge } from "@/components/activity-status";
import { ActivityStatusControl } from "@/components/activity-status-control";
import { DeleteActivityControl } from "@/components/delete-activity-control";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getCurrentFarmActivity } from "@/lib/activities";
import { canManageActivities } from "@/lib/activity-validation";
import { formatCount, formatUtcDate } from "@/lib/format";

export const instant = false;

export default async function ActivityDetailsPage({ params, searchParams }: PageProps<"/[locale]/app/activities/[activityId]">) {
  const { locale, activityId } = await params;
  if (!isLocale(locale)) notFound();
  const { workspace, result, related } = await getCurrentFarmActivity(locale, activityId);
  if (!workspace.farm) redirect(`/${locale}/onboarding`);
  const text = getDictionary(locale).activities;
  if (!result.ok) return result.reason === "notFound" ? <ActivityMissing locale={locale} />
    : <section className="plot-state-card is-error"><h1>{text.errors.loadFailed}</h1></section>;
  const activity = result.data;
  const query = await searchParams;
  const success = typeof query.success === "string" && Object.hasOwn(text.success, query.success)
    ? text.success[query.success as keyof typeof text.success] : null;
  const hint = (shown: number, total: number) => text.details.relatedHint.replace("{shown}", formatCount(shown, locale)).replace("{total}", formatCount(total, locale));
  return <article className="activities-page">
    <ActivityBreadcrumbs locale={locale} activity={activity} />
    <Link className="back-link" href={`/${locale}/app/activities`}><span aria-hidden="true">←</span> {text.back}</Link>
    {success ? <p className="form-message success" role="status">{success}</p> : null}
    <header className="module-heading">
      <div><p className="eyebrow">{text.title}</p><h1>{activity.name}</h1><div className="activity-badges"><ActivityKindBadge locale={locale} kind={activity.kind} /><ActivityStatus locale={locale} active={activity.is_active} /></div></div>
      {canManageActivities(workspace.role) ? <div className="activity-actions">
        <Link className="button button-secondary" href={`/${locale}/app/activities/${activity.id}/edit`}>{text.edit}</Link>
        <ActivityStatusControl locale={locale} id={activity.id} active={activity.is_active} />
        <DeleteActivityControl locale={locale} id={activity.id} name={activity.name} />
      </div> : <p className="read-only-notice">{text.readOnly}</p>}
    </header>
    {related?.ok ? <div className="activity-related-grid">
      <section className="plot-notes-panel"><h2>{text.details.plots} ({formatCount(related.data.plotCount, locale)})</h2>
        <p className="field-hint">{hint(related.data.plots.length, related.data.plotCount)}</p>
        {related.data.plots.length ? <ul className="activity-related-list">{related.data.plots.map((plot) => <li key={plot.id}><Link href={`/${locale}/app/plots/${plot.id}`}>{plot.name}</Link></li>)}</ul> : <p>{text.details.noPlots}</p>}
      </section>
      <section className="plot-notes-panel"><h2>{text.details.cycles} ({formatCount(related.data.cycleCount, locale)})</h2>
        <p className="field-hint">{hint(related.data.cycles.length, related.data.cycleCount)}</p>
        {related.data.cycles.length ? <ul className="activity-related-list">{related.data.cycles.map((cycle) => <li key={cycle.id}><Link href={`/${locale}/app/crop-cycles/${cycle.id}`}>{cycle.crop_name} — {formatUtcDate(cycle.started_on, locale)}</Link></li>)}</ul> : <p>{text.details.noCycles}</p>}
      </section>
    </div> : <p className="form-message error" role="alert">{text.errors.loadFailed}</p>}
    <footer className="record-meta"><span>{text.details.createdAt}: {formatUtcDate(activity.created_at, locale)}</span><span>{text.details.updatedAt}: {formatUtcDate(activity.updated_at, locale)}</span></footer>
  </article>;
}
