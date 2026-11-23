import { expect, test, type Page } from "@playwright/test";

import { getDictionary } from "../../i18n/dictionaries";
import type { Locale } from "../../i18n/config";
import { localeCookieName } from "../../i18n/preference";
import { mockOrigin, plotId, signInFixture } from "./fixtures";

const selector = (page: Page) => page.locator(".language-selector:visible select");
async function language(page: Page, locale: Locale) {
  await selector(page).selectOption(locale);
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await expect(page.locator("html")).toHaveAttribute("dir", locale === "fr" ? "ltr" : "rtl");
  await expect(selector(page)).toHaveValue(locale);
  await expect(selector(page)).toHaveAccessibleName(getDictionary(locale).languageSelector.label);
}

test.beforeEach(async ({ request }) => {
  await request.post(`${mockOrigin}/__test/reset`);
});

test("guest switching keeps query/fragment and persists across refreshes and a new browser session", async ({ page, context, browser }) => {
  await page.goto("/fr/login?error=invalid_credentials#form");
  await expect(selector(page).locator("option")).toHaveText(["Français", "العربية", "تونسي"]);
  await language(page, "aeb");
  await expect(page).toHaveURL("/aeb/login?error=invalid_credentials#form");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(getDictionary("aeb").auth.loginTitle);
  await expect(page.locator(".form-message[role=status]")).toContainText(getDictionary("aeb").auth.messages.invalidCredentials);
  const preference = (await context.cookies()).find((cookie) => cookie.name === localeCookieName)!;
  expect(preference).toMatchObject({ value: "aeb", httpOnly: true, sameSite: "Lax", secure: true, path: "/" });
  expect(preference.expires).toBeGreaterThan(Date.now() / 1000 + 3600 * 24 * 300);
  await page.reload();
  await expect(selector(page)).toHaveValue("aeb");
  await page.goto("/");
  await expect(page).toHaveURL("/aeb");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const nextSession = await browser.newContext({ storageState: await context.storageState() });
  try {
    const returning = await nextSession.newPage();
    await returning.goto("http://127.0.0.1:3100/");
    await expect(returning).toHaveURL("http://127.0.0.1:3100/aeb");
  } finally { await nextSession.close(); }
  // Explicit links remain authoritative; just visiting/prefetching a URL must
  // never overwrite the preference chosen by the user.
  await page.goto("/ar/login");
  await expect(selector(page)).toHaveValue("ar");
  expect((await context.cookies()).find((cookie) => cookie.name === localeCookieName)?.value).toBe("aeb");
  await language(page, "fr");
  await page.goto("/");
  await expect(page).toHaveURL("/fr");
});

test("the proxy validates preferences and still protects every localized workspace", async ({ page, context }) => {
  await context.addCookies([{ name: localeCookieName, value: "untrusted-locale", url: "http://127.0.0.1:3100" }]);
  await page.goto("/");
  await expect(page).toHaveURL("/fr");
  await language(page, "aeb");
  await page.goto("/app/plots?page=2");
  await expect(page).toHaveURL("/aeb/login");
  await expect(selector(page)).toHaveValue("aeb");
});

test("authenticated round trips preserve record/context, session and subsequent navigation", async ({ page, context, request }, testInfo) => {
  await signInFixture(context);
  const original = (await context.cookies()).find((cookie) => cookie.name === "sb-127-auth-token")!.value;
  const suffix = `/app/plots/${plotId}?success=updated&tag=one&tag=two&page=2#notes`;
  await page.goto(`/fr${suffix}`);
  await expect(page.getByRole("heading", { name: "قطعة الزيتون", exact: true })).toBeVisible();
  await language(page, "aeb");
  await expect(page).toHaveURL(`/aeb${suffix}`);
  await expect(page.getByRole("heading", { name: "قطعة الزيتون", exact: true })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: getDictionary("aeb").plots.success.updated })).toBeVisible();
  await expect(page.locator(".back-link span").first()).toHaveCSS("transform", "matrix(-1, 0, 0, 1, 0, 0)");
  await expect(page.locator(".operation-history > .field-hint").first()).toBeVisible();
  const historyHeading = await page.locator(".operation-history .dashboard-section-heading").boundingBox();
  const historyHint = await page.locator(".operation-history > .field-hint").first().boundingBox();
  expect(historyHint!.y).toBeGreaterThanOrEqual(historyHeading!.y + historyHeading!.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (testInfo.project.name.startsWith("desktop")) {
    const sidebar = await page.locator(".app-sidebar").boundingBox();
    const content = await page.locator(".app-content").boundingBox();
    expect(sidebar!.x).toBeGreaterThan(content!.x);
  }
  await page.screenshot({ path: testInfo.outputPath("tunisian-rtl.png"), fullPage: true });
  await language(page, "ar");
  await expect(page).toHaveURL(`/ar${suffix}`);
  await language(page, "fr");
  await expect(page).toHaveURL(`/fr${suffix}`);
  await expect(page.getByRole("heading", { name: "قطعة الزيتون", exact: true })).toBeVisible();
  await expect(page.locator(".back-link span").first()).toHaveCSS("transform", "none");
  await page.screenshot({ path: testInfo.outputPath("french-ltr.png"), fullPage: true });
  await language(page, "aeb");
  await page.locator(".plot-details-page > .back-link").click();
  await expect(page).toHaveURL("/aeb/app/plots");
  await page.locator(".plot-card").click();
  await expect(page).toHaveURL(`/aeb/app/plots/${plotId}`);
  expect((await context.cookies()).find((cookie) => cookie.name === "sb-127-auth-token")?.value).toBe(original);
  const requests = await (await request.get(`${mockOrigin}/__test/requests`)).json();
  expect(requests.filter((entry: { method: string; path: string }) =>
    entry.method !== "GET" && entry.method !== "HEAD" &&
    !(entry.method === "POST" && entry.path === "/rest/v1/rpc/get_current_workspace"),
  )).toEqual([]);
});

for (const role of ["worker", "accountant"] as const) {
  test(`${role} keeps the same membership permissions after a language change`, async ({ page, context }) => {
    await signInFixture(context, role);
    await page.goto(`/fr/app/plots/${plotId}`);
    await language(page, "aeb");
    await expect(page).toHaveURL(`/aeb/app/plots/${plotId}`);
    await expect(page.locator(".plot-details-actions a")).toHaveCount(role === "worker" ? 1 : 0);
    await expect(page.locator(".plot-details-actions button")).toHaveCount(0);
  });
}

test("Tunisian first-farm onboarding retains the session and uses schema-compatible profile metadata", async ({ page, context, request }) => {
  await signInFixture(context, "newcomer");
  await page.goto("/fr/onboarding");
  await language(page, "aeb");
  await expect(page).toHaveURL("/aeb/onboarding");
  await page.getByLabel(getDictionary("aeb").onboarding.fullName, { exact: true }).fill("فلاّح التجربة");
  await page.getByLabel(getDictionary("aeb").onboarding.farmName, { exact: true }).fill("ضيعة التجربة");
  await page.getByRole("button", { name: getDictionary("aeb").onboarding.submit, exact: true }).click();
  await expect(page).toHaveURL("/aeb/app");
  const requests = await (await request.get(`${mockOrigin}/__test/requests`)).json();
  const profile = requests.find((entry: { method: string; path: string }) => entry.method === "POST" && entry.path === "/rest/v1/profiles");
  expect(profile.body.locale).toBe("ar");
  const farm = requests.find((entry: { path: string }) => entry.path === "/rest/v1/rpc/create_first_farm");
  expect(farm.body).toEqual({ p_name: "ضيعة التجربة" });
  expect((await context.cookies()).some((cookie) => cookie.name === "sb-127-auth-token")).toBe(true);
});

test("Tunisian signup sends compatible Auth metadata and a localized confirmation route", async ({ page, request }) => {
  await page.goto("/aeb/signup");
  const text = getDictionary("aeb");
  await expect(page).toHaveTitle(`${text.metadata.signup} · FellahPro`);
  await page.getByLabel(text.auth.fullName, { exact: true }).fill("فلاّح التجربة");
  await page.getByLabel(text.auth.email, { exact: true }).fill("farmer@example.test");
  await page.getByLabel(text.auth.password, { exact: true }).fill("local-test-password");
  await page.getByRole("button", { name: text.auth.signupAction, exact: true }).click();
  await expect(page).toHaveURL("/aeb/login?success=check_email");
  const requests = await (await request.get(`${mockOrigin}/__test/requests`)).json();
  const signup = requests.find((entry: { path: string }) => entry.path === "/auth/v1/signup");
  expect(signup.body.data.locale).toBe("ar");
  await expect(page.locator(".form-message[role=status]")).toContainText(text.auth.messages.checkEmail);
});

test("a failed preference action stays on the current page with a translated accessible error", async ({ page, context }) => {
  await page.goto("/aeb/login?error=invalid_credentials");
  await page.route("**/*", (route) => route.request().headers()["next-action"] ? route.abort() : route.continue());
  await selector(page).selectOption("fr");
  await expect(page.locator(".language-selector [role=alert]")).toHaveText(getDictionary("aeb").languageSelector.error);
  await expect(page).toHaveURL("/aeb/login?error=invalid_credentials");
  await expect(selector(page)).toHaveValue("aeb");
  expect((await context.cookies()).some((cookie) => cookie.name === localeCookieName)).toBe(false);
});

test("unexpected server errors show a localized safe recovery screen", async ({ page, context, request }) => {
  await signInFixture(context);
  await request.post(`${mockOrigin}/__test/profile-error`);
  await page.goto("/aeb/app/plots");
  await expect(page.getByRole("heading", { name: getDictionary("aeb").system.errorTitle, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: getDictionary("aeb").system.retry, exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Intentional fixture failure");
});

test("the mobile selector fits a 320px viewport in both directions", async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await signInFixture(context);
  await page.goto("/fr/app/plots");
  await expect(selector(page)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await language(page, "aeb");
  await expect(selector(page)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("unknown URLs use the selected language and direction instead of the framework's English 404", async ({ page }) => {
  for (const locale of ["fr", "ar", "aeb"] as const) {
    const response = await page.goto(`/${locale}/not-an-existing-page`);
    expect(response?.status()).toBe(404);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "fr" ? "ltr" : "rtl");
    await expect(page.getByRole("heading", { name: getDictionary(locale).system.notFoundTitle, exact: true })).toBeVisible();
    await expect(selector(page)).toHaveValue(locale);
    await expect(page.locator("body")).not.toContainText("This page could not be found.");
  }
  await language(page, "fr");
  await expect(page).toHaveURL("/fr/not-an-existing-page");
  await expect(page.getByRole("heading", { name: getDictionary("fr").system.notFoundTitle, exact: true })).toBeVisible();
});

test("the labelled native selector supports keyboard language changes", async ({ page }) => {
  await page.goto("/fr/login");
  await expect(selector(page)).toHaveAccessibleName("Langue");
  await selector(page).press("End");
  await expect(page).toHaveURL("/aeb/login");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
});
