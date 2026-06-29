/**
 * Mock data for Return to Supplier & Debit Note (CRD_INV_004) — served when
 * USE_MOCK_RETURN_TO_SUPPLIER_DATA is true in returnToSupplierService.js.
 * Lets the UI run end-to-end without the erp-purchase backend.
 *
 * State lives at module scope so in-session mutations persist across calls:
 *   - createReturn → generates return # + debit note # + removes items from
 *     the pending list + appends to history
 *   - Subsequent reads reflect all prior saves
 *
 * Reload the page to reset.
 */

import dayjs from 'dayjs';
import { getCurrentUser } from '../../utils/permissions';

// ─── Counters ────────────────────────────────────────────────────────────────
const fy = () => {
  const now = dayjs();
  const month = now.month() + 1;
  const yy = now.year() % 100;
  const start = month >= 4 ? yy : yy - 1;
  const end = start + 1;
  return `${String(start).padStart(2, '0')}-${String(end).padStart(2, '0')}`;
};

let returnCounter = 1004; // next: 1005
let debitCounter = 1002;  // next: 1003
let returnIdCounter = 104;
let debitIdCounter = 102;

const nextReturnNumber = () => `RDC/${fy()}/${String(++returnCounter).padStart(4, '0')}`;
const nextDebitNumber = () => `DBN/${fy()}/${String(++debitCounter).padStart(4, '0')}`;

// ─── Seed: POs with pending returns ──────────────────────────────────────────
const seedFabricPOs = [
  {
    poId: 101, poNumber: 'PO/25-26/1012', poDate: '2026-03-10',
    supplierId: 11, supplierName: 'Sri Krishna Fabric Mills',
    grnRef: 'GRN/25-26/1041, GRN/25-26/1043', pendingItemCount: 3,
  },
  {
    poId: 102, poNumber: 'PO/25-26/1018', poDate: '2026-03-22',
    supplierId: 12, supplierName: 'Arvind Textile Hub',
    grnRef: 'GRN/25-26/1044', pendingItemCount: 2,
  },
];

const seedAccessoriesPOs = [
  {
    poId: 201, poNumber: 'PO/25-26/1031', poDate: '2026-04-02',
    supplierId: 21, supplierName: 'Trims World Pvt Ltd',
    grnRef: 'GRN/25-26/1052', pendingItemCount: 2,
  },
  {
    poId: 202, poNumber: 'PO/25-26/1035', poDate: '2026-04-12',
    supplierId: 22, supplierName: 'Ashok Buttons & Accessories',
    grnRef: 'GRN/25-26/1055', pendingItemCount: 1,
  },
];

// ─── Seed: pending rejected items ────────────────────────────────────────────
// Keyed by poId so pendingItems lookup is O(1). Each row matches the shape of
// PendingReturnItemResponse on the API.
const pendingFabricByPo = {
  101: [
    {
      qcRollId: 9001, qcId: 7001, qcNumber: 'QC/25-26/1018',
      grnId: 5041, grnNumber: 'GRN/25-26/1041', grnDate: '2026-03-15',
      poLineItemId: 301, itemCode: 'FAB-CJ-180-BLK',
      description: 'Cotton Jersey 180 GSM — Black',
      rollNumber: 'R-0022', rejectedQty: 49.000, uom: 'MTR',
      unitPrice: 300.00, sgstPercent: 2.5, cgstPercent: 2.5, igstPercent: 0,
      rejectionReason: 'GSM out of tolerance',
    },
    {
      qcRollId: 9002, qcId: 7001, qcNumber: 'QC/25-26/1018',
      grnId: 5041, grnNumber: 'GRN/25-26/1041', grnDate: '2026-03-15',
      poLineItemId: 301, itemCode: 'FAB-CJ-180-BLK',
      description: 'Cotton Jersey 180 GSM — Black',
      rollNumber: 'R-0025', rejectedQty: 51.500, uom: 'MTR',
      unitPrice: 300.00, sgstPercent: 2.5, cgstPercent: 2.5, igstPercent: 0,
      rejectionReason: '4-Pt score exceeded threshold',
    },
    {
      qcRollId: 9003, qcId: 7003, qcNumber: 'QC/25-26/1021',
      grnId: 5043, grnNumber: 'GRN/25-26/1043', grnDate: '2026-03-20',
      poLineItemId: 302, itemCode: 'FAB-PT-220-NVY',
      description: 'Polyester Twill 220 GSM — Navy',
      rollNumber: 'R-0031', rejectedQty: 38.000, uom: 'MTR',
      unitPrice: 275.00, sgstPercent: 2.5, cgstPercent: 2.5, igstPercent: 0,
      rejectionReason: 'Width out of tolerance',
    },
  ],
  102: [
    {
      qcRollId: 9010, qcId: 7008, qcNumber: 'QC/25-26/1025',
      grnId: 5044, grnNumber: 'GRN/25-26/1044', grnDate: '2026-03-25',
      poLineItemId: 305, itemCode: 'FAB-LN-160-WHT',
      description: 'Linen 160 GSM — White',
      rollNumber: 'R-0044', rejectedQty: 72.200, uom: 'MTR',
      unitPrice: 420.00, sgstPercent: 6, cgstPercent: 6, igstPercent: 0,
      rejectionReason: 'Shade variation beyond swatch',
    },
    {
      qcRollId: 9011, qcId: 7008, qcNumber: 'QC/25-26/1025',
      grnId: 5044, grnNumber: 'GRN/25-26/1044', grnDate: '2026-03-25',
      poLineItemId: 305, itemCode: 'FAB-LN-160-WHT',
      description: 'Linen 160 GSM — White',
      rollNumber: 'R-0045', rejectedQty: 68.800, uom: 'MTR',
      unitPrice: 420.00, sgstPercent: 6, cgstPercent: 6, igstPercent: 0,
      rejectionReason: 'Slub defect visible',
    },
  ],
};

const pendingAccessoriesByPo = {
  201: [
    {
      qcCriteriaId: 9101, qcId: 7102, qcNumber: 'QC/25-26/1042',
      grnId: 5052, grnNumber: 'GRN/25-26/1052', grnDate: '2026-04-05',
      grnLineItemId: 6201, poLineItemId: 401,
      itemCode: 'LBL-SZ-NW', description: 'Size Label — NW',
      size: 'Mixed', color: '—',
      rejectedQty: 2216.000, uom: 'PCS',
      unitPrice: 1.20, sgstPercent: 9, cgstPercent: 9, igstPercent: 0,
      rejectionReason: 'Print quality below spec',
    },
    {
      qcCriteriaId: 9102, qcId: 7102, qcNumber: 'QC/25-26/1042',
      grnId: 5052, grnNumber: 'GRN/25-26/1052', grnDate: '2026-04-05',
      grnLineItemId: 6202, poLineItemId: 402,
      itemCode: 'LBL-CR', description: 'Care Label',
      size: 'Mixed', color: '—',
      rejectedQty: 750.000, uom: 'PCS',
      unitPrice: 0.90, sgstPercent: 9, cgstPercent: 9, igstPercent: 0,
      rejectionReason: 'Wrong composition text',
    },
  ],
  202: [
    {
      qcCriteriaId: 9110, qcId: 7108, qcNumber: 'QC/25-26/1048',
      grnId: 5055, grnNumber: 'GRN/25-26/1055', grnDate: '2026-04-14',
      grnLineItemId: 6210, poLineItemId: 410,
      itemCode: 'BTN-20L-BLK', description: 'Shirt Button 4-hole 20L — Black',
      size: '20L', color: 'Black',
      rejectedQty: 1800.000, uom: 'PCS',
      unitPrice: 2.50, sgstPercent: 9, cgstPercent: 9, igstPercent: 0,
      rejectionReason: 'Rim chipping on ~12% sample',
    },
  ],
};

// Clone helpers so mutations in mockCreateReturn don't leak into seeds
const cloneList = (list) => list.map((x) => ({ ...x }));
const cloneMap = (m) => {
  const out = {};
  Object.keys(m).forEach((k) => { out[k] = cloneList(m[k]); });
  return out;
};

let fabricPOs = cloneList(seedFabricPOs);
let accessoriesPOs = cloneList(seedAccessoriesPOs);
let pendingFabric = cloneMap(pendingFabricByPo);
let pendingAccessories = cloneMap(pendingAccessoriesByPo);

// ─── Seed: return history ────────────────────────────────────────────────────
const today = (n = 0) => dayjs().subtract(n, 'day').format('YYYY-MM-DD');

const seedHistory = [
  {
    id: 101, returnNumber: 'RDC/25-26/1001', returnType: 'FABRIC',
    returnDate: today(12),
    poId: 101, poNumber: 'PO/25-26/1012', poDate: '2026-03-10',
    supplierId: 11, supplierName: 'Sri Krishna Fabric Mills',
    grnRef: 'GRN/25-26/1041',
    preparedBy: 1, preparedByName: 'Ranjith Kumar',
    remarks: 'First rejection batch from March GRN',
    subtotal: 10050.00, taxTotal: 502.50, grandTotal: 10552.50,
    status: 'COMPLETED',
    createdAt: dayjs().subtract(12, 'day').toISOString(),
    updatedAt: dayjs().subtract(12, 'day').toISOString(),
    items: [
      {
        id: 1, qcId: 7001, qcRollId: 8001, qcCriteriaId: null,
        poLineItemId: 301, grnLineItemId: 6101, grnRollId: 7501,
        qcNumber: 'QC/25-26/1014', grnNumber: 'GRN/25-26/1041',
        itemCode: 'FAB-CJ-180-BLK', description: 'Cotton Jersey 180 GSM — Black',
        rollNumber: 'R-0015', size: null, color: null,
        rejectedQty: 33.500, uom: 'MTR',
        unitPrice: 300.00, sgstPercent: 2.5, cgstPercent: 2.5, igstPercent: 0,
        lineValue: 10050.00, taxValue: 502.50, totalAmount: 10552.50,
        rejectionReason: 'GSM out of tolerance',
      },
    ],
    debitNote: {
      id: 101, debitNoteNumber: 'DBN/25-26/1001',
      debitNoteDate: today(12),
      returnId: 101, returnNumber: 'RDC/25-26/1001',
      poId: 101, poNumber: 'PO/25-26/1012',
      supplierId: 11, supplierName: 'Sri Krishna Fabric Mills',
      subtotal: 10050.00, taxTotal: 502.50, grandTotal: 10552.50,
      status: 'RAISED',
      createdAt: dayjs().subtract(12, 'day').toISOString(),
      updatedAt: dayjs().subtract(12, 'day').toISOString(),
      items: [
        {
          id: 1, returnItemId: 1, poLineItemId: 301,
          itemCode: 'FAB-CJ-180-BLK', description: 'Cotton Jersey 180 GSM — Black',
          rollNumber: 'R-0015', size: null, color: null,
          qty: 33.500, uom: 'MTR',
          unitPrice: 300.00, sgstPercent: 2.5, cgstPercent: 2.5, igstPercent: 0,
          lineValue: 10050.00, taxValue: 502.50, totalAmount: 10552.50,
        },
      ],
    },
  },
  {
    id: 102, returnNumber: 'RDC/25-26/1002', returnType: 'ACCESSORIES',
    returnDate: today(7),
    poId: 202, poNumber: 'PO/25-26/1035', poDate: '2026-04-12',
    supplierId: 22, supplierName: 'Ashok Buttons & Accessories',
    grnRef: 'GRN/25-26/1055',
    preparedBy: 1, preparedByName: 'Ranjith Kumar',
    remarks: null,
    subtotal: 1500.00, taxTotal: 270.00, grandTotal: 1770.00,
    status: 'COMPLETED',
    createdAt: dayjs().subtract(7, 'day').toISOString(),
    updatedAt: dayjs().subtract(7, 'day').toISOString(),
    items: [
      {
        id: 2, qcId: 7108, qcRollId: null, qcCriteriaId: 8010,
        poLineItemId: 410, grnLineItemId: 6210, grnRollId: null,
        qcNumber: 'QC/25-26/1045', grnNumber: 'GRN/25-26/1055',
        itemCode: 'BTN-20L-WHT', description: 'Shirt Button 4-hole 20L — White',
        rollNumber: null, size: '20L', color: 'White',
        rejectedQty: 600.000, uom: 'PCS',
        unitPrice: 2.50, sgstPercent: 9, cgstPercent: 9, igstPercent: 0,
        lineValue: 1500.00, taxValue: 270.00, totalAmount: 1770.00,
        rejectionReason: 'Colour shade mismatch',
      },
    ],
    debitNote: {
      id: 102, debitNoteNumber: 'DBN/25-26/1002',
      debitNoteDate: today(7),
      returnId: 102, returnNumber: 'RDC/25-26/1002',
      poId: 202, poNumber: 'PO/25-26/1035',
      supplierId: 22, supplierName: 'Ashok Buttons & Accessories',
      subtotal: 1500.00, taxTotal: 270.00, grandTotal: 1770.00,
      status: 'RAISED',
      createdAt: dayjs().subtract(7, 'day').toISOString(),
      updatedAt: dayjs().subtract(7, 'day').toISOString(),
      items: [
        {
          id: 2, returnItemId: 2, poLineItemId: 410,
          itemCode: 'BTN-20L-WHT', description: 'Shirt Button 4-hole 20L — White',
          rollNumber: null, size: '20L', color: 'White',
          qty: 600.000, uom: 'PCS',
          unitPrice: 2.50, sgstPercent: 9, cgstPercent: 9, igstPercent: 0,
          lineValue: 1500.00, taxValue: 270.00, totalAmount: 1770.00,
        },
      ],
    },
  },
  {
    id: 103, returnNumber: 'RDC/25-26/1003', returnType: 'FABRIC',
    returnDate: today(3),
    poId: 102, poNumber: 'PO/25-26/1018', poDate: '2026-03-22',
    supplierId: 12, supplierName: 'Arvind Textile Hub',
    grnRef: 'GRN/25-26/1044',
    preparedBy: 1, preparedByName: 'Ranjith Kumar',
    remarks: 'Shade batch rejected after buyer comment',
    subtotal: 9240.00, taxTotal: 1108.80, grandTotal: 10348.80,
    status: 'COMPLETED',
    createdAt: dayjs().subtract(3, 'day').toISOString(),
    updatedAt: dayjs().subtract(3, 'day').toISOString(),
    items: [
      {
        id: 3, qcId: 7008, qcRollId: 8020, qcCriteriaId: null,
        poLineItemId: 305, grnLineItemId: 6150, grnRollId: 7540,
        qcNumber: 'QC/25-26/1022', grnNumber: 'GRN/25-26/1044',
        itemCode: 'FAB-LN-160-WHT', description: 'Linen 160 GSM — White',
        rollNumber: 'R-0040', size: null, color: null,
        rejectedQty: 22.000, uom: 'MTR',
        unitPrice: 420.00, sgstPercent: 6, cgstPercent: 6, igstPercent: 0,
        lineValue: 9240.00, taxValue: 1108.80, totalAmount: 10348.80,
        rejectionReason: 'Hole in middle of roll',
      },
    ],
    debitNote: {
      id: 103, debitNoteNumber: 'DBN/25-26/1003',
      debitNoteDate: today(3),
      returnId: 103, returnNumber: 'RDC/25-26/1003',
      poId: 102, poNumber: 'PO/25-26/1018',
      supplierId: 12, supplierName: 'Arvind Textile Hub',
      subtotal: 9240.00, taxTotal: 1108.80, grandTotal: 10348.80,
      status: 'RAISED',
      createdAt: dayjs().subtract(3, 'day').toISOString(),
      updatedAt: dayjs().subtract(3, 'day').toISOString(),
      items: [
        {
          id: 3, returnItemId: 3, poLineItemId: 305,
          itemCode: 'FAB-LN-160-WHT', description: 'Linen 160 GSM — White',
          rollNumber: 'R-0040', size: null, color: null,
          qty: 22.000, uom: 'MTR',
          unitPrice: 420.00, sgstPercent: 6, cgstPercent: 6, igstPercent: 0,
          lineValue: 9240.00, taxValue: 1108.80, totalAmount: 10348.80,
        },
      ],
    },
  },
  {
    id: 104, returnNumber: 'RDC/25-26/1004', returnType: 'ACCESSORIES',
    returnDate: today(1),
    poId: 201, poNumber: 'PO/25-26/1031', poDate: '2026-04-02',
    supplierId: 21, supplierName: 'Trims World Pvt Ltd',
    grnRef: 'GRN/25-26/1052',
    preparedBy: 1, preparedByName: 'Ranjith Kumar',
    remarks: null,
    subtotal: 3000.00, taxTotal: 540.00, grandTotal: 3540.00,
    status: 'COMPLETED',
    createdAt: dayjs().subtract(1, 'day').toISOString(),
    updatedAt: dayjs().subtract(1, 'day').toISOString(),
    items: [
      {
        id: 4, qcId: 7105, qcRollId: null, qcCriteriaId: 8050,
        poLineItemId: 405, grnLineItemId: 6205, grnRollId: null,
        qcNumber: 'QC/25-26/1043', grnNumber: 'GRN/25-26/1052',
        itemCode: 'ZIP-18CM-BR', description: 'Metal Zipper 18 cm — Brass',
        rollNumber: null, size: '18CM', color: 'Brass',
        rejectedQty: 150.000, uom: 'PCS',
        unitPrice: 20.00, sgstPercent: 9, cgstPercent: 9, igstPercent: 0,
        lineValue: 3000.00, taxValue: 540.00, totalAmount: 3540.00,
        rejectionReason: 'Slider stuck on 40% sample',
      },
    ],
    debitNote: {
      id: 104, debitNoteNumber: 'DBN/25-26/1004',
      debitNoteDate: today(1),
      returnId: 104, returnNumber: 'RDC/25-26/1004',
      poId: 201, poNumber: 'PO/25-26/1031',
      supplierId: 21, supplierName: 'Trims World Pvt Ltd',
      subtotal: 3000.00, taxTotal: 540.00, grandTotal: 3540.00,
      status: 'RAISED',
      createdAt: dayjs().subtract(1, 'day').toISOString(),
      updatedAt: dayjs().subtract(1, 'day').toISOString(),
      items: [
        {
          id: 4, returnItemId: 4, poLineItemId: 405,
          itemCode: 'ZIP-18CM-BR', description: 'Metal Zipper 18 cm — Brass',
          rollNumber: null, size: '18CM', color: 'Brass',
          qty: 150.000, uom: 'PCS',
          unitPrice: 20.00, sgstPercent: 9, cgstPercent: 9, igstPercent: 0,
          lineValue: 3000.00, taxValue: 540.00, totalAmount: 3540.00,
        },
      ],
    },
  },
];

let history = seedHistory.map((r) => JSON.parse(JSON.stringify(r)));

// ─── Mock API implementations ────────────────────────────────────────────────

export const mockListPOsWithPendingReturns = (type) => {
  const pool = type === 'FABRIC' ? fabricPOs : accessoriesPOs;
  // Recompute pending counts from current state
  const pendingMap = type === 'FABRIC' ? pendingFabric : pendingAccessories;
  return pool
    .map((p) => ({ ...p, pendingItemCount: (pendingMap[p.poId] || []).length }))
    .filter((p) => p.pendingItemCount > 0);
};

export const mockGetPendingItems = (poId, type) => {
  const src = type === 'FABRIC' ? pendingFabric : pendingAccessories;
  return (src[poId] || []).map((x) => ({ ...x }));
};

export const mockSearchReturns = (criteria = {}) => {
  const {
    page = 0, size = 20, returnType, poId, supplierId, returnNumber,
    fromDate, toDate,
  } = criteria;

  let filtered = history.slice();
  if (returnType) filtered = filtered.filter((r) => r.returnType === returnType);
  if (poId) filtered = filtered.filter((r) => r.poId === Number(poId));
  if (supplierId) filtered = filtered.filter((r) => r.supplierId === Number(supplierId));
  if (returnNumber) {
    const q = String(returnNumber).toLowerCase();
    filtered = filtered.filter((r) => r.returnNumber.toLowerCase().includes(q));
  }
  if (fromDate) filtered = filtered.filter((r) => r.returnDate >= fromDate);
  if (toDate) filtered = filtered.filter((r) => r.returnDate <= toDate);

  // Most recent first
  filtered.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const start = page * size;
  const content = filtered.slice(start, start + size);
  return {
    content,
    totalElements: filtered.length,
    totalPages: Math.max(1, Math.ceil(filtered.length / size)),
    number: page,
    size,
  };
};

export const mockGetReturnById = (id) => {
  const found = history.find((r) => r.id === Number(id));
  if (!found) throw new Error(`Return not found: ${id}`);
  return JSON.parse(JSON.stringify(found));
};

export const mockSearchDebitNotes = (criteria = {}) => {
  const {
    page = 0, size = 20, poId, supplierId, debitNoteNumber, fromDate, toDate,
  } = criteria;

  let filtered = history
    .map((r) => r.debitNote)
    .filter(Boolean);
  if (poId) filtered = filtered.filter((d) => d.poId === Number(poId));
  if (supplierId) filtered = filtered.filter((d) => d.supplierId === Number(supplierId));
  if (debitNoteNumber) {
    const q = String(debitNoteNumber).toLowerCase();
    filtered = filtered.filter((d) => d.debitNoteNumber.toLowerCase().includes(q));
  }
  if (fromDate) filtered = filtered.filter((d) => d.debitNoteDate >= fromDate);
  if (toDate) filtered = filtered.filter((d) => d.debitNoteDate <= toDate);

  filtered.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const start = page * size;
  return {
    content: filtered.slice(start, start + size),
    totalElements: filtered.length,
    totalPages: Math.max(1, Math.ceil(filtered.length / size)),
    number: page,
    size,
  };
};

export const mockGetDebitNoteById = (id) => {
  const found = history.find((r) => r.debitNote?.id === Number(id))?.debitNote;
  if (!found) throw new Error(`Debit Note not found: ${id}`);
  return { ...found };
};

export const mockGetDebitNoteByReturnId = (returnId) => {
  const found = history.find((r) => r.id === Number(returnId))?.debitNote;
  return found ? { ...found } : null;
};

export const mockCreateReturn = (payload) => {
  const {
    returnType, poId, returnDate, remarks, items: selections,
  } = payload;

  if (!selections || selections.length === 0) {
    throw new Error('At least one item must be selected');
  }

  const poPool = returnType === 'FABRIC' ? fabricPOs : accessoriesPOs;
  const po = poPool.find((p) => p.poId === Number(poId));
  if (!po) throw new Error(`PO not found: ${poId}`);

  const pendingMap = returnType === 'FABRIC' ? pendingFabric : pendingAccessories;
  const pending = pendingMap[poId] || [];

  const keyOf = (x) => returnType === 'FABRIC' ? `roll-${x.qcRollId}` : `crit-${x.qcCriteriaId}`;
  const selectedKeys = new Set(selections.map((s) => keyOf(s)));
  const chosen = pending.filter((p) => selectedKeys.has(keyOf(p)));
  if (chosen.length !== selections.length) {
    throw new Error('One or more selected items could not be found in the pending list');
  }

  // Build items with snapshotted values
  let nextItemId = 1000 + history.length * 10;
  const items = chosen.map((src) => {
    const qty = Number(src.rejectedQty || 0);
    const rate = Number(src.unitPrice || 0);
    const sgst = Number(src.sgstPercent || 0);
    const cgst = Number(src.cgstPercent || 0);
    const igst = Number(src.igstPercent || 0);
    const lineValue = +(qty * rate).toFixed(2);
    const taxValue = +(lineValue * (sgst + cgst + igst) / 100).toFixed(2);
    const totalAmount = +(lineValue + taxValue).toFixed(2);
    return {
      id: ++nextItemId,
      qcId: src.qcId,
      qcRollId: src.qcRollId || null,
      qcCriteriaId: src.qcCriteriaId || null,
      poLineItemId: src.poLineItemId,
      grnLineItemId: src.grnLineItemId || null,
      grnRollId: src.grnRollId || null,
      qcNumber: src.qcNumber, grnNumber: src.grnNumber,
      itemCode: src.itemCode, description: src.description,
      rollNumber: src.rollNumber || null,
      size: src.size || null, color: src.color || null,
      rejectedQty: qty, uom: src.uom,
      unitPrice: rate,
      sgstPercent: sgst, cgstPercent: cgst, igstPercent: igst,
      lineValue, taxValue, totalAmount,
      rejectionReason: src.rejectionReason,
    };
  });

  const subtotal = +items.reduce((s, i) => s + i.lineValue, 0).toFixed(2);
  const taxTotal = +items.reduce((s, i) => s + i.taxValue, 0).toFixed(2);
  const grandTotal = +(subtotal + taxTotal).toFixed(2);

  const grnRef = [...new Set(items.map((i) => i.grnNumber).filter(Boolean))].join(', ');
  const returnNumber = nextReturnNumber();
  const debitNoteNumber = nextDebitNumber();
  const now = new Date().toISOString();
  const returnId = ++returnIdCounter;
  const debitNoteId = ++debitIdCounter;

  const debitNote = {
    id: debitNoteId, debitNoteNumber,
    debitNoteDate: returnDate,
    returnId, returnNumber,
    poId: po.poId, poNumber: po.poNumber,
    supplierId: po.supplierId, supplierName: po.supplierName,
    subtotal, taxTotal, grandTotal,
    status: 'RAISED',
    createdAt: now, updatedAt: now,
    items: items.map((i) => ({
      id: i.id + 5000, returnItemId: i.id, poLineItemId: i.poLineItemId,
      itemCode: i.itemCode, description: i.description,
      rollNumber: i.rollNumber, size: i.size, color: i.color,
      qty: i.rejectedQty, uom: i.uom,
      unitPrice: i.unitPrice,
      sgstPercent: i.sgstPercent, cgstPercent: i.cgstPercent, igstPercent: i.igstPercent,
      lineValue: i.lineValue, taxValue: i.taxValue, totalAmount: i.totalAmount,
    })),
  };

  // Pull preparer from the logged-in session so the mock mirrors what the real
  // API does (SecurityContext → sys_users.name snapshot). Falls back to a
  // placeholder when no session is active (e.g., reset scenarios).
  const sessionUser = getCurrentUser() || {};
  const preparedBy = sessionUser.id || null;
  const preparedByName = sessionUser.name || sessionUser.username || '—';

  const record = {
    id: returnId, returnNumber, returnType,
    returnDate,
    poId: po.poId, poNumber: po.poNumber, poDate: po.poDate,
    supplierId: po.supplierId, supplierName: po.supplierName,
    grnRef,
    preparedBy, preparedByName,
    remarks: remarks || null,
    subtotal, taxTotal, grandTotal,
    status: 'COMPLETED',
    createdAt: now, updatedAt: now,
    items, debitNote,
  };

  history.push(record);

  // Mark items as returned in-session (remove from pending pool)
  pendingMap[poId] = pending.filter((p) => !selectedKeys.has(keyOf(p)));
  // If the PO has no more pending items, drop it from the dropdown pool
  if (pendingMap[poId].length === 0) {
    if (returnType === 'FABRIC') {
      fabricPOs = fabricPOs.filter((p) => p.poId !== po.poId);
    } else {
      accessoriesPOs = accessoriesPOs.filter((p) => p.poId !== po.poId);
    }
  }

  return JSON.parse(JSON.stringify(record));
};

// ─── Reset (for tests) ───────────────────────────────────────────────────────
export const __resetMockState = () => {
  returnCounter = 1004;
  debitCounter = 1002;
  returnIdCounter = 104;
  debitIdCounter = 102;
  fabricPOs = cloneList(seedFabricPOs);
  accessoriesPOs = cloneList(seedAccessoriesPOs);
  pendingFabric = cloneMap(pendingFabricByPo);
  pendingAccessories = cloneMap(pendingAccessoriesByPo);
  history = seedHistory.map((r) => JSON.parse(JSON.stringify(r)));
};
