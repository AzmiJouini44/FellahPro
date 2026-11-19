import { notFound, redirect } from "next/navigation";

import { createPlot } from "@/app/[locale]/(protected)/app/plots/actions";
import { PlotForm } from "@/components/plot-form";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { canEditPlots } from "@/lib/plot-validation";
import { getCurrentWorkspace } from "@/lib/workspace";

export const instant = false;

export default async function NewPlotPage({
  params,
}: PageProps<"/[locale]/app/plots/new">) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const workspace = await getCurrentWorkspace(locale);

  if (!workspace.farm) {
    redirect(`/${locale}/onboarding`);
  }

  if (!canEditPlots(workspace.role)) {
    redirect(`/${locale}/app/plots?error=forbidden`);
  }

  const dictionary = getDictionary(locale).plots.newPlot;

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
          action={createPlot}
          cancelHref={`/${locale}/app/plots`}
          locale={locale}
          mode="create"
        />
      </div>
    </div>
  );
}
