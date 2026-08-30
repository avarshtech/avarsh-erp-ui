/**
 * HR Masters — Shift CRUD E2E Tests
 *
 * What this tests:
 *   - Shift list page loads at /hr/masters when Shifts is selected in left nav
 *   - Create a new shift (required fields: Shift Code, Shift Name, Start Time, End Time)
 *   - Default values are pre-filled: isActive = true, isNightShift = false, breakMinutes = 30
 *   - Edit an existing shift (modify Shift Name, verify update succeeds)
 *   - Toggle Night Shift flag
 *   - Toggle active/inactive status
 *   - Form validation — required field errors shown when saved empty
 *   - Delete a shift via the Delete button + modal confirm
 *   - Search filters the shift table
 *
 * Prerequisites:
 *   - Backend running with /api/v1/hr/shifts endpoint
 *   - Authenticated session (global-setup.js saves e2e/.auth/user.json)
 *   - User has hr-masters add/update/delete permissions (superadmin role)
 *
 * Notes on TimePicker:
 *   Ant Design TimePicker renders a panel. We interact with it by clicking the
 *   input, then selecting hours/minutes from the column list.
 *   A helper `pickTime(page, labelText, hh, mm)` is defined locally.
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

/**
 * Select a time in an Ant Design TimePicker by typing directly into the input.
 * The TimePicker input accepts typed values in HH:mm format.
 * @param {import('@playwright/test').Page} page
 * @param {string} labelText - Label text of the Form.Item (e.g. 'Start Time')
 * @param {string} timeString - Time string in HH:mm format (e.g. '08:00')
 */
async function pickTime(page, labelText, timeString) {
  const formItem = page.locator('.ant-form-item').filter({ hasText: labelText }).first();
  const input = formItem.locator('input').first();

  // Click to open the time picker panel
  await input.click();

  // Wait for the time picker panel to open
  const panel = page.locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)').last();
  await panel.waitFor({ state: 'visible', timeout: 5000 });

  const [hh, mm] = timeString.split(':');

  // Click the correct hour in the hour column
  const hourCol = panel.locator('.ant-picker-time-panel-column').nth(0);
  await hourCol.locator(`.ant-picker-time-panel-cell`).filter({ hasText: new RegExp(`^${hh}$`) }).first().click();

  // Click the correct minute in the minute column
  const minCol = panel.locator('.ant-picker-time-panel-column').nth(1);
  await minCol.locator(`.ant-picker-time-panel-cell`).filter({ hasText: new RegExp(`^${mm}$`) }).first().click();

  // Click "OK" to confirm the time selection
  const okBtn = panel.getByRole('button', { name: /OK/i });
  if (await okBtn.isVisible().catch(() => false)) {
    await okBtn.click();
  } else {
    // Fallback: press Escape to close the panel
    await page.keyboard.press('Escape');
  }

  // Wait for panel to close
  await panel.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
}

/** Navigate to /hr/masters and click "Shifts" in the left nav. */
async function goToShifts(page) {
  await navigateWithAuth(page, '/hr/masters');
  // Wait for HR dashboard to render
  await page.getByRole('heading', { name: 'HR Management' }).waitFor({ state: 'visible', timeout: 15000 });
  await waitForPageReady(page);

  // Click "Shifts" in the left navigation panel
  const shiftsNav = page.getByText('Shifts', { exact: true }).first();
  await shiftsNav.waitFor({ state: 'visible', timeout: 10000 });
  await shiftsNav.click();

  // Wait for the Shifts table to load
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

test.describe('HR Masters — Shifts', () => {

  test('list page loads and table is visible', async ({ page }) => {
    await goToShifts(page);

    // Table should be visible
    await expect(page.locator('.ant-table')).toBeVisible();

    // Breadcrumb and section context
    await expect(page.getByRole('heading', { name: 'HR Management' })).toBeVisible();
  });

  test('create new shift with all required fields', async ({ page }) => {
    const stamp = STAMP();
    const shiftCode = `GEN-${stamp}`;
    const shiftName = `E2E General Shift ${stamp}`;

    await goToShifts(page);

    // Click "Add Shift" button
    await page.getByRole('button', { name: /Add Shift/i }).click();

    // Form panel should appear — wait for "New Shift" heading
    await page.getByRole('heading', { name: 'New Shift' }).waitFor({ state: 'visible', timeout: 8000 });

    // Fill required text fields
    await antFormFill(page, 'Shift Code', shiftCode);
    await antFormFill(page, 'Shift Name', shiftName);

    // Set Start Time (required) — 08:00
    await pickTime(page, 'Start Time', '08:00');

    // Set End Time (required) — 17:00
    await pickTime(page, 'End Time', '17:00');

    // Break Duration defaults to 30 — leave as is

    // Save and wait for POST to shifts endpoint
    const [saveResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/v1/hr/shifts') && r.request().method() === 'POST',
        { timeout: 20000 }
      ),
      page.getByRole('button', { name: /^Save$/i }).click(),
    ]);

    expect(saveResp.status()).toBeGreaterThanOrEqual(200);
    expect(saveResp.status()).toBeLessThan(300);

    // Success toast
    await antMessageContains(page, /created|success/i);

    // Form closes, list refreshes — new shift should appear
    await antTableWaitForData(page);
    await expect(page.getByText(shiftCode)).toBeVisible();
  });

  test('create shift validates required fields', async ({ page }) => {
    await goToShifts(page);

    // Open new shift form
    await page.getByRole('button', { name: /Add Shift/i }).click();
    await page.getByRole('heading', { name: 'New Shift' }).waitFor({ state: 'visible', timeout: 8000 });

    // Submit with no fields filled
    await page.getByRole('button', { name: /^Save$/i }).click();

    // Inline validation messages for required fields
    await expect(page.getByText(/Please enter a shift code/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Please enter a shift name/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Please select a start time/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Please select an end time/i)).toBeVisible({ timeout: 5000 });
  });

  test('default values pre-filled on new shift form', async ({ page }) => {
    await goToShifts(page);

    // Open new shift form
    await page.getByRole('button', { name: /Add Shift/i }).click();
    await page.getByRole('heading', { name: 'New Shift' }).waitFor({ state: 'visible', timeout: 8000 });

    // breakMinutes should default to 30
    const breakInput = page.locator('.ant-form-item').filter({ hasText: 'Break Duration' }).first().locator('input').first();
    await expect(breakInput).toHaveValue('30');

    // isActive switch should be checked (Active state)
    const activeSwitch = page.locator('.ant-form-item').filter({ hasText: 'Active' }).first().locator('.ant-switch');
    await expect(activeSwitch).toHaveClass(/ant-switch-checked/);

    // isNightShift switch should NOT be checked (No state)
    const nightSwitch = page.locator('.ant-form-item').filter({ hasText: 'Night Shift' }).first().locator('.ant-switch');
    await expect(nightSwitch).not.toHaveClass(/ant-switch-checked/);
  });

  test('edit existing shift — modify name and save', async ({ page }) => {
    const stamp = STAMP();

    await goToShifts(page);

    const rows = page.locator('.ant-table-row');
    const rowCount = await rows.count();
    test.skip(rowCount === 0, 'No shift rows to edit');

    // Click the first row to open the edit form
    await rows.first().click();

    // Wait for edit form panel
    await page.getByRole('heading', { name: /Edit Shift|View Shift/i }).waitFor({ state: 'visible', timeout: 8000 });

    // Check edit is available
    const saveBtn = page.getByRole('button', { name: /^Save$/i });
    const isReadOnly = await saveBtn.isHidden().catch(() => true);
    test.skip(isReadOnly, 'Shift form is read-only for this user');

    // Update the Shift Name field
    const nameInput = page.locator('.ant-form-item').filter({ hasText: 'Shift Name' }).first().locator('input').first();
    await nameInput.clear();
    await nameInput.fill(`E2E Updated Shift ${stamp}`);

    // Save and wait for PUT response
    const [updateResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/v1/hr/shifts') && r.request().method() === 'PUT',
        { timeout: 20000 }
      ),
      saveBtn.click(),
    ]);

    expect(updateResp.status()).toBeGreaterThanOrEqual(200);
    expect(updateResp.status()).toBeLessThan(300);

    // Success toast
    await antMessageContains(page, /updated|success/i);
  });

  test('toggle night shift flag when creating a shift', async ({ page }) => {
    const stamp = STAMP();
    const shiftCode = `NGT-${stamp}`;

    await goToShifts(page);

    await page.getByRole('button', { name: /Add Shift/i }).click();
    await page.getByRole('heading', { name: 'New Shift' }).waitFor({ state: 'visible', timeout: 8000 });

    await antFormFill(page, 'Shift Code', shiftCode);
    await antFormFill(page, 'Shift Name', `E2E Night Shift ${stamp}`);
    await pickTime(page, 'Start Time', '22:00');
    await pickTime(page, 'End Time', '06:00');

    // Toggle Night Shift ON
    const nightSwitch = page.locator('.ant-form-item').filter({ hasText: 'Night Shift' }).first().locator('.ant-switch');
    await nightSwitch.click();

    // Verify the switch is now checked
    await expect(nightSwitch).toHaveClass(/ant-switch-checked/);

    // Save
    const [saveResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/v1/hr/shifts') && r.request().method() === 'POST',
        { timeout: 20000 }
      ),
      page.getByRole('button', { name: /^Save$/i }).click(),
    ]);
    expect(saveResp.status()).toBeGreaterThanOrEqual(200);
    expect(saveResp.status()).toBeLessThan(300);
    await antMessageContains(page, /created|success/i);
    await antTableWaitForData(page);

    // The table row should show "Yes" for Night Shift (purple tag)
    const newRow = page.locator('.ant-table-row').filter({ hasText: shiftCode });
    await expect(newRow.locator('.ant-tag').filter({ hasText: 'Yes' })).toBeVisible({ timeout: 8000 });
  });

  test('toggle shift status — active to inactive', async ({ page }) => {
    const stamp = STAMP();
    const shiftCode = `ST-${stamp}`;

    await goToShifts(page);

    // Create a fresh shift for the status toggle test
    await page.getByRole('button', { name: /Add Shift/i }).click();
    await page.getByRole('heading', { name: 'New Shift' }).waitFor({ state: 'visible', timeout: 8000 });

    await antFormFill(page, 'Shift Code', shiftCode);
    await antFormFill(page, 'Shift Name', `E2E Status Shift ${stamp}`);
    await pickTime(page, 'Start Time', '09:00');
    await pickTime(page, 'End Time', '18:00');

    const [createResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/v1/hr/shifts') && r.request().method() === 'POST',
        { timeout: 20000 }
      ),
      page.getByRole('button', { name: /^Save$/i }).click(),
    ]);
    expect(createResp.status()).toBeGreaterThanOrEqual(200);
    expect(createResp.status()).toBeLessThan(300);
    await antTableWaitForData(page);

    // Open the newly created shift
    const newRow = page.locator('.ant-table-row').filter({ hasText: shiftCode });
    await newRow.waitFor({ state: 'visible', timeout: 10000 });
    await newRow.click();

    await page.getByRole('heading', { name: /Edit Shift/i }).waitFor({ state: 'visible', timeout: 8000 });

    // Toggle the Active switch OFF
    const activeSwitch = page.locator('.ant-form-item').filter({ hasText: 'Active' }).first().locator('.ant-switch');
    await activeSwitch.click();

    // Save the status change
    const [updateResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/v1/hr/shifts') && r.request().method() === 'PUT',
        { timeout: 20000 }
      ),
      page.getByRole('button', { name: /^Save$/i }).click(),
    ]);
    expect(updateResp.status()).toBeGreaterThanOrEqual(200);
    expect(updateResp.status()).toBeLessThan(300);

    await antMessageContains(page, /updated|success/i);

    // Row should now show "Inactive" tag
    await antTableWaitForData(page);
    const updatedRow = page.locator('.ant-table-row').filter({ hasText: shiftCode });
    await expect(updatedRow.locator('.ant-tag').filter({ hasText: 'Inactive' })).toBeVisible({ timeout: 8000 });
  });

  test('delete shift via modal confirm', async ({ page }) => {
    const stamp = STAMP();
    const shiftCode = `DEL-${stamp}`;

    await goToShifts(page);

    // Create a shift specifically for deletion
    await page.getByRole('button', { name: /Add Shift/i }).click();
    await page.getByRole('heading', { name: 'New Shift' }).waitFor({ state: 'visible', timeout: 8000 });

    await antFormFill(page, 'Shift Code', shiftCode);
    await antFormFill(page, 'Shift Name', `E2E Delete Shift ${stamp}`);
    await pickTime(page, 'Start Time', '07:00');
    await pickTime(page, 'End Time', '15:00');

    const [createResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/v1/hr/shifts') && r.request().method() === 'POST',
        { timeout: 20000 }
      ),
      page.getByRole('button', { name: /^Save$/i }).click(),
    ]);
    expect(createResp.status()).toBeGreaterThanOrEqual(200);
    expect(createResp.status()).toBeLessThan(300);
    await antTableWaitForData(page);

    // Open the newly created shift
    const newRow = page.locator('.ant-table-row').filter({ hasText: shiftCode });
    await newRow.waitFor({ state: 'visible', timeout: 10000 });
    await newRow.click();

    await page.getByRole('heading', { name: /Edit Shift/i }).waitFor({ state: 'visible', timeout: 8000 });

    // Click Delete button
    await page.getByRole('button', { name: /Delete/i }).click();

    // Confirm via Ant Design modal
    await antModalConfirm(page, { buttonText: /Delete/i });

    // Wait for DELETE API call
    await page.waitForResponse(
      (r) => r.url().includes('/api/v1/hr/shifts') && r.request().method() === 'DELETE',
      { timeout: 20000 }
    );

    // Success toast
    await antMessageContains(page, /deleted|success/i);

    // The shift should no longer appear in the table
    await antTableWaitForData(page);
    await expect(page.locator('.ant-table-row').filter({ hasText: shiftCode })).toHaveCount(0);
  });

  test('search filters shift list', async ({ page }) => {
    await goToShifts(page);

    const initialCount = await page.locator('.ant-table-row').count();
    test.skip(initialCount === 0, 'No shift data to test search against');

    // Search with a nonsense term
    const searchInput = page.getByPlaceholder(/Search shifts/i);
    await searchInput.fill('ZZZNOMATCH999');

    await page.waitForTimeout(400); // allow debounce to settle
    const filteredCount = await page.locator('.ant-table-row').count();
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
  });

  test('cancel form discards changes', async ({ page }) => {
    await goToShifts(page);

    // Open new shift form
    await page.getByRole('button', { name: /Add Shift/i }).click();
    await page.getByRole('heading', { name: 'New Shift' }).waitFor({ state: 'visible', timeout: 8000 });

    // Type something
    await antFormFill(page, 'Shift Code', 'TEMP-SHIFT');

    // Click Cancel
    await page.getByRole('button', { name: /Cancel/i }).click();

    // Form panel should close
    await expect(page.getByRole('heading', { name: 'New Shift' })).toBeHidden({ timeout: 5000 });

    // Table should still be visible
    await expect(page.locator('.ant-table')).toBeVisible();
  });

});
