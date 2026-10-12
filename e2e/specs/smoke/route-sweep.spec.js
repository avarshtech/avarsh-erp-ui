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
 * Prerequisites: the e2e API (H2 seed) and the dev server.
 */
import { test, expect } from '@playwright/test';
import process from 'process';
import { SCREENS } from '../../../src/utils/permissions.js';
import { navigateWithAuth } from '../../helpers/navigation.js';

// Noise that does not come from the screen's code: the dev server does not serve the service
// worker, a failed request is the network's report (the screen's handling of it is what counts),
// and React's DevTools advert.
const IGNORED = [
  /Service worker registration failed/i,
  /unsupported MIME type/i,
  /Failed to load resource/i,
  /React DevTools/i,
];

const sections = (process.env.SWEEP_SECTIONS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const screens = SCREENS.filter(
  (s) => s.path && !s.path.includes(':') && (sections.length === 0 || sections.includes(s.section)),
);

test.describe('Route sweep', () => {
  for (const screen of screens) {
    test(`${screen.section} › ${screen.name} (${screen.path}) loads cleanly`, async ({ page }) => {
      const problems = [];
      page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
      page.on('console', (msg) => {
        if (msg.type() !== 'error' && msg.type() !== 'warning') return;
        const text = msg.text();
        if (!IGNORED.some((pattern) => pattern.test(text))) {
          problems.push(`${msg.type()}: ${text.split('\n')[0]}`);
        }
      });

      await navigateWithAuth(page, screen.path);

      await expect(page.locator('#main-content')).toBeVisible();
      await expect(page.locator('.ant-spin-spinning')).toHaveCount(0, { timeout: 20000 });

      expect(problems, problems.join('\n')).toEqual([]);
    });
  }
});
