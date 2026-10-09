/**
 * Shipments on the real API (/api/v1/export-docs/shipments).
 *
 * Ports come from the port catalogue (/api/v1/ports), which the API loads from its bundled
 * UN/LOCODE release at startup; the pickers search it as the user types.
 *
 * The e2e seed gives Zara (two shipping locations) a bank (db/e2eseed/V20261008214442), so
 * notifying the bank asks which location prints under the consignee; H&M has no bank and
 * notifies a location. Orders: ORD/0002 is Zara's, ORD/0001 (a draft) is H&M's.
 *
 * A shipment closes when every packing list and invoice on it is released. Those are still a
 * browser mock with no demo cartons for these buyers, so the close itself is driven through
 * the API here (its rule is unit-tested in e2e/unit/shipment-bridge.spec.js), and the spec
 * checks what the screen does with a closed shipment. Every shipment a spec makes is its own,
 * so the specs can run again on the same stack.
 */
import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import {
  goTo, settle, pickOption, selectFor, inputFor, fillDate, expectToast, button,
} from '../sample-requests/helpers.js';

const LIST = '/export-docs/shipments/list';
const API = '/export-docs/shipments';

let api;
/** Every shipment a spec makes: removed at the end, or a long-lived stack collects them run after run. */
const created = [];

test.beforeAll(async () => {
  api = await createAuthenticatedClient();
});

test.afterAll(async () => {
  for (const id of created) {
    const { status, data } = await api.get(`${API}/${id}`);
    if (status !== 200) continue;
    const open = data.status === 'CLOSED' ? (await api.post(`${API}/${id}/reopen`)).data : data;
    await api.delete(`${API}/${id}?version=${open.version}`);
  }
  await api?.dispose();
});

const buyerNamed = async (name) => {
  const { data } = await api.get('/buyers');
  return (Array.isArray(data) ? data : data.content).find((b) => b.name === name);
};

/** A port's catalogue id (the API loads UN/LOCODE at startup). */
const portId = async (code, kinds) => {
  const { data } = await api.get('/ports', { search: code, kinds });
  return data.find((p) => p.code === code).id;
};

/** A port picked the way a user does: the picker searches the catalogue on the server as they type. */
const pickPort = async (page, label, typed, optionText) => {
  const select = selectFor(page, label);
  await select.click();
  await select.locator('input').fill(typed);
  const option = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
    .filter({ hasText: optionText }).first();
  await option.waitFor({ state: 'visible', timeout: 15000 });
  await option.click();
  return option;
};

/** An OPEN shipment of the buyer, notifying one of its locations, made through the API. */
const apiShipment = async (buyerName, locationLabel, orderNo) => {
  const buyer = await buyerNamed(buyerName);
  const location = buyer.shippingLocations.find((l) => l.label === locationLabel);
  const { data: orders } = await api.get(`${API}/order-options`, { buyerId: buyer.id });
  const res = await api.post(API, {
    buyerId: buyer.id,
    notifyParty: { kind: 'LOCATION', locationId: location.id },
    orderIds: [orders.find((o) => o.orderNo === orderNo).orderId],
    mode: 'SEA',
    incoterm: 'FOB',
    preCarriageBy: 'ROAD',
    placeOfReceipt: 'Tiruppur',
    vesselFlightNo: 'MSC ANNA V.241E',
    portOfLoadingId: await portId('INMAA1', 'SEA'),
    portOfDischargeId: await portId('NLRTM', 'SEA'),
    finalDestination: 'Rotterdam, Netherlands',
    countryOfFinalDestination: 'Netherlands',
    etd: '2026-12-01',
    eta: '2026-12-27',
    forwarder: 'Kuehne + Nagel',
    containerNos: ['HLXU1234567'],
  });
  expect(res.status, JSON.stringify(res.data)).toBe(201);
  created.push(res.data.id);
  return res.data;
};

const hmShipment = () => apiShipment('H&M Hennes & Mauritz', 'Hamburg DC', 'ORD/0001');

/** The register, narrowed to one shipment by its number. */
const findInRegister = async (page, shipmentNo) => {
  await goTo(page, LIST);
  await page.getByPlaceholder('Search shipment no, consignee, order, vessel or container').fill(shipmentNo);
  await settle(page);
  return page.locator('.ant-table-row').filter({ hasText: shipmentNo });
};

test.describe('Shipments', () => {
  test('notifying the bank asks for the consignee address; the save keeps its version', async ({ page }) => {
    await goTo(page, '/export-docs/shipments/new');
    await pickOption(page, selectFor(page, 'Consignee'), 'Zara (Inditex)');
    await settle(page, 400);

    // The Orders picker offers the consignee's orders, not another buyer's
    await selectFor(page, 'Orders').click();
    const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');
    await expect(dropdown.getByText(/ORD\/0002/).first()).toBeVisible({ timeout: 15000 });
    await expect(dropdown.getByText(/ORD\/0001/)).toHaveCount(0);
    await dropdown.locator('.ant-select-item-option').filter({ hasText: 'ORD/0002' }).first().click();
    await page.keyboard.press('Escape');

    await pickOption(page, selectFor(page, 'Notify party'), 'Banco Santander');
    // Zara has two shipping locations, so the address under the consignee must be picked
    await pickOption(page, selectFor(page, 'Consignee address'), 'Zaragoza DC');
    // Ports from the catalogue, found by their code; Chennai is known by its former name too
    await pickPort(page, 'Port of loading', 'madras', 'Chennai (INMAA1)');
    await pickPort(page, 'Port of discharge', 'NLRTM', 'Rotterdam (NLRTM)');
    await fillDate(page, 'ETD', '01-Nov-2026'); // the form's DD-MMM-YYYY

    // Every field is mandatory but the BL/AWB (issued after loading); a sea shipment needs a container
    await button(page, 'Save').click();
    for (const error of ['Enter the place of receipt', 'Enter the vessel or flight no.', 'Enter the ETA',
      'Enter the forwarder', 'Enter the container number(s): a sea shipment travels in containers']) {
      await expect(page.locator('.ant-form-item-explain-error').filter({ hasText: error })).toBeVisible();
    }
    await expect(page).toHaveURL(/\/export-docs\/shipments\/new$/);
    await inputFor(page, 'Place of receipt').fill('Tiruppur');
    await inputFor(page, 'Vessel').fill('MSC ANNA V.241E');
    await inputFor(page, 'Final destination').fill('Rotterdam, Netherlands');
    await inputFor(page, 'Country of final destination').fill('Netherlands');
    await fillDate(page, 'ETA', '25-Nov-2026');
    await inputFor(page, 'Forwarder').fill('Kuehne + Nagel');
    const containers = selectFor(page, 'Container');
    await containers.click();
    await containers.locator('input').fill('mscu1234567');
    await page.keyboard.press('Enter');

    const consignee = page.getByText(/^Zara \(Inditex\)\s+Plataforma Logistica PLAZA/);
    await expect(consignee).toContainText('Attn: Miguel Torres');
    await expect(consignee).not.toContainText('+34');
    await expect(page.getByText('SWIFT: BSCHESMM')).toBeVisible();

    await button(page, 'Save').click();
    await expect(page).toHaveURL(/\/export-docs\/shipments\/edit\/\d+/, { timeout: 20000 });
    created.push(Number(page.url().match(/edit\/(\d+)/)[1]));
    await expectToast(page, /SHP\/.+ saved/);
    const shipmentNo = (await page.locator('h1, h2, h3, h4').filter({ hasText: /^SHP\// }).first().innerText()).trim();

    // Saved again with the version the first save returned: the PUT answers 200, not a 409.
    // (Its toast proves nothing: the first save's identical one can still be on screen.)
    // At once, before the URL change has settled: a second Save once sent a POST here and made
    // a duplicate shipment.
    const saveRequests = [];
    page.on('request', (r) => {
      if (/\/api\/v1\/export-docs\/shipments(\/\d+)?$/.test(r.url()) && ['POST', 'PUT'].includes(r.method())) {
        saveRequests.push(r.method());
      }
    });
    const resaved = page.waitForResponse((r) => r.request().method() === 'PUT'
      && /\/export-docs\/shipments\/\d+$/.test(r.url()));
    await button(page, 'Save').click();
    expect((await resaved).status()).toBe(200);
    expect(saveRequests).toEqual(['PUT']);

    // Found by its order and by its port's code, and the view shows what prints: the port's name and code
    const row = await findInRegister(page, 'ORD/0002');
    await expect(row.first()).toBeVisible();
    await expect((await findInRegister(page, 'INMAA1')).filter({ hasText: shipmentNo })).toContainText('Chennai (INMAA1)');
    await page.locator('.ant-table-row').filter({ hasText: shipmentNo }).first().click();
    const view = page.getByRole('dialog');
    await expect(view.getByText(/Plataforma Logistica PLAZA/).first()).toBeVisible();
    await expect(view.getByText('Banco Santander S.A.').first()).toBeVisible();
    await expect(view.getByText('Chennai (INMAA1)').first()).toBeVisible();
    await expect(view.getByText('Rotterdam (NLRTM)').first()).toBeVisible();
  });

  test('the mode decides the ports: switching to air empties them and offers airports', async ({ page }) => {
    await goTo(page, '/export-docs/shipments/new');
    await pickPort(page, 'Port of loading', 'INTUP6', 'ICD Tiruppur (INTUP6)'); // a sea shipment may load at an ICD
    await pickPort(page, 'Port of discharge', 'NLRTM', 'Rotterdam (NLRTM)');

    // Reopened, the picker starts again from the first page, not from the last search
    await selectFor(page, 'Port of discharge').click();
    const listed = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option');
    await expect(listed.filter({ hasNotText: 'Rotterdam' }).first()).toBeVisible({ timeout: 15000 });
    await page.keyboard.press('Escape');

    await pickOption(page, selectFor(page, 'Mode'), 'Air');
    await expect(selectFor(page, 'Port of loading')).not.toContainText('Tiruppur');
    await expect(selectFor(page, 'Port of discharge')).not.toContainText('Rotterdam');

    // By air: Chennai's airport, and Rotterdam's airport, not its seaport
    await pickPort(page, 'Port of loading', 'chennai', 'Chennai (INMAA4)');
    const discharge = selectFor(page, 'Port of discharge');
    await discharge.click();
    await discharge.locator('input').fill('NLRTM');
    const offered = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option');
    await expect(offered.first()).toContainText('Airport', { timeout: 15000 });
    await expect(offered.filter({ hasText: 'Seaport' })).toHaveCount(0);
    await page.keyboard.press('Escape');
  });

  test('notifying a shipping location prints its address under the consignee, with no address to pick', async ({ page }) => {
    await goTo(page, '/export-docs/shipments/new');
    await pickOption(page, selectFor(page, 'Consignee'), 'H&M Hennes & Mauritz');
    await settle(page, 400);
    await pickOption(page, selectFor(page, 'Notify party'), 'Hamburg DC');

    await expect(selectFor(page, 'Consignee address')).toHaveCount(0);
    await expect(page.getByText(/^H&M Hennes & Mauritz\s+Wandsbeker Zollstrasse 117/)).toContainText('Attn: Erik Larsson');
  });

  test('a closed shipment opens read-only, and reopening makes it editable again', async ({ page }) => {
    const shipment = await hmShipment();
    expect((await api.post(`${API}/${shipment.id}/close`)).data.status).toBe('CLOSED');

    await goTo(page, `/export-docs/shipments/edit/${shipment.id}`);
    await expect(page.getByText('Closed: every packing list and invoice on this shipment is released')).toBeVisible();
    await expect(button(page, 'Save')).toHaveCount(0);
    for (const label of ['Consignee', 'Orders', 'Notify party', 'Port of loading']) {
      await expect(selectFor(page, label), label).toHaveClass(/ant-select-disabled/);
    }
    // The register offers no Edit or Delete on it
    const row = await findInRegister(page, shipment.shipmentNo);
    await expect(row).toBeVisible();
    await expect(row).toContainText('Closed');
    await expect(row.getByRole('button', { name: 'edit' })).toHaveCount(0);
    await expect(row.getByRole('button', { name: 'delete' })).toHaveCount(0);

    expect((await api.post(`${API}/${shipment.id}/reopen`)).data.status).toBe('OPEN');
    await goTo(page, `/export-docs/shipments/edit/${shipment.id}`);
    await expect(button(page, 'Save')).toBeVisible();
    await expect(page.getByText('Closed: every packing list and invoice on this shipment is released')).toHaveCount(0);
  });

  test('releasing its only document closes the shipment, and cancelling it reopens the shipment', async ({ page }) => {
    // JOMO BV: its demo packing entries bind to a shipment of their buyer (seed V20261008214442)
    const shipment = await apiShipment('JOMO BV', 'Valkenswaard DC', 'ORD/JOMO-E2E');
    await goTo(page, LIST);

    // Packing lists are still the browser mock: driven through the same service the screens call
    const raised = await page.evaluate(async (shipmentId) => {
      const svc = await import('/src/services/expdoc/expDocService.js');
      const entries = (await svc.listBindableForShipment(shipmentId)).filter((e) => e.bindable);
      let pl = await svc.createPackingList({ shipmentId, packingEntryIds: entries.map((e) => e.id) });
      for (let round = 0; round < 5 && pl.panelFindings.blocking.length; round += 1) {
        for (const finding of pl.panelFindings.blocking) {
          pl = await svc.acknowledgeWarning(pl.id, finding.targetKey, 'E2E: accepted for the closing check');
        }
      }
      pl = await svc.changePlStatus(pl.id, 'FINAL');
      pl = await svc.markPackingListExported(pl.id);
      return { plId: pl.id, status: pl.status, entries: entries.length };
    }, shipment.id);
    expect(raised.entries).toBeGreaterThan(0);
    expect(raised.status).toBe('EXPORTED');
    const closed = (await api.get(`${API}/${shipment.id}`)).data;
    expect(closed.status).toBe('CLOSED');
    expect(closed.closedByName).toBeTruthy();

    await page.evaluate(async (plId) => {
      const svc = await import('/src/services/expdoc/expDocService.js');
      await svc.changePlStatus(plId, 'CANCELLED', 'E2E: reopening the shipment');
    }, raised.plId);
    expect((await api.get(`${API}/${shipment.id}`)).data.status).toBe('OPEN');
  });

  test('an open shipment is deleted from the register', async ({ page }) => {
    const shipment = await hmShipment();

    const row = await findInRegister(page, shipment.shipmentNo);
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'delete' }).click();
    await page.locator('.ant-popconfirm').getByRole('button', { name: 'Delete' }).click();
    await expectToast(page, `${shipment.shipmentNo} deleted`);

    expect((await api.get(`${API}/${shipment.id}`)).status).toBe(404);
  });
});
