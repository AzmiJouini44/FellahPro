"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { defaultLocale, isLocale, type Locale } from "@/i18n/config";
import { createClient } from "@/utils/supabase/server";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getLocale(formData: FormData): Locale {
  const locale = getString(formData, "locale");
  return isLocale(locale) ? locale : defaultLocale;
}

function isEmail(value: string) {
  return /^\S+@\S+\.\S+$/.test(value);
}

export async function login(formData: FormData) {
  const locale = getLocale(formData);
  const email = getString(formData, "email");
  const password = getString(formData, "password");

  if (!isEmail(email) || password.length < 8) {
    redirect(`/${locale}/login?error=invalid_form`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/${locale}/login?error=invalid_credentials`);
  }

  redirect(`/${locale}/app`);
}

export async function signup(formData: FormData) {
  const locale = getLocale(formData);
  const fullName = getString(formData, "fullName");
  const email = getString(formData, "email");
  const password = getString(formData, "password");

  if (fullName.length < 2 || !isEmail(email) || password.length < 8) {
    redirect(`/${locale}/signup?error=invalid_form`);
  }

  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, locale },
      ...(origin ? { emailRedirectTo: `${origin}/${locale}/auth/confirm` } : {}),
    },
  });

  if (error) {
    redirect(`/${locale}/signup?error=signup_failed`);
  }

  if (data.session) {
    redirect(`/${locale}/app`);
  }

  redirect(`/${locale}/login?success=check_email`);
}

export async function logout(formData: FormData) {
  const locale = getLocale(formData);
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${locale}/login`);
}
