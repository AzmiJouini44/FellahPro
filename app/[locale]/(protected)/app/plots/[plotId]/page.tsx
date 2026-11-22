import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DeletePlotControl } from "@/components/delete-plot-control";
import { RecordActivity } from "@/components/record-activity";
import { OperationHistory } from "@/components/operation-history";
import { PlotMissing } from "@/components/plot-missing";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formatAreaHectares, formatDate } from "@/lib/format";
import { canDeletePlots, canEditPlots } from "@/lib/plot-validation";
import { getCurrentFarmPlot } from "@/lib/plots";

export const instant = false;

export default async function PlotDetailsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/app/plots/[plotId]">) {
  const { locale, plotId } = await params;
  const query = await searchParams;

  if (!isLocale(locale)) {
    notFound();
  }

  const { workspace, plot, activities, error } = await getCurrentFarmPlot(locale, plotId);

  if (!workspace.farm) {
    redirect(`/${locale}/onboarding`);
  }

  const dictionary = getDictionary(locale).plots;

  if (error) {
    return (
      <section className="plot-state-card is-error">
        <span className="plot-state-icon" aria-hidden="true">!</span>
        <h1>{dictionary.errors.loadFailed}</h1>
        <Link className="button button-secondary" href={`/${locale}/app/plots`}>
          {dictionary.details.back}
        </Link>
      </section>
    );
  }

  if (!plot) {
    return <PlotMissing locale={locale} />;
  }

  const successKey = typeof query.success === "string" ? query.success : null;
  const successMessage =
    successKey && successKey in dictionary.success
      ? dictionary.success[successKey as keyof typeof dictionary.success]
      : null;
  const canEdit = canEditPlots(workspace.role);
  const canDelete = canDeletePlots(workspace.role);

  return (
    <article className="plot-details-page">
      <Link className="back-link" href={`/${locale}/app/plots`}>
        <span aria-hidden="true">←</span> {dictionary.details.back}
      </Link>
      {successMessage ? (
        <p className="form-message success" role="status">
          {successMessage}
        </p>
      ) : null}
      <header className="plot-details-header">
        <div>
          <p className="eyebrow">{dictionary.details.eyebrow}</p>
          <h1>{plot.name}</h1>
        </div>
        <div className="plot-details-actions">
          {canEdit ? (
            <Link
              className="button button-secondary"
              href={`/${locale}/app/plots/${plot.id}/edit`}
            >
              {dictionary.details.edit}
            </Link>
          ) : null}
          {canDelete ? (
            <DeletePlotControl locale={locale} plotId={plot.id} plotName={plot.name} />
          ) : null}
        </div>
      </header>

      <section className="plot-detail-grid">
        <div className="plot-area-panel">
          <span>{dictionary.details.area}</span>
          <strong dir="ltr">{formatAreaHectares(plot.area_hectares, locale)}</strong>
          <small>{dictionary.form.hectares}</small>
        </div>
        <div className="plot-notes-panel">
          <h2>{dictionary.details.notes}</h2>
          <p>{plot.notes?.trim() || dictionary.details.noNotes}</p>
        </div>
      </section>

      <RecordActivity locale={locale} activityId={plot.activity_id} activities={activities} />
      <OperationHistory locale={locale} plotId={plot.id} />

      <footer className="record-meta">
        <span>{dictionary.details.createdAt}: {formatDate(plot.created_at, locale)}</span>
        <span>{dictionary.details.updatedAt}: {formatDate(plot.updated_at, locale)}</span>
      </footer>
    </article>
  );
}
