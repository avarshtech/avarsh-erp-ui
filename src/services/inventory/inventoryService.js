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
  MOCK_PURCHASE_ORDERS_FOR_GRN,
  MOCK_FABRIC_GRNS, MOCK_ACCESSORIES_GRNS, MOCK_FABRIC_QC, MOCK_TRIMS_QC,
  MOCK_APPROVED_CUTTING_POS, MOCK_APPROVED_WORK_ORDERS,
} from './inventoryMockData';
import { getVariantsByIds } from '../master/variantService';
import { getActiveDefectTypes as fetchActiveDefectTypes } from '../master/defectTypeService';
import { getActiveTrimsQCCriteria as fetchActiveTrimsQCCriteria } from '../master/trimsQCCriteriaService';
import { getItemMetaData } from '../master/itemService';

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
      variantName: li.variantName || '',
      variantCode: li.variantCode || '',
      orderedQty: Number(li.quantity || 0),
      receivedQty: 0, // populated by enrichPOWithReceipts
      pendingQty: Number(li.quantity || 0),
      fullyReceived: false,
      rate: Number(li.unitPrice || 0),
      // Symbol, not name: GRN/PO documents and the narrow UOM columns show "KG", and
      // screens that source a UOM from the variant already snapshot the symbol. Falling
      // back to the name keeps older POs readable rather than blank.
      uom: li.uomSymbol || li.uomName || '',
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
  const lineItems = grn.lineItems || [];
  // The API nests rolls and cartons under each line item and exposes no totalRolls /
  // totalAmount / items fields. The GRN screens were built around a flat shape — the view
  // modal reads grn.items/grn.cartons, the forms hydrate from grn.rolls/grn.cartons, and
  // the list columns read grn.totalRolls/grn.totalAmount. Without this flattening they all
  // silently render 0 and edit mode loads with no rolls at all.
  //
  // The server already stamps each roll and carton with its parent line's snapshot
  // (item code, description, rate, uom, variantCode, variantName), so the flattened rows
  // stand on their own.
  const rolls = lineItems.flatMap((li) => li.rolls || []);
  const cartons = lineItems.flatMap((li) => li.cartons || []);
  return {
    ...grn,
    type: (grn.type === 'Trims' || grn.grnType === 'Trims') ? 'Accessories' : 'Fabric',
    items: grn.items || lineItems,
    rolls: grn.rolls || rolls,
    cartons: grn.cartons || cartons,
    totalRolls: grn.totalRolls ?? rolls.length,
    totalAmount:
      grn.totalAmount ??
      lineItems.reduce((sum, li) => sum + Number(li.receivingQty || 0) * Number(li.rate || 0), 0),
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

// ─── GRN Allowance Exceed view ────────────────────────────────────────────────
// Returns GRNs on the given date whose line items received qty exceeds the PO
// balance by MORE than the master-data defaultAllowance%. Each returned GRN
// carries a non-empty offendingLines[] — compliant lines are stripped out.
// Why UI-side derivation: the existing list/detail endpoints already carry
// defaultAllowance + balance + receivingQty. A dedicated backend endpoint can
// replace this later if volumes grow; today the set is small (single-day).

const buildFabricOffendingLines = (grn) =>
  (grn.lineItems || []).map((li) => {
    const rolls = li.rolls || [];
    const sample = rolls[0] || {};
    const balance = Number(sample.balance);
    const receivedQty = rolls.reduce((s, r) => s + (Number(r.receivingQty) || 0), 0)
                      + Number(li.receivingQty || 0);
    const allowedPct = Number.isFinite(Number(sample.defaultAllowance)) ? Number(sample.defaultAllowance) : 0;
    if (!Number.isFinite(balance) || balance <= 0 || receivedQty <= balance) return null;
    const overPct = ((receivedQty - balance) / balance) * 100;
    if (!(overPct > allowedPct)) return null;
    return {
      lineKey: `F-${grn.id}-${li.poLineItemId}`,
      type: 'Fabric',
      itemCode: sample.itemCode || li.itemCode,
      description: sample.description || li.description,
      width: sample.width,
      gsm: sample.gsm,
      uom: sample.uom,
      rate: Number(sample.rate) || 0,
      balance,
      receivedQty,
      excessQty: receivedQty - balance,
      overPct,
      allowedPct,
      severity: allowedPct > 0 && overPct >= allowedPct * 2 ? 'high' : 'medium',
    };
  }).filter(Boolean);

const buildAccessoriesOffendingLines = (grn) =>
  (grn.items || []).map((it) => {
    const balance = Number(it.balance);
    const receivedQty = Number(it.receivingQty) || 0;
    const allowedPct = Number.isFinite(Number(it.defaultAllowance)) ? Number(it.defaultAllowance) : 0;
    if (!Number.isFinite(balance) || balance <= 0 || receivedQty <= balance) return null;
    const overPct = ((receivedQty - balance) / balance) * 100;
    if (!(overPct > allowedPct)) return null;
    return {
      lineKey: `A-${grn.id}-${it.poLineItemId}`,
      type: 'Accessories',
      itemCode: it.itemCode,
      description: it.description,
      color: it.color,
      size: it.size,
      uom: it.uom,
      rate: Number(it.rate) || 0,
      balance,
      receivedQty,
      excessQty: receivedQty - balance,
      overPct,
      allowedPct,
      severity: allowedPct > 0 && overPct >= allowedPct * 2 ? 'high' : 'medium',
    };
  }).filter(Boolean);

// Accessories GRNs carry a non-empty `items[]`. Fabric GRNs carry `lineItems[]`
// whose entries are objects with a `rolls[]` array. We use shape detection
// instead of `g.type` because the shared adaptGRN only maps 'Trims' → 'Accessories'
// and will mis-label any mock GRN whose source type is already 'Accessories' as
// 'Fabric'. Fixing the adapter risks the GRN list screen, so this is surgical.
const detectGRNCategory = (g) => {
  if (Array.isArray(g?.items) && g.items.length > 0) return 'Accessories';
  const hasRollLines = Array.isArray(g?.lineItems)
    && g.lineItems.some((li) => li && typeof li === 'object' && Array.isArray(li.rolls));
  if (hasRollLines) return 'Fabric';
  return g?.type === 'Accessories' ? 'Accessories' : 'Fabric';
};

export const getAllowanceExceedGRNs = async ({ dateStart, dateEnd } = {}) => {
  if (!dateStart || !dateEnd) return [];
  const { content } = await getGRNList({ dateStart, dateEnd });
  // If the list endpoint doesn't embed line items (live API), hydrate detail.
  const hydrated = await Promise.all(
    (content || []).map(async (g) => {
      const hasFabricLines = Array.isArray(g.lineItems)
        && g.lineItems.some((li) => li && typeof li === 'object' && Array.isArray(li.rolls));
      if (hasFabricLines || (Array.isArray(g.items) && g.items.length > 0)) return g;
      return fetchGrnById(g.id);
    }),
  );
  return hydrated
    .filter(Boolean)
    .map((g) => {
      const category = detectGRNCategory(g);
      const offendingLines = category === 'Fabric'
        ? buildFabricOffendingLines(g)
        : buildAccessoriesOffendingLines(g);
      return { ...g, type: category, offendingLines };
    })
    .filter((g) => g.offendingLines.length > 0);
};

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
      // Fabric GRN: lineItems[] carries roll objects with receivingQty.
      (g.lineItems || []).forEach((li) => {
        if (li == null || typeof li !== 'object') return;
        const lineId = li.poLineItemId;
        if (lineId == null) return;
        const qty = (li.rolls || []).reduce((s, r) => s + (Number(r.receivingQty) || 0), 0)
                  + Number(li.receivingQty || 0);
        out[lineId] = (out[lineId] || 0) + qty;
      });
      // Accessories GRN: items[] carries the per-line receivingQty directly.
      (g.items || []).forEach((it) => {
        const lineId = it?.poLineItemId;
        if (lineId == null) return;
        out[lineId] = (out[lineId] || 0) + Number(it.receivingQty || 0);
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

// ─── Variant lookup (real API) ───────────────────────────────────────────────
// Adapts ItemVariantDTO to the shape GRN/QC screens consume (attributes.width/gsm,
// primaryUom/secondaryUom, color/size, category).
const adaptVariant = (v) => {
  if (!v) return null;
  const attrs = v.attributes || {};
  const attrCI = (name) => {
    const key = Object.keys(attrs).find((k) => k.toLowerCase() === name);
    return key ? attrs[key] : undefined;
  };
  return {
    id: v.id,
    itemId: v.itemId,
    itemCode: v.itemCode,
    itemName: v.variantName || v.itemName,
    variantCode: v.variantCode,
    variantName: v.variantName,
    color: attrCI('color') ?? attrCI('colour') ?? '-',
    size: attrCI('size') ?? '-',
    primaryUom: v.uomSymbol || '',
    secondaryUom: v.secondaryUomSymbol || '',
    category: v.categoryName || '',
    attributes: attrs,
  };
};

export const getItemVariant = async (variantId) => {
  if (variantId == null) return null;
  try {
    const res = await getVariantsByIds([variantId]);
    const list = res?.data || res || [];
    return adaptVariant(list[0] || null);
  } catch {
    return null;
  }
};

/** Bulk variant lookup. Preserves positional order of the input ids (nulls for misses). */
export const getItemVariantsBulk = async (variantIds = []) => {
  const ids = (variantIds || []).filter((id) => id != null);
  if (ids.length === 0) return (variantIds || []).map(() => null);
  try {
    const res = await getVariantsByIds(ids);
    const list = res?.data || res || [];
    const byId = new Map(list.map((v) => [v.id, adaptVariant(v)]));
    return (variantIds || []).map((id) => byId.get(id) || null);
  } catch {
    return (variantIds || []).map(() => null);
  }
};

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
// `options.keepBackup`       on reject  → server moves the QC to Rejected_With_Backup.
export const approveFabricQC = (id, reason, options = {}) =>
  postQcAction(id, 'approve', reason, undefined, { conditionalPass: !!options.conditionalPass });
export const rejectFabricQC  = (id, reason, options = {}) =>
  postQcAction(id, 'reject', reason, undefined, { keepBackup: !!options.keepBackup });
export const approveTrimsQC  = (id, reason, options = {}) =>
  postQcAction(id, 'approve', reason, undefined, { conditionalPass: !!options.conditionalPass });
export const rejectTrimsQC   = (id, reason, options = {}) =>
  postQcAction(id, 'reject', reason, undefined, { keepBackup: !!options.keepBackup });

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

// ─── STOCK ─────────────────────────────────────────────────────────────────────
// Server endpoints (live when USE_MOCK_INVENTORY_DATA is false):
//   GET /api/v1/inventory/stock/fabric       — paginated, filters: subCategory, search
//   GET /api/v1/inventory/stock/accessories  — paginated, filters: category,    search
// Both return { content: items[], totalElements, totalPages, number, size, stats }
// pre-aggregated at the (itemCode × grnNumber) level with rolls / variants nested.
const STOCK_FABRIC_ENDPOINT      = '/inventory/stock/fabric';
const STOCK_ACCESSORIES_ENDPOINT = '/inventory/stock/accessories';

// Current financial year window (April 1 → March 31) used by mock stat scoping.
const currentFYWindow = () => {
  const t = new Date();
  const startYear = t.getMonth() >= 3 ? t.getFullYear() : t.getFullYear() - 1;
  return [new Date(startYear, 3, 1), new Date(startYear + 1, 2, 31)];
};

// Aggregate the flat mock roll list into item-level rows so the mock path
// surfaces the same shape as the server endpoint. Rolls are nested on each row.
const aggregateMockFabricRolls = (rolls) => {
  const map = new Map();
  for (const r of rolls) {
    const key = `${r.itemCode}|${r.grnNumber}`;
    const entry = map.get(key) || {
      id: key,
      itemCode: r.itemCode,
      fabricDescription: r.fabricDescription,
      subCategory: r.subCategory,
      style: r.style,
      orderRef: r.orderRef,
      supplier: r.supplier,
      grnNumber: r.grnNumber,
      grnDate: r.grnDate,
      uom: r.uom || 'kg',
      composition: r.composition,
      color: r.color,
      width: r.width,
      gsm: r.gsm,
      poLineValue: r.poLineValue,
      totalQty: 0,
      rolls: [],
      statuses: new Set(),
    };
    entry.totalQty += Number(r.weight || 0);
    entry.rolls.push({
      rollId: r.rollId,
      rollNumber: r.rollNumber,
      width: r.width,
      gsm: r.gsm,
      weight: r.weight,
      shadeLot: r.shadeLot,
      qcStatus: r.qcStatus,
    });
    if (r.status) entry.statuses.add(r.status);
    map.set(key, entry);
  }
  return Array.from(map.values()).map((e) => ({ ...e, statuses: Array.from(e.statuses) }));
};

// Build variant rows from sizeColorMatrix for the drawer.
const buildMockAccessoryVariants = (record) => {
  const matrix = record?.sizeColorMatrix;
  if (!matrix?.quantities) return [];
  return Object.entries(matrix.quantities).map(([key, qty], idx) => {
    const lastDash = key.lastIndexOf('-');
    const color = lastDash > 0 ? key.slice(0, lastDash) : key;
    const size  = lastDash > 0 ? key.slice(lastDash + 1) : '';
    return {
      variantId: idx,
      size,
      color,
      qty: Number(qty) || 0,
      uom: record.uom,
      unitCost: record.unitCost,
      lineValue: (Number(qty) || 0) * (Number(record.unitCost) || 0),
    };
  });
};

const computeFabricStats = (items) => {
  const [fyStart, fyEnd] = currentFYWindow();
  const inStockItems = items.filter((it) => {
    if (!it.grnDate) return false;
    const d = new Date(it.grnDate);
    if (d < fyStart || d > fyEnd) return false;
    return Array.isArray(it.statuses) ? it.statuses.includes('In_Stock') : true;
  });
  const subCategories = new Set(inStockItems.map((it) => it.subCategory).filter(Boolean));
  const subCategoryValue = inStockItems.reduce((sum, it) => sum + Number(it.poLineValue || 0), 0);
  return {
    totalItems: inStockItems.length,
    subCategoryCount: subCategories.size,
    subCategoryValue,
  };
};

const computeAccessoriesStats = (items) => {
  const totalQuantity = items.reduce((sum, r) => sum + Number(r.totalQty || 0), 0);
  const totalValue    = items.reduce((sum, r) => sum + Number(r.poLineValue || 0), 0);
  return { totalItems: items.length, totalQuantity, totalValue };
};

export const getFabricStock = async (params = {}) => {
  if (USE_MOCK_INVENTORY_DATA) {
    await delay();
    let filtered = [...MOCK_FABRIC_STOCK];
    if (params.subCategory) filtered = filtered.filter((s) => s.subCategory === params.subCategory);
    if (params.search) {
      const q = params.search.toLowerCase();
      filtered = filtered.filter((s) =>
        (s.itemCode || '').toLowerCase().includes(q)
        || (s.fabricDescription || '').toLowerCase().includes(q)
        || (s.grnNumber || '').toLowerCase().includes(q)
        || (s.rollNumber || '').toLowerCase().includes(q)
        || (s.style || '').toLowerCase().includes(q)
        || (s.supplier || '').toLowerCase().includes(q),
      );
    }
    const items = aggregateMockFabricRolls(filtered);
    return {
      content: items,
      totalElements: items.length,
      totalPages: 1,
      number: 0,
      size: items.length,
      stats: computeFabricStats(items),
    };
  }

  const apiParams = {
    page: params.page ?? 0,
    size: params.size ?? 25,
    sort: params.sort || 'itemCode',
    direction: params.direction || 'asc',
  };
  if (params.search) apiParams.search = params.search;
  if (params.subCategory) apiParams.subCategory = params.subCategory;

  const response = await axiosInstance.get(STOCK_FABRIC_ENDPOINT, { params: apiParams });
  const data = response.data ?? response;
  return {
    content: data.content || [],
    totalElements: data.totalElements ?? 0,
    totalPages: data.totalPages ?? 0,
    number: data.number ?? 0,
    size: data.size ?? apiParams.size,
    stats: data.stats || null,
  };
};

export const getAccessoriesStock = async (params = {}) => {
  if (USE_MOCK_INVENTORY_DATA) {
    await delay();
    let filtered = [...MOCK_ACCESSORIES_STOCK];
    if (params.category) filtered = filtered.filter((s) => s.category === params.category);
    if (params.search) {
      const q = params.search.toLowerCase();
      filtered = filtered.filter((s) =>
        (s.itemCode || '').toLowerCase().includes(q)
        || (s.description || '').toLowerCase().includes(q)
        || (s.grnNumber || '').toLowerCase().includes(q)
        || (s.style || '').toLowerCase().includes(q)
        || (s.supplier || '').toLowerCase().includes(q),
      );
    }
    // Normalise mock rows to the item-level response shape: add `variants`.
    const items = filtered.map((r) => ({ ...r, variants: buildMockAccessoryVariants(r) }));
    return {
      content: items,
      totalElements: items.length,
      totalPages: 1,
      number: 0,
      size: items.length,
      stats: computeAccessoriesStats(items),
    };
  }

  const apiParams = {
    page: params.page ?? 0,
    size: params.size ?? 25,
    sort: params.sort || 'itemCode',
    direction: params.direction || 'asc',
  };
  if (params.search) apiParams.search = params.search;
  if (params.category) apiParams.category = params.category;

  const response = await axiosInstance.get(STOCK_ACCESSORIES_ENDPOINT, { params: apiParams });
  const data = response.data ?? response;
  return {
    content: data.content || [],
    totalElements: data.totalElements ?? 0,
    totalPages: data.totalPages ?? 0,
    number: data.number ?? 0,
    size: data.size ?? apiParams.size,
    stats: data.stats || null,
  };
};

// ─── ISSUE (mock) ──────────────────────────────────────────────────────────────
export const getFabricIssueList = async () => { await delay(); return { content: MOCK_FABRIC_ISSUES, totalElements: MOCK_FABRIC_ISSUES.length }; };
export const getAccessoriesIssueList = async () => { await delay(); return { content: MOCK_ACCESSORIES_ISSUES, totalElements: MOCK_ACCESSORIES_ISSUES.length }; };
export const getFabricIssueById = async (id) => {
  await delay(50);
  return MOCK_FABRIC_ISSUES.find((i) => String(i.id) === String(id)) || null;
};
export const getAccessoriesIssueById = async (id) => {
  await delay(50);
  return MOCK_ACCESSORIES_ISSUES.find((i) => String(i.id) === String(id)) || null;
};
export const getProductionOrders = async () => { await delay(); return MOCK_PRODUCTION_ORDERS; };

// Cutting PO lookup for Fabric Material Issue. The mock already represents the
// server's filtered response: APPROVED status and not fully issued. When the
// Cutting PO module's API lands, this function will call the real endpoint and
// the server will enforce the filter.
export const getApprovedCuttingPOs = async () => {
  await delay();
  return { content: MOCK_APPROVED_CUTTING_POS, totalElements: MOCK_APPROVED_CUTTING_POS.length };
};

// Work Order lookup for Accessories Material Issue — same pattern.
export const getApprovedWorkOrders = async () => {
  await delay();
  return { content: MOCK_APPROVED_WORK_ORDERS, totalElements: MOCK_APPROVED_WORK_ORDERS.length };
};

// ─── ADJUSTMENT ───────────────────────────────────────────────────────────────
const ADJUSTMENT_ENDPOINT = '/stock-adjustments';

export const getAdjustmentList = async () => {
  if (USE_MOCK_INVENTORY_DATA) {
    await delay();
    return { content: MOCK_ADJUSTMENTS, totalElements: MOCK_ADJUSTMENTS.length };
  }
  const response = await axiosInstance.get(ADJUSTMENT_ENDPOINT);
  const data = response.data ?? response;
  return {
    content: data.content || data || [],
    totalElements: data.totalElements ?? (data.content?.length ?? (Array.isArray(data) ? data.length : 0)),
  };
};

// Nested metadata tree shaped like /items/meta so the filter card can
// cascade Cat → SubCat → ItemType the same way the ItemMaster dialog does.
const ADJUSTMENT_META_DATA = [
  {
    id: 1, name: 'Fabric',
    subCategories: [
      { id: 11, name: 'Knit', itemTypes: [{ id: 111, name: 'Jersey' }, { id: 112, name: 'Pique' }] },
      { id: 12, name: 'Woven', itemTypes: [{ id: 121, name: 'Satin' }, { id: 122, name: 'Twill' }] },
      { id: 13, name: 'Denim', itemTypes: [{ id: 131, name: 'Indigo Denim' }, { id: 132, name: 'Stretch Denim' }] },
      { id: 14, name: 'Lining', itemTypes: [{ id: 141, name: 'Linen Blend' }] },
    ],
  },
  {
    id: 2, name: 'Accessories',
    subCategories: [
      { id: 21, name: 'Buttons', itemTypes: [{ id: 211, name: '4-Hole Button' }] },
      { id: 22, name: 'Zippers', itemTypes: [{ id: 221, name: 'Invisible Zipper' }] },
      { id: 23, name: 'Labels', itemTypes: [{ id: 231, name: 'Woven Label' }, { id: 232, name: 'Printed Label' }] },
      { id: 24, name: 'Thread', itemTypes: [{ id: 241, name: 'Sewing Thread' }] },
      { id: 25, name: 'Interlining', itemTypes: [{ id: 251, name: 'Fusible Interlining' }] },
    ],
  },
];

export const getAdjustmentMetaData = async () => {
  if (USE_MOCK_INVENTORY_DATA) {
    await delay();
    return ADJUSTMENT_META_DATA;
  }
  // Reuse ItemMaster's metadata call — same endpoint, same auth path — so
  // whichever shape the backend returns, we handle it exactly like ItemMaster.
  const response = await getItemMetaData();
  console.log(response);
  if (Array.isArray(response)) return response;
  if (response?.data && Array.isArray(response.data)) return response.data;
  if (response?.content && Array.isArray(response.content)) return response.content;
  return [];
};

const resolveMeta = ({ categoryId, subCategoryId, itemTypeId }) => {
  const cat = ADJUSTMENT_META_DATA.find((c) => c.id === Number(categoryId));
  const sub = cat?.subCategories.find((s) => s.id === Number(subCategoryId));
  const type = sub?.itemTypes.find((t) => t.id === Number(itemTypeId));
  return { cat, sub, type };
};

// Aggregate stock rolls into variant rows for the adjustment count table.
// For fabric: one row per (itemCode + color + width) with availableRolls[] listing each roll.
// For accessories: one row per itemCode (no roll concept; rollNumber stays null).
export const getAdjustableVariants = async ({ categoryId, subCategoryId, itemTypeId }) => {
  if (!USE_MOCK_INVENTORY_DATA) {
    const params = {};
    if (categoryId) params.categoryId = categoryId;
    if (subCategoryId) params.subCategoryId = subCategoryId;
    if (itemTypeId) params.itemTypeId = itemTypeId;
    const response = await axiosInstance.get(`${ADJUSTMENT_ENDPOINT}/adjustable-items`, { params });
    const data = response.data ?? response;
    return Array.isArray(data) ? data : (data.content || []);
  }

  await delay();
  const { cat, sub } = resolveMeta({ categoryId, subCategoryId, itemTypeId });
  if (!cat) return [];

  if (cat.name === 'Fabric') {
    const rows = sub
      ? MOCK_FABRIC_STOCK.filter((r) => r.subCategory === sub.name)
      : MOCK_FABRIC_STOCK;
    const grouped = new Map();
    rows.forEach((r) => {
      const key = `${r.itemCode}__${r.color}__${r.width}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          itemId: r.id,
          itemCode: r.itemCode,
          itemName: r.fabricDescription,
          variantLabel: `${r.color} / ${r.width}"`,
          uom: r.uom,
          availableRolls: [],
        });
      }
      grouped.get(key).availableRolls.push({ rollNumber: r.rollNumber, qty: r.weight });
    });
    return Array.from(grouped.values()).map((v) => {
      const first = v.availableRolls[0];
      return {
        ...v,
        rollNumber: first?.rollNumber ?? null,
        inStockQty: first?.qty ?? 0,
        physicalQty: null,
        variance: 0,
        variancePct: 0,
        remarks: '',
      };
    });
  }

  // Accessories
  const rows = sub
    ? MOCK_ACCESSORIES_STOCK.filter((r) => r.category === sub.name)
    : MOCK_ACCESSORIES_STOCK;
  return rows.map((r) => ({
    itemId: r.id,
    itemCode: r.itemCode,
    itemName: r.description,
    variantLabel: `${r.color} / ${r.size}`,
    uom: r.uom,
    rollNumber: null,
    availableRolls: [],
    inStockQty: r.available,
    physicalQty: null,
    variance: 0,
    variancePct: 0,
    remarks: '',
  }));
};

// Mock persistence. Assigns a slash-format adjustmentNumber based on current FY.
const fyLabel = (date) => {
  const d = date || new Date();
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const startYear = month >= 4 ? year : year - 1;
  return `${String(startYear).slice(-2)}-${String(startYear + 1).slice(-2)}`;
};

let _nextAdjId = MOCK_ADJUSTMENTS.length + 1000;
export const saveAdjustment = async (payload) => {
  if (!USE_MOCK_INVENTORY_DATA) {
    const response = await axiosInstance.post(ADJUSTMENT_ENDPOINT, payload);
    return response.data ?? response;
  }
  await delay();
  _nextAdjId += 1;
  const today = new Date();
  const record = {
    id: _nextAdjId,
    adjustmentNumber: `ADJ/${fyLabel(today)}/${_nextAdjId}`,
    adjustmentDate: today.toISOString().slice(0, 10),
    ...payload,
  };
  MOCK_ADJUSTMENTS.unshift(record);
  return record;
};

// ─── DASHBOARD (mock) ──────────────────────────────────────────────────────────
export const getDashboardStats = async () => { await delay(); return MOCK_DASHBOARD_STATS; };
