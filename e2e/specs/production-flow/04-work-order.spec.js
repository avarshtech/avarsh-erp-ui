/**
 * Production flow 04 — the Work Order (the sewing PO) is raised on the flow order's approved Cutting PO
 * on its screen, rated and submitted; with no WORK_ORDER approval flow in the e2e seed it comes back
 * approved. The cutting room issues its bundles to this Work Order (05).
 */
import { test, expect } from '../../fixtures.js';
import { findFlowOrder } from '../../helpers/production-flow-seed.js';
import { waitForPageReady } from '../../helpers/navigation.js';
import { waitForTableSettled } from '../../helpers/ui-master.js';
import { selectOptionByText, pickToday, submitAnywayIfAsked, applyBulkRate, expectSuccessToast } from '../production-po/helpers.js';
import { chooseLabelled } from './helpers.js';

test.describe('Production flow — Work Order', () => {
  test('a Work Order is raised on the approved Cutting PO, rated and submitted, and comes back approved', async ({ api, authedPage, consoleGuard }) => {
    const order = await findFlowOrder(api);
    const { data: cuts } = await api.get(`/cutting-po/approved?orderId=${order.id}`);
    expect(cuts, 'run 03 first: the flow order needs an approved Cutting PO').toHaveLength(1);
    const cuttingPo = cuts[0];
    // A fresh order has no job-work requirements, so nothing holds the Work Order back
    const { data: gaps } = await api.get(`/work-order/job-work-gaps?orderId=${order.id}`);
    expect(gaps).toEqual([]);

    await authedPage.goto('/purchase-orders/work-order/new');
    await waitForPageReady(authedPage);
    await chooseLabelled(authedPage, 'Confirmed Order', order.orderNo);
    await expect(authedPage.locator('.ant-alert', { hasText: /PP Sample approved/i })).toBeVisible({ timeout: 10000 });
    await chooseLabelled(authedPage, 'Approved Cutting PO', cuttingPo.cuttingPoNo);
    await pickToday(authedPage, 'Planned Start');
    await pickToday(authedPage, 'Planned End');
    await selectOptionByText(authedPage, 'Unit Unit', 'Unit 1');
    await pickToday(authedPage, 'Planned Delivery Date');

    await applyBulkRate(authedPage, 25);
    await authedPage.getByRole('button', { name: /Save & Submit/i }).click();
    await submitAnywayIfAsked(authedPage);
    await expectSuccessToast(authedPage, /submitted/i);
    await waitForPageReady(authedPage);

    const { data: approved } = await api.get(`/work-order/approved?orderId=${order.id}`);
    expect(approved).toHaveLength(1);
    const wo = approved[0];
    expect(wo.status).toBe('APPROVED');
    expect(wo.cuttingPoId).toBe(cuttingPo.id);
    expect(wo.items.every((i) => Number(i.ratePerPiece) === 25)).toBeTruthy();

    await authedPage.goto('/purchase-orders/work-order/list');
    await waitForTableSettled(authedPage);
    await authedPage.locator('.ant-card input[placeholder*="Search"]').first().fill(wo.workOrderNo);
    await expect(authedPage.locator('.ant-table-row', { hasText: wo.workOrderNo }).locator('.ant-tag', { hasText: /Approved/i }))
      .toBeVisible({ timeout: 20000 });
    expect(consoleGuard).toEqual([]);
  });
});
