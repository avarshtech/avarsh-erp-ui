import { defineConfig } from '@playwright/test';
import process from 'process';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';

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
    // ── Auth Setup ──────────────────────────────────────────
    {
      name: 'setup',
      testMatch: /global-setup\.js/,
    },

    // ── Legacy (existing costing tests) ────────────────────
    {
      name: 'legacy',
      testMatch: /costing\.spec\.js|costing-full-entry\.spec\.js/,
      use: {
        browserName: 'chromium',
        storageState: './e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // ── Module-Wise Test Suites ────────────────────────────
    {
      name: 'master-data',
      testDir: './e2e/specs/master-data',
      use: {
        browserName: 'chromium',
        storageState: './e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'costing',
      testDir: './e2e/specs/costing',
      use: {
        browserName: 'chromium',
        storageState: './e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'orders',
      testDir: './e2e/specs/orders',
      use: {
        browserName: 'chromium',
        storageState: './e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'bom',
      testDir: './e2e/specs/bom',
      use: {
        browserName: 'chromium',
        storageState: './e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'po',
      testDir: './e2e/specs/po',
      use: {
        browserName: 'chromium',
        storageState: './e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'admin',
      testDir: './e2e/specs/admin',
      use: {
        browserName: 'chromium',
        storageState: './e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'validation',
      testDir: './e2e/specs/validation',
      use: {
        browserName: 'chromium',
        storageState: './e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
  // No webServer — start `npm run dev` manually before running tests.
  // For pipeline execution, use scripts/run-e2e.sh or scripts/run-e2e.ps1.
});
