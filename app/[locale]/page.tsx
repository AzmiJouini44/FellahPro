import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { createClient } from "@/utils/supabase/server";

export const instant = false;

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const dictionary = getDictionary(locale);
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims);

  return (
    <div className="page-shell">
      <SiteHeader locale={locale} isAuthenticated={isAuthenticated} />
      <main>
        <section className="hero shell">
          <div className="hero-copy">
            <p className="eyebrow">{dictionary.home.eyebrow}</p>
            <h1>{dictionary.home.title}</h1>
            <p className="hero-description">{dictionary.home.description}</p>
            <div className="hero-actions">
              <Link className="button button-primary" href={`/${locale}/signup`}>
                {dictionary.home.primaryAction}
              </Link>
              <Link className="button button-secondary" href={`/${locale}/login`}>
                {dictionary.home.secondaryAction}
              </Link>
            </div>
          </div>
          <div className="farm-card" aria-label={dictionary.brandTagline}>
            <div className="farm-card-icon" aria-hidden="true">
              <span>☀</span>
              <span className="farm-lines">≋</span>
            </div>
            <p>{dictionary.brandTagline}</p>
          </div>
        </section>
        <section className="feature-strip" aria-label="Avantages">
          <div className="shell feature-grid">
            {[
              dictionary.home.featureOne,
              dictionary.home.featureTwo,
              dictionary.home.featureThree,
            ].map((feature, index) => (
              <div className="feature" key={feature}>
                <span aria-hidden="true">0{index + 1}</span>
                <p>{feature}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
