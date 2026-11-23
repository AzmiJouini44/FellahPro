import { defineConfig, devices } from "@playwright/test";

// Fixed loopback targets: these tests never use hosted Supabase or real users.
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"], viewport: { width: 375, height: 812 } } },
  ],
  webServer: [
    {
      command: "node --import tsx tests/e2e/mock-supabase.ts",
      url: "http://127.0.0.1:54329/health",
      reuseExistingServer: false,
    },
    {
      command: "node --import tsx tests/e2e/start-app.ts",
      url: "http://127.0.0.1:3100/fr/login",
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
