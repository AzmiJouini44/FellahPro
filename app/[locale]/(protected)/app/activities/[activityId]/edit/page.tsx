import { notFound, redirect } from "next/navigation";
import { updateActivity } from "@/app/[locale]/(protected)/app/activities/actions";
import { ActivityForm } from "@/components/activity-form";
import { ActivityBreadcrumbs } from "@/components/activity-breadcrumbs";
import { ActivityMissing } from "@/components/activity-missing";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getActivityContext } from "@/lib/activities";
import { canManageActivities } from "@/lib/activity-validation";

export const instant = false;

export default async function EditActivityPage({ params }: PageProps<"/[locale]/app/activities/[activityId]/edit">) {
  const { locale, activityId } = await params;
  if (!isLocale(locale)) notFound();
  const { workspace, service } = await getActivityContext(locale);
  if (!workspace.farm) redirect(`/${locale}/onboarding`);
  if (!canManageActivities(workspace.role)) redirect(`/${locale}/app/activities?error=forbidden`);
  const result = await service.get(activityId);
  const text = getDictionary(locale).activities;
  if (!result.ok) return result.reason === "notFound" ? <ActivityMissing locale={locale} />
    : <section className="plot-state-card is-error"><h1>{text.errors.loadFailed}</h1></section>;
  const activity = result.data;
  return <div className="activities-page">
    <ActivityBreadcrumbs locale={locale} activity={activity} current={text.editTitle} />
    <header className="module-heading compact"><div><p className="eyebrow">{text.title}</p><h1>{text.editTitle}</h1></div></header>
    <div className="plot-form-card"><ActivityForm action={updateActivity.bind(null, activity.id)} locale={locale} mode="edit"
      initialValues={{ name: activity.name, kind: activity.kind, isActive: activity.is_active }} cancelHref={`/${locale}/app/activities/${activity.id}`} /></div>
  </div>;
}
