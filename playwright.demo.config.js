/**
 * Runs that are never part of a normal or CI run, so they live outside playwright.config.js:
 *
 * - `full-flow`: Costing → Order → BOM → PO in one headed, slowed-down browser, to watch.
 *     npx playwright test -c playwright.demo.config.js --project=full-flow
 * - the RBAC AUDIT soak: the three non-admin e2e roles click through their screens so the
 *   server's AUDIT log has evidence before ENFORCE.
 *     npx playwright test -c playwright.demo.config.js --project=rbac-soak-merch
 *
 * Same environment and guards as the main config (e2e/config/env.js).
 */
import { defineConfig } from '@playwright/test';
import process from 'process';
import { E2E_BASE_URL as baseURL } from './e2e/config/env.js';

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'e2e-report', open: 'never' }],
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: !process.env.E2E_HEADED,
  },
  projects: [
    // ── RBAC AUDIT soak (non-admin roles) ──────────────────
    // Its OWN setup, not the shared `setup` project: these three users exist only in the
    // e2e seed, so folding them into the shared setup would fail every other project on
    // any database that lacks that seed.
    {
      name: 'rbac-soak-setup',
      testMatch: /rbac-soak-setup\.js/,
    },
    {
      name: 'rbac-soak-merch',
      testDir: './e2e/specs/rbac-soak',
      use: {
        browserName: 'chromium',
        storageState: './e2e/.auth/e2e-merch.json',
      },
      dependencies: ['rbac-soak-setup'],
    },
    {
      name: 'rbac-soak-store',
      testDir: './e2e/specs/rbac-soak',
      use: {
        browserName: 'chromium',
        storageState: './e2e/.auth/e2e-store.json',
      },
      dependencies: ['rbac-soak-setup'],
    },
    {
      name: 'rbac-soak-costing',
      testDir: './e2e/specs/rbac-soak',
      use: {
        browserName: 'chromium',
        storageState: './e2e/.auth/e2e-costing.json',
      },
      dependencies: ['rbac-soak-setup'],
    },

    // ── Full Business Flow (Costing → Order → BOM → PO) ─────
    // Single browser window, handles its own login, no setup dependency
    {
      name: 'full-flow',
      testMatch: /full-flow\.spec\.js/,
      timeout: 480000,              // 8 minutes for the full flow
      use: {
        browserName: 'chromium',
        headless: false,
        launchOptions: { slowMo: 800 },
        video: 'on',
      },
    },
  ],
});
