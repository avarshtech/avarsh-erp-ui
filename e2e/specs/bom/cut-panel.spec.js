/**
 * BOM — Cut Panel Requirement, on the real API (/cut-panel-requirements).
 *
 * The e2e seed's ORD/0002 (Men's Winter Jacket; Olive Green, Burgundy, Camel, Slate Blue; S–XL) has a CREATED
 * BOM with the Single Jersey and Pique fabrics. Requirements made by beforeAll come through the API
 * (e2e/helpers/job-work-api.js); numbers are the server's, CPRQ/<FY>/NNNN.
 *
 * What this tests:
 *   - BOM menu: BOM · Cut Panel · Garment Process, and no "Create BOM" item
 *   - Create: order → the order's BOM no. read-only → fabric, colour, panel, process → Add to Grid (quantities
 *     from the order) → Save Draft (server number) → Submit (WRN-03 confirm: colours without a process)
 *   - The order picker loads the newest ten eligible orders, then asks the server for what is typed (exact
 *     order no. first) — never every order (owner, 2026-11-21)
 *   - A panel cut twice per garment asks for the order quantity, not double it — on the screen and as
 *     the server stores it (owner, 2026-11-21: quantities do not count parts)
 *   - Edit a submitted CPR in place: a changed quantity needs a reason; stays Submitted; History shows R1
 *   - Close needs a reason
 *   - The list pages and filters on the server
 */

import { test, expect } from '@playwright/test';
import { ensureSessionActive, navigateWithAuth, waitForPageReady } from '../../helpers/navigation.js';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { submittedCpr } from '../../helpers/job-work-api.js';
import { partPayload } from '../../helpers/test-data.js';

async function pickOption(page, id, text) {
  await page.locator(`#${id}`).locator('xpath=ancestor::div[contains(@class,"ant-select")][1]').click();
  const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  await dropdown.waitFor({ state: 'visible' });
  await page.keyboard.type(text);
  await dropdown.locator('.ant-select-item-option').filter({ hasText: text }).first().click();
}

const lineRow = (page, process) => page.locator('.ant-table-row').filter({ hasText: process }).first();

/** The action bar's Edit ("edit Edit" with its icon) — never "Cancel edit" or a list row's "Edit CPRQ/…". */
const editButton = (page) => page.getByRole('button', { name: /(^|\s)Edit$/ });

let editable;
let closable;

test.beforeAll(async () => {
  const api = await createAuthenticatedClient();
  try {
    editable = await submittedCpr(api, { orderNo: 'ORD/0002', colour: 'Burgundy' });
    closable = await submittedCpr(api, { orderNo: 'ORD/0002', colour: 'Camel', panel: 'Back Panel' });
  } finally {
    await api.dispose();
  }
});

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
  page.on('pageerror', (err) => console.log(`[browser:pageerror] ${err.message}`));
});

test('BOM menu lists BOM, Cut Panel and Garment Process — no Create BOM item', async ({ page }) => {
  await navigateWithAuth(page, '/bom/cut-panel/list');
  const sider = page.locator('.ant-layout-sider');
  for (const item of [/^BOM$/, /^Cut Panel$/, /^Garment Process$/]) {
    await expect(sider.locator('.ant-menu-item').filter({ hasText: item })).toBeVisible();
  }
  await expect(sider.locator('.ant-menu-item').filter({ hasText: /^Create BOM$/ })).toHaveCount(0);
});

test('Create: order and its BOM, expand, save with the server number, submit', async ({ page }) => {
  await navigateWithAuth(page, '/bom/cut-panel/new');
  await waitForPageReady(page);

  await pickOption(page, 'cpr-order', 'ORD/0002');
  await expect(page.locator('.ant-form-item').filter({ hasText: 'BOM No.' })).toContainText('ORD/0002'); // read-only, the order's own BOM
  await pickOption(page, 'cpr-fabric', 'Single Jersey');
  await pickOption(page, 'cpr-colours', 'Olive Green');
  await page.keyboard.press('Escape');
  await pickOption(page, 'cpr-panels', 'Front Panel');
  await page.keyboard.press('Escape');
  await pickOption(page, 'cpr-processes', 'Panel Printing');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Add to Grid/ }).click();
  await expect(page.getByText(/1 line added for .*Front Panel/)).toBeVisible();
  await expect(lineRow(page, 'Panel Printing').locator('input[name$="-M"]')).toHaveValue('200'); // the order's Olive Green M

  await page.getByRole('button', { name: 'Save Draft' }).click();
  await expect(page.getByText('Draft saved')).toBeVisible();
  await expect(page).toHaveURL(/\/bom\/cut-panel\/\d+$/);
  await expect(page.getByRole('heading', { name: /CPRQ\/\d{2}-\d{2}\/\d+/ })).toBeVisible();

  await page.getByRole('button', { name: 'Submit' }).click();
  const confirm = page.locator('.ant-modal-confirm').last(); // WRN-03: the other three colours have no process
  await expect(confirm).toContainText('Burgundy, Camel, Slate Blue');
  await confirm.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText(/Submitted — the requirement is now available/)).toBeVisible();
  await expect(editButton(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save Draft' })).toHaveCount(0);
});

test('The order picker opens on the newest ten and asks the server for what is typed', async ({ page }) => {
  const eligible = (r) => r.url().includes('/cut-panel-requirements/eligible-orders');
  const opening = page.waitForRequest(eligible);
  await navigateWithAuth(page, '/bom/cut-panel/new');
  const first = new URL((await opening).url()).searchParams;
  expect(first.get('limit')).toBe('10'); // never every eligible order (owner, 2026-11-21)
  expect(first.get('q')).toBeNull();
  await waitForPageReady(page);

  const searched = page.waitForRequest((r) => eligible(r) && new URL(r.url()).searchParams.get('q') === 'ORD/0002');
  await pickOption(page, 'cpr-order', 'ORD/0002');
  expect(new URL((await searched).url()).searchParams.get('limit')).toBe('10');
  await expect(page.locator('.ant-form-item').filter({ hasText: 'BOM No.' })).toContainText('ORD/0002');

  // The server answers with matches, the exact order no. first
  const api = await createAuthenticatedClient();
  try {
    const found = (await api.get('/cut-panel-requirements/eligible-orders', { q: 'ORD/0002', limit: 10 })).data;
    expect(found[0].orderNo).toBe('ORD/0002');
    expect(found.every((o) => [o.orderNo, o.styleNo, o.buyer].join(' ').toLowerCase().includes('ord/0002'))).toBe(true);
    expect((await api.get('/cut-panel-requirements/eligible-orders', { q: 'no such order zz', limit: 10 })).data).toEqual([]);
  } finally {
    await api.dispose();
  }
});

test('A panel cut twice per garment asks for the order quantity, not double it', async ({ page }) => {
  const api = await createAuthenticatedClient();
  const part = (await api.post('/parts', partPayload({ partName: `E2E Paired Panel ${Date.now().toString().slice(-6)}`, panelsPerGarment: 2 }))).data;
  let draftId = null;
  try {
    await navigateWithAuth(page, '/bom/cut-panel/new');
    await waitForPageReady(page);
    await pickOption(page, 'cpr-order', 'ORD/0002');
    await expect(page.locator('.ant-form-item').filter({ hasText: 'BOM No.' })).toContainText('ORD/0002');
    await pickOption(page, 'cpr-fabric', 'Single Jersey');
    await pickOption(page, 'cpr-colours', 'Olive Green');
    await page.keyboard.press('Escape');
    await pickOption(page, 'cpr-panels', part.partName);
    await page.keyboard.press('Escape');
    await pickOption(page, 'cpr-processes', 'Panel Printing');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /Add to Grid/ }).click();
    await expect(lineRow(page, 'Panel Printing').locator('input[name$="-M"]')).toHaveValue('200'); // the order's M, not 400
    await expect(lineRow(page, 'Panel Printing')).not.toContainText('×'); // no "×2" beside the panel: it does not multiply

    await page.getByRole('button', { name: 'Save Draft' }).click();
    await expect(page).toHaveURL(/\/bom\/cut-panel\/\d+$/);
    draftId = page.url().match(/(\d+)$/)[1];
    const line = (await api.get(`/cut-panel-requirements/${draftId}`)).data.lines[0];
    expect(line.panelsPerGarment).toBe(2);
    expect(line.sizes.M).toMatchObject({ baseQty: 200, calculatedQty: 200, requiredQty: 200 });
    expect(line.isManualOverride).toBe(false);
  } finally {
    // The draft first: while it names the part, the part cannot go
    if (draftId) { try { await api.delete(`/cut-panel-requirements/${draftId}`); } catch { /* gone */ } }
    try { await api.delete(`/parts/${part.id}`); } catch { /* gone */ }
    await api.dispose();
  }
});

test('Edit a submitted CPR in place: a changed quantity needs a reason; History shows the revision', async ({ page }) => {
  await navigateWithAuth(page, `/bom/cut-panel/${editable.id}`);
  await waitForPageReady(page);
  await editButton(page).click();
  await expect(page).toHaveURL(new RegExp(`/bom/cut-panel/${editable.id}\\?edit=1$`));

  const printing = lineRow(page, 'Panel Printing'); // Burgundy Front Panel, M 200
  await printing.locator('input[name$="-M"]').fill('205');
  await printing.locator('input[name$="-M"]').press('Tab');
  await printing.locator('input[name^="reason-"]').fill('Buyer asked for 5 spare fronts');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.locator('.ant-modal-confirm').last().getByRole('button', { name: 'Save changes' }).click(); // WRN-03
  await expect(page.getByText('Changes saved — the requirement stays submitted')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/bom/cut-panel/${editable.id}$`));
  await expect(page.getByText('Submitted', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'History' }).click();
  const history = page.locator('.ant-drawer-open');
  await expect(history).toContainText('revised the requirement (R1)');
  await expect(history).toContainText('200 → 205');
});

test('Close needs a reason', async ({ page }) => {
  await navigateWithAuth(page, `/bom/cut-panel/${closable.id}`);
  await waitForPageReady(page);
  await page.getByRole('button', { name: 'Close' }).click();
  const dialog = page.locator('.ant-modal').last();
  await expect(dialog.getByRole('button', { name: 'Close Requirement' })).toBeDisabled();
  await dialog.locator('textarea').fill('Order short-shipped, balance not needed');
  await dialog.getByRole('button', { name: 'Close Requirement' }).click();
  await expect(page.getByText('Requirement closed')).toBeVisible();
  await expect(page.locator('.ant-alert-description').filter({ hasText: 'Order short-shipped, balance not needed' })).toBeVisible();
});

test('The list pages and filters on the server', async ({ page }) => {
  await navigateWithAuth(page, '/bom/cut-panel/list');
  await expect(page.locator('.ant-table-row').filter({ hasText: editable.cprNo })).toContainText('ORD/0002');

  const search = Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/v1/cut-panel-requirements?') && r.url().includes('search=')),
    page.getByPlaceholder(/Search CPR no/).fill(closable.cprNo),
  ]);
  await search;
  await expect(page.locator('.ant-table-row')).toHaveCount(1);
  await expect(page.locator('.ant-table-row').first()).toContainText(closable.cprNo);
});
