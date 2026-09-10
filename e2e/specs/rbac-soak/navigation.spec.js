/**
 * RBAC AUDIT soak — drives real traffic as each synthetic non-admin role.
 *
 * Phase 3 of the server-side RBAC rollout deliberately runs in AUDIT mode, where the
 * interceptor logs the verdict it *would* have reached and then allows the call. That log is
 * the evidence the ENFORCE flip is made on, and it is only as good as the traffic that
 * produced it. Every other project in this suite authenticates as superadmin, whose bypass
 * returns before a permission is ever read — so without this spec the soak observes nothing.
 *
 * Each project below supplies a different storageState; the role is read from the project
 * name. Routes are exactly the screens that role's seeded permission blob grants, so a 403
 * here means the client and server registries have drifted.
 *
 * While erp.rbac.mode is OFF this is a UI-side regression guard: it proves each role's
 * PermissionRoute lets it reach its own screens. Once the mode is AUDIT it becomes the
 * traffic generator. Once it is ENFORCE it becomes the detector.
 */

import { test, expect } from '@playwright/test';

// Keyed by project name. Paths come from the SCREENS registry in src/utils/permissions.js;
// the grants come from db/e2eseed/V20260909160000__seed_rbac_soak_roles.sql.
const ROUTES = {
  'rbac-soak-merch': [
    '/',
    '/orders/list',
    '/bom/list',
    '/costing/list',
    '/sample-requests/list',
    '/purchase-orders/supplier-po/list',
    '/master',
  ],
  'rbac-soak-store': [
    '/',
    '/inventory/dashboard',
    '/inventory/grn/list',
    '/inventory/stock',
    '/inventory/qc',
    '/inventory/issue',
    '/inventory/adjustment',
    '/purchase-orders/supplier-po/list',
    '/master',
  ],
  'rbac-soak-costing': [
    '/',
    '/costing/list',
    '/bom/list',
    '/orders/list',
    '/reports/list',
    '/master',
  ],
};

test.describe('RBAC soak — every granted screen loads', () => {
  test('visits each granted route and records any denial', async ({ page }, testInfo) => {
    const routes = ROUTES[testInfo.project.name];
    expect(routes, `no route list for project ${testInfo.project.name}`).toBeTruthy();

    // Collect denials rather than failing on the first one — the whole list is the report.
    const denials = [];
    page.on('response', (res) => {
      if (res.status() === 403) denials.push(`${res.request().method()} ${res.url()}`);
    });

    for (const route of routes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });

      // The client's own PermissionRoute renders a no-access Result instead of the screen
      // when a role lacks the key. That is a registry drift, not a rendering failure.
      // Two wordings: the route surface ("…permission to access this page") and the
      // action surface ("…the required permission to perform this action").
      await expect(page.getByText(/access denied|you do not have (the required )?permission/i))
        .toBeHidden({ timeout: 5000 })
        .catch(() => {
          throw new Error(`${testInfo.project.name} was refused ${route} by the client guard`);
        });

      // Let the screen's initial fetches settle so they reach the audit log.
      await page.waitForTimeout(1500);
    }

    expect(denials, `server denied:\n${denials.join('\n')}`).toEqual([]);
  });
});
