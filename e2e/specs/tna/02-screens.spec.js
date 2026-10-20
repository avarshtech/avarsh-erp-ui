/**
 * Time & Action screens (CR-TNA-001 Round 1, mock source data as of 09-Oct-2026). Asserts the
 * wireframe behaviour WF-01..WF-09 against the §17 worked order SG/26-27/1012, and AS-12: no
 * date, number or status input and no "Record actual" / "Propose re-plan" anywhere on the
 * read-only screens. The mock store lives in page memory, so the data-issue test moves through
 * the app's own menu instead of reloading.
 */
import { test, expect } from '@playwright/test';
import { ensureSessionActive, navigateWithAuth } from '../../helpers/navigation.js';

const open = async (page, path, heading) => {
  await ensureSessionActive(page);
  // Each test context starts from the same saved refresh token; once another context has rotated
  // it, the app lands on the login form — sign in again rather than fail.
  await navigateWithAuth(page, path);
  await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible({ timeout: 90000 });
};

const assertReadOnly = async (page) => {
  await expect(page.locator('.ant-picker')).toHaveCount(0);
  await expect(page.locator('.ant-input-number')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /record actual|propose re-?plan/i })).toHaveCount(0);
};

const WORKED = 'T&A plan — SG/26-27/1012';

test.describe('Time & Action screens', () => {
  test('WF-01 Control Tower: both commitments, movement apart from delay, blocked and infeasible orders', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await open(page, '/tna/control-tower', 'Control Tower');
    const row = page.locator('tr', { hasText: 'SG/26-27/1012' });
    for (const text of ['03-Nov-2026', '07-Dec-2026', '+34 CD', '23-Nov-2026', '+20 CD', '−14 CD', '12 / 28']) {
      await expect.soft(row, text).toContainText(text);
    }
    await expect(page.getByText(/SG\/26-27\/1023.*plan not generated/)).toBeVisible();
    await expect(page.locator('tr', { hasText: 'SG/26-27/1031' })).toContainText('Infeasible');
    await assertReadOnly(page);
    expect(errors).toEqual([]);
  });

  test('WF-02 / WF-05 grid reproduces §17 and the activity detail is read-only evidence', async ({ page }) => {
    await open(page, '/tna/plan/1012', WORKED);
    const a09 = page.locator('tr', { hasText: 'First Bulk Piece' }).first();
    for (const text of ['18-Sep-2026', '03-Oct-2026', '12-Oct-2026', '+19 WD', 'Overdue']) await expect.soft(a09, text).toContainText(text);
    await expect(page.getByText(/Driving constraint: A09 First Bulk Piece has been open 5 working day/)).toBeVisible();
    await assertReadOnly(page);
    await page.locator('tr', { hasText: 'Bulk fabric in-house' }).first().click();
    const drawer = page.locator('.ant-drawer-open');
    await expect(drawer.getByText('No editable field appears on this panel')).toBeVisible();
    await expect(drawer.getByText('GRN/26-27/11847').first()).toBeVisible();
    await expect(drawer.getByText('Supplier — material availability')).toBeVisible();
    await expect(drawer.getByText(/GRN\/26-27\/11610 · 3,050 m/)).toBeVisible();
    await expect(drawer.locator('.ant-picker, .ant-input-number, textarea')).toHaveCount(0);
  });

  test('WF-03 / WF-04 timeline and swimlane show the same plan', async ({ page }) => {
    await open(page, '/tna/plan/1012?view=timeline', WORKED);
    await expect(page.getByText('Longest path driving dispatch')).toBeVisible();
    await expect(page.getByText('Original 03-Nov-2026')).toBeVisible();
    await expect(page.getByText('Latest 07-Dec-2026')).toBeVisible();
    await page.getByText('Swimlane', { exact: true }).click();
    await expect(page.getByText('Sampling & buyer approvals')).toBeVisible();
    await expect(page.locator('.ant-alert').filter({ hasText: /Driving activity: A09 First Bulk Piece/ })).toBeVisible();
  });

  test('FR-6.4 Report data issue raises a task that appears on the Exceptions console', async ({ page }) => {
    await open(page, '/tna/plan/1012', WORKED);
    await page.getByRole('button', { name: 'Report data issue' }).click();
    const modal = page.locator('.ant-modal-wrap').filter({ hasText: 'Report data issue' });
    await modal.getByLabel('Activity').fill('A13');
    await page.locator('.ant-select-dropdown:visible').getByText('A13 Bulk fabric in-house').click();
    await modal.getByLabel('What looks wrong in the source record?').fill('GRN posted against the wrong order line');
    await modal.getByRole('button', { name: 'Raise correction task' }).click();
    await expect(page.getByText(/Correction task raised for Stores against GRN\/26-27\/11847/)).toBeVisible();
    await page.getByRole('menuitem', { name: 'Exceptions' }).click();
    await expect(page.getByRole('heading', { name: 'Exceptions & data quality', level: 1 })).toBeVisible();
    await expect(page.locator('tr', { hasText: 'GRN posted against the wrong order line' })).toContainText('Data issue reported');
  });

  test('WF-06 Revisions & Audit: no approval queue; a commitment revision moves nothing', async ({ page }) => {
    await open(page, '/tna/revisions?plan=1012', 'Revisions & audit');
    await expect(page.getByText('There is no approval queue in Time & Action')).toBeVisible();
    await expect(page.locator('tr', { hasText: 'order.dispatch_revised' })).toContainText('0 moved');
    await expect(page.getByText('Commitment register')).toBeVisible();
    await expect(page.getByText(/movement is recorded as a commitment revision/)).toBeVisible();
    await assertReadOnly(page);
    await page.goto('/tna/replans', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/tna\/revisions/);
  });

  test('WF-08 Exceptions: resolving the identity link generates the blocked plan', async ({ page }) => {
    await open(page, '/tna/exceptions', 'Exceptions & data quality');
    await expect(page.locator('tr', { hasText: 'Awaiting source enhancement' }).first()).toContainText('A21 Finishing');
    const identity = page.locator('tr', { hasText: 'Identity unresolved' });
    await identity.getByRole('button', { name: 'Resolve link' }).click();
    const modal = page.locator('.ant-modal-wrap').filter({ hasText: 'Resolve identity' });
    await modal.locator('textarea').fill('CP/6102/B is SG/26-27/1023 line 1 (confirmed with Cutting)');
    await modal.getByRole('button', { name: 'Resolve and generate plan' }).click();
    await expect(page.getByText(/SG\/26-27\/1023: link resolved — plan generated/)).toBeVisible();
  });

  test('WF-07 / WF-09 / My Activities load from derived data', async ({ page }) => {
    await open(page, '/tna/analytics', 'T&A analytics');
    await expect(page.getByText('Delay attribution — share of net order impact')).toBeVisible();
    await expect(page.getByText('Commitment movement — reported separately')).toBeVisible();
    await expect(page.locator('tr', { hasText: 'Reason unavailable' }).first()).toBeVisible();
    await assertReadOnly(page);
    await open(page, '/tna/my-activities', 'My activities');
    await expect(page.locator('tr', { hasText: 'SG/26-27/1042' }).first()).toBeVisible();
    await assertReadOnly(page);
    await open(page, '/tna/masters', 'T&A masters');
    await expect(page.locator('tr', { hasText: 'First Bulk Piece' })).toContainText('Proposed');
    await page.getByRole('tab', { name: 'Working calendar' }).click();
    await expect(page.getByText('Factory calendar 2026 — 11 days declared')).toBeVisible();
  });
});
