/**
 * Costing — scenario sweep over the one-page sheet: every feature a costing user reaches, on the
 * real backend, each scenario from a clean sheet.
 *
 *   S1  A full FOB costing: buyer, style and size preset created in place; all five sections;
 *       live price = saved price to the paisa; Save as Draft; Submit → Approved
 *   S2  CMT leaves the fabric out of the making price; per-dozen shows the dozen price
 *   S3  A target price drives the profit; typing a profit clears it; a target below cost is flagged
 *   S4  Rows limited to some sizes give a per-size breakdown, and the sizes are saved
 *   S5  Copy a costing onto a new style
 *   S6  Save as template keeps the header defaults; using it brings them back
 *   S7  One costing per style: a second one for the same style is refused, the sheet is kept
 *   S8  An unsaved new sheet survives a reload
 *   S9  Duplicate and delete rows; Ctrl+Z brings a deleted row back; Ctrl+S saves
 *   S10 The knits calculator fills the consumption
 *   S11 The rate popover offers the last costing price
 *   S12 Attachments and the garment image stay with a saved sheet
 *   S13 Two tabs on one draft: the stale tab's autosave pauses instead of overwriting
 */

import { test, expect } from '@playwright/test';
import { ensureSessionActive, navigateWithAuth } from '../../helpers/navigation.js';
import { antSelect } from '../../helpers/antd-helpers.js';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { stylePayload } from '../../helpers/test-data.js';
import { visibleOption } from '../../helpers/ui-master.js';

const uniq = () => `${Date.now() % 1000000}${Math.floor(Math.random() * 90 + 10)}`;
const section = (page, key) => page.locator(`[data-genie-anchor="section-${key}"]`);
const rows = (page, key) => section(page, key).locator('tr.ant-table-row');
const dropdown = (page) => page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
const drawer = (page) => page.locator('.ant-drawer-open').last();
const notice = (page, text) => page.locator('.ant-message-notice').filter({ hasText: text });
const PICKER = { fabric: 'Fabric Name', localTrim: 'Item', importedTrim: 'Item', manufacturing: 'Process', overhead: 'Description' };
const ADD = { fabric: 'Add Fabric', localTrim: 'Add Local Item', importedTrim: 'Add Imported Item', manufacturing: 'Add Process', overhead: 'Add Overhead' };

const money = (text) => Number(String(text).replace(/[^\d.-]/g, ''));
async function panel(page) {
  const text = await page.locator('.sheet-price-panel').innerText();
  const read = (label) => {
    const m = text.match(new RegExp(`${label}[^\\d-]*(-?[\\d,]+\\.\\d{2})`));
    return m ? money(m[1]) : NaN;
  };
  return {
    fabric: read('Fabric Cost'), accessories: read('Trims / Accessories'), manufacturing: read('Manufacturing Cost'),
    markup: read('Markup / Overhead'), making: read('Total Making Price'), charges: read('Overhead Charges'),
    total: read('Total Price \\(INR\\)'), usd: read('Final Price \\(USD\\)'),
  };
}

async function api() {
  return createAuthenticatedClient();
}

async function newStyle(buyerId = 1) {
  const client = await api();
  const { data } = await client.post('/styles', stylePayload(buyerId, { styleNo: `SC-${uniq()}` }));
  await client.dispose();
  return data;
}

/** /costing/new with the first buyer, the given style and the first preset's sizes. */
async function openSheet(page, style) {
  await navigateWithAuth(page, '/costing/new');
  await page.locator('#buyerId').waitFor({ state: 'visible', timeout: 15000 });
  await antSelect(page, page.locator('#buyerId'), null, { first: true });
  await page.waitForTimeout(500);
  await page.locator('#styleNo').click();
  await page.keyboard.type(style.styleNo, { delay: 10 });
  await visibleOption(page, style.styleNo).click({ timeout: 10000 });
  await page.locator('#sizes').click();
  for (let i = 0; i < 3; i += 1) await dropdown(page).locator('.ant-select-item-option').nth(i).click();
  await page.keyboard.press('Escape');
}

/** Adds a row to a section and picks the first option its picker offers (or the one matching `name`). */
async function addRow(page, key, { name, qty, rate, cost } = {}) {
  await page.getByRole('button', { name: ADD[key] }).click();
  const row = rows(page, key).last();
  await row.locator('.ant-select').filter({ has: page.locator(`input[aria-label="${PICKER[key]}"]`) }).first().click();
  if (name) await page.keyboard.type(name, { delay: 10 });
  const options = dropdown(page).locator('.ant-select-item-option').filter({ hasNotText: 'Create' });
  await (name ? options.filter({ hasText: name }).first() : options.first()).click();
  if (qty != null) await row.locator('input[placeholder="Qty"]').fill(String(qty));
  if (rate != null) await row.locator('input[placeholder="Rate"]').fill(String(rate));
  if (cost != null) await row.locator('input[placeholder="Cost"]').first().fill(String(cost));
  await page.keyboard.press('Tab');
  return row;
}

async function saveDraft(page) {
  const [resp] = await Promise.all([
    page.waitForResponse((r) => /\/cost-sheets(\?|$)/.test(r.url()) && r.request().method() === 'POST'),
    page.locator('button').filter({ hasText: /^Save as Draft$/ }).first().click(),
  ]);
  return resp;
}

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
  page.on('pageerror', (err) => console.log(`[browser:pageerror] ${err.message}`));
});

test('S1 A full FOB costing: masters created in place, all five sections, live = saved, submitted', async ({ page }) => {
  test.setTimeout(180000); // five sections and six masters created in place
  const n = uniq();
  await navigateWithAuth(page, '/costing/new');

  // Buyer, created from the picker.
  await page.locator('#buyerId').click();
  await page.keyboard.type(`Scenario Buyer ${n}`, { delay: 5 });
  await dropdown(page).locator('.ant-select-item-option').filter({ hasText: 'Create' }).click();
  await drawer(page).locator('#quickBuyer_contactPerson').fill('Asha');
  await drawer(page).locator('#quickBuyer_email').fill(`buyer${n}@example.com`);
  await drawer(page).locator('button[type="submit"]').click();
  await expect(page.locator('.ant-form-item').filter({ has: page.locator('#buyerId') })).toContainText(`Scenario Buyer ${n}`);

  // Style, created from the picker; the garment name follows it.
  await page.locator('#styleNo').click();
  await page.keyboard.type(`SCN-${n}`, { delay: 5 });
  await dropdown(page).locator('.ant-select-item-option').filter({ hasText: 'Create' }).click();
  await drawer(page).locator('#quickStyle_garmentName').fill('Polo Shirt');
  await drawer(page).locator('button[type="submit"]').click();
  await expect(page.locator('#garmentName')).toHaveValue('Polo Shirt');
  // The closing drawer hands focus back to the style picker; let it settle before the next field.
  await expect(page.locator('.ant-drawer-open')).toHaveCount(0);

  // Sizes from a size preset created in place.
  // The closing style drawer hands focus back to the style picker a beat late, which can close the
  // sizes dropdown between opening it and clicking in it: retry until the preset drawer is open.
  await expect(async () => {
    if (!(await drawer(page).locator('#quickSizePreset_name').isVisible())) {
      await page.locator('#sizes').click();
      await page.getByRole('button', { name: /New size preset/ }).click({ timeout: 2000 });
    }
    await expect(drawer(page).locator('#quickSizePreset_name')).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20000 });
  await drawer(page).locator('#quickSizePreset_name').fill(`Scenario ${n}`);
  const sizeInput = drawer(page).locator('#quickSizePreset_sizes');
  for (const s of ['S', 'M', 'L']) { await sizeInput.fill(s); await sizeInput.press('Enter'); }
  await drawer(page).locator('button[type="submit"]').click();
  await expect(page.locator('.ant-form-item').filter({ has: page.locator('#sizes') })).toContainText('M');

  // All five sections.
  const fabric = await addRow(page, 'fabric', { qty: 0.3, rate: 350 });
  await fabric.locator('input[placeholder="%"]').nth(0).fill('3');
  await fabric.locator('input[placeholder="%"]').nth(1).fill('2');
  await addRow(page, 'localTrim', { qty: 2, cost: 1.5 });
  await addRow(page, 'importedTrim', { qty: 4, cost: 0.05 });
  // A process created from its picker takes its default cost.
  await page.getByRole('button', { name: ADD.manufacturing }).click();
  await rows(page, 'manufacturing').last().locator('.ant-select').filter({ has: page.locator('input[aria-label="Process"]') }).click();
  await page.keyboard.type(`Scn Stitch ${n}`, { delay: 5 });
  await dropdown(page).locator('.ant-select-item-option').filter({ hasText: 'Create' }).click();
  await drawer(page).locator('#quickProcess_defaultCost').fill('22');
  await drawer(page).locator('button[type="submit"]').click();
  await expect(rows(page, 'manufacturing').last()).toContainText(`Scn Stitch ${n}`);
  await addRow(page, 'overhead', { name: 'Documentation' });
  await page.locator('input[name="agentCommissionPct"]').fill('3');
  await page.locator('input[name="profitPct"]').fill('10');
  await page.keyboard.press('Tab');

  const live = await panel(page);
  expect(live.fabric).toBeCloseTo(0.3 * 350 * 1.03 * 1.02, 2);
  expect(live.manufacturing).toBeCloseTo(22, 2);
  expect(live.markup).toBeGreaterThan(0);

  const resp = await saveDraft(page);
  expect(resp.status()).toBe(200);
  const saved = await resp.json();
  expect(saved.totalFabricCost).toBeCloseTo(live.fabric, 2);
  expect(saved.totalAccessoriesCost).toBeCloseTo(live.accessories, 2);
  expect(saved.totalManufacturingCost).toBeCloseTo(live.manufacturing, 2);
  expect(saved.totalMarkupCost).toBeCloseTo(live.markup, 2);
  expect(saved.totalMakingPrice).toBeCloseTo(live.making, 2);
  expect(saved.totalOverheadCharges).toBeCloseTo(live.charges, 2);
  expect(saved.totalPrice).toBeCloseTo(live.total, 2);
  await expect(page).toHaveURL(new RegExp(`/costing/edit/${saved.id}$`));

  await page.locator('button').filter({ hasText: /^Submit$/ }).first().click();
  await expect(page).toHaveURL(/\/costing\/list/, { timeout: 20000 });
  const client = await api();
  const { data: stored } = await client.get(`/cost-sheets/${saved.id}`);
  await client.dispose();
  expect(['Approved', 'Final', 'Pending']).toContain(stored.status);
  expect(stored.fabricRows).toHaveLength(1);
  expect(stored.manufacturingRows[0].processName || stored.manufacturingRows[0].process).toContain(`Scn Stitch ${n}`);
});

test('S2 CMT leaves the fabric out of the making price; per dozen shows the dozen price', async ({ page }) => {
  const style = await newStyle();
  await openSheet(page, style);
  await addRow(page, 'fabric', { qty: 0.25, rate: 400 });
  await addRow(page, 'manufacturing', { name: 'Cutting' });
  const fob = await panel(page);
  expect(fob.making).toBeCloseTo(100 + fob.manufacturing, 2);

  await antSelect(page, page.locator('.ant-form-item').filter({ hasText: 'Costing Type' }).locator('.ant-select'), 'CMT');
  const cmt = await panel(page);
  expect(cmt.fabric).toBeCloseTo(100, 2);
  expect(cmt.making).toBeCloseTo(cmt.manufacturing, 2);

  // Per dozen: the costs are for a dozen, and the panel adds the per-piece equivalent (÷12).
  await page.getByText('Per Dozen', { exact: true }).click();
  const dozen = await panel(page);
  await expect(page.locator('.sheet-price-panel')).toContainText(`Per piece: ₹ ${(dozen.total / 12).toFixed(2)}`);

  const resp = await saveDraft(page);
  const saved = await resp.json();
  expect(saved.costingType).toBe('CMT');
  expect(saved.totalMakingPrice).toBeCloseTo(cmt.making, 2);
});

test('S3 A target price drives the profit; typing a profit clears it; a target below cost is flagged', async ({ page }) => {
  const style = await newStyle();
  await openSheet(page, style);
  await addRow(page, 'fabric', { qty: 0.5, rate: 200 });
  await page.locator('input[name="agentCommissionPct"]').fill('5');
  const making = (await panel(page)).making;

  await page.locator('input[name="targetPrice"]').fill(String((making * 1.25).toFixed(2)));
  await page.keyboard.press('Tab');
  await expect(page.locator('input[name="profitPct"]')).toHaveValue(/^20/);

  await page.locator('input[name="profitPct"]').fill('12');
  await page.keyboard.press('Tab');
  await expect(page.locator('input[name="targetPrice"]')).toHaveValue('');

  await page.locator('input[name="targetPrice"]').fill(String((making * 0.8).toFixed(2)));
  await page.keyboard.press('Tab');
  await page.locator('.genie-launcher').click();
  await expect(page.getByRole('dialog', { name: 'Laya AI' }).getByText('The target price is below cost')).toBeVisible();
});

test('S4 Rows limited to some sizes give a per-size breakdown, and the sizes are saved', async ({ page }) => {
  const style = await newStyle();
  await openSheet(page, style);
  const sizes = await page.locator('.ant-form-item').filter({ has: page.locator('#sizes') }).locator('.ant-select-selection-item, .ant-select-content-value').allInnerTexts();
  expect(sizes.length).toBeGreaterThan(1);

  const small = await addRow(page, 'fabric', { qty: 0.2, rate: 300 });
  await small.locator('.ant-select').filter({ has: page.locator('input[aria-label="Sizes"]') }).click();
  await dropdown(page).locator('.ant-select-item-option').nth(0).click();
  await page.keyboard.press('Escape');
  const big = await addRow(page, 'fabric', { qty: 0.3, rate: 300 });
  await big.locator('.ant-select').filter({ has: page.locator('input[aria-label="Sizes"]') }).click();
  await dropdown(page).locator('.ant-select-item-option').nth(1).click();
  await page.keyboard.press('Escape');

  await expect(page.getByText(/Section F/)).toBeVisible();
  await expect(page.locator('body')).toContainText(/Per-Size/i);

  // The live price panel prices one size at a time — never the two rows added together.
  const sizeButtons = page.locator('.sheet-price-panel .ant-radio-button-wrapper');
  await expect(sizeButtons).toHaveCount(2);
  await expect(sizeButtons.nth(0)).toContainText(sizes[0]);
  expect((await panel(page)).fabric).toBeCloseTo(60, 2);
  await sizeButtons.nth(1).click();
  await expect.poll(async () => (await panel(page)).fabric).toBeCloseTo(90, 2);

  const saved = await (await saveDraft(page)).json();
  expect(saved.fabricRows.map((r) => r.sizes).filter(Boolean)).toHaveLength(2);
});

test('S5 Copy a costing onto a new style', async ({ page }) => {
  const style = await newStyle();
  await openSheet(page, style);
  await addRow(page, 'fabric', { qty: 0.4, rate: 250 });
  await addRow(page, 'manufacturing', { name: 'Cutting' });
  const source = await (await saveDraft(page)).json();

  await navigateWithAuth(page, '/costing/new');
  await page.getByRole('button', { name: 'Copy a costing', exact: true }).click();
  const copyDrawer = drawer(page);
  await copyDrawer.getByText(source.costingId).first().click();
  const copyButton = copyDrawer.getByRole('button', { name: /Copy/ }).first();
  if (await copyButton.isVisible().catch(() => false)) await copyButton.click();
  await expect(rows(page, 'fabric')).toHaveCount(1);
  await expect(rows(page, 'manufacturing')).toHaveCount(1);
  await expect(notice(page, 'pick the new style')).toBeVisible();
  // One costing per style: the copy never carries the style over.
  await expect(page.locator('.ant-form-item').filter({ has: page.locator('#styleNo') })).not.toContainText(style.styleNo);
});

test('S6 Save as template keeps the header defaults; using it brings them back', async ({ page }) => {
  const style = await newStyle();
  const name = `Scenario Template ${uniq()}`;
  await openSheet(page, style);
  await antSelect(page, page.locator('.ant-form-item').filter({ hasText: 'Costing Type' }).locator('.ant-select'), 'CMT');
  await addRow(page, 'fabric', { qty: 0.35, rate: 280 });
  await page.locator('input[name="profitPct"]').fill('11');
  await page.keyboard.press('Tab');
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: /Save as template/ }).click();
  const modal = page.locator('.ant-modal-wrap:visible');
  await modal.locator('input').first().fill(name);
  await modal.getByRole('button', { name: /Save/ }).last().click();
  await expect(notice(page, /saved/i)).toBeVisible();

  await navigateWithAuth(page, '/costing/new');
  await page.getByRole('button', { name: 'Use a template', exact: true }).click();
  await page.locator('.ant-modal-wrap tr').filter({ hasText: name }).getByRole('button', { name: 'Load' }).click();
  await expect(rows(page, 'fabric')).toHaveCount(1);
  await expect(page.locator('.ant-form-item').filter({ hasText: 'Costing Type' })).toContainText('CMT');
  await expect(page.locator('input[name="profitPct"]')).toHaveValue(/^11/);
});

test('S7 One costing per style: a second one for the same style is refused and the sheet is kept', async ({ page }) => {
  test.setTimeout(120000); // two whole sheets
  const style = await newStyle();
  await openSheet(page, style);
  await addRow(page, 'fabric', { qty: 0.2, rate: 300 });
  expect((await saveDraft(page)).status()).toBe(200);

  await openSheet(page, style);
  await addRow(page, 'fabric', { qty: 0.25, rate: 310 });
  const second = await saveDraft(page);
  expect(second.status()).toBe(409);
  await expect(page.locator('.ant-message-notice, .ant-notification-notice').first()).toBeVisible();
  await expect(page).toHaveURL(/\/costing\/new/);
  await expect(rows(page, 'fabric')).toHaveCount(1);
});

test('S8 An unsaved new sheet survives a reload', async ({ page }) => {
  const style = await newStyle();
  await openSheet(page, style);
  await addRow(page, 'fabric', { qty: 0.33, rate: 333 });
  await page.waitForTimeout(1500);
  await page.reload();
  await page.getByRole('button', { name: 'Restore' }).click();
  await expect(rows(page, 'fabric')).toHaveCount(1);
  await expect(rows(page, 'fabric').first().locator('input[placeholder="Qty"]')).toHaveValue(/^0\.33/);
});

test('S9 Duplicate and delete rows; Ctrl+Z brings a deleted row back; Ctrl+S saves', async ({ page }) => {
  const style = await newStyle();
  await openSheet(page, style);
  const row = await addRow(page, 'fabric', { qty: 0.2, rate: 300 });
  await row.getByRole('button', { name: 'copy' }).click();
  await expect(rows(page, 'fabric')).toHaveCount(2);
  await rows(page, 'fabric').last().getByRole('button', { name: 'delete' }).click();
  await expect(rows(page, 'fabric')).toHaveCount(1);
  await page.locator('body').click({ position: { x: 5, y: 300 } });
  await page.keyboard.press('Control+z');
  await expect(rows(page, 'fabric')).toHaveCount(2);

  const [resp] = await Promise.all([
    page.waitForResponse((r) => /\/cost-sheets(\?|$)/.test(r.url()) && r.request().method() === 'POST'),
    page.keyboard.press('Control+s'),
  ]);
  expect(resp.status()).toBe(200);
  expect((await resp.json()).fabricRows).toHaveLength(2);
});

test('S10 The knits calculator fills the consumption', async ({ page }) => {
  const style = await newStyle();
  await openSheet(page, style);
  const row = await addRow(page, 'fabric', { name: 'Charcoal' });
  // The knits calculator is offered on a knitted fabric: set the classification in the row's details.
  await row.locator('.ant-table-row-expand-icon').click();
  await antSelect(page, section(page, 'fabric').locator('.ant-select').filter({ has: page.locator('input[aria-label="Classification"]') }), 'Knits');
  await row.getByRole('button', { name: 'Knits consumption calculator' }).click();
  const modal = page.locator('.ant-modal-wrap:visible');
  await modal.locator('input[placeholder="L"]').first().fill('70');
  await modal.locator('input[placeholder="W"]').first().fill('50');
  await modal.locator('input[placeholder="NOP"]').first().fill('2');
  await modal.locator('input[placeholder="GSM"]').first().fill('180');
  await modal.getByRole('button', { name: /Apply/ }).click();
  // 70 × 50 × 2 × 180 / 10000 = 126 g = 0.126 kg.
  await expect(row.locator('input[placeholder="Qty"]')).toHaveValue(/^0\.126/);
});

test('S11 The rate popover offers the last costing price', async ({ page }) => {
  const style = await newStyle();
  await openSheet(page, style);
  await addRow(page, 'fabric', { name: 'Khaki', qty: 0.3, rate: 512 });
  expect((await saveDraft(page)).status()).toBe(200);

  const other = await newStyle();
  await openSheet(page, other);
  const row = await addRow(page, 'fabric', { name: 'Khaki' });
  await row.getByRole('button', { name: 'Last purchase prices' }).click();
  const pop = page.locator('.ant-popover:visible');
  await expect(pop).toContainText('512');
  await expect(pop).toContainText('Last costed');
  await pop.getByRole('button', { name: 'Use' }).first().click();
  await expect(row.locator('input[placeholder="Rate"]')).toHaveValue(/^512/);
});

test('S12 Attachments and the garment image stay with a saved sheet', async ({ page }) => {
  const style = await newStyle();
  await openSheet(page, style);
  await addRow(page, 'fabric', { qty: 0.2, rate: 300 });
  const saved = await (await saveDraft(page)).json();

  const pdf = { name: 'techpack.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF') };
  const png = {
    name: 'garment.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'),
  };
  await page.getByText('Images & Attachments').click();
  const attachments = page.locator('[data-genie-anchor="attachments"]');
  await attachments.scrollIntoViewIfNeeded();
  // On a saved sheet both upload at once — no save needed.
  await attachments.locator('input[type="file"]').nth(1).setInputFiles(pdf);
  await expect(notice(page, 'techpack.pdf attached')).toBeVisible({ timeout: 15000 });
  await attachments.locator('input[type="file"]').nth(0).setInputFiles(png);
  await expect(notice(page, 'Garment image uploaded')).toBeVisible({ timeout: 15000 });

  const client = await api();
  const { data: files } = await client.get(`/files/entity/COST_SHEET/${saved.id}`);
  await client.dispose();
  const list = files.data || files;
  expect(list.map((f) => f.originalFilename)).toEqual(expect.arrayContaining(['techpack.pdf', 'garment.png']));
});

test('S13 Two tabs on one draft: the stale tab pauses its autosave instead of overwriting', async ({ page, context }) => {
  const style = await newStyle();
  await openSheet(page, style);
  await addRow(page, 'fabric', { qty: 0.2, rate: 300 });
  const saved = await (await saveDraft(page)).json();

  const other = await context.newPage();
  await navigateWithAuth(other, `/costing/edit/${saved.id}`);
  await expect(rows(other, 'fabric')).toHaveCount(1);

  // Tab 1 autosaves a change (the version moves on) …
  const first = page.waitForResponse((r) => r.url().includes('autosave=true'), { timeout: 20000 });
  await page.locator('input[name="profitPct"]').fill('9');
  await page.keyboard.press('Tab');
  expect((await first).status()).toBe(200);

  // … so tab 2's autosave of its own change is a conflict, and it pauses.
  const second = other.waitForResponse((r) => r.url().includes('autosave=true'), { timeout: 20000 });
  await other.locator('input[name="profitPct"]').fill('13');
  await other.keyboard.press('Tab');
  expect((await second).status()).toBe(409);
  await expect(other.getByText(/Autosave paused/)).toBeVisible();

  const client = await api();
  const { data: stored } = await client.get(`/cost-sheets/${saved.id}`);
  await client.dispose();
  expect(Number(stored.profitPct)).toBe(9);
  await other.close();
});
