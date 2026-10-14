/**
 * Route sweep — each screen's landing route loads without a page error or a console error.
 *
 * What this tests:
 *   - every screen in SCREENS (src/utils/permissions.js) that has a parameter-free `path` renders
 *     inside the app shell, finishes loading, and raises no uncaught error and no console
 *     error or warning (React, antd deprecations, failed renders).
 *
 * Data-driven: a screen added to SCREENS is swept without touching this file. Routes with a
 * :param need a record and are left to the module specs.
 *
 * Run it against the DEV server (vite --mode e2e): React's and antd's warnings exist only in
 * development builds, and they are what this sweep is for. Narrow it to sections with
 * SWEEP_SECTIONS, a comma-separated list of SECTIONS keys:
 *
 *   SWEEP_SECTIONS=orders,bom,costing,purchase,inventory,master,admin \
 *     E2E_BASE_URL=http://localhost:3001 E2E_PASSWORD=admin123 \
 *     npx playwright test --project=smoke
 *
 * Each test signs in through the API (authedPage) and fails on a page error, console error or
 * warning (consoleGuard), so the smoke project needs no setup project or saved login.
 *
 * Prerequisites: the e2e API (H2 seed) and the dev server.
 */
import process from 'process';
import { SCREENS } from '../../../src/utils/permissions.js';
import { test, expect } from '../../fixtures.js';

// Warnings too: React's and antd's warnings are what this sweep is for (helpers/console-noise.js
// lists what is ignored).
test.use({ consoleGuardLevels: ['error', 'warning'] });

const sections = (process.env.SWEEP_SECTIONS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const screens = SCREENS.filter(
  (s) => s.path && !s.path.includes(':') && (sections.length === 0 || sections.includes(s.section)),
);

test.describe('Route sweep', () => {
  for (const screen of screens) {
    test(`${screen.section} › ${screen.name} (${screen.path}) loads cleanly`, async ({ authedPage, consoleGuard }) => {
      await authedPage.goto(screen.path);

      await expect(authedPage.locator('#main-content')).toBeVisible();
      await expect(authedPage.locator('.ant-spin-spinning')).toHaveCount(0, { timeout: 20000 });
    });
  }
});
