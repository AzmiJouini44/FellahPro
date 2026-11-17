import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { signup } from "@/app/[locale]/actions";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export const metadata: Metadata = { title: "Créer un compte" };
export const instant = false;

export default async function SignupPage({
  params,
  searchParams,
}: PageProps<"/[locale]/signup">) {
  const { locale } = await params;
  const query = await searchParams;

  if (!isLocale(locale)) {
    notFound();
  }

  const dictionary = getDictionary(locale);
  const error = query.error;
  const message =
    error === "invalid_form"
      ? dictionary.auth.messages.invalidForm
      : error === "signup_failed"
        ? dictionary.auth.messages.signupFailed
        : null;

  return (
    <section className="auth-card">
      <div className="auth-heading">
        <p className="eyebrow">FellahPro</p>
        <h1>{dictionary.auth.signupTitle}</h1>
        <p>{dictionary.auth.signupDescription}</p>
      </div>
      {message ? (
        <p className="form-message error" role="alert">
          {message}
        </p>
      ) : null}
      <form action={signup} className="auth-form">
        <input name="locale" type="hidden" value={locale} />
        <label htmlFor="fullName">{dictionary.auth.fullName}</label>
        <input id="fullName" name="fullName" type="text" autoComplete="name" minLength={2} required />
        <label htmlFor="email">{dictionary.auth.email}</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
        <label htmlFor="password">{dictionary.auth.password}</label>
        <input
          id="password"
          name="password"
          type="password"
          minLength={8}
          autoComplete="new-password"
          aria-describedby="password-hint"
          required
        />
        <span className="field-hint" id="password-hint">
          {dictionary.auth.passwordHint}
        </span>
        <button className="button button-primary button-full" type="submit">
          {dictionary.auth.signupAction}
        </button>
      </form>
      <p className="auth-footer">
        {dictionary.auth.hasAccount}{" "}
        <Link href={`/${locale}/login`}>{dictionary.nav.login}</Link>
      </p>
    </section>
  );
}
