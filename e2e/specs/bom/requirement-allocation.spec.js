/**
 * BOM — requirement status and PO allocation, as the job-work PO ledger on the server reports them.
 *
 * beforeAll makes, through the API: a Cut Panel Requirement on ORD/0002 (Olive Green Front Panel Panel Printing,
 * 600 pcs) with an approved Cut Panel PO on all of it, and a Garment Process Requirement on ORD/0003 (Garment
 * Washing, 4,900 pcs) with an approved Garment Process PO on its first two cells. No approval flow is configured,
 * so each PO's submit approves it.
 *
 * What this tests:
 *   - The CPR the PO takes in full reads Fully Used in the list; its allocation drawer shows the step 600 PO'd,
 *     balance 0, Fully allocated, with the PO
 *   - The GPR reads Partially Used; its process line shows what the PO holds and the balance, with the PO
 */

import { test, expect } from '@playwright/test';
import { ensureSessionActive, navigateWithAuth, waitForPageReady } from '../../helpers/navigation.js';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { submittedCpr, submittedGpr, cutPanelPo, garmentProcessPo } from '../../helpers/job-work-api.js';

const openAllocation = async (page, path) => {
  await navigateWithAuth(page, path);
  await waitForPageReady(page);
  await page.getByRole('button', { name: 'PO allocation' }).click();
  const drawer = page.locator('.ant-drawer-open').last();
  await expect(drawer.getByText('Purchase orders')).toBeVisible();
  return drawer;
};

const n = (v) => Number(v).toLocaleString('en-IN');

let cpr;
let cpp;
let gpr;
let gpo;

test.beforeAll(async () => {
  const api = await createAuthenticatedClient();
  try {
    cpr = await submittedCpr(api, { orderNo: 'ORD/0002', colour: 'Olive Green' });
    cpp = await cutPanelPo(api, cpr);
    gpr = await submittedGpr(api, { orderNo: 'ORD/0003', process: 'Pigment Dyeing' });
    gpo = await garmentProcessPo(api, gpr, { cells: 2 });
  } finally {
    await api.dispose();
  }
});

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
  page.on('pageerror', (err) => console.log(`[browser:pageerror] ${err.message}`));
});

test('Lists show the status the PO ledger derives', async ({ page }) => {
  await navigateWithAuth(page, '/bom/cut-panel/list');
  await expect(page.locator('.ant-table-row').filter({ hasText: cpr.cprNo })).toContainText('Fully Used');
  await navigateWithAuth(page, '/bom/garment-process/list');
  await expect(page.locator('.ant-table-row').filter({ hasText: gpr.requirementNo })).toContainText('Partially Used');
});

test('Cut panel allocation per process step, with the PO raised against it', async ({ page }) => {
  const drawer = await openAllocation(page, `/bom/cut-panel/${cpr.id}`);
  const printing = drawer.locator('.ant-table-row').filter({ hasText: 'Panel Printing' }).first();
  await expect(printing).toContainText('600');
  await expect(printing).toContainText('Fully allocated');
  await expect(drawer.getByRole('link', { name: cpp.poNo })).toBeVisible();
  await expect(drawer.locator('.ant-table-row').filter({ hasText: cpp.poNo })).toContainText('Approved');
});

test('An approved Garment Process PO counts against its requirement', async ({ page }) => {
  const held = gpo.lines.reduce((s, l) => s + Number(l.poQty), 0);
  const drawer = await openAllocation(page, `/bom/garment-process/${gpr.id}`);
  const line = drawer.locator('.ant-table-row').filter({ hasText: 'Pigment Dyeing' }).first();
  await expect(line).toContainText('4,900');
  await expect(line).toContainText(n(held));
  await expect(line).toContainText(n(4900 - held));
  await expect(line).toContainText('Partially allocated');
  await expect(drawer.locator('.ant-table-row').filter({ hasText: gpo.poNo })).toContainText('Approved');
});
