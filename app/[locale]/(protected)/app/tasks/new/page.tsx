import { notFound, redirect } from "next/navigation";
import { createTask } from "@/app/[locale]/(protected)/app/tasks/actions";
import { TaskBreadcrumbs } from "@/components/task-breadcrumbs";
import { TaskForm } from "@/components/task-form";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getTaskContext } from "@/lib/tasks";
import { canEditTasks } from "@/lib/task-validation";

export const instant = false;

export default async function NewTaskPage({ params }: PageProps<"/[locale]/app/tasks/new">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { workspace, service } = await getTaskContext(locale);
  if (!workspace.farm) redirect(`/${locale}/onboarding`);
  if (!canEditTasks(workspace.role)) redirect(`/${locale}/app/tasks?error=forbidden`);
  const text = getDictionary(locale).tasks;
  const options = await service.options();
  return <div className="tasks-page">
    <TaskBreadcrumbs locale={locale} current={text.newTitle} />
    <header className="module-heading compact"><div><p className="eyebrow">{text.title}</p><h1>{text.newTitle}</h1></div></header>
    {!options.ok ? <p className="form-message error" role="alert">{text.errors.loadFailed}</p>
      : <div className="plot-form-card"><TaskForm action={createTask} locale={locale} mode="create" options={options.data} cancelHref={`/${locale}/app/tasks`} /></div>}
  </div>;
}
