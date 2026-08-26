/**
 * Mock Sample Purchase Orders (PRD v3 §11). This phase keeps them INSIDE the
 * SR store — chips, drawer and counters are fully functional — while the real
 * integration (a PO-module record with po_type='SAMPLE' + sr link, normal GRN
 * flow) is an API-phase contract. The existing PO module is untouched.
 */
import { loadDb, saveDb, nextSamplePoNo } from './srMockStore';
import { fail, pushActivity, currentUserName, todayStr } from './srMockApi';
import { SR_STATUS } from '../../utils/sampleRequestConstants';

const delay = (ms = 150) => new Promise((r) => setTimeout(r, ms));
const clone = (v) => JSON.parse(JSON.stringify(v));

// PO may be raised from Draft up to and including Dispatched (PRD §11.1);
// withdrawn once the sample has been assessed.
const PO_WINDOW = [SR_STATUS.DRAFT, SR_STATUS.SUBMITTED, SR_STATUS.IN_PRODUCTION, SR_STATUS.DISPATCHED];

export const canRaisePo = (status) => PO_WINDOW.includes(status);

export const createSamplePo = async (srId, dto) => {
  await delay();
  const db = loadDb();
  const sr = db.requests.find((r) => r.id === Number(srId));
  if (!sr) fail('NOT_FOUND', `Sample request ${srId} not found`);
  if (!canRaisePo(sr.status)) {
    fail('CONFLICT', 'A PO can be raised only up to Dispatched — this sample has already been assessed');
  }
  const missing = [];
  if (!dto.supplierId && !dto.supplierName) missing.push('Supplier');
  if (!dto.requiredBy) missing.push('Required By');
  if (!dto.lines?.length) missing.push('at least one material line');
  (dto.lines || []).forEach((l) => {
    if (!l.orderQty || !l.rate) missing.push(`qty/rate on line ${l.lineNo}`);
  });
  if (missing.length) fail('VALIDATION', `Sample PO incomplete — missing: ${missing.join(', ')}`);
  if (sr.inHandDate && dto.requiredBy > sr.inHandDate) {
    fail('VALIDATION', `Required-By must be on or before the Sample In-Hand Date (${sr.inHandDate})`);
  }

  const po = {
    id: Math.max(0, ...db.samplePos.map((p) => p.id || 0)) + 1,
    poNo: dto.saveAsDraft ? null : nextSamplePoNo(db),
    status: dto.saveAsDraft ? 'DRAFT' : 'PO_PENDING',
    poType: 'SAMPLE',
    srId: sr.id,
    srNo: sr.srNo,
    supplierId: dto.supplierId || null,
    supplierName: dto.supplierName || '',
    requiredBy: dto.requiredBy,
    chargeTo: dto.chargeTo || 'ORDER', // ORDER | SAMPLING_OVERHEAD
    createdAt: todayStr(),
    createdBy: currentUserName(),
    lines: clone(dto.lines),
    totalValue: (dto.lines || []).reduce((s, l) => s + (l.orderQty || 0) * (l.rate || 0), 0),
  };
  db.samplePos.push(po);

  if (!dto.saveAsDraft) {
    // Stamp PO Pending chips on the covered material lines
    (dto.lines || []).forEach((l) => {
      const line = (sr.materials || []).find((m) => m.lineNo === l.lineNo);
      if (line) line.poRef = { poNo: po.poNo, status: 'PO_PENDING' };
    });
    pushActivity(sr, `Sample PO ${po.poNo} raised`, {
      details: `${po.lines.length} line(s) · ${po.supplierName} · value ${po.totalValue.toFixed(2)}`,
    });
  }
  saveDb(db);
  return clone(po);
};

export const listSamplePos = async (srId) => {
  await delay();
  return clone(loadDb().samplePos.filter((p) => p.srId === Number(srId)));
};

/** Demo helper for the future GRN flow: receipt clears the PO Pending chip. */
export const markSamplePoReceived = async (poNo) => {
  await delay();
  const db = loadDb();
  const po = db.samplePos.find((p) => p.poNo === poNo);
  if (!po) fail('NOT_FOUND', `Sample PO ${poNo} not found`);
  po.status = 'RECEIVED';
  const sr = db.requests.find((r) => r.id === po.srId);
  if (sr) {
    (sr.materials || []).forEach((m) => {
      if (m.poRef?.poNo === poNo) m.poRef = { poNo, status: 'RECEIVED' };
    });
    pushActivity(sr, `Goods received against ${poNo} — PO Pending cleared`);
  }
  saveDb(db);
  return clone(po);
};
