/**
 * Every cutting screen loads against the real API.
 *
 * Same shape as the sewing suite: each tab must render its own shell, call the
 * backend and come back without a client-side error or a failing request on an
 * endpoint the cutting screens actually read.
 */
import { test, expect } from '@playwright/test';
import { navigateWithAuth, waitForPageReady, ensureSessionActive } from '../../helpers/navigation.js';
import { settle, watchConsole } from '../sewing/helpers.js';

const CUTTING = '/production/cutting';

/** Everything the cutting screens read — the surface these specs are about. */
const CUTTING_ENDPOINT = new RegExp([
  '/api/v1/cutting',
  '/api/v1/cutting-lookups',
  '/api/v1/cutting-po',
  '/api/v1/production-lines',
  '/api/v1/parts',
  '/api/v1/processes',
  '/api/v1/fabric',
  '/api/v1/orders',
  '/api/v1/hr/employees',
].join('|'));

const TABS = [
  { key: 'dashboard', name: 'Dashboard' },
  { key: 'fabric-in', name: 'Fabric In' },
  { key: 'planning', name: 'Marker Plan' },
  { key: 'lay-audit', name: 'Lay Audit' },
  { key: 'report', name: 'Cutting Report' },
  { key: 'tmb', name: 'TMB Check' },
  { key: 'bundling', name: 'Bundling' },
  { key: 'external', name: 'External Process' },
  { key: 'recut', name: 'Re-Cut Register' },
  { key: 'reconciliation', name: 'Reconciliation' },
];

test.describe('Cutting — every screen loads on the API', () => {
  test.beforeEach(async ({ page }) => {
    await ensureSessionActive(page);
  });

  for (const { key, name } of TABS) {
    test(`${name} renders without a client error`, async ({ page }) => {
      const errors = watchConsole(page);
      const failed = [];
      page.on('response', (resp) => {
        const url = resp.url();
        if (!CUTTING_ENDPOINT.test(url)) return;
        if (resp.status() >= 400) failed.push(`${resp.status()} ${url}`);
      });

      await navigateWithAuth(page, `${CUTTING}?tab=${key}`);
      await waitForPageReady(page);
      await settle(page);

      // The tab must actually paint something, not white-screen on an error.
      await expect(page.locator('[role="tabpanel"]').first()).toBeVisible({ timeout: 20000 });

      expect(failed, `${name} had failing API calls:\n${failed.join('\n')}`).toHaveLength(0);
      expect(errors, `${name} logged console errors:\n${errors.join('\n')}`).toHaveLength(0);
    });
  }

  test('no cutting endpoint returns a server error across the whole module', async ({ page }) => {
    const bad = [];
    page.on('response', (resp) => {
      const url = resp.url();
      if (!url.includes('/api/v1/')) return;
      if (resp.status() >= 500) bad.push(`${resp.status()} ${url}`);
    });

    for (const { key } of TABS) {
      await navigateWithAuth(page, `${CUTTING}?tab=${key}`);
      await waitForPageReady(page);
      await settle(page, 800);
    }

    expect(bad, `server errors:\n${bad.join('\n')}`).toHaveLength(0);
  });
});
