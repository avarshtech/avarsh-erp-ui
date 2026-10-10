// Packing lists bind the REAL Carton Packing entries, order by order and buyer PO by PO
// (owner, 2026-10-09/10). Zara's ORD/0002 (e2e seed V111) carries two POs to Arteixo DC.
//   E2E_BASE_URL=http://localhost:3001 E2E_PASSWORD=admin123 \
//     npx playwright test e2e/specs/export-docs/packing-list-blocks.spec.js --project=export-docs
import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import {
  createEntry, deleteEntry, orderIdOf, purgeMarked, range,
} from '../../helpers/packing-api.js';
import {
  goTo, settle, expectToast, button, selectFor,
} from '../sample-requests/helpers.js';

const API = '/export-docs/shipments';
const PO1 = 'ZR-PO-2025-101';
const PO2 = 'ZR-PO-2025-102';
const DEST = 'Arteixo DC';

let api;
let orderId;
const shipments = [];

test.beforeAll(async () => {
  api = await createAuthenticatedClient();
  orderId = await orderIdOf(api, 'ORD/0002');
});

// Every test starts with no fixture entries on the order, so what is offered is its own
test.beforeEach(async () => { await purgeMarked(api, orderId); });

test.afterAll(async () => {
  await purgeMarked(api, orderId);
  for (const id of shipments) {
    const { status, data } = await api.get(`${API}/${id}`);
    if (status !== 200) continue;
    const open = data.status === 'CLOSED' ? (await api.post(`${API}/${id}/reopen`)).data : data;
    await api.delete(`${API}/${id}?version=${open.version}`);
  }
  await api?.dispose();
});

const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const ctn = (from, to, po, extra = {}) => range({ cartonFrom: from, cartonTo: to, buyerPoNo: po, destination: DEST, ...extra });

/** A shipment body for ORD/0002, sending the given POs; `version` for a save. */
const shipmentBody = async (pos, version = null) => {
  const { data: buyers } = await api.get('/buyers');
  const zara = (Array.isArray(buyers) ? buyers : buyers.content).find((b) => b.name === 'Zara (Inditex)');
  const port = async (code) => (await api.get('/ports', { search: code, kinds: 'SEA' })).data.find((p) => p.code === code).id;
  return {
    buyerId: zara.id,
    notifyParty: { kind: 'LOCATION', locationId: zara.shippingLocations.find((l) => l.label === DEST).id },
    orderIds: [orderId],
    orderPos: [{ orderId, pos: pos.map((buyerPoNo) => ({ buyerPoNo, destination: DEST })) }],
    mode: 'SEA', incoterm: 'FOB', preCarriageBy: 'ROAD', placeOfReceipt: 'Tiruppur', vesselFlightNo: 'MSC ANNA V.241E',
    portOfLoadingId: await port('INMAA1'), portOfDischargeId: await port('NLRTM'),
    finalDestination: 'Rotterdam, Netherlands', countryOfFinalDestination: 'Netherlands', etd: '2026-12-01', eta: '2026-12-27',
    forwarder: 'Kuehne + Nagel', containerNos: ['HLXU1234567'], version,
  };
};

const zaraShipment = async (pos) => {
  const res = await api.post(API, await shipmentBody(pos));
  expect(res.status, JSON.stringify(res.data)).toBe(201);
  shipments.push(res.data.id);
  return res.data;
};

/** A packing list raised through the service the screens call, taking these entries' units. */
const raiseList = (page, shipmentId, entryIds) => page.evaluate(async ({ shipment, ids }) => {
  const svc = await import('/src/services/expdoc/expDocService.js');
  const { orders } = await svc.listBindableForShipment(shipment);
  const units = orders.flatMap((o) => o.pos.flatMap((p) => p.units)).filter((u) => ids.includes(u.packingEntryId));
  const pl = await svc.createPackingList({ shipmentId: shipment, units: units.map((u) => ({ packingEntryId: u.packingEntryId, poKey: u.poKey })) });
  return { id: pl.id, plNo: pl.plNo, version: pl.version };
}, { shipment: shipmentId, ids: entryIds });

const printedOf = (page, plId) => page.evaluate(async (id) => {
  const svc = await import('/src/services/expdoc/expDocService.js');
  const pl = await svc.getPackingList(id);
  return {
    rows: pl.sections.flatMap((s) => s.rows).map((r) => [r.buyerPoNo, r.cartonFrom, r.cartonTo]),
    label: pl.cartonRangeLabel,
    version: pl.version,
    codes: pl.panelFindings.findings.map((f) => f.code),
  };
}, plId);

test.describe('Packing lists by buyer PO', () => {
  test('one packing day feeds two shipments, each list taking only its own PO', async ({ page }) => {
    const entry = await createEntry(api, { orderId, groups: [ctn(1, 10, PO1), ctn(11, 15, PO2)] });
    const first = await zaraShipment([PO1]);
    const second = await zaraShipment([PO2]);
    await goTo(page, '/export-docs/packing-lists/list');

    const pl1 = await raiseList(page, first.id, [entry.id]);
    const pl2 = await raiseList(page, second.id, [entry.id]);
    expect((await printedOf(page, pl1.id)).rows).toEqual([[PO1, 1, 10]]);
    // PO2's cartons are 11–15 in Carton Packing; a list of its own prints them from 1
    expect((await printedOf(page, pl2.id)).rows).toEqual([[PO2, 1, 5]]);

    await goTo(page, `/export-docs/packing-lists/edit/${pl2.id}`);
    await expect(page.getByText(`PO ${PO2} · ${DEST}`).first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('own 11–15').first()).toBeVisible();

    // Carton Packing names the lists the entry's cartons sit on (this browser holds them)
    await goTo(page, `/production/packing/edit/${entry.id}`);
    await expect(page.getByText(`${pl1.plNo} · PO ${PO1}`)).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(`${pl2.plNo} · PO ${PO2}`)).toBeVisible();
    await deleteEntry(api, entry.id);
  });

  test('entries that all start at carton 1 number in packing-date order; the rule renumbers them', async ({ page }) => {
    const older = await createEntry(api, { orderId, packingDate: day(-1), groups: [ctn(1, 5, PO1)] });
    const newer = await createEntry(api, { orderId, groups: [ctn(1, 4, PO1), ctn(5, 7, PO2)] });
    const shipment = await zaraShipment([PO1, PO2]);
    await goTo(page, '/export-docs/packing-lists/list');
    const pl = await raiseList(page, shipment.id, [older.id, newer.id]);

    // Continue across the shipment: PO1's days stacked by date, then PO2
    expect((await printedOf(page, pl.id)).rows).toEqual([[PO1, 1, 5], [PO1, 6, 9], [PO2, 10, 12]]);

    await goTo(page, `/export-docs/packing-lists/edit/${pl.id}`);
    await page.getByText('Restart for each buyer PO', { exact: true }).click();
    await expectToast(page, 'Cartons renumbered');
    const after = await printedOf(page, pl.id);
    expect(after.rows).toEqual([[PO1, 1, 5], [PO1, 6, 9], [PO2, 1, 3]]);
    expect(after.label).toBe(`PO ${PO1}: 1–9 · PO ${PO2}: 1–3`);
  });

  test('new packing is offered on the draft, added in one click, and can be taken off again', async ({ page }) => {
    const shipment = await zaraShipment([PO1]);
    await goTo(page, '/export-docs/packing-lists/list');
    // Created before anything is packed: the buyer's list can come first
    const pl = await raiseList(page, shipment.id, []);
    const entry = await createEntry(api, { orderId, groups: [ctn(1, 8, PO1)] });

    await goTo(page, `/export-docs/packing-lists/edit/${pl.id}`);
    const offer = page.getByRole('alert').filter({ hasText: 'not on the list yet' });
    await expect(offer).toContainText(entry.packingNo, { timeout: 20000 });
    await offer.getByRole('button', { name: 'Add', exact: true }).click();
    await expectToast(page, 'Packing added');
    expect((await printedOf(page, pl.id)).rows).toEqual([[PO1, 1, 8]]);

    await page.getByRole('button', { name: 'Remove', exact: true }).click();
    await expectToast(page, 'Packing taken off this list');
    await expect(page.getByRole('button', { name: `${entry.packingNo} — add back` })).toBeVisible();
    expect((await printedOf(page, pl.id)).rows).toEqual([]);
  });

  test('a PO taken off the shipment is flagged on its list, and Drop takes its cartons off', async ({ page }) => {
    const entry = await createEntry(api, { orderId, groups: [ctn(1, 6, PO1), ctn(7, 9, PO2)] });
    const shipment = await zaraShipment([PO1, PO2]);
    await goTo(page, '/export-docs/packing-lists/list');
    const pl = await raiseList(page, shipment.id, [entry.id]);

    const res = await api.put(`${API}/${shipment.id}`, await shipmentBody([PO2], shipment.version));
    expect(res.status, JSON.stringify(res.data)).toBe(200);

    await goTo(page, `/export-docs/packing-lists/edit/${pl.id}`);
    await expect(page.getByText('No longer on the shipment').first()).toBeVisible({ timeout: 20000 });
    expect((await printedOf(page, pl.id)).codes).toContain('V-20');
    await page.getByRole('button', { name: 'delete Drop', exact: true }).click();
    await expectToast(page, 'Dropped from this list');
    const after = await printedOf(page, pl.id);
    expect(after.codes).not.toContain('V-20');
    expect(after.rows).toEqual([[PO2, 1, 3]]);
  });

  test("the buyer's list first: a plan, Pack as per packing list, and the list fills to the plan", async ({ page }) => {
    const shipment = await zaraShipment([PO1]);
    await goTo(page, '/export-docs/packing-lists/list');
    const pl = await raiseList(page, shipment.id, []);
    // The buyer's packing list numbers PO1's cartons 21–30
    const planned = await page.evaluate(async ({ id, order, po, dest }) => {
      const svc = await import('/src/services/expdoc/expDocService.js');
      const current = await svc.getPackingList(id);
      const next = await svc.savePlPlan(id, order, [{
        sectionKey: 'MAIN', packingType: 'SOLID', cartonFrom: 21, cartonTo: 30, buyerPoNo: po, destination: dest,
        colorName: 'Navy', sizeQty: { M: 10 }, netWeightKg: 10, grossWeightKg: 11, lengthCm: 60, breadthCm: 40, heightCm: 35,
      }], current.version);
      return next.panelFindings.findings.filter((f) => f.code === 'V-17').map((f) => f.message);
    }, { id: pl.id, order: orderId, po: PO1, dest: DEST });
    expect(planned[0]).toContain('Cartons 21–30 of PO ZR-PO-2025-101');
    expect(planned[0]).toContain('Pack them, or mark them Not shipping');

    // Carton Packing offers the planned cartons, with the buyer's numbers and PO
    await goTo(page, '/production/packing/new');
    // The order pick-list searches the server, 25 at a time: type the order, then pick it
    const orderSelect = selectFor(page, 'Order');
    await orderSelect.click();
    await orderSelect.locator('input').fill('ORD/0002');
    await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
      .filter({ hasText: 'ORD/0002' }).first().click({ timeout: 15000 });
    await page.getByRole('button', { name: 'Pack as per packing list' }).click({ timeout: 20000 });
    const dialog = page.getByRole('dialog', { name: 'Pack as per packing list' });
    await dialog.getByText(new RegExp(`${pl.plNo.replace(/\//g, '\\/')} · 21–30 · PO ${PO1}`)).click();
    await dialog.getByRole('button', { name: 'Fill the grid' }).click();
    await button(page, 'Save').click();
    await expect(page).toHaveURL(/\/production\/packing\/edit\/\d+/, { timeout: 20000 });
    const entryId = Number(page.url().match(/edit\/(\d+)/)[1]);

    // The list offers it as packed as per the plan; added, the plan is met and prints as planned
    await goTo(page, `/export-docs/packing-lists/edit/${pl.id}`);
    const offer = page.getByRole('alert').filter({ hasText: 'packed as per the plan' });
    await expect(offer).toBeVisible({ timeout: 20000 });
    await offer.getByRole('button', { name: 'Add', exact: true }).click();
    await expectToast(page, 'Packing added');
    const after = await printedOf(page, pl.id);
    expect(after.rows).toEqual([[PO1, 21, 30]]);
    expect(after.codes).not.toContain('V-17');
    await deleteEntry(api, entryId);
  });

  test('Carton Packing: on an order with several POs every range must name its PO before Mark complete', async ({ page }) => {
    const entry = await createEntry(api, { orderId, groups: [ctn(1, 5, null, { destination: null })], complete: false });
    await goTo(page, `/production/packing/edit/${entry.id}`);
    await expect(page.getByText('Pick the buyer PO for every carton range')).toBeVisible({ timeout: 20000 });
    await expect(button(page, 'Mark complete')).toBeDisabled();

    await page.locator('.ant-select').filter({ hasText: 'Pick the PO' }).first().click();
    await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
      .filter({ hasText: `${PO1} · ${DEST}` }).first().click();
    await button(page, 'Save').click();
    await expectToast(page, `${entry.packingNo} saved`);
    await settle(page);
    await expect(button(page, 'Mark complete')).toBeEnabled();
  });
});
