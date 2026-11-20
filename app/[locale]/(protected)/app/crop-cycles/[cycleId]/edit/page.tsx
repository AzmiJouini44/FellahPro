import { notFound, redirect } from "next/navigation";

import { updateCropCycle } from "@/app/[locale]/(protected)/app/crop-cycles/actions";
import { CropCycleForm } from "@/components/crop-cycle-form";
import { CropCycleMissing } from "@/components/crop-cycle-missing";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { canEditCropCycles } from "@/lib/crop-cycle-validation";
import { getCurrentFarmCropCycle } from "@/lib/crop-cycles";

export const instant = false;

export default async function EditCropCyclePage({ params }: PageProps<"/[locale]/app/crop-cycles/[cycleId]/edit">) {
  const { locale, cycleId } = await params;
  if (!isLocale(locale)) notFound();

  const { workspace, cycle, plots, activities, error } = await getCurrentFarmCropCycle(locale, cycleId);
  if (!workspace.farm) redirect(`/${locale}/onboarding`);
  if (!canEditCropCycles(workspace.role)) redirect(`/${locale}/app/crop-cycles`);
  if (error) redirect(`/${locale}/app/crop-cycles`);
  if (!cycle) return <CropCycleMissing locale={locale} />;

  const dictionary = getDictionary(locale).cropCycles.editCycle;
  return (
    <div className="cycle-editor-page">
      <section className="module-heading compact">
        <div><p className="eyebrow">{dictionary.eyebrow}</p><h1>{dictionary.title}</h1><p>{dictionary.description}</p></div>
      </section>
      <div className="plot-form-card cycle-form-card">
        <CropCycleForm
          action={updateCropCycle.bind(null, cycle.id)}
          cancelHref={`/${locale}/app/crop-cycles/${cycle.id}`}
          initialValues={{
            plotId: cycle.plot_id,
            cropName: cycle.crop_name,
            plantedOn: cycle.started_on,
            expectedHarvestOn: cycle.expected_harvest_on,
            actualHarvestOn: cycle.actual_harvest_on ?? "",
            cultivatedAreaHectares: cycle.cultivated_area_hectares,
            status: cycle.status,
            notes: cycle.notes ?? "",
            activityId: cycle.activity_id,
          }}
          locale={locale}
          mode="edit"
          plots={plots}
          activities={activities}
        />
      </div>
    </div>
  );
}
