import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DeleteAnimalGroupControl } from "@/components/delete-animal-group-control";
import { LivestockBreadcrumbs, LivestockMissing } from "@/components/livestock-breadcrumbs";
import { LivestockPagination } from "@/components/livestock-pagination";
import { AnimalGroupCount, AnimalGroupStatus } from "@/components/livestock-status";
import { TaskStatusBadge } from "@/components/task-status";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formatCount, formatTnd, formatUtcDate } from "@/lib/format";
import { getLivestockContext } from "@/lib/livestock";
import { animalEventKinds, canManageAnimalGroups, canRecordAnimalEvents, livestockQuery, validateGroupFilters } from "@/lib/livestock-validation";
import { canEditTasks } from "@/lib/task-validation";

export const instant = false;

export default async function AnimalGroupDetailsPage({ params, searchParams }: PageProps<"/[locale]/app/livestock/[groupId]">) {
  const { locale, groupId } = await params; if (!isLocale(locale)) notFound();
  const { workspace, service } = await getLivestockContext(locale);
  if (!workspace.farm) redirect(`/${locale}/onboarding`);
  const result = await service.get(groupId); const text = getDictionary(locale).livestock;
  if (!result.ok) return result.reason === "notFound" ? <LivestockMissing locale={locale} /> : <p className="form-message error" role="alert">{text.errors.load}</p>;
  const group = result.data; const query = await searchParams;
  const [events, tasks, ledger] = await Promise.all([
    service.events(groupId, { kind: query.kind, from: query.from, to: query.to, page: query.eventPage }),
    service.tasks(groupId), service.ledger(groupId, query.ledgerPage ?? "1"),
  ]);
  const base = `/${locale}/app/livestock/${group.id}`;
  const owner = canManageAnimalGroups(workspace.role);
  const success = typeof query.success === "string" && Object.hasOwn(text.success, query.success) ? text.success[query.success as keyof typeof text.success] : null;
  const eventFilters = events.ok ? events.data.filters : null;
  const ledgerPage = validateGroupFilters({ page: query.ledgerPage })?.page ?? 1;
  const paging = { kind: eventFilters?.kind ?? "", from: eventFilters?.from ?? "", to: eventFilters?.to ?? "", eventPage: eventFilters?.page ?? 1, ledgerPage };
  return <article className="livestock-page">
    <LivestockBreadcrumbs locale={locale} group={group} />
    <Link className="back-link" href={`/${locale}/app/livestock`}><span aria-hidden="true">←</span> {text.back}</Link>
    {success ? <p className="form-message success" role="status">{success}</p> : null}
    <header className="module-heading"><div><p className="eyebrow">{text.title}</p><h1 dir="auto">{group.name}</h1><p dir="auto">{group.species}</p><AnimalGroupStatus locale={locale} active={group.is_active} /></div>
      {owner ? <div className="livestock-actions"><Link className="button button-secondary" href={`${base}/edit`}>{text.edit}</Link><DeleteAnimalGroupControl locale={locale} id={group.id} name={group.name} /></div>
        : <p className="read-only-notice">{text.readOnly}</p>}</header>
    <section className="livestock-overview">
      <div className="livestock-balance"><span>{text.count}</span><AnimalGroupCount locale={locale} count={group.current_count} /></div>
      <p>{text.opening}: {formatCount(group.opening_count, locale)}</p><p className="field-hint">{text.countHint}</p>
      {BigInt(group.current_count) < BigInt(0) ? <p className="form-message error" role="status">{text.negative}</p> : null}
      <p className="record-activity-link">{text.fields.activityId}: {group.activity ? <Link href={`/${locale}/app/activities/${group.activity.id}`}>{group.activity.name}{group.activity.is_active ? "" : ` (${text.inactive})`}</Link> : text.unavailable}</p>
    </section>
    <section className="livestock-section" id="events" aria-labelledby="animal-events-title">
      <div className="dashboard-section-heading"><div><h2 id="animal-events-title">{text.events.title}</h2><p>{text.events.history}</p></div>
        {canRecordAnimalEvents(workspace.role) ? <Link className="button button-primary" href={`${base}/events/new`}>＋ {text.events.add}</Link> : <p className="read-only-notice">{text.eventReadOnly}</p>}</div>
      <form key={JSON.stringify(eventFilters)} method="get" action={base + "#events"} className="livestock-filters">
        <input type="hidden" name="ledgerPage" value={ledgerPage} />
        <div className="form-field"><label htmlFor="history-kind">{text.fields.kind}</label><select name="kind" id="history-kind" defaultValue={eventFilters?.kind ?? ""}>
          <option value="">{text.all}</option>{animalEventKinds.map((kind) => <option key={kind} value={kind}>{text.events.kinds[kind]}</option>)}</select></div>
        <div className="form-field"><label htmlFor="history-from">{text.filters.from}</label><input id="history-from" name="from" type="date" defaultValue={eventFilters?.from ?? ""} /></div>
        <div className="form-field"><label htmlFor="history-to">{text.filters.to}</label><input id="history-to" name="to" type="date" defaultValue={eventFilters?.to ?? ""} /></div>
        <div className="form-actions livestock-full-width"><button className="button button-primary" type="submit">{text.filters.apply}</button><Link href={base + "#events"} className="button button-secondary">{text.filters.clear}</Link></div>
      </form>
      {!events.ok ? <p className="form-message error" role="alert">{events.reason === "invalidFilters" ? text.errors.invalidFilters : text.errors.load}</p> : <>
        <p className="plot-count">{formatCount(events.data.count, locale)} {text.events.count}</p>
        {!events.data.rows.length ? <p className="field-hint">{text.events.empty}</p> : <ol className="livestock-event-list">{events.data.rows.map((event) => <li key={event.id}>
          <div className="livestock-event-heading"><h3>{text.events.kinds[event.kind]}</h3><time dateTime={event.event_date}>{formatUtcDate(event.event_date, locale)}</time></div>
          <p>{text.fields.quantity}: <strong><bdi>{text.events.effects[event.kind]} {formatCount(event.quantity, locale)}</bdi></strong></p>
          <p className="livestock-event-notes" dir="auto">{event.notes || text.events.noNotes}</p>
          <small>{text.events.recorded}: {formatUtcDate(event.created_at, locale)}</small>
        </li>)}</ol>}
        <LivestockPagination locale={locale} page={events.data.filters.page} count={events.data.count} label={text.events.title}
          href={(page) => base + livestockQuery(paging, { eventPage: page }) + "#events"} />
      </>}
    </section>
    <section className="livestock-section" aria-labelledby="animal-tasks-title">
      <div className="dashboard-section-heading"><h2 id="animal-tasks-title">{text.tasks.title}</h2>
        {canEditTasks(workspace.role) ? <Link className="button button-secondary" href={`/${locale}/app/tasks/new?animalGroupId=${group.id}`}>{text.tasks.add}</Link> : null}</div>
      {!tasks.ok ? <p className="form-message error" role="alert">{text.errors.load}</p> : <>
        {!tasks.data.rows.length ? <p>{text.tasks.empty}</p> : <ul className="livestock-task-list">{tasks.data.rows.map((task) => <li key={task.id}>
          <Link href={`/${locale}/app/tasks/${task.id}`} dir="auto">{task.title}</Link><TaskStatusBadge locale={locale} status={task.status} /></li>)}</ul>}
        <p className="field-hint">{text.tasks.preview.replace("{shown}", formatCount(tasks.data.rows.length, locale)).replace("{total}", formatCount(tasks.data.count, locale))}</p>
        <Link className="back-link" href={`/${locale}/app/tasks?animalGroupId=${group.id}`}>{text.tasks.all}</Link>
      </>}
    </section>
    <section className="livestock-section" id="finance" aria-labelledby="animal-finance-title">
      <h2 id="animal-finance-title">{text.finance.title}</h2><p className="field-hint">{text.finance.hint}</p><p className="field-hint">{text.finance.notPayment}</p>
      {!ledger.ok ? <p className="form-message error" role="alert">{ledger.reason === "invalidFilters" ? text.errors.invalidFilters : text.errors.load}</p> : <>
        <p className="plot-count">{formatCount(ledger.data.count, locale)} {text.finance.count}</p>
        {!ledger.data.rows.length ? <p>{text.finance.empty}</p> : <ul className="livestock-ledger-list">{ledger.data.rows.map((line) => <li key={line.id}>
          <div><strong>{text.finance[line.transaction.kind]}</strong><p dir="auto">{line.description}</p>
            {line.transaction.reference ? <small>{text.finance.reference}: <bdi>{line.transaction.reference}</bdi></small> : null}
            <time dateTime={line.transaction.transaction_date}>{formatUtcDate(line.transaction.transaction_date, locale)}</time></div>
          <strong dir="auto">{formatTnd(Number(line.amount), locale)}</strong>
        </li>)}</ul>}
        <LivestockPagination locale={locale} page={ledgerPage} count={ledger.data.count} label={text.finance.title}
          href={(page) => base + livestockQuery(paging, { ledgerPage: page }) + "#finance"} />
      </>}
    </section>
    <footer className="record-meta"><span>{text.createdAt}: {formatUtcDate(group.created_at, locale)}</span><span>{text.updatedAt}: {formatUtcDate(group.updated_at, locale)}</span></footer>
  </article>;
}
