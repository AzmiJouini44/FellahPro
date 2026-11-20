import { notFound, redirect } from "next/navigation";
import { createActivity } from "@/app/[locale]/(protected)/app/activities/actions";
import { ActivityForm } from "@/components/activity-form";
import { ActivityBreadcrumbs } from "@/components/activity-breadcrumbs";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { canManageActivities } from "@/lib/activity-validation";
import { getCurrentWorkspace } from "@/lib/workspace";

export const instant = false;

export default async function NewActivityPage({ params }: PageProps<"/[locale]/app/activities/new">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const workspace = await getCurrentWorkspace(locale);
  if (!workspace.farm) redirect(`/${locale}/onboarding`);
  if (!canManageActivities(workspace.role)) redirect(`/${locale}/app/activities?error=forbidden`);
  const text = getDictionary(locale).activities;
  return <div className="activities-page">
    <ActivityBreadcrumbs locale={locale} current={text.newTitle} />
    <header className="module-heading compact"><div><p className="eyebrow">{text.title}</p><h1>{text.newTitle}</h1></div></header>
    <div className="plot-form-card"><ActivityForm action={createActivity} locale={locale} mode="create" cancelHref={`/${locale}/app/activities`} /></div>
  </div>;
}
