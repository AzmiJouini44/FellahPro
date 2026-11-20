import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DeleteOperationControl } from "@/components/delete-operation-control";
import {
  OperationBreadcrumbs,
  OperationMissing,
} from "@/components/operation-breadcrumbs";
import { formatOperationQuantity } from "@/components/operation-card";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formatTnd, formatUtcDate } from "@/lib/format";
import { getOperationContext } from "@/lib/operations";
import {
  canDeleteOperations,
  canEditOperations,
} from "@/lib/operation-validation";

export const instant = false;
export default async function OperationDetailsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/app/operations/[operationId]">) {
  const { locale, operationId } = await params;
  if (!isLocale(locale)) notFound();
  const { workspace, service } = await getOperationContext(locale);
  if (!workspace.farm) redirect(`/${locale}/onboarding`);
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
  const operation = result.data;
  const query = await searchParams;
  const success =
    typeof query.success === "string" &&
    Object.hasOwn(text.success, query.success)
      ? text.success[query.success as keyof typeof text.success]
      : null;
  return (
    <article className="operations-page">
      <OperationBreadcrumbs
        locale={locale}
        operation={{
          id: operation.id,
          label: text.types[operation.operation_type],
        }}
      />
      <Link className="back-link" href={`/${locale}/app/operations`}>
        <span aria-hidden="true">←</span> {text.back}
      </Link>
      {success ? (
        <p className="form-message success" role="status">
          {success}
        </p>
      ) : null}
      <header className="module-heading">
        <div>
          <p className="eyebrow">{text.title}</p>
          <h1>{text.types[operation.operation_type]}</h1>
          <p>
            <time dateTime={operation.performed_on}>
              {formatUtcDate(operation.performed_on, locale)}
            </time>{" "}
            · <bdi>{operation.plot_name}</bdi>
          </p>
        </div>
        {canEditOperations(workspace.role) ? (
          <div className="operation-actions">
            <Link
              className="button button-secondary"
              href={`/${locale}/app/operations/${operation.id}/edit`}
            >
              {text.edit}
            </Link>
            {canDeleteOperations(workspace.role) ? (
              <DeleteOperationControl locale={locale} id={operation.id} />
            ) : null}
          </div>
        ) : (
          <p className="read-only-notice">{text.readOnly}</p>
        )}
      </header>
      <section className="operation-detail-panel">
        <h2>{text.details.title}</h2>
        <dl className="operation-detail-fields">
          <div>
            <dt>{text.filters.plot}</dt>
            <dd>
              <Link href={`/${locale}/app/plots/${operation.plot_id}`}>
                {operation.plot_name}
              </Link>
            </dd>
          </div>
          <div>
            <dt>{text.fields.cycleId}</dt>
            <dd>
              {operation.crop_cycle_id ? (
                <Link
                  href={`/${locale}/app/crop-cycles/${operation.crop_cycle_id}`}
                >
                  {operation.crop_name ?? text.unknown}
                </Link>
              ) : (
                text.none
              )}
            </dd>
          </div>
          <div>
            <dt>{text.fields.activityId}</dt>
            <dd>
              {operation.activity_id ? (
                <Link
                  href={`/${locale}/app/activities/${operation.activity_id}`}
                >
                  {operation.activity_name ?? text.unknown}
                </Link>
              ) : (
                text.none
              )}
            </dd>
          </div>
          <div>
            <dt>{text.fields.taskId}</dt>
            <dd>
              {operation.related_task_id ? (
                <Link
                  href={`/${locale}/app/tasks/${operation.related_task_id}`}
                >
                  {operation.task_title ?? text.unknown}
                </Link>
              ) : (
                text.none
              )}
            </dd>
          </div>
          <div>
            <dt>{text.fields.quantity}</dt>
            <dd>
              {operation.quantity !== null && operation.unit
                ? `${formatOperationQuantity(operation.quantity, locale)} ${text.units[operation.unit]}`
                : text.unknown}
            </dd>
          </div>
          <div>
            <dt>{text.fields.description}</dt>
            <dd dir="auto">{operation.description || text.unknown}</dd>
          </div>
        </dl>
      </section>
      <section className="plot-notes-panel">
        <h2>{text.fields.notes}</h2>
        <p className="operation-notes" dir="auto">
          {operation.notes || text.details.noNotes}
        </p>
      </section>
      <section className="operation-detail-panel">
        <h2>{text.finance.amount}</h2>
        {operation.expense_line_id && operation.expense_amount !== null ? (
          <>
            <strong className="operation-expense-amount">
              {formatTnd(Number(operation.expense_amount), locale)}
            </strong>
            <p dir="auto">{operation.expense_description}</p>
            {operation.expense_date ? (
              <p>
                {text.finance.trace}{" "}
                {formatUtcDate(operation.expense_date, locale)}
              </p>
            ) : null}
            {operation.expense_reference ? (
              <p>
                {text.finance.reference}:{" "}
                <bdi>{operation.expense_reference}</bdi>
              </p>
            ) : null}
          </>
        ) : (
          <p>{text.finance.noExpense}</p>
        )}
        <p className="field-hint">{text.finance.noCreation}</p>
      </section>
      <footer className="record-meta">
        <span>
          {text.details.created}: {formatUtcDate(operation.created_at, locale)}
        </span>
        <span>
          {text.details.updated}: {formatUtcDate(operation.updated_at, locale)}
        </span>
      </footer>
    </article>
  );
}
