/**
 * Production flow 06 — the sewing floor, every stage on its own screen, for the flow order on the flow
 * line: a production plan is saved, approved and started; the bundles cutting issued are received; the
 * trim card is verified physically; an hourly sheet is booked; a measurement report passes against the
 * style's chart; an end-line check is filed; a damaged part goes to cutting, is re-cut and delivered;
 * and the sewn garments are issued to finishing.
 */
import { test, expect } from '../../fixtures.js';
import { findFlowLine, findFlowOrder } from '../../helpers/production-flow-seed.js';
import { waitForPageReady } from '../../helpers/navigation.js';
import { activePane, captioned, choose, chooseCaptioned, openDrawer, responseOf, successToast } from './helpers.js';

test.describe.configure({ mode: 'serial' });

const ctx = {};

const sewing = (page, tab) => page.goto(`/production/sewing?tab=${tab}`).then(() => waitForPageReady(page));

test.describe('Production flow — sewing floor', () => {
  test.beforeAll(async ({ api }) => {
    ctx.order = await findFlowOrder(api);
    ctx.line = await findFlowLine(api);
    const { data: ops } = await api.get('/sewing-operations');
    ctx.operations = (ops.content || ops).filter((o) => o.active !== false).slice(0, 2);
    expect(ctx.operations).toHaveLength(2);
    const { data: cuts } = await api.get(`/cutting-po/approved?orderId=${ctx.order.id}`);
    const { data: cutPos } = await api.get('/cutting/cut-pos');
    ctx.cutPo = cutPos.find((p) => p.id === cuts[0].id);
    ctx.sizes = ctx.cutPo.sizes;
    // A plan already running for the order on the flow line (the first test starts one)
    const { data: plans } = await api.get('/sewing/plans');
    ctx.plan = (plans.content || plans).find((p) => p.orderId === ctx.order.id && p.status === 'IN_PROGRESS');
  });

  test('Production Plan: the order is loaded on the flow line, approved and started', async ({ api, authedPage, consoleGuard }) => {
    await authedPage.goto('/production/sewing/plan/new');
    await waitForPageReady(authedPage);
    await chooseCaptioned(authedPage, 'Order', ctx.order.orderNo);
    await chooseCaptioned(authedPage, 'Unit', 'Unit 1');
    await chooseCaptioned(authedPage, 'Sewing Line (of unit)', ctx.line.name);
    await captioned(authedPage, 'Operators').locator('input').fill('12');

    const grid = authedPage.locator('.ant-card', { hasText: 'Operation Breakdown' });
    for (let i = 0; i < ctx.operations.length; i++) {
      await grid.getByRole('button', { name: /Add Operation/ }).click();
      const row = grid.locator('.ant-table-row').nth(i);
      await choose(authedPage, row.locator('.ant-select', { hasText: 'Operation' }), ctx.operations[i].name);
      const nums = row.locator('.ant-input-number input');
      await nums.nth(1).fill(i === 0 ? '0.8' : '1.2');
      await nums.nth(2).fill('1.5');
    }

    const plan = await responseOf(authedPage, 'POST', /\/sewing\/plans$/, () => authedPage.getByRole('button', { name: /Save Plan/ }).click());
    await successToast(authedPage, new RegExp(`${plan.planNo} saved`));
    expect(plan.status).toBe('DRAFT');
    await expect(authedPage).toHaveURL(new RegExp(`/production/sewing/plan/${plan.id}`));

    await responseOf(authedPage, 'POST', new RegExp(`/sewing/plans/${plan.id}/approve$`),
      () => authedPage.getByRole('button', { name: /^Approve$/ }).click());
    await successToast(authedPage, /Plan approved/);
    await responseOf(authedPage, 'POST', new RegExp(`/sewing/plans/${plan.id}/start$`),
      () => authedPage.getByRole('button', { name: /Start Line/ }).click());
    await successToast(authedPage, /production started/);

    const { data: started } = await api.get(`/sewing/plans/${plan.id}`);
    expect(started.status).toBe('IN_PROGRESS');
    expect(started.lineId).toBe(ctx.line.id);
    ctx.plan = started;
    expect(consoleGuard).toEqual([]);
  });

  test('Cut Parts Receipt: the bundles cutting issued are received on the line and verified', async ({ api, authedPage, consoleGuard }) => {
    const { data: waiting } = await api.get('/sewing/cut-receipts/pending-issues');
    const issue = waiting.find((w) => w.cuttingPoId === ctx.cutPo.id || w.cuttingPoNo === ctx.cutPo.cutPoNo);
    expect(issue, 'run 05 first: cutting must have issued the bundles').toBeTruthy();

    await sewing(authedPage, 'receipt');
    await authedPage.getByRole('button', { name: /Receive Bundles/ }).click();
    const drawer = openDrawer(authedPage);
    await choose(authedPage, drawer.locator('.ant-select').nth(0), issue.issueNo);
    await choose(authedPage, drawer.locator('.ant-select').nth(1), 'Unit 1');
    await choose(authedPage, drawer.locator('.ant-select').nth(2), ctx.line.name);
    await drawer.getByPlaceholder('Received by').fill('E2E Line Feeder');
    await expect(drawer.getByText(`Received ${issue.totalPcs} / expected ${issue.totalPcs}`)).toBeVisible();

    const receipt = await responseOf(authedPage, 'POST', /\/sewing\/cut-receipts$/,
      () => drawer.getByRole('button', { name: /Confirm Receipt/ }).click());
    await successToast(authedPage, new RegExp(`${receipt.receiptNo}: bundles received and verified`));
    expect(receipt.status).toBe('VERIFIED');
    expect(consoleGuard).toEqual([]);
  });

  test('Trims Verification: the trim card is checked item by item and filed as physically verified', async ({ authedPage, consoleGuard }) => {
    await sewing(authedPage, 'trim-verification');
    await authedPage.getByRole('button', { name: /New Verification Card/ }).click();
    const drawer = openDrawer(authedPage);
    await chooseCaptioned(authedPage, 'Order', ctx.order.orderNo, drawer);
    await captioned(authedPage, 'Verified By', drawer).locator('input').fill('E2E QC');
    // The flow BOM carries fabric only; a trim the BOM does not list is added by hand
    await drawer.getByRole('button', { name: /Add Item Manually/ }).click();
    await drawer.getByPlaceholder('Manual item name').last().fill('Main label');
    const groups = drawer.locator('.ant-radio-group');
    for (let i = 0; i < await groups.count(); i++) {
      await groups.nth(i).locator('.ant-radio-button-wrapper', { hasText: /^Correct$/ }).click();
    }

    await drawer.getByRole('button', { name: /Save Card/ }).click();
    const confirm = authedPage.locator('.ant-modal-confirm');
    await expect(confirm).toContainText('Physically verified against trim card?');
    const card = await responseOf(authedPage, 'POST', /\/sewing\/trim-cards$/, () => confirm.getByRole('button', { name: /^Yes$/ }).click());
    await successToast(authedPage, new RegExp(`${card.cardNo} saved — all items verified`));
    expect(card.physicallyVerified).toBe(true);
    expect(card.incorrectItems).toBe(0);
    expect(card.correctItems).toBe(card.totalItems);
    expect(consoleGuard).toEqual([]);
  });

  test('Hourly Production: the line books its first three hours against the plan operations', async ({ api, authedPage, consoleGuard }) => {
    await sewing(authedPage, 'hourly');
    await choose(authedPage, activePane(authedPage).locator('.ant-select').first(), `${ctx.line.name} · ${ctx.order.orderNo}`);
    const rows = activePane(authedPage).locator('.ant-table-tbody .ant-table-row');
    await expect(rows).toHaveCount(ctx.operations.length, { timeout: 20000 });
    for (let i = 0; i < ctx.operations.length; i++) {
      const hours = rows.nth(i).locator('.ant-input-number input');
      await hours.nth(0).fill('6');
      await hours.nth(1).fill('8');
      await hours.nth(2).fill('9');
    }
    const sheet = await responseOf(authedPage, 'POST', /\/sewing\/hourly$/,
      () => authedPage.getByRole('button', { name: /Save Sheet/ }).click());
    await successToast(authedPage, /Hourly production saved/);
    expect(sheet.planId).toBe(ctx.plan.id);
    expect(sheet.rows.every((r) => r.hr1 === 6 && r.hr2 === 8 && r.hr3 === 9)).toBeTruthy();

    const { data: reread } = await api.get('/sewing/hourly/sheet', { planId: ctx.plan.id, date: sheet.sheetDate, shiftId: sheet.shiftId });
    expect(reread.sheetNo).toBe(sheet.sheetNo);
    expect(consoleGuard).toEqual([]);
  });

  test('Measurement: a report on the style chart passes within tolerance', async ({ api, authedPage, consoleGuard }) => {
    // The buyer's chart for the style (charts are maintained under Production Masters)
    const specs = ctx.sizes.flatMap((size) => [
      { size, point: 'Chest width', spec: 52, tolerance: 1, sortOrder: 1 },
      { size, point: 'Body length', spec: 70, tolerance: 1, sortOrder: 2 },
    ]);
    const chart = await api.post('/measurement-specs', { styleNo: ctx.order.styleNo, specs });
    expect(chart.status).toBeLessThan(300);

    await authedPage.goto('/production/sewing/measurement/new');
    await waitForPageReady(authedPage);
    await chooseCaptioned(authedPage, 'Order', ctx.order.orderNo);
    await chooseCaptioned(authedPage, 'Inspector (employee master)', 'Flow Inspector');
    const points = authedPage.locator('.ant-card', { hasText: 'Measurement Points' }).locator('.ant-table-row');
    await expect(points).toHaveCount(2, { timeout: 15000 });
    await points.nth(0).locator('.ant-input-number input').fill('52.4');
    await points.nth(1).locator('.ant-input-number input').fill('69.8');

    const report = await responseOf(authedPage, 'POST', /\/sewing\/measurements$/,
      () => authedPage.getByRole('button', { name: /Save Report/ }).click());
    await successToast(authedPage, new RegExp(`${report.reportNo} saved — overall APPROVED`));
    expect(report.result).toBe('APPROVED');
    expect(consoleGuard).toEqual([]);
  });

  test('End-Line TOPSE: 100 checked with 2 defects reads GREEN', async ({ authedPage, consoleGuard }) => {
    await authedPage.goto('/production/sewing/topse/new');
    await waitForPageReady(authedPage);
    await chooseCaptioned(authedPage, 'Order', ctx.order.orderNo);
    await chooseCaptioned(authedPage, 'Line', ctx.line.name);
    await captioned(authedPage, 'Total Inspected').locator('input').fill('100');
    await authedPage.getByRole('button', { name: /Add Defect/ }).click();
    const row = authedPage.locator('.ant-card', { hasText: 'Defects Found' }).locator('.ant-table-row').first();
    await choose(authedPage, row.locator('.ant-select', { hasText: 'Type' }), '');
    await row.locator('.ant-input-number input').first().fill('2');

    const report = await responseOf(authedPage, 'POST', /\/sewing\/topse$/,
      () => authedPage.getByRole('button', { name: /Save Report/ }).click());
    await successToast(authedPage, new RegExp(`${report.reportNo} saved — DHU 2`));
    expect(report.trafficLight).toBe('GREEN');
    expect(consoleGuard).toEqual([]);
  });

  test('Replacements: a damaged part is sent to cutting, marked cut and then delivered', async ({ api, authedPage, consoleGuard }) => {
    const { data: parts } = await api.get('/parts/active');
    const part = (parts.content || parts)[0].partName;

    await sewing(authedPage, 'replacements');
    await authedPage.getByRole('button', { name: /New Replacement Request/ }).click();
    const drawer = openDrawer(authedPage);
    // Order, then line (the order may come pre-filled from the module's last selection)
    await choose(authedPage, drawer.locator('.ant-select').nth(0), ctx.order.orderNo);
    await choose(authedPage, drawer.locator('.ant-select').nth(1), ctx.line.name);
    await drawer.getByPlaceholder('Requested by').fill('E2E Line Supervisor');
    await drawer.getByRole('button', { name: /Add Rejected Part/ }).click();
    const row = drawer.locator('.ant-table-row').first();
    await choose(authedPage, row.locator('.ant-select', { hasText: 'Size' }), ctx.sizes[0]);
    await row.getByPlaceholder('B-3/S-21').fill('B-1/S-3');
    await choose(authedPage, row.locator('.ant-select', { hasText: 'Part' }), part);
    await choose(authedPage, row.locator('.ant-select', { hasText: 'Reason' }), '');
    await row.locator('.ant-input-number input').fill('2');

    const request = await responseOf(authedPage, 'POST', /\/sewing\/replacements$/,
      () => drawer.getByRole('button', { name: /Send to Cutting/ }).click());
    await successToast(authedPage, new RegExp(`${request.requestNo} sent to cutting — 2 pcs`));

    const listRow = activePane(authedPage).locator('.ant-table-row', { hasText: request.requestNo });
    await listRow.locator('.ant-table-row-expand-icon').click();
    const detail = activePane(authedPage).locator('.ant-table-expanded-row').first();
    await responseOf(authedPage, 'POST', /\/sewing\/replacements\/\d+\/parts\/\d+\/mark-cut$/,
      () => detail.getByRole('button', { name: /Mark cut/ }).click());
    await successToast(authedPage, /marked cut/);
    await responseOf(authedPage, 'POST', /\/sewing\/replacements\/\d+\/parts\/\d+\/mark-delivered$/,
      () => detail.getByRole('button', { name: /Mark delivered/ }).click());
    await successToast(authedPage, /marked delivered/);

    const { data: list } = await api.get('/sewing/replacements');
    const saved = (list.content || list).find((r) => r.requestNo === request.requestNo);
    expect(saved.parts.every((p) => p.status === 'DELIVERED')).toBeTruthy();
    expect(consoleGuard).toEqual([]);
  });

  test('Garment Issue: the sewn garments go to finishing, size by size', async ({ api, authedPage, consoleGuard }) => {
    await sewing(authedPage, 'issue');
    await authedPage.getByRole('button', { name: /New Garment Issue/ }).click();
    const drawer = openDrawer(authedPage);
    await choose(authedPage, drawer.locator('.ant-select').first(), ctx.order.orderNo);
    await drawer.getByPlaceholder('Issued by').fill('E2E Line Supervisor');
    await drawer.getByPlaceholder('Received by').fill('E2E Finishing Incharge');
    const rows = drawer.locator('.ant-table-row');
    await expect(rows).toHaveCount(ctx.sizes.length);
    const perSize = 10;
    for (let i = 0; i < ctx.sizes.length; i++) await rows.nth(i).locator('.ant-input-number input').fill(String(perSize));

    const issue = await responseOf(authedPage, 'POST', /\/sewing\/garment-issues$/,
      () => drawer.getByRole('button', { name: /^Issue$/ }).click());
    await successToast(authedPage, new RegExp(`${issue.issueNo}: ${perSize * ctx.sizes.length} pcs issued`));
    expect(issue.status).toBe('ISSUED');

    const { data: bySize } = await api.get('/sewing/garment-issues/issued-by-size', { orderId: ctx.order.id });
    expect(Object.values(bySize).reduce((s, v) => s + Number(v), 0)).toBe(perSize * ctx.sizes.length);
    expect(consoleGuard).toEqual([]);
  });
});
