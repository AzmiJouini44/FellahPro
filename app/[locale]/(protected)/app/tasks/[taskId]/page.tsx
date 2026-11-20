import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DeleteTaskControl } from "@/components/delete-task-control";
import { TaskBreadcrumbs } from "@/components/task-breadcrumbs";
import { TaskMissing } from "@/components/task-missing";
import { TaskReminderRefresh } from "@/components/task-reminder-refresh";
import { TaskDueBadge, TaskPriorityBadge, TaskStatusBadge, taskMemberLabel } from "@/components/task-status";
import { TaskStatusControl } from "@/components/task-status-control";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formatUtcDate } from "@/lib/format";
import { getCurrentFarmTask } from "@/lib/tasks";
import { canDeleteTasks, canEditTasks, getTaskDates } from "@/lib/task-validation";

export const instant = false;

export default async function TaskDetailsPage({ params, searchParams }: PageProps<"/[locale]/app/tasks/[taskId]">) {
  const { locale, taskId } = await params;
  if (!isLocale(locale)) notFound();
  const { workspace, result } = await getCurrentFarmTask(locale, taskId);
  if (!workspace.farm) redirect(`/${locale}/onboarding`);
  const text = getDictionary(locale).tasks;
  if (!result.ok) return result.reason === "notFound" ? <TaskMissing locale={locale} />
    : <section className="plot-state-card is-error" role="alert"><h1>{text.errors.loadFailed}</h1></section>;
  const task = result.data;
  const query = await searchParams;
  const success = typeof query.success === "string" && Object.hasOwn(text.success, query.success)
    ? text.success[query.success as keyof typeof text.success] : null;
  const editable = canEditTasks(workspace.role);
  return <article className="tasks-page">
    <TaskReminderRefresh />
    <TaskBreadcrumbs locale={locale} task={task} />
    <Link className="back-link" href={`/${locale}/app/tasks`}><span aria-hidden="true">←</span> {text.back}</Link>
    {success ? <p className="form-message success" role="status">{success}</p> : null}
    <header className="module-heading">
      <div><p className="eyebrow">{text.title}</p><h1 dir="auto">{task.title}</h1>
        <div className="task-badges"><TaskStatusBadge locale={locale} status={task.status} /><TaskPriorityBadge locale={locale} priority={task.priority} /><TaskDueBadge locale={locale} task={task} dates={getTaskDates()} /></div>
      </div>
      {editable ? <div className="task-actions">
        <Link className="button button-secondary" href={`/${locale}/app/tasks/${task.id}/edit`}>{text.edit}</Link>
        {canDeleteTasks(workspace.role) ? <DeleteTaskControl locale={locale} id={task.id} title={task.title} /> : null}
      </div> : <p className="read-only-notice">{text.readOnly}</p>}
    </header>
    {editable ? <TaskStatusControl key={task.status} locale={locale} id={task.id} status={task.status} /> : null}
    <div className="task-detail-grid">
      <section className="plot-notes-panel"><h2>{text.details.description}</h2><p className="task-description" dir="auto">{task.description || text.details.noDescription}</p></section>
      <section className="plot-notes-panel"><h2>{text.details.references}</h2>
        <dl className="task-detail-fields">
          <div><dt>{text.form.dueOn}</dt><dd>{task.due_on ? <time dateTime={task.due_on}>{formatUtcDate(task.due_on, locale)}</time> : text.dueStates.noDue}</dd></div>
          <div><dt>{text.form.assignedTo}</dt><dd dir="auto">{task.member ? taskMemberLabel(locale, task.member) : task.assigned_to ? text.unavailable : text.unassigned}</dd></div>
          <div><dt>{text.form.activityId}</dt><dd>{task.activity ? <Link href={`/${locale}/app/activities/${task.activity.id}`}>{task.activity.name}{task.activity.is_active ? "" : ` (${text.form.inactive})`}</Link> : task.activity_id ? text.unavailable : text.none}</dd></div>
          <div><dt>{text.form.cropCycleId}</dt><dd>{task.cycle ? <Link href={`/${locale}/app/crop-cycles/${task.cycle.id}`}>{task.cycle.crop_name} — {formatUtcDate(task.cycle.started_on, locale)}</Link> : task.crop_cycle_id ? text.unavailable : text.none}</dd></div>
          <div><dt>{text.form.animalGroupId}</dt><dd dir="auto">{task.group?.name ?? (task.animal_group_id ? text.unavailable : text.none)}</dd></div>
        </dl>
      </section>
    </div>
    <footer className="record-meta"><span>{text.details.createdAt}: {formatUtcDate(task.created_at, locale)}</span><span>{text.details.updatedAt}: {formatUtcDate(task.updated_at, locale)}</span></footer>
  </article>;
}
