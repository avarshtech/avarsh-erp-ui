/**
 * Playwright setup for the RBAC AUDIT soak — authenticates the three synthetic non-admin
 * roles and saves one storage state each.
 *
 * Deliberately SEPARATE from global-setup.js. Every existing project depends on the
 * `setup` project, and these three users exist only in the e2e seed
 * (db/e2eseed/V20260909160000__seed_rbac_soak_roles.sql). Folding them into the shared
 * setup would mean that running the suite against any database without that seed fails
 * `setup`, and with it all eighteen existing projects.
 *
 * Why this exists: the superuser bypass short-circuits before any permission is read, so
 * an AUDIT soak driven only by superadmin traffic produces an almost empty denial log —
 * and the flip to ENFORCE would be made on no evidence.
 *
 * Environment variables:
 *   E2E_SOAK_PASSWORD — password for all three (default: admin123)
 *
 * NOTE the default is admin123, the seeded password. admin98 is the PRODUCTION superadmin
 * password and must never be sent for these accounts.
 */

import { test as setup, expect } from '@playwright/test';
import process from 'process';

export const SOAK_ROLES = [
  { username: 'e2e-merch', authFile: './e2e/.auth/e2e-merch.json' },
  { username: 'e2e-store', authFile: './e2e/.auth/e2e-store.json' },
  { username: 'e2e-costing', authFile: './e2e/.auth/e2e-costing.json' },
];

const password = process.env['E2E_SOAK_PASSWORD'] || 'admin123';

for (const role of SOAK_ROLES) {
  setup(`authenticate ${role.username}`, async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    // The page may show a spinner while it checks for an existing session.
    await expect(page.getByPlaceholder('Username')).toBeVisible({ timeout: 30000 });

    await page.getByPlaceholder('Username').fill(role.username);
    await page.getByPlaceholder('Password').fill(password);
    await page.getByRole('button', { name: /Sign In/i }).click();

    // A successful login navigates away from /login. These roles have no admin screens,
    // so assert only that we left the login page — not any particular landing route.
    await expect(page).not.toHaveURL(/login/, { timeout: 30000 });

    await page.context().storageState({ path: role.authFile });
  });
}
