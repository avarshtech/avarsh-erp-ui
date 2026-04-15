/**
 * Inventory Module Service.
 *
 * GRN and QC sections are wired to the real Spring Boot API in `erp-purchase`.
 * Stock, Issue, Adjustment, Dashboard, and item-variant lookup remain on mocks
 * until those modules land. Defect Type and Trims QC Criteria masters delegate
 * to their dedicated services (`defectTypeService`, `trimsQCCriteriaService`).
 */
import axiosInstance from '../core/axiosInstance';
import {
  MOCK_FABRIC_STOCK, MOCK_ACCESSORIES_STOCK, MOCK_FABRIC_ISSUES, MOCK_ACCESSORIES_ISSUES,
  MOCK_ADJUSTMENTS, MOCK_PRODUCTION_ORDERS, MOCK_DASHBOARD_STATS,
  MOCK_ITEM_VARIANTS, MOCK_PURCHASE_ORDERS_FOR_GRN,
  MOCK_FABRIC_GRNS, MOCK_ACCESSORIES_GRNS, MOCK_FABRIC_QC, MOCK_TRIMS_QC,
} from './inventoryMockData';
import { getActiveDefectTypes as fetchActiveDefectTypes } from '../master/defectTypeService';
import { getActiveTrimsQCCriteria as fetchActiveTrimsQCCriteria } from '../master/trimsQCCriteriaService';

// Dev-only flag — when true, PO / GRN / QC reads are served from local mock data.
// GRN + QC screens are now wired to the real API; leave false unless you need to
// demo without a running backend. Write operations (save / submit / approve)
// always hit the real API regardless of this flag.
export const USE_MOCK_INVENTORY_DATA = false;

const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms));

// ─── Endpoints ─────────────────────────────────────────────────────────────────
const GRN_ENDPOINT = '/grns';
const QC_ENDPOINT  = '/qc';

// ─── Adapters: real API → legacy UI shape ─────────────────────────────────────

/**
 * Reshape a PurchaseOrderDTO from /api/v1/purchase-orders into the legacy shape
 * the GRN form components were built around (items[] with orderedQty/pendingQty).
 */
const adaptPO = (po) => {
  if (!po) return null;
  const ref = (po.orderReferences && po.orderReferences[0]) || {};
  return {
    ...po,
    supplier: po.supplierName || po.supplier,
    buyerName: ref.buyerName || po.buyerName || '',
    styleNumber: ref.styleNumber || po.styleNumber || '',
    createdDate: po.poDate,
    expectedDeliveryDate: po.deliveryDate,
    items: (po.lineItems || []).map((li) => ({
      id: li.id,
      itemId: li.itemId,
      itemCode: li.itemCode,
      itemName: li.itemName,
      description: li.description || li.itemName,
      variantId: li.variantId,
      orderedQty: Number(li.quantity || 0),
      receivedQty: 0, // populated by enrichPOWithReceipts
      pendingQty: Number(li.quantity || 0),
      fullyReceived: false,
      rate: Number(li.unitPrice || 0),
      uom: li.uomName || '',
      color: li.variantAttributes?.color || '',
      size: li.variantAttributes?.size || '',
      categoryName: li.categoryName || '',
    })),
  };
};

/**
 * Reshape a GRNResponse from /api/v1/grns into the legacy UI shape.
 * The backend uses `Trims` internally; the UI surfaces it as `Accessories`.
 */
const adaptGRN = (grn) => {
  if (!grn) return null;
  return {
    ...grn,
    type: (grn.type === 'Trims' || grn.grnType === 'Trims') ? 'Accessories' : 'Fabric',
  };
};

/**
 * Reshape a QCResponse from /api/v1/qc into the legacy UI shape.
 */
const adaptQC = (qc) => {
  if (!qc) return null;
  return {
    ...qc,
    type: qc.qcType === 'Fabric' ? 'Fabric' : 'Accessories',
  };
};

// ─── GRN list / get ────────────────────────────────────────────────────────────

const filterMockGRNs = (params = {}) => {
  const pool = params.type === 'Accessories' ? MOCK_ACCESSORIES_GRNS
             : params.type === 'Fabric' ? MOCK_FABRIC_GRNS
             : [...MOCK_FABRIC_GRNS, ...MOCK_ACCESSORIES_GRNS];
  let list = pool;
  if (params.status) list = list.filter((g) => g.status === params.status);
  if (params.search) {
    const q = params.search.toLowerCase();
    list = list.filter((g) =>
      (g.grnNumber || '').toLowerCase().includes(q) ||
      (g.poNumber || '').toLowerCase().includes(q) ||
      (g.supplier || '').toLowerCase().includes(q),
    );
  }
  if (params.dateStart) list = list.filter((g) => (g.grnDate || '') >= params.dateStart);
  if (params.dateEnd)   list = list.filter((g) => (g.grnDate || '') <= params.dateEnd);
  return list;
};

export const getGRNList = async (params = {}) => {
  if (USE_MOCK_INVENTORY_DATA) {
    await delay();
    const content = filterMockGRNs(params).map(adaptGRN);
    return { content, totalElements: content.length, stats: null };
  }
  const apiParams = {
    page: params.page ?? 0,
    size: params.size ?? 100,
    sort: 'id',
    direction: 'desc',
  };
  if (params.type) apiParams.type = params.type === 'Accessories' ? 'Trims' : params.type;
  if (params.status) apiParams.status = params.status;
  if (params.search) apiParams.search = params.search;
  if (params.dateStart) apiParams.dateStart = params.dateStart;
  if (params.dateEnd) apiParams.dateEnd = params.dateEnd;

  const response = await axiosInstance.get(GRN_ENDPOINT, { params: apiParams });
  const data = response.data ?? response;
  const content = (data.content || []).map(adaptGRN);
  return {
    content,
    totalElements: data.totalElements ?? content.length,
    stats: data.stats || null,
  };
};

const fetchGrnById = async (id) => {
  if (USE_MOCK_INVENTORY_DATA) {
    await delay(50);
    const numeric = Number(id);
    const found = [...MOCK_FABRIC_GRNS, ...MOCK_ACCESSORIES_GRNS].find((g) => g.id === numeric);
    return adaptGRN(found || null);
  }
  const response = await axiosInstance.get(`${GRN_ENDPOINT}/${id}`);
  return adaptGRN(response.data ?? response);
};

export const getFabricGRN = (id) => fetchGrnById(id);
export const getAccessoriesGRN = (id) => fetchGrnById(id);

export const getPurchaseOrdersForGRN = async () => {
  if (USE_MOCK_INVENTORY_DATA) {
    await delay();
    // Mock POs are already in the legacy UI shape — bypass adaptPO.
    return MOCK_PURCHASE_ORDERS_FOR_GRN;
  }
  const response = await axiosInstance.get('/purchase-orders/grn-eligible');
  const list = response.data ?? response;
  return (list || []).map(adaptPO);
};

export const getPurchaseOrderByIdAnyStatus = async (poId) => {
  if (!poId) return null;
  if (USE_MOCK_INVENTORY_DATA) {
    await delay();
    return MOCK_PURCHASE_ORDERS_FOR_GRN.find((p) => p.id === poId) || null;
  }
  const response = await axiosInstance.get(`/purchase-orders/${poId}`);
  return adaptPO(response.data ?? response);
};

/**
 * Per-line-item already-received totals across every non-Reversed GRN against
 * this PO. Server-side aggregate — mock walk is dead.
 */
export const computePOLineItemReceipts = async (poId, excludeGrnId = null) => {
  if (!poId) return {};
  if (USE_MOCK_INVENTORY_DATA) {
    // Derive receipts from any existing mock GRNs tied to this PO (excluding current).
    await delay(50);
    const grns = [...MOCK_FABRIC_GRNS, ...MOCK_ACCESSORIES_GRNS].filter(
      (g) => g.poId === poId && g.id !== excludeGrnId && g.status !== 'Reversed',
    );
    const out = {};
    grns.forEach((g) => {
      (g.lineItems || []).forEach((li) => {
        const lineId = li.poLineItemId;
        const qty = (li.rolls || []).reduce((s, r) => s + (Number(r.receivingQty) || 0), 0)
                  + Number(li.receivingQty || 0);
        if (lineId != null) out[lineId] = (out[lineId] || 0) + qty;
      });
    });
    return out;
  }
  const params = excludeGrnId ? { excludeGrnId } : {};
  const response = await axiosInstance.get(`${GRN_ENDPOINT}/po/${poId}/receipts`, { params });
  const data = response.data ?? response;
  const out = {};
  Object.entries(data || {}).forEach(([k, v]) => { out[k] = Number(v); });
  return out;
};

export const enrichPOWithReceipts = async (po, excludeGrnId = null) => {
  if (!po) return po;
  const receipts = await computePOLineItemReceipts(po.id, excludeGrnId);
  const items = (po.items || []).map((li) => {
    const already = Number(receipts[li.id] || 0);
    const ordered = Number(li.orderedQty || 0);
    const pending = Math.max(0, ordered - already);
    return { ...li, receivedQty: already, pendingQty: pending, fullyReceived: pending <= 0 };
  });
  return { ...po, items };
};

// Cross-GRN duplicate checks run server-side now. Kept as a no-op for any legacy caller.
export const getAllGRNsForValidation = async () => {
  if (import.meta.env.DEV) {
    console.warn('[inventoryService] getAllGRNsForValidation() is deprecated — server enforces cross-GRN validation.');
  }
  return [];
};

// Variant lookup — still mock until item master variant API lands.
export const getItemVariant = async (variantId) => { await delay(50); return MOCK_ITEM_VARIANTS[variantId] || null; };
export const getItemVariantsBulk = (variantIds = []) => variantIds.map((id) => MOCK_ITEM_VARIANTS[id] || null);

// ─── GRN write operations ────────────────────────────────────────────────────

/**
 * Translate the UI's payload shape to the API's GRNRequest shape.
 */
const buildGrnRequest = (data, grnType) => {
  const lineItemSpecs = (data.lineItems || []).map((li) => {
    if (typeof li === 'number') return { poLineItemId: li };
    return { ...li, poLineItemId: li.poLineItemId || li.id };
  });

  const lineItems = lineItemSpecs.map((li) => {
    const rolls = (li.rolls || []).map((r) => ({
      id: r.id,
      poLineItemId: li.poLineItemId,
      variantId: r.variantId != null ? String(r.variantId) : null,
      itemCode: r.itemCode,
      description: r.description,
      width: r.width !== '—' && r.width != null ? Number(r.width) : null,
      gsm: r.gsm !== '—' && r.gsm != null ? Number(r.gsm) : null,
      poQty: r.poQty,
      receivedQty: r.receivedQty,
      balance: r.balance,
      rate: r.rate,
      uom: r.uom,
      rollNumber: r.rollNumber,
      receivingQty: r.receivingQty,
      shadeLot: r.shadeLot,
    }));
    const lineCartons = (data.cartons || []).filter((c) => c.poLineItemId === li.poLineItemId);
    const trimsItem = (data.items || []).find((it) => it.poLineItemId === li.poLineItemId) || {};
    const cartons = lineCartons.map((c) => ({
      id: c.id,
      poLineItemId: li.poLineItemId,
      itemCode: c.itemCode || li.itemCode || trimsItem.itemCode,
      itemDescription: c.itemDescription || li.description || trimsItem.description,
      color: c.color,
      size: c.size,
      cartonNumber: c.cartonNumber,
      quantity: c.quantity,
      uom: c.uom,
    }));
    return {
      id: li.id,
      poLineItemId: li.poLineItemId,
      itemId: li.itemId || trimsItem.itemId,
      variantId: li.variantId || trimsItem.variantId,
      itemCode: li.itemCode || trimsItem.itemCode,
      description: li.description || trimsItem.description,
      color: li.color || trimsItem.color,
      size: li.size || trimsItem.size,
      poQty: li.poQty || trimsItem.poQty,
      rate: li.rate || trimsItem.rate,
      uom: li.uom || trimsItem.uom,
      receivingQty: trimsItem.receivingQty,
      rolls,
      cartons,
    };
  });

  return {
    id: data.id,
    version: data.version,
    grnType,
    grnDate: data.grnDate,
    poId: data.poId,
    challanNo: data.challanNo,
    invoiceDate: data.invoiceDate,
    deliveryChallanDate: data.deliveryChallanDate,
    vehicleNumber: data.vehicleNumber,
    transporter: data.transporter,
    remarks: data.remarks,
    lineItems,
  };
};

const saveGrnDraft = async (data, grnType) => {
  const response = await axiosInstance.post(`${GRN_ENDPOINT}/draft`, buildGrnRequest(data, grnType));
  return adaptGRN(response.data ?? response);
};

const submitGrn = async (data, grnType) => {
  const response = await axiosInstance.post(`${GRN_ENDPOINT}/submit`, buildGrnRequest(data, grnType));
  return adaptGRN(response.data ?? response);
};

export const saveFabricGRNDraft = (data) => saveGrnDraft(data, 'Fabric');
export const submitFabricGRN = (data) => submitGrn(data, 'Fabric');
export const saveTrimsGRNDraft = (data) => saveGrnDraft(data, 'Trims');
export const submitTrimsGRN = (data) => submitGrn(data, 'Trims');

export const deleteDraftGRN = async (grnId /* , type */) => {
  await axiosInstance.delete(`${GRN_ENDPOINT}/${grnId}`);
  return true;
};

// PO ↔ GRN status interlock runs server-side inside GRNService.
export const updatePOStatusFromGRN = async () => { /* no-op — server owns it */ };

// ─── Reversal workflow ─────────────────────────────────────────────────────────
// Creator requests reversal → manager approves or rejects.
//   QC_Pending       → (Request) → Pending_Reversal
//   Pending_Reversal → (Approve) → Reversed (editable)
//   Pending_Reversal → (Reject)  → QC_Pending

export const requestGRNReversal = async (grnId, _type, reason, version) => {
  const response = await axiosInstance.post(`${GRN_ENDPOINT}/${grnId}/reversal/request`, { reason, version });
  return adaptGRN(response.data ?? response);
};

export const approveGRNReversal = async (grnId, _type, reason, version) => {
  const response = await axiosInstance.post(`${GRN_ENDPOINT}/${grnId}/reversal/approve`, { reason, version });
  return adaptGRN(response.data ?? response);
};

export const rejectGRNReversal = async (grnId, _type, reason, version) => {
  const response = await axiosInstance.post(`${GRN_ENDPOINT}/${grnId}/reversal/reject`, { reason, version });
  return adaptGRN(response.data ?? response);
};

// ─── QC approval → GRN close interlock ────────────────────────────────────────
// Called from QCApprovalActions after a QC is approved. Once the QC API's
// approve endpoint takes over the interlock server-side, this shim can be
// removed from the call sites (the backend will close the GRN automatically).
export const closeGRNOnQCApproval = async (grnId) => {
  if (!grnId) return null;
  const response = await axiosInstance.post(`${GRN_ENDPOINT}/${grnId}/close-on-qc-approval`);
  return adaptGRN(response.data ?? response);
};

// ─── QC list / get ─────────────────────────────────────────────────────────────

const filterMockQC = (type, params = {}) => {
  const pool = type === 'Accessories' ? MOCK_TRIMS_QC : MOCK_FABRIC_QC;
  let list = pool;
  if (params.status) list = list.filter((q) => q.status === params.status);
  if (params.search) {
    const s = params.search.toLowerCase();
    list = list.filter((q) =>
      (q.qcNumber || '').toLowerCase().includes(s) ||
      (q.grnNumber || '').toLowerCase().includes(s),
    );
  }
  if (params.dateStart) list = list.filter((q) => (q.inspectionDate || '') >= params.dateStart);
  if (params.dateEnd)   list = list.filter((q) => (q.inspectionDate || '') <= params.dateEnd);
  return list;
};

const fetchQCList = async (type, params = {}) => {
  if (USE_MOCK_INVENTORY_DATA) {
    await delay();
    const content = filterMockQC(type, params).map(adaptQC);
    return { content, totalElements: content.length, stats: null };
  }
  const apiParams = {
    page: params.page ?? 0,
    size: params.size ?? 100,
    sort: 'id',
    direction: 'desc',
    type,
  };
  if (params.status) apiParams.status = params.status;
  if (params.search) apiParams.search = params.search;
  if (params.dateStart) apiParams.dateStart = params.dateStart;
  if (params.dateEnd) apiParams.dateEnd = params.dateEnd;

  const response = await axiosInstance.get(QC_ENDPOINT, { params: apiParams });
  const data = response.data ?? response;
  const content = (data.content || []).map(adaptQC);
  return {
    content,
    totalElements: data.totalElements ?? content.length,
    stats: data.stats || null,
  };
};

export const getFabricQCList = (params = {}) => fetchQCList('Fabric', params);
export const getTrimsQCList = (params = {}) => fetchQCList('Accessories', params);

const fetchQCById = async (id) => {
  if (USE_MOCK_INVENTORY_DATA) {
    await delay(50);
    const numeric = Number(id);
    const found = [...MOCK_FABRIC_QC, ...MOCK_TRIMS_QC].find((q) => q.id === numeric);
    return adaptQC(found || null);
  }
  const response = await axiosInstance.get(`${QC_ENDPOINT}/${id}`);
  return adaptQC(response.data ?? response);
};

export const getFabricQCById = (id) => fetchQCById(id);
export const getTrimsQCById = (id) => fetchQCById(id);

/**
 * Load GRNs in QC_Pending status — the only state in which a QC inspection can
 * be created against a GRN.
 */
export const getSubmittedGRNsForQC = async (type) => {
  if (USE_MOCK_INVENTORY_DATA) {
    await delay();
    const pool = type === 'Accessories' ? MOCK_ACCESSORIES_GRNS : MOCK_FABRIC_GRNS;
    return pool.filter((g) => g.status === 'QC_Pending').map(adaptGRN);
  }
  const apiType = type === 'Accessories' ? 'Trims' : type;
  const response = await axiosInstance.get(GRN_ENDPOINT, {
    params: { type: apiType, status: 'QC_Pending', size: 200 },
  });
  const data = response.data ?? response;
  return (data.content || []).map(adaptGRN);
};

// ─── QC write operations ───────────────────────────────────────────────────────

/**
 * Translate the UI's QC payload into the API's QCRequest shape.
 */
const buildQCRequest = (data, qcType) => ({
  id: data.id,
  version: data.version,
  qcType,
  grnId: data.grnId,
  poLineItemId: data.poLineItemId,
  inspectionDate: data.inspectionDate,
  inspector: data.inspector,
  remarks: data.remarks,
  // Fabric
  fabricDescription: data.fabricDescription,
  rollCount: data.rollCount,
  parameters: data.parameters || [],
  rolls: data.rolls || [],
  defects: data.defects || [],
  // Accessories
  qtyOrdered: data.qtyOrdered,
  qtyReceived: data.qtyReceived,
  qtyChecked: data.qtyChecked,
  criteriaRows: data.criteriaRows || [],
  qtyVerdict: data.qtyVerdict || null,
  // Result
  overallResult: data.overallResult,
  rollsPassed: data.rollsPassed,
  rollsFailed: data.rollsFailed,
});

const saveQcDraft = async (data, qcType) => {
  const response = await axiosInstance.post(`${QC_ENDPOINT}/draft`, buildQCRequest(data, qcType));
  return adaptQC(response.data ?? response);
};

const submitQc = async (data, qcType) => {
  const response = await axiosInstance.post(`${QC_ENDPOINT}/submit`, buildQCRequest(data, qcType));
  return adaptQC(response.data ?? response);
};

export const saveFabricQCDraft = (data) => saveQcDraft(data, 'Fabric');
export const submitFabricQC = (data) => submitQc(data, 'Fabric');
export const saveTrimsQCDraft = (data) => saveQcDraft(data, 'Accessories');
export const submitTrimsQC = (data) => submitQc(data, 'Accessories');

const postQcAction = async (qcId, action, reason, version, extras = {}) => {
  const response = await axiosInstance.post(`${QC_ENDPOINT}/${qcId}/${action}`, { reason, version, ...extras });
  return adaptQC(response.data ?? response);
};

// Approve / Reject — unified for both QC types (server dispatches on qcType).
// `options.conditionalPass` on approve → server moves the QC to Conditional_Pass.
export const approveFabricQC = (id, reason, options = {}) =>
  postQcAction(id, 'approve', reason, undefined, { conditionalPass: !!options.conditionalPass });
export const rejectFabricQC  = (id, reason) => postQcAction(id, 'reject', reason);
export const approveTrimsQC  = (id, reason, options = {}) =>
  postQcAction(id, 'approve', reason, undefined, { conditionalPass: !!options.conditionalPass });
export const rejectTrimsQC   = (id, reason) => postQcAction(id, 'reject', reason);

// Refer-back workflow — symmetric for Fabric and Accessories.
export const requestFabricQCReferBack = (id, reason) => postQcAction(id, 'refer-back/request', reason);
export const approveFabricQCReferBack = (id)         => postQcAction(id, 'refer-back/approve');
export const rejectFabricQCReferBack  = (id)         => postQcAction(id, 'refer-back/reject');
export const requestTrimsQCReferBack  = (id, reason) => postQcAction(id, 'refer-back/request', reason);
export const approveTrimsQCReferBack  = (id)         => postQcAction(id, 'refer-back/approve');
export const rejectTrimsQCReferBack   = (id)         => postQcAction(id, 'refer-back/reject');

// Delete draft QC
export const deleteFabricQCDraft = async (id) => {
  await axiosInstance.delete(`${QC_ENDPOINT}/${id}`);
  return true;
};
export const deleteTrimsQCDraft = async (id) => {
  await axiosInstance.delete(`${QC_ENDPOINT}/${id}`);
  return true;
};

// ─── Defect Type & Trims Criteria masters (real API delegates) ────────────────
export const getActiveDefectTypes     = () => fetchActiveDefectTypes();
export const getActiveTrimsQCCriteria = () => fetchActiveTrimsQCCriteria();

// ─── STOCK (mock) ──────────────────────────────────────────────────────────────
export const getFabricStock = async (params = {}) => {
  await delay();
  let filtered = [...MOCK_FABRIC_STOCK];
  if (params.status) filtered = filtered.filter((s) => s.status === params.status);
  if (params.shadeLot) filtered = filtered.filter((s) => s.shadeLot === params.shadeLot);
  if (params.search) {
    const q = params.search.toLowerCase();
    filtered = filtered.filter((s) => s.rollNumber.toLowerCase().includes(q) || s.fabricDescription.toLowerCase().includes(q));
  }
  return { content: filtered, totalElements: filtered.length };
};

export const getAccessoriesStock = async (params = {}) => {
  await delay();
  let filtered = [...MOCK_ACCESSORIES_STOCK];
  if (params.category) filtered = filtered.filter((s) => s.category === params.category);
  if (params.search) {
    const q = params.search.toLowerCase();
    filtered = filtered.filter((s) => s.itemCode.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
  }
  return { content: filtered, totalElements: filtered.length };
};

// ─── ISSUE (mock) ──────────────────────────────────────────────────────────────
export const getFabricIssueList = async () => { await delay(); return { content: MOCK_FABRIC_ISSUES, totalElements: MOCK_FABRIC_ISSUES.length }; };
export const getAccessoriesIssueList = async () => { await delay(); return { content: MOCK_ACCESSORIES_ISSUES, totalElements: MOCK_ACCESSORIES_ISSUES.length }; };
export const getProductionOrders = async () => { await delay(); return MOCK_PRODUCTION_ORDERS; };

// ─── ADJUSTMENT (mock) ─────────────────────────────────────────────────────────
export const getAdjustmentList = async () => { await delay(); return { content: MOCK_ADJUSTMENTS, totalElements: MOCK_ADJUSTMENTS.length }; };

// ─── DASHBOARD (mock) ──────────────────────────────────────────────────────────
export const getDashboardStats = async () => { await delay(); return MOCK_DASHBOARD_STATS; };
