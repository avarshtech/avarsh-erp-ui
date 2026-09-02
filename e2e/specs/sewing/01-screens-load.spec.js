/**
 * Every sewing screen loads against the real API.
 *
 * This is the spec that would have caught the module still being on the mock:
 * each tab must render its own shell, issue a call to /api/v1/sewing (or a
 * master endpoint) and come back without a client-side error.
 */
import { test, expect } from '@playwright/test';
import { ensureSessionActive } from '../../helpers/navigation.js';
import { openTab, settle, TABS, watchConsole } from './helpers.js';

/** Everything the sewing screens read — the surface these specs are about. */
const SEWING_ENDPOINT = new RegExp([
  '/api/v1/sewing',
  '/api/v1/production-lines',
  '/api/v1/machine-types',
  '/api/v1/sewing-operations',
  '/api/v1/sewing-defect-types',
  '/api/v1/sewing-lookups',
  '/api/v1/incentive-slabs',
  '/api/v1/measurement-specs',
  '/api/v1/hr/shifts',
  '/api/v1/hr/employees',
  '/api/v1/cutting/',
  '/api/v1/parts',
].join('|'));

const TAB_EXPECTATIONS = [
  { tab: TABS.dashboard, name: 'Dashboard', marker: /Traffic light/i },
  { tab: TABS.plan, name: 'Production Plan', marker: /Production Plan|New Sewing Plan|No sewing plans/i },
  { tab: TABS.receipt, name: 'Cut Parts Receipt', marker: /Bundle Issue|Receive Bundles/i },
  { tab: TABS.trims, name: 'Trims Verification', marker: /BOM|Verification Card/i },
  { tab: TABS.hourly, name: 'Hourly Production', marker: /Operator-wise Hourly Output|Line Efficiency/i },
  { tab: TABS.measurement, name: 'Measurement', marker: /measurement chart|Measurement Report/i },
  { tab: TABS.topse, name: 'EndLine Check', marker: /DHU|End-Line Check/i },
  { tab: TABS.issue, name: 'Garment Issue', marker: /Over-issuance|Garment Issue/i },
  { tab: TABS.replacements, name: 'Replacements', marker: /bundle serial|Replacement Request/i },
  { tab: TABS.operators, name: 'Operators & SAM', marker: /Skill Matrix|Operator/i },
];

test.describe('Sewing — every screen loads on the API', () => {
  test.beforeEach(async ({ page }) => {
    await ensureSessionActive(page);
  });

  for (const { tab, name, marker } of TAB_EXPECTATIONS) {
    test(`${name} renders and calls the backend`, async ({ page }) => {
      const errors = watchConsole(page);
      const calls = [];
      const failed = [];
      page.on('request', (req) => {
        const url = req.url();
        if (url.includes('/api/v1/')) calls.push(url);
      });
      page.on('response', (resp) => {
        const url = resp.url();
        // Scoped to what these screens actually read. The auth handshake is the
        // harness re-authenticating, and /admin/activity-feed is a global
        // poller that 403s app-wide — neither is a sewing defect.
        if (!SEWING_ENDPOINT.test(url)) return;
        if (resp.status() >= 400) failed.push(`${resp.status()} ${url}`);
      });

      await openTab(page, tab);

      await expect(page.getByText(marker).first()).toBeVisible({ timeout: 20000 });

      // The whole point of the migration: these screens must be talking to the
      // server, not to an in-memory mock that was deleted.
      expect(calls.length, `${name} made no API call`).toBeGreaterThan(0);
      expect(failed, `${name} had failing API calls:\n${failed.join('\n')}`).toHaveLength(0);
      expect(errors, `${name} logged console errors:\n${errors.join('\n')}`).toHaveLength(0);
    });
  }

  test('no sewing endpoint returns a server error across the whole module', async ({ page }) => {
    const bad = [];
    page.on('response', (resp) => {
      const url = resp.url();
      if (!url.includes('/api/v1/')) return;
      if (resp.status() >= 500) bad.push(`${resp.status()} ${url}`);
    });

    for (const { tab } of TAB_EXPECTATIONS) {
      await openTab(page, tab);
      await settle(page, 800);
    }

    expect(bad, `server errors:\n${bad.join('\n')}`).toHaveLength(0);
  });
});
