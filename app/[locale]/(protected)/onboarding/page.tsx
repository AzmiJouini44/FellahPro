import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { OnboardingForm } from "@/components/onboarding-form";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getCurrentWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Configuration" };
export const instant = false;

export default async function OnboardingPage({
  params,
}: PageProps<"/[locale]/onboarding">) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const workspace = await getCurrentWorkspace(locale);

  if (workspace.farm) {
    redirect(`/${locale}/app`);
  }

  const dictionary = getDictionary(locale);
  const alternateLocale = locale === "fr" ? "ar" : "fr";

  return (
    <main className="onboarding-shell">
      <header className="onboarding-header shell">
        <Link className="brand" href={`/${locale}`} aria-label="FellahPro">
          <span className="brand-mark" aria-hidden="true">
            F
          </span>
          <span>FellahPro</span>
        </Link>
        <Link
          className="language-link"
          href={`/${alternateLocale}/onboarding`}
          aria-label={dictionary.nav.languageLabel}
        >
          {dictionary.nav.language}
        </Link>
      </header>
      <section className="onboarding-grid shell">
        <div className="onboarding-intro">
          <p className="eyebrow">{dictionary.onboarding.eyebrow}</p>
          <h1>{dictionary.onboarding.title}</h1>
          <p className="onboarding-description">{dictionary.onboarding.description}</p>
          <ol className="onboarding-steps">
            <li className="is-complete">
              <span aria-hidden="true">✓</span>
              {dictionary.onboarding.stepAccount}
            </li>
            <li className="is-current">
              <span aria-hidden="true">2</span>
              {dictionary.onboarding.stepFarm}
            </li>
          </ol>
        </div>
        <div className="onboarding-card">
          <OnboardingForm
            locale={locale}
            defaultFullName={workspace.profile?.full_name ?? ""}
          />
          <p className="security-note">
            <span aria-hidden="true">◉</span>
            {dictionary.onboarding.securityNote}
          </p>
        </div>
      </section>
    </main>
  );
}
