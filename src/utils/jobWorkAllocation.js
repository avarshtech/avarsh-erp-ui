/**
 * The job-work allocation ledger and what it says about a requirement — pure functions.
 *
 * Balance is never stored (Cut Panel PO PRD §15, Garment Process PO PRD §10): it is the
 * requirement's quantity minus the ledger, per requirement CELL —
 *   Cut Panel Requirement      line × size            cell = '2Y'
 *   Garment Process Requirement line × colour × size  cell = 'Black|2Y'
 *
 * Ledger entries are append-only:
 *   { id, source: 'CPR'|'GPR', reqId, lineKey, cell, poType, poId, poLineKey,
 *     type: ALLOCATE | OVERRIDE_ALLOCATE | RELEASE | COMPLETE, qty (always positive),
 *     at, by, reasonCode, remark }
 * When they are written differs by PO type (Cut Panel PO on approval, Garment Process PO
 * from submit) — that belongs to the PO workflows; this file only reads them.
 */
import { REQUIREMENT_STATUS } from './requirementStatus';
import { processLabel } from './cutPanelCalc';
import { gprLineLabel } from './garmentProcessCalc';

export const LEDGER_ENTRY = {
  ALLOCATE: 'ALLOCATE',
  OVERRIDE_ALLOCATE: 'OVERRIDE_ALLOCATE',
  RELEASE: 'RELEASE',
  COMPLETE: 'COMPLETE',
};

export const REQUIREMENT_SOURCE = { CPR: 'CPR', GPR: 'GPR' };

export const cellId = (source, reqId, lineKey, cell) => `${source}:${reqId}:${lineKey}:${cell}`;

export const gprCell = (color, size) => `${color}|${size}`;

/** The requirement cell a PO line draws on: CPR line × size (CPP), GPR line × colour × size (GPO). */
export const poLineRequirementCell = (poType, line) => (poType === 'CPP'
  ? { source: REQUIREMENT_SOURCE.CPR, reqId: line.cprId, lineKey: line.cprLineKey, cell: line.size }
  : { source: REQUIREMENT_SOURCE.GPR, reqId: line.gprId, lineKey: line.gprLineKey, cell: gprCell(line.color, line.size) });

export const poLineCellId = (poType, line) => {
  const c = poLineRequirementCell(poType, line);
  return cellId(c.source, c.reqId, c.lineKey, c.cell);
};

/** Every cell of a requirement with its required quantity, in line order. */
export const requirementCells = (source, doc) => (source === REQUIREMENT_SOURCE.CPR
  ? doc.lines.flatMap((l) => Object.entries(l.sizes || {})
    .map(([size, c]) => ({ lineKey: l.key, cell: size, required: Number(c.requiredQty) || 0 })))
  : doc.lines.flatMap((l) => Object.entries(l.qty || {}).flatMap(([color, row]) => Object.entries(row)
    .map(([size, q]) => ({ lineKey: l.key, cell: gprCell(color, size), required: Number(q) || 0 })))));

const ZERO = Object.freeze({ allocated: 0, overAllocated: 0, released: 0, completed: 0 });

/** Ledger totals per cell id: allocated is net of releases; overAllocated is the override part. */
export const sumLedger = (entries) => {
  const out = new Map();
  entries.forEach((e) => {
    const id = cellId(e.source, e.reqId, e.lineKey, e.cell);
    const t = { ...(out.get(id) || ZERO) };
    const q = Number(e.qty) || 0;
    if (e.type === LEDGER_ENTRY.ALLOCATE) t.allocated += q;
    if (e.type === LEDGER_ENTRY.OVERRIDE_ALLOCATE) { t.allocated += q; t.overAllocated += q; }
    // A release gives back the excess first: what sits above the requirement goes before the rest.
    if (e.type === LEDGER_ENTRY.RELEASE) { t.allocated -= q; t.released += q; t.overAllocated = Math.max(0, t.overAllocated - q); }
    if (e.type === LEDGER_ENTRY.COMPLETE) t.completed += q;
    out.set(id, t);
  });
  return out;
};

/**
 * Requirement status from its stored status and its cells. Draft and Closed are set by
 * users and never overridden; a submitted requirement is Partially Used once any cell is
 * allocated, and Fully Used once every cell with a quantity has no balance left.
 */
export const deriveRequirementStatus = (storedStatus, cells) => {
  if (storedStatus === REQUIREMENT_STATUS.DRAFT || storedStatus === REQUIREMENT_STATUS.CLOSED) return storedStatus;
  if (!cells.some((c) => c.allocated > 0)) return REQUIREMENT_STATUS.SUBMITTED;
  return cells.some((c) => c.required > 0 && c.balance > 0)
    ? REQUIREMENT_STATUS.PARTIALLY_USED
    : REQUIREMENT_STATUS.FULLY_USED;
};

const addInto = (t, c) => {
  ['required', 'allocated', 'overAllocated', 'released', 'completed', 'inDraft', 'balance'].forEach((k) => { t[k] += c[k]; });
  return t;
};

export const emptyUsageTotals = () => ({
  required: 0, allocated: 0, overAllocated: 0, released: 0, completed: 0, inDraft: 0, balance: 0,
});

/**
 * What the PO module has done with one requirement (PRD FR-25): per cell, per line and in
 * total — required, in draft PO, allocated (PO'd), over-allocated, released, completed and
 * balance — plus the derived status and consumedQty (= allocated).
 *
 * `ledger` is sumLedger() over the entries; `drafts` maps cell id → PO qty on POs that do
 * not allocate yet (visibility only, PRD §15.1).
 */
export const requirementUsage = (source, doc, { ledger, drafts }) => {
  const cells = requirementCells(source, doc).map((c) => {
    const id = cellId(source, doc.id, c.lineKey, c.cell);
    const t = ledger.get(id) || ZERO;
    return { ...c, cellId: id, ...t, inDraft: drafts.get(id) || 0, balance: c.required - t.allocated };
  });
  const byLine = {};
  cells.forEach((c) => { byLine[c.lineKey] = addInto(byLine[c.lineKey] || emptyUsageTotals(), c); });
  const totals = cells.reduce(addInto, emptyUsageTotals());
  return {
    cells, byLine, totals,
    status: deriveRequirementStatus(doc.status, cells),
    consumedQty: totals.allocated,
  };
};

/** Coverage for display: allocated ÷ required, capped at 100 (PRD §15.2). */
export const coveragePct = ({ required, allocated }) => (required > 0 ? Math.min(100, Math.round((allocated / required) * 100)) : 0);

/** Step status on the allocation view (CPP PRD FR-27 / §17.1). */
export const stepStatus = ({ required, allocated, balance }) => {
  if (!(allocated > 0)) return 'Not allocated';
  return required > 0 && balance > 0 ? 'Partially allocated' : 'Fully allocated';
};

/**
 * Rows of the requirement → PO allocation view. A Cut Panel PO covers one process, so a
 * CPR is shown per process step (every colour and panel carrying it, as children); a GPR
 * is shown per process line.
 */
export const allocationRows = (source, doc, usage) => {
  const row = (key, extra, lineKeys) => {
    const t = lineKeys.reduce((acc, k) => addInto(acc, usage.byLine[k] || emptyUsageTotals()), emptyUsageTotals());
    return { key, ...extra, ...t, coverage: coveragePct(t), status: stepStatus(t) };
  };
  if (source === REQUIREMENT_SOURCE.GPR) {
    return doc.lines.map((l) => row(l.key, { seq: l.seqNo, label: gprLineLabel(l) }, [l.key]));
  }
  const groups = new Map();
  doc.lines.forEach((l) => {
    const label = processLabel(l);
    groups.set(label, [...(groups.get(label) || []), l]);
  });
  return [...groups.entries()].map(([label, lines]) => row(label, {
    label,
    steps: [...new Set(lines.map((l) => l.sequenceNo))].sort((a, b) => a - b),
    children: lines.map((l) => row(l.key, { label: `${l.colorName} · ${l.panelName}`, detail: l.fabricName, steps: [l.sequenceNo] }, [l.key])),
  }, lines.map((l) => l.key)));
};
