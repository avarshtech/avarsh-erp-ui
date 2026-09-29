/**
 * Costing — the one-page sheet: what makes it fast, pinned end to end.
 *
 *   - A missing fabric is created from the picker (+ Create "<typed>") without leaving the sheet
 *   - Enter on the last row adds the next one
 *   - The live price panel equals what the server saves; Save as Draft stays on the sheet
 *   - Autosave: consecutive edits save silently, with no version conflict
 *   - A template is applied with its rates refreshed from recent prices, and Undo takes it back
 *   - Submit refuses a row that has figures but no material
 *
 * Each test mints its own style (one costing per style) and runs as superadmin.
 */

import { test, expect } from '@playwright/test';
import { ensureSessionActive, navigateWithAuth } from '../../helpers/navigation.js';
import { antSelect } from '../../helpers/antd-helpers.js';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { stylePayload } from '../../helpers/test-data.js';
import { visibleOption } from '../../helpers/ui-master.js';

const fabricSection = (page) => page.locator('[data-genie-anchor="section-fabric"]');
const fabricRows = (page) => fabricSection(page).locator('tr.ant-table-row');
const dropdown = (page) => page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
const panelNumber = async (page, label) => {
  const text = await page.locator('.sheet-price-panel').innerText();
  const match = text.match(new RegExp(`${label}[^\\d]*([\\d,]+\\.\\d{2})`));
  return match ? Number(match[1].replace(/,/g, '')) : NaN;
};

/** /costing/new with buyer 1, a freshly created style and one size picked. */
async function openSheetWithFreshStyle(page) {
  const api = await createAuthenticatedClient();
  const { data: style } = await api.post('/styles', stylePayload(1));
  await api.dispose();

  await navigateWithAuth(page, '/costing/new');
  await page.locator('#buyerId').waitFor({ state: 'visible', timeout: 15000 });
  await antSelect(page, page.locator('#buyerId'), null, { first: true });
  await page.waitForTimeout(600);
  await page.locator('#styleNo').click();
  await page.keyboard.type(style.styleNo, { delay: 15 });
  await visibleOption(page, style.styleNo).click({ timeout: 10000 });
  await page.locator('#sizes').click();
  await dropdown(page).locator('.ant-select-item-option').first().click();
  await page.keyboard.press('Escape');
  return style;
}

/** Pick the first variant offered in a fabric row. */
async function pickFirstFabric(page, row) {
  await row.locator('.ant-select').filter({ has: page.locator('input[aria-label="Fabric Name"]') }).click();
  await dropdown(page).locator('.ant-select-item-option').first().click();
}

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
  page.on('pageerror', (err) => console.log(`[browser:pageerror] ${err.message}`));
});

test('A missing fabric is created from the picker and fills the row', async ({ page }) => {
  await openSheetWithFreshStyle(page);
  await page.getByRole('button', { name: /Add Fabric/i }).click();
  const row = fabricRows(page).first();
  const name = `Rib Test ${Date.now() % 1000000}`;

  await page.locator('input[aria-label="Fabric Name"]').first().click();
  await page.keyboard.type(name, { delay: 10 });
  // The drawer looks up the item for the guessed Category / Sub-category / Item Type.
  const lookup = page.waitForResponse((r) => r.url().includes('/items/search') && r.url().includes('itemTypeId='));
  await dropdown(page).locator('.ant-select-item-option').filter({ hasText: `Create "${name}"` }).click();

  const drawer = page.locator('.ant-drawer-open');
  await expect(drawer.getByText('New material')).toBeVisible();
  // Guessed from the typed words: Fabric › Knit › Rib.
  await expect(drawer.locator('.ant-select-content-value, .ant-select-selection-item').filter({ hasText: /^Rib$/ }).first()).toBeVisible();

  // A Rib item from an earlier run turns this into "Add variant" (its unit is then locked).
  const exists = ((await (await lookup).json()).content || []).length > 0;
  if (exists) {
    await expect(drawer.getByRole('button', { name: 'Add variant' })).toBeVisible();
  } else {
    await antSelect(page, drawer.locator('#quickItem_uomId'), 'kg');
  }
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/items/find-or-create') && r.request().method() === 'POST'),
    drawer.locator('button[type="submit"]').click(),
  ]);
  expect([200, 201]).toContain(resp.status());
  const result = await resp.json();
  expect(result.variant.variantName).toBe(name);

  await expect(drawer).toBeHidden();
  await expect(row.locator('.ant-select').filter({ has: page.locator('input[aria-label="Fabric Name"]') })).toContainText(name);
  await expect(row.locator('input[placeholder="Qty"]')).toBeVisible();
});

test('A material whose item exists lists its variants, and a known name reuses that variant', async ({ page }) => {
  // Seeded: Fabric › Knit › Single Jersey is FAB-SJ-001, with Black among its variants.
  await navigateWithAuth(page, '/costing/new');
  await page.getByRole('button', { name: /Add Fabric/i }).click();
  const row = fabricRows(page).first();
  const name = `Single Jersey Anthra ${Date.now() % 100000}`;
  await page.locator('input[aria-label="Fabric Name"]').first().click();
  await page.keyboard.type(name, { delay: 10 });
  await dropdown(page).locator('.ant-select-item-option').filter({ hasText: `Create "${name}"` }).click();

  const drawer = page.locator('.ant-drawer-open');
  const existing = drawer.locator('.ant-alert').filter({ hasText: 'FAB-SJ-001 already exists' });
  await expect(existing).toBeVisible({ timeout: 15000 });
  await expect(existing.getByRole('listitem').filter({ hasText: 'FAB-SJ-001-BLK' })).toBeVisible();
  await expect(drawer.getByRole('button', { name: 'Add variant' })).toBeVisible();

  await drawer.locator('#quickItem_variantName').fill('black');
  await expect(existing).toContainText('is already one of its variants (FAB-SJ-001-BLK)');
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/items/find-or-create') && r.request().method() === 'POST'),
    drawer.locator('button[type="submit"]').click(),
  ]);
  expect(resp.status()).toBe(200);
  const result = await resp.json();
  expect(result.variantCreated).toBe(false);
  expect(result.variant.variantCode).toBe('FAB-SJ-001-BLK');
  await expect(drawer).toBeHidden();
  await expect(row.locator('.ant-select').filter({ has: page.locator('input[aria-label="Fabric Name"]') })).toContainText('Black');
});

test("Today's Rate sits read-only beside Actual Rate; attachments under Section A; the price panel floats", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await navigateWithAuth(page, '/costing/new');

  // A new sheet starts from today's stored market rate, shown read-only beside the editable one.
  const today = page.locator('#todaysRate');
  await expect(today).toHaveAttribute('readonly', '');
  await expect(today).not.toHaveValue('');
  await expect.poll(async () => Number(await page.locator('#actualRate').inputValue())).toBe(Number(await today.inputValue()));

  const header = await page.locator('[data-genie-anchor="header"]').boundingBox();
  const attachments = await page.locator('[data-genie-anchor="attachments"]').boundingBox();
  expect(attachments.y - (header.y + header.height)).toBeGreaterThanOrEqual(0);
  expect(attachments.y - (header.y + header.height)).toBeLessThan(40);

  await page.mouse.wheel(0, 2000);
  await expect.poll(() => page.evaluate(() => window.scrollY || document.scrollingElement.scrollTop)).toBeGreaterThan(300);
  const panel = await page.locator('.sheet-price-panel').boundingBox();
  expect(panel.y).toBeGreaterThan(100);
  expect(panel.y).toBeLessThan(250);
});

test('Enter on the last row adds the next one', async ({ page }) => {
  await navigateWithAuth(page, '/costing/new');
  await page.getByRole('button', { name: /Add Fabric/i }).click();
  await expect(fabricRows(page)).toHaveCount(1);
  await fabricRows(page).first().locator('input[placeholder="Qty"]').fill('0.3');
  await page.keyboard.press('Enter');
  await expect(fabricRows(page)).toHaveCount(2);
});

test('Live price equals what the server saves; Save as Draft stays on the sheet; autosave follows', async ({ page }) => {
  await openSheetWithFreshStyle(page);
  await page.getByRole('button', { name: /Add Fabric/i }).click();
  const row = fabricRows(page).first();
  await pickFirstFabric(page, row);
  await row.locator('input[placeholder="Qty"]').fill('0.25');
  await row.locator('input[placeholder="Rate"]').fill('400');
  await row.locator('input[placeholder="%"]').first().fill('5');
  await page.locator('input[name="agentCommissionPct"]').fill('5');
  await page.locator('input[name="profitPct"]').fill('10');
  await page.keyboard.press('Tab');
  const panelTotal = await panelNumber(page, 'Total Price \\(INR\\)');

  const [resp] = await Promise.all([
    page.waitForResponse((r) => /\/cost-sheets(\?|$)/.test(r.url()) && r.request().method() === 'POST'),
    page.locator('button').filter({ hasText: /^Save as Draft$/ }).first().click(),
  ]);
  expect(resp.status()).toBe(200);
  const saved = await resp.json();
  expect(saved.totalPrice).toBeCloseTo(panelTotal, 2);
  await expect(page).toHaveURL(new RegExp(`/costing/edit/${saved.id}$`));
  // The saved sheet has taken over once its costing number is in the header.
  await expect(page.locator('[data-genie-anchor="header"] .ant-tag')).toHaveText(saved.costingId);

  // Two edits in a row: each autosaves silently, and the second is not a version conflict.
  for (const pct of ['12', '14']) {
    const autosaved = page.waitForResponse((r) => r.url().includes('autosave=true'), { timeout: 20000 });
    await page.locator('input[name="profitPct"]').fill(pct);
    await page.keyboard.press('Tab');
    expect((await autosaved).status()).toBe(200);
  }
  await expect(page.getByText(/^Saved \d{2}:\d{2}$/)).toBeVisible();

  const api = await createAuthenticatedClient();
  const { data: stored } = await api.get(`/cost-sheets/${saved.id}`);
  await api.dispose();
  expect(Number(stored.profitPct)).toBe(14);
  expect(stored.status).toBe('Draft');
});

test('A template is applied with its rates refreshed, and Undo takes it back', async ({ page }) => {
  const api = await createAuthenticatedClient();
  const { data: variants } = await api.get('/variants/search?category=Fabric&limit=1');
  const templateName = `E2E Template ${Date.now() % 1000000}`;
  await api.post('/cost-sheets/templates', {
    templateName,
    templateData: {
      fabricRows: [{ variantId: variants[0].id, itemId: variants[0].itemId, fabricType: variants[0].variantName, consumption: 0.2, fabricPrice: 1, allowancePct: 0 }],
      header: { costingType: 'FOB', agentCommissionPct: 2, profitPct: 9 },
    },
  });
  await api.dispose();

  await navigateWithAuth(page, '/costing/new');
  await page.getByRole('button', { name: 'Use a template', exact: true }).click();
  await page.locator('.ant-modal-wrap tr').filter({ hasText: templateName }).getByRole('button', { name: 'Load' }).click();

  await expect(fabricRows(page)).toHaveCount(1);
  await expect(page.locator('input[name="profitPct"]')).toHaveValue(/^9/);
  await expect(page.locator('.ant-message-notice').filter({ hasText: 'Template applied' })).toBeVisible();

  await page.getByRole('button', { name: /Undo/ }).click();
  await expect(fabricRows(page)).toHaveCount(0);
});

test('Submit refuses a row that has figures but no material', async ({ page }) => {
  await openSheetWithFreshStyle(page);
  await page.getByRole('button', { name: /Add Fabric/i }).click();
  await fabricRows(page).first().locator('input[placeholder="Qty"]').fill('1');

  let posted = false;
  page.on('request', (r) => { if (/\/cost-sheets(\?|$)/.test(r.url()) && r.method() === 'POST') posted = true; });
  await page.locator('button').filter({ hasText: /^Submit$/ }).first().click();
  await expect(page.locator('.ant-message-notice').filter({ hasText: 'no material or process picked' })).toBeVisible();
  expect(posted).toBe(false);
  await expect(page).toHaveURL(/\/costing\/new/);
});
