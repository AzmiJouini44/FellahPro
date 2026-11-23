"use server";

import { cookies } from "next/headers";

import { isLocale } from "@/i18n/config";
import { getLocaleCookieOptions, localeCookieName } from "@/i18n/preference";

export async function setLocalePreference(value: unknown): Promise<boolean> {
  if (typeof value !== "string" || !isLocale(value)) return false;
  const cookieStore = await cookies();
  cookieStore.set(
    localeCookieName,
    value,
    getLocaleCookieOptions(process.env.NODE_ENV === "production"),
  );
  return true;
}
