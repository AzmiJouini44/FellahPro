import assert from "node:assert/strict";
import test from "node:test";

import { defaultLocale, getDirection, getProfileLocale, isLocale, localeNames, locales, type Locale } from "../i18n/config";
import { getDictionary } from "../i18n/dictionaries";
import { getLocaleCookieOptions, getLocalizedHref, getPreferredLocale, localeCookieName } from "../i18n/preference";

function flatten(value: object, prefix = ""): Record<string, string> {
  return Object.fromEntries(Object.entries(value).flatMap(([key, child]) =>
    typeof child === "string"
      ? [[prefix + key, child]]
      : Object.entries(flatten(child, `${prefix}${key}.`)),
  ));
}

test("all three dictionaries cover the same nonempty labels and interpolation placeholders", () => {
  const french = flatten(getDictionary("fr"));
  for (const locale of locales) {
    const dictionary = flatten(getDictionary(locale));
    assert.deepEqual(Object.keys(dictionary).sort(), Object.keys(french).sort(), locale);
    for (const [key, value] of Object.entries(dictionary)) {
      assert.ok(value.trim(), `${locale}.${key}`);
      const placeholders = (text: string) => (text.match(/\{[^{}]+\}/g) ?? []).sort();
      assert.deepEqual(placeholders(value), placeholders(french[key]), `${locale}.${key}`);
    }
  }
});

test("Tunisian Arabic has dedicated Arabic-script text throughout every module", () => {
  const tunisian = flatten(getDictionary("aeb"));
  for (const [key, value] of Object.entries(tunisian)) {
    // Event effects are mathematical symbols rather than translated labels.
    if (key.startsWith("livestock.events.effects.")) continue;
    assert.match(value, /[\u0600-\u06ff]/, key);
    assert.doesNotMatch(value.replace(/\{[^{}]+\}/g, "").replaceAll("FellahPro", ""), /[A-Za-z]/, key);
  }
  assert.equal(getDictionary("aeb").nav.farm, "ضيعتي");
  assert.equal(getDictionary("aeb").nav.plots, "قطع الأرض");
  assert.equal(getDictionary("aeb").nav.cropCycles, "المواسم الفلاحية");
  assert.notDeepEqual(getDictionary("aeb"), getDictionary("ar"));
});

test("locale names, directions and legacy profile values are explicit", () => {
  assert.deepEqual(locales, ["fr", "ar", "aeb"]);
  assert.deepEqual(localeNames, { fr: "Français", ar: "العربية", aeb: "تونسي" });
  assert.equal(getDirection("fr"), "ltr");
  for (const locale of ["ar", "aeb"] as const) {
    assert.equal(getDirection(locale), "rtl");
    assert.equal(getProfileLocale(locale), "ar");
  }
  assert.equal(getProfileLocale("fr"), "fr");
});

test("only supported locale preferences are accepted and the cookie is narrowly scoped", () => {
  for (const locale of locales) {
    assert.ok(isLocale(locale));
    assert.equal(getPreferredLocale(locale), locale);
  }
  for (const value of [undefined, "", "en", "AEB", "ar-TN", "../ar", "fr; other=value"]) {
    assert.equal(getPreferredLocale(value), defaultLocale);
    if (value !== undefined) assert.equal(isLocale(value), false);
  }
  assert.equal(localeCookieName, "fellahpro_locale");
  assert.deepEqual(getLocaleCookieOptions(true), {
    httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 31_536_000,
  });
  assert.equal(getLocaleCookieOptions(false).secure, false);
});

test("switching locale preserves record IDs, raw filters, pagination and fragments in every direction", () => {
  const paths = [
    "/app/plots/11111111-1111-4111-8111-111111111111/edit?from=2026-01-01&page=3#notes",
    "/app/operations?plotId=123&kind=irrigation&kind=other&search=%D8%B2%D9%8A%D8%AA%D9%88%D9%86#history",
    "/app/crop-cycles?status=en_cours&page=2",
    "/app/tasks?due=overdue&sort=asc",
    "/app/livestock?species=ovin",
    "/login?error=invalid_credentials",
    "/signup?error=invalid_form",
    "/onboarding#farm",
    "",
  ];
  for (const source of locales) for (const target of locales) for (const path of paths) {
    assert.equal(getLocalizedHref(`/${source}${path}`, target), `/${target}${path}`);
  }
  assert.equal(getLocalizedHref("/", "aeb"), "/aeb/");
  assert.equal(getLocalizedHref("/app/plots?page=2#list", "aeb"), "/aeb/app/plots?page=2#list");
});

test("locale navigation cannot redirect to an external origin", () => {
  for (const path of ["https://example.invalid", "//example.invalid", "/\\example.invalid", "/fr\r\nLocation: elsewhere", "javascript:alert(1)"]) {
    assert.equal(getLocalizedHref(path, "aeb"), "/aeb");
  }
  assert.throws(() => getLocalizedHref("/fr/app", "en" as Locale), TypeError);
});
