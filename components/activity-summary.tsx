import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getActivityContext } from "@/lib/activities";
import { activityKinds } from "@/lib/activity-validation";
import { formatCount } from "@/lib/format";

export async function ActivitySummary({ locale }: { locale: Locale }) {
  const { service } = await getActivityContext(locale);
  const result = await service.summary();
  const text = getDictionary(locale).activities;
  return <section className="dashboard-cycle-summary">
    <div className="dashboard-section-heading"><div><h2>{text.summary.title}</h2><p>{text.summary.hint}</p></div>
      <Link className="button button-secondary button-small" href={`/${locale}/app/activities`}>{text.summary.view}</Link></div>
    {!result.ok ? <p className="form-message error" role="alert">{text.errors.loadFailed}</p> : <>
      <div className="activity-summary-grid">{(["total", "active", "inactive"] as const).map((key) => <article key={key}><span>{text.summary[key]}</span><strong>{formatCount(result.data[key], locale)}</strong></article>)}</div>
      <dl className="activity-kind-counts">{activityKinds.map((kind) => <div key={kind}><dt>{text.kinds[kind]}</dt><dd>{formatCount(result.data.byKind[kind], locale)}</dd></div>)}</dl>
    </>}
  </section>;
}
