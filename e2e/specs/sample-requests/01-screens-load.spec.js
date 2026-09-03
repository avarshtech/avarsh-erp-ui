/**
 * Every Sample Request screen loads against the real API.
 *
 * This is the spec that would have caught the module still being on its
 * localStorage mock: each screen must render its own shell, issue a call to
 * /api/v1/sample-* (or the sample-issue register's endpoint), and come back
 * without a client-side error. The mock served every one of these screens
 * without touching the network, so "made an API call" is the assertion that
 * actually distinguishes the two.
 */
import { test, expect } from '@playwright/test';
import { ensureSessionActive } from '../../helpers/navigation.js';
import { goTo, settle, watchConsole } from './helpers.js';

/** Everything the sampling screens read. */
const SAMPLE_ENDPOINT = new RegExp([
  '/api/v1/sample-requests',
  '/api/v1/sample-dispatches',
  '/api/v1/sample-invoices',
  '/api/v1/sample-issues',
  '/api/v1/couriers',
].join('|'));

const SCREENS = [
  {
    name: 'Sample Requests list',
    path: '/sample-requests/list',
    marker: /Sample Requests/i,
  },
  {
    name: 'Dispatches',
    path: '/sample-requests/dispatches/list',
    marker: /Dispatch(es)?/i,
  },
  {
    name: 'Customer Comments',
    path: '/sample-requests/comments',
    marker: /Customer Comments/i,
  },
  {
    name: 'Invoices',
    path: '/sample-requests/invoices/list',
    marker: /Invoice/i,
  },
];

test.describe('Sample Requests — every screen loads on the API', () => {
  test.beforeEach(async ({ page }) => {
    await ensureSessionActive(page);
  });

  for (const { name, path, marker } of SCREENS) {
    test(`${name} renders and calls the backend`, async ({ page }) => {
      const errors = watchConsole(page);
      const sampleCalls = [];
      const failed = [];
      page.on('request', (req) => {
        if (SAMPLE_ENDPOINT.test(req.url())) sampleCalls.push(req.url());
      });
      page.on('response', (resp) => {
        // Scoped to the sampling surface: the auth handshake and the app-wide
        // activity-feed poller are not this module's defects.
        if (!SAMPLE_ENDPOINT.test(resp.url())) return;
        if (resp.status() >= 400) failed.push(`${resp.status()} ${resp.url()}`);
      });

      await goTo(page, path);

      await expect(page.getByText(marker).first()).toBeVisible({ timeout: 20000 });
      expect(sampleCalls.length, `${name} made no /api/v1/sample-* call`).toBeGreaterThan(0);
      expect(failed, `${name} had failing sampling calls:\n${failed.join('\n')}`).toHaveLength(0);
      expect(errors, `${name} logged console errors:\n${errors.join('\n')}`).toHaveLength(0);
    });
  }

  test('Material Issue → Sample Request segment carries the Fabric | Trims toggle inside a sample-type tab', async ({ page }) => {
    const errors = watchConsole(page);
    const sampleCalls = [];
    const failed = [];
    page.on('request', (req) => {
      if (SAMPLE_ENDPOINT.test(req.url())) sampleCalls.push(req.url());
    });
    page.on('response', (resp) => {
      if (!SAMPLE_ENDPOINT.test(resp.url())) return;
      if (resp.status() >= 400) failed.push(`${resp.status()} ${resp.url()}`);
    });

    await goTo(page, '/inventory/issue?segment=SampleRequest');

    // The register's three stat cards prove the segment, not the page.
    await expect(page.getByText('Awaiting Issue').first()).toBeVisible({ timeout: 20000 });

    // The toggle lives INSIDE the tab body, so it has to survive a tab change.
    const toggle = page.locator('.ant-segmented').filter({ hasText: 'Fabric Issues' }).first();
    await expect(toggle).toBeVisible();
    await expect(toggle).toContainText('Trims Issues');

    await page.getByRole('tab', { name: /Proto/ }).click();
    await settle(page, 500);
    const inTab = page.locator('[role="tabpanel"]:visible').locator('.ant-segmented')
      .filter({ hasText: 'Fabric Issues' }).first();
    await expect(inTab, 'the toggle must render inside the sample-type tab').toBeVisible();

    // Switching sides swaps the register AND the page header's action.
    await inTab.getByText('Trims Issues').click();
    await settle(page, 500);
    await expect(page.getByRole('button', { name: 'New Trims Issue' }).first()).toBeVisible();
    await inTab.getByText('Fabric Issues').click();
    await settle(page, 500);
    await expect(page.getByRole('button', { name: 'New Fabric Issue' }).first()).toBeVisible();

    expect(sampleCalls.length, 'the sample register made no /api/v1/sample-* call').toBeGreaterThan(0);
    expect(failed, `failing sampling calls:\n${failed.join('\n')}`).toHaveLength(0);
    expect(errors, `console errors:\n${errors.join('\n')}`).toHaveLength(0);
  });

  test('no sampling endpoint returns a server error across the module', async ({ page }) => {
    const bad = [];
    page.on('response', (resp) => {
      if (!resp.url().includes('/api/v1/')) return;
      if (resp.status() >= 500) bad.push(`${resp.status()} ${resp.url()}`);
    });

    for (const { path } of SCREENS) {
      await goTo(page, path);
    }
    await goTo(page, '/inventory/issue?segment=SampleRequest');

    expect(bad, `server errors:\n${bad.join('\n')}`).toHaveLength(0);
  });
});
