import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TaskBreadcrumbs } from "@/components/task-breadcrumbs";
import { TaskReminderRefresh } from "@/components/task-reminder-refresh";
import { TaskDueBadge, TaskPriorityBadge, TaskStatusBadge, taskMemberLabel } from "@/components/task-status";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formatCount, formatUtcDate } from "@/lib/format";
import { listCurrentFarmTasks } from "@/lib/tasks";
import { TASK_PAGE_SIZE, canEditTasks, taskListQuery, taskPriorities, taskStatuses, taskViews } from "@/lib/task-validation";

export const instant = false;

export default async function TasksPage({ params, searchParams }: PageProps<"/[locale]/app/tasks">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const query = await searchParams;
  const { workspace, result, members } = await listCurrentFarmTasks(locale, {
    search: query.search, status: query.status, priority: query.priority, assignee: query.assignee,
    dueFrom: query.dueFrom, dueTo: query.dueTo, view: query.view, page: query.page,
    animalGroupId: query.animalGroupId,
  });
  if (!workspace.farm) redirect(`/${locale}/onboarding`);
  const text = getDictionary(locale).tasks;
  const editable = canEditTasks(workspace.role);
  const filters = result.ok ? result.data.filters : null;
  const view = filters?.view ?? "all";
  const team = members.ok ? members.data : [];
  const hasFilters = filters && Boolean(filters.search || filters.status || filters.priority || filters.assignee || filters.animalGroupId || filters.dueFrom || filters.dueTo || filters.view !== "all");
  const success = typeof query.success === "string" && Object.hasOwn(text.success, query.success)
    ? text.success[query.success as keyof typeof text.success] : null;
  const value = (key: "search" | "status" | "priority" | "assignee" | "dueFrom" | "dueTo") =>
    filters?.[key] ?? (typeof query[key] === "string" ? query[key] : "");
  const base = `/${locale}/app/tasks`;

  return <div className="tasks-page">
    <TaskReminderRefresh />
    <TaskBreadcrumbs locale={locale} />
    <section className="module-heading">
      <div><p className="eyebrow">{text.eyebrow}</p><h1>{text.title}</h1><p>{text.description}</p></div>
      {editable ? <Link className="button button-primary" href={`${base}/new`}>＋ {text.add}</Link> : null}
    </section>
    {success ? <p className="form-message success" role="status">{success}</p> : null}
    {query.error === "forbidden" ? <p className="form-message error" role="alert">{text.errors.forbidden}</p> : null}
    {!editable ? <p className="read-only-notice">{text.readOnly}</p> : null}
    {result.ok && result.data.group ? <p className="record-activity-link">
      {getDictionary(locale).livestock.tasks.filtered}: <Link href={`/${locale}/app/livestock/${result.data.group.id}`}>{result.data.group.name}</Link>
      {" · "}<Link href={base + taskListQuery(result.data.filters, { animalGroupId: "", page: 1 })}>{getDictionary(locale).livestock.tasks.clear}</Link>
    </p> : null}
    <nav className="task-views" aria-label={text.title}>
      {taskViews.map((item) => <Link key={item} aria-current={view === item ? "page" : undefined}
        href={base + (filters ? taskListQuery(filters, {
          view: item, page: 1, status: "", assignee: view === "mine" || item === "mine" ? "" : filters.assignee,
        }) : item === "all" ? "" : `?view=${item}`)}>{text.views[item]}</Link>)}
    </nav>
    <form key={JSON.stringify(filters)} method="get" className="task-filters">
      <input type="hidden" name="view" value={view} />
      {filters?.animalGroupId ? <input type="hidden" name="animalGroupId" value={filters.animalGroupId} /> : null}
      <div className="form-field task-search"><label htmlFor="task-search">{text.filters.search}</label>
        <input id="task-search" name="search" type="search" maxLength={120} defaultValue={value("search")} placeholder={text.filters.searchPlaceholder} />
      </div>
      <div className="form-field"><label htmlFor="filter-task-status">{text.filters.status}</label>
        <select id="filter-task-status" name="status" defaultValue={value("status")} disabled={view === "completed"}>
          <option value="">{text.all}</option>{taskStatuses.map((status) => <option key={status} value={status}>{text.statuses[status]}</option>)}
        </select>
      </div>
      <div className="form-field"><label htmlFor="filter-task-priority">{text.filters.priority}</label>
        <select id="filter-task-priority" name="priority" defaultValue={value("priority")}>
          <option value="">{text.all}</option>{taskPriorities.map((priority) => <option key={priority} value={priority}>{text.priorities[priority]}</option>)}
        </select>
      </div>
      <div className="form-field"><label htmlFor="filter-task-assignee">{text.filters.assignee}</label>
        <select id="filter-task-assignee" name="assignee" defaultValue={value("assignee")} disabled={view === "mine" || !members.ok}>
          <option value="">{text.all}</option><option value="unassigned">{text.unassigned}</option>
          {team.map((member) => <option key={member.id} value={member.id}>{taskMemberLabel(locale, member)}{member.id === workspace.user.id ? ` (${text.me})` : ""}</option>)}
        </select>
      </div>
      <div className="form-field"><label htmlFor="task-due-from">{text.filters.dueFrom}</label>
        <input id="task-due-from" name="dueFrom" type="date" defaultValue={value("dueFrom")} />
      </div>
      <div className="form-field"><label htmlFor="task-due-to">{text.filters.dueTo}</label>
        <input id="task-due-to" name="dueTo" type="date" defaultValue={value("dueTo")} />
      </div>
      <div className="form-actions task-full-width"><button className="button button-primary" type="submit">{text.filters.apply}</button>
        <Link className="button button-secondary" href={base + (view === "all" ? "" : `?view=${view}`)}>{text.filters.clear}</Link>
      </div>
    </form>
    <p className="field-hint">{text.reminders.window} {text.reminders.refresh}</p>
    {!members.ok ? <p className="form-message error" role="alert">{text.errors.loadFailed}</p> : null}
    {!result.ok ? <section className="plot-state-card is-error" role="alert"><h2>{result.reason === "invalidFilters" ? text.errors.invalidFilters : text.errors.loadFailed}</h2></section>
      : result.data.rows.length === 0 ? <section className="plot-state-card">
        <h2>{hasFilters || result.data.filters.page > 1 ? text.noResults : text.emptyTitle}</h2><p>{text.emptyDescription}</p>
        {editable && !hasFilters && result.data.filters.page === 1 ? <Link className="button button-primary" href={`${base}/new`}>{text.add}</Link> : null}
      </section> : <section aria-label={text.title}>
        <p className="plot-count"><strong>{formatCount(result.data.count, locale)}</strong> {text.count}</p>
        <div className="task-grid">{result.data.rows.map((task) => {
          const member = team.find((person) => person.id === task.assigned_to);
          return <Link className={`task-card task-card-${task.status}`} key={task.id} href={`${base}/${task.id}`}>
            <div className="task-card-heading"><h2 dir="auto">{task.title}</h2><TaskStatusBadge locale={locale} status={task.status} /></div>
            <div className="task-badges"><TaskPriorityBadge locale={locale} priority={task.priority} /><TaskDueBadge locale={locale} task={task} dates={result.data.dates} /></div>
            <dl className="task-card-meta">
              <div><dt>{text.form.dueOn}</dt><dd>{task.due_on ? <time dateTime={task.due_on}>{formatUtcDate(task.due_on, locale)}</time> : text.dueStates.noDue}</dd></div>
              <div><dt>{text.form.assignedTo}</dt><dd dir="auto">{member ? taskMemberLabel(locale, member) : task.assigned_to ? text.unavailable : text.unassigned}</dd></div>
            </dl>
          </Link>;
        })}</div>
      </section>}
    {result.ok && (result.data.filters.page > 1 || result.data.count > TASK_PAGE_SIZE) ? <nav className="activity-pagination" aria-label={text.filters.page}>
      {result.data.filters.page > 1 ? <Link className="button button-secondary" href={base + taskListQuery(result.data.filters, { page: result.data.filters.page - 1 })}>{text.filters.previous}</Link> : null}
      <span>{text.filters.page} {formatCount(result.data.filters.page, locale)}</span>
      {result.data.filters.page * TASK_PAGE_SIZE < result.data.count ? <Link className="button button-secondary" href={base + taskListQuery(result.data.filters, { page: result.data.filters.page + 1 })}>{text.filters.next}</Link> : null}
    </nav> : null}
  </div>;
}
