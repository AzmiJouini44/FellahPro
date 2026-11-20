import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createCropCycle } from "@/app/[locale]/(protected)/app/crop-cycles/actions";
import { CropCycleForm } from "@/components/crop-cycle-form";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { canEditCropCycles } from "@/lib/crop-cycle-validation";
import { listCurrentFarmCropCyclePlots } from "@/lib/crop-cycles";

export const instant = false;

export default async function NewCropCyclePage({ params }: PageProps<"/[locale]/app/crop-cycles/new">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const { workspace, plots, error } = await listCurrentFarmCropCyclePlots(locale);
  if (!workspace.farm) redirect(`/${locale}/onboarding`);
  if (!canEditCropCycles(workspace.role)) redirect(`/${locale}/app/crop-cycles`);
  const dictionary = getDictionary(locale).cropCycles;

  if (error) {
    return <section className="plot-state-card is-error"><h1>{dictionary.errors.loadFailed}</h1></section>;
  }

  if (plots.length === 0) {
    return (
      <section className="plot-state-card">
        <span className="plot-state-icon" aria-hidden="true">◇</span>
        <h1>{dictionary.noPlots.title}</h1>
        <p>{dictionary.noPlots.description}</p>
        <Link className="button button-primary" href={`/${locale}/app/plots/new`}>
          {dictionary.noPlots.action}
        </Link>
      </section>
    );
  }

  return (
    <div className="cycle-editor-page">
      <section className="module-heading compact">
        <div><p className="eyebrow">{dictionary.newCycle.eyebrow}</p><h1>{dictionary.newCycle.title}</h1><p>{dictionary.newCycle.description}</p></div>
      </section>
      <div className="plot-form-card cycle-form-card">
        <CropCycleForm action={createCropCycle} cancelHref={`/${locale}/app/crop-cycles`} locale={locale} mode="create" plots={plots} />
      </div>
    </div>
  );
}
