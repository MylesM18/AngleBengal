import { defineConfig, devices } from "@playwright/test";

import {
  DESKTOP_HEIGHT,
  DESKTOP_WIDTH,
  E2E_BASE_URL,
  E2E_PORT,
  STORAGE_STATE,
} from "./e2e/constants";

/**
 * The mobile regression rig (mobile fix plan Phase 7, docs/research §4).
 *
 * This is a second, separate gate: `npm run test:e2e`. The vitest gate
 * (`npm test`) is untouched and stays the unit suite. vitest only collects
 * `src/**\/*.test.ts`, so nothing here is picked up by it.
 *
 * Two engines, because the bugs this rig exists to catch are engine specific:
 * WebKit is the target platform (iPhone Safari) and Chromium is the secondary
 * one (Android Chrome). The desktop project exists for exactly one job, the
 * D-074 gate, which asserts that the compact hit areas do NOT leak upward.
 */
export default defineConfig({
  testDir: "./e2e",
  /*
   * One worker against one dev server. The app talks to a single remote
   * database and the rig navigates real routes; parallel workers would race
   * each other through the same Next compile queue for no wall clock win.
   */
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  /* `next dev` compiles a route on first visit, so first navigation is slow. */
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: E2E_BASE_URL,
    storageState: STORAGE_STATE,
    trace: "retain-on-failure",
  },

  projects: [
    {
      name: "iphone-webkit",
      use: { ...devices["iPhone 13"] },
      testIgnore: /desktop-.*\.spec\.ts/,
    },
    {
      name: "pixel-chromium",
      use: { ...devices["Pixel 7"] },
      testIgnore: /desktop-.*\.spec\.ts/,
    },
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: DESKTOP_WIDTH, height: DESKTOP_HEIGHT },
      },
      testMatch: /desktop-.*\.spec\.ts/,
    },
  ],

  /*
   * Dev, not a production build. Tailwind emits the same CSS either way, so
   * layout is identical, and a `next build` inside the loop would make the rig
   * too slow to actually get run. The tradeoff is deliberate.
   */
  webServer: {
    command: `npm run dev -- --port ${E2E_PORT}`,
    url: E2E_BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
