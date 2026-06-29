/**
 * GRN & QC Test Data Helpers
 *
 * Provides payload factories and PO lookup helpers for GRN/QC E2E tests.
 * Each test file has dedicated seeded POs (V116__seed_grn_qc_masters.sql):
 *
 *   E2E-FG-1/2  — fabric-grn-api tests (single + 3-line, 5000 qty each)
 *   E2E-AG-1/2  — accessories-grn-api tests
 *   E2E-FQ-1..5 — fabric-qc-api tests (1 per combo + validation)
 *   E2E-AQ-1..3 — accessories-qc-api tests
 *   E2E-WF-1..12 — workflow tests (1 per test)
 */

const ts = () => Date.now();

export const today = () => new Date().toISOString().split('T')[0];

// ─── PO Lookup ───────────────────────────────────────────────────────────────

/**
 * Find a PO by its PO number and enrich with receipt balances.
 * This is the PRIMARY way tests should get POs — each test uses a dedicated PO number.
 *
 * @param {ApiClient} api
 * @param {string} poNumber - exact PO number (e.g. 'E2E-FG-1')
 * @returns {object} PO with items[] enriched with balance info
 */
export async function findPOByNumber(api, poNumber) {
  // First try grn-eligible list
  const { data: eligible } = await api.get('/purchase-orders/grn-eligible');
  const list = Array.isArray(eligible) ? eligible : (eligible?.content || []);

  let po = list.find((p) => p.poNumber === poNumber);

  // If not in eligible list, search all POs (PO may have moved to Partially_Received/Completed)
  if (!po) {
    const { data: all } = await api.get('/purchase-orders/search', { page: 0, size: 200 });
    const allList = all?.content || [];
    po = allList.find((p) => p.poNumber === poNumber);
  }

  if (!po) {
    throw new Error(`PO '${poNumber}' not found. Restart backend for fresh H2 seed.`);
  }

  const { data: full } = await api.get(`/purchase-orders/${po.id}`);
  if (!full?.lineItems?.length) {
    throw new Error(`PO '${poNumber}' has no line items.`);
  }

  return enrichPOForTest(api, full, full.lineItems);
}

/**
 * Legacy finder — searches by category. Use findPOByNumber for new tests.
 */
export async function findOrCreateTestPO(api, category, minLineItems = 1) {
  const { data: eligible } = await api.get('/purchase-orders/grn-eligible');
  const list = Array.isArray(eligible) ? eligible : (eligible?.content || []);

  for (const po of list) {
    const { data: full } = await api.get(`/purchase-orders/${po.id}`);
    if (!full?.lineItems) continue;

    const matching = full.lineItems.filter(
      (li) => (li.categoryName || '').toLowerCase() === category.toLowerCase(),
    );
    if (matching.length >= minLineItems) {
      const enriched = await enrichPOForTest(api, full, matching);
      const withBalance = enriched.items.filter((i) => i.pendingQty > 0);
      if (withBalance.length >= minLineItems) return enriched;
    }
  }

  throw new Error(
    `No PO found with ${minLineItems}+ ${category} line(s) with balance > 0. Restart backend.`,
  );
}

/** Refresh a PO's receipt balances (call after creating GRNs). */
export async function refreshPO(api, po) {
  const { data: receipts } = await api.get(`/grns/po/${po.id}/receipts`);
  const receiptMap = receipts || {};
  po.items = po.items.map((item) => {
    const received = Number(receiptMap[item.id] || 0);
    return { ...item, receivedQty: received, pendingQty: Math.max(0, item.orderedQty - received) };
  });
  return po;
}

async function enrichPOForTest(api, po, matchingLines) {
  // Get receipts to compute balances
  const { data: receipts } = await api.get(`/grns/po/${po.id}/receipts`);
  const receiptMap = receipts || {};

  const items = matchingLines.map((li) => {
    const ordered = Number(li.quantity || 0);
    const received = Number(receiptMap[li.id] || 0);
    return {
      id: li.id,
      itemId: li.itemId,
      itemCode: li.itemCode,
      itemName: li.itemName,
      description: li.description || li.itemName,
      variantId: li.variantId,
      categoryName: li.categoryName,
      orderedQty: ordered,
      receivedQty: received,
      pendingQty: Math.max(0, ordered - received),
      rate: Number(li.unitPrice || 0),
      uom: li.uomName || 'Mtr',
      color: li.variantAttributes?.color || '',
      size: li.variantAttributes?.size || '',
      width: li.variantAttributes?.width || null,
      gsm: li.variantAttributes?.gsm || null,
    };
  });

  return {
    ...po,
    poDate: po.poDate,
    deliveryDate: po.deliveryDate,
    items,
  };
}

// ─── Fabric GRN Payload Builders ─────────────────────────────────────────────

/**
 * Build a valid Fabric GRN payload.
 * @param {object} po - PO object from findOrCreateTestPO
 * @param {Array} selectedItems - subset of po.items to receive
 * @param {object} rollConfig - { [itemId]: [{ rollNumber, receivingQty, shadeLot }] }
 * @param {object} overrides - additional header fields
 */
export function fabricGrnPayload(po, selectedItems, rollConfig = {}, overrides = {}) {
  const lineItems = selectedItems.map((item) => {
    const rolls = rollConfig[item.id] || [{
      rollNumber: `R-${ts()}-${item.id}`,
      receivingQty: item.pendingQty,
      shadeLot: `SL-${ts() % 10000}`,
    }];

    return {
      poLineItemId: item.id,
      itemId: item.itemId,
      variantId: item.variantId,
      itemCode: item.itemCode,
      description: item.description,
      poQty: item.orderedQty,
      rate: item.rate,
      uom: item.uom,
      receivingQty: rolls.reduce((s, r) => s + Number(r.receivingQty || 0), 0),
      rolls: rolls.map((r) => ({
        poLineItemId: item.id,
        variantId: item.variantId ? String(item.variantId) : null,
        itemCode: item.itemCode,
        description: item.description,
        width: item.width,
        gsm: item.gsm,
        poQty: item.orderedQty,
        receivedQty: item.receivedQty,
        balance: item.pendingQty,
        rate: item.rate,
        uom: item.uom,
        rollNumber: r.rollNumber,
        receivingQty: r.receivingQty,
        shadeLot: r.shadeLot,
      })),
      cartons: [],
    };
  });

  return {
    grnType: 'Fabric',
    grnDate: today(),
    poId: po.id,
    challanNo: `CH-${ts()}`,
    invoiceDate: today(),
    deliveryChallanDate: today(),
    vehicleNumber: `TN-01-AB-${ts() % 10000}`,
    transporter: `E2E Transport ${ts()}`,
    remarks: `E2E Fabric GRN ${ts()}`,
    lineItems,
    ...overrides,
  };
}

// ─── Accessories/Trims GRN Payload Builders ──────────────────────────────────

/**
 * Build a valid Trims GRN payload.
 * @param {object} po - PO object
 * @param {Array} selectedItems - subset of po.items
 * @param {object} cartonConfig - { [itemId]: [{ cartonNumber, quantity }] }
 * @param {object} overrides
 */
export function trimsGrnPayload(po, selectedItems, cartonConfig = {}, overrides = {}) {
  const cartons = [];
  selectedItems.forEach((item) => {
    const carts = cartonConfig[item.id] || [{
      cartonNumber: `CTN-${ts()}-${item.id}`,
      quantity: item.pendingQty,
    }];
    carts.forEach((c) => {
      cartons.push({
        poLineItemId: item.id,
        itemCode: item.itemCode,
        itemDescription: item.description,
        color: item.color,
        size: item.size,
        cartonNumber: c.cartonNumber,
        quantity: c.quantity,
        uom: item.uom,
      });
    });
  });

  // receivingQty = sum of carton quantities for that item (must match for submit)
  const items = selectedItems.map((item) => {
    const itemCartons = cartons.filter((c) => c.poLineItemId === item.id);
    const cartonSum = itemCartons.reduce((s, c) => s + Number(c.quantity || 0), 0);
    return {
      poLineItemId: item.id,
      itemId: item.itemId,
      variantId: item.variantId,
      itemCode: item.itemCode,
      description: item.description,
      color: item.color,
      size: item.size,
      poQty: item.orderedQty,
      rate: item.rate,
      uom: item.uom,
      receivingQty: cartonSum,
    };
  });

  const lineItems = selectedItems.map((item) => {
    const itemCartons = cartons.filter((c) => c.poLineItemId === item.id);
    const cartonSum = itemCartons.reduce((s, c) => s + Number(c.quantity || 0), 0);
    return {
      poLineItemId: item.id,
      itemId: item.itemId,
      variantId: item.variantId,
      itemCode: item.itemCode,
      description: item.description,
      color: item.color,
      size: item.size,
      poQty: item.orderedQty,
      rate: item.rate,
      uom: item.uom,
      receivingQty: cartonSum,
      rolls: [],
      cartons: itemCartons,
    };
  });

  return {
    grnType: 'Trims',
    grnDate: today(),
    poId: po.id,
    challanNo: `CH-${ts()}`,
    invoiceDate: today(),
    deliveryChallanDate: today(),
    vehicleNumber: `TN-01-CD-${ts() % 10000}`,
    transporter: `E2E Transport ${ts()}`,
    remarks: `E2E Trims GRN ${ts()}`,
    lineItems,
    items,
    cartons,
    ...overrides,
  };
}

// ─── Fabric QC Payload Builder ───────────────────────────────────────────────

/**
 * Build a Fabric QC payload from a submitted GRN.
 * @param {object} grn - GRN response (must have lineItems with rolls)
 * @param {number} poLineItemId - which PO line item to inspect
 * @param {object} options - { rollOverrides, defects, inspector }
 */
export function fabricQcPayload(grn, poLineItemId, options = {}) {
  const lineItem = (grn.lineItems || []).find((li) => li.poLineItemId === poLineItemId) || grn.lineItems?.[0];
  const grnRolls = lineItem?.rolls || [];

  const rolls = grnRolls.map((r, i) => ({
    rollNumber: r.rollNumber,
    description: r.description || r.itemCode,
    qty: r.receivingQty,
    uom: r.uom || 'Mtr',
    width: r.width || 44,   // standard width
    gsm: r.gsm || 180,      // standard GSM
    actualWidth: options.rollOverrides?.[i]?.actualWidth ?? (r.width || 44),
    actualGsm: options.rollOverrides?.[i]?.actualGsm ?? (r.gsm || 180),
  }));

  const defects = options.defects || [];

  // Compute results
  const TOLERANCE = 5;
  const DEFECT_THRESHOLD = 3;
  let rollsPassed = 0;
  let rollsFailed = 0;

  rolls.forEach((r) => {
    const widthOk = r.width ? Math.abs(r.actualWidth - r.width) <= r.width * (TOLERANCE / 100) : true;
    const gsmOk = r.gsm ? Math.abs(r.actualGsm - r.gsm) <= r.gsm * (TOLERANCE / 100) : true;
    const rollDefects = defects.filter((d) => d.rollNumber === r.rollNumber)
      .reduce((s, d) => s + (d.count || 0), 0);
    const defectsOk = rollDefects <= DEFECT_THRESHOLD;

    if (widthOk && gsmOk && defectsOk) rollsPassed++;
    else rollsFailed++;
  });

  return {
    qcType: 'Fabric',
    grnId: grn.id,
    poLineItemId,
    inspectionDate: today(),
    inspector: options.inspector || `E2E Inspector ${ts()}`,
    remarks: `E2E Fabric QC ${ts()}`,
    fabricDescription: lineItem?.description || 'Test Fabric',
    rollCount: rolls.length,
    parameters: [
      { key: 'gsm', label: 'GSM (Weight)', unit: 'g/m²', standard: 180, actual: 180, result: 'PASS' },
      { key: 'width', label: 'Width', unit: 'inches', standard: 44, actual: 44, result: 'PASS' },
      { key: 'shade_variation', label: 'Shade Variation', unit: 'Grade', standard: 4, actual: 4, result: 'PASS' },
      { key: 'shrinkage_length', label: 'Shrinkage (Length)', unit: '%', standard: 3, actual: 2.5, result: 'PASS' },
      { key: 'shrinkage_width', label: 'Shrinkage (Width)', unit: '%', standard: 3, actual: 2.5, result: 'PASS' },
      { key: 'color_fastness_wash', label: 'Color Fastness (Wash)', unit: 'Grade', standard: 4, actual: 4, result: 'PASS' },
      { key: 'color_fastness_rubbing', label: 'Color Fastness (Rubbing)', unit: 'Grade', standard: 4, actual: 4, result: 'PASS' },
      { key: 'pilling', label: 'Pilling Resistance', unit: 'Grade', standard: 4, actual: 4, result: 'PASS' },
      { key: 'tensile', label: 'Tensile Strength', unit: 'N', standard: 200, actual: 210, result: 'PASS' },
    ],
    rolls,
    defects,
    overallResult: rollsFailed === 0 ? 'PASS' : 'FAIL',
    rollsPassed,
    rollsFailed,
  };
}

// ─── Accessories/Trims QC Payload Builder ────────────────────────────────────

/**
 * Build a Trims QC payload from a submitted GRN.
 * @param {object} grn - GRN response
 * @param {number} poLineItemId
 * @param {Array} criteriaRows - [{ id, criteria, ok, notOk, remarks }]
 * @param {object} options
 */
export function trimsQcPayload(grn, poLineItemId, criteriaRows = [], options = {}) {
  const lineItem = (grn.lineItems || []).find((li) => li.poLineItemId === poLineItemId) || grn.lineItems?.[0];

  const allOk = criteriaRows.every((c) => c.ok && !c.notOk);

  return {
    qcType: 'Accessories',
    grnId: grn.id,
    poLineItemId,
    inspectionDate: today(),
    inspector: options.inspector || `E2E Inspector ${ts()}`,
    remarks: `E2E Trims QC ${ts()}`,
    qtyOrdered: lineItem?.poQty || 100,
    qtyReceived: lineItem?.receivingQty || lineItem?.poQty || 100,
    qtyChecked: options.qtyChecked || lineItem?.receivingQty || lineItem?.poQty || 100,
    criteriaRows,
    // Required on Accessories QC submit: MATCHED | SHORT (qty verdict vs received).
    qtyVerdict: options.qtyVerdict || 'MATCHED',
    overallResult: allOk ? 'PASS' : 'FAIL',
  };
}

// ─── Convenience Helpers ─────────────────────────────────────────────────────

/** Submit a GRN and return the response. */
export async function submitGrn(api, payload) {
  const { data, status } = await api.post('/grns/submit', payload);
  if (!data?.id) throw new Error(`GRN submit failed: status=${status}, body=${JSON.stringify(data)}`);
  return data;
}

/** Save a GRN draft and return the response. */
export async function draftGrn(api, payload) {
  const { data, status } = await api.post('/grns/draft', payload);
  if (!data?.id) throw new Error(`GRN draft failed: status=${status}`);
  return data;
}

/** Submit a QC and return the response. */
export async function submitQc(api, payload) {
  const { data, status } = await api.post('/qc/submit', payload);
  if (!data?.id) throw new Error(`QC submit failed: status=${status}, body=${JSON.stringify(data)}`);
  return data;
}

/** Save a QC draft and return the response. */
export async function draftQc(api, payload) {
  const { data, status } = await api.post('/qc/draft', payload);
  if (!data?.id) throw new Error(`QC draft failed: status=${status}`);
  return data;
}

/** Approve a QC and return the response. */
export async function approveQc(api, qcId, reason = 'E2E auto-approve') {
  const { data, status } = await api.post(`/qc/${qcId}/approve`, { reason });
  if (!data?.id) throw new Error(`QC approve failed: status=${status}`);
  return data;
}

/** Get active defect types for Fabric QC. */
export async function getDefectTypes(api) {
  const { data } = await api.get('/defect-types', { active: true });
  return data?.content || data || [];
}

/** Get active trims QC criteria. */
export async function getTrimsQCCriteria(api) {
  const { data } = await api.get('/trims-qc-criteria', { active: true });
  return data?.content || data || [];
}

/** Verify PO status after GRN/QC operations. */
export async function getPOStatus(api, poId) {
  const { data } = await api.get(`/purchase-orders/${poId}`);
  return data?.status;
}

/** Get PO receipt totals per line item. */
export async function getPOReceipts(api, poId, excludeGrnId) {
  const params = excludeGrnId ? { excludeGrnId } : {};
  const { data } = await api.get(`/grns/po/${poId}/receipts`, params);
  return data || {};
}
