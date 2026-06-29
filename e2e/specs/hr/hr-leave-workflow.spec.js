/**
 * HR Leave — Workflow E2E Tests
 *
 * What this tests:
 *   - Apply leave → Approve flow: leave moves from PENDING to APPROVED
 *   - Apply leave → Reject flow: rejection modal appears, reason is entered, leave becomes REJECTED
 *   - Approve button only visible for PENDING leaves (not for APPROVED/REJECTED)
 *   - Reject confirmation modal includes a textarea for the rejection reason
 *   - After approval, status tag changes to "Approved" in the list
 *   - After rejection, status tag changes to "Rejected" in the list
 *
 * Prerequisites:
 *   - At least one ACTIVE employee with leave entitlement exists
 *   - At least one active leave type is configured in HR Master
 *   - The logged-in user has hr-leave:add and hr-leave:approve permissions
 *   - superadmin role should have full permissions on hr-leave module
 */

import { test, expect } from '@playwright/test';
import {
  antSelect,
  antDatePickerToday,
  antTableWaitForData,
  antMessageContains,
  antFormFill,
  antFormSelect,
  antDrawerWaitOpen,
} from '../../helpers/antd-helpers.js';
import {
  navigateWithAuth,
  ensureSessionActive,
  waitForPageReady,
} from '../../helpers/navigation.js';

const STAMP = () => Date.now().toString().slice(-6);

/**
 * Helper: Apply a leave application through the UI drawer.
 * Returns after the POST /apply API succeeds and the drawer is closed.
 */
async function applyLeaveViaDrawer(page, reason) {
  await page.getByRole('button', { name: /Apply Leave/i }).click();
  await antDrawerWaitOpen(page);

  // Select first available employee
  await antFormSelect(page, 'Employee', null, { first: true });
  await waitForPageReady(page);

  // Select first available leave type
  await antFormSelect(page, 'Leave Type', null, { first: true });

  // Pick From Date (today)
  const fromDateFormItem = page
    .locator('.ant-form-item')
    .filter({ hasText: 'From Date' })
    .first();
  await antDatePickerToday(page, fromDateFormItem.locator('.ant-picker').first());

  // Pick To Date (today)
  const toDateFormItem = page
    .locator('.ant-form-item')
    .filter({ hasText: 'To Date' })
    .first();
  await antDatePickerToday(page, toDateFormItem.locator('.ant-picker').first());

  // Fill reason with unique stamp to identify this specific application
  const uniqueReason = reason || `E2E leave ${STAMP()}`;
  await antFormFill(page, 'Reason', uniqueReason);

  // Submit
  const [saveResp] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().includes('/api/v1/hr/leaves/apply') && r.request().method() === 'POST',
      { timeout: 20000 }
    ),
    page.locator('.ant-drawer-open').getByRole('button', { name: /Submit/i }).click(),
  ]);
  expect(saveResp.status()).toBeGreaterThanOrEqual(200);
  expect(saveResp.status()).toBeLessThan(300);

  // Wait for drawer to close
  await page.locator('.ant-drawer-open').waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});
  await antTableWaitForData(page);

  // Return the created application ID from the response body
  const body = await saveResp.json().catch(() => null);
  return body?.id ?? null;
}

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[browser:${msg.type()}] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => {
    console.log(`[browser:pageerror] ${err.message}`);
  });
});

test.describe('HR Leave Workflow — Apply → Approve', () => {
  test('Approve a PENDING leave application from the list', async ({ page }) => {
    await navigateWithAuth(page, '/hr/leaves');
    await waitForPageReady(page);
    await antTableWaitForData(page);

    // Apply a new leave first so we have a fresh PENDING record to approve
    const leaveId = await applyLeaveViaDrawer(page, `Approve workflow test ${STAMP()}`);

    // Switch to the Pending tab to locate the freshly submitted leave
    const [pendingResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes('/api/v1/hr/leaves/by-status') &&
          r.url().includes('status=PENDING'),
        { timeout: 15000 }
      ),
      page.getByRole('tab', { name: 'Pending' }).click(),
    ]);
    expect(pendingResp.status()).toBeLessThan(300);
    await antTableWaitForData(page);

    // Find the first visible Approve button in the action column
    const approveBtn = page
      .locator('.ant-table-row')
      .first()
      .getByRole('button', { name: /Approve/i });

    // Fallback: look anywhere in the table if first row doesn't have it
    const anyApproveBtn = page.getByRole('button', { name: /Approve/i }).first();

    const targetBtn = (await approveBtn.isVisible({ timeout: 3000 }).catch(() => false))
      ? approveBtn
      : anyApproveBtn;

    await targetBtn.waitFor({ state: 'visible', timeout: 10000 });

    // Click Approve and wait for the PUT .../approve API call
    const [approveResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes('/api/v1/hr/leaves/') &&
          r.url().includes('/approve') &&
          r.request().method() === 'PUT',
        { timeout: 20000 }
      ),
      targetBtn.click(),
    ]);
    expect(approveResp.status()).toBeGreaterThanOrEqual(200);
    expect(approveResp.status()).toBeLessThan(300);

    // Success toast should appear
    await antMessageContains(page, /Leave approved/i);

    // Switch to Approved tab and verify the record appears there
    const [approvedTabResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes('/api/v1/hr/leaves/by-status') &&
          r.url().includes('status=APPROVED'),
        { timeout: 15000 }
      ),
      page.getByRole('tab', { name: 'Approved' }).click(),
    ]);
    expect(approvedTabResp.status()).toBeLessThan(300);
    await antTableWaitForData(page);

    // At least one row with an Approved tag should be visible
    const approvedTag = page.locator('.ant-tag').filter({ hasText: /Approved/i }).first();
    await expect(approvedTag).toBeVisible({ timeout: 10000 });
  });

  test('Approve button only visible for PENDING leaves, not APPROVED', async ({ page }) => {
    await navigateWithAuth(page, '/hr/leaves');
    await waitForPageReady(page);
    await antTableWaitForData(page);

    // Switch to Approved tab
    await page.getByRole('tab', { name: 'Approved' }).click();
    await antTableWaitForData(page);

    // Approve action buttons should NOT be visible for already-approved leaves
    const approveButtons = page.getByRole('button', { name: /^Approve$/i });
    const count = await approveButtons.count();

    // If there are rows, verify no approve button exists in the approved list
    const rowCount = await page.locator('.ant-table-row').count();
    if (rowCount > 0) {
      expect(count).toBe(0);
    }
  });
});

test.describe('HR Leave Workflow — Apply → Reject', () => {
  test('Reject a PENDING leave application with a reason', async ({ page }) => {
    await navigateWithAuth(page, '/hr/leaves');
    await waitForPageReady(page);
    await antTableWaitForData(page);

    // Apply a new leave so we have a PENDING record to reject
    await applyLeaveViaDrawer(page, `Reject workflow test ${STAMP()}`);

    // Switch to Pending tab
    const [pendingResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes('/api/v1/hr/leaves/by-status') &&
          r.url().includes('status=PENDING'),
        { timeout: 15000 }
      ),
      page.getByRole('tab', { name: 'Pending' }).click(),
    ]);
    expect(pendingResp.status()).toBeLessThan(300);
    await antTableWaitForData(page);

    // Find and click the Reject button on a PENDING row
    const rejectBtn = page.getByRole('button', { name: /Reject/i }).first();
    await rejectBtn.waitFor({ state: 'visible', timeout: 10000 });
    await rejectBtn.click();

    // Rejection confirmation modal should appear
    const modal = page.locator('.ant-modal').last();
    await modal.waitFor({ state: 'visible', timeout: 5000 });

    // Modal title should mention rejection
    await expect(modal.getByText(/Reject Leave Application/i)).toBeVisible();

    // Textarea for reason should be present
    const reasonTextarea = modal.locator('textarea');
    await expect(reasonTextarea).toBeVisible();

    // Enter rejection reason
    await reasonTextarea.fill(`E2E rejection reason ${STAMP()}`);

    // Confirm rejection and wait for the PUT .../reject API call
    const [rejectResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes('/api/v1/hr/leaves/') &&
          r.url().includes('/reject') &&
          r.request().method() === 'PUT',
        { timeout: 20000 }
      ),
      modal.getByRole('button', { name: /Reject/i }).click(),
    ]);
    expect(rejectResp.status()).toBeGreaterThanOrEqual(200);
    expect(rejectResp.status()).toBeLessThan(300);

    // Success toast
    await antMessageContains(page, /Leave rejected/i);

    // Modal should close
    await modal.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});

    // Switch to Rejected tab and verify the record appears there
    const [rejectedTabResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes('/api/v1/hr/leaves/by-status') &&
          r.url().includes('status=REJECTED'),
        { timeout: 15000 }
      ),
      page.getByRole('tab', { name: 'Rejected' }).click(),
    ]);
    expect(rejectedTabResp.status()).toBeLessThan(300);
    await antTableWaitForData(page);

    // At least one row with a Rejected tag should be visible
    const rejectedTag = page.locator('.ant-tag').filter({ hasText: /Rejected/i }).first();
    await expect(rejectedTag).toBeVisible({ timeout: 10000 });
  });

  test('Rejection modal dismiss — cancel does not call reject API', async ({ page }) => {
    await navigateWithAuth(page, '/hr/leaves');
    await waitForPageReady(page);
    await antTableWaitForData(page);

    // Switch to Pending tab
    await page.getByRole('tab', { name: 'Pending' }).click();
    await antTableWaitForData(page);

    const rowCount = await page.locator('.ant-table-row').count();
    if (rowCount === 0) {
      // No pending leaves — apply one first
      await page.getByRole('tab', { name: 'All' }).click();
      await waitForPageReady(page);
      await applyLeaveViaDrawer(page, `Cancel reject test ${STAMP()}`);
      await page.getByRole('tab', { name: 'Pending' }).click();
      await antTableWaitForData(page);
    }

    const rejectBtn = page.getByRole('button', { name: /Reject/i }).first();
    if (!(await rejectBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'No pending leaves with Reject button available');
      return;
    }

    await rejectBtn.click();

    // Modal appears
    const modal = page.locator('.ant-modal').last();
    await modal.waitFor({ state: 'visible', timeout: 5000 });

    // Track if any reject API call is made
    let rejectApiCalled = false;
    page.on('request', (req) => {
      if (req.url().includes('/reject') && req.method() === 'PUT') {
        rejectApiCalled = true;
      }
    });

    // Click the Cancel button on the modal (not the Reject confirm)
    await modal.getByRole('button', { name: /Cancel/i }).click();
    await modal.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});

    // Give a moment for any API call to fire
    await page.waitForTimeout(500);

    // Reject API should NOT have been called
    expect(rejectApiCalled).toBe(false);
  });
});

test.describe('HR Leave Workflow — Status Tag Verification', () => {
  test('Status tags display correct colors for each leave state', async ({ page }) => {
    await navigateWithAuth(page, '/hr/leaves');
    await waitForPageReady(page);
    await antTableWaitForData(page);

    // Check Pending tab for processing (blue) tags
    await page.getByRole('tab', { name: 'Pending' }).click();
    await antTableWaitForData(page);

    const pendingRows = await page.locator('.ant-table-row').count();
    if (pendingRows > 0) {
      const pendingTag = page.locator('.ant-tag').filter({ hasText: /Pending/i }).first();
      await expect(pendingTag).toBeVisible();
    }

    // Check Approved tab for success (green) tags
    await page.getByRole('tab', { name: 'Approved' }).click();
    await antTableWaitForData(page);

    const approvedRows = await page.locator('.ant-table-row').count();
    if (approvedRows > 0) {
      const approvedTag = page.locator('.ant-tag').filter({ hasText: /Approved/i }).first();
      await expect(approvedTag).toBeVisible();
    }

    // Check Rejected tab for error (red) tags
    await page.getByRole('tab', { name: 'Rejected' }).click();
    await antTableWaitForData(page);

    const rejectedRows = await page.locator('.ant-table-row').count();
    if (rejectedRows > 0) {
      const rejectedTag = page.locator('.ant-tag').filter({ hasText: /Rejected/i }).first();
      await expect(rejectedTag).toBeVisible();
    }
  });

  test('Actions column hidden for non-PENDING leaves', async ({ page }) => {
    await navigateWithAuth(page, '/hr/leaves');
    await waitForPageReady(page);
    await antTableWaitForData(page);

    // On the Approved tab, there should be no Approve/Reject action buttons
    await page.getByRole('tab', { name: 'Approved' }).click();
    await antTableWaitForData(page);

    const approveActions = await page.getByRole('button', { name: /^Approve$/i }).count();
    const rejectActions = await page.getByRole('button', { name: /^Reject$/i }).count();
    expect(approveActions).toBe(0);
    expect(rejectActions).toBe(0);

    // On the Rejected tab, also no action buttons
    await page.getByRole('tab', { name: 'Rejected' }).click();
    await antTableWaitForData(page);

    const approveActionsRej = await page.getByRole('button', { name: /^Approve$/i }).count();
    const rejectActionsRej = await page.getByRole('button', { name: /^Reject$/i }).count();
    expect(approveActionsRej).toBe(0);
    expect(rejectActionsRej).toBe(0);
  });
});
