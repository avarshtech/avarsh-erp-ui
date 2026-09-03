/**
 * Costing — UI: List, Filters, Form Calculations & Create-via-UI
 *
 * What this tests (real browser DOM — the user-facing path):
 *   - List page loads with the key columns
 *   - Status filter fires a /cost-sheets/search request carrying the status param
 *   - New form renders Section A (General Details)
 *   - IN-BROWSER calculation wiring: a fabric row's Net Cost cell updates to the
 *     formula result as Qty/Price/Allowance/Wastage are typed, and the Cost Summary
 *     reacts to agent% / profit% — proving the form wires inputs → formula → display
 *   - Create a Draft through the form (buyer + style) → POST 200 → navigates to list
 *   - Submitting an empty form surfaces the required-field validation
 *
 * Selectors: AntD Form sets each control's id to its Form.Item name (#buyerId, #styleNo).
 * Row sections are AntD Tables with placeholder-based cell inputs (Qty / Price / %).
 */

import { test, expect } from '@playwright/test';
import { antSelect, antTableWaitForData } from '../../helpers/antd-helpers.js';
import { ensureSessionActive, goToListPage, navigateWithAuth } from '../../helpers/navigation.js';
import { formatCurrency } from '../../../src/utils/costingConstants.js';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { stylePayload } from '../../helpers/test-data.js';

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
  page.on('pageerror', (err) => console.log(`[browser:pageerror] ${err.message}`));
});

/** Pick an option in a form-level Select identified by its #id (AntD name → id). */
async function pickFormSelect(page, idSelector, optionText) {
  await antSelect(page, page.locator(idSelector), optionText, { first: !optionText });
}

test.describe('Costing — List & Filters', () => {
  test('List loads with the key columns', async ({ page }) => {
    await goToListPage(page, '/costing/list');
    await antTableWaitForData(page);

    await expect(page.locator('.ant-table').first()).toBeVisible();
    for (const col of ['Costing ID', 'Buyer', 'Style #', 'Total Price', 'Status']) {
      await expect(page.getByRole('columnheader', { name: col, exact: true })).toBeVisible();
    }
  });

  test('Status filter fires a search request carrying status=', async ({ page }) => {
    await goToListPage(page, '/costing/list');
    await antTableWaitForData(page);

    const statusSelect = page.locator('.ant-select').filter({ hasText: 'Status' }).first();
    const [req] = await Promise.all([
      page.waitForRequest(
        (r) => r.url().includes('/cost-sheets/search') && /[?&]status=/.test(r.url()),
        { timeout: 10000 },
      ),
      (async () => {
        await statusSelect.click();
        const dd = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
        await dd.waitFor({ state: 'visible' });
        await dd.locator('.ant-select-item-option').filter({ hasText: 'Approved' }).click();
      })(),
    ]);
    expect(req.url()).toMatch(/[?&]status=Approved/);
  });
});

test.describe('Costing — Form: Section A & Calculations', () => {
  test('New form renders the General Details fields', async ({ page }) => {
    await navigateWithAuth(page, '/costing/new');
    await page.locator('#buyerId').waitFor({ state: 'visible', timeout: 15000 });

    await expect(page.locator('#buyerId')).toBeVisible();
    await expect(page.locator('#styleNo')).toBeVisible();
    await expect(page.locator('#currency')).toBeVisible();
    await expect(page.locator('#quoteCurrency')).toBeVisible();
    // header action buttons
    await expect(page.getByRole('button', { name: /Save as Draft/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Submit/i })).toBeVisible();
  });

  test('Fabric Net Cost cell and Cost Summary update live as inputs change', async ({ page }) => {
    await navigateWithAuth(page, '/costing/new');
    await page.locator('#buyerId').waitFor({ state: 'visible', timeout: 15000 });

    // Add a fabric row
    await page.getByRole('button', { name: /Add Fabric/i }).click();
    const fabricRow = page.locator('.ant-table-row').first();
    await fabricRow.waitFor({ state: 'visible' });

    // Fill Qty / Price / Allowance / Wastage (the two "%" inputs are allowance then wastage)
    await fabricRow.locator('input[placeholder="Qty"]').fill('2');
    await fabricRow.locator('input[placeholder="Rate"]').fill('100');
    const pctInputs = fabricRow.locator('input[placeholder="%"]');
    await pctInputs.nth(0).fill('10');   // allowance
    await pctInputs.nth(1).fill('5');    // wastage
    await page.keyboard.press('Tab');

    // netCost = 2 × 100 × 1.10 × 1.05 = 231.00
    const expectedNet = formatCurrency(2 * 100 * 1.1 * 1.05, 'INR'); // "₹ 231.00"
    await expect(fabricRow).toContainText('231.00', { timeout: 8000 });

    // Cost Summary "Fabric Cost" statistic reflects the single row total
    const summaryFabric = page.locator('.ant-statistic').filter({ hasText: 'Fabric Cost' }).first();
    await expect(summaryFabric).toContainText('231.00', { timeout: 8000 });

    // Drive overhead charges via agent% + profit% → Total Price reacts.
    // making (FOB, fabric only) = 231 ; charges = (8+12)% × 231 = 46.20 ; total = 277.20
    await setSummaryPct(page, 'Agent Commission', '8');
    await setSummaryPct(page, 'Profit', '12');

    const totalPriceCard = page.locator('.ant-card', { hasText: 'Total Price' }).first();
    await expect(totalPriceCard).toContainText('277.20', { timeout: 8000 });
    expect(expectedNet).toContain('231.00');
  });
});

/** Set one of the Cost-Summary percentage InputNumbers, located by its label text.
 *  Each field is an InputNumber inside a `.ant-col` that also holds its label
 *  (e.g. "Agent Commission %", "Profit %"). */
async function setSummaryPct(page, labelText, value) {
  const col = page.locator('.ant-col').filter({ hasText: labelText }).last();
  const input = col.locator('input.ant-input-number-input').first();
  await input.waitFor({ state: 'visible', timeout: 8000 });
  await input.fill(value);
  await page.keyboard.press('Tab');
}

test.describe('Costing — Create & Validation (UI)', () => {
  test('Create a Draft via the form → POST 200 → returns to list', async ({ page }) => {
    // One cost sheet per style (rule added 2026-08): the first style in the dropdown
    // is usually taken, so mint a fresh style for buyer 1 and pick it by name.
    const api = await createAuthenticatedClient();
    const { data: style } = await api.post('/styles', stylePayload(1));
    await api.dispose();

    await navigateWithAuth(page, '/costing/new');
    await page.locator('#buyerId').waitFor({ state: 'visible', timeout: 15000 });

    // Select a buyer, then the fresh style (styles load after the buyer is chosen).
    // The style list is virtualized and long by now — type to filter before clicking.
    await pickFormSelect(page, '#buyerId', null);
    await page.waitForTimeout(800);
    await page.locator('#styleNo').click();
    await page.keyboard.type(style.styleNo, { delay: 20 });
    await page.waitForTimeout(400);
    await page
      .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
      .last()
      .locator('.ant-select-item-option')
      .filter({ hasText: style.styleNo })
      .first()
      .click({ timeout: 10000 });
    await page.waitForTimeout(500);

    // Sizes are mandatory server-side (@NotEmpty) even for drafts — pick one.
    await page.locator('#sizes').click();
    await page.keyboard.type('M', { delay: 30 });
    await page.waitForTimeout(300);
    const sizeOption = page
      .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
      .last()
      .locator('.ant-select-item-option')
      .first();
    if (await sizeOption.isVisible().catch(() => false)) await sizeOption.click();
    else await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    const [resp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/cost-sheets') && r.request().method() === 'POST',
        { timeout: 20000 },
      ),
      page.getByRole('button', { name: /Save as Draft/i }).click(),
    ]);
    expect(resp.status()).toBeGreaterThanOrEqual(200);
    expect(resp.status()).toBeLessThan(300);
    await expect(page).toHaveURL(/\/costing\/list/, { timeout: 15000 });
  });

  test('Draft save without sizes is blocked inline; sizes offer preset options only (B-052)', async ({ page }) => {
    // Sizes became preset-driven and mandatory for DRAFTS too: the client must block
    // with the inline field error instead of letting the server 400 the save.
    const api = await createAuthenticatedClient();
    const { data: style } = await api.post('/styles', stylePayload(1));
    await api.dispose();

    await navigateWithAuth(page, '/costing/new');
    await page.locator('#buyerId').waitFor({ state: 'visible', timeout: 15000 });

    await pickFormSelect(page, '#buyerId', null);
    await page.waitForTimeout(800);
    await page.locator('#styleNo').click();
    await page.keyboard.type(style.styleNo, { delay: 20 });
    await page.waitForTimeout(400);
    await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last()
      .locator('.ant-select-item-option').filter({ hasText: style.styleNo }).first()
      .click({ timeout: 10000 });
    await page.waitForTimeout(400);

    // Attempt the draft save with sizes EMPTY — must be refused with no POST fired.
    let posted = false;
    page.on('request', (r) => {
      if (r.url().includes('/cost-sheets') && r.method() === 'POST') posted = true;
    });
    await page.getByRole('button', { name: /Save as Draft/i }).click();
    await expect(page.getByText('At least one size is required').first()).toBeVisible({ timeout: 8000 });
    expect(posted, 'no save request may leave the browser').toBe(false);

    // The sizes dropdown offers ONLY preset-master options (grouped) — no free typing.
    await page.locator('#sizes').click();
    const dd = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
    await expect(dd.locator('.ant-select-item-group').first()).toBeVisible({ timeout: 8000 });
    await page.keyboard.type('ZZZ-NOT-A-SIZE');
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter'); // tags mode would commit this; multiple mode must not
    await page.keyboard.press('Escape');
    const chosen = await page.locator('#sizes').evaluate(
      (el) => el.closest('.ant-select')?.innerText || '',
    );
    expect(chosen).not.toContain('ZZZ-NOT-A-SIZE');
  });

  test('Submitting an empty form surfaces required-field validation', async ({ page }) => {
    await navigateWithAuth(page, '/costing/new');
    await page.locator('#buyerId').waitFor({ state: 'visible', timeout: 15000 });

    await page.getByRole('button', { name: /Submit/i }).click();
    // AntD marks required Form.Items with .ant-form-item-has-error
    await expect(page.locator('.ant-form-item-has-error').first()).toBeVisible({ timeout: 8000 });
    // still on the form (not navigated away)
    await expect(page).toHaveURL(/\/costing\/new/);
  });
});
