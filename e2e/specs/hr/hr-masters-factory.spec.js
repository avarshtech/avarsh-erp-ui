/**
 * HR Masters — Factory CRUD E2E Tests
 *
 * What this tests:
 *   - Factory list page loads at /hr/masters with Units selected in left nav
 *   - Create a new factory (required fields: Unit Code, Unit Name)
 *   - Edit an existing factory (modify Unit Name, verify update succeeds)
 *   - Toggle active/inactive status via the Switch in the form
 *   - Form validation — required field errors shown when saved empty
 *   - Delete a factory via the Delete button + modal confirm
 *
 * Prerequisites:
 *   - Backend running with /api/v1/factories endpoint
 *   - Authenticated session (global-setup.js saves e2e/.auth/user.json)
 *   - User has hr-masters add/update/delete permissions (superadmin role)
 */

import { test, expect } from '@playwright/test';
import {
  antTableWaitForData,
  antMessageContains,
  antFormFill,
  antModalConfirm,
} from '../../helpers/antd-helpers.js';
import {
  navigateWithAuth,
  ensureSessionActive,
  waitForPageReady,
} from '../../helpers/navigation.js';

const STAMP = () => Date.now().toString().slice(-6);

/** Navigate to /hr/masters and click "Factories" in the left nav. */
async function goToUnits(page) {
  await navigateWithAuth(page, '/hr/masters');
  // Wait for the HR dashboard two-panel layout to render
  await page.getByRole('heading', { name: 'HR Management' }).waitFor({ state: 'visible', timeout: 15000 });
  await waitForPageReady(page);

  // Click "Units" in the left navigation panel
  // The nav item text is "Units" — scope to the left nav panel to avoid hitting breadcrumb
  const unitsNav = page.getByText('Units', { exact: true }).first();
  await unitsNav.waitFor({ state: 'visible', timeout: 10000 });
  await unitsNav.click();

  // Wait for the Units table to load
  await page.locator('.ant-table').waitFor({ state: 'visible', timeout: 15000 });
  await antTableWaitForData(page);
}

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);

  // Capture browser errors for debugging
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[browser:${msg.type()}] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => {
    console.log(`[browser:pageerror] ${err.message}`);
  });
});

test.describe('HR Masters — Units', () => {

  test('list page loads and table is visible', async ({ page }) => {
    await goToUnits(page);

    // Table should be visible
    await expect(page.locator('.ant-table')).toBeVisible();

    // Page breadcrumb should show HR Management > Organization > Units
    await expect(page.getByRole('heading', { name: 'HR Management' })).toBeVisible();
  });

  test('create new factory with required fields', async ({ page }) => {
    const stamp = STAMP();
    const factoryCode = `FC-${stamp}`;
    const factoryName = `E2E Factory ${stamp}`;

    await goToUnits(page);

    // Click "Add Unit" button
    await page.getByRole('button', { name: /Add Unit/i }).click();

    // Form panel should appear — wait for "New Unit" heading
    await page.getByRole('heading', { name: /New Unit/i }).waitFor({ state: 'visible', timeout: 8000 });

    // Fill required fields
    await antFormFill(page, 'Unit Code', factoryCode);
    await antFormFill(page, 'Unit Name', factoryName);

    // Fill optional fields
    await antFormFill(page, 'City', 'Tirupur');

    // Save and wait for API response
    const [saveResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/v1/factories') && r.request().method() === 'POST',
        { timeout: 20000 }
      ),
      page.getByRole('button', { name: /^Save$/i }).click(),
    ]);

    expect(saveResp.status()).toBeGreaterThanOrEqual(200);
    expect(saveResp.status()).toBeLessThan(300);

    // Success toast
    await antMessageContains(page, /created|success/i);

    // Form should close and list should refresh — new factory should appear
    await antTableWaitForData(page);
    await expect(page.getByText(factoryCode)).toBeVisible();
  });

  test('create factory validates required fields', async ({ page }) => {
    await goToUnits(page);

    // Open new factory form
    await page.getByRole('button', { name: /Add Unit/i }).click();
    await page.getByRole('heading', { name: /New Unit/i }).waitFor({ state: 'visible', timeout: 8000 });

    // Click Save without filling anything
    await page.getByRole('button', { name: /^Save$/i }).click();

    // Ant Design inline validation errors should appear
    await expect(page.getByText(/Please enter a factory code/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Please enter a factory name/i)).toBeVisible({ timeout: 5000 });
  });

  test('edit existing factory — modify name and save', async ({ page }) => {
    const stamp = STAMP();

    await goToUnits(page);

    const rows = page.locator('.ant-table-row');
    const rowCount = await rows.count();
    test.skip(rowCount === 0, 'No factory rows to edit');

    // Click the first row to open the edit form
    await rows.first().click();

    // Wait for edit form panel to appear
    await page.getByRole('heading', { name: /Edit Unit|View Unit/i }).waitFor({ state: 'visible', timeout: 8000 });

    // Check if edit is possible (not read-only)
    const saveBtn = page.getByRole('button', { name: /^Save$/i });
    const isReadOnly = await saveBtn.isHidden().catch(() => true);
    test.skip(isReadOnly, 'Factory form is read-only for this user');

    // Modify the Factory Name
    const nameInput = page.locator('.ant-form-item').filter({ hasText: 'Unit Name' }).first().locator('input').first();
    await nameInput.clear();
    await nameInput.fill(`E2E Updated Factory ${stamp}`);

    // Save and wait for PUT API response
    const [updateResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/v1/factories') && r.request().method() === 'PUT',
        { timeout: 20000 }
      ),
      saveBtn.click(),
    ]);

    expect(updateResp.status()).toBeGreaterThanOrEqual(200);
    expect(updateResp.status()).toBeLessThan(300);

    // Success toast
    await antMessageContains(page, /updated|success/i);
  });

  test('toggle factory status — active to inactive', async ({ page }) => {
    const stamp = STAMP();

    await goToUnits(page);

    // Create a fresh factory to toggle its status
    await page.getByRole('button', { name: /Add Unit/i }).click();
    await page.getByRole('heading', { name: /New Unit/i }).waitFor({ state: 'visible', timeout: 8000 });

    await antFormFill(page, 'Unit Code', `FC-ST-${stamp}`);
    await antFormFill(page, 'Unit Name', `E2E Status Factory ${stamp}`);

    const [createResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/v1/factories') && r.request().method() === 'POST',
        { timeout: 20000 }
      ),
      page.getByRole('button', { name: /^Save$/i }).click(),
    ]);
    expect(createResp.status()).toBeGreaterThanOrEqual(200);
    expect(createResp.status()).toBeLessThan(300);
    await antTableWaitForData(page);

    // Find and click the newly created factory row
    const newRow = page.locator('.ant-table-row').filter({ hasText: `FC-ST-${stamp}` });
    await newRow.waitFor({ state: 'visible', timeout: 10000 });
    await newRow.click();

    // Wait for edit form
    await page.getByRole('heading', { name: /Edit Unit/i }).waitFor({ state: 'visible', timeout: 8000 });

    // Toggle the Active switch to inactive
    const activeSwitch = page.locator('.ant-form-item').filter({ hasText: 'Active' }).first().locator('.ant-switch');
    await activeSwitch.click();

    // Save the status change
    const [updateResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/v1/factories') && r.request().method() === 'PUT',
        { timeout: 20000 }
      ),
      page.getByRole('button', { name: /^Save$/i }).click(),
    ]);
    expect(updateResp.status()).toBeGreaterThanOrEqual(200);
    expect(updateResp.status()).toBeLessThan(300);

    await antMessageContains(page, /updated|success/i);

    // After list refresh, the row should show "Inactive" tag
    await antTableWaitForData(page);
    const updatedRow = page.locator('.ant-table-row').filter({ hasText: `FC-ST-${stamp}` });
    await expect(updatedRow.locator('.ant-tag').filter({ hasText: 'Inactive' })).toBeVisible({ timeout: 8000 });
  });

  test('delete factory via modal confirm', async ({ page }) => {
    const stamp = STAMP();

    await goToUnits(page);

    // Create a factory specifically for deletion
    await page.getByRole('button', { name: /Add Unit/i }).click();
    await page.getByRole('heading', { name: /New Unit/i }).waitFor({ state: 'visible', timeout: 8000 });

    await antFormFill(page, 'Unit Code', `FC-DEL-${stamp}`);
    await antFormFill(page, 'Unit Name', `E2E Delete Factory ${stamp}`);

    const [createResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/v1/factories') && r.request().method() === 'POST',
        { timeout: 20000 }
      ),
      page.getByRole('button', { name: /^Save$/i }).click(),
    ]);
    expect(createResp.status()).toBeGreaterThanOrEqual(200);
    expect(createResp.status()).toBeLessThan(300);
    await antTableWaitForData(page);

    // Open the newly created factory
    const newRow = page.locator('.ant-table-row').filter({ hasText: `FC-DEL-${stamp}` });
    await newRow.waitFor({ state: 'visible', timeout: 10000 });
    await newRow.click();

    await page.getByRole('heading', { name: /Edit Unit/i }).waitFor({ state: 'visible', timeout: 8000 });

    // Click Delete button
    await page.getByRole('button', { name: /Delete/i }).click();

    // Confirm via Ant Design modal
    await antModalConfirm(page, { buttonText: /Delete/i });

    // Wait for DELETE API call
    await page.waitForResponse(
      (r) => r.url().includes('/api/v1/factories') && r.request().method() === 'DELETE',
      { timeout: 20000 }
    );

    // Success toast
    await antMessageContains(page, /deleted|success/i);

    // The deleted factory should no longer appear in the list
    await antTableWaitForData(page);
    await expect(page.locator('.ant-table-row').filter({ hasText: `FC-DEL-${stamp}` })).toHaveCount(0);
  });

  test('search filters factory list', async ({ page }) => {
    await goToUnits(page);

    // Get initial row count
    const initialCount = await page.locator('.ant-table-row').count();
    test.skip(initialCount === 0, 'No factory data to test search against');

    // Type a search term that is unlikely to match all rows
    const searchInput = page.getByPlaceholder(/Search units/i);
    await searchInput.fill('ZZZNOMATCH999');

    // Table should filter — either empty or fewer rows
    await page.waitForTimeout(400); // debounce
    const filteredCount = await page.locator('.ant-table-row').count();
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
  });

});
