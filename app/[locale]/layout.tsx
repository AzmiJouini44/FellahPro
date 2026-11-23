import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getDirection, isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

import "../globals.css";

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return {
    title: { default: "FellahPro", template: "%s · FellahPro" },
    description: getDictionary(locale).metadata.description,
  };
}

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
