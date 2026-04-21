/**
 * Mock data for Opening Stock Balance — served when USE_MOCK_INVENTORY_DATA
 * is true in inventoryService.js. Lets the UI run end-to-end without the
 * erp-purchase backend.
 *
 * State lives at module scope so in-session mutations persist across calls
 * (create/update/post/cancel/finalize) and the UI behaves the way it would
 * against a live API. Reload the page to reset.
 */

// ─── Seed batches ─────────────────────────────────────────────────────────────
const seedFabricLines = [
  {
    id: 1001, itemId: 501, itemCode: 'FAB-KN-001', fabricDescription: 'Cotton Single Jersey',
    rollNumber: 'R-2024-001', width: 58, gsm: 160, shadeLot: 'LOT-A-01',
    quantity: 125.5, uomId: 1, uomSymbol: 'MTR', unitCost: 280, styleRef: 'STY-001',
  },
  {
    id: 1002, itemId: 501, itemCode: 'FAB-KN-001', fabricDescription: 'Cotton Single Jersey',
    rollNumber: 'R-2024-002', width: 58, gsm: 160, shadeLot: 'LOT-A-01',
    quantity: 118.75, uomId: 1, uomSymbol: 'MTR', unitCost: 280, styleRef: 'STY-001',
  },
  {
    id: 1003, itemId: 502, itemCode: 'FAB-WV-010', fabricDescription: 'Poplin Woven 120',
    rollNumber: 'R-2024-010', width: 60, gsm: 120, shadeLot: 'LOT-B-03',
    quantity: 95, uomId: 1, uomSymbol: 'MTR', unitCost: 195, styleRef: 'STY-002',
  },
];

const seedAccessoriesLines = [
  {
    id: 2001, itemId: 701, itemCode: 'BTN-001', description: 'Shirt Button 4-hole 20L',
    category: 'Buttons', size: 'M', color: 'Black',
    quantity: 2400, uomId: 2, uomSymbol: 'PCS', unitCost: 2.5, styleRef: 'STY-001',
  },
  {
    id: 2002, itemId: 701, itemCode: 'BTN-001', description: 'Shirt Button 4-hole 20L',
    category: 'Buttons', size: 'M', color: 'White',
    quantity: 1800, uomId: 2, uomSymbol: 'PCS', unitCost: 2.5, styleRef: 'STY-001',
  },
  {
    id: 2003, itemId: 702, itemCode: 'ZIP-005', description: 'Metal Zipper 18cm',
    category: 'Zippers', size: '18cm', color: 'Brass',
    quantity: 500, uomId: 2, uomSymbol: 'PCS', unitCost: 18.0, styleRef: 'STY-002',
  },
];

const totalsOf = (lines) => {
  let qty = 0, val = 0;
  (lines || []).forEach((l) => {
    const q = Number(l.quantity) || 0;
    const c = Number(l.unitCost) || 0;
    qty += q;
    val += q * c;
  });
  return { rows: (lines || []).length, qty, val };
};

const makeBatch = (overrides) => {
  const { rows, qty, val } = totalsOf(overrides.batchType === 'FABRIC'
    ? overrides.fabricLines
    : overrides.accessoriesLines);
  return {
    id: overrides.id,
    batchNumber: overrides.batchNumber,
    batchType: overrides.batchType,
    status: overrides.status,
    referenceDate: overrides.referenceDate,
    notes: overrides.notes ?? null,
    totalRows: rows,
    totalQuantity: qty,
    totalValue: val,
    postedAt: overrides.postedAt ?? null,
    postedBy: overrides.postedBy ?? null,
    postedByName: overrides.postedByName ?? null,
    createdAt: overrides.createdAt,
    createdBy: overrides.createdBy ?? 1,
    createdByName: overrides.createdByName ?? 'Admin User',
    updatedAt: overrides.updatedAt ?? overrides.createdAt,
    fabricLines: overrides.batchType === 'FABRIC' ? (overrides.fabricLines || []) : null,
    accessoriesLines: overrides.batchType === 'ACCESSORIES' ? (overrides.accessoriesLines || []) : null,
  };
};

// Module-scoped mutable state — survives across calls in a session.
let batches = [
  makeBatch({
    id: 1, batchNumber: 'OSB-FAB-0001', batchType: 'FABRIC', status: 'POSTED',
    referenceDate: '2026-04-18',
    notes: 'Main store — Rack A fabrics carried over from legacy system',
    fabricLines: seedFabricLines,
    postedAt: '2026-04-18T10:32:00', postedBy: 1, postedByName: 'Admin User',
    createdAt: '2026-04-18T09:15:00',
  }),
  makeBatch({
    id: 2, batchNumber: 'OSB-ACC-0001', batchType: 'ACCESSORIES', status: 'POSTED',
    referenceDate: '2026-04-18',
    notes: 'Accessories section — buttons, zippers, labels',
    accessoriesLines: seedAccessoriesLines,
    postedAt: '2026-04-18T14:05:00', postedBy: 1, postedByName: 'Admin User',
    createdAt: '2026-04-18T13:20:00',
  }),
  makeBatch({
    id: 3, batchNumber: 'OSB-FAB-0002', batchType: 'FABRIC', status: 'DRAFT',
    referenceDate: '2026-04-20',
    notes: 'Second floor stockroom — remaining rolls to enter',
    fabricLines: [
      {
        id: 1010, itemId: 503, itemCode: 'FAB-DN-020', fabricDescription: 'Denim 10oz',
        rollNumber: 'R-2024-050', width: 56, gsm: 340, shadeLot: 'LOT-D-01',
        quantity: 80, uomId: 1, uomSymbol: 'MTR', unitCost: 420, styleRef: 'STY-003',
      },
    ],
    createdAt: '2026-04-20T11:00:00', createdByName: 'Inventory Staff',
  }),
  makeBatch({
    id: 4, batchNumber: 'OSB-ACC-0002', batchType: 'ACCESSORIES', status: 'CANCELLED',
    referenceDate: '2026-04-19',
    notes: 'Duplicate entry — superseded by OSB-ACC-0001',
    accessoriesLines: [],
    createdAt: '2026-04-19T08:40:00', createdByName: 'Inventory Staff',
  }),
];

let nextId = 100;
let fabricSeq = 2;   // last-used fabric serial (OSB-FAB-0002)
let accSeq = 2;      // last-used accessories serial (OSB-ACC-0002)
let finalized = false;
let finalizedAt = null;
let finalizedBy = null;
let finalizedByName = null;

// ─── Accessors ────────────────────────────────────────────────────────────────
const clone = (x) => JSON.parse(JSON.stringify(x));

export const mockGetStatus = () => {
  const drafts = batches.filter((b) => b.status === 'DRAFT').length;
  const posted = batches.filter((b) => b.status === 'POSTED').length;
  const cancelled = batches.filter((b) => b.status === 'CANCELLED').length;
  return {
    finalized,
    finalizedAt,
    finalizedBy,
    finalizedByName,
    draftCount: drafts,
    postedCount: posted,
    cancelledCount: cancelled,
    canFinalize: !finalized && drafts === 0 && posted > 0,
  };
};

export const mockListBatches = ({ type, status, page = 0, size = 20 } = {}) => {
  let filtered = batches.slice();
  if (type)   filtered = filtered.filter((b) => b.batchType === type);
  if (status) filtered = filtered.filter((b) => b.status === status);
  filtered.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  const total = filtered.length;
  const from = page * size;
  const content = filtered.slice(from, from + size).map((b) => ({
    id: b.id,
    batchNumber: b.batchNumber,
    batchType: b.batchType,
    status: b.status,
    referenceDate: b.referenceDate,
    totalRows: b.totalRows,
    totalQuantity: b.totalQuantity,
    totalValue: b.totalValue,
    postedAt: b.postedAt,
    createdAt: b.createdAt,
    createdByName: b.createdByName,
  }));

  return {
    content,
    totalElements: total,
    totalPages: Math.ceil(total / size),
    pageNumber: page,
    pageSize: size,
    first: page === 0,
    last: from + size >= total,
  };
};

export const mockGetBatch = (id) => {
  const b = batches.find((x) => String(x.id) === String(id));
  if (!b) throw new Error(`Opening stock batch ${id} not found`);
  return clone(b);
};

const nextBatchNumber = (type) => {
  if (type === 'FABRIC') {
    fabricSeq += 1;
    return `OSB-FAB-${String(fabricSeq).padStart(4, '0')}`;
  }
  accSeq += 1;
  return `OSB-ACC-${String(accSeq).padStart(4, '0')}`;
};

const guardUnlocked = () => {
  if (finalized) {
    const err = new Error('Opening Stock has been finalized. No further batches can be created or posted.');
    err.response = { data: { message: err.message }, status: 409 };
    throw err;
  }
};

export const mockCreateBatch = (payload) => {
  guardUnlocked();
  const id = ++nextId;
  const now = new Date().toISOString().replace('Z', '');
  const lines = payload.batchType === 'FABRIC'
    ? (payload.fabricLines || []).map((l, i) => ({ ...l, id: (id * 100) + i }))
    : (payload.accessoriesLines || []).map((l, i) => ({ ...l, id: (id * 100) + i }));

  const batch = makeBatch({
    id,
    batchNumber: nextBatchNumber(payload.batchType),
    batchType: payload.batchType,
    status: 'DRAFT',
    referenceDate: payload.referenceDate,
    notes: payload.notes,
    fabricLines: payload.batchType === 'FABRIC' ? lines : null,
    accessoriesLines: payload.batchType === 'ACCESSORIES' ? lines : null,
    createdAt: now,
    createdByName: 'Current User',
  });
  batches.push(batch);
  return clone(batch);
};

export const mockUpdateBatch = (id, payload) => {
  guardUnlocked();
  const idx = batches.findIndex((x) => String(x.id) === String(id));
  if (idx < 0) throw new Error(`Batch ${id} not found`);
  const existing = batches[idx];
  if (existing.status !== 'DRAFT') {
    const err = new Error(`Only DRAFT batches can be edited (current: ${existing.status})`);
    err.response = { data: { message: err.message }, status: 409 };
    throw err;
  }
  const lines = existing.batchType === 'FABRIC'
    ? (payload.fabricLines || []).map((l, i) => ({ ...l, id: l.id || (id * 100) + i }))
    : (payload.accessoriesLines || []).map((l, i) => ({ ...l, id: l.id || (id * 100) + i }));
  const updated = makeBatch({
    ...existing,
    referenceDate: payload.referenceDate || existing.referenceDate,
    notes: payload.notes !== undefined ? payload.notes : existing.notes,
    fabricLines: existing.batchType === 'FABRIC' ? lines : null,
    accessoriesLines: existing.batchType === 'ACCESSORIES' ? lines : null,
    updatedAt: new Date().toISOString().replace('Z', ''),
  });
  batches[idx] = updated;
  return clone(updated);
};

export const mockPostBatch = (id) => {
  guardUnlocked();
  const idx = batches.findIndex((x) => String(x.id) === String(id));
  if (idx < 0) throw new Error(`Batch ${id} not found`);
  const existing = batches[idx];
  if (existing.status !== 'DRAFT') {
    const err = new Error(`Only DRAFT batches can be posted (current: ${existing.status})`);
    err.response = { data: { message: err.message }, status: 409 };
    throw err;
  }
  const lines = existing.batchType === 'FABRIC' ? existing.fabricLines : existing.accessoriesLines;
  if (!lines || lines.length === 0) {
    const err = new Error('Batch has no lines to post.');
    err.response = { data: { message: err.message }, status: 400 };
    throw err;
  }
  const now = new Date().toISOString().replace('Z', '');
  const posted = {
    ...existing,
    status: 'POSTED',
    postedAt: now,
    postedBy: 1,
    postedByName: 'Current User',
  };
  batches[idx] = posted;
  return clone(posted);
};

export const mockCancelBatch = (id) => {
  const idx = batches.findIndex((x) => String(x.id) === String(id));
  if (idx < 0) throw new Error(`Batch ${id} not found`);
  const existing = batches[idx];
  if (existing.status !== 'DRAFT') {
    const err = new Error(`Only DRAFT batches can be cancelled (current: ${existing.status})`);
    err.response = { data: { message: err.message }, status: 409 };
    throw err;
  }
  const cancelled = { ...existing, status: 'CANCELLED' };
  batches[idx] = cancelled;
  return clone(cancelled);
};

export const mockFinalize = () => {
  if (finalized) {
    const err = new Error('Opening Stock is already finalized.');
    err.response = { data: { message: err.message }, status: 409 };
    throw err;
  }
  const drafts = batches.filter((b) => b.status === 'DRAFT').length;
  const posted = batches.filter((b) => b.status === 'POSTED').length;
  if (drafts > 0) {
    const err = new Error(`Cleanup required: ${drafts} draft batch(es) must be posted or cancelled before finalizing.`);
    err.response = { data: { message: err.message }, status: 423 };
    throw err;
  }
  if (posted === 0) {
    const err = new Error('At least one posted batch is required before finalizing opening stock.');
    err.response = { data: { message: err.message }, status: 400 };
    throw err;
  }
  finalized = true;
  finalizedAt = new Date().toISOString().replace('Z', '');
  finalizedBy = 1;
  finalizedByName = 'Current User';
  return mockGetStatus();
};

// ─── CSV helpers (mock) ───────────────────────────────────────────────────────
export const mockDownloadCsvTemplate = (type) => {
  const rows = type === 'FABRIC'
    ? [
        'itemCode,rollNumber,width,gsm,shadeLot,quantity,uom,unitCost,styleRef,remarks',
        'FAB-001,R-2024-001,58,160,LOT-01,25.5,MTR,450.00,,Example row',
      ]
    : [
        'itemCode,size,color,quantity,uom,unitCost,styleRef,remarks',
        'BTN-001,M,Black,120,PCS,2.50,,Example row',
      ];
  return new Blob([rows.join('\r\n') + '\r\n'], { type: 'text/csv' });
};

export const mockParseCsv = (file, type) => {
  // Minimal fake: returns 3 valid rows with no errors.
  const lines = type === 'FABRIC'
    ? [
        { itemId: 501, itemCode: 'FAB-KN-001', rollNumber: 'R-CSV-001', width: 58, gsm: 160,
          quantity: 50, uomId: 1, uomSymbol: 'MTR', unitCost: 280 },
        { itemId: 501, itemCode: 'FAB-KN-001', rollNumber: 'R-CSV-002', width: 58, gsm: 160,
          quantity: 45.5, uomId: 1, uomSymbol: 'MTR', unitCost: 280 },
        { itemId: 502, itemCode: 'FAB-WV-010', rollNumber: 'R-CSV-003', width: 60, gsm: 120,
          quantity: 60, uomId: 1, uomSymbol: 'MTR', unitCost: 195 },
      ]
    : [
        { itemId: 701, itemCode: 'BTN-001', size: 'L', color: 'Navy',
          quantity: 500, uomId: 2, uomSymbol: 'PCS', unitCost: 2.5 },
        { itemId: 701, itemCode: 'BTN-001', size: 'L', color: 'Grey',
          quantity: 750, uomId: 2, uomSymbol: 'PCS', unitCost: 2.5 },
        { itemId: 702, itemCode: 'ZIP-005', size: '20cm', color: 'Silver',
          quantity: 200, uomId: 2, uomSymbol: 'PCS', unitCost: 22 },
      ];
  return {
    totalRows: lines.length,
    validRows: lines.length,
    errorRows: 0,
    fabricLines: type === 'FABRIC' ? lines : [],
    accessoriesLines: type === 'ACCESSORIES' ? lines : [],
    errors: [],
  };
};
