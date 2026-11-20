import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OperationBreadcrumbs } from "@/components/operation-breadcrumbs";
import { OperationCard } from "@/components/operation-card";
import { OperationFilters } from "@/components/operation-filters";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formatCount } from "@/lib/format";
import { getOperationContext } from "@/lib/operations";
import {
  OPERATION_PAGE_SIZE,
  canEditOperations,
  operationListQuery,
} from "@/lib/operation-validation";

export const instant = false;
export default async function OperationsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/app/operations">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { workspace, service } = await getOperationContext(locale);
  if (!workspace.farm) redirect(`/${locale}/onboarding`);
  const query = await searchParams;
  const [result, locations] = await Promise.all([
    service.list({
      search: query.search,
      type: query.type,
      from: query.from,
      to: query.to,
      plotId: query.plotId,
      cycleId: query.cycleId,
      taskId: query.taskId,
      page: query.page,
    }),
    service.locations(),
  ]);
  const text = getDictionary(locale).operations;
  const editable = canEditOperations(workspace.role);
  const filters = result.ok ? result.data.filters : null;
  const base = `/${locale}/app/operations`;
  const hasFilters =
    filters &&
    Boolean(
      filters.search ||
        filters.type ||
        filters.from ||
        filters.to ||
        filters.plotId ||
        filters.cycleId ||
        filters.taskId ||
        filters.page > 1,
    );
  const success =
    typeof query.success === "string" &&
    Object.hasOwn(text.success, query.success)
      ? text.success[query.success as keyof typeof text.success]
      : null;
  return (
    <div className="operations-page">
      <OperationBreadcrumbs locale={locale} />
      <section className="module-heading">
        <div>
          <p className="eyebrow">{text.eyebrow}</p>
          <h1>{text.title}</h1>
          <p>{text.description}</p>
        </div>
        {editable ? (
          <Link className="button button-primary" href={`${base}/new`}>
            ＋ {text.add}
          </Link>
        ) : null}
      </section>
      {success ? (
        <p className="form-message success" role="status">
          {success}
        </p>
      ) : null}
      {query.error === "forbidden" ? (
        <p className="form-message error" role="alert">
          {text.errors.forbidden}
        </p>
      ) : null}
      {!editable ? <p className="read-only-notice">{text.readOnly}</p> : null}
      {locations.ok ? (
        <OperationFilters
          key={JSON.stringify(filters)}
          locale={locale}
          locations={locations.data}
          filters={filters}
        />
      ) : (
        <p className="form-message error" role="alert">
          {text.errors.load}
        </p>
      )}
      {!result.ok ? (
        <section className="plot-state-card is-error" role="alert">
          <h2>
            {result.reason === "invalidFilters"
              ? text.errors.invalidFilters
              : text.errors.load}
          </h2>
        </section>
      ) : !result.data.rows.length ? (
        <section className="plot-state-card">
          <h2>{hasFilters ? text.noResults : text.empty}</h2>
          <p>{text.emptyHint}</p>
          {editable && !hasFilters ? (
            <Link className="button button-primary" href={`${base}/new`}>
              {text.add}
            </Link>
          ) : null}
        </section>
      ) : (
        <section aria-label={text.title}>
          <p className="plot-count">
            <strong>{formatCount(result.data.count, locale)}</strong>{" "}
            {text.count}
          </p>
          <div className="operation-grid">
            {result.data.rows.map((operation) => (
              <OperationCard
                key={operation.id}
                locale={locale}
                operation={operation}
              />
            ))}
          </div>
        </section>
      )}
      {result.ok &&
      (result.data.filters.page > 1 ||
        result.data.count > OPERATION_PAGE_SIZE) ? (
        <nav className="activity-pagination" aria-label={text.filters.page}>
          {result.data.filters.page > 1 ? (
            <Link
              className="button button-secondary"
              href={
                base +
                operationListQuery(result.data.filters, {
                  page: result.data.filters.page - 1,
                })
              }
            >
              {text.filters.previous}
            </Link>
          ) : null}
          <span>
            {text.filters.page} {formatCount(result.data.filters.page, locale)}
          </span>
          {result.data.filters.page * OPERATION_PAGE_SIZE <
          result.data.count ? (
            <Link
              className="button button-secondary"
              href={
                base +
                operationListQuery(result.data.filters, {
                  page: result.data.filters.page + 1,
                })
              }
            >
              {text.filters.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
