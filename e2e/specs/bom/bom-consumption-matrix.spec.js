/**
 * BOM — the size-wise / variant-per-size Consumption Matrix dialog keeps what is typed into it.
 *
 * Production defect (2026-11-21): entering consumption size-wise, the screen closed and the inputs
 * were lost. Ctrl+S inside the dialog clicked the PAGE's "Update BOM" button — the global shortcut
 * took the first primary button in document order, and the page comes before any dialog — so the
 * BOM was saved (and a draft released) without the dialog's values, and the screen left for the list.
 * A stray click beside the dialog also closed it and threw the values away.
 *
 * What this tests:
 *   - Ctrl+S inside the matrix applies the matrix (the dialog's own Apply) and stays on the BOM:
 *     nothing is written to the server, the draft stays a draft, the typed value is on the line
 *   - with a Quick Fill value typed, Ctrl+S still presses the matrix's Apply, not the fill's
 *   - a click outside the matrix leaves it open with the typed value
 *   - with no dialog open, Ctrl+S still saves the BOM from the page, as it always did
 */

import { test, expect } from '@playwright/test';
import { ensureSessionActive, navigateWithAuth } from '../../helpers/navigation.js';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { seedConfirmedOrder, loadBomRefs, buildBomPayload } from '../../helpers/bom-seed.js';

let api;
let seeded;
let bomId;

test.beforeAll(async () => {
  api = await createAuthenticatedClient();
  seeded = await seedConfirmedOrder(api);
  const refs = await loadBomRefs(api);
  // One SIZE_WISE fabric line whose matrix is already complete, so the BOM itself is valid
  const matrix = {};
  for (const line of seeded.order.orderLines || []) {
    for (const row of line.colorRows || []) {
      matrix[row.colorName] ||= {};
      for (const size of Object.keys(row.quantities || {})) matrix[row.colorName][size] = 1.5;
    }
  }
  const payload = buildBomPayload(seeded.order, refs);
  Object.assign(payload.lines[0], { consumptionMode: 'SIZE_WISE', consumptionPerGarment: null, consumptionMatrix: matrix });
  bomId = (await api.post('/boms', payload)).data.id;
});

test.afterAll(async () => {
  try { await api.delete(`/boms/${bomId}`); } catch { /* gone */ }
  try { await api.delete(`/orders/${seeded.order.id}`); } catch { /* gone */ }
  try { await api.delete(`/cost-sheets/${seeded.costSheetId}`); } catch { /* gone */ }
  await api.dispose();
});

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
  page.on('pageerror', (err) => console.log(`[browser:pageerror] ${err.message}`));
});

const matrixTitle = (page) => page.locator('.ant-modal-title', { hasText: 'Consumption Matrix' });
const matrixCells = (page) => page.locator('.ant-modal-body table tbody input');

/** Opens the line's matrix from the pencil in its Consumption cell. */
async function openMatrix(page) {
  await navigateWithAuth(page, `/bom/edit/${bomId}`);
  const headers = page.locator('.ant-table thead th');
  await expect(headers.filter({ hasText: /^Consumption$/ })).toHaveCount(1, { timeout: 30000 });
  const column = (await headers.allTextContents()).findIndex((t) => t.trim() === 'Consumption');
  const cell = page.locator('.ant-table tbody tr.ant-table-row').first().locator('td').nth(column);
  await cell.locator('[aria-label="edit"]').click({ force: true });
  await expect(matrixTitle(page)).toBeVisible();
  await expect(matrixCells(page).first()).toHaveValue('1.5000');
}

test('Ctrl+S inside the matrix applies it and stays on the BOM', async ({ page }) => {
  await openMatrix(page);
  const writes = [];
  page.on('request', (r) => {
    if (/\/boms\b/.test(r.url()) && ['POST', 'PUT', 'PATCH'].includes(r.method())) writes.push(`${r.method()} ${r.url()}`);
  });

  await matrixCells(page).first().fill('9.75');
  await page.keyboard.press('Control+s');

  await expect(matrixTitle(page)).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`/bom/edit/${bomId}$`));
  expect(writes).toEqual([]);
  expect((await api.get(`/boms/${bomId}`)).data.status).toBe('DRAFT');

  // The typed value went onto the line: the matrix opens again with it
  const headers = page.locator('.ant-table thead th');
  const column = (await headers.allTextContents()).findIndex((t) => t.trim() === 'Consumption');
  await page.locator('.ant-table tbody tr.ant-table-row').first().locator('td').nth(column)
    .locator('[aria-label="edit"]').click({ force: true });
  await expect(matrixCells(page).first()).toHaveValue('9.7500');
});

test('Ctrl+S presses the matrix Apply, not its Quick Fill Apply', async ({ page }) => {
  await openMatrix(page);
  await matrixCells(page).first().fill('3.5');
  await page.locator('.ant-modal-body input').first().fill('7'); // the Quick Fill value: its Apply turns on
  await page.keyboard.press('Control+s');

  await expect(matrixTitle(page)).toBeHidden();
  const headers = page.locator('.ant-table thead th');
  const column = (await headers.allTextContents()).findIndex((t) => t.trim() === 'Consumption');
  await page.locator('.ant-table tbody tr.ant-table-row').first().locator('td').nth(column)
    .locator('[aria-label="edit"]').click({ force: true });
  await expect(matrixCells(page).first()).toHaveValue('3.5000'); // not filled with 7
  await expect(matrixCells(page).nth(1)).toHaveValue('1.5000');
});

test('A click outside the matrix does not close it', async ({ page }) => {
  await openMatrix(page);
  await matrixCells(page).first().fill('4.25');

  await page.mouse.click(5, 5); // the viewport's corner: the dimmed backdrop around the centred dialog

  await expect(matrixTitle(page)).toBeVisible();
  await expect(matrixCells(page).first()).toHaveValue('4.2500');
});

test('With no dialog open, Ctrl+S still saves the BOM from the page', async ({ page }) => {
  await navigateWithAuth(page, `/bom/edit/${bomId}`);
  await expect(page.getByRole('button', { name: /Update BOM/ })).toBeEnabled({ timeout: 30000 });
  const saved = page.waitForRequest((r) => r.method() === 'PUT' && new RegExp(`/boms/${bomId}$`).test(r.url()));
  await page.keyboard.press('Control+s');
  await saved;
  await expect(page).toHaveURL(/\/bom\/list/);
});
