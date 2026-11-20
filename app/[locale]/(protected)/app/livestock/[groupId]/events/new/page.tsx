import { notFound, redirect } from "next/navigation";
import { recordAnimalEvent } from "@/app/[locale]/(protected)/app/livestock/actions";
import { AnimalEventForm } from "@/components/animal-event-form";
import { LivestockBreadcrumbs, LivestockMissing } from "@/components/livestock-breadcrumbs";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getLivestockContext } from "@/lib/livestock";
import { canRecordAnimalEvents } from "@/lib/livestock-validation";
import { getTaskDates } from "@/lib/task-validation";

export const instant = false;

export default async function NewAnimalEventPage({ params }: PageProps<"/[locale]/app/livestock/[groupId]/events/new">) {
  const { locale, groupId } = await params; if (!isLocale(locale)) notFound();
  const { workspace, service } = await getLivestockContext(locale);
  if (!workspace.farm) redirect(`/${locale}/onboarding`);
  if (!canRecordAnimalEvents(workspace.role)) redirect(`/${locale}/app/livestock?error=forbidden`);
  const group = await service.get(groupId); const text = getDictionary(locale).livestock;
  if (!group.ok) return group.reason === "notFound" ? <LivestockMissing locale={locale} /> : <p className="form-message error" role="alert">{text.errors.load}</p>;
  return <div className="livestock-page"><LivestockBreadcrumbs locale={locale} group={group.data} current={text.events.add} />
    <header className="module-heading compact"><div><p className="eyebrow" dir="auto">{group.data.name}</p><h1>{text.events.add}</h1></div></header>
    <div className="plot-form-card"><AnimalEventForm locale={locale} action={recordAnimalEvent.bind(null, groupId)} today={getTaskDates().today} cancelHref={`/${locale}/app/livestock/${groupId}#events`} /></div>
  </div>;
}
