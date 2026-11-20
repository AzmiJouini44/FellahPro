import Link from "next/link";
import { ActivitySummary } from "@/components/activity-summary";
import { notFound, redirect } from "next/navigation";

import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getCropCycleSummary } from "@/lib/crop-cycles";
import { formatTnd } from "@/lib/format";
import { getCurrentWorkspace } from "@/lib/workspace";
import { getMissingWorkspaceRedirect } from "@/lib/workspace-routing";

export const instant = false;

export default async function DashboardPage({
  params,
}: PageProps<"/[locale]/app">) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const workspace = await getCurrentWorkspace(locale);

  if (!workspace.profile || !workspace.farm) {
    redirect(
      getMissingWorkspaceRedirect(
        locale,
        workspace.profile !== null,
        workspace.farm !== null,
      ) ?? `/${locale}/onboarding`,
    );
  }

  const dictionary = getDictionary(locale);
  const role =
    workspace.role && workspace.role in dictionary.roles
      ? dictionary.roles[workspace.role as keyof typeof dictionary.roles]
      : dictionary.roles.unknown;
  const displayName = workspace.profile.full_name ?? dictionary.dashboard.fallbackName;
  const cycleSummary = await getCropCycleSummary(workspace.farm.id);

  return (
    <div className="dashboard-page">
      <section className="dashboard-heading" id="overview">
        <div>
          <p className="eyebrow">{dictionary.dashboard.eyebrow}</p>
          <h1>
            {dictionary.dashboard.greeting}, {displayName}
          </h1>
          <p>{dictionary.dashboard.description}</p>
        </div>
        <span className={`farm-mode ${workspace.farm.is_demo ? "is-demo" : ""}`}>
          {workspace.farm.is_demo ? dictionary.dashboard.demo : dictionary.dashboard.live}
        </span>
      </section>

      <section className="metric-grid" aria-label={dictionary.dashboard.eyebrow}>
        <article className="metric-card metric-card-primary" id="farm">
          <span>{dictionary.dashboard.currentFarm}</span>
          <strong>{workspace.farm.name}</strong>
          <small>{dictionary.dashboard.currency}: {workspace.farm.currency}</small>
        </article>
        <article className="metric-card">
          <span>{dictionary.dashboard.role}</span>
          <strong>{role}</strong>
          <small>{dictionary.onboarding.securityNote}</small>
        </article>
        <article className="metric-card">
          <span>{dictionary.dashboard.trackedBalance}</span>
          <strong dir="ltr">{formatTnd(0, locale)}</strong>
          <small>{dictionary.dashboard.trackedBalanceHint}</small>
        </article>
      </section>

      {!cycleSummary.error ? (
        <section className="dashboard-cycle-summary">
          <div className="dashboard-section-heading">
            <div>
              <h2>{dictionary.dashboard.cropCyclesSummary}</h2>
              <p>{dictionary.dashboard.cropCyclesSummaryHint}</p>
            </div>
            <Link className="button button-secondary button-small" href={`/${locale}/app/crop-cycles`}>
              {dictionary.dashboard.viewCropCycles}
            </Link>
          </div>
          <div className="cycle-summary-grid">
            <article><span>{dictionary.dashboard.totalCycles}</span><strong>{cycleSummary.total}</strong></article>
            <article><span>{dictionary.dashboard.activeCycles}</span><strong>{cycleSummary.active}</strong></article>
            <article><span>{dictionary.dashboard.plannedCycles}</span><strong>{cycleSummary.planned}</strong></article>
            <article><span>{dictionary.dashboard.recentHarvests}</span><strong>{cycleSummary.recentHarvests}</strong></article>
          </div>
        </section>
      ) : null}

      <ActivitySummary locale={locale} />

      <section className="readiness-grid">
        <article className="readiness-card is-ready">
          <span className="readiness-icon" aria-hidden="true">✓</span>
          <div>
            <h2>{dictionary.dashboard.setupTitle}</h2>
            <p>{dictionary.dashboard.setupDescription}</p>
          </div>
        </article>
        <article className="readiness-card">
          <span className="readiness-icon" aria-hidden="true">→</span>
          <div>
            <h2>{dictionary.dashboard.nextTitle}</h2>
            <p>{dictionary.dashboard.nextDescription}</p>
          </div>
        </article>
      </section>
    </div>
  );
}
