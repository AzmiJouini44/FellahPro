import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CropCycleMissing } from "@/components/crop-cycle-missing";
import { CropCycleStatusBadge } from "@/components/crop-cycle-status";
import { DeleteCropCycleControl } from "@/components/delete-crop-cycle-control";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { canDeleteCropCycles, canEditCropCycles } from "@/lib/crop-cycle-validation";
import { getCurrentFarmCropCycle } from "@/lib/crop-cycles";
import { formatAreaHectares, formatDate } from "@/lib/format";

export const instant = false;

export default async function CropCycleDetailsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/app/crop-cycles/[cycleId]">) {
  const { locale, cycleId } = await params;
  const query = await searchParams;
  if (!isLocale(locale)) notFound();

  const { workspace, cycle, error } = await getCurrentFarmCropCycle(locale, cycleId);
  if (!workspace.farm) redirect(`/${locale}/onboarding`);
  const dictionary = getDictionary(locale).cropCycles;
  if (error) return <section className="plot-state-card is-error"><h1>{dictionary.errors.loadFailed}</h1></section>;
  if (!cycle) return <CropCycleMissing locale={locale} />;

  const success = typeof query.success === "string" ? query.success : null;
  const successMessage = success && success in dictionary.success
    ? dictionary.success[success as keyof typeof dictionary.success]
    : null;

  return (
    <article className="cycle-details-page">
      <Link className="back-link" href={`/${locale}/app/crop-cycles`}><span aria-hidden="true">←</span> {dictionary.details.back}</Link>
      {successMessage ? <p className="form-message success" role="status">{successMessage}</p> : null}
      <header className="cycle-details-header">
        <div>
          <p className="eyebrow">{dictionary.details.eyebrow}</p>
          <h1>{cycle.crop_name}</h1>
          <p className="cycle-detail-plot">{cycle.plot?.name ?? dictionary.unknownPlot}</p>
        </div>
        <div className="cycle-details-actions">
          <CropCycleStatusBadge locale={locale} status={cycle.status} />
          {canEditCropCycles(workspace.role) ? <Link className="button button-secondary" href={`/${locale}/app/crop-cycles/${cycle.id}/edit`}>{dictionary.details.edit}</Link> : null}
          {canDeleteCropCycles(workspace.role) ? <DeleteCropCycleControl cropName={cycle.crop_name} cycleId={cycle.id} locale={locale} /> : null}
        </div>
      </header>

      <section className="cycle-detail-grid">
        <article><span>{dictionary.fields.planted}</span><strong>{formatDate(cycle.started_on, locale)}</strong></article>
        <article><span>{dictionary.fields.expected}</span><strong>{formatDate(cycle.expected_harvest_on, locale)}</strong></article>
        <article><span>{dictionary.fields.actual}</span><strong>{cycle.actual_harvest_on ? formatDate(cycle.actual_harvest_on, locale) : dictionary.notAvailable}</strong></article>
        <article><span>{dictionary.fields.area}</span><strong>{formatAreaHectares(cycle.cultivated_area_hectares, locale)} {dictionary.form.hectares}</strong></article>
      </section>

      <section className="plot-notes-panel cycle-notes-panel">
        <h2>{dictionary.details.notes}</h2>
        <p>{cycle.notes?.trim() || dictionary.details.noNotes}</p>
      </section>
      <footer className="record-meta">
        <span>{dictionary.details.createdAt}: {formatDate(cycle.created_at, locale)}</span>
        <span>{dictionary.details.updatedAt}: {formatDate(cycle.updated_at, locale)}</span>
      </footer>
    </article>
  );
}
