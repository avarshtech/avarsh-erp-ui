/**
 * Cut Panel PO rules — pure functions (PRD §9, §12, §16). The screen and the mock
 * "server" run the same checks, so a PO the screen lets through the mock accepts.
 *
 * A check is BLOCKING (Submit / Approve refused) or ADVISORY (warn; needs a recorded
 * reason, then proceeds — PRD house rule). Over-allocation blocks until an override is
 * authorised; a zero rate needs the Free / rework code.
 */
import dayjs from 'dayjs';
import { cellId, REQUIREMENT_SOURCE } from './jobWorkAllocation';
import { poValue, isKeyedBilling } from './jobWorkPoCalc';
import { ZERO_RATE_REASON, RATE_VARIANCE_PCT } from './jobWorkConstants';
import { processLabel } from './cutPanelCalc';
import { deliveryIssues } from './jobWorkDelivery';

const n = (v) => Number(v || 0).toLocaleString('en-IN');
const hasValue = (v) => v !== null && v !== undefined && v !== '';
/** At most `places` decimals, tolerant of binary floats (1.1 × 100 is 110.00000000000001). */
const dp = (v, places) => Math.abs(Math.round(Number(v) * 10 ** places) - Number(v) * 10 ** places) < 1e-6;

export const lineLabel = (l) => `${l.cprNo} ${l.colorName} ${l.panelName} ${l.size}`;

/** Required qty and allocation of a PO line's cell as the requirement stands now (`state` from cppRequirementState). */
export const liveCell = (line, state) => {
  const req = state?.[line.cprId];
  if (!req) return null;
  const cell = req.usage.cells.find((c) => c.cellId === cellId(REQUIREMENT_SOURCE.CPR, line.cprId, line.cprLineKey, line.size));
  const reqLine = req.doc.lines.find((l) => l.key === line.cprLineKey);
  return cell && reqLine ? { ...cell, sequenceNo: reqLine.sequenceNo } : null;
};

/**
 * What a line may draw: the live balance plus what this PO itself holds on the line — its
 * approved allocation, or R0's under an amendment (`ctx.ownAllocation`, else `held` from
 * getCpp) — so an approved line never reads as exceeding its own allocation. Before the
 * requirement state is known, the balance at fetch.
 */
export const liveBalance = (line, ctx, held) => {
  const cell = ctx?.state ? liveCell(line, ctx.state) : null;
  if (!cell) return line.required - line.prevPoQty;
  return cell.required - cell.allocated + (ctx.ownAllocation?.[line.key] ?? held?.[line.key]?.allocated ?? 0);
};

/**
 * VR-03 / VR-20: the requirement is gone or back in Draft, the line is gone, or its qty /
 * sequence changed since fetch. A Closed requirement still answers here: what a PO already
 * holds on it stands; validateCpp refuses anything more.
 */
export const requirementChange = (line, state) => {
  const req = state?.[line.cprId];
  if (!req || req.status === 'DRAFT') return `${line.cprNo} is no longer available to the PO module`;
  const cell = liveCell(line, state);
  if (!cell) return `${lineLabel(line)} no longer exists on ${line.cprNo}`;
  if (cell.required !== line.snapshot.required || cell.sequenceNo !== line.snapshot.sequenceNo) {
    return `${lineLabel(line)} changed on ${line.cprNo} since it was fetched (required ${n(line.snapshot.required)} → ${n(cell.required)})`;
  }
  return null;
};

/** The over-allocation override covering a line, if authorised and big enough. */
export const coveringOverride = (doc, line, excess) => (doc.overrides || []).find((o) => o.type === 'OVER_ALLOCATION'
  && o.lineKey === line.key && o.status === 'AUTHORISED' && Number(o.excessQty) >= excess);

export const cppValue = (doc) => poValue({
  lines: doc.lines.filter((l) => Number(l.poQty) > 0), otherCharges: doc.otherCharges,
  gstRatePercent: doc.process?.gstRatePercent, igst: Boolean(doc.vendor?.igstApplicable),
});

const byLines = (lines) => Object.values(lines.reduce((acc, l) => {
  const t = acc[l.cprNo] || { cprNo: l.cprNo, required: 0, prevPoQty: 0, thisPo: 0 };
  t.required += l.required;
  t.prevPoQty += l.prevPoQty;
  t.thisPo += Number(l.poQty) || 0;
  acc[l.cprNo] = t;
  return acc;
}, {})).map((t) => ({ ...t, balanceAfter: t.required - t.prevPoQty - t.thisPo }));

/**
 * The live balance block (PRD §13.3, §14.1): one row per CPR on the PO, for the PO's process
 * step — the step's required qty, what OTHER POs hold (approved allocation; drafts do not
 * count, BR-10), this PO and the balance after it. "This PO" is the PO qty until the PO
 * allocates (or while an amendment is open), then what it holds, so a short-closed PO shows
 * only what came back. Until the requirement state is known, the PO's own lines stand in.
 */
export const balanceBlock = (doc, ctx) => {
  const label = doc.process?.label ?? doc.process?.name;
  const cprs = [...new Map(doc.lines.map((l) => [l.cprId, l.cprNo])).entries()];
  if (!ctx?.state || cprs.some(([id]) => !ctx.state[id])) return byLines(doc.lines);
  // An open amendment is on screen merged over the PO: its quantities are the ones to weigh.
  const byQty = ['DRAFT', 'SUBMITTED'].includes(doc.status) || Boolean(doc.pendingRevision);
  const held = Object.values(doc.held || {});
  return cprs.map(([id, cprNo]) => {
    const { doc: cpr, usage } = ctx.state[id];
    const step = cpr.lines.filter((l) => processLabel(l) === label).map((l) => usage.byLine[l.key]).filter(Boolean);
    const required = step.reduce((s, u) => s + u.required, 0);
    const own = held.filter((h) => h.cprId === id).reduce((s, h) => s + h.allocated, 0);
    const prevPoQty = step.reduce((s, u) => s + u.allocated, 0) - own;
    const thisPo = byQty ? doc.lines.filter((l) => l.cprId === id).reduce((s, l) => s + (Number(l.poQty) || 0), 0) : own;
    return { cprNo, required, prevPoQty, thisPo, balanceAfter: required - prevPoQty - thisPo };
  });
};

/**
 * All checks for Submit (and, with `forApproval`, for each Approve). `ctx`:
 *   state        cppRequirementState(cprIds)
 *   eligibility  vendorEligibility() result for the PO's vendor, process and date
 *   orderDue     { [orderId]: order delivery date } — the cut-off of VR-08 (deviation D17)
 *   lastRates    { 'style|size': rate } for the vendor and process
 *   duplicates   PO numbers found by duplicatePos()
 *   ownAllocation { [lineKey]: qty } an amendment's R0 already holds (added back to the balance)
 *   stage        'approve' words a lost balance for the approver (EC-10)
 * Returns { blocking: [msg], advisories: [{ code, msg, resolved }] }.
 */
/** One line per requirement cell, all of the PO's process — the integrity a save also enforces. */
export const cppLineIntegrity = (doc) => {
  const out = [];
  const label = doc.process?.label ?? doc.process?.name;
  const seen = new Set();
  doc.lines.forEach((l) => {
    const cell = `${l.cprId}|${l.cprLineKey}|${l.size}`;
    if (seen.has(cell)) out.push(`${lineLabel(l)} is on the PO twice — keep one line per requirement cell.`);
    seen.add(cell);
    if (label && l.processLabel !== label) out.push(`${lineLabel(l)} is ${l.processLabel}, not this PO's ${label} (BR-03).`);
  });
  return out;
};

export const validateCpp = (doc, ctx, { today = dayjs() } = {}) => {
  const blocking = cppLineIntegrity(doc);
  const advisories = [];
  const live = doc.lines.filter((l) => Number(l.poQty) > 0);
  if (!doc.poDate || !doc.vendor || !doc.process) blocking.push('PO date, process and job worker are mandatory (VR-01).');
  deliveryIssues(doc, 'requiredDeliveryDate').forEach((issue) => blocking.push(`${issue} (VR-01).`));
  if (!live.length) blocking.push('At least one line needs a PO quantity above zero (VR-02).');
  if (doc.poDate && dayjs(doc.poDate).isAfter(today, 'day')) blocking.push('The PO date cannot be in the future (VR-05).');
  if (ctx.eligibility && !ctx.eligibility.eligible) blocking.push(`${doc.vendor?.name}: ${ctx.eligibility.reason} (VR-13).`);
  [...new Set(live.map((l) => l.cprId))].forEach((id) => {
    const since = ctx.state?.[id]?.submittedOn;
    if (since && doc.poDate && dayjs(doc.poDate).isBefore(dayjs(since), 'day')) {
      blocking.push(`The PO date cannot precede ${ctx.state[id].doc.cprNo}'s release on ${dayjs(since).format('DD-MMM-YYYY')} (VR-05).`);
    }
  });
  live.forEach((l) => {
    if (!dp(l.poQty, 2)) blocking.push(`${lineLabel(l)}: PO quantity must be positive with at most two decimals (VR-15).`);
    if (!hasValue(l.rate)) blocking.push(`${lineLabel(l)}: enter a rate (VR-09).`);
    else if (Number(l.rate) < 0 || !dp(l.rate, 2)) blocking.push(`${lineLabel(l)}: the rate must be zero or more, with at most two decimals (FR-14).`);
    else if (Number(l.rate) === 0 && l.rateReasonCode !== ZERO_RATE_REASON.value) blocking.push(`${lineLabel(l)}: a rate of 0.00 needs the ${ZERO_RATE_REASON.label} reason (VR-10).`);
    if (isKeyedBilling(l.uom) && !(Number(l.billingQty) > 0)) blocking.push(`${lineLabel(l)}: enter the billing quantity for ${l.uom} (§11.3).`);
    const change = ctx.state ? requirementChange(l, ctx.state) : null;
    if (change) blocking.push(`${change} — re-fetch the line (VR-20).`);
    const own = ctx.ownAllocation?.[l.key] ?? doc.held?.[l.key]?.allocated ?? 0;
    if (!change && ctx.state?.[l.cprId]?.status === 'CLOSED' && Number(l.poQty) > own) {
      blocking.push(`${lineLabel(l)}: ${l.cprNo} is closed — the PO can keep what it holds (${n(own)}) but not take more.`);
    }
    // An amendment is checked against the balance plus what its own PO already holds (R0).
    const excess = Number(l.poQty) - liveBalance(l, ctx, doc.held);
    if (excess > 0 && !coveringOverride(doc, l, excess)) {
      blocking.push(ctx.stage === 'approve'
        ? `${lineLabel(l)}: exceeds the balance by ${n(excess)} — another PO has taken it since submission; send the PO back for correction (EC-10).`
        : `${lineLabel(l)}: exceeds the balance by ${n(excess)} — needs an authorised over-allocation override (VR-11).`);
    }
    const last = ctx.lastRates?.[`${l.styleNo}|${l.size}`];
    if (last && Number(l.rate) > last * (1 + RATE_VARIANCE_PCT / 100)) {
      advisories.push({ code: 'RATE_VARIANCE', lineKey: l.key, msg: `${lineLabel(l)}: rate ₹${l.rate} is more than ${RATE_VARIANCE_PCT}% above the last rate ₹${last} (VR-12).`, resolved: Boolean(String(l.rateRemark || '').trim()) });
    }
  });
  const lateOrders = [...new Set(live.map((l) => l.orderId))].filter((id) => ctx.orderDue?.[id] && doc.requiredDeliveryDate && dayjs(doc.requiredDeliveryDate).isAfter(ctx.orderDue[id], 'day'));
  if (lateOrders.length) advisories.push({ code: 'LATE_DELIVERY', msg: 'The expected delivery date is after the order delivery date (VR-08).', resolved: Boolean(String(doc.lateDeliveryReason || '').trim()) });
  if (ctx.duplicates?.length) advisories.push({ code: 'DUPLICATE_PO', msg: `${ctx.duplicates.join(', ')} already goes to this job worker for the same requirement and process today (VR-14).`, resolved: Boolean(String(doc.duplicateReason || '').trim()) });
  if (Number(doc.otherCharges) < 0) blocking.push('Other charges cannot be negative.');
  advisories.filter((a) => !a.resolved).forEach((a) => blocking.push(`${a.msg} Record a reason to continue.`));
  return { blocking: [...new Set(blocking)], advisories };
};
