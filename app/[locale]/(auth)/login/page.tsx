import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { login } from "@/app/[locale]/actions";
import { SubmitButton } from "@/components/submit-button";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export const metadata: Metadata = { title: "Connexion" };
export const instant = false;

export default async function LoginPage({
  params,
  searchParams,
}: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  const query = await searchParams;

  if (!isLocale(locale)) {
    notFound();
  }

  const dictionary = getDictionary(locale);
  const messageKey = query.error ?? query.success;
  const messages = {
    invalid_form: dictionary.auth.messages.invalidForm,
    invalid_credentials: dictionary.auth.messages.invalidCredentials,
    check_email: dictionary.auth.messages.checkEmail,
    confirmed: dictionary.auth.messages.confirmed,
    confirmation_failed: dictionary.auth.messages.confirmationFailed,
  } as const;
  const message =
    typeof messageKey === "string" && messageKey in messages
      ? messages[messageKey as keyof typeof messages]
      : null;
  const isSuccess = query.success !== undefined;

  return (
    <section className="auth-card">
      <div className="auth-heading">
        <p className="eyebrow">FellahPro</p>
        <h1>{dictionary.auth.loginTitle}</h1>
        <p>{dictionary.auth.loginDescription}</p>
      </div>
      {message ? (
        <p className={isSuccess ? "form-message success" : "form-message error"} role="status">
          {message}
        </p>
      ) : null}
      <form action={login} className="auth-form">
        <input name="locale" type="hidden" value={locale} />
        <label htmlFor="email">{dictionary.auth.email}</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
        <label htmlFor="password">{dictionary.auth.password}</label>
        <input
          id="password"
          name="password"
          type="password"
          minLength={8}
          autoComplete="current-password"
          required
        />
        <SubmitButton pendingLabel={dictionary.auth.loginPending}>
          {dictionary.auth.loginAction}
        </SubmitButton>
      </form>
      <p className="auth-footer">
        {dictionary.auth.noAccount}{" "}
        <Link href={`/${locale}/signup`}>{dictionary.nav.signup}</Link>
      </p>
    </section>
  );
}
