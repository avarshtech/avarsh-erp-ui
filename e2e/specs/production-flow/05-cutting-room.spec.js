/**
 * Production flow 05 — the cutting room, every stage on its own screen, on the flow order's Cutting PO:
 * the issued rolls are received, relaxed (a cycle started 30 h ago on a 24 h fabric, so it releases the
 * PO), planned on one marker with the size-set approved, laid over both rolls, TMB-checked within
 * tolerance, recorded on the cutting report (height × ratio), bundled, and issued to the Work Order's
 * sewing. A re-cut is registered for the flow line, and the end-bit of a roll goes back to stock.
 */
import { test, expect } from '../../fixtures.js';
import { findFlowLine, findFlowOrder } from '../../helpers/production-flow-seed.js';
import { waitForPageReady } from '../../helpers/navigation.js';
import {
  activePane, captioned, choose, chooseCaptioned, chooseLabelled, dateTimeAgo, labelled, openDrawer, openModal,
  responseOf, successToast, typeDate,
} from './helpers.js';

test.describe.configure({ mode: 'serial' });

const ctx = {};

const cutting = (page, tab) => page.goto(`/production/cutting?tab=${tab}`).then(() => waitForPageReady(page));

test.describe('Production flow — cutting room', () => {
  test.beforeAll(async ({ api }) => {
    ctx.order = await findFlowOrder(api);
    const { data: cuts } = await api.get(`/cutting-po/approved?orderId=${ctx.order.id}`);
    expect(cuts, 'run 03 first: the flow order needs an approved Cutting PO').toHaveLength(1);
    ctx.cuttingPo = cuts[0];
    const { data: wos } = await api.get(`/work-order/approved?orderId=${ctx.order.id}`);
    expect(wos, 'run 04 first: the flow order needs an approved Work Order').toHaveLength(1);
    ctx.workOrder = wos[0];
    const { data: cutPos } = await api.get('/cutting/cut-pos');
    ctx.cutPo = cutPos.find((p) => p.id === ctx.cuttingPo.id);
    expect(ctx.cutPo, 'the cutting room lists the approved Cutting PO').toBeTruthy();
    ctx.no = ctx.cutPo.cutPoNo;
    ctx.sizes = ctx.cutPo.sizes;
    // One marker, one piece of each size per ply, as high as the smallest size's order quantity
    ctx.height = Math.min(...ctx.sizes.map((s) => ctx.cutPo.sizeQty[s]));
  });

  test('Fabric In: the rolls stores issued are received on the Cut PO', async ({ api, authedPage, consoleGuard }) => {
    const { data: pending } = await api.get(`/cutting/cut-pos/${ctx.cutPo.id}/pending-rolls`);
    expect(pending.length).toBeGreaterThanOrEqual(2);

    await cutting(authedPage, 'fabric-in');
    await authedPage.getByRole('button', { name: /New Fabric Receipt/ }).click();
    const drawer = openDrawer(authedPage);
    await chooseLabelled(authedPage, 'Cut PO #', ctx.no, drawer);
    for (const roll of pending) await expect(drawer.locator('.ant-table-row', { hasText: roll.rollNo })).toBeVisible();
    await labelled(authedPage, 'Received By', drawer).locator('input').fill('E2E Storekeeper');
    const receipt = await responseOf(authedPage, 'POST', /\/cutting\/fabric-receipts$/,
      () => drawer.getByRole('button', { name: /Save Receipt/ }).click());
    await successToast(authedPage, /Fabric receipt saved/);
    expect(receipt.status).toBe('RECEIVED');
    expect(receipt.rolls.filter((r) => r.received)).toHaveLength(pending.length);
    ctx.receipt = receipt;
    await expect(activePane(authedPage).locator('.ant-table-row', { hasText: receipt.receiptNo })).toBeVisible();
    expect(consoleGuard).toEqual([]);
  });

  test('Relaxation: a cycle past the fabric minimum releases the Cut PO for marker planning', async ({ api, authedPage, consoleGuard }) => {
    await cutting(authedPage, 'fabric-in');
    await authedPage.locator('.ant-segmented-item', { hasText: 'Fabric Relaxation' }).click();
    await authedPage.getByRole('button', { name: /Start Relaxation/ }).click();
    const drawer = openDrawer(authedPage);
    await chooseLabelled(authedPage, 'Fabric Receipt #', ctx.receipt.receiptNo, drawer);
    await chooseLabelled(authedPage, 'Fabric Type', 'Single Jersey', drawer);
    await expect(drawer.getByText(/Minimum relaxation for this fabric: 24 hours/)).toBeVisible();
    await typeDate(authedPage, labelled(authedPage, 'Start Date & Time', drawer), dateTimeAgo(30));
    await typeDate(authedPage, labelled(authedPage, 'End Date & Time', drawer), dateTimeAgo(2));
    await labelled(authedPage, 'Shrinkage % (pre)', drawer).locator('input').fill('3');
    await labelled(authedPage, 'Shrinkage % (post)', drawer).locator('input').fill('2');

    const saved = await responseOf(authedPage, 'POST', /\/cutting\/fabric-relaxations$/,
      () => drawer.getByRole('button', { name: /^Save$/ }).click());
    await successToast(authedPage, new RegExp(`${saved.relaxationNo} completed — ${ctx.no} is released for marker planning`));
    expect(saved.status).toBe('REPORT_GENERATED');

    const { data: relaxed } = await api.get('/cutting/cut-pos', { relaxed: true });
    expect(relaxed.map((p) => p.id)).toContain(ctx.cutPo.id);
    expect(consoleGuard).toEqual([]);
  });

  test('Marker Plan: one marker on a 1:1 size ratio, with the size-set cut approved', async ({ api, authedPage, consoleGuard }) => {
    await authedPage.goto('/production/cutting/marker-plan/new');
    await waitForPageReady(authedPage);
    await chooseCaptioned(authedPage, 'Cut PO # (relaxation-complete only)', ctx.no);
    await captioned(authedPage, 'Fabric Width — Raw Edge (in)').locator('input').fill('60');
    await captioned(authedPage, 'Cuttable Width (in)').locator('input').fill('58');

    // The pilot cut is signed off here; bulk laying stays blocked until it is
    await authedPage.getByRole('button', { name: /Mark Size-Set Approved/ }).click();
    await successToast(authedPage, /Size-set cut approved/);

    const marker = authedPage.locator('.ant-table-row', { hasText: 'MK-001' });
    const inputs = marker.locator('input');
    await inputs.nth(0).fill(String(ctx.height));
    for (let i = 0; i < ctx.sizes.length; i++) await inputs.nth(i + 1).fill('1');
    await expect(marker.getByText(`${ctx.height}=${ctx.sizes.length}`)).toBeVisible();

    const plan = await responseOf(authedPage, 'POST', /\/cutting\/marker-plans$/,
      () => authedPage.getByRole('button', { name: /Save Plan/ }).click());
    await successToast(authedPage, new RegExp(`${plan.planNo} saved`));
    expect(plan.markers).toHaveLength(1);
    expect(plan.markers[0].markerHeight).toBe(ctx.height);
    ctx.plan = plan;
    ctx.marker = plan.markers[0];

    const { data: sizeSet } = await api.get(`/cutting/cut-pos/${ctx.cutPo.id}/size-set`);
    expect(sizeSet.status).toBe('APPROVED');
    await expect(authedPage).toHaveURL(/tab=planning/);
    await expect(activePane(authedPage).locator('.ant-table-row', { hasText: plan.planNo })).toBeVisible();
    expect(consoleGuard).toEqual([]);
  });

  test('Lay Audit: the marker is laid to its height over both relaxed rolls', async ({ authedPage, consoleGuard }) => {
    await authedPage.goto('/production/cutting/lay-audit/new');
    await waitForPageReady(authedPage);
    await chooseCaptioned(authedPage, 'Cut PO #', ctx.no);
    await chooseCaptioned(authedPage, 'Marker # (mandatory)', `${ctx.marker.markerNo} · ${ctx.plan.planNo}`);
    await expect(captioned(authedPage, 'Lay # (auto per marker)').locator('input')).toHaveValue('LAY-001');

    // Split the height over the two rolls
    const first = Math.ceil(ctx.height / 2);
    const lays = [first, ctx.height - first];
    const rollNos = ctx.receipt.rolls.map((r) => r.rollNo);
    for (let i = 0; i < 2; i++) {
      await authedPage.getByRole('button', { name: /Add Roll/ }).click();
      const row = authedPage.locator('.ant-card', { hasText: 'Rolls in this Lay' }).locator('.ant-table-row').nth(i);
      await choose(authedPage, row.locator('.ant-select').first(), rollNos[i]);
      const nums = row.locator('.ant-input-number input');
      await nums.nth(0).fill('4.5');
      await nums.nth(1).fill(String(lays[i]));
    }
    await expect(authedPage.getByText(`Total height: ${ctx.height}`)).toBeVisible();

    const lay = await responseOf(authedPage, 'POST', /\/cutting\/lay-audits$/,
      () => authedPage.getByRole('button', { name: /Save Lay/ }).click());
    await successToast(authedPage, new RegExp(`${lay.layRef} saved`));
    expect(lay.status).toBe('AUDITED');
    expect(lay.plies).toBe(ctx.height);
    ctx.lay = lay;
    expect(consoleGuard).toEqual([]);
  });

  test('TMB Check: the lay measures within ±0.5 cm top to bottom and passes', async ({ api, authedPage, consoleGuard }) => {
    const { data: parts } = await api.get('/parts/active');
    const part = (parts.content || parts)[0].partName;

    await authedPage.goto('/production/cutting/tmb/new');
    await waitForPageReady(authedPage);
    await chooseCaptioned(authedPage, 'Lay (from Lay Audit)', ctx.lay.layRef);
    await captioned(authedPage, 'QC Sign').locator('input').fill('E2E QC');
    await authedPage.getByRole('button', { name: /Add Row/ }).click();
    const row = authedPage.locator('.ant-card', { hasText: 'Part & Size Measurements' }).locator('.ant-table-row').first();
    await choose(authedPage, row.locator('.ant-select').nth(0), part);
    await choose(authedPage, row.locator('.ant-select').nth(1), ctx.sizes[0]);
    const nums = row.locator('.ant-input-number input');
    await nums.nth(0).fill('50');
    await nums.nth(1).fill('50.2');
    await nums.nth(2).fill('50.1');
    await nums.nth(3).fill(String(ctx.height));

    const check = await responseOf(authedPage, 'POST', /\/cutting\/tmb-checks$/,
      () => authedPage.getByRole('button', { name: /Save Check/ }).click());
    await successToast(authedPage, /saved as passed/);
    expect(check.status).toBe('PASSED');
    expect(consoleGuard).toEqual([]);
  });

  test('Cutting Report: the lay is recorded at height × marker ratio', async ({ api, authedPage, consoleGuard }) => {
    await cutting(authedPage, 'report');
    await chooseCaptioned(authedPage, 'Cut PO', ctx.no, activePane(authedPage));
    await authedPage.getByRole('button', { name: /Record Lay Cut/ }).click();
    const modal = openModal(authedPage);
    await choose(authedPage, modal.locator('.ant-select').nth(0), `${ctx.marker.markerNo} · ${ctx.plan.planNo}`);
    await choose(authedPage, modal.locator('.ant-select').nth(1), ctx.lay.layRef);
    const expected = ctx.height * ctx.sizes.length;
    await expect(modal.getByText(`Total ${expected} pcs`)).toBeVisible();

    const lay = await responseOf(authedPage, 'POST', /\/cutting\/report\/lays$/,
      () => modal.getByRole('button', { name: /Add Lay/ }).click());
    await successToast(authedPage, new RegExp(`recorded — ${expected} pcs`));
    expect(lay.totalQty).toBe(expected);

    const { data: report } = await api.get(`/cutting/report/${ctx.cutPo.id}`);
    expect(report.totalCut).toBe(expected);
    expect(consoleGuard).toEqual([]);
  });

  test('Bundling: the cut pieces are bundled once the TMB check has passed', async ({ api, authedPage, consoleGuard }) => {
    await cutting(authedPage, 'bundling');
    await authedPage.getByRole('button', { name: /Generate Bundles/ }).click();
    const drawer = openDrawer(authedPage);
    await chooseCaptioned(authedPage, 'Cut PO', ctx.no, drawer);
    await expect(drawer.getByText(/Bundling blocked/)).toHaveCount(0);
    const run = await responseOf(authedPage, 'POST', /\/cutting\/bundlings$/,
      () => drawer.getByRole('button', { name: /Auto-Generate Bundles/ }).click());
    await successToast(authedPage, new RegExp(`${run.bundlingNo}: ${run.totalBundles} bundles generated`));
    expect(run.totalPcs).toBe(ctx.height * ctx.sizes.length);

    const { data: bundles } = await api.get('/cutting/bundles', { cuttingPoId: ctx.cutPo.id, unissued: true });
    expect((bundles.content || bundles).length).toBe(run.totalBundles);
    expect(consoleGuard).toEqual([]);
  });

  test('Issue to Sewing: every bundle goes out on the approved Work Order', async ({ api, authedPage, consoleGuard }) => {
    await cutting(authedPage, 'bundling');
    await authedPage.getByRole('button', { name: /Issue to Sewing/ }).click();
    const drawer = openDrawer(authedPage);
    await choose(authedPage, drawer.locator('.ant-select').first(), ctx.no);
    // The Cut PO's one approved Work Order is picked; nothing else is offered
    await expect(drawer.locator('.ant-select', { hasText: ctx.workOrder.workOrderNo })).toBeVisible();
    await drawer.locator('.ant-table-thead .ant-checkbox-input').check();
    const issue = await responseOf(authedPage, 'POST', /\/cutting\/bundle-issues$/,
      () => drawer.getByRole('button', { name: /Issue & Print Note/ }).click());
    await successToast(authedPage, new RegExp(`${issue.issueNo}: ${ctx.height * ctx.sizes.length} pcs issued to ${ctx.workOrder.workOrderNo}`));
    expect(issue.workOrderNo).toBe(ctx.workOrder.workOrderNo);

    // Sewing sees it waiting to be received
    const { data: waiting } = await api.get('/sewing/cut-receipts/pending-issues');
    expect(waiting.map((w) => w.issueNo)).toContain(issue.issueNo);
    expect(consoleGuard).toEqual([]);
  });

  test('Re-Cut Register: a damaged part is re-cut for the flow line from a relaxed roll', async ({ api, authedPage, consoleGuard }) => {
    const line = await findFlowLine(api);
    const { data: parts } = await api.get('/parts/active');
    const part = (parts.content || parts)[0].partName;

    await cutting(authedPage, 'recut');
    await authedPage.getByRole('button', { name: /Add Re-Cut Entry/ }).click();
    const modal = openModal(authedPage);
    await choose(authedPage, modal.locator('.ant-select', { hasText: 'Cut PO' }), ctx.no);
    await choose(authedPage, modal.locator('.ant-select', { hasText: 'Line' }), line.name);
    await choose(authedPage, modal.locator('.ant-select', { hasText: 'Part' }), part);
    await choose(authedPage, modal.locator('.ant-select', { hasText: 'Roll (relaxed)' }), ctx.receipt.rolls[0].rollNo);
    await modal.getByPlaceholder('Qty').fill('2');
    await choose(authedPage, modal.locator('.ant-select', { hasText: 'Reason' }), '');
    const entry = await responseOf(authedPage, 'POST', /\/cutting\/recut-entries$/,
      () => modal.getByRole('button', { name: /Add Entry/ }).click());
    await successToast(authedPage, /Re-cut entry recorded/);
    expect(entry.lineName).toBe(line.name);
    expect(entry.qty).toBe(2);
    expect(consoleGuard).toEqual([]);
  });

  test('Reconciliation: a roll end-bit is recorded reusable and returned to fabric stock', async ({ api, authedPage, consoleGuard }) => {
    // A roll the lay used and nothing has been returned from yet
    const { data: before } = await api.get(`/cutting/reconciliation/${ctx.cutPo.id}`);
    const rollNo = before.rows.find((r) => r.status !== 'IN_STOCK' && !r.returned).rollNo;
    await cutting(authedPage, 'reconciliation');
    await choose(authedPage, activePane(authedPage).locator('.ant-select').first(), ctx.no);
    const row = activePane(authedPage).locator('.ant-table-row', { hasText: rollNo }).first();
    await expect(row).toBeVisible({ timeout: 15000 });

    // The end-bit is saved once, when the field is left
    const endBit = row.locator('.ant-input-number input');
    await endBit.fill('1.5');
    await responseOf(authedPage, 'PUT', /\/cutting\/reconciliation\/\d+\/end-bits$/, () => endBit.press('Enter'));
    // The row's last checkbox is Reusable? (the first one selects the row for a bulk return). It shows
    // what the server saved, so it flips once the PUT comes back.
    const reusable = row.locator('.ant-checkbox-input').last();
    await responseOf(authedPage, 'PUT', /\/cutting\/reconciliation\/\d+\/end-bits$/, () => reusable.click());
    await expect(reusable).toBeChecked();

    await row.getByRole('button', { name: /Return End-Bit \(1\.500 kg\)/ }).click();
    await responseOf(authedPage, 'POST', /\/cutting\/reconciliation\/\d+\/returns$/,
      () => authedPage.locator('.ant-modal-confirm').getByRole('button', { name: /Return to Inventory/ }).click());
    await successToast(authedPage, /1\.500 kg returned to fabric inventory/);

    // The end-bit is booked back under a Fabric Return Note, shown against the roll
    const { data: after } = await api.get(`/cutting/reconciliation/${ctx.cutPo.id}`);
    const returned = after.rows.find((r) => r.rollNo === rollNo).returned;
    expect(returned.returnNo).toBeTruthy();
    expect(Number(returned.qty)).toBe(1.5);
    expect(Number(after.returnedTotal)).toBe(1.5);
    await expect(row.getByText(returned.returnNo)).toBeVisible();
    expect(consoleGuard).toEqual([]);
  });
});
