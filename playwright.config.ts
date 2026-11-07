import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT ?? 3000);

/**
 * Browser tests (CODE_QUALITY.md §2, Playwright since CP5). Without E2E_BASE_URL they start the
 * production build (npm run build first); with it they run against a deployed app, for example
 * the compose stack behind nginx.
 */
export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://127.0.0.1:${port}`,
    ignoreHTTPSErrors: true,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], locale: "ru-RU" } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run start",
        url: `http://127.0.0.1:${port}`,
        env: { PORT: String(port), HOSTNAME: "127.0.0.1" },
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
