import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getDirection, isLocale, locales } from "@/i18n/config";

import "../globals.css";

export const metadata: Metadata = {
  title: {
    default: "FellahPro",
    template: "%s · FellahPro",
  },
  description: "Gestion agricole simple pour les agriculteurs tunisiens.",
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return (
    <html lang={locale} dir={getDirection(locale)}>
      <body>{children}</body>
    </html>
  );
}
