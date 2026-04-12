/**
 * Cutting Module — Data Entry via Browser Forms
 * Attempts to create records through each form, captures errors.
 */
import { test, expect } from '@playwright/test';
import { navigateWithAuth, ensureSessionActive } from '../../helpers/navigation.js';

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
  page.on('response', resp => { if (resp.status() >= 400 && resp.url().includes('/api/v1/cutting')) console.log(`API ${resp.status()}: ${resp.url()} ${resp.request().method()}`); });
});

test.describe('Cutting — Create Data via Forms', () => {

  test('Lay Audit — create via form', async ({ page }) => {
    await navigateWithAuth(page, '/cutting/lay-audit/new');
    await page.waitForLoadState('networkidle');

    // Wait for form to fully render including lazy-loaded selects
    await page.waitForSelector('.ant-form', { timeout: 10000 });
    await page.waitForTimeout(3000);

    // Debug: count all ant-select elements
    const selectCount = await page.locator('.ant-select').count();
    console.log(`Lay Audit: Found ${selectCount} ant-select elements`);

    // Try clicking the FIRST select (Cut Order Plan)
    const firstSelect = page.locator('.ant-select').first();
    if (selectCount > 0) {
      await firstSelect.click();
      await page.waitForTimeout(500);

      // Type in the search
      await page.keyboard.type('COP', { delay: 100 });
      await page.waitForTimeout(2000);

      // Check if dropdown appeared
      const dropdown = page.locator('.ant-select-dropdown:visible');
      const dropdownVisible = await dropdown.isVisible().catch(() => false);
      console.log(`Dropdown visible: ${dropdownVisible}`);

      if (dropdownVisible) {
        const optCount = await dropdown.locator('.ant-select-item-option').count();
        console.log(`Options found: ${optCount}`);
        if (optCount > 0) {
          await dropdown.locator('.ant-select-item-option').first().click();
          console.log('Selected first plan option');
          await page.waitForTimeout(1000);
        }
      }

      // Close dropdown if still open
      await page.keyboard.press('Escape');
    }

    // Fill Lay No
    await page.locator('.ant-input-number-input').first().fill('1');

    // Fill Lay Date (click the date picker, then select today)
    const datePickers = page.locator('.ant-picker');
    const dpCount = await datePickers.count();
    console.log(`Date pickers: ${dpCount}`);
    if (dpCount > 0) {
      await datePickers.first().click();
      await page.waitForTimeout(500);
      // Click "Today" or the highlighted day
      const todayBtn = page.locator('.ant-picker-today-btn, .ant-picker-cell-today').first();
      if (await todayBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await todayBtn.click();
      }
      await page.waitForTimeout(300);
    }

    // Fill dimensions
    const numInputs = page.locator('.ant-input-number-input');
    const numCount = await numInputs.count();
    if (numCount >= 2) await numInputs.nth(1).fill('8.200');
    if (numCount >= 3) await numInputs.nth(2).fill('0.095');
    if (numCount >= 4) await numInputs.nth(3).fill('1.550');

    // Remarks
    const textarea = page.locator('textarea').first();
    if (await textarea.isVisible({ timeout: 1000 }).catch(() => false)) {
      await textarea.fill('Lay 1 created via Playwright test');
    }

    await page.screenshot({ path: 'e2e-results/lay-audit-filled.png', fullPage: true });

    // Click Save and capture API response
    const saveBtn = page.getByRole('button', { name: /save/i }).first();
    const [apiResp] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/v1/cutting/lay-audits') && r.request().method() === 'POST', { timeout: 10000 }).catch(() => null),
      saveBtn.click(),
    ]);

    if (apiResp) {
      const status = apiResp.status();
      const body = await apiResp.text().catch(() => '');
      console.log(`Lay Audit save: HTTP ${status}`);
      if (status >= 400) console.log(`Error: ${body.substring(0, 500)}`);
      if (status < 300) {
        // Should redirect to list
        await page.waitForTimeout(2000);
        console.log(`After save URL: ${page.url()}`);
      }
    } else {
      const errors = await page.locator('.ant-form-item-explain-error').allTextContents();
      console.log('Validation errors:', errors);
      await page.screenshot({ path: 'e2e-results/lay-audit-errors.png', fullPage: true });
    }
  });

  test('Cutting Report — create via form', async ({ page }) => {
    await navigateWithAuth(page, '/cutting/report/new');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.ant-form', { timeout: 10000 });
    await page.waitForTimeout(3000);

    const selectCount = await page.locator('.ant-select').count();
    console.log(`Cutting Report: Found ${selectCount} ant-select elements`);

    // Select plan
    if (selectCount > 0) {
      await page.locator('.ant-select').first().click();
      await page.waitForTimeout(500);
      await page.keyboard.type('COP', { delay: 100 });
      await page.waitForTimeout(2000);
      const opt = page.locator('.ant-select-dropdown:visible .ant-select-item-option').first();
      if (await opt.isVisible({ timeout: 3000 }).catch(() => false)) {
        await opt.click();
        console.log('Selected plan');
        await page.waitForTimeout(1000);
      }
    }

    // Fill consumption, width, realize
    const numInputs = page.locator('.ant-input-number-input');
    const numCount = await numInputs.count();
    console.log(`Number inputs: ${numCount}`);
    for (let i = 0; i < Math.min(numCount, 3); i++) {
      await numInputs.nth(i).fill(['2.150', '155', '92'][i] || '0');
    }

    await page.screenshot({ path: 'e2e-results/cutting-report-filled.png', fullPage: true });

    // Save
    const saveBtn = page.getByRole('button', { name: /save/i }).first();
    const [apiResp] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/v1/cutting/reports') && r.request().method() === 'POST', { timeout: 10000 }).catch(() => null),
      saveBtn.click(),
    ]);

    if (apiResp) {
      console.log(`Cutting Report save: HTTP ${apiResp.status()}`);
      if (apiResp.status() >= 400) console.log(`Error: ${(await apiResp.text().catch(() => '')).substring(0, 500)}`);
    } else {
      const errors = await page.locator('.ant-form-item-explain-error').allTextContents();
      console.log('Validation errors:', errors);
    }
  });

  test('Panel Issue — create via form', async ({ page }) => {
    await navigateWithAuth(page, '/cutting/panel-issue/new');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.ant-form', { timeout: 10000 });
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'e2e-results/panel-issue-empty.png', fullPage: true });

    const selectCount = await page.locator('.ant-select').count();
    console.log(`Panel Issue: Found ${selectCount} selects`);

    // Select plan
    if (selectCount > 0) {
      await page.locator('.ant-select').first().click();
      await page.waitForTimeout(500);
      await page.keyboard.type('COP', { delay: 100 });
      await page.waitForTimeout(2000);
      const opt = page.locator('.ant-select-dropdown:visible .ant-select-item-option').first();
      if (await opt.isVisible({ timeout: 3000 }).catch(() => false)) {
        await opt.click();
        await page.waitForTimeout(1000);
      }
    }

    // Select process (second select should be External Process)
    if (selectCount > 1) {
      await page.locator('.ant-select').nth(1).click();
      await page.waitForTimeout(500);
      const processOpt = page.locator('.ant-select-dropdown:visible .ant-select-item-option').first();
      if (await processOpt.isVisible({ timeout: 2000 }).catch(() => false)) {
        await processOpt.click();
      }
    }

    await page.screenshot({ path: 'e2e-results/panel-issue-filled.png', fullPage: true });
  });

  test('Wastage — create via form', async ({ page }) => {
    await navigateWithAuth(page, '/cutting/wastage/new');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.ant-form', { timeout: 10000 });
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'e2e-results/wastage-empty.png', fullPage: true });

    const selectCount = await page.locator('.ant-select').count();
    console.log(`Wastage: Found ${selectCount} selects`);

    // Fill numeric fields
    const numInputs = page.locator('.ant-input-number-input');
    const numCount = await numInputs.count();
    console.log(`Wastage number inputs: ${numCount}`);
  });

});
