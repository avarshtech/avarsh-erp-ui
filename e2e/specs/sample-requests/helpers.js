/**
 * Shared helpers for the Sample Request specs.
 *
 * Two kinds of thing live here. The first is the usual UI plumbing — landing on
 * a screen, picking an AntD option, reading a toast. The second is an API-level
 * builder that walks a sample request up to whatever status a spec needs to
 * start from: raising one, issuing material against it and putting it on a
 * dispatch are each covered end-to-end by 02 and 03, so re-driving them through
 * the screens in 04 and 05 would only make those specs slower and more brittle
 * without testing anything new.
 *
 * Everything is built against the seeded SAMPLE order SMP/0001 (Next PLC, UK —
 * overseas against the seeded India organisation) from db/e2eseed.
 */
import { expect } from '@playwright/test';
import { navigateWithAuth, waitForPageReady } from '../../helpers/navigation.js';

export const SEED_ORDER_NO = 'SMP/0001';
export const SEED_BUYER = 'Next PLC';

/** Sample type ids are a fixed list of eight, seeded by the M1 migration. */
export const SAMPLE_TYPE = { PROTO: 1, FIT: 2, SIZE_SET: 3 };

// ── UI plumbing ─────────────────────────────────────────────────────────────

/** Land on a route with its first fetches settled. */
export async function goTo(page, path) {
  await navigateWithAuth(page, path);
  await waitForPageReady(page);
  await settle(page);
}

/** Let a screen's fetches land — these pages issue 1-4 calls on mount. */
export async function settle(page, ms = 900) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms);
}

/** Pick an option out of an AntD select, scoped by the control's own locator. */
export async function pickOption(page, selectLocator, optionText) {
  await selectLocator.click();
  const option = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
    .locator('.ant-select-item-option')
    .filter({ hasText: optionText })
    .first();
  await option.waitFor({ state: 'visible', timeout: 15000 });
  await option.click();
  await page.waitForTimeout(250);
}

/** The AntD select that owns a labelled Form.Item. */
export function selectFor(page, label) {
  return page.locator('.ant-form-item')
    .filter({ has: page.locator('label', { hasText: label }) })
    .locator('.ant-select')
    .first();
}

/** The input that owns a labelled Form.Item (Input, InputNumber or DatePicker). */
export function inputFor(page, label) {
  return page.locator('.ant-form-item')
    .filter({ has: page.locator('label', { hasText: label }) })
    .locator('input')
    .first();
}

/** Type a date into an AntD DatePicker and commit it. */
export async function fillDate(page, label, isoDate) {
  const field = inputFor(page, label);
  await field.click();
  await field.fill(isoDate);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
}

/**
 * Click a button by its visible label.
 *
 * Not getByRole({name}): every button in this module carries an icon, and the
 * icon's own aria-label joins the accessible name ("send Submit"), so an
 * anchored role query never matches. Filtering on rendered text does.
 */
export function button(scope, label) {
  return scope.locator('button').filter({ hasText: label }).first();
}

/** Confirm the visible AntD modal by its OK button text. */
export async function confirmModal(page, okText) {
  const modal = page.locator('.ant-modal-wrap:visible').last();
  await modal.waitFor({ state: 'visible', timeout: 15000 });
  await button(modal, okText).click();
}

/** Assert a toast mentioning `pattern` appeared. */
export async function expectToast(page, pattern) {
  await expect(
    page.locator('.ant-message-notice').filter({ hasText: pattern }).first(),
  ).toBeVisible({ timeout: 20000 });
}

/** Read a table as rows of plain text; header and AntD's measure row dropped. */
export async function tableRows(scope) {
  return scope.locator('.ant-table-row').evaluateAll(
    (rows) => rows
      .map((r) => [...r.querySelectorAll('td')].map((c) => c.innerText.trim()).join(' | '))
      .filter(Boolean),
  );
}

/**
 * Console errors worth failing a test over. The dev server's service worker and
 * a shared AntD deprecation are pre-existing and unrelated to these screens, so
 * they are filtered rather than left to mask real ones. Response failures are
 * asserted against the response status instead — the console line carries no
 * URL, so matching on it here would duplicate that check less precisely.
 */
const IGNORED_CONSOLE = [
  /unsupported MIME type/i,
  /Service worker registration failed/i,
  /overlayInnerStyle` is deprecated/i,
  /ResizeObserver loop/i,
  /Failed to load resource/i,
  // AntD 6 renamed Alert's `message` to `title`. 90 of the app's 177 <Alert>
  // usages still pass `message`, in every module — an app-wide migration, not a
  // sampling defect, so filtering it here keeps this suite honest about its own
  // screens instead of failing on someone else's backlog.
  /\[antd: Alert\] `message` is deprecated/i,
  // Same story for the shared StatusSteps component and Space: AntD 6 renamed Steps
  // `direction`/`items.description` and Space `direction`, and every module's detail
  // dialog still passes the old names. App-wide migrations, not sampling defects.
  /\[antd: Steps\] `direction` is deprecated/i,
  /\[antd: Steps\] `items\.description` is deprecated/i,
  /\[antd: Space\] `direction` is deprecated/i,
];

export function watchConsole(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (IGNORED_CONSOLE.some((re) => re.test(text))) return;
    errors.push(text);
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  return errors;
}

// ── API builder ─────────────────────────────────────────────────────────────

const iso = (daysFromToday) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
};

/** Fail loudly with the server's own message rather than a bare status code. */
function ok(res, what) {
  if (res.status >= 300) {
    throw new Error(`${what} failed: ${res.status} ${JSON.stringify(res.data)}`);
  }
  return res.data;
}

/** The seeded sample order's BOM — every request in these specs starts here. */
export async function seedBomId(api) {
  const preview = ok(
    await api.get(`/sample-requests/bom-preview?orderNo=${encodeURIComponent(SEED_ORDER_NO)}`),
    'bom-preview',
  );
  return preview.header.bomId;
}

/**
 * A DRAFT sample request against the seeded BOM. `materials` is left empty on
 * purpose: it carries per-line overrides only, and the server materialises the
 * lines from the BOM itself.
 */
export async function raiseSr(api, { sampleTypeId = SAMPLE_TYPE.PROTO, sampleQty = 2, sizes = ['S', 'M'] } = {}) {
  const bomId = await seedBomId(api);
  return ok(await api.post('/sample-requests', {
    bomId,
    sampleTypeId,
    colourSubstitutionAllowed: true,
    sampleQty,
    sizes,
    colourReference: 'Pantone 19-4052 Classic Blue',
    priority: 'NORMAL',
    specialInstructions: 'Raised by the e2e suite',
    inHandDate: iso(3),
    dispatchDeadline: iso(10),
    buyerApprovalDeadline: iso(20),
    remarks: '',
    materials: [],
  }), 'create sample request');
}

export async function submitSr(api, sr) {
  return ok(await api.put(`/sample-requests/${sr.id}/status`, { status: 'SUBMITTED', version: sr.version }), 'submit');
}

export async function getSr(api, id) {
  return ok(await api.get(`/sample-requests/${id}`), 'get sample request');
}

/** Issue part of the first offered roll against one fabric line. */
export async function issueFabric(api, srId, { lineNo = 1, qty = 1 } = {}) {
  const rolls = ok(await api.get(`/sample-issues/issuable-rolls?srId=${srId}&lineNo=${lineNo}`), 'issuable rolls');
  expect(rolls.length, 'the seed must offer at least one roll').toBeGreaterThan(0);
  return ok(await api.post('/sample-issues/fabric', {
    sampleRequestId: srId,
    lineNo,
    receivedBy: 'E2E Store',
    issueDate: iso(0),
    remarks: 'e2e fabric issue',
    rolls: [{ fabricStockId: rolls[0].id, issuedQty: qty }],
  }), 'fabric issue');
}

/** Issue one trim line by quantity; the server consumes lots FIFO. */
export async function issueTrims(api, sr, { lineNo, qty } = {}) {
  const trim = (sr.materials || []).find((m) => m.section === 'TRIM' && (lineNo == null || m.lineNo === lineNo));
  expect(trim, 'the seeded BOM must carry a trim line').toBeTruthy();
  return ok(await api.post('/sample-issues/trims', {
    sampleRequestId: sr.id,
    receivedBy: 'E2E Store',
    issueDate: iso(0),
    remarks: 'e2e trims issue',
    items: [{ lineNo: trim.lineNo, issueQty: qty ?? Number(trim.sampleQtyRequired) }],
  }), 'trims issue');
}

/** A DRAFT dispatch carrying the given requests, by courier. */
export async function createDispatch(api, srIds) {
  const couriers = ok(await api.get('/sample-requests/masters/couriers'), 'couriers');
  const courier = couriers.find((c) => !c.isLocal) || couriers[0];
  return ok(await api.post('/sample-dispatches', {
    buyerId: (await api.get('/sample-dispatches/customers')).data[0].buyerId,
    srIds,
    deliveryMethod: 'COURIER',
    dispatchedDate: iso(0),
    courierId: courier.id,
    trackingNo: `AWB-E2E-${Date.now()}`,
    dispatchMode: 'AIR',
    packages: 1,
    courierCost: 1200,
  }), 'create dispatch');
}

/** An ISSUED commercial invoice covering every request on a dispatch. */
export async function issueCommercialInvoice(api, dispatch) {
  const eligible = ok(
    await api.get(`/sample-invoices/eligible-srs?type=COMMERCIAL&dispatchId=${dispatch.id}`),
    'eligible SRs',
  );
  const picks = eligible.filter((r) => r.eligible);
  expect(picks.length, 'the dispatch must offer at least one invoiceable SR').toBeGreaterThan(0);

  const draft = ok(await api.post('/sample-invoices', {
    invoiceType: 'COMMERCIAL',
    invoiceDate: iso(0),
    consigneeName: picks[0].buyerName,
    consigneeAddress: 'Desford Road, Enderby, Leicestershire',
    countryOfOrigin: 'India',
    destinationCountry: picks[0].buyerCountry,
    finalDestination: picks[0].buyerCountry,
    portOfLoading: 'Mumbai',
    portOfDischarge: 'London Heathrow',
    termsOfDelivery: 'DELIVERY AT PLACE — BY AIR',
    buyerOrderNoDate: picks[0].orderNo,
    currency: 'USD',
    srIds: picks.map((r) => r.id),
    lines: picks.map((r, i) => ({
      sortOrder: i,
      srId: r.id,
      srNo: r.srNo,
      styleNo: r.styleNo,
      hsnCode: '6110',
      description: (r.garmentName || '').toUpperCase(),
      quantity: r.quantity,
      uom: 'PCS',
      rate: 12,
      manual: false,
    })),
  }), 'create invoice');

  return ok(await api.post(`/sample-invoices/${draft.id}/issue`, { version: draft.version }), 'issue invoice');
}

/**
 * The whole chain in one call: a request raised, submitted, put into production
 * by a material issue, invoiced and shipped. Returns the DISPATCHED request.
 */
export async function dispatchedSr(api, options) {
  const sr = await raiseSr(api, options);
  await submitSr(api, sr);
  await issueFabric(api, sr.id);
  const dispatch = await createDispatch(api, [sr.id]);
  await issueCommercialInvoice(api, dispatch);
  const fresh = await getSr(api, sr.id);
  ok(await api.post(`/sample-dispatches/${dispatch.id}/mark-dispatched`, { version: dispatch.version }), 'mark dispatched');
  return { sr: await getSr(api, fresh.id), dispatch };
}
