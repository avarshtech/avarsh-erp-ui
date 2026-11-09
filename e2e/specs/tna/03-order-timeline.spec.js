/**
 * T&A 03 — the newest production-flow order's plan, end to end (run after production-flow/08): every
 * milestone the ERP has a record for was completed by that record on its date; the three with no record
 * (pattern release, First Bulk Piece, PP meeting) are recorded on the plan page; Finishing › Checking
 * completes finishing output and the final AQL; a closed shipment dispatches the order and closes the plan.
 */
import { test, expect } from '../../fixtures.js';
import {
  ok, today, newestFlowOrder, planOf, act, expectedTemplate, ZARA,
} from './helpers.js';

const SOURCE_DRIVEN = ['A01', 'A02', 'A07', 'A13', 'A14', 'A18', 'A15'];
/** Quantity milestones: the flow cuts, sews and packs part of the order, so they show progress until the threshold. */
const QUANTITY_DRIVEN = ['A17', 'A20', 'A22'];

test.describe.serial('T&A — one order from confirmation to dispatch', () => {
  let order;
  let plan;

  test.beforeAll(async ({ api }) => {
    order = await newestFlowOrder(api);
    plan = await planOf(api, order.id);
  });

  test('the plan was generated from the buyer template, and the source records completed its milestones', async () => {
    const h = plan.header;
    expect(h.template.name).toBe(expectedTemplate(order));
    expect(h.generation.ruleVersion).toBe('TNA-R1');
    expect(h.originalCommitment).toBe(order.orderLines[0].dispatchDate);
    if (order.buyerId === ZARA.id) {
      expect(plan.activities.some((a) => a.code === 'A09'), 'Zara does not ask for a First Bulk Piece').toBe(false);
      expect(act(plan, 'A05').duration).toBe(4);
    } else {
      expect(act(plan, 'A09').isManual).toBe(true);
      expect(act(plan, 'A05').duration).toBe(7);
    }
    for (const code of SOURCE_DRIVEN) {
      const a = act(plan, code);
      expect(a.actualDate, `${code} ${a.name} completed by its source record`).toBe(today());
      expect(a.evidence?.sourceRecord, `${code} names its source record`).toBeTruthy();
      expect(a.baselineDate, `${code} has a frozen baseline`).toBeTruthy();
    }
    for (const code of QUANTITY_DRIVEN) {
      const a = act(plan, code);
      expect(a.progressPct, `${code} ${a.name} shows the quantity posted so far`).toBeGreaterThan(0);
      if (a.progressPct >= a.threshold) expect(a.actualDate, `${code} reached its threshold`).toBe(today());
      else expect(a.actualDate, `${code} below its threshold: progress only, no date`).toBeNull();
      expect(a.partials.length, `${code} keeps each posting`).toBeGreaterThan(0);
    }
    expect(act(plan, 'A15').evidence.note).toMatch(/First lay/);
    expect(act(plan, 'A13').evidence.sourceRecord).toMatch(/GRN/);
    const versions = h.versionCount;
    expect(versions, 'a version per completion, not one per sync').toBeGreaterThanOrEqual(SOURCE_DRIVEN.length);
  });

  test('pattern release, First Bulk Piece and PP meeting are recorded on the plan page, with remarks', async ({ api, authedPage: page, consoleGuard }) => {
    test.setTimeout(240000);
    const manual = plan.activities.filter((a) => a.isManual).map((a) => a.code);
    expect(manual.length).toBeGreaterThanOrEqual(2);
    for (const code of manual) {
      await page.goto(`/tna/plan/${plan.header.id}?activity=${code}`);
      const drawer = page.locator('.ant-drawer-open');
      await expect(drawer.getByText('manual milestone')).toBeVisible({ timeout: 90000 });
      await drawer.getByRole('button', { name: /Record completion$/ }).click();
      const modal = page.locator('.ant-modal').filter({ hasText: `Record ${code}` });
      await modal.getByLabel(/Remarks/).fill(`E2E ${code}: held with merchandising, production and QA; minutes filed`);
      const saved = page.waitForResponse((r) => r.url().includes(`/activities/${code}/completion`));
      await modal.getByRole('button', { name: 'Record completion' }).click();
      expect((await saved).status()).toBe(200);
      await expect(modal).toBeHidden();
      await expect(drawer.getByRole('button', { name: /Correct the recorded completion/ })).toBeVisible();
    }
    // A source-driven milestone offers no way to type a date
    await page.goto(`/tna/plan/${plan.header.id}?activity=A07`);
    const drawer = page.locator('.ant-drawer-open');
    await expect(drawer.getByText('read-only')).toBeVisible({ timeout: 90000 });
    await expect(drawer.getByRole('button', { name: /Record completion/ })).toHaveCount(0);
    const refused = await api.post(`/tna/plans/${plan.header.id}/activities/A07/completion`, { date: today(), remarks: 'typing a source date' });
    expect(refused.status, 'the API refuses a manual date on a source-driven milestone').toBe(422);

    plan = await planOf(api, order.id);
    for (const code of manual) {
      expect(act(plan, code).actualDate).toBe(today());
      expect(act(plan, code).evidence.note).toContain(`E2E ${code}`);
    }
    expect(consoleGuard).toEqual([]);
  });

  test('Finishing › Checking completes finishing output (pre-final pass qty) and the final AQL', async ({ api }) => {
    const qty = plan.header.qty;
    const colour = order.orderLines[0].colorRows[0].colorName;
    const base = { orderId: order.id, color: colour, date: today(), defects: [], labelChecks: {}, points: [], alterQty: 0, rejectQty: 0 };
    const half = Math.floor(qty / 2);
    ok(await api.post('/finishing/checkings', { ...base, stage: 'PRE_FINAL', passQty: half, target: half }), 'pre-final 1');
    let now = await planOf(api, order.id);
    expect(act(now, 'A21').actualDate, 'half the order checked: progress only').toBeNull();
    expect(act(now, 'A21').progressPct).toBeGreaterThan(0);

    ok(await api.post('/finishing/checkings', { ...base, stage: 'PRE_FINAL', passQty: qty - half, target: qty - half }), 'pre-final 2');
    const final = ok(await api.post('/finishing/checkings', { ...base, stage: 'FINAL', lotSize: qty, passQty: 13 }), 'final AQL');
    expect(final.verdict).toBe('ACCEPTED');
    now = await planOf(api, order.id);
    expect(act(now, 'A21').actualDate).toBe(today());
    expect(act(now, 'A21').progressPct).toBe(100);
    expect(act(now, 'A23').actualDate).toBe(today());
    expect(act(now, 'A23').sourceRecord).toBe(final.checkNo);
    plan = now;
  });

  test('the T&A screens show the order as the API derived it', async ({ authedPage: page, consoleGuard }) => {
    test.setTimeout(240000);
    await page.goto('/tna/control-tower');
    const row = page.locator('tr', { hasText: order.orderNo });
    await expect(row).toBeVisible({ timeout: 90000 });

    await page.goto(`/tna/plan/${plan.header.id}`);
    await expect(page.getByRole('heading', { name: `T&A plan — ${order.orderNo}`, level: 1 })).toBeVisible({ timeout: 90000 });
    await expect(page.getByText(`template ${expectedTemplate(order)}`)).toBeVisible();
    await expect(page.getByText('Live from source records')).toBeVisible();

    await page.goto(`/tna/revisions?plan=${plan.header.id}`);
    await expect(page.getByText('Plan generated').first()).toBeVisible({ timeout: 90000 });

    await page.goto('/tna/masters?tab=templates');
    await expect(page.getByRole('heading', { name: 'T&A masters', level: 1 })).toBeVisible({ timeout: 90000 });
    expect(consoleGuard).toEqual([]);
  });

  test('a closed shipment dispatches every line and closes the plan', async ({ api }) => {
    const { data: buyers } = await api.get('/buyers');
    const buyer = (Array.isArray(buyers) ? buyers : buyers.content).find((b) => b.id === order.buyerId);
    const portId = async (code) => (await api.get('/ports', { search: code, kinds: 'SEA' })).data.find((p) => p.code === code).id;
    const options = ok(await api.get('/export-docs/shipments/order-options', { buyerId: buyer.id }), 'order options');
    const option = options.find((o) => o.orderId === order.id);
    expect(option, 'the packed order is offered to a shipment').toBeTruthy();
    const shipment = ok(await api.post('/export-docs/shipments', {
      buyerId: buyer.id, notifyParty: { kind: 'LOCATION', locationId: buyer.shippingLocations[0].id },
      orderIds: [order.id],
      // Every buyer PO of the order goes on this shipment, as the screen ticks them
      orderPos: [{ orderId: order.id, pos: option.pos.map((p) => ({ buyerPoNo: p.buyerPoNo, destination: p.destination })) }],
      mode: 'SEA', incoterm: 'FOB', preCarriageBy: 'ROAD', placeOfReceipt: 'Tiruppur',
      vesselFlightNo: 'MSC TNA E2E', portOfLoadingId: await portId('INMAA1'), portOfDischargeId: await portId('NLRTM'),
      finalDestination: 'Rotterdam, Netherlands', countryOfFinalDestination: 'Netherlands',
      etd: today(), eta: today(), forwarder: 'Kuehne + Nagel', containerNos: ['TNAU1234567'],
    }), 'create shipment');
    expect(ok(await api.post(`/export-docs/shipments/${shipment.id}/close`), 'close shipment').status).toBe('CLOSED');

    const done = await planOf(api, order.id);
    expect(act(done, 'A24').actualDate, 'dispatch from the closed shipment').toBe(today());
    expect(act(done, 'A24').sourceRecord).toContain(shipment.shipmentNo);
    expect(done.header.lines.every((l) => l.actualDispatch === today())).toBe(true);
    expect(done.header.status).toBe('CLOSED');
    expect(done.header.actualDispatch).toBe(today());
    expect(done.header.latest.actualDelay, 'shipped before the commitment').toBeLessThanOrEqual(0);

    const analytics = ok(await api.get('/tna/analytics', { months: 6 }), 'analytics');
    expect(analytics.kpis.orders).toBeGreaterThanOrEqual(1);
  });
});
