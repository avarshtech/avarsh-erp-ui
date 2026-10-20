/**
 * Re-fetch after a requirement edit — on a draft PO only, since a placed PO ends editing its
 * requirement. A line whose requirement cell changed is rebuilt from the requirement as it
 * now stands, keeping its key, UOM, billing qty, rate and reasons, with its PO qty reset to
 * the new balance; a line whose cell is gone is dropped. Unchanged lines stay as they are.
 * `state` is ctx.state (cppRequirementState / gpoRequirementState). Pure functions, each
 * returning { lines, rebuilt, dropped: [keys], changes: [messages] }.
 */
import { liveCell, requirementChange } from './cutPanelPoCalc';
import { gpoLiveCell, gpoRequirementChange, GPO_VISIBLE } from './garmentProcessPoCalc';
import { cppLineFromCpr, gpoLineFromGpr } from './jobWorkPoLines';
import { processLabel } from './cutPanelCalc';
import { REQUIREMENT_STATUS as R } from './requirementStatus';

const pickOf = (line, fields) => Object.fromEntries(fields.map((f) => [f, line[f]]));
const CPP_KEPT = ['uom', 'billingQty', 'rate', 'rateReasonCode', 'rateRemark', 'receivedQty'];
const GPO_KEPT = ['uom', 'billingQty', 'rate', 'excess', 'receivedQty', 'colorHex'];

const refetch = (lines, changeOf, rebuild) => {
  const out = { lines: [], rebuilt: 0, dropped: [], changes: [] };
  lines.forEach((l) => {
    const change = changeOf(l);
    if (!change) { out.lines.push(l); return; }
    out.changes.push(change);
    const next = rebuild(l);
    if (next) { out.lines.push(next); out.rebuilt += 1; } else out.dropped.push(l.key);
  });
  return { ...out, changes: [...new Set(out.changes)] };
};

/** Cut Panel PO: the CPR line's process never changes in place, so a matching cell is rebuilt; a zero-balance one stays greyed. */
export const refetchCppLines = (lines, state) => refetch(lines, (l) => requirementChange(l, state), (l) => {
  const req = state?.[l.cprId];
  const reqLine = req && req.status !== R.DRAFT ? req.doc.lines.find((x) => x.key === l.cprLineKey) : null;
  const cell = reqLine ? liveCell(l, state) : null;
  if (!cell || !(cell.required > 0) || processLabel(reqLine) !== l.processLabel) return null;
  return {
    ...cppLineFromCpr({ key: l.key, cpr: req.doc, line: reqLine, size: l.size, order: { garmentDescription: l.garment }, prevPoQty: cell.allocated, uom: l.uom }),
    ...pickOf(l, CPP_KEPT),
  };
});

/** Garment Process PO: a line whose GPR line is now another process leaves (one process per PO), and so does one with no balance. */
export const refetchGpoLines = (lines, state) => refetch(lines, (l) => gpoRequirementChange(l, state), (l) => {
  const req = state?.[l.gprId];
  const reqLine = req && GPO_VISIBLE.includes(req.status) ? req.doc.lines.find((x) => x.key === l.gprLineKey) : null;
  const cell = reqLine ? gpoLiveCell(l, state) : null;
  if (!cell || !(cell.required > 0) || !(cell.balance > 0) || cell.processLabel !== l.processLabel) return null;
  return {
    ...gpoLineFromGpr({ key: l.key, gpr: req.doc, line: reqLine, color: l.color, size: l.size, order: null, prevPoQty: cell.allocated, uom: l.uom }),
    ...pickOf(l, GPO_KEPT),
  };
});
