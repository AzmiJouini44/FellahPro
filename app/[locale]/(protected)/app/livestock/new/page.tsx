import { notFound, redirect } from "next/navigation";
import { createAnimalGroup } from "@/app/[locale]/(protected)/app/livestock/actions";
import { AnimalGroupForm } from "@/components/animal-group-form";
import { LivestockBreadcrumbs } from "@/components/livestock-breadcrumbs";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getLivestockContext } from "@/lib/livestock";
import { canManageAnimalGroups } from "@/lib/livestock-validation";

export const instant = false;

export default async function NewAnimalGroupPage({ params }: PageProps<"/[locale]/app/livestock/new">) {
  const { locale } = await params; if (!isLocale(locale)) notFound();
  const { workspace, service } = await getLivestockContext(locale);
  if (!workspace.farm) redirect(`/${locale}/onboarding`);
  if (!canManageAnimalGroups(workspace.role)) redirect(`/${locale}/app/livestock?error=forbidden`);
  const text = getDictionary(locale).livestock; const options = await service.options();
  return <div className="livestock-page"><LivestockBreadcrumbs locale={locale} current={text.newTitle} />
    <header className="module-heading compact"><div><p className="eyebrow">{text.title}</p><h1>{text.newTitle}</h1></div></header>
    {!options.ok ? <p className="form-message error" role="alert">{text.errors.load}</p> : <div className="plot-form-card">
      <AnimalGroupForm locale={locale} action={createAnimalGroup} options={options.data} cancelHref={`/${locale}/app/livestock`} /></div>}
  </div>;
}
