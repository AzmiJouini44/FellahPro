import { notFound, redirect } from "next/navigation";

import { logout } from "@/app/[locale]/actions";
import { SiteHeader } from "@/components/site-header";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { createClient } from "@/utils/supabase/server";

export const instant = false;

export default async function ProtectedAppPage({
  params,
}: PageProps<"/[locale]/app">) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect(`/${locale}/login`);
  }

  const dictionary = getDictionary(locale);
  const email = typeof data.claims.email === "string" ? data.claims.email : null;

  return (
    <div className="page-shell">
      <SiteHeader locale={locale} isAuthenticated />
      <main className="protected-main shell">
        <section className="protected-card">
          <div>
            <p className="eyebrow">{dictionary.protected.eyebrow}</p>
            <h1>{dictionary.protected.title}</h1>
            <p className="protected-description">{dictionary.protected.description}</p>
          </div>
          {email ? (
            <p className="identity">
              <span>{dictionary.protected.signedInAs}</span>
              <strong dir="ltr">{email}</strong>
            </p>
          ) : null}
          <div className="protected-footer">
            <p>{dictionary.protected.noDashboard}</p>
            <form action={logout}>
              <input name="locale" type="hidden" value={locale} />
              <button className="button button-secondary" type="submit">
                {dictionary.auth.logout}
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
