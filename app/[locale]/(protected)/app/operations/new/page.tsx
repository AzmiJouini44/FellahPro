import { notFound, redirect } from "next/navigation";
import { createOperation } from "@/app/[locale]/(protected)/app/operations/actions";
import {
  OperationBreadcrumbs,
  OperationMissing,
} from "@/components/operation-breadcrumbs";
import { OperationForm } from "@/components/operation-form";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getOperationContext } from "@/lib/operations";
import {
  canEditOperations,
  canLinkOperationExpenses,
} from "@/lib/operation-validation";
import { getTaskDates } from "@/lib/task-validation";

export const instant = false;
export default async function NewOperationPage({
  params,
  searchParams,
}: PageProps<"/[locale]/app/operations/new">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { workspace, service } = await getOperationContext(locale);
  if (!workspace.farm) redirect(`/${locale}/onboarding`);
  if (!canEditOperations(workspace.role))
    redirect(`/${locale}/app/operations?error=forbidden`);
  const query = await searchParams;
  const text = getDictionary(locale).operations;
  const defaults = await service.defaults({
    plotId: query.plotId,
    cycleId: query.cycleId,
    taskId: query.taskId,
  });
  if (!defaults.ok)
    return defaults.reason === "notFound" ? (
      <OperationMissing locale={locale} />
    ) : (
      <p className="form-message error" role="alert">
        {text.errors.load}
      </p>
    );
  const options = await service.options();
  return (
    <div className="operations-page">
      <OperationBreadcrumbs locale={locale} current={text.add} />
      <header className="module-heading compact">
        <div>
          <p className="eyebrow">{text.title}</p>
          <h1>{text.newTitle}</h1>
        </div>
      </header>
      {!options.ok ? (
        <p className="form-message error" role="alert">
          {text.errors.load}
        </p>
      ) : (
        <div className="plot-form-card">
          <OperationForm
            locale={locale}
            action={createOperation}
            options={options.data}
            defaults={defaults.data}
            today={getTaskDates().today}
            owner={canLinkOperationExpenses(workspace.role)}
            cancelHref={`/${locale}/app/operations`}
          />
        </div>
      )}
    </div>
  );
}
