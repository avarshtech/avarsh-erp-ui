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
      // Production POs (Cutting / Work Order / Finishing) — specs are ordered
      // 01→03 because each stage needs the previous one approved.
      name: 'production-po',
      testDir: './e2e/specs/production-po',
      timeout: 120000,
      use: {
        browserName: 'chromium',
        storageState: './e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'hr',
      testDir: './e2e/specs/hr',
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

    // ── GRN & QC Test Suite ─────────────────────────────────
    {
      name: 'grn-qc',
      testDir: './e2e/specs/grn-qc',
      timeout: 120000,
      use: {
        browserName: 'chromium',
        storageState: './e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // ── UI-Driven Journey Suite (Masters → Costing → BOM → Order → PO → GRN) ──
    // Every record is created through the real screens; no API seeding. Specs are
    // idempotent (fixed canonical names, skip-if-exists) so re-runs are safe.
    // Filenames are numbered because they MUST run in dependency order.
    {
      name: 'journey',
      testDir: './e2e/specs/journey',
      // Generous: a seeding test may create a dozen records through real forms.
      // Safe because actionTimeout below makes a bad selector fail in seconds.
      timeout: 900000,
      use: {
        browserName: 'chromium',
        storageState: './e2e/.auth/user.json',
        video: 'on',
        // A bad selector should fail in seconds, not burn the whole test timeout.
        actionTimeout: 15000,
      },
      dependencies: ['setup'],
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
  // No webServer — start `npm run dev` manually before running tests.
  // For pipeline execution, use scripts/run-e2e.sh or scripts/run-e2e.ps1.
});
