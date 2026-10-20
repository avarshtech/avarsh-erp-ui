/**
 * The job-work allocation of a requirement as the screens show it — pure functions over what the server
 * reports (the ledger itself, its balances and the requirement's status are the server's).
 *
 * A requirement CELL is what a PO line draws on —
 *   Cut Panel Requirement      line × size            cell = '2Y'
 *   Garment Process Requirement line × colour × size  cell = 'Black|2Y'
 * and the server's usage keys each one as cellId(source, requirement id, line key, cell).
 */
import { processLabel } from './cutPanelCalc';
import { gprLineLabel } from './garmentProcessCalc';

export const REQUIREMENT_SOURCE = { CPR: 'CPR', GPR: 'GPR' };

export const cellId = (source, reqId, lineKey, cell) => `${source}:${reqId}:${lineKey}:${cell}`;

export const gprCell = (color, size) => `${color}|${size}`;

const addInto = (t, c) => {
  ['required', 'allocated', 'overAllocated', 'released', 'completed', 'inDraft', 'balance'].forEach((k) => { t[k] += Number(c[k]) || 0; });
  return t;
};

const emptyUsageTotals = () => ({
  required: 0, allocated: 0, overAllocated: 0, released: 0, completed: 0, inDraft: 0, balance: 0,
});

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
