/**
 * QC approval → UI refresh (Fabric + Accessories)
 *
 * Reproduces the reported bug: approving a Pending_Approval QC with
 * "Conditional Pass" leaves the open View modal AND the list row still showing
 * "Pending Approval" until the page is reloaded.
 *
 * Both halves are asserted separately so a failure says which one broke.
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { navigateWithAuth, ensureSessionActive, waitForPageReady } from '../../helpers/navigation.js';
import {
  findPOByNumber, fabricGrnPayload, fabricQcPayload, trimsGrnPayload, trimsQcPayload,
  submitGrn, submitQc, getTrimsQCCriteria,
} from '../../helpers/grn-qc-data.js';

test.describe.configure({ timeout: 180000 });

let api;
let fabricQc;
let trimsQc;

/** Submit a fabric GRN + QC against `poNumber`; returns the Pending_Approval QC. */
async function seedFabricQc(poNumber) {
  const po = await findPOByNumber(api, poNumber);
  const item = po.items.find((i) => i.pendingQty > 0);
  if (!item) throw new Error(`PO '${poNumber}' has no pending line item`);
  const stamp = Date.now().toString(36);
  const payload = fabricGrnPayload(po, [item], {
    [item.id]: [{ rollNumber: `RF-${stamp}`, receivingQty: 20, shadeLot: 'SL-REFRESH' }],
  });
  // Seeded PO items carry width as free text ("72 inch"); the GRN DTO wants a number.
  payload.lineItems.forEach((li) => li.rolls.forEach((r) => {
    r.width = Number.parseFloat(r.width) || 44;
    r.gsm = Number.parseFloat(r.gsm) || 180;
  }));
  const grn = await submitGrn(api, payload);
  return submitQc(api, fabricQcPayload(grn, item.id, { inspector: `Refresh ${stamp}` }));
}

/** Submit an accessories GRN + QC against `poNumber`; returns the Pending_Approval QC. */
async function seedTrimsQc(poNumber) {
  const po = await findPOByNumber(api, poNumber);
  const item = po.items.find((i) => i.pendingQty > 0);
  if (!item) throw new Error(`PO '${poNumber}' has no pending line item`);
  const stamp = Date.now().toString(36);
  const receiveQty = Math.min(20, item.pendingQty);
  const payload = trimsGrnPayload(po, [item], {
    [item.id]: [{ cartonNumber: `CTN-${stamp}`, quantity: receiveQty }],
  });
  const pItem = payload.items?.find((i) => i.poLineItemId === item.id);
  if (pItem) pItem.receivingQty = receiveQty;
  const grn = await submitGrn(api, payload);

  const criteria = await getTrimsQCCriteria(api);
  const rows = criteria.slice(0, 3).map((c) => ({
    id: c.id, criteria: c.criteriaName || c.name, ok: true, notOk: false, remarks: '',
  }));
  return submitQc(api, trimsQcPayload(grn, item.id, rows, { inspector: `Refresh ${stamp}` }));
}

test.beforeAll(async () => {
  api = await createAuthenticatedClient();
  fabricQc = await seedFabricQc('E2E-FQ-1');
  trimsQc = await seedTrimsQc('E2E-AQ-1');
});

test.afterAll(async () => { await api.dispose(); });

test.beforeEach(async ({ page }) => { await ensureSessionActive(page); });

/**
 * Drive the QC view modal to a Conditional Pass approval, then assert the modal
 * and the list row both show the new status without a page reload.
 */
async function approveConditionallyAndAssert(page, qc, segmentLabel) {
  await navigateWithAuth(page, '/inventory/qc');
  await waitForPageReady(page);

  // Late in a long suite run the QC page can take a while to paint; wait for the
  // segmented switcher itself rather than clicking into a not-yet-rendered page.
  const segment = page.locator('.ant-segmented-item', { hasText: segmentLabel }).first();
  await expect(segment).toBeVisible({ timeout: 60000 });
  await segment.click();
  await expect(page.locator('.ant-table')).toBeVisible({ timeout: 30000 });

  // Filter the list down to the seeded QC so the row is unambiguous.
  await page.locator('input[placeholder^="Search QC"]').first().fill(qc.qcNumber);
  await page.waitForTimeout(2000);

  const row = page.locator('.ant-table-tbody tr', { hasText: qc.qcNumber }).first();
  await expect(row).toBeVisible({ timeout: 20000 });
  await expect(row).toContainText('Pending Approval');

  // Open the View modal.
  await row.getByText(qc.qcNumber).first().click();
  const modal = page.locator('.po-view-modal').first();
  await expect(modal).toBeVisible({ timeout: 15000 });
  await expect(modal).toContainText('Pending Approval');

  // Approve → tick Conditional Pass → confirm.
  await modal.getByRole('button', { name: /Approve/ }).first().click();
  const reasonDialog = page.getByRole('dialog').filter({ hasText: 'Mark as Conditional Pass' }).first();
  await expect(reasonDialog).toBeVisible({ timeout: 15000 });
  await expect(reasonDialog).toContainText('Pending Approval → Approved');
  await reasonDialog.getByRole('checkbox', { name: 'Mark as Conditional Pass' }).check();
  // Ticking the box must re-title the dialog — it used to keep promising
  // "→ Approved" while it was about to record a Conditional Pass.
  await expect(reasonDialog, 'dialog did not re-title for Conditional Pass')
    .toContainText('Pending Approval → Conditional Pass');
  // The confirm button is the last one in the dialog footer, next to "Go Back".
  await reasonDialog.getByRole('button').last().click();

  // The reason dialog must go away — that is the "approve dialog closes" step.
  await expect(reasonDialog).toBeHidden({ timeout: 20000 });

  // Server-side truth: the QC really is Conditional_Pass.
  await expect.poll(async () => (await api.get(`/qc/${qc.id}`)).data.status,
    { timeout: 20000 }).toBe('Conditional_Pass');

  // BUG A — the still-open view modal must show the new status in its hero tag.
  await expect(modal.locator('.ant-tag').first(), 'view modal status did not refresh')
    .toHaveText('Conditional Pass', { timeout: 10000 });

  // BUG B — the list row behind it must show the new status too.
  await modal.getByRole('button', { name: /Close/ }).last().click();
  await expect(modal).toBeHidden({ timeout: 10000 });
  await expect(row, 'list row status did not refresh').toContainText('Conditional Pass', { timeout: 10000 });
}

test('Fabric QC: conditional-pass approval refreshes modal and list', async ({ page }) => {
  await approveConditionallyAndAssert(page, fabricQc, 'Fabric Quality Control');
});

test('Accessories QC: conditional-pass approval refreshes modal and list', async ({ page }) => {
  await approveConditionallyAndAssert(page, trimsQc, 'Accessories Quality Control');
});
