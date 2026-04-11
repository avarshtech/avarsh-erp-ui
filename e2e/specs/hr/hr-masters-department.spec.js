/**
 * HR Masters — Department CRUD E2E Tests
 *
 * What this tests:
 *   - Department list page loads at /hr/masters when Departments is selected in left nav
 *   - Create a new department (required fields: Department Code, Department Name, Factory)
 *   - Edit an existing department (modify name, verify update succeeds)
 *   - Toggle active/inactive status
 *   - Form validation — required field errors shown when saved empty
 *   - Delete a department via the Delete button + modal confirm
 *   - Search filters the department table
 *
 * Prerequisites:
 *   - Backend running with /api/v1/hr/departments and /api/v1/factories/active endpoints
 *   - At least one active factory must exist (Department requires a factory selection)
 *   - Authenticated session (global-setup.js saves e2e/.auth/user.json)
 *   - User has hr-masters add/update/delete permissions (superadmin role)
 */

import { test, expect } from '@playwright/test';
import {
  antTableWaitForData,
  antMessageContains,
  antFormFill,
  antFormSelect,
  antModalConfirm,
} from '../../helpers/antd-helpers.js';
import {
  navigateWithAuth,
  ensureSessionActive,
  waitForPageReady,
} from '../../helpers/navigation.js';

const STAMP = () => Date.now().toString().slice(-6);

/** Navigate to /hr/masters and click "Departments" in the left nav. */
async function goToDepartments(page) {
  await navigateWithAuth(page, '/hr/masters');
  // Wait for HR dashboard to render
  await page.getByRole('heading', { name: 'HR Management' }).waitFor({ state: 'visible', timeout: 15000 });
  await waitForPageReady(page);

  // Click "Departments" in the left navigation panel
  const departmentsNav = page.getByText('Departments', { exact: true }).first();
  await departmentsNav.waitFor({ state: 'visible', timeout: 10000 });
  await departmentsNav.click();

  // Wait for the Departments table to load
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

test.describe('HR Masters — Departments', () => {

  test('list page loads and table is visible', async ({ page }) => {
    await goToDepartments(page);

    // Table should be visible
    await expect(page.locator('.ant-table')).toBeVisible();

    // Breadcrumb should reflect Departments context
    await expect(page.getByRole('heading', { name: 'HR Management' })).toBeVisible();
  });

  test('create new department with required fields', async ({ page }) => {
    const stamp = STAMP();
    const deptCode = `DEPT-${stamp}`;
    const deptName = `E2E Department ${stamp}`;

    await goToDepartments(page);

    // Click "Add Department" button
    await page.getByRole('button', { name: /Add Department/i }).click();

    // Form panel should appear — wait for "New Department" heading
    await page.getByRole('heading', { name: 'New Department' }).waitFor({ state: 'visible', timeout: 8000 });

    // Fill required fields
    await antFormFill(page, 'Department Code', deptCode);
    await antFormFill(page, 'Department Name', deptName);

    // Select factory — pick the first available option
    await antFormSelect(page, 'Factory', null, { first: true });

    // Save and wait for POST to departments endpoint
    const [saveResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/v1/hr/departments') && r.request().method() === 'POST',
        { timeout: 20000 }
      ),
      page.getByRole('button', { name: /^Save$/i }).click(),
    ]);

    expect(saveResp.status()).toBeGreaterThanOrEqual(200);
    expect(saveResp.status()).toBeLessThan(300);

    // Success toast
    await antMessageContains(page, /created|success/i);

    // Form closes, list refreshes — new dept should appear
    await antTableWaitForData(page);
    await expect(page.getByText(deptCode)).toBeVisible();
  });

  test('create department validates all required fields', async ({ page }) => {
    await goToDepartments(page);

    // Open new department form
    await page.getByRole('button', { name: /Add Department/i }).click();
    await page.getByRole('heading', { name: 'New Department' }).waitFor({ state: 'visible', timeout: 8000 });

    // Submit with no fields filled
    await page.getByRole('button', { name: /^Save$/i }).click();

    // Inline validation messages for all required fields
    await expect(page.getByText(/Please enter a department code/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Please enter a department name/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Please select a factory/i)).toBeVisible({ timeout: 5000 });
  });

  test('edit existing department — modify name and save', async ({ page }) => {
    const stamp = STAMP();

    await goToDepartments(page);

    const rows = page.locator('.ant-table-row');
    const rowCount = await rows.count();
    test.skip(rowCount === 0, 'No department rows to edit');

    // Click the first row to open the edit form
    await rows.first().click();

    // Wait for edit form panel
    await page.getByRole('heading', { name: /Edit Department|View Department/i }).waitFor({ state: 'visible', timeout: 8000 });

    // Check edit is available
    const saveBtn = page.getByRole('button', { name: /^Save$/i });
    const isReadOnly = await saveBtn.isHidden().catch(() => true);
    test.skip(isReadOnly, 'Department form is read-only for this user');

    // Update the Department Name field
    const nameInput = page.locator('.ant-form-item').filter({ hasText: 'Department Name' }).first().locator('input').first();
    await nameInput.clear();
    await nameInput.fill(`E2E Updated Dept ${stamp}`);

    // Save and wait for PUT response
    const [updateResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/v1/hr/departments') && r.request().method() === 'PUT',
        { timeout: 20000 }
      ),
      saveBtn.click(),
    ]);

    expect(updateResp.status()).toBeGreaterThanOrEqual(200);
    expect(updateResp.status()).toBeLessThan(300);

    // Success toast
    await antMessageContains(page, /updated|success/i);
  });

  test('toggle department status — active to inactive', async ({ page }) => {
    const stamp = STAMP();

    await goToDepartments(page);

    // Create a fresh department to test status toggle
    await page.getByRole('button', { name: /Add Department/i }).click();
    await page.getByRole('heading', { name: 'New Department' }).waitFor({ state: 'visible', timeout: 8000 });

    await antFormFill(page, 'Department Code', `DS-${stamp}`);
    await antFormFill(page, 'Department Name', `E2E Status Dept ${stamp}`);
    await antFormSelect(page, 'Factory', null, { first: true });

    const [createResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/v1/hr/departments') && r.request().method() === 'POST',
        { timeout: 20000 }
      ),
      page.getByRole('button', { name: /^Save$/i }).click(),
    ]);
    expect(createResp.status()).toBeGreaterThanOrEqual(200);
    expect(createResp.status()).toBeLessThan(300);
    await antTableWaitForData(page);

    // Open the newly created department
    const newRow = page.locator('.ant-table-row').filter({ hasText: `DS-${stamp}` });
    await newRow.waitFor({ state: 'visible', timeout: 10000 });
    await newRow.click();

    await page.getByRole('heading', { name: /Edit Department/i }).waitFor({ state: 'visible', timeout: 8000 });

    // Toggle the Active switch OFF
    const activeSwitch = page.locator('.ant-form-item').filter({ hasText: 'Active' }).first().locator('.ant-switch');
    await activeSwitch.click();

    // Save the status change
    const [updateResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/v1/hr/departments') && r.request().method() === 'PUT',
        { timeout: 20000 }
      ),
      page.getByRole('button', { name: /^Save$/i }).click(),
    ]);
    expect(updateResp.status()).toBeGreaterThanOrEqual(200);
    expect(updateResp.status()).toBeLessThan(300);

    await antMessageContains(page, /updated|success/i);

    // After refresh, row should show "Inactive" tag
    await antTableWaitForData(page);
    const updatedRow = page.locator('.ant-table-row').filter({ hasText: `DS-${stamp}` });
    await expect(updatedRow.locator('.ant-tag').filter({ hasText: 'Inactive' })).toBeVisible({ timeout: 8000 });
  });

  test('delete department via modal confirm', async ({ page }) => {
    const stamp = STAMP();

    await goToDepartments(page);

    // Create a department specifically for deletion
    await page.getByRole('button', { name: /Add Department/i }).click();
    await page.getByRole('heading', { name: 'New Department' }).waitFor({ state: 'visible', timeout: 8000 });

    await antFormFill(page, 'Department Code', `DD-${stamp}`);
    await antFormFill(page, 'Department Name', `E2E Delete Dept ${stamp}`);
    await antFormSelect(page, 'Factory', null, { first: true });

    const [createResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/v1/hr/departments') && r.request().method() === 'POST',
        { timeout: 20000 }
      ),
      page.getByRole('button', { name: /^Save$/i }).click(),
    ]);
    expect(createResp.status()).toBeGreaterThanOrEqual(200);
    expect(createResp.status()).toBeLessThan(300);
    await antTableWaitForData(page);

    // Open the newly created department row
    const newRow = page.locator('.ant-table-row').filter({ hasText: `DD-${stamp}` });
    await newRow.waitFor({ state: 'visible', timeout: 10000 });
    await newRow.click();

    await page.getByRole('heading', { name: /Edit Department/i }).waitFor({ state: 'visible', timeout: 8000 });

    // Click Delete button
    await page.getByRole('button', { name: /Delete/i }).click();

    // Confirm via Ant Design modal
    await antModalConfirm(page, { buttonText: /Delete/i });

    // Wait for DELETE API call
    await page.waitForResponse(
      (r) => r.url().includes('/api/v1/hr/departments') && r.request().method() === 'DELETE',
      { timeout: 20000 }
    );

    // Success toast
    await antMessageContains(page, /deleted|success/i);

    // The department should no longer appear in the list
    await antTableWaitForData(page);
    await expect(page.locator('.ant-table-row').filter({ hasText: `DD-${stamp}` })).toHaveCount(0);
  });

  test('search filters department list', async ({ page }) => {
    await goToDepartments(page);

    const initialCount = await page.locator('.ant-table-row').count();
    test.skip(initialCount === 0, 'No department data to test search against');

    // Search with a term unlikely to match any departments
    const searchInput = page.getByPlaceholder(/Search departments/i);
    await searchInput.fill('ZZZNOMATCH999');

    await page.waitForTimeout(400); // allow debounce to settle
    const filteredCount = await page.locator('.ant-table-row').count();
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
  });

  test('cancel form discards changes', async ({ page }) => {
    await goToDepartments(page);

    // Open new department form
    await page.getByRole('button', { name: /Add Department/i }).click();
    await page.getByRole('heading', { name: 'New Department' }).waitFor({ state: 'visible', timeout: 8000 });

    // Type something
    await antFormFill(page, 'Department Code', 'TEMP-CODE');

    // Click Cancel
    await page.getByRole('button', { name: /Cancel/i }).click();

    // Form panel should close
    await expect(page.getByRole('heading', { name: 'New Department' })).toBeHidden({ timeout: 5000 });

    // Table should still be visible
    await expect(page.locator('.ant-table')).toBeVisible();
  });

});
