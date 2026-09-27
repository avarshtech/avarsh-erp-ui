/**
 * Cut Panel PO lookups over the Cut Panel Requirements (mock). Requirements are read
 * through their own service, so this swaps to the API with a facade change only; the
 * ledger comes from the PO store.
 */
import { listCprs, getCpr, getCprOrderContext } from '../../bom/cutPanel/cutPanelService';
import { usageInputs } from '../jobWork/allocationReader';
import { requirementUsage, REQUIREMENT_SOURCE, cellId } from '../../../utils/jobWorkAllocation';
import { processLabel } from '../../../utils/cutPanelCalc';
import { cppLineFromCpr } from '../../../utils/jobWorkPoLines';
import { REQUIREMENT_STATUS as R } from '../../../utils/requirementStatus';

/** Submitted requirements are the PO-visible ones (the PRD's "Approved", deviation D13). */
const VISIBLE = [R.SUBMITTED, R.PARTIALLY_USED, R.FULLY_USED];

const liveCprs = async () => {
  const visible = (await listCprs()).filter((s) => VISIBLE.includes(s.status));
  const docs = await Promise.all(visible.map((s) => getCpr(s.id)));
  const inputs = usageInputs(REQUIREMENT_SOURCE.CPR);
  return docs.map((doc) => ({ doc, usage: requirementUsage(REQUIREMENT_SOURCE.CPR, doc, inputs) }));
};

const stepTotals = ({ doc, usage }, label) => doc.lines.filter((l) => processLabel(l) === label).reduce((t, l) => {
  const u = usage.byLine[l.key];
  return { required: t.required + u.required, allocated: t.allocated + u.allocated, inDraft: t.inDraft + u.inDraft, balance: t.balance + u.balance };
}, { required: 0, allocated: 0, inDraft: 0, balance: 0 });

/** Processes carried by visible requirements, each with how many CPRs still have balance for it (FR-07). */
export const cppProcessOptions = async () => {
  const map = new Map();
  (await liveCprs()).forEach((c) => new Set(c.doc.lines.map(processLabel)).forEach((label) => {
    const line = c.doc.lines.find((l) => processLabel(l) === label);
    const o = map.get(label) || { label, processName: line.processName, otherName: line.processOtherName, cprCount: 0 };
    if (stepTotals(c, label).balance > 0) o.cprCount += 1;
    map.set(label, o);
  }));
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
};

/** Requirement lookup for one process (FR-08/09): fully allocated ones stay listed, not selectable. */
export const cppEligibleCprs = async (label) => (await liveCprs())
  .filter((c) => c.doc.lines.some((l) => processLabel(l) === label))
  .map((c) => {
    const lines = c.doc.lines.filter((l) => processLabel(l) === label);
    const t = stepTotals(c, label);
    return {
      id: c.doc.id, cprNo: c.doc.cprNo, orderId: c.doc.orderId, orderNo: c.doc.orderNo, buyer: c.doc.buyer,
      styleNo: c.doc.styleNo, status: c.usage.status, submittedOn: c.doc.submittedOn, ...t,
      colours: [...new Set(lines.map((l) => l.colorName))],
      sizes: [...new Set(lines.flatMap((l) => Object.keys(l.sizes)))],
      selectable: t.balance > 0,
    };
  });

/**
 * Add to Grid (PRD §13.1): one PO line per CPR line × size for the PO's process, with the
 * allocation at fetch as "previously PO'd". Zero-balance cells come greyed with PO qty 0.
 * Cells already on the PO are skipped; lines follow colour, then panel, then size order.
 */
export const cppFetchLines = async ({ label, cprIds, colours, sizes, existing, firstKeyNo, uom }) => {
  const live = await liveCprs();
  const have = new Set(existing.map((l) => `${l.cprId}|${l.cprLineKey}|${l.size}`));
  const out = [];
  let skipped = 0;
  let n = firstKeyNo;
  for (const id of cprIds) {
    const c = live.find((x) => x.doc.id === id);
    if (!c) continue;
    const order = await getCprOrderContext(c.doc.orderId);
    const colourRank = (name) => order.colors.findIndex((o) => o.name === name);
    const lines = c.doc.lines
      .filter((l) => processLabel(l) === label && (!colours?.length || colours.includes(l.colorName)))
      .sort((a, b) => colourRank(a.colorName) - colourRank(b.colorName) || a.panelName.localeCompare(b.panelName));
    lines.forEach((line) => order.sizes.filter((s) => (!sizes?.length || sizes.includes(s)) && line.sizes[s]?.requiredQty > 0)
      .forEach((size) => {
        if (have.has(`${c.doc.id}|${line.key}|${size}`)) { skipped += 1; return; }
        const cell = c.usage.cells.find((x) => x.cellId === cellId(REQUIREMENT_SOURCE.CPR, c.doc.id, line.key, size));
        out.push(cppLineFromCpr({ key: `L${n}`, cpr: c.doc, line, size, order, prevPoQty: cell?.allocated || 0, uom }));
        n += 1;
      }));
  }
  return { lines: out, skipped };
};

/**
 * The CPRs a PO draws on, as they are now, whatever their status — a Closed one keeps what
 * its POs hold, a Draft (reopened) one is no longer available (VR-03/05/20).
 */
export const cppRequirementState = async (cprIds) => {
  const docs = await Promise.all(cprIds.map((id) => getCpr(id).catch(() => null)));
  const inputs = usageInputs(REQUIREMENT_SOURCE.CPR);
  return Object.fromEntries(cprIds.map((id, i) => {
    const doc = docs[i];
    if (!doc) return [id, null];
    const usage = requirementUsage(REQUIREMENT_SOURCE.CPR, doc, inputs);
    return [id, { status: usage.status, submittedOn: doc.submittedOn, doc, usage }];
  }));
};
