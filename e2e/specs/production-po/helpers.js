// Shared utilities for the production-po specs.
import { expect } from '@playwright/test';
import { formField } from '../../helpers/ui-master.js';

/**
 * Pick an AntD Select option by CONTAINS-text (the shared selectByLabel matches
 * exact option titles, which fails for composite labels like
 * "ORD/0003 · AV-AW26-001 · Next PLC").
 */
export async function selectOptionByText(page, label, text, scope = page) {
  const field = formField(page, label, scope);
  await field.locator('.ant-select').first().click();
  const option = page.locator('.ant-select-dropdown:visible .ant-select-item-option', { hasText: text }).first();
  await option.waitFor({ state: 'visible', timeout: 10000 });
  await option.click();
  await page.waitForTimeout(300);
}

/**
 * Fill an AntD date picker by its form label with today's date, typed in the
 * app's display format (DD-MMM-YYYY) — robust across AntD picker-footer changes.
 */
export async function pickToday(page, label, scope = page) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const value = `${String(now.getDate()).padStart(2, '0')}-${months[now.getMonth()]}-${now.getFullYear()}`;
  const field = formField(page, label, scope);
  const input = field.locator('.ant-picker input').first();
  await input.click();
  await input.fill(value);
  await input.press('Enter');
  await page.waitForTimeout(200);
  await page.keyboard.press('Escape'); // ensure the dropdown is closed
  await page.waitForTimeout(150);
}

/** Confirm the "Submit despite warnings?" modal when it appears. */
export async function submitAnywayIfAsked(page) {
  const btn = page.getByRole('button', { name: /Submit anyway/i });
  try {
    await btn.waitFor({ state: 'visible', timeout: 3000 });
    await btn.click();
  } catch {
    /* no warning modal — nothing to confirm */
  }
}

/** Apply the bulk rate on the Size-Color Matrix tab. */
export async function applyBulkRate(page, rate) {
  await page.getByRole('tab', { name: /Size-Color Matrix/i }).click();
  const rateInput = page.locator('input[placeholder="Rate / Pc"]');
  await rateInput.waitFor({ state: 'visible' });
  await rateInput.fill(String(rate));
  await page.getByRole('button', { name: /Apply to all/i }).click();
  await page.waitForTimeout(300);
}

/** True when the list already shows an Approved row matching `search`. */
export async function approvedRowExists(page, search) {
  const searchBox = page.locator('input[placeholder*="Search"]').first();
  await searchBox.fill(search);
  await page.waitForTimeout(1200); // debounced search
  const rows = page.locator('.ant-table-row', { hasText: search });
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    if (await rows.nth(i).locator('.ant-tag', { hasText: /Approved/i }).count()) return true;
  }
  return false;
}

export async function expectSuccessToast(page, pattern) {
  await expect(page.locator('.ant-message-notice', { hasText: pattern }).first())
    .toBeVisible({ timeout: 15000 });
}
