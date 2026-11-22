import { notFound, redirect } from "next/navigation";
import { updateOperation } from "@/app/[locale]/(protected)/app/operations/actions";
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
export default async function EditOperationPage({
  params,
}: PageProps<"/[locale]/app/operations/[operationId]/edit">) {
  const { locale, operationId } = await params;
  if (!isLocale(locale)) notFound();
  const { workspace, service } = await getOperationContext(locale);
  if (!workspace.farm) redirect(`/${locale}/onboarding`);
  if (!canEditOperations(workspace.role))
    redirect(`/${locale}/app/operations?error=forbidden`);
  const result = await service.get(operationId);
  const text = getDictionary(locale).operations;
  if (!result.ok)
    return result.reason === "notFound" ? (
      <OperationMissing locale={locale} />
    ) : (
      <p className="form-message error" role="alert">
        {text.errors.load}
      </p>
    );
  const options = await service.options(result.data.id);
  return (
    <div className="operations-page">
      <OperationBreadcrumbs
        locale={locale}
        operation={{
          id: result.data.id,
          label: text.types[result.data.operation_type],
        }}
        current={text.editTitle}
      />
      <header className="module-heading compact">
        <div>
          <p className="eyebrow">{text.title}</p>
          <h1>{text.editTitle}</h1>
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
            action={updateOperation.bind(null, result.data.id)}
            options={options.data}
            initial={result.data}
            today={getTaskDates().today}
            owner={canLinkOperationExpenses(workspace.role)}
            cancelHref={`/${locale}/app/operations/${result.data.id}`}
          />
        </div>
      )}
    </div>
  );
}
