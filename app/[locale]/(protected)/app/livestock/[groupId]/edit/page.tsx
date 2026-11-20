import { notFound, redirect } from "next/navigation";
import { updateAnimalGroup } from "@/app/[locale]/(protected)/app/livestock/actions";
import { AnimalGroupForm } from "@/components/animal-group-form";
import { LivestockBreadcrumbs, LivestockMissing } from "@/components/livestock-breadcrumbs";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getLivestockContext } from "@/lib/livestock";
import { canManageAnimalGroups } from "@/lib/livestock-validation";

export const instant = false;

export default async function EditAnimalGroupPage({ params }: PageProps<"/[locale]/app/livestock/[groupId]/edit">) {
  const { locale, groupId } = await params; if (!isLocale(locale)) notFound();
  const { workspace, service } = await getLivestockContext(locale);
  if (!workspace.farm) redirect(`/${locale}/onboarding`);
  if (!canManageAnimalGroups(workspace.role)) redirect(`/${locale}/app/livestock?error=forbidden`);
  const group = await service.get(groupId); const text = getDictionary(locale).livestock;
  if (!group.ok) return group.reason === "notFound" ? <LivestockMissing locale={locale} /> : <p className="form-message error" role="alert">{text.errors.load}</p>;
  const options = await service.options();
  return <div className="livestock-page"><LivestockBreadcrumbs locale={locale} group={group.data} current={text.editTitle} />
    <header className="module-heading compact"><div><p className="eyebrow">{text.title}</p><h1>{text.editTitle}</h1></div></header>
    {!options.ok ? <p className="form-message error" role="alert">{text.errors.load}</p> : <div className="plot-form-card">
      <AnimalGroupForm locale={locale} action={updateAnimalGroup.bind(null, groupId)} initialValues={group.data} options={options.data} cancelHref={`/${locale}/app/livestock/${groupId}`} /></div>}
  </div>;
}
