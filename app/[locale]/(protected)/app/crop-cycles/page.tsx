import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CropCycleStatusBadge } from "@/components/crop-cycle-status";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { canEditCropCycles } from "@/lib/crop-cycle-validation";
import { listCurrentFarmCropCycles } from "@/lib/crop-cycles";
import { formatAreaHectares, formatDate } from "@/lib/format";

export const instant = false;

function readQueryValue(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

export default async function CropCyclesPage({
  params,
  searchParams,
}: PageProps<"/[locale]/app/crop-cycles">) {
  const { locale } = await params;
  const query = await searchParams;
  if (!isLocale(locale)) notFound();

  const result = await listCurrentFarmCropCycles(locale, {
    status: readQueryValue(query.status),
    plotId: readQueryValue(query.plot),
    crop: readQueryValue(query.crop),
  });
  if (!result.workspace.farm) redirect(`/${locale}/onboarding`);

  const dictionary = getDictionary(locale).cropCycles;
  const canEdit = canEditCropCycles(result.workspace.role);
  const success = readQueryValue(query.success);
  const successMessage =
    success && success in dictionary.success
      ? dictionary.success[success as keyof typeof dictionary.success]
      : null;
  const hasFilters = Boolean(
    result.filters.status || result.filters.plotId || result.filters.crop,
  );

  return (
    <div className="cycles-page">
      <section className="module-heading">
        <div>
          <p className="eyebrow">{dictionary.eyebrow}</p>
          <h1>{dictionary.title}</h1>
          <p>{dictionary.description}</p>
        </div>
        {canEdit ? (
          <Link className="button button-primary" href={`/${locale}/app/crop-cycles/new`}>
            <span aria-hidden="true">＋</span>{dictionary.add}
          </Link>
        ) : null}
      </section>

      {successMessage ? <p className="form-message success" role="status">{successMessage}</p> : null}
      {!canEdit ? <p className="read-only-notice">{dictionary.readOnly}</p> : null}

      <form className="cycle-filters" method="get">
        <div className="form-field">
          <label htmlFor="filter-status">{dictionary.filters.status}</label>
          <select defaultValue={result.filters.status ?? ""} id="filter-status" name="status">
            <option value="">{dictionary.filters.all}</option>
            <option value="planned">{dictionary.statuses.planned}</option>
            <option value="active">{dictionary.statuses.active}</option>
            <option value="completed">{dictionary.statuses.completed}</option>
            <option value="cancelled">{dictionary.statuses.cancelled}</option>
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="filter-plot">{dictionary.filters.plot}</label>
          <select defaultValue={result.filters.plotId ?? ""} id="filter-plot" name="plot">
            <option value="">{dictionary.filters.allPlots}</option>
            {result.plots.map((plot) => <option key={plot.id} value={plot.id}>{plot.name}</option>)}
          </select>
        </div>
        <div className="form-field cycle-filter-crop">
          <label htmlFor="filter-crop">{dictionary.filters.crop}</label>
          <input
            defaultValue={result.filters.crop}
            id="filter-crop"
            maxLength={80}
            name="crop"
            placeholder={dictionary.filters.cropPlaceholder}
            type="search"
          />
        </div>
        <div className="cycle-filter-actions">
          <button className="button button-primary" type="submit">{dictionary.filters.apply}</button>
          {hasFilters ? (
            <Link className="button button-secondary" href={`/${locale}/app/crop-cycles`}>
              {dictionary.filters.clear}
            </Link>
          ) : null}
        </div>
      </form>

      {result.error ? (
        <section className="plot-state-card is-error">
          <span className="plot-state-icon" aria-hidden="true">!</span>
          <h2>{dictionary.errors.loadFailed}</h2>
        </section>
      ) : result.cycles.length === 0 ? (
        <section className="plot-state-card">
          <span className="plot-state-icon" aria-hidden="true">◎</span>
          <h2>{hasFilters ? dictionary.noResultsTitle : dictionary.emptyTitle}</h2>
          <p>{hasFilters ? dictionary.noResultsDescription : dictionary.emptyDescription}</p>
          {hasFilters ? (
            <Link className="button button-secondary" href={`/${locale}/app/crop-cycles`}>
              {dictionary.filters.clear}
            </Link>
          ) : canEdit ? (
            <Link className="button button-primary" href={`/${locale}/app/crop-cycles/new`}>
              {dictionary.add}
            </Link>
          ) : null}
        </section>
      ) : (
        <section aria-label={dictionary.title}>
          <p className="plot-count"><strong>{result.cycles.length}</strong> {dictionary.count}</p>
          <div className="cycle-grid">
            {result.cycles.map((cycle) => (
              <Link className="cycle-card" href={`/${locale}/app/crop-cycles/${cycle.id}`} key={cycle.id}>
                <div className="cycle-card-heading">
                  <div>
                    <span className="cycle-plot-name">{cycle.plot?.name ?? dictionary.unknownPlot}</span>
                    <h2>{cycle.crop_name}</h2>
                  </div>
                  <CropCycleStatusBadge locale={locale} status={cycle.status} />
                </div>
                <dl className="cycle-card-facts">
                  <div><dt>{dictionary.fields.planted}</dt><dd>{formatDate(cycle.started_on, locale)}</dd></div>
                  <div><dt>{dictionary.fields.expected}</dt><dd>{formatDate(cycle.expected_harvest_on, locale)}</dd></div>
                  <div><dt>{dictionary.fields.actual}</dt><dd>{cycle.actual_harvest_on ? formatDate(cycle.actual_harvest_on, locale) : dictionary.notAvailable}</dd></div>
                  <div><dt>{dictionary.fields.area}</dt><dd>{formatAreaHectares(cycle.cultivated_area_hectares, locale)} {dictionary.form.hectares}</dd></div>
                </dl>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
