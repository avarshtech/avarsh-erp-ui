/**
 * E2E Test — New Costing Sheet: Fill All Sections & Save as Draft
 *
 * This test navigates to /costing/new, fills every section
 * (General Details, Fabric, Trims, Manufacturing, Overhead, Summary)
 * and saves the cost sheet as a Draft.
 *
 * Prerequisites:
 *   - Frontend dev server running at localhost:3000
 *   - Backend API reachable (via VITE_API_BASE_URL in .env)
 *   - Buyer "Vangennip Textiles" with style "L60032-1" must exist
 *   - Fabric, Trim, Process, and Overhead master items must exist
 *   - Authenticated session (via global-setup.js)
 *
 * Run headed (visible browser):
 *   npx playwright test e2e/costing-full-entry.spec.js --headed
 */

import { test, expect } from '@playwright/test';

// ── Test Data ───────────────────────────────────────────────
// Matches real master data visible in the UI

const TEST_DATA = {
  buyer: 'Vangennip Textiles',
  style: 'L60032-1',
  season: 'Autumn/Winter',
  year: '2027',
  sizes: ['M', 'L'],
  fabric: {
    description: 'test',
    consumption: '0.67',
    price: '100',
    widthStd: '58',
    widthVendor: '58',
    allowancePct: '5',
  },
  localTrim: {
    consumption: '2',
    cost: '15',
  },
  importedTrim: {
    consumption: '1',
    costUsd: '3.50',
  },
  manufacturing: {
    cost: '75',
    comments: 'E2E manufacturing test',
  },
  overhead: {
    cost: '25',
    comments: 'E2E overhead test',
  },
  summary: {
    agentCommissionPct: '5',
    profitPct: '10',
  },
};

// ── Helpers ─────────────────────────────────────────────────

/**
 * Select an option from an Ant Design Select dropdown.
 * Waits for at least one option to appear before picking.
 */
async function antSelect(page, selectLocator, optionText, { first = false, timeout = 10000 } = {}) {
  // Close any stale dropdown by clicking away
  await page.mouse.click(0, 0);
  await page.waitForTimeout(300);

  await selectLocator.click();
  const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  await dropdown.waitFor({ state: 'visible', timeout: 5000 });

  // Wait until at least one selectable option is present
  const optionLocator = dropdown.locator('.ant-select-item-option');
  await optionLocator.first().waitFor({ state: 'visible', timeout });

  if (first) {
    await optionLocator.first().click();
  } else {
    await dropdown.locator('.ant-select-item-option').filter({ hasText: optionText }).click();
  }

  // Wait for dropdown to close
  await expect(dropdown).toBeHidden({ timeout: 3000 }).catch(() => {
    page.mouse.click(0, 0).catch(() => {});
  });
  await page.waitForTimeout(300);
}

/**
 * Navigate to a page with automatic re-authentication if session expired.
 */
async function navigateWithAuth(page, path) {
  await page.goto(path);

  const loginField = page.getByPlaceholder('Username');
  const appSidebar = page.locator('.ant-layout-sider');

  await Promise.race([
    loginField.waitFor({ state: 'visible', timeout: 15000 }),
    appSidebar.waitFor({ state: 'visible', timeout: 15000 }),
  ]).catch(() => {});

  if (await loginField.isVisible().catch(() => false)) {
    await loginField.fill(process.env.E2E_USERNAME || 'superadmin');
    await page.getByPlaceholder('Password').fill(process.env.E2E_PASSWORD || 'admin123');

    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/auth/login'), { timeout: 30000 }),
      page.getByRole('button', { name: /Sign In/i }).click(),
    ]);

    await page.waitForLoadState('networkidle');
    await page.goto(path);
    await page.waitForLoadState('networkidle');
  }
}

/**
 * Fill an InputNumber inside a table row cell.
 */
async function fillTableInputNumber(cell, value) {
  const input = cell.locator('.ant-input-number input');
  await input.click({ clickCount: 3 });
  await input.fill(String(value));
  await input.press('Tab');
}

/**
 * Fill a plain text Input inside a table row cell.
 */
async function fillTableInput(cell, value) {
  const input = cell.locator('input.ant-input');
  await input.click();
  await input.fill(value);
}

// ── Test Setup ──────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('sessionActive', 'true');
  });
});

// ── Main Test ───────────────────────────────────────────────

test.describe('Costing Sheet — Full Entry & Save as Draft', () => {
  test('Fill all sections and save as Draft', async ({ page }) => {
    test.setTimeout(180000);

    await navigateWithAuth(page, '/costing/new');
    await page.waitForLoadState('networkidle');

    // Wait for form to render
    await expect(page.getByText('Create Cost Sheet')).toBeVisible({ timeout: 15000 });

    // Wait for API data to load (buyers, items, processes, overheads)
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // ────────────────────────────────────────────────────────
    // SECTION A — General Details
    // ────────────────────────────────────────────────────────

    // Buyer — select by name
    const buyerFormItem = page.locator('.ant-form-item').filter({ hasText: 'Buyer' }).first();
    const buyerSelect = buyerFormItem.locator('.ant-select');
    await expect(buyerSelect.locator('.ant-select-arrow .anticon-loading')).toBeHidden({ timeout: 15000 }).catch(() => {});
    await antSelect(page, buyerSelect, TEST_DATA.buyer, { timeout: 15000 });

    // Style # — wait for styles to load after buyer selection, then select by number
    const styleFormItem = page.locator('.ant-form-item').filter({ hasText: 'Style #' }).first();
    const styleSelect = styleFormItem.locator('.ant-select');
    await expect(styleSelect.locator('.ant-select-arrow .anticon-loading')).toBeHidden({ timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await antSelect(page, styleSelect, TEST_DATA.style, { timeout: 15000 });

    // Garment Name — auto-filled from style ("Girls Jumpsuit"), just verify
    const garmentInput = page.locator('.ant-form-item').filter({ hasText: 'Garment Name' }).locator('input');
    await page.waitForTimeout(500);
    await expect(garmentInput).not.toHaveValue('', { timeout: 5000 });

    // Season — use the form item with name="seasonCode"
    const seasonSelect = page.locator('.ant-form-item').filter({ has: page.locator('label:text-is("Season")') }).locator('.ant-select');
    await antSelect(page, seasonSelect, TEST_DATA.season);

    // Year — use the form item with label "Year"
    const yearSelect = page.locator('.ant-form-item').filter({ has: page.locator('label:text-is("Year")') }).locator('.ant-select');
    await antSelect(page, yearSelect, TEST_DATA.year);

    // Costing Currency — verify INR (default)
    const currencyFormItem = page.locator('.ant-form-item').filter({ hasText: 'Costing Currency' }).first();
    await expect(currencyFormItem.locator('.ant-select')).toContainText('INR');

    // Quote Currency — verify USD (default)
    const quoteCurrencyFormItem = page.locator('.ant-form-item').filter({ hasText: 'Quote Currency' }).first();
    await expect(quoteCurrencyFormItem.locator('.ant-select')).toContainText('USD');

    // Actual Rate — leave the auto-fetched rate as-is (matches Today's Rate)

    // Sizes — type each size and press Enter (tags mode, no dropdown needed)
    const sizesFormItem = page.locator('.ant-form-item').filter({ has: page.locator('label:text-is("Sizes")') });
    const sizesInput = sizesFormItem.locator('input');
    await sizesInput.click();
    for (const size of TEST_DATA.sizes) {
      await sizesInput.fill(size);
      await sizesInput.press('Enter');
      await page.waitForTimeout(300);
    }
    // Close by pressing Escape, then click away
    await sizesInput.press('Escape');
    await page.waitForTimeout(300);

    // ────────────────────────────────────────────────────────
    // SECTION B — Fabric Cost Breakup
    // ────────────────────────────────────────────────────────

    const addFabricBtn = page.getByRole('button', { name: /Add Fabric/i });
    await addFabricBtn.scrollIntoViewIfNeeded();
    await addFabricBtn.click();
    await page.waitForTimeout(500);

    const fabricSection = page.locator('.ant-collapse-item').filter({ hasText: 'Section B' });
    const fabricTable = fabricSection.locator('.ant-table');
    await expect(fabricTable.locator('.ant-table-row')).toHaveCount(1, { timeout: 5000 });

    const fabricRow = fabricTable.locator('.ant-table-row').first();
    const fabricCells = fabricRow.locator('td');

    // Fabric Name (col 2) — select first available fabric item
    const fabricNameSelect = fabricCells.nth(2).locator('.ant-select');
    if (await fabricNameSelect.isVisible()) {
      await antSelect(page, fabricNameSelect, null, { first: true, timeout: 10000 }).catch(() => {
        console.log('No fabric items available — skipping');
      });
    }

    // Classification (col 3) — select "Knits" (matches screenshot)
    const classSelect = fabricCells.nth(3).locator('.ant-select');
    await antSelect(page, classSelect, 'Knits');

    // Description (col 4)
    await fillTableInput(fabricCells.nth(4), TEST_DATA.fabric.description);

    // Consumption (col 5)
    await fillTableInputNumber(fabricCells.nth(5), TEST_DATA.fabric.consumption);

    // Fabric Price (col 6)
    await fillTableInputNumber(fabricCells.nth(6), TEST_DATA.fabric.price);

    // Width Std (col 7)
    await fillTableInput(fabricCells.nth(7), TEST_DATA.fabric.widthStd);

    // Width Vendor (col 8)
    await fillTableInput(fabricCells.nth(8), TEST_DATA.fabric.widthVendor);

    // Allowance % (col 9)
    await fillTableInputNumber(fabricCells.nth(9), TEST_DATA.fabric.allowancePct);

    // Verify Net Cost is calculated (col 10)
    await page.waitForTimeout(500);
    const netCostText = await fabricCells.nth(10).textContent();
    expect(netCostText.trim()).not.toBe('');

    // ────────────────────────────────────────────────────────
    // SECTION C — Trims / Accessories Cost Breakup
    // ────────────────────────────────────────────────────────

    // C.1 — Local Accessories
    const addLocalBtn = page.getByRole('button', { name: /Add Local Item/i });
    await addLocalBtn.scrollIntoViewIfNeeded();
    await addLocalBtn.click();
    await page.waitForTimeout(500);

    const trimsSection = page.locator('.ant-collapse-item').filter({ hasText: 'Section C' });
    const localTrimTable = trimsSection.locator('.ant-table').first();
    await expect(localTrimTable.locator('.ant-table-row')).toHaveCount(1, { timeout: 5000 });

    const localRow = localTrimTable.locator('.ant-table-row').first();
    const localCells = localRow.locator('td');

    // Item (col 2) — select first available
    const localItemSelect = localCells.nth(2).locator('.ant-select');
    if (await localItemSelect.isVisible()) {
      await antSelect(page, localItemSelect, null, { first: true, timeout: 10000 }).catch(() => {
        console.log('No local trim items — skipping');
      });
    }

    // Consumption (col 5)
    await fillTableInputNumber(localCells.nth(5), TEST_DATA.localTrim.consumption);

    // Cost (col 6)
    await fillTableInputNumber(localCells.nth(6), TEST_DATA.localTrim.cost);

    // C.2 — Imported Accessories
    const addImportedBtn = page.getByRole('button', { name: /Add Imported Item/i });
    await addImportedBtn.scrollIntoViewIfNeeded();
    await addImportedBtn.click();
    await page.waitForTimeout(500);

    const importedTrimTable = trimsSection.locator('.ant-table').nth(1);
    await expect(importedTrimTable.locator('.ant-table-row')).toHaveCount(1, { timeout: 5000 });

    const importedRow = importedTrimTable.locator('.ant-table-row').first();
    const importedCells = importedRow.locator('td');

    // Item (col 2) — select first available
    const importedItemSelect = importedCells.nth(2).locator('.ant-select');
    if (await importedItemSelect.isVisible()) {
      await antSelect(page, importedItemSelect, null, { first: true, timeout: 10000 }).catch(() => {
        console.log('No imported trim items — skipping');
      });
    }

    // Consumption (col 5)
    await fillTableInputNumber(importedCells.nth(5), TEST_DATA.importedTrim.consumption);

    // Cost USD (col 6)
    await fillTableInputNumber(importedCells.nth(6), TEST_DATA.importedTrim.costUsd);

    // ────────────────────────────────────────────────────────
    // SECTION D — Manufacturing Cost
    // ────────────────────────────────────────────────────────

    const addProcessBtn = page.getByRole('button', { name: /Add Process/i });
    await addProcessBtn.scrollIntoViewIfNeeded();
    await addProcessBtn.click();
    await page.waitForTimeout(500);

    const mfgSection = page.locator('.ant-collapse-item').filter({ hasText: 'Section D' });
    const mfgTable = mfgSection.locator('.ant-table');
    await expect(mfgTable.locator('.ant-table-row')).toHaveCount(1, { timeout: 5000 });

    const mfgRow = mfgTable.locator('.ant-table-row').first();
    const mfgCells = mfgRow.locator('td');

    // Process (col 2) — select first available
    const processSelect = mfgCells.nth(2).locator('.ant-select');
    if (await processSelect.isVisible()) {
      await antSelect(page, processSelect, null, { first: true, timeout: 10000 }).catch(() => {
        console.log('No manufacturing processes — skipping');
      });
    }

    // Cost (col 3) — fill if empty or zero
    const mfgCostInput = mfgCells.nth(3).locator('.ant-input-number input');
    const mfgCostValue = await mfgCostInput.inputValue();
    if (!mfgCostValue || mfgCostValue === '0' || mfgCostValue === '') {
      await fillTableInputNumber(mfgCells.nth(3), TEST_DATA.manufacturing.cost);
    }

    // Comments (col 4)
    await fillTableInput(mfgCells.nth(4), TEST_DATA.manufacturing.comments);

    // ────────────────────────────────────────────────────────
    // SECTION E — Overhead / Markup Costs
    // ────────────────────────────────────────────────────────

    const addOverheadBtn = page.getByRole('button', { name: /Add Overhead/i });
    await addOverheadBtn.scrollIntoViewIfNeeded();
    await addOverheadBtn.click();
    await page.waitForTimeout(500);

    const ovhSection = page.locator('.ant-collapse-item').filter({ hasText: 'Section E' });
    const ovhTable = ovhSection.locator('.ant-table');
    await expect(ovhTable.locator('.ant-table-row')).toHaveCount(1, { timeout: 5000 });

    const ovhRow = ovhTable.locator('.ant-table-row').first();
    const ovhCells = ovhRow.locator('td');

    // Description (col 2) — select first available
    const overheadSelect = ovhCells.nth(2).locator('.ant-select');
    if (await overheadSelect.isVisible()) {
      await antSelect(page, overheadSelect, null, { first: true, timeout: 10000 }).catch(() => {
        console.log('No overhead items — skipping');
      });
    }

    // Cost (col 3) — fill if empty or zero
    const ovhCostInput = ovhCells.nth(3).locator('.ant-input-number input');
    const ovhCostValue = await ovhCostInput.inputValue();
    if (!ovhCostValue || ovhCostValue === '0' || ovhCostValue === '') {
      await fillTableInputNumber(ovhCells.nth(3), TEST_DATA.overhead.cost);
    }

    // Comments (col 4)
    await fillTableInput(ovhCells.nth(4), TEST_DATA.overhead.comments);

    // ────────────────────────────────────────────────────────
    // SECTION F — Cost Summary
    // ────────────────────────────────────────────────────────

    const summarySection = page.locator('.ant-collapse-item').filter({ hasText: 'Section F' });
    await summarySection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Verify summary statistics are visible
    await expect(summarySection.getByText('Fabric Cost')).toBeVisible();
    await expect(summarySection.getByText('Manufacturing Cost')).toBeVisible();
    await expect(summarySection.getByText('Total Making Price')).toBeVisible();

    // Agent Commission % — first InputNumber with % addon in summary
    const summaryInputNumbers = summarySection.locator('.ant-input-number-group-wrapper');
    const agentInput = summaryInputNumbers.nth(0).locator('input');
    await agentInput.click({ clickCount: 3 });
    await agentInput.fill(TEST_DATA.summary.agentCommissionPct);
    await agentInput.press('Tab');

    // Profit % — second InputNumber with % addon in summary
    const profitInput = summaryInputNumbers.nth(1).locator('input');
    await profitInput.click({ clickCount: 3 });
    await profitInput.fill(TEST_DATA.summary.profitPct);
    await profitInput.press('Tab');

    // Wait for auto-calculations
    await page.waitForTimeout(1000);

    // Verify final prices are displayed
    await expect(summarySection.getByText(/Total Price/)).toBeVisible();
    await expect(summarySection.getByText(/Final Price \(USD\)/)).toBeVisible();

    // ────────────────────────────────────────────────────────
    // SAVE AS DRAFT
    // ────────────────────────────────────────────────────────

    // Scroll to top where Save button is (sticky header)
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);

    const saveDraftButton = page.getByRole('button', { name: /Save as Draft/i });
    await expect(saveDraftButton).toBeVisible();
    await expect(saveDraftButton).toBeEnabled();

    // Click save and wait for API response
    const [saveResponse] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/cost-sheets') && r.request().method() === 'POST',
        { timeout: 30000 }
      ),
      saveDraftButton.click(),
    ]);

    const saveStatus = saveResponse.status();
    if (saveStatus !== 200) {
      const body = await saveResponse.text().catch(() => '');
      throw new Error(`Save API returned ${saveStatus}: ${body}`);
    }

    // Wait for navigation or success message
    await Promise.race([
      page.waitForURL(/costing\/edit\/\d+/, { timeout: 15000 }),
      page.waitForURL(/costing\/list/, { timeout: 15000 }),
      page.locator('.ant-message').waitFor({ state: 'visible', timeout: 15000 }),
    ]).catch(() => {});

    // Verify we left the /costing/new page
    const finalUrl = page.url();
    if (finalUrl.includes('/costing/new')) {
      const errorMessages = page.locator('.ant-form-item-explain-error');
      const errorCount = await errorMessages.count();
      if (errorCount > 0) {
        const errors = [];
        for (let i = 0; i < errorCount; i++) {
          errors.push(await errorMessages.nth(i).textContent());
        }
        throw new Error(`Save failed — validation errors: ${errors.join(', ')}`);
      }
    }

    // If navigated to edit page, verify costing ID tag
    if (finalUrl.includes('/costing/edit/')) {
      await page.waitForLoadState('networkidle');
      await expect(page.locator('.ant-tag').filter({ hasText: /CST\// })).toBeVisible({ timeout: 10000 });
    }
  });
});
