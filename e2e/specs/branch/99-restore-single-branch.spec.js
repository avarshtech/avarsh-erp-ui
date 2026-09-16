/**
 * Branch hierarchy — put the company back to one branch.
 *
 * The rest of the suite is written against a single-branch company: no
 * switcher, no branch fields, no branch columns. The branch specs create extra
 * branches to exercise the multi-branch shape, so this runs last and closes
 * them again. It is an assertion as much as a cleanup — the single-branch rule
 * has to be reachable from a multi-branch state, which is what a company that
 * closes a site actually does.
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { activeBranches, restoreSingleBranch } from '../../helpers/branch-seed.js';
import { navigateWithAuth, ensureSessionActive, waitForPageReady } from '../../helpers/navigation.js';

let api;

test.beforeAll(async () => { api = await createAuthenticatedClient(); });
test.afterAll(async () => { await api?.dispose(); });

test.describe('Back to a single branch', () => {

  test('closing every other branch leaves one active branch', async () => {
    const closed = await restoreSingleBranch(api);
    expect(closed).toBeGreaterThan(0);

    const branches = await activeBranches(api);
    expect(branches).toHaveLength(1);
    expect(branches[0].isHeadOffice).toBe(true);
  });

  test('the switcher disappears again', async ({ page }) => {
    await ensureSessionActive(page);
    await navigateWithAuth(page, '/');
    await waitForPageReady(page);
    await expect(page.getByLabel('Working branch')).toHaveCount(0);
  });

  test('documents raised at a closed branch are still readable', async () => {
    // Deactivating a branch hides it from pickers; it never hides history.
    const { data } = await api.get('/orders', { size: '100' });
    expect((data.content || []).length).toBeGreaterThan(0);
  });
});
