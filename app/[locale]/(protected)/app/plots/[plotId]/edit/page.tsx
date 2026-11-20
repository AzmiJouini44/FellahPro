import { notFound, redirect } from "next/navigation";

import { updatePlot } from "@/app/[locale]/(protected)/app/plots/actions";
import { PlotForm } from "@/components/plot-form";
import { PlotMissing } from "@/components/plot-missing";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { canEditPlots } from "@/lib/plot-validation";
import { getCurrentFarmPlot } from "@/lib/plots";

export const instant = false;

export default async function EditPlotPage({
  params,
}: PageProps<"/[locale]/app/plots/[plotId]/edit">) {
  const { locale, plotId } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const { workspace, plot, activities, error } = await getCurrentFarmPlot(locale, plotId);

  if (!workspace.farm) {
    redirect(`/${locale}/onboarding`);
  }

  if (!canEditPlots(workspace.role)) {
    redirect(`/${locale}/app/plots?error=forbidden`);
  }

  if (error) {
    redirect(`/${locale}/app/plots?error=load`);
  }

  if (!plot) {
    return <PlotMissing locale={locale} />;
  }

  const dictionary = getDictionary(locale).plots.editPlot;
  const updateAction = updatePlot.bind(null, plot.id);

  return (
    <div className="plot-editor-page">
      <section className="module-heading compact">
        <div>
          <p className="eyebrow">{dictionary.eyebrow}</p>
          <h1>{dictionary.title}</h1>
          <p>{dictionary.description}</p>
        </div>
      </section>
      <div className="plot-form-card">
        <PlotForm
          action={updateAction}
          cancelHref={`/${locale}/app/plots/${plot.id}`}
          initialValues={{
            name: plot.name,
            areaHectares: plot.area_hectares,
            notes: plot.notes ?? "",
            activityId: plot.activity_id,
          }}
          locale={locale}
          mode="edit"
          activities={activities}
        />
      </div>
    </div>
  );
}
