/**
 * Production flow 03 — the flow order's Cutting PO is raised and submitted on its screen (no CUTTING_PO
 * approval flow in the e2e seed, so the submit approves it), then stores issue both GRN rolls to it
 * whole on the Fabric Material Issue screen.
 */
import { test, expect } from '../../fixtures.js';
import { findFlowOrder } from '../../helpers/production-flow-seed.js';
import { waitForPageReady } from '../../helpers/navigation.js';
import { waitForTableSettled } from '../../helpers/ui-master.js';
import { selectOptionByText, pickToday, submitAnywayIfAsked, applyBulkRate, expectSuccessToast } from '../production-po/helpers.js';
import { chooseLabelled, successToast } from './helpers.js';

test.describe.configure({ mode: 'serial' });

let order;
let cuttingPo;

test.describe('Production flow — Cutting PO and fabric issue', () => {
  test.beforeAll(async ({ api }) => {
    order = await findFlowOrder(api);
  });

  test('a Cutting PO is raised on the flow order, rated and submitted, and comes back approved', async ({ api, authedPage, consoleGuard }) => {
    await authedPage.goto('/purchase-orders/cutting-po/new');
    await waitForPageReady(authedPage);

    await chooseLabelled(authedPage, 'Confirmed Order', order.orderNo);
    await expect(authedPage.locator('.ant-alert', { hasText: /PP Sample approved/i })).toBeVisible({ timeout: 10000 });
    await pickToday(authedPage, 'Planned Cut Date');
    await selectOptionByText(authedPage, 'Unit Unit', 'Unit 1');
    await pickToday(authedPage, 'Planned Delivery Date');

    await applyBulkRate(authedPage, 8);
    await authedPage.getByRole('button', { name: /Save & Submit/i }).click();
    await submitAnywayIfAsked(authedPage);
    await expectSuccessToast(authedPage, /submitted/i);
    await waitForPageReady(authedPage);

    const { data: approved } = await api.get(`/cutting-po/approved?orderId=${order.id}`);
    expect(approved).toHaveLength(1);
    cuttingPo = approved[0];
    expect(cuttingPo.status).toBe('APPROVED');
    expect(cuttingPo.bomId).toBeTruthy();
    // Every colour × size of the order is planned at its order quantity, at the bulk rate
    const planned = cuttingPo.items.reduce((s, i) => s + Number(i.plannedQty), 0);
    expect(planned).toBeGreaterThan(0);
    expect(cuttingPo.items.every((i) => Number(i.ratePerPiece) === 8)).toBeTruthy();

    // The list shows it approved
    await authedPage.goto('/purchase-orders/cutting-po/list');
    await waitForTableSettled(authedPage);
    await authedPage.locator('.ant-card input[placeholder*="Search"]').first().fill(cuttingPo.cuttingPoNo);
    await expect(authedPage.locator('.ant-table-row', { hasText: cuttingPo.cuttingPoNo }).locator('.ant-tag', { hasText: /Approved/i }))
      .toBeVisible({ timeout: 20000 });
    expect(consoleGuard).toEqual([]);
  });

  test('stores issue both GRN rolls whole to the Cutting PO', async ({ api, authedPage, consoleGuard }) => {
    const { data: rolls } = await api.get('/material-issues/issuable-rolls', { itemCode: 'FAB-SJ-001', orderRef: order.orderNo });
    const ours = rolls.filter((r) => r.orderRef === order.orderNo);
    expect(ours.length).toBeGreaterThanOrEqual(2);

    await authedPage.goto('/inventory/issue/fabric/new');
    await waitForPageReady(authedPage);
    await chooseLabelled(authedPage, 'Cutting PO', cuttingPo.cuttingPoNo);
    await selectOptionByText(authedPage, 'Cutting PO Line', order.orderNo);

    for (const roll of ours) {
      const row = authedPage.locator('.ant-table-row', { hasText: roll.rollNumber }).first();
      await expect(row).toBeVisible({ timeout: 15000 });
      await row.locator('.ant-checkbox-input').check();
    }
    await authedPage.getByPlaceholder('Name of receiver').fill('E2E Cutting Master');
    await authedPage.getByRole('button', { name: /\bIssue$/ }).click();
    const text = await successToast(authedPage, /MIS\//);
    const issueNo = text.match(/MIS\/[0-9-]+\/\d+/)[0];

    // The issue is recorded against the Cutting PO and the rolls are no longer in stock
    const { data: issues } = await api.get('/material-issues', { page: 0, size: 50 });
    const issue = (issues.content || issues).find((i) => i.issueNumber === issueNo);
    expect(issue, `issue ${issueNo} listed`).toBeTruthy();
    const { data: left } = await api.get('/material-issues/issuable-rolls', { itemCode: 'FAB-SJ-001', orderRef: order.orderNo });
    expect(left.filter((r) => ours.some((o) => o.rollNumber === r.rollNumber))).toHaveLength(0);

    // The cutting room now sees them waiting to be received
    const { data: pending } = await api.get(`/cutting/cut-pos/${cuttingPo.id}/pending-rolls`);
    expect(pending.map((r) => r.rollNo)).toEqual(expect.arrayContaining(ours.map((r) => r.rollNumber)));
    expect(consoleGuard).toEqual([]);
  });
});
