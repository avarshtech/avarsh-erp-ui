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
 */

const r2 = (n) => parseFloat(Number(n).toFixed(2));

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

  return {
    localSupplier,
    item: { id: item.id, code: item.itemCode ?? item.code, name: item.name ?? item.itemName, uom: item.uomName, uomId: item.uomId ?? null, hsn: item.hsnCode ?? null, category: item.categoryName ?? null },
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
    variantId: null, variantAttributes: null, processingStages: null, bomLineSources: null,
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

/** Build a General PO payload with N identical lines (default 1). */
export function buildGeneralPo(supplier, item, terms, { gst = 18, qty = 10, unitPrice = 100, status = 'Draft', lines = 1 } = {}) {
  const isIgst = !!supplier.igstApplicable;
  const lineItems = Array.from({ length: lines }, () => computeLine(item, qty, unitPrice, gst, isIgst));
  const subtotal = r2(lineItems.reduce((a, l) => a + l.quantity * l.unitPrice, 0));
  const tax = r2(lineItems.reduce((a, l) => a + l.taxValue, 0));
  const grandTotal = r2(subtotal + tax);
  return {
    poType: 'General', orderReferences: null,
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
