/**
 * The job-work PO ledger as the requirement mocks see it — the only PO-side module the
 * Cut Panel / Garment Process Requirement mocks import. Read-only: it never writes, so
 * the PO module stays the only writer of allocation (CPP PRD §19.2).
 */
import { loadJobWorkDb } from './jobWorkMockStore';
import { sumLedger, poLineCellId, poLineRequirementCell } from '../../../utils/jobWorkAllocation';
import { holdsDraftQty } from '../../../utils/jobWorkPoStatus';

const touches = (source, reqId) => (type, line) => {
  const c = poLineRequirementCell(type, line);
  return c.source === source && c.reqId === Number(reqId);
};

/** Ledger totals per cell and "in draft PO" quantities for one requirement source ('CPR' | 'GPR'). */
export const usageInputs = (source) => {
  const db = loadJobWorkDb();
  const ledger = sumLedger(db.ledger.filter((e) => e.source === source));
  const drafts = new Map();
  db.docs.filter((d) => holdsDraftQty(d.type, d.status)).forEach((d) => d.lines.forEach((l) => {
    if (poLineRequirementCell(d.type, l).source !== source) return;
    const id = poLineCellId(d.type, l);
    drafts.set(id, (drafts.get(id) || 0) + (Number(l.poQty) || 0));
  }));
  return { ledger, drafts };
};

/**
 * The POs raised against one requirement (CPP FR-27, GPO FR-18 traceability): number,
 * type, status, vendor, process, and — for the lines on this requirement — PO qty,
 * allocated and received.
 */
export const posForRequirement = (source, reqId) => {
  const db = loadJobWorkDb();
  const onReq = touches(source, reqId);
  return db.docs.filter((d) => d.lines.some((l) => onReq(d.type, l))).map((d) => {
    const lines = d.lines.filter((l) => onReq(d.type, l));
    const keys = new Set(lines.map((l) => l.key));
    const ledger = db.ledger.filter((e) => e.poId === d.id && keys.has(e.poLineKey));
    const net = (types, sign = 1) => ledger.filter((e) => types.includes(e.type)).reduce((s, e) => s + sign * e.qty, 0);
    return {
      id: d.id, type: d.type, poNo: d.poNo, status: d.status, poDate: d.poDate,
      vendorName: d.vendor?.name ?? '—', processLabel: lines[0]?.processLabel ?? d.process?.name,
      reqLineKeys: [...new Set(lines.map((l) => l.cprLineKey ?? l.gprLineKey))],
      poQty: lines.reduce((s, l) => s + (Number(l.poQty) || 0), 0),
      allocated: net(['ALLOCATE', 'OVERRIDE_ALLOCATE']) + net(['RELEASE'], -1),
      received: net(['COMPLETE']),
    };
  });
};
