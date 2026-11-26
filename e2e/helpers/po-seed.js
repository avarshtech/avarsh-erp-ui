/**
 * PO seed helpers for General (free-form) purchase orders.
 *
 * PO totals are CLIENT-computed and trusted by the backend (no server recompute,
 * like BOM). The frontend tax model (POForm buildPayload / totals useMemo):
 *   base = quantity * unitPrice
 *   IGST mode  (supplier.igstApplicable): igst=gst%, igstValue=base*gst/100, cgst/sgst/*=null
 *   SGST+CGST  (else):                    cgst=sgst=gst/2, c/sgstValue=base*gst/200, igst/*=null
 *   line.taxValue = total line GST = base*gst/100 ; line.totalAmount = base*(1+gst/100)
 *   header.subtotal = Σ base ; header.tax = Σ gst ; header.grandTotal = subtotal+tax
 * Status enum: Draft | Pending_Approval | Sent_To_Supplier | Rejected |
 *              Referred_Back | Cancelled | Partially_Received | Completed.
 *
 * Every Supplier PO, General included, must name at least one existing order that is not
 * cancelled (PoOrderRefs#requireNamedOrders); without one the API answers 400 "A purchase
 * order must name the order(s) it is for". loadPoRefs therefore carries orderReferences,
 * and buildGeneralPo refuses to build a payload without them.
 */

import { formField } from './ui-master.js';

const r2 = (n) => parseFloat(Number(n).toFixed(2));
const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The seeded order a General PO names: ORD/0001 (H&M, DRAFT, e2e seed V111). Not ORD/0002 or
 * ORD/0003 on purpose: po-order-mapping asserts ORD/0002 carries no dispatch delay, and the
 * job-work / production-po specs count what is raised on ORD/0003.
 */
export const E2E_PO_ORDER_NO = 'ORD/0001';

/** An /orders/search row as a PO order reference: the shape the PO form saves for a General PO. */
export const poOrderReference = (order) => ({
  orderId: order.id,
  orderNo: order.orderNo,
  styleId: order.styleId ?? null,
  styleName: order.styleNo || order.garmentName || null,
  season: order.season || null,
  bomId: null,
});

/** The order seeded General POs name: E2E_PO_ORDER_NO, else the newest order that is not cancelled. */
export async function loadPoOrder(api) {
  const rows = async (params) => ((await api.get('/orders/search', params)).data?.content || [])
    .filter((o) => o.status !== 'CANCELLED');
  const order = (await rows({ search: E2E_PO_ORDER_NO, page: 0, size: 10 })).find((o) => o.orderNo === E2E_PO_ORDER_NO)
    || (await rows({ page: 0, size: 20, sort: 'id', direction: 'desc' }))[0];
  if (!order) throw new Error('loadPoOrder: no order that is not cancelled; a General PO must name one');
  return order;
}

/**
 * Pick an order in the General PO form's required "Order(s)" multi-select. Its options read
 * "orderNo · styleName · buyer" and come from a debounced server search, so type the number,
 * click the option that starts with it, and wait for the tag.
 */
export async function pickGeneralPoOrder(page, orderNo = E2E_PO_ORDER_NO) {
  const field = formField(page, 'Order(s)');
  await field.locator('.ant-select').first().click();
  await page.keyboard.type(orderNo, { delay: 30 });
  await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
    .filter({ hasText: new RegExp(`^\\s*${escapeRe(orderNo)}( ·|\\s*$)`) })
    .first()
    .click({ timeout: 15000 });
  await page.keyboard.press('Escape');
  await field.locator('.ant-select-selection-item').filter({ hasText: orderNo }).first()
    .waitFor({ state: 'visible', timeout: 5000 });
}

/** Find a non-IGST supplier and a free-form item + a terms record. */
export async function loadPoRefs(api) {
  const suppliers = (await api.get('/suppliers')).data;
  const sArr = suppliers.content || suppliers;
  const localSupplier = sArr.find((s) => !s.igstApplicable) || sArr[0];

  const itemsData = (await api.get('/items', { search: 'Cotton', size: 5 })).data;
  const items = itemsData.content || itemsData || [];
  const item = items[0];
  if (!item) throw new Error('loadPoRefs: no item found for "Cotton"');

  let tnc = [];
  try { tnc = (await api.get('/terms-conditions')).data || []; } catch { /* optional */ }
  const terms = (tnc.content || tnc)[0] || null;

  const order = await loadPoOrder(api);

  return {
    localSupplier,
    order,
    orderReferences: [poOrderReference(order)],
    // /items enriches each item with its ACTIVE variants, and an item always has at
    // least one. A PO line is raised against the variant, so carry the first one.
    item: { id: item.id, code: item.itemCode ?? item.code, name: item.name ?? item.itemName, uom: item.uomName, uomId: item.uomId ?? null, hsn: item.hsnCode ?? null, category: item.categoryName ?? null, variantId: (item.variants || [])[0]?.id ?? null },
    terms,
  };
}

/** Find an igstApplicable supplier, creating one (interstate) if none seeded. */
export async function ensureIgstSupplier(api) {
  const suppliers = (await api.get('/suppliers')).data;
  const sArr = suppliers.content || suppliers;
  const existing = sArr.find((s) => s.igstApplicable);
  if (existing) return existing;

  const stamp = Date.now().toString().slice(-6);
  const created = await api.post('/suppliers', {
    name: `E2E IGST Supplier ${stamp}`,
    email: `igst${stamp}@e2e.test`,
    phone: '+919000000000',
    contactPerson: 'E2E Tester',
    gstin: `27AAAAA${stamp}1Z5`,
    igstApplicable: true,
    address: 'Interstate Rd', city: 'Mumbai', state: 'Maharashtra', stateCode: '27',
    country: 'India', pincode: '400001', pan: `AAAAA${stamp}M`,
    suppliesFabric: true, suppliesTrims: true, active: true,
  });
  return created.data;
}

/** Compute the per-line tax fields exactly as POForm does. */
export function computeLine(item, qty, unitPrice, gst, isIgst) {
  const base = qty * unitPrice;
  const gstAmount = (base * gst) / 100;
  const half = gst / 2;
  const line = {
    itemId: item.id, itemCode: item.code, itemName: item.name,
    description: `${item.name} — E2E`, quantity: qty, uomId: item.uomId, uomName: item.uom,
    unitPrice, hsnCode: item.hsn, categoryName: item.category,
    variantId: item.variantId ?? null, variantAttributes: null, processingStages: null, bomLineSources: null,
    totalAmount: r2(base * (1 + gst / 100)),
    taxValue: r2(gstAmount),
  };
  if (isIgst) {
    Object.assign(line, { igst: gst, cgst: null, sgst: null, igstValue: r2(gstAmount), cgstValue: null, sgstValue: null });
  } else {
    Object.assign(line, { cgst: half, sgst: half, igst: null, cgstValue: r2(base * half / 100), sgstValue: r2(base * half / 100), igstValue: null });
  }
  return line;
}

/**
 * Build a General PO payload with N identical lines (default 1). `orderReferences` is required
 * (pass loadPoRefs' `orderReferences`, or the spec's own order); a test of the 400 clears it on
 * the built payload instead.
 */
export function buildGeneralPo(supplier, item, terms, { gst = 18, qty = 10, unitPrice = 100, status = 'Draft', lines = 1, orderReferences } = {}) {
  if (!orderReferences?.length) {
    throw new Error('buildGeneralPo: pass orderReferences (loadPoRefs().orderReferences); every PO must name an order');
  }
  const isIgst = !!supplier.igstApplicable;
  const lineItems = Array.from({ length: lines }, () => computeLine(item, qty, unitPrice, gst, isIgst));
  const subtotal = r2(lineItems.reduce((a, l) => a + l.quantity * l.unitPrice, 0));
  const tax = r2(lineItems.reduce((a, l) => a + l.taxValue, 0));
  const grandTotal = r2(subtotal + tax);
  return {
    poType: 'General', orderReferences,
    supplierId: supplier.id, supplierName: supplier.name,
    poDate: new Date().toISOString().split('T')[0],
    deliveryDate: new Date(Date.now() + 20 * 864e5).toISOString().split('T')[0],
    termsConditionsId: terms?.id ?? null, termsConditionsTitle: terms?.title ?? terms?.name ?? '',
    remarks: 'E2E PO', status,
    subtotal, tax,
    sgstValue: isIgst ? null : r2(lineItems.reduce((a, l) => a + (l.sgstValue || 0), 0)),
    cgstValue: isIgst ? null : r2(lineItems.reduce((a, l) => a + (l.cgstValue || 0), 0)),
    igstValue: isIgst ? r2(lineItems.reduce((a, l) => a + (l.igstValue || 0), 0)) : null,
    grandTotal,
    lineItems,
  };
}
