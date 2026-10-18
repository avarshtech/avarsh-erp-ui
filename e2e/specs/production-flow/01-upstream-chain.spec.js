/**
 * Production flow 01 — the upstream chain a production run starts from, built fresh through the API:
 * an approved cost sheet, a confirmed order, a released BOM, the PP sample completed, a supplier PO for
 * the BOM fabric sent to the supplier, its GRN and a passed QC. The fabric must then be in stock,
 * earmarked to the order, and the order must be open to production. Later files find this order by
 * FLOW_MARK in its remarks.
 */
import { test, expect } from '../../fixtures.js';
import { buildUpstreamChain } from '../../helpers/production-flow-seed.js';
import { waitForTableSettled } from '../../helpers/ui-master.js';

const STAMP = Date.now().toString().slice(-6);

test.describe('Production flow — upstream chain', () => {
  test('costing → order → BOM → supplier PO → GRN → QC puts the fabric in stock for the order', async ({ api, authedPage, consoleGuard }) => {
    const chain = await buildUpstreamChain(api, { stamp: STAMP });
    expect(chain.order.status).toBe('CONFIRMED');
    expect(chain.bom.status).toBe('CREATED');
    expect(chain.po.status).toBe('Sent_To_Supplier');
    expect(chain.qc.status).toBe('Approved');

    // QC approval moves the received rolls into stock for this order
    const { data: rolls } = await api.get('/material-issues/issuable-rolls', { itemCode: chain.item.code, orderRef: chain.order.orderNo });
    const ours = rolls.filter((r) => chain.rolls.some((x) => x.rollNumber === r.rollNumber));
    expect(ours).toHaveLength(2);
    expect(ours.every((r) => r.orderRef === chain.order.orderNo)).toBeTruthy();

    // The order is offered to production: confirmed, BOM released, PP sample done
    const { data: eligible } = await api.get(`/production/eligible-orders/${chain.order.id}`);
    expect(eligible.bomId).toBe(chain.bom.id);
    expect(eligible.ppSampleStatus).toBe('COMPLETED');

    // The GRN shows on its list, closed by the QC
    await authedPage.goto('/inventory/grn/list');
    await waitForTableSettled(authedPage);
    const search = authedPage.locator('.ant-card input[placeholder*="Search"]').first();
    await search.fill(chain.grn.grnNumber);
    await expect(authedPage.locator('.ant-table-row', { hasText: chain.grn.grnNumber }).first()).toBeVisible({ timeout: 20000 });
    expect(consoleGuard).toEqual([]);
  });
});
