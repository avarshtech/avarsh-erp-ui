/**
 * Production PO — in-memory mock dataset + engine helpers.
 *
 * Acts as a lightweight "server": arrays mutate during the session (create /
 * update / status changes persist until page reload). Shapes are aligned with
 * the existing inventory mock stubs (MOCK_APPROVED_CUTTING_POS / WORK_ORDERS)
 * and the AV-SS26 styles / buyers / ORD-2026 orders used elsewhere, so the whole
 * system reads coherently. Swap to the real API by flipping USE_MOCK_PRODUCTION_DATA.
 */
import {
  PROD_PO_STATUS, PP_SAMPLE_STATUS, PROCESSING_UNIT_TYPE,
  FINISHING_PROCESS, computePlannedQty,
} from '../../utils/productionConstants';

// ─── Size-color matrix helper ──────────────────────────────────────────────────
const SIZES = ['S', 'M', 'L', 'XL'];
const SIZE_RATIO = { S: 0.2, M: 0.3, L: 0.3, XL: 0.2 };

const mkItems = (colors, totalPerColor, allowancePercent) =>
  colors.flatMap((color) =>
    SIZES.map((size) => {
      const orderQty = Math.round(totalPerColor * SIZE_RATIO[size]);
      return {
        color, size, orderQty, allowancePercent,
        plannedQty: computePlannedQty(orderQty, allowancePercent),
        ratePerPiece: 0,
      };
    }),
  );

const sumQty = (items, field) => items.reduce((s, i) => s + (i[field] || 0), 0);

// ─── Material catalog (BOM consumption/pc + live stock) ─────────────────────────
// kind: fabric | trim | packing. bomPerPc = consumption per garment.
// lastGrnAt = when stock was last received (PRD §13: warn if > 48h old). A few are
// intentionally stale (> 48h before the 2026-06-14 demo "today") to exercise the warning.
export const MATERIAL_CATALOG = {
  'FAB-CJ40-WHT':     { itemName: 'Cotton Jersey 40s Reactive',          uom: 'kg',     kind: 'fabric',  bomPerPc: 0.135, currentStock: 900,   allocated: 140,  lastGrnAt: '2026-06-13T09:00:00' },
  'FAB-VRT-BLK':      { itemName: 'Viscose Rayon Twill',                 uom: 'kg',     kind: 'fabric',  bomPerPc: 0.068, currentStock: 360,   allocated: 60,   lastGrnAt: '2026-06-10T09:00:00' },
  'FAB-CVCP-NVY':     { itemName: 'CVC Pique 220 GSM',                   uom: 'kg',     kind: 'fabric',  bomPerPc: 0.150, currentStock: 400,   allocated: 30,   lastGrnAt: '2026-06-13T11:00:00' },
  'FAB-DNM-IND':      { itemName: 'Indigo Denim 10oz Stretch',           uom: 'm',      kind: 'fabric',  bomPerPc: 0.360, currentStock: 520,   allocated: 90,   lastGrnAt: '2026-06-13T08:00:00' },
  'FAB-PS75-BLU':     { itemName: '100% Polyester Satin 75D',            uom: 'm',      kind: 'fabric',  bomPerPc: 0.150, currentStock: 300,   allocated: 200,  lastGrnAt: '2026-06-13T10:00:00' },
  'BTN-4H-15MM-NAT':  { itemName: '4-Hole Button 15mm Natural',          uom: 'pcs',    kind: 'trim',    bomPerPc: 5,     currentStock: 32000, allocated: 4000, lastGrnAt: '2026-06-13T09:30:00' },
  'BTN-4H-15MM-NVY':  { itemName: '4-Hole Button 15mm Navy',             uom: 'pcs',    kind: 'trim',    bomPerPc: 5,     currentStock: 18000, allocated: 2000, lastGrnAt: '2026-06-13T09:30:00' },
  'LBL-WVN-MAIN-SS26':{ itemName: 'Woven Main Label SS26',               uom: 'pcs',    kind: 'trim',    bomPerPc: 1,     currentStock: 26000, allocated: 5000, lastGrnAt: '2026-06-13T12:00:00' },
  'LBL-CARE-POLY-STD':{ itemName: 'Printed Care Label Polyester',        uom: 'pcs',    kind: 'trim',    bomPerPc: 1,     currentStock: 24000, allocated: 3000, lastGrnAt: '2026-06-13T12:00:00' },
  'THR-POLY-40-WHT':  { itemName: 'Polyester Sewing Thread 40/2 White',  uom: 'cones',  kind: 'trim',    bomPerPc: 0.007, currentStock: 120,   allocated: 20,   lastGrnAt: '2026-06-09T09:00:00' },
  'POLY-BAG-STD':     { itemName: 'Polybag Standard (per garment)',      uom: 'pcs',    kind: 'packing', bomPerPc: 1,     currentStock: 21000, allocated: 6000, lastGrnAt: '2026-06-13T09:00:00' },
  'CTN-MASTER-5PLY':  { itemName: 'Master Carton 5-Ply',                 uom: 'pcs',    kind: 'packing', bomPerPc: 0.05,  currentStock: 900,   allocated: 120,  lastGrnAt: '2026-06-13T09:00:00' },
  'TAG-HANG-SS26':    { itemName: 'Hangtag SS26 Collection',             uom: 'pcs',    kind: 'packing', bomPerPc: 1,     currentStock: 13500, allocated: 2500, lastGrnAt: '2026-06-13T09:00:00' },
  'STK-SIZE':         { itemName: 'Size Sticker',                        uom: 'pcs',    kind: 'packing', bomPerPc: 1,     currentStock: 30000, allocated: 1000, lastGrnAt: '2026-06-13T09:00:00' },
  'TIS-WRAP':         { itemName: 'Tissue Wrap Sheet',                   uom: 'pcs',    kind: 'packing', bomPerPc: 1,     currentStock: 8000,  allocated: 7200, lastGrnAt: '2026-06-08T09:00:00' },
};

// ─── Confirmed orders (source for raising POs) ──────────────────────────────────
export const CONFIRMED_ORDERS = [
  {
    id: 1, orderNo: 'ORD-2026-001', styleId: 11, styleNo: 'AV-SS26-001', buyer: 'Nordstrom Inc',
    bomId: 101, bomNo: 'BOM-2026-001', ppSampleStatus: PP_SAMPLE_STATUS.COMPLETED,
    allowancePercent: 3, colors: ['White', 'Black'],
    bomMaterials: { fabric: ['FAB-CJ40-WHT', 'FAB-VRT-BLK'], trim: ['BTN-4H-15MM-NAT', 'LBL-WVN-MAIN-SS26', 'LBL-CARE-POLY-STD', 'THR-POLY-40-WHT'], packing: ['POLY-BAG-STD', 'CTN-MASTER-5PLY', 'TAG-HANG-SS26', 'STK-SIZE'] },
    items: mkItems(['White', 'Black'], 2500, 3),
  },
  {
    id: 2, orderNo: 'ORD-2026-003', styleId: 13, styleNo: 'AV-SS26-003', buyer: 'H&M Group',
    bomId: 103, bomNo: 'BOM-2026-003', ppSampleStatus: PP_SAMPLE_STATUS.COMPLETED,
    allowancePercent: 5, colors: ['Navy'],
    bomMaterials: { fabric: ['FAB-CVCP-NVY'], trim: ['BTN-4H-15MM-NVY', 'LBL-WVN-MAIN-SS26', 'THR-POLY-40-WHT'], packing: ['POLY-BAG-STD', 'CTN-MASTER-5PLY', 'TAG-HANG-SS26'] },
    items: mkItems(['Navy'], 3000, 5),
  },
  {
    id: 3, orderNo: 'ORD-2026-015', styleId: 25, styleNo: 'AV-AW26-015', buyer: 'Zara International',
    bomId: 115, bomNo: 'BOM-2026-015', ppSampleStatus: PP_SAMPLE_STATUS.COMPLETED,
    allowancePercent: 4, colors: ['Indigo'],
    bomMaterials: { fabric: ['FAB-DNM-IND'], trim: ['BTN-4H-15MM-NAT', 'LBL-WVN-MAIN-SS26'], packing: ['POLY-BAG-STD', 'CTN-MASTER-5PLY', 'TAG-HANG-SS26', 'TIS-WRAP'] },
    items: mkItems(['Indigo'], 2000, 4),
  },
  {
    id: 4, orderNo: 'ORD-2026-005', styleId: 15, styleNo: 'AV-SS26-005', buyer: 'H&M Group',
    bomId: 105, bomNo: 'BOM-2026-005', ppSampleStatus: PP_SAMPLE_STATUS.PENDING, // gate demo
    allowancePercent: 3, colors: ['Blue'],
    bomMaterials: { fabric: ['FAB-PS75-BLU'], trim: ['LBL-WVN-MAIN-SS26', 'THR-POLY-40-WHT'], packing: ['POLY-BAG-STD', 'STK-SIZE'] },
    items: mkItems(['Blue'], 3500, 3),
  },
  {
    id: 5, orderNo: 'ORD-2026-009', styleId: 19, styleNo: 'AV-SS26-009', buyer: 'Nordstrom Inc',
    bomId: 109, bomNo: 'BOM-2026-009', ppSampleStatus: PP_SAMPLE_STATUS.REVOKED, // compliance-flag demo: PO approved earlier, PP later revoked
    allowancePercent: 3, colors: ['Olive'],
    bomMaterials: { fabric: ['FAB-CJ40-WHT'], trim: ['BTN-4H-15MM-NAT', 'LBL-WVN-MAIN-SS26'], packing: ['POLY-BAG-STD', 'TAG-HANG-SS26'] },
    items: mkItems(['Olive'], 1800, 3),
  },
];

// ─── Processing units & vendors ─────────────────────────────────────────────────
export const PROCESSING_UNITS = [
  { id: 1, name: 'Unit 1 — Cutting Hall A' },
  { id: 2, name: 'Unit 2 — Sewing Floor 1' },
  { id: 3, name: 'Unit 3 — Finishing & Packing' },
];

export const VENDORS = [
  { id: 101, name: 'Stitch Well Apparels', services: ['CUTTING', 'WORK_ORDER'] },
  { id: 102, name: 'Precision Cut Works',  services: ['CUTTING'] },
  { id: 103, name: 'FineFinish Processors', services: ['FINISHING'] },
  { id: 104, name: 'IronMaster Services',   services: ['FINISHING'] },
];

export const SEWING_LINES = [
  { value: 'LINE-A', label: 'Line A' },
  { value: 'LINE-B', label: 'Line B' },
  { value: 'LINE-C', label: 'Line C' },
];

// ─── Seed PO builder ────────────────────────────────────────────────────────────
const orderById = (id) => CONFIRMED_ORDERS.find((o) => o.id === id);

const seedHistory = (status) => {
  const h = [{ action: 'CREATED', actor: 'Priya (Merchandiser)', at: '2026-06-01T09:15:00', comment: 'PO created from order.' }];
  if (status !== PROD_PO_STATUS.DRAFT) h.push({ action: 'SUBMIT', actor: 'Priya (Merchandiser)', at: '2026-06-02T10:30:00', comment: 'Submitted for approval.' });
  if (status === PROD_PO_STATUS.APPROVED) h.push({ action: 'APPROVE', actor: 'Rajan (Production Manager)', at: '2026-06-03T14:05:00', comment: 'Consumption + stock verified.' });
  return h;
};

const withRates = (items, base) => items.map((it) => ({
  ...it,
  ratePerPiece: base + (it.size === 'L' ? 0.5 : it.size === 'XL' ? 1 : 0),
}));

const baseFromOrder = (order, { cadPerPc } = {}) => {
  const fabricCode = order.bomMaterials.fabric[0];
  const bomPerPc = MATERIAL_CATALOG[fabricCode]?.bomPerPc || 0;
  const cad = cadPerPc ?? +(bomPerPc * 1.03).toFixed(3);
  return {
    orderId: order.id, orderNo: order.orderNo, styleId: order.styleId, styleNo: order.styleNo,
    buyer: order.buyer, bomId: order.bomId, bomNo: order.bomNo,
    totalOrderQty: sumQty(order.items, 'orderQty'),
    allowancePercent: order.allowancePercent,
    totalPlannedQty: sumQty(order.items, 'plannedQty'),
    bomConsumptionPerPc: bomPerPc,
    cadConsumptionPerPc: cad,
  };
};

// ─── Seed: Cutting POs ──────────────────────────────────────────────────────────
export const cuttingPos = [
  {
    id: 1, cuttingPoNo: 'CPO-2026-0001', poType: 'CUTTING', ...baseFromOrder(orderById(1)),
    processingUnitType: PROCESSING_UNIT_TYPE.UNIT, processingUnitId: 1, processingUnitName: 'Unit 1 — Cutting Hall A',
    plannedCutDate: '2026-06-10', plannedDeliveryDate: '2026-06-16',
    markerFileUrl: null, markerEfficiency: 86.5, fabricWastagePercent: 4,
    status: PROD_PO_STATUS.APPROVED, approvedBy: 'Rajan (Production Manager)', approvedDate: '2026-06-03T14:05:00',
    remarks: '', items: withRates(orderById(1).items, 3), approvalHistory: seedHistory(PROD_PO_STATUS.APPROVED),
    createdAt: '2026-06-01T09:15:00', updatedAt: '2026-06-03T14:05:00',
  },
  {
    id: 2, cuttingPoNo: 'CPO-2026-0002', poType: 'CUTTING', ...baseFromOrder(orderById(2)),
    processingUnitType: PROCESSING_UNIT_TYPE.VENDOR, processingUnitId: 102, processingUnitName: 'Precision Cut Works',
    plannedCutDate: '2026-06-12', plannedDeliveryDate: '2026-06-18',
    markerFileUrl: null, markerEfficiency: 82, fabricWastagePercent: 5,
    status: PROD_PO_STATUS.PENDING_APPROVAL, approvedBy: null, approvedDate: null,
    remarks: '', items: withRates(orderById(2).items, 3.2), approvalHistory: seedHistory(PROD_PO_STATUS.PENDING_APPROVAL),
    createdAt: '2026-06-02T11:00:00', updatedAt: '2026-06-02T11:00:00',
  },
  {
    id: 3, cuttingPoNo: 'CPO-2026-0003', poType: 'CUTTING', ...baseFromOrder(orderById(3)),
    processingUnitType: PROCESSING_UNIT_TYPE.UNIT, processingUnitId: 1, processingUnitName: 'Unit 1 — Cutting Hall A',
    plannedCutDate: '2026-06-14', plannedDeliveryDate: '2026-06-20',
    markerFileUrl: null, markerEfficiency: null, fabricWastagePercent: 4,
    status: PROD_PO_STATUS.DRAFT, approvedBy: null, approvedDate: null,
    remarks: '', items: withRates(orderById(3).items, 4), approvalHistory: seedHistory(PROD_PO_STATUS.DRAFT),
    createdAt: '2026-06-05T08:40:00', updatedAt: '2026-06-05T08:40:00',
  },
  {
    // Approved when PP was cleared; the order's PP sample was later REVOKED -> compliance flag in View.
    id: 4, cuttingPoNo: 'CPO-2026-0004', poType: 'CUTTING', ...baseFromOrder(orderById(5)),
    processingUnitType: PROCESSING_UNIT_TYPE.UNIT, processingUnitId: 1, processingUnitName: 'Unit 1 — Cutting Hall A',
    plannedCutDate: '2026-06-09', plannedDeliveryDate: '2026-06-15',
    markerFileUrl: null, markerEfficiency: 84, fabricWastagePercent: 4,
    status: PROD_PO_STATUS.APPROVED, approvedBy: 'Rajan (Production Manager)', approvedDate: '2026-06-04T10:00:00',
    remarks: '', items: withRates(orderById(5).items, 3), approvalHistory: seedHistory(PROD_PO_STATUS.APPROVED),
    createdAt: '2026-06-02T09:00:00', updatedAt: '2026-06-04T10:00:00',
  },
];

// ─── Seed: Work Orders ──────────────────────────────────────────────────────────
export const workOrders = [
  {
    id: 1, workOrderNo: 'WO-2026-0001', poType: 'WORK_ORDER', ...baseFromOrder(orderById(1)),
    cuttingPoId: 1, cuttingPoNo: 'CPO-2026-0001',
    processingUnitType: PROCESSING_UNIT_TYPE.UNIT, processingUnitId: 2, processingUnitName: 'Unit 2 — Sewing Floor 1',
    sewingLineId: 'LINE-A', samMinutes: 14.5, targetDailyOutput: 600,
    plannedStartDate: '2026-06-18', plannedEndDate: '2026-06-28', plannedDeliveryDate: '2026-06-30',
    consumptionVariance: 3, status: PROD_PO_STATUS.APPROVED, approvedBy: 'Rajan (Production Manager)', approvedDate: '2026-06-06T12:00:00',
    remarks: '', items: withRates(orderById(1).items, 22), approvalHistory: seedHistory(PROD_PO_STATUS.APPROVED),
    createdAt: '2026-06-04T09:00:00', updatedAt: '2026-06-06T12:00:00',
  },
  {
    id: 2, workOrderNo: 'WO-2026-0002', poType: 'WORK_ORDER', ...baseFromOrder(orderById(2)),
    cuttingPoId: 2, cuttingPoNo: 'CPO-2026-0002',
    processingUnitType: PROCESSING_UNIT_TYPE.VENDOR, processingUnitId: 101, processingUnitName: 'Stitch Well Apparels',
    sewingLineId: null, samMinutes: null, targetDailyOutput: null,
    plannedStartDate: '2026-06-20', plannedEndDate: '2026-07-02', plannedDeliveryDate: '2026-07-04',
    consumptionVariance: 4, status: PROD_PO_STATUS.DRAFT, approvedBy: null, approvedDate: null,
    remarks: '', items: withRates(orderById(2).items, 26), approvalHistory: seedHistory(PROD_PO_STATUS.DRAFT),
    createdAt: '2026-06-07T10:00:00', updatedAt: '2026-06-07T10:00:00',
  },
];

// ─── Seed: Finishing POs ────────────────────────────────────────────────────────
const fpProc = (key, seq) => ({ processName: key, sequenceOrder: seq, remarks: '' });

export const finishingPos = [
  {
    id: 1, finishingPoNo: 'FPO-2026-0001', poType: 'FINISHING', ...baseFromOrder(orderById(1)),
    workOrderId: 1, workOrderNo: 'WO-2026-0001',
    isOutsourced: false, vendorId: null, vendorName: 'In-house', vendorRate: null, vendorDeliveryDate: null,
    plannedStartDate: '2026-06-29', plannedEndDate: '2026-07-03',
    status: PROD_PO_STATUS.APPROVED, approvedBy: 'Rajan (Production Manager)', approvedDate: '2026-06-08T15:00:00',
    remarks: '', items: orderById(1).items.map((it) => ({ ...it })),
    processes: [fpProc(FINISHING_PROCESS.TRIMMING, 1), fpProc(FINISHING_PROCESS.CHECKING, 2)],
    approvalHistory: seedHistory(PROD_PO_STATUS.APPROVED),
    createdAt: '2026-06-08T09:00:00', updatedAt: '2026-06-08T15:00:00',
  },
  {
    id: 2, finishingPoNo: 'FPO-2026-0002', poType: 'FINISHING', ...baseFromOrder(orderById(1)),
    workOrderId: 1, workOrderNo: 'WO-2026-0001',
    isOutsourced: true, vendorId: 103, vendorName: 'FineFinish Processors', vendorRate: 4.5, vendorDeliveryDate: '2026-07-05',
    plannedStartDate: '2026-06-30', plannedEndDate: '2026-07-05',
    status: PROD_PO_STATUS.PENDING_APPROVAL, approvedBy: null, approvedDate: null,
    remarks: '', items: orderById(1).items.map((it) => ({ ...it })),
    processes: [fpProc(FINISHING_PROCESS.IRONING, 3), fpProc(FINISHING_PROCESS.PACKING, 4)],
    approvalHistory: seedHistory(PROD_PO_STATUS.PENDING_APPROVAL),
    createdAt: '2026-06-08T09:05:00', updatedAt: '2026-06-08T09:05:00',
  },
];

// ─── Number generator ───────────────────────────────────────────────────────────
const counters = { CPO: 3, WO: 2, FPO: 2 };
export const genPoNumber = (prefix) => {
  counters[prefix] = (counters[prefix] || 0) + 1;
  return `${prefix}-2026-${String(counters[prefix]).padStart(4, '0')}`;
};

let idCounter = 1000;
export const nextId = () => ++idCounter;
export const nowIso = () => new Date().toISOString();
export const deepClone = (v) => JSON.parse(JSON.stringify(v));

// ─── List helpers (filter + paginate) ───────────────────────────────────────────
export const matchPoFilters = (po, { search, status, processingUnitType, buyer, dateFrom, dateTo, process, vendorId } = {}) => {
  if (status && po.status !== status) return false;
  if (processingUnitType && po.processingUnitType !== processingUnitType) return false;
  if (buyer && po.buyer !== buyer) return false;
  if (vendorId && po.vendorId !== vendorId) return false;
  if (process && !(po.processes || []).some((p) => p.processName === process)) return false;
  if (dateFrom || dateTo) {
    const d = po.plannedCutDate || po.plannedStartDate; // type's primary planning date
    if (!d) return false;
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
  }
  if (search) {
    const s = search.toLowerCase();
    const hay = [po.cuttingPoNo, po.workOrderNo, po.finishingPoNo, po.orderNo, po.styleNo, po.buyer]
      .filter(Boolean).join(' ').toLowerCase();
    if (!hay.includes(s)) return false;
  }
  return true;
};

export const paginate = (list, { page = 0, size = 10 } = {}) => {
  const start = page * size;
  return {
    content: list.slice(start, start + size),
    totalElements: list.length,
    totalPages: Math.ceil(list.length / size) || 0,
    number: page,
    size,
  };
};

// Build stock-availability rows for an order's BOM items of a given kind.
export const buildStockRows = (order, kind, { cadPerPc } = {}) => {
  const codes = order?.bomMaterials?.[kind] || [];
  const plannedQty = sumQty(order.items, 'plannedQty');
  return codes.map((code, idx) => {
    const m = MATERIAL_CATALOG[code];
    const bomRequired = +(m.bomPerPc * plannedQty).toFixed(2);
    const cadRequired = kind === 'fabric' && cadPerPc
      ? +(cadPerPc * plannedQty).toFixed(2)
      : bomRequired;
    const availableBalance = m.currentStock - m.allocated;
    return {
      key: `${code}-${idx}`, itemCode: code, itemName: m.itemName, uom: m.uom,
      bomRequired, cadRequired, currentStock: m.currentStock, allocated: m.allocated,
      availableBalance, shortageSurplus: +(availableBalance - cadRequired).toFixed(2),
      lastGrnAt: m.lastGrnAt,
    };
  });
};

// Build BOM-vs-CAD consumption comparison rows for an order's fabric items.
export const buildConsumptionRows = (order, cadPerPc) => {
  const codes = order?.bomMaterials?.fabric || [];
  const plannedQty = sumQty(order.items, 'plannedQty');
  return codes.map((code, idx) => {
    const m = MATERIAL_CATALOG[code];
    const bomPerPc = m.bomPerPc;
    const cad = idx === 0 && cadPerPc != null ? cadPerPc : +(bomPerPc * 1.02).toFixed(3);
    return { key: `${code}-${idx}`, itemCode: code, itemName: m.itemName, uom: m.uom, bomPerPc, cadPerPc: cad, plannedQty };
  });
};
