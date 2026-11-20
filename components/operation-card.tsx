import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formatUtcDate, getNumberLocale } from "@/lib/format";
import type { OperationDetail } from "@/lib/operation-service";

export function formatOperationQuantity(
  value: number | string,
  locale: Locale,
) {
  return new Intl.NumberFormat(getNumberLocale(locale), {
    maximumFractionDigits: 3,
  }).format(Number(value));
}
export function OperationCard({
  locale,
  operation,
}: {
  locale: Locale;
  operation: OperationDetail;
}) {
  const text = getDictionary(locale).operations;
  return (
    <Link
      className="operation-card"
      href={`/${locale}/app/operations/${operation.id}`}
    >
      <div className="operation-card-heading">
        <h2>{text.types[operation.operation_type]}</h2>
        <time dateTime={operation.performed_on}>
          {formatUtcDate(operation.performed_on, locale)}
        </time>
      </div>
      <strong dir="auto">{operation.plot_name}</strong>
      {operation.crop_name ? (
        <span dir="auto">{operation.crop_name}</span>
      ) : null}
      {operation.description ? <p dir="auto">{operation.description}</p> : null}
      {operation.quantity !== null && operation.unit ? (
        <small>
          {formatOperationQuantity(operation.quantity, locale)}{" "}
          {text.units[operation.unit]}
        </small>
      ) : null}
    </Link>
  );
}
