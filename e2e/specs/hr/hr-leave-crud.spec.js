/**
 * HR Leave — CRUD E2E Tests
 *
 * What this tests:
 *   - Leave Applications list page loads and table renders
 *   - Tab filtering (All / Pending / Approved / Rejected / Cancelled) switches API query
 *   - "Apply Leave" button opens the 480px drawer
 *   - Filling the drawer (employee, leave type, dates, reason) and submitting creates a leave application
 *   - Success toast appears after submission
 *   - Drawer closes and list refreshes after successful submission
 *   - Form validation: submit with empty fields shows inline errors
 *   - Leave Balances page loads at /hr/leaves/balances
 *
 * Prerequisites:
 *   - At least one ACTIVE employee exists in the system
 *   - At least one active leave type is configured in HR Master
 *   - The logged-in user has hr-leave:add and hr-leave:view permissions
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
  antDrawerClose,
} from '../../helpers/antd-helpers.js';
import {
  navigateWithAuth,
  ensureSessionActive,
  goToListPage,
  waitForPageReady,
} from '../../helpers/navigation.js';

const STAMP = () => Date.now().toString().slice(-6);

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

test.describe('HR Leave — List Page', () => {
  test('Leave Applications list page loads with table', async ({ page }) => {
    await navigateWithAuth(page, '/hr/leaves');
    await waitForPageReady(page);

    // Page header should be visible
    await expect(page.getByText('Leave Applications')).toBeVisible({ timeout: 10000 });

    // Table should be visible
    await page.locator('.ant-table').waitFor({ state: 'visible', timeout: 15000 });

    // Tab bar should show all expected tabs
    await expect(page.getByRole('tab', { name: 'All' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Pending' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Approved' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Rejected' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Cancelled' })).toBeVisible();
  });

  test('Tab filtering — Pending tab triggers filtered API call', async ({ page }) => {
    await navigateWithAuth(page, '/hr/leaves');
    await waitForPageReady(page);
    await page.locator('.ant-table').waitFor({ state: 'visible', timeout: 15000 });

    // Click Pending tab and verify API call includes status=PENDING
    const [response] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/v1/hr/leaves/by-status') && r.url().includes('status=PENDING'),
        { timeout: 15000 }
      ),
      page.getByRole('tab', { name: 'Pending' }).click(),
    ]);
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(300);
    await antTableWaitForData(page);
  });

  test('Tab filtering — Approved tab triggers filtered API call', async ({ page }) => {
    await navigateWithAuth(page, '/hr/leaves');
    await waitForPageReady(page);
    await page.locator('.ant-table').waitFor({ state: 'visible', timeout: 15000 });

    const [response] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/v1/hr/leaves/by-status') && r.url().includes('status=APPROVED'),
        { timeout: 15000 }
      ),
      page.getByRole('tab', { name: 'Approved' }).click(),
    ]);
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(300);
  });

  test('Tab filtering — Rejected tab triggers filtered API call', async ({ page }) => {
    await navigateWithAuth(page, '/hr/leaves');
    await waitForPageReady(page);
    await page.locator('.ant-table').waitFor({ state: 'visible', timeout: 15000 });

    const [response] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/v1/hr/leaves/by-status') && r.url().includes('status=REJECTED'),
        { timeout: 15000 }
      ),
      page.getByRole('tab', { name: 'Rejected' }).click(),
    ]);
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(300);
  });

  test('All tab loads without status filter in API call', async ({ page }) => {
    await navigateWithAuth(page, '/hr/leaves');

    // First click Pending to change state, then go back to All
    await page.locator('.ant-table').waitFor({ state: 'visible', timeout: 15000 });
    await page.getByRole('tab', { name: 'Pending' }).click();
    await waitForPageReady(page);

    const [response] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes('/api/v1/hr/leaves/by-status') && !r.url().includes('status='),
        { timeout: 15000 }
      ),
      page.getByRole('tab', { name: 'All' }).click(),
    ]);
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(300);
  });
});

test.describe('HR Leave — Apply Leave Drawer', () => {
  test('Apply Leave button opens 480px drawer', async ({ page }) => {
    await navigateWithAuth(page, '/hr/leaves');
    await waitForPageReady(page);

    await page.getByRole('button', { name: /Apply Leave/i }).click();
    const drawer = await antDrawerWaitOpen(page);

    // Drawer title should read "Apply Leave"
    await expect(page.locator('.ant-drawer-title')).toContainText('Apply Leave');

    // Drawer body should contain the Employee form field
    await expect(drawer.locator('.ant-form-item').filter({ hasText: 'Employee' })).toBeVisible();

    // Close the drawer cleanly
    await antDrawerClose(page);
    await page.locator('.ant-drawer-open').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  });

  test('Submit button inside drawer submits Cancel closes drawer without submitting', async ({ page }) => {
    await navigateWithAuth(page, '/hr/leaves');
    await waitForPageReady(page);

    await page.getByRole('button', { name: /Apply Leave/i }).click();
    await antDrawerWaitOpen(page);

    // Click Cancel button inside the drawer extra actions
    await page.locator('.ant-drawer-open').getByRole('button', { name: /Cancel/i }).click();

    // Drawer should close
    await page.locator('.ant-drawer-open').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    const isOpen = await page.locator('.ant-drawer-open').isVisible().catch(() => false);
    expect(isOpen).toBe(false);
  });

  test('Form validation shows inline errors on empty submit', async ({ page }) => {
    await navigateWithAuth(page, '/hr/leaves');
    await waitForPageReady(page);

    await page.getByRole('button', { name: /Apply Leave/i }).click();
    await antDrawerWaitOpen(page);

    // Try to submit without filling anything
    await page.locator('.ant-drawer-open').getByRole('button', { name: /Submit/i }).click();

    // Validation errors should appear (required field messages)
    await expect(
      page.locator('.ant-form-item-explain-error').first()
    ).toBeVisible({ timeout: 5000 });

    // Specific required messages
    const errors = page.locator('.ant-form-item-explain-error');
    const errorTexts = await errors.allTextContents();
    expect(
      errorTexts.some((t) => /employee|leave type|date|reason/i.test(t))
    ).toBeTruthy();
  });

  test('Apply Leave — fill drawer and submit (full flow)', async ({ page }) => {
    await navigateWithAuth(page, '/hr/leaves');
    await waitForPageReady(page);

    await page.getByRole('button', { name: /Apply Leave/i }).click();
    await antDrawerWaitOpen(page);

    // Select first available employee
    await antFormSelect(page, 'Employee', null, { first: true });

    // Wait briefly for leave balance fetch to complete (triggered by employee selection)
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

    // Fill reason
    await antFormFill(page, 'Reason', `E2E test leave reason ${STAMP()}`);

    // Submit and wait for the API response
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

    // Success toast should appear
    await antMessageContains(page, /Leave application submitted/i);

    // Drawer should close automatically after success
    await page.locator('.ant-drawer-open').waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});
    const isOpen = await page.locator('.ant-drawer-open').isVisible().catch(() => false);
    expect(isOpen).toBe(false);

    // Table should refresh (list API is called again)
    await antTableWaitForData(page);
  });
});

test.describe('HR Leave — Leave Balances Page', () => {
  test('Leave Balances page loads at /hr/leaves/balances', async ({ page }) => {
    await navigateWithAuth(page, '/hr/leaves/balances');
    await waitForPageReady(page);

    // Page header
    await expect(page.getByText('Leave Balances')).toBeVisible({ timeout: 10000 });

    // Year select should be visible
    await page.locator('.ant-select').first().waitFor({ state: 'visible', timeout: 5000 });

    // Factory select placeholder
    await expect(page.getByText('Select Factory')).toBeVisible();
  });

  test('Leave Balances — table renders after factory selection', async ({ page }) => {
    await navigateWithAuth(page, '/hr/leaves/balances');
    await waitForPageReady(page);

    // Table should be present (even if empty)
    await page.locator('.ant-table').waitFor({ state: 'visible', timeout: 15000 });

    // Select first factory to trigger employee + balance load
    const factorySelect = page.getByText('Select Factory').locator('xpath=ancestor::div[contains(@class,"ant-select")]').first();
    if (await factorySelect.isVisible().catch(() => false)) {
      await antSelect(page, factorySelect, null, { first: true });
      await waitForPageReady(page);
      // Table should still be visible after selection
      await page.locator('.ant-table').waitFor({ state: 'visible', timeout: 10000 });
    }
  });
});
