import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formatAreaHectares } from "@/lib/format";
import { canEditPlots } from "@/lib/plot-validation";
import { listCurrentFarmPlots } from "@/lib/plots";

export const instant = false;

export default async function PlotsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/app/plots">) {
  const { locale } = await params;
  const query = await searchParams;

  if (!isLocale(locale)) {
    notFound();
  }

  const { workspace, plots, error } = await listCurrentFarmPlots(locale);

  if (!workspace.farm) {
    redirect(`/${locale}/onboarding`);
  }

  const dictionary = getDictionary(locale).plots;
  const successKey = typeof query.success === "string" ? query.success : null;
  const errorKey = typeof query.error === "string" ? query.error : null;
  const successMessage =
    successKey && successKey in dictionary.success
      ? dictionary.success[successKey as keyof typeof dictionary.success]
      : null;
  const queryError =
    errorKey === "forbidden"
      ? dictionary.errors.forbiddenEdit
      : errorKey === "load"
        ? dictionary.errors.loadFailed
        : null;
  const canEdit = canEditPlots(workspace.role);

  return (
    <div className="plots-page">
      <section className="module-heading">
        <div>
          <p className="eyebrow">{dictionary.eyebrow}</p>
          <h1>{dictionary.title}</h1>
          <p>{dictionary.description}</p>
        </div>
        {canEdit ? (
          <Link className="button button-primary" href={`/${locale}/app/plots/new`}>
            <span aria-hidden="true">＋</span>
            {dictionary.add}
          </Link>
        ) : null}
      </section>

      {successMessage ? (
        <p className="form-message success" role="status">
          {successMessage}
        </p>
      ) : null}
      {queryError ? (
        <p className="form-message error" role="alert">
          {queryError}
        </p>
      ) : null}
      {!canEdit ? <p className="read-only-notice">{dictionary.readOnly}</p> : null}

      {error ? (
        <section className="plot-state-card is-error">
          <span className="plot-state-icon" aria-hidden="true">!</span>
          <h2>{dictionary.errors.loadFailed}</h2>
          <Link className="button button-secondary" href={`/${locale}/app/plots`}>
            {dictionary.details.back}
          </Link>
        </section>
      ) : plots.length === 0 ? (
        <section className="plot-state-card">
          <span className="plot-state-icon" aria-hidden="true">◇</span>
          <h2>{dictionary.emptyTitle}</h2>
          <p>{dictionary.emptyDescription}</p>
          {canEdit ? (
            <Link className="button button-primary" href={`/${locale}/app/plots/new`}>
              {dictionary.add}
            </Link>
          ) : null}
        </section>
      ) : (
        <section aria-label={dictionary.title}>
          <p className="plot-count">
            <strong>{plots.length}</strong> {dictionary.count}
          </p>
          <div className="plot-grid">
            {plots.map((plot) => (
              <Link
                className="plot-card"
                href={`/${locale}/app/plots/${plot.id}`}
                key={plot.id}
              >
                <span className="plot-card-icon" aria-hidden="true">◇</span>
                <div>
                  <h2>{plot.name}</h2>
                  <p>
                    {dictionary.areaLabel}: {formatAreaHectares(plot.area_hectares, locale)} {dictionary.form.hectares}
                  </p>
                </div>
                <span className="plot-card-arrow" aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
