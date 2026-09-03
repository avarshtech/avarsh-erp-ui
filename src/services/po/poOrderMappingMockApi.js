/**
 * PO–Order Mapping mock API. Mirrors the future REST contract exactly so the
 * cutover is mechanical: Spring page envelope, camelCase, YYYY-MM-DD dates,
 * typed `.code` on errors.
 *
 *   GET    /purchase-orders/order-mapping                 searchMappablePos
 *   GET    /purchase-orders/order-mapping/{poId}          getPoMapping
 *   GET    /purchase-orders/order-mapping/orders          listMappableOrders
 *   GET    /purchase-orders/order-mapping/suppliers       listMappingSuppliers
 *   POST   /purchase-orders/order-mapping/{poId}/allocations          addAllocation
 *   DELETE /purchase-orders/order-mapping/{poId}/allocations/{id}     removeAllocation
 *   POST   /purchase-orders/order-mapping/{poId}/map-all              mapWholePo
 *   PUT    /purchase-orders/order-mapping/{poId}/stock-only           setStockOnly
 *
 * Allocation is per PO line with a quantity: one General PO can serve several
 * orders and part of a line can stay as free stock. The ceiling is the PO line
 * quantity (mapping ahead of receipt is allowed); received qty is informational.
 *
 * Category filter: only Fabric, Trims and Accessories lines (case-insensitive) are
 * exposed, and a PO with no such line is not a candidate at all (the real endpoint applies the same filter
 * server-side, so the screen never sees packing or consumable lines).
 */
import { loadDb, saveDb, nextId } from './poOrderMappingMockStore';
import { getCurrentUser } from '../../utils/permissions';
import {
  MAPPING_STATUS, MAPPABLE_PO_STATUSES, MAPPABLE_ORDER_STATUSES, allocationCeiling, isMappableLine,
} from '../../utils/poOrderMappingConstants';

const delay = (ms = 150) => new Promise((r) => setTimeout(r, ms));
const clone = (v) => JSON.parse(JSON.stringify(v));
const fail = (code, msg) => { const e = new Error(msg); e.code = code; throw e; };
const sum = (arr, pick) => arr.reduce((s, x) => s + (Number(pick(x)) || 0), 0);
const pad = (n) => String(n).padStart(2, '0');
const nowStamp = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const currentUserName = () => {
  const u = getCurrentUser();
  if (!u) return 'User';
  return typeof u === 'string' ? u : (u.name || u.fullName || u.username || u.email || 'User');
};
const pageOf = (rows, { page = 0, size = 10 } = {}) => {
  const p = Number(page); const s = Number(size);
  return { content: rows.slice(p * s, p * s + s), totalElements: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / s)), size: s, number: p };
};

// ── Enrichment ──────────────────────────────────────────────────────────────

const enrichAllocation = (db, a) => {
  const o = db.orders.find((x) => x.id === a.orderId) || {};
  return { ...a, orderNo: o.orderNo, buyerName: o.buyerName, styleNo: o.styleNo, garmentName: o.garmentName, orderStatus: o.status };
};

const enrichLine = (db, line) => {
  const allocations = db.allocations.filter((a) => a.poLineItemId === line.id).map((a) => enrichAllocation(db, a));
  const mappedQty = sum(allocations, (a) => a.qty);
  const ceiling = allocationCeiling(line);
  return {
    ...line,
    allocations,
    mappedQty,
    unmappedQty: Math.max(0, ceiling - mappedQty),
    mappedPercent: ceiling ? Math.round((mappedQty / ceiling) * 100) : 0,
    receivedPercent: ceiling ? Math.round(((Number(line.receivedQty) || 0) / ceiling) * 100) : 0,
  };
};

const mappingStatusOf = (p, lines) => {
  if (p.stockOnly) return MAPPING_STATUS.STOCK_ONLY;
  const mapped = lines.filter((l) => l.mappedQty > 0).length;
  if (mapped === 0) return MAPPING_STATUS.UNMAPPED;
  return lines.every((l) => l.unmappedQty === 0) ? MAPPING_STATUS.MAPPED : MAPPING_STATUS.PARTIAL;
};

/** Mixed UOMs (MTR + PCS) make a PO-level quantity meaningless, so progress is line-weighted. */
const summarisePo = (db, p) => {
  const lineItems = mappableLines(p).map((l) => enrichLine(db, l));
  const linkedById = new Map();
  lineItems.forEach((l) => l.allocations.forEach((a) => {
    if (!linkedById.has(a.orderId)) linkedById.set(a.orderId, { orderId: a.orderId, orderNo: a.orderNo, buyerName: a.buyerName, styleNo: a.styleNo });
  }));
  const avg = (pick) => (lineItems.length ? Math.round(sum(lineItems, pick) / lineItems.length) : 0);
  return {
    ...p,
    lineItems,
    lineCount: lineItems.length,
    hiddenLineCount: p.lineItems.length - lineItems.length,
    linesFullyMapped: lineItems.filter((l) => l.unmappedQty === 0).length,
    linesPartiallyMapped: lineItems.filter((l) => l.mappedQty > 0 && l.unmappedQty > 0).length,
    mappedPercent: avg((l) => l.mappedPercent),
    receivedPercent: avg((l) => l.receivedPercent),
    mappingStatus: mappingStatusOf(p, lineItems),
    linkedOrders: [...linkedById.values()],
  };
};

const mappableLines = (p) => p.lineItems.filter(isMappableLine);
const candidatePos = (db) => db.pos.filter((p) => p.poType === 'General'
  && MAPPABLE_PO_STATUSES.includes(p.status)
  && mappableLines(p).length > 0);
const findPo = (db, poId) => candidatePos(db).find((p) => p.id === Number(poId)) || fail('PO_NOT_FOUND', 'Purchase order not found or not eligible for mapping');
const findLine = (p, lineId) => mappableLines(p).find((l) => l.id === Number(lineId)) || fail('LINE_NOT_FOUND', 'PO line not found or not a Fabric/Trims/Accessories line');
const findOrder = (db, orderId) => {
  const o = db.orders.find((x) => x.id === Number(orderId)) || fail('ORDER_NOT_FOUND', 'Order not found');
  if (!MAPPABLE_ORDER_STATUSES.includes(o.status)) fail('ORDER_NOT_MAPPABLE', `${o.orderNo} is ${o.status} — only confirmed or in-production orders can receive stock`);
  return o;
};
const fmtQty = (n) => Number(n).toLocaleString('en-IN');
const lineLabel = (l) => `${l.itemCode}${l.color ? ` ${l.color}` : ''}${l.size ? ` ${l.size}` : ''}`;

const audit = (db, p, action, details) => {
  db.audit.push({ id: nextId(db), at: nowStamp(), by: currentUserName(), poId: p.id, poNumber: p.poNumber, action, details });
};

const mappingResponse = (db, p) => {
  const s = summarisePo(db, p);
  s.history = db.audit.filter((a) => a.poId === p.id).sort((a, b) => (a.at < b.at ? 1 : -1));
  return clone(s);
};

// ── Reads ───────────────────────────────────────────────────────────────────

export const listMappingSuppliers = async () => {
  await delay(60);
  return clone(loadDb().suppliers);
};

export const searchMappablePos = async (params = {}) => {
  await delay();
  const db = loadDb();
  const q = (params.search || '').trim().toLowerCase();
  let rows = candidatePos(db).map((p) => summarisePo(db, p));
  if (q) {
    rows = rows.filter((r) => r.poNumber.toLowerCase().includes(q)
      || r.supplierName.toLowerCase().includes(q)
      || r.linkedOrders.some((o) => o.orderNo.toLowerCase().includes(q))
      || r.lineItems.some((l) => `${l.itemCode} ${l.description}`.toLowerCase().includes(q)));
  }
  if (params.mappingStatus) rows = rows.filter((r) => r.mappingStatus === params.mappingStatus);
  if (params.supplierId) rows = rows.filter((r) => r.supplierId === Number(params.supplierId));
  if (params.poDateStart) rows = rows.filter((r) => r.poDate >= params.poDateStart);
  if (params.poDateEnd) rows = rows.filter((r) => r.poDate <= params.poDateEnd);
  const field = params.sort || 'poDate';
  const dir = params.direction === 'asc' ? 1 : -1;
  rows.sort((a, b) => (a[field] > b[field] ? dir : a[field] < b[field] ? -dir : 0));
  return clone(pageOf(rows, params));
};

export const getPoMapping = async (poId) => {
  await delay();
  const db = loadDb();
  return mappingResponse(db, findPo(db, poId));
};

/** Orders that can receive stock, with how many POs already feed each one. */
export const listMappableOrders = async () => {
  await delay(80);
  const db = loadDb();
  return clone(db.orders
    .filter((o) => MAPPABLE_ORDER_STATUSES.includes(o.status))
    .map((o) => ({ ...o, linkedPoCount: new Set(db.allocations.filter((a) => a.orderId === o.id).map((a) => a.poId)).size })));
};

// ── Writes ──────────────────────────────────────────────────────────────────

const allocate = (db, p, line, order, qty, remarks) => {
  const enriched = enrichLine(db, line);
  if (p.stockOnly) fail('PO_STOCK_ONLY', `${p.poNumber} is marked Stock Only — clear that flag before mapping`);
  if (!(qty > 0)) fail('QTY_INVALID', 'Quantity must be greater than zero');
  if (qty > enriched.unmappedQty) fail('QTY_EXCEEDS', `Only ${fmtQty(enriched.unmappedQty)} ${line.uom} of ${lineLabel(line)} is still unmapped`);
  const existing = db.allocations.find((a) => a.poLineItemId === line.id && a.orderId === order.id);
  if (existing) {
    existing.qty += qty;
    existing.remarks = remarks || existing.remarks;
    existing.mappedBy = currentUserName();
    existing.mappedOn = nowStamp();
  } else {
    db.allocations.push({ id: nextId(db), poId: p.id, poLineItemId: line.id, orderId: order.id, qty, remarks: remarks || '', mappedBy: currentUserName(), mappedOn: nowStamp() });
  }
  audit(db, p, 'Mapped', `${fmtQty(qty)} ${line.uom} of ${lineLabel(line)} → ${order.orderNo}`);
};

export const addAllocation = async ({ poId, poLineItemId, orderId, qty, remarks }) => {
  await delay();
  const db = loadDb();
  const p = findPo(db, poId);
  allocate(db, p, findLine(p, poLineItemId), findOrder(db, orderId), Number(qty), remarks);
  p.version += 1;
  saveDb(db);
  return mappingResponse(db, p);
};

export const removeAllocation = async ({ poId, allocationId }) => {
  await delay();
  const db = loadDb();
  const p = findPo(db, poId);
  const idx = db.allocations.findIndex((a) => a.id === Number(allocationId) && a.poId === p.id);
  if (idx < 0) fail('ALLOCATION_NOT_FOUND', 'Mapping not found');
  const [a] = db.allocations.splice(idx, 1);
  const line = p.lineItems.find((l) => l.id === a.poLineItemId) || {};
  const order = db.orders.find((o) => o.id === a.orderId) || {};
  audit(db, p, 'Unmapped', `${fmtQty(a.qty)} ${line.uom || ''} of ${lineLabel(line)} ← ${order.orderNo || '?'}`);
  p.version += 1;
  saveDb(db);
  return mappingResponse(db, p);
};

/** Allocate whatever is still open on every line to one order. */
export const mapWholePo = async ({ poId, orderId, remarks }) => {
  await delay(200);
  const db = loadDb();
  const p = findPo(db, poId);
  const order = findOrder(db, orderId);
  const open = mappableLines(p).filter((l) => enrichLine(db, l).unmappedQty > 0);
  if (!open.length) fail('NOTHING_TO_MAP', `${p.poNumber} has no unmapped quantity left`);
  open.forEach((l) => allocate(db, p, l, order, enrichLine(db, l).unmappedQty, remarks));
  p.version += 1;
  saveDb(db);
  return mappingResponse(db, p);
};

export const setStockOnly = async ({ poId, stockOnly, remark }) => {
  await delay();
  const db = loadDb();
  const p = findPo(db, poId);
  if (stockOnly && db.allocations.some((a) => a.poId === p.id)) fail('HAS_ALLOCATIONS', `${p.poNumber} already has order mappings — remove them before marking it Stock Only`);
  if (stockOnly && !(remark || '').trim()) fail('REMARK_REQUIRED', 'A remark is required when marking a PO as Stock Only');
  p.stockOnly = Boolean(stockOnly);
  p.stockOnlyRemark = stockOnly ? remark.trim() : '';
  audit(db, p, stockOnly ? 'Marked Stock Only' : 'Stock Only Cleared', stockOnly ? remark.trim() : (remark || '').trim());
  p.version += 1;
  saveDb(db);
  return mappingResponse(db, p);
};
