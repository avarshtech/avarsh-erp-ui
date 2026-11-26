/**
 * T&A 03 — the newest production-flow order's plan, end to end (run after production-flow/08): every
 * milestone the ERP has a record for was completed by that record on its date; the three with no record
 * (pattern release, First Bulk Piece, PP meeting) are recorded on the plan page; Finishing › Checking
 * completes finishing output and the final AQL; what is packed ships in two parts, each capped at what is left,
 * and the order — packed only in part by the flow — is not dispatched until it ships in full.
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

  test('what is packed ships in two parts; the order is not dispatched until it has shipped in full', async ({ api }) => {
    const { data: buyers } = await api.get('/buyers');
    const buyer = (Array.isArray(buyers) ? buyers : buyers.content).find((b) => b.id === order.buyerId);
    const portId = async (code) => (await api.get('/ports', { search: code, kinds: 'SEA' })).data.find((p) => p.code === code).id;
    // production-flow/08 leaves its entry reopened for editing: packing is finished before anything ships
    const { data: entries } = await api.get('/packing/entries', { orderId: order.id, page: 0, size: 50 });
    for (const e of (entries.content || []).filter((x) => x.status === 'OPEN')) {
      ok(await api.post(`/packing/entries/${e.id}/complete`, { version: e.version }), 'complete packing');
    }
    const options = ok(await api.get('/export-docs/shipments/order-options', { buyerId: buyer.id }), 'order options');
    const option = options.find((o) => o.orderId === order.id);
    expect(option, 'the packed order is offered to a shipment').toBeTruthy();
    // Each buyer PO's packed pieces, split: about half on the first shipment, the rest on the second
    const split = (packed, part) => Object.fromEntries(Object.entries(packed).map(([colour, sizes]) => [colour,
      Object.fromEntries(Object.entries(sizes).map(([size, n]) => [size, part === 1 ? Math.ceil(n / 2) : Math.floor(n / 2)])
        .filter(([, n]) => n > 0))]));
    const shipmentBody = async (pos, n) => ({
      buyerId: buyer.id, notifyParty: { kind: 'LOCATION', locationId: buyer.shippingLocations[0].id },
      orderIds: [order.id], orderPos: [{ orderId: order.id, pos }],
      mode: 'SEA', incoterm: 'FOB', preCarriageBy: 'ROAD', placeOfReceipt: 'Tiruppur',
      vesselFlightNo: `MSC TNA E2E ${n}`, portOfLoadingId: await portId('INMAA1'), portOfDischargeId: await portId('NLRTM'),
      finalDestination: 'Rotterdam, Netherlands', countryOfFinalDestination: 'Netherlands',
      etd: today(), eta: today(), forwarder: 'Kuehne + Nagel', containerNos: [`TNAU123456${n}`],
    });
    const ship = async (part) => ok(await api.post('/export-docs/shipments', await shipmentBody(option.pos.map((p) => ({
      buyerPoNo: p.buyerPoNo, destination: p.destination, colorQty: split(p.packed, part) })), part)), `shipment ${part}`);

    const first = await ship(1);
    expect(first.orders[0].pos[0].shipQty).toBeGreaterThan(0);
    expect(ok(await api.post(`/export-docs/shipments/${first.id}/close`), 'close 1').status).toBe('CLOSED');
    const second = await ship(2);
    expect(ok(await api.post(`/export-docs/shipments/${second.id}/close`), 'close 2').status).toBe('CLOSED');
    const packedTotal = option.pos.reduce((t, p) => t + Object.values(p.packed).flatMap(Object.values).reduce((a, n) => a + n, 0), 0);
    expect(first.orders[0].pos.concat(second.orders[0].pos).reduce((t, p) => t + p.shipQty, 0), 'everything packed shipped once').toBe(packedTotal);

    // Nothing packed is left, so a third shipment cannot send a single piece more of the same POs
    const [firstColour] = Object.keys(option.pos[0].packed);
    const [firstSize] = Object.keys(option.pos[0].packed[firstColour]);
    const third = await api.post('/export-docs/shipments', await shipmentBody([{ buyerPoNo: option.pos[0].buyerPoNo,
      destination: option.pos[0].destination, colorQty: { [firstColour]: { [firstSize]: 1 } } }], 9));
    expect(third.status).toBe(422);
    expect(third.data.message).toMatch(/is more than the 0 packed and not yet shipped/);

    // The flow packs part of the order: below 95% of each line, the lines are not dispatched and the plan stays open
    const plan = await planOf(api, order.id);
    expect(act(plan, 'A24').actualDate, 'not dispatched: the order is not shipped in full').toBeNull();
    expect(plan.header.lines.every((l) => !l.actualDispatch)).toBe(true);
    expect(plan.header.status).toBe('ACTIVE');
    expect(ok(await api.get(`/orders/${order.id}`), 'order').status).not.toBe('COMPLETED');

    // Analytics counts dispatched orders only; it answers whether or not this one has gone
    const analytics = ok(await api.get('/tna/analytics', { months: 6 }), 'analytics');
    expect(analytics.kpis).toBeTruthy();
  });
});
