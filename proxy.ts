import { NextResponse, type NextRequest } from "next/server";

import { defaultLocale, isLocale } from "@/i18n/config";
import { updateSession } from "@/utils/supabase/proxy";

export async function proxy(request: NextRequest) {
  const segments = request.nextUrl.pathname.split("/");
  const requestedLocale = segments[1];

  if (!isLocale(requestedLocale)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = `/${defaultLocale}${request.nextUrl.pathname}`;
    return NextResponse.redirect(redirectUrl);
  }

  const { response, user } = await updateSession(request);
  const localeRoot = `/${requestedLocale}`;
  const isProtectedRoute =
    request.nextUrl.pathname === `${localeRoot}/app` ||
    request.nextUrl.pathname.startsWith(`${localeRoot}/app/`) ||
    request.nextUrl.pathname === `${localeRoot}/onboarding` ||
    request.nextUrl.pathname.startsWith(`${localeRoot}/onboarding/`);
  const isAuthRoute =
    request.nextUrl.pathname === `${localeRoot}/login` ||
    request.nextUrl.pathname === `${localeRoot}/signup`;

  if ((isProtectedRoute && !user) || (isAuthRoute && user)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = isProtectedRoute ? `${localeRoot}/login` : `${localeRoot}/app`;
    redirectUrl.search = "";
    const redirectResponse = NextResponse.redirect(redirectUrl);

    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });

    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
