/**
 * Production PO Service — Cutting PO, Work Order (Sewing PO), Finishing PO.
 *
 * UI-only milestone: served entirely from the in-memory mock "server"
 * (productionMockData.js). The real Spring Boot endpoints (PRD §9) are wired
 * behind USE_MOCK_PRODUCTION_DATA so flipping the flag switches to the live API
 * with no UI changes once the backend lands.
 */
import axiosInstance from '../core/axiosInstance';
import { PROD_PO_STATUS, PO_TYPE, PO_TYPE_META, PO_ACTION, FINISHING_PROCESSES, computeVariancePercent } from '../../utils/productionConstants';
import {
  cuttingPos, workOrders, finishingPos, CONFIRMED_ORDERS, PROCESSING_UNITS, VENDORS, SEWING_LINES,
  genPoNumber, nextId, nowIso, deepClone, matchPoFilters, paginate, buildStockRows, buildConsumptionRows,
} from './productionMockData';

export const USE_MOCK_PRODUCTION_DATA = true;

const delay = (ms = 220) => new Promise((r) => setTimeout(r, ms));

// Per-type config: in-memory collection, PO-number prefix, number field, real endpoint.
const COLLECTIONS = {
  [PO_TYPE.CUTTING]:    { list: cuttingPos,   prefix: 'CPO', noField: 'cuttingPoNo',  endpoint: '/cutting-po' },
  [PO_TYPE.WORK_ORDER]: { list: workOrders,   prefix: 'WO',  noField: 'workOrderNo',  endpoint: '/work-order' },
  [PO_TYPE.FINISHING]:  { list: finishingPos, prefix: 'FPO', noField: 'finishingPoNo', endpoint: '/finishing-po' },
};

const findOrder = (orderId) => CONFIRMED_ORDERS.find((o) => String(o.id) === String(orderId));

// ─── Generic CRUD (mock + real-API fallback) ────────────────────────────────────
const listPos = async (type, params = {}) => {
  const { list, endpoint } = COLLECTIONS[type];
  if (!USE_MOCK_PRODUCTION_DATA) {
    const { data } = await axiosInstance.get(endpoint, { params });
    return data;
  }
  await delay();
  const filtered = list.filter((po) => matchPoFilters(po, params)).sort((a, b) => b.id - a.id);
  return paginate(filtered, params);
};

const getPo = async (type, id) => {
  const { list, endpoint } = COLLECTIONS[type];
  if (!USE_MOCK_PRODUCTION_DATA) {
    const { data } = await axiosInstance.get(`${endpoint}/${id}`);
    return data;
  }
  await delay(90);
  return deepClone(list.find((p) => String(p.id) === String(id)) || null);
};

const createPo = async (type, payload) => {
  const { list, prefix, noField, endpoint } = COLLECTIONS[type];
  if (!USE_MOCK_PRODUCTION_DATA) {
    const { data } = await axiosInstance.post(endpoint, payload);
    return data;
  }
  await delay();
  const id = nextId();
  const record = {
    ...payload, id, poType: type, [noField]: genPoNumber(prefix),
    status: PROD_PO_STATUS.DRAFT, approvedBy: null, approvedDate: null,
    approvalHistory: [{ action: 'CREATED', actor: payload.actorName || 'You', at: nowIso(), comment: 'PO created.' }],
    createdAt: nowIso(), updatedAt: nowIso(),
  };
  delete record.actorName;
  list.push(record);
  return deepClone(record);
};

const updatePo = async (type, id, payload) => {
  const { list, endpoint } = COLLECTIONS[type];
  if (!USE_MOCK_PRODUCTION_DATA) {
    const { data } = await axiosInstance.put(`${endpoint}/${id}`, payload);
    return data;
  }
  await delay();
  const idx = list.findIndex((p) => String(p.id) === String(id));
  if (idx === -1) throw new Error('PO not found');
  const existing = list[idx];
  list[idx] = {
    ...existing, ...payload,
    id: existing.id, poType: existing.poType, status: existing.status,
    [COLLECTIONS[type].noField]: existing[COLLECTIONS[type].noField],
    approvalHistory: existing.approvalHistory, createdAt: existing.createdAt, updatedAt: nowIso(),
  };
  delete list[idx].actorName;
  return deepClone(list[idx]);
};

// Transition rules (PRD §7.1).
const TRANSITIONS = {
  [PO_ACTION.SUBMIT]:     { from: [PROD_PO_STATUS.DRAFT], to: PROD_PO_STATUS.PENDING_APPROVAL, label: 'Submitted for approval.' },
  [PO_ACTION.APPROVE]:    { from: [PROD_PO_STATUS.PENDING_APPROVAL], to: PROD_PO_STATUS.APPROVED, label: 'Approved.' },
  [PO_ACTION.REFER_BACK]: { from: [PROD_PO_STATUS.PENDING_APPROVAL], to: PROD_PO_STATUS.DRAFT, label: 'Referred back to draft.', reason: true },
  [PO_ACTION.REJECT]:     { from: [PROD_PO_STATUS.PENDING_APPROVAL], to: PROD_PO_STATUS.REJECTED, label: 'Rejected.', reason: true },
  [PO_ACTION.CANCEL]:     { from: [PROD_PO_STATUS.DRAFT, PROD_PO_STATUS.PENDING_APPROVAL, PROD_PO_STATUS.APPROVED], to: PROD_PO_STATUS.CANCELLED, label: 'Cancelled.', reason: true },
};

const changeStatus = async (type, id, action, payload = {}) => {
  const { list, endpoint } = COLLECTIONS[type];
  if (!USE_MOCK_PRODUCTION_DATA) {
    const { data } = await axiosInstance.patch(`${endpoint}/${id}/status`, { action, ...payload });
    return data;
  }
  await delay();
  const po = list.find((p) => String(p.id) === String(id));
  if (!po) throw new Error('PO not found');
  const rule = TRANSITIONS[action];
  if (!rule || !rule.from.includes(po.status)) {
    throw new Error(`Action ${action} not allowed from ${po.status}`);
  }
  po.status = rule.to;
  po.updatedAt = nowIso();
  if (action === PO_ACTION.APPROVE) {
    po.approvedBy = payload.actorName || 'You';
    po.approvedDate = nowIso();
  }
  po.approvalHistory = [
    ...(po.approvalHistory || []),
    { action, actor: payload.actorName || 'You', at: nowIso(), comment: payload.reason || payload.comment || rule.label },
  ];
  return deepClone(po);
};

// ─── Cutting PO ─────────────────────────────────────────────────────────────────
export const listCuttingPos    = (params)     => listPos(PO_TYPE.CUTTING, params);
export const getCuttingPo       = (id)         => getPo(PO_TYPE.CUTTING, id);
export const createCuttingPo    = (payload)    => createPo(PO_TYPE.CUTTING, payload);
export const updateCuttingPo    = (id, payload) => updatePo(PO_TYPE.CUTTING, id, payload);
export const changeCuttingPoStatus = (id, action, payload) => changeStatus(PO_TYPE.CUTTING, id, action, payload);

// ─── Work Order ─────────────────────────────────────────────────────────────────
export const listWorkOrders     = (params)     => listPos(PO_TYPE.WORK_ORDER, params);
export const getWorkOrder       = (id)         => getPo(PO_TYPE.WORK_ORDER, id);
export const createWorkOrder    = (payload)    => createPo(PO_TYPE.WORK_ORDER, payload);
export const updateWorkOrder    = (id, payload) => updatePo(PO_TYPE.WORK_ORDER, id, payload);
export const changeWorkOrderStatus = (id, action, payload) => changeStatus(PO_TYPE.WORK_ORDER, id, action, payload);

// ─── Finishing PO ───────────────────────────────────────────────────────────────
export const listFinishingPos   = (params)     => listPos(PO_TYPE.FINISHING, params);
export const getFinishingPo     = (id)         => getPo(PO_TYPE.FINISHING, id);
export const updateFinishingPo  = (id, payload) => updatePo(PO_TYPE.FINISHING, id, payload);
export const changeFinishingPoStatus = (id, action, payload) => changeStatus(PO_TYPE.FINISHING, id, action, payload);

export const getFinishingPosByOrder = async (orderId) => {
  if (!USE_MOCK_PRODUCTION_DATA) {
    const { data } = await axiosInstance.get(`/finishing-po/by-order/${orderId}`);
    return data;
  }
  await delay(120);
  return deepClone(finishingPos.filter((p) => String(p.orderId) === String(orderId)));
};

// Vendor-based PO splitting (PRD §6.2): in-house clubbed + one PO per vendor.
export const generateFinishingPos = async (payload) => {
  const { orderId, workOrderId, workOrderNo, assignments = [], plannedStartDate, plannedEndDate, actorName } = payload;
  if (!USE_MOCK_PRODUCTION_DATA) {
    const { data } = await axiosInstance.post('/finishing-po/generate', payload);
    return data;
  }
  await delay();
  const order = findOrder(orderId);
  const seqOf = (key) => FINISHING_PROCESSES.find((p) => p.key === key)?.sequence || 99;
  const toProcessList = (keys) =>
    keys.sort((a, b) => seqOf(a) - seqOf(b)).map((key) => ({ processName: key, sequenceOrder: seqOf(key), remarks: '' }));

  const inhouse = assignments.filter((a) => a.mode === 'INHOUSE').map((a) => a.processKey);
  const byVendor = {};
  assignments.filter((a) => a.mode === 'OUTSOURCE' && a.vendorId).forEach((a) => {
    (byVendor[a.vendorId] = byVendor[a.vendorId] || []).push(a.processKey);
  });

  const groups = [];
  if (inhouse.length) groups.push({ vendorId: null, processes: inhouse });
  Object.entries(byVendor).forEach(([vid, procs]) => groups.push({ vendorId: Number(vid), processes: procs }));

  const created = groups.map((g) => {
    const vendor = g.vendorId ? VENDORS.find((v) => v.id === g.vendorId) : null;
    const id = nextId();
    const record = {
      id, poType: PO_TYPE.FINISHING, finishingPoNo: genPoNumber('FPO'),
      orderId: order.id, orderNo: order.orderNo, styleId: order.styleId, styleNo: order.styleNo,
      buyer: order.buyer, bomId: order.bomId, bomNo: order.bomNo,
      workOrderId, workOrderNo,
      totalOrderQty: order.items.reduce((s, i) => s + i.orderQty, 0),
      allowancePercent: order.allowancePercent,
      totalPlannedQty: order.items.reduce((s, i) => s + i.plannedQty, 0),
      isOutsourced: !!vendor, vendorId: vendor?.id || null, vendorName: vendor?.name || 'In-house',
      vendorRate: null, vendorDeliveryDate: null,
      plannedStartDate: plannedStartDate || null, plannedEndDate: plannedEndDate || null,
      status: PROD_PO_STATUS.DRAFT, approvedBy: null, approvedDate: null, remarks: '',
      items: order.items.map((it) => ({ ...it })),
      processes: toProcessList([...g.processes]),
      approvalHistory: [{ action: 'CREATED', actor: actorName || 'You', at: nowIso(), comment: 'Generated from process assignment.' }],
      createdAt: nowIso(), updatedAt: nowIso(),
    };
    finishingPos.push(record);
    return deepClone(record);
  });
  return created;
};

// ─── Shared lookups ─────────────────────────────────────────────────────────────
export const getConfirmedOrders = async () => {
  if (!USE_MOCK_PRODUCTION_DATA) {
    const { data } = await axiosInstance.get('/orders', { params: { status: 'CONFIRMED', size: 200 } });
    return data?.content || data || [];
  }
  await delay(120);
  return deepClone(CONFIRMED_ORDERS);
};

export const getOrderForPo = async (orderId) => {
  await delay(80);
  return deepClone(findOrder(orderId) || null);
};

export const getOrderAllowance = async (orderId) => {
  if (!USE_MOCK_PRODUCTION_DATA) {
    const { data } = await axiosInstance.get(`/orders/${orderId}/allowance`);
    return data;
  }
  await delay(60);
  const o = findOrder(orderId);
  return o ? { allowancePercent: o.allowancePercent, items: deepClone(o.items) } : null;
};

export const getPpApprovalStatus = async (orderId) => {
  if (!USE_MOCK_PRODUCTION_DATA) {
    const { data } = await axiosInstance.get(`/orders/${orderId}/pp-approval-status`);
    return data?.status;
  }
  await delay(60);
  return findOrder(orderId)?.ppSampleStatus || null;
};

export const getStockByBom = async (orderId, kind = 'fabric', opts = {}) => {
  if (!USE_MOCK_PRODUCTION_DATA) {
    const order = findOrder(orderId);
    const { data } = await axiosInstance.get(`/inventory/stock-by-bom/${order?.bomId}`, { params: { kind } });
    return data;
  }
  await delay(120);
  const order = findOrder(orderId);
  return order ? buildStockRows(order, kind, opts) : [];
};

export const getConsumptionComparison = async (orderId, cadPerPc) => {
  await delay(100);
  const order = findOrder(orderId);
  return order ? buildConsumptionRows(order, cadPerPc) : [];
};

export const getProcessingUnits = async (type) => {
  await delay(60);
  return type === 'VENDOR' ? deepClone(VENDORS) : deepClone(PROCESSING_UNITS);
};

export const getVendors = async (service) => {
  if (!USE_MOCK_PRODUCTION_DATA) {
    const { data } = await axiosInstance.get('/vendors', { params: { type: service } });
    return data;
  }
  await delay(60);
  return deepClone(service ? VENDORS.filter((v) => v.services.includes(service)) : VENDORS);
};

export const getSewingLines = async () => { await delay(40); return deepClone(SEWING_LINES); };

export const getApprovedCuttingPos = async (orderId) => {
  await delay(100);
  return deepClone(
    cuttingPos.filter((p) => p.status === PROD_PO_STATUS.APPROVED && (!orderId || String(p.orderId) === String(orderId))),
  );
};

export const getApprovedWorkOrders = async (orderId) => {
  await delay(100);
  return deepClone(
    workOrders.filter((p) => p.status === PROD_PO_STATUS.APPROVED && (!orderId || String(p.orderId) === String(orderId))),
  );
};

// Order-coverage: how much of an order's qty is already authorized by sibling POs of this type
// (excludes CANCELLED/REJECTED and the PO currently being edited). Guards over-authorization.
export const getOrderCoverage = async (type, orderId, excludeId) => {
  await delay(70);
  const order = findOrder(orderId);
  const siblings = COLLECTIONS[type].list.filter((p) =>
    String(p.orderId) === String(orderId)
    && p.status !== PROD_PO_STATUS.CANCELLED && p.status !== PROD_PO_STATUS.REJECTED
    && (!excludeId || String(p.id) !== String(excludeId)));
  return {
    orderQty: order ? order.items.reduce((s, i) => s + (i.orderQty || 0), 0) : 0,
    authorizedQty: siblings.reduce((s, p) => s + (p.totalPlannedQty || 0), 0),
    count: siblings.length,
    poNumbers: siblings.map((p) => p[COLLECTIONS[type].noField]),
  };
};

// Hub "Needs attention" feed: pending approvals + variance>5% + material shortages.
export const getAttentionItems = async () => {
  await delay(120);
  const out = [];
  const all = [...cuttingPos, ...workOrders, ...finishingPos];
  const poNo = (p) => p[PO_TYPE_META[p.poType].noField];
  all.filter((p) => p.status === PROD_PO_STATUS.PENDING_APPROVAL).forEach((p) =>
    out.push({ key: `pend-${p.poType}-${p.id}`, poType: p.poType, id: p.id, poNo: poNo(p), orderNo: p.orderNo, buyer: p.buyer, reason: 'Pending approval', severity: 'info' }));
  cuttingPos.filter((p) => p.bomConsumptionPerPc
    && Math.abs(computeVariancePercent(p.cadConsumptionPerPc, p.bomConsumptionPerPc)) > 5).forEach((p) =>
    out.push({ key: `var-${p.id}`, poType: p.poType, id: p.id, poNo: poNo(p), orderNo: p.orderNo, buyer: p.buyer, reason: 'Consumption variance > 5%', severity: 'warning' }));
  cuttingPos.filter((p) => p.status !== PROD_PO_STATUS.CANCELLED && p.status !== PROD_PO_STATUS.REJECTED).forEach((p) => {
    const order = findOrder(p.orderId);
    if (order && buildStockRows(order, 'fabric', { cadPerPc: p.cadConsumptionPerPc }).some((r) => r.shortageSurplus < 0)) {
      out.push({ key: `short-${p.id}`, poType: p.poType, id: p.id, poNo: poNo(p), orderNo: p.orderNo, buyer: p.buyer, reason: 'Fabric shortage', severity: 'error' });
    }
  });
  return out;
};

// Hub dashboard aggregation.
export const getHubStats = async () => {
  await delay(120);
  const tally = (list) => ({
    total: list.length,
    draft: list.filter((p) => p.status === PROD_PO_STATUS.DRAFT).length,
    pending: list.filter((p) => p.status === PROD_PO_STATUS.PENDING_APPROVAL).length,
    approved: list.filter((p) => p.status === PROD_PO_STATUS.APPROVED).length,
  });
  const pendingApprovals =
    [...cuttingPos, ...workOrders, ...finishingPos].filter((p) => p.status === PROD_PO_STATUS.PENDING_APPROVAL).length;
  const shortages = CONFIRMED_ORDERS.reduce(
    (n, o) => n + buildStockRows(o, 'fabric').filter((r) => r.shortageSurplus < 0).length, 0,
  );
  const varianceAlerts = cuttingPos.filter((p) => {
    const v = p.bomConsumptionPerPc ? ((p.cadConsumptionPerPc - p.bomConsumptionPerPc) / p.bomConsumptionPerPc) * 100 : 0;
    return Math.abs(v) > 5;
  }).length;
  return {
    cutting: tally(cuttingPos), workOrder: tally(workOrders), finishing: tally(finishingPos),
    pendingApprovals, shortages, varianceAlerts,
  };
};
