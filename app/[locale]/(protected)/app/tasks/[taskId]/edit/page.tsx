import { notFound, redirect } from "next/navigation";
import { updateTask } from "@/app/[locale]/(protected)/app/tasks/actions";
import { TaskBreadcrumbs } from "@/components/task-breadcrumbs";
import { TaskForm } from "@/components/task-form";
import { TaskMissing } from "@/components/task-missing";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getTaskContext } from "@/lib/tasks";
import { canEditTasks } from "@/lib/task-validation";

export const instant = false;

export default async function EditTaskPage({ params }: PageProps<"/[locale]/app/tasks/[taskId]/edit">) {
  const { locale, taskId } = await params;
  if (!isLocale(locale)) notFound();
  const { workspace, service } = await getTaskContext(locale);
  if (!workspace.farm) redirect(`/${locale}/onboarding`);
  if (!canEditTasks(workspace.role)) redirect(`/${locale}/app/tasks?error=forbidden`);
  const result = await service.get(taskId);
  const text = getDictionary(locale).tasks;
  if (!result.ok) return result.reason === "notFound" ? <TaskMissing locale={locale} />
    : <section className="plot-state-card is-error" role="alert"><h1>{text.errors.loadFailed}</h1></section>;
  const options = await service.options();
  const task = result.data;
  return <div className="tasks-page">
    <TaskBreadcrumbs locale={locale} task={task} current={text.editTitle} />
    <header className="module-heading compact"><div><p className="eyebrow">{text.title}</p><h1>{text.editTitle}</h1></div></header>
    {!options.ok ? <p className="form-message error" role="alert">{text.errors.loadFailed}</p>
      : <div className="plot-form-card"><TaskForm action={updateTask.bind(null, task.id)} locale={locale} mode="edit" options={options.data}
        initialValues={{
          title: task.title, description: task.description, dueOn: task.due_on, status: task.status, priority: task.priority,
          activityId: task.activity_id, cropCycleId: task.crop_cycle_id, animalGroupId: task.animal_group_id, assignedTo: task.assigned_to,
        }} cancelHref={`/${locale}/app/tasks/${task.id}`} /></div>}
  </div>;
}
