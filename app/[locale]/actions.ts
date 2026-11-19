"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { defaultLocale, isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireAuthenticatedContext } from "@/lib/auth";
import {
  cleanText,
  isValidEmail,
  isValidFarmName,
  isValidPassword,
  isValidPersonName,
} from "@/lib/validation";
import { createClient } from "@/utils/supabase/server";

export type OnboardingActionState = {
  message: string | null;
};

function getLocale(formData: FormData): Locale {
  const locale = cleanText(formData.get("locale"));
  return isLocale(locale) ? locale : defaultLocale;
}

export async function login(formData: FormData) {
  const locale = getLocale(formData);
  const email = cleanText(formData.get("email")).toLowerCase();
  const passwordValue = formData.get("password");
  const password = typeof passwordValue === "string" ? passwordValue : "";

  if (!isValidEmail(email) || !isValidPassword(password)) {
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
  const fullName = cleanText(formData.get("fullName"));
  const email = cleanText(formData.get("email")).toLowerCase();
  const passwordValue = formData.get("password");
  const password = typeof passwordValue === "string" ? passwordValue : "";

  if (
    !isValidPersonName(fullName) ||
    !isValidEmail(email) ||
    !isValidPassword(password)
  ) {
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
    redirect(`/${locale}/onboarding`);
  }

  redirect(`/${locale}/login?success=check_email`);
}

export async function logout(formData: FormData) {
  const locale = getLocale(formData);
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${locale}/login`);
}

export async function createFirstFarm(
  _previousState: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const locale = getLocale(formData);
  const dictionary = getDictionary(locale);
  const fullName = cleanText(formData.get("fullName"));
  const farmName = cleanText(formData.get("farmName"));

  if (!isValidPersonName(fullName) || !isValidFarmName(farmName)) {
    return { message: dictionary.onboarding.messages.invalidForm };
  }

  const { supabase, user } = await requireAuthenticatedContext(locale);
  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      full_name: fullName,
      locale,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    return { message: dictionary.onboarding.messages.profileFailed };
  }

  const { error: farmError } = await supabase.rpc("create_first_farm", {
    p_name: farmName,
  });

  if (farmError) {
    return { message: dictionary.onboarding.messages.farmFailed };
  }

  revalidatePath(`/${locale}/app`);
  revalidatePath(`/${locale}/onboarding`);
  redirect(`/${locale}/app`);
}
