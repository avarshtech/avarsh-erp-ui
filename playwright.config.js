import { defineConfig } from '@playwright/test';
import process from 'process';
// Loading env.js refuses a base or API URL that is not on this machine (E2E_ALLOW_REMOTE=1 to override).
import { E2E_BASE_URL as baseURL } from './e2e/config/env.js';

// On a CI runner (GitHub sets CI=true): headless, one retry with a trace, no test.only, and junit
// and GitHub annotations beside the HTML report. Without CI a run behaves as it always has.
const CI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  retries: CI ? 1 : 0,
  forbidOnly: CI,
  workers: 1,
  reporter: CI
    ? [
      ['list'],
      ['html', { outputFolder: 'e2e-report', open: 'never' }],
      ['junit', { outputFile: 'test-results/junit.xml' }],
      ['github'],
    ]
    : [
      ['list'],
      ['html', { outputFolder: 'e2e-report', open: 'never' }],
    ],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: CI || !process.env.E2E_HEADED,
  },
  projects: [
    // ── Auth Setup ──────────────────────────────────────────
    {
      name: 'setup',
      testMatch: /global-setup\.js/,
    },

    // Pure logic tests (calculators, models, the T&A engine) run in Vitest, next to their modules.

    // ── Legacy (existing costing tests) ────────────────────
    {
      name: 'legacy',
      // Anchored to the e2e ROOT files: the old pattern also swallowed
      // specs/journey/02-costing.spec.js and double-ran it under this project.
      testMatch: /e2e[\\/]costing(-full-entry)?\.spec\.js$/,
      use: {
        browserName: 'chromium',
        storageState: './e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // ── Smoke: what CI runs on every push to dev (e2e/specs/smoke) ──
    // The route sweep (every screen's landing route loads cleanly; on the dev server it also
    // catches React and antd warnings), the fixtures' own checks, and each core module's records
    // in the API and on its list. Every test signs in through the API (fixtures.js authedPage),
    // so this project needs neither the setup project nor a saved login.
    {
      name: 'smoke',
      testDir: './e2e/specs/smoke',
      use: {
        browserName: 'chromium',
      },
    },

    // ── Module-Wise Test Suites ────────────────────────────
    {
      // Buyer document templates (API) + the mock packing-list picker that uses them.
      name: 'export-docs',
      testDir: './e2e/specs/export-docs',
      use: {
        browserName: 'chromium',
        storageState: './e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
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
      // Cutting room — same shape as the sewing suite: the screens must load
      // from the API and stay clean.
      name: 'cutting',
      testDir: './e2e/specs/cutting',
      timeout: 120000,
      use: {
        browserName: 'chromium',
        storageState: './e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      // Virtual factory — the 3D twin; SwiftShader lets headless Chromium draw WebGL.
      name: 'virtual-factory',
      testDir: './e2e/specs/virtual-factory',
      timeout: 180000,
      use: {
        browserName: 'chromium',
        storageState: './e2e/.auth/user.json',
        launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
      },
      dependencies: ['setup'],
    },
    {
      // Time & Action screens — read-only, derived plans (mock data until the API lands).
      name: 'tna',
      testDir: './e2e/specs/tna',
      timeout: 120000,
      use: {
        browserName: 'chromium',
        storageState: './e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      // Sewing floor — the module runs entirely on the API, so these specs
      // assert the screens load from it, records survive a reload and the
      // server-derived rules reach the screen.
      name: 'sewing',
      testDir: './e2e/specs/sewing',
      timeout: 120000,
      use: {
        browserName: 'chromium',
        storageState: './e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      // Production flow — one fresh order from costing to packing. The upstream chain (costing →
      // order → BOM → supplier PO → GRN → QC → stock) is built through the API, then every
      // production stage is driven through its screen. Numbered: each file finds the order the
      // earlier ones built. Signs in per test (the authedPage fixture), so it needs no `setup`.
      name: 'production-flow',
      testDir: './e2e/specs/production-flow',
      timeout: 180000,
      use: {
        browserName: 'chromium',
      },
    },
    {
      // Sample Requests — the module came off its localStorage mock in seven
      // stages; these specs are what proves it. Numbered because 02 raises the
      // request 03 and 04 then dispatch, invoice and close.
      name: 'sample-requests',
      testDir: './e2e/specs/sample-requests',
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
      // Approval engine deep suite: multi-level routing, conditions, My Approvals
      // inbox, bypass guards. Specs are numbered — 01 creates the e2e-manager user
      // that 02/04 authenticate as.
      name: 'approvals',
      testDir: './e2e/specs/approvals',
      timeout: 120000,
      use: {
        browserName: 'chromium',
        storageState: './e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      // Inventory beyond GRN/QC: allowance, stock register, opening stock, material
      // issue, stock adjustment, return-to-supplier + debit notes.
      name: 'inventory',
      testDir: './e2e/specs/inventory',
      timeout: 120000,
      use: {
        browserName: 'chromium',
        storageState: './e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      // Definition-driven reporting: definitions are authored via API at test start
      // (none are seeded), then the builder/saved/export/log surfaces are exercised.
      name: 'reports',
      testDir: './e2e/specs/reports',
      timeout: 120000,
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

    // The RBAC soak and the headed full-flow demo are in playwright.demo.config.js: a plain run
    // here never opens a visible browser, and the soak is only ever run on purpose.

    // ── Branch / Unit hierarchy ─────────────────────────────
    // Declared last on purpose: the specs make the company multi-branch to
    // exercise the switcher, branch fields and columns, and 99-restore closes
    // those branches again. Every other suite is written against the
    // single-branch company the seed ships, so nothing may run after this
    // until the restore has happened.
    {
      name: 'branch',
      testDir: './e2e/specs/branch',
      timeout: 120000,
      use: {
        browserName: 'chromium',
        storageState: './e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
  // No webServer: start the e2e stack yourself (API on 8088, `npx vite --mode e2e` on a pinned
  // port) as e2e/README.md describes. CI starts it in .github/workflows/e2e.yml.
});
