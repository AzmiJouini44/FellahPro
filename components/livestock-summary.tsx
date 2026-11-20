import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { AnimalGroupCount, formatAnimalCount } from "@/components/livestock-status";
import { formatCount, formatUtcDate } from "@/lib/format";
import { getLivestockContext } from "@/lib/livestock";

export async function LivestockSummary({ locale }: { locale: Locale }) {
  const { service } = await getLivestockContext(locale); const result = await service.summary();
  const text = getDictionary(locale).livestock;
  return <section className="dashboard-cycle-summary">
    <div className="dashboard-section-heading"><div><h2>{text.summary.title}</h2><p>{text.countHint}</p></div>
      <Link href={`/${locale}/app/livestock`} className="button button-secondary button-small">{text.summary.view}</Link></div>
    {!result.ok ? <p className="form-message error" role="alert">{text.errors.load}</p> : <>
      <div className="activity-summary-grid"><article><span>{text.summary.total}</span><strong>{formatCount(result.data.groups, locale)}</strong></article>
        <article><span>{text.summary.active}</span><strong>{formatCount(result.data.active, locale)}</strong></article>
        <article><span>{text.summary.animals}</span><AnimalGroupCount locale={locale} count={result.data.animals} /></article></div>
      {result.data.negativeGroups > 0 ? <p className="form-message error" role="status">{text.summary.alerts}: {formatCount(result.data.negativeGroups, locale)}. {text.negative}</p> : null}
      <div className="livestock-dashboard-grid">
        <section><h3>{text.summary.species}</h3><p className="field-hint">{text.summary.hint}</p>
          <dl className="livestock-species-list">{result.data.bySpecies.slice(0, 8).map((type) => <div key={type.species}><dt dir="auto">{type.species}</dt>
            <dd>{formatCount(type.groups, locale)} {text.groups} · {formatAnimalCount(type.animals, locale)} {text.animals}</dd></div>)}</dl>
          {result.data.bySpecies.length > 8 ? <Link className="back-link" href={`/${locale}/app/livestock`}>{text.summary.view}</Link> : null}
        </section>
        <section><h3>{text.summary.recent}</h3>{!result.data.recent.length ? <p className="field-hint">{text.summary.noEvents}</p>
          : <ul className="livestock-recent-events">{result.data.recent.map((event) => <li key={event.id}>
            <Link href={`/${locale}/app/livestock/${event.animal_group_id}#events`}>{event.group?.name ?? text.unavailable}</Link>
            <span>{text.events.kinds[event.kind]} · {formatCount(event.quantity, locale)}</span><time dateTime={event.event_date}>{formatUtcDate(event.event_date, locale)}</time>
          </li>)}</ul>}
        </section>
      </div>
    </>}
  </section>;
}
