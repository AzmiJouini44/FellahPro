import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formatCount, formatUtcDate } from "@/lib/format";
import { getOperationContext } from "@/lib/operations";
import {
  canEditOperations,
  operationListQuery,
} from "@/lib/operation-validation";

export async function OperationHistory({
  locale,
  plotId,
  cycleId,
  taskId,
}: {
  locale: Locale;
  plotId?: string;
  cycleId?: string;
  taskId?: string;
}) {
  const { workspace, service } = await getOperationContext(locale);
  const result = await service.list({ plotId, cycleId, taskId });
  const text = getDictionary(locale).operations;
  const contextQuery = operationListQuery({ plotId, cycleId, taskId });
  return (
    <section className="operation-history">
      <div className="dashboard-section-heading">
        <h2>{text.history.title}</h2>
        {canEditOperations(workspace.role) ? (
          <Link
            className="button button-secondary"
            href={`/${locale}/app/operations/new${contextQuery}`}
          >
            {text.add}
          </Link>
        ) : null}
      </div>
      {!result.ok ? (
        <p className="form-message error" role="alert">
          {text.errors.load}
        </p>
      ) : (
        <>
          {!result.data.rows.length ? (
            <p className="field-hint">{text.history.empty}</p>
          ) : (
            <ul>
              {result.data.rows.slice(0, 5).map((operation) => (
                <li key={operation.id}>
                  <Link href={`/${locale}/app/operations/${operation.id}`}>
                    {text.types[operation.operation_type]}
                  </Link>
                  <time dateTime={operation.performed_on}>
                    {formatUtcDate(operation.performed_on, locale)}
                  </time>
                  {operation.description ? (
                    <p dir="auto">{operation.description}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <p className="field-hint">
            {text.history.preview
              .replace(
                "{shown}",
                formatCount(Math.min(5, result.data.rows.length), locale),
              )
              .replace("{total}", formatCount(result.data.count, locale))}
          </p>
          <Link
            className="back-link"
            href={`/${locale}/app/operations${operationListQuery(result.data.filters)}`}
          >
            {text.history.all}
          </Link>
        </>
      )}
    </section>
  );
}
