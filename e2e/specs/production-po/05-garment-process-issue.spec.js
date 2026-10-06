/**
 * Finishing › External Process — garments sent out against an approved Garment Process PO and received back.
 *
 * beforeAll makes, through the API (e2e/helpers/job-work-api.js): a submitted Garment Process Requirement on
 * ORD/0003 (Garment Washing) with an approved Garment Process PO on its first two cells (Kongu Garment Wash), an
 * approved in-house cutting PO and IN-HOUSE work order planning those cells, and an OUTSOURCED work order.
 *
 * What this tests:
 *   - An in-house work order issues against the approved Garment Process PO (D4, D7): the PO's process, vendor,
 *     dates and instructions read-only; no vendor, issue date or due-back inputs; the first DC sends the PO (D5)
 *   - Receiving the garments back posts to the PO, which completes (D6)
 *   - An outsourced work order keeps the free-text issue (process, vendor and dates)
 */

import { test, expect } from '@playwright/test';
import { ensureSessionActive, navigateWithAuth, waitForPageReady } from '../../helpers/navigation.js';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import {
  submittedGpr, garmentProcessPo, approvedCuttingPo, approvedWorkOrder, getGarmentProcessPo, VENDOR,
} from '../../helpers/job-work-api.js';

async function pickIn(page, select, text) {
  await select.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await select.click();
  const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  await dropdown.waitFor({ state: 'visible' });
  await page.keyboard.type(text);
  await dropdown.locator('.ant-select-item-option').filter({ hasText: text }).first().click();
  await dropdown.waitFor({ state: 'hidden' }).catch(() => {});
}

const selectById = (page, id) => page.locator(`#${id}`).locator('xpath=ancestor::div[contains(@class,"ant-select")][1]');
const selectByName = (page, name) => page.getByRole('combobox', { name }).locator('xpath=ancestor::div[contains(@class,"ant-select")][1]');

async function openTab(page) {
  await navigateWithAuth(page, '/production/finishing?tab=external-process');
  await waitForPageReady(page);
}

const fx = {};

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const api = await createAuthenticatedClient();
  try {
    fx.gpr = await submittedGpr(api, { orderNo: 'ORD/0003', process: 'Garment Washing' });
    fx.gpo = await garmentProcessPo(api, fx.gpr, { cells: 2 });
    const rows = fx.gpo.lines.map((l) => ({ color: l.color, size: l.size, qty: Number(l.poQty) }));
    const cut = await approvedCuttingPo(api, { orderNo: 'ORD/0003', rows });
    fx.wo = await approvedWorkOrder(api, { orderNo: 'ORD/0003', cuttingPoId: cut.id, rows });
    fx.outsourced = await approvedWorkOrder(api, { orderNo: 'ORD/0003', cuttingPoId: cut.id, rows, unitType: 'VENDOR' });
  } finally {
    await api.dispose();
  }
});

test.beforeEach(async ({ page }) => {
  test.setTimeout(120000);
  await ensureSessionActive(page);
  page.on('pageerror', (err) => console.log(`[browser:pageerror] ${err.message}`));
});

test('An in-house work order issues against the approved Garment Process PO; the first DC sends it', async ({ page }) => {
  const total = fx.gpo.lines.reduce((s, l) => s + Number(l.poQty), 0);
  await openTab(page);
  await page.getByRole('button', { name: /Issue Garments/ }).click();
  const drawer = page.locator('.ant-drawer-open');
  await pickIn(page, selectById(page, 'workOrderId'), fx.wo.workOrderNo);
  await expect(drawer.getByText('In-house — against a Garment Process PO')).toBeVisible();
  await expect(drawer.getByText('Issue Date', { exact: true })).toHaveCount(0); // dated today by the server
  await expect(drawer.getByText('Due Back', { exact: true })).toHaveCount(0);

  await pickIn(page, selectByName(page, 'Garment Process PO'), fx.gpo.poNo);
  await expect(drawer).toContainText(VENDOR.wash); // read-only, from the PO
  await expect(drawer).toContainText('Enzyme wash, soft hand feel');
  await expect(drawer.getByRole('combobox', { name: 'Process', exact: true })).toBeDisabled();
  const rows = drawer.locator('.ant-table-row');
  await expect(rows).toHaveCount(fx.gpo.lines.length);
  const inputs = drawer.locator('input[name^="issue-"]'); // each row up to what both the WO and the PO allow
  for (let i = 0; i < fx.gpo.lines.length; i += 1) {
    await inputs.nth(i).fill(await inputs.nth(i).getAttribute('aria-valuemax'));
  }
  await expect(drawer).toContainText(`Total: ${total} pcs`);
  await drawer.getByRole('button', { name: /^Issue$/ }).click();
  const toast = page.getByText(/issued to Garment Washing/);
  await expect(toast).toBeVisible();
  fx.issueNo = (await toast.textContent()).trim().split(' ')[0];

  const api = await createAuthenticatedClient();
  try {
    const po = await getGarmentProcessPo(api, fx.gpo.id);
    expect(po.status).toBe('SENT_TO_VENDOR');
    expect(po.lines.reduce((s, l) => s + Number(l.issuedQty), 0)).toBe(total);
  } finally {
    await api.dispose();
  }
});

test('Receiving the garments back posts to the PO, which completes', async ({ page }) => {
  await openTab(page);
  await page.getByRole('button', { name: `Receive ${fx.issueNo}` }).click();
  const drawer = page.locator('.ant-drawer-open');
  await expect(drawer.locator('.ant-table-row').first()).toBeVisible();
  const inputs = drawer.locator('input[name^="received-"]');
  const count = await inputs.count();
  for (let i = 0; i < count; i += 1) {
    const max = await inputs.nth(i).getAttribute('aria-valuemax');
    await inputs.nth(i).fill(max);
  }
  await drawer.getByRole('button', { name: /^Receive$/ }).click();
  await expect(page.getByText(/received against/)).toBeVisible();

  const api = await createAuthenticatedClient();
  try {
    expect((await getGarmentProcessPo(api, fx.gpo.id)).status).toBe('COMPLETED');
  } finally {
    await api.dispose();
  }
});

test('An outsourced work order keeps the free-text issue', async ({ page }) => {
  await openTab(page);
  await page.getByRole('button', { name: /Issue Garments/ }).click();
  const drawer = page.locator('.ant-drawer-open');
  await pickIn(page, selectById(page, 'workOrderId'), fx.outsourced.workOrderNo);
  await expect(drawer.getByText('Outsourced unit')).toBeVisible();
  await expect(drawer.getByText('Issue Date', { exact: true })).toBeVisible();
  await expect(drawer.getByText('Vendor', { exact: true })).toBeVisible();
  await expect(drawer.getByRole('combobox', { name: 'Garment Process PO' })).toHaveCount(0);
});
