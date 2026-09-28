/**
 * Garment Process PO rules — pure functions (PRD §8–17), run by the screen and by the mock
 * "server" alike. A vendor and one line are needed even to save (V1, V2); the rest block
 * Submit. An expected return after the required date only warns (§8.3), and so does an
 * unapproved or untagged job worker, whom the approver signs off (§13).
 */
import dayjs from 'dayjs';
import { cellId, gprCell, REQUIREMENT_SOURCE } from './jobWorkAllocation';
import { poValue, isKeyedBilling } from './jobWorkPoCalc';
import { GPO_EXCESS_CAP_PCT, jobWorkUomLabel } from './jobWorkConstants';
import { REQUIREMENT_STATUS as R } from './requirementStatus';

const n = (v) => Number(v || 0).toLocaleString('en-IN');
const hasValue = (v) => v !== null && v !== undefined && v !== '';
const dp = (v, places) => Math.abs(Math.round(Number(v) * 10 ** places) - Number(v) * 10 ** places) < 1e-6;

/** Requirements a PO may draw on (§9, deviation D13): released and not closed. */
export const GPO_VISIBLE = [R.SUBMITTED, R.PARTIALLY_USED, R.FULLY_USED];

/** The single approval level of a Garment Process PO (§5: the Purchase Manager approves). */
export const GPO_LEVELS = ['Purchase Manager'];

export const gpoLineLabel = (l) => `${l.gprNo} ${l.color} ${l.size}`;

/** A PO line's requirement cell as it stands now (`state` from gpoRequirementState). */
export const gpoLiveCell = (line, state) => {
  const req = state?.[line.gprId];
  if (!req) return null;
  const cell = req.usage.cells.find((c) => c.cellId === cellId(REQUIREMENT_SOURCE.GPR, line.gprId, line.gprLineKey, gprCell(line.color, line.size)));
  const reqLine = req.doc.lines.find((l) => l.key === line.gprLineKey);
  return cell && reqLine ? { ...cell, seqNo: reqLine.seqNo } : null;
};

/**
 * What a line may draw: required less what every PO holds, plus what this PO itself holds
 * (from submission on), so a submitted line never reads as exceeding its own allocation.
 * Before the requirement state is known, the balance at fetch.
 */
export const gpoLiveBalance = (line, ctx, held) => {
  const cell = ctx?.state ? gpoLiveCell(line, ctx.state) : null;
  if (!cell) return line.required - line.prevPoQty;
  return cell.required - cell.allocated + (held?.[line.key]?.allocated ?? 0);
};

/** The most a line may exceed its balance: GPO_EXCESS_CAP_PCT of its required qty (§11). */
export const excessCap = (line) => Math.floor(Number(line.required) * GPO_EXCESS_CAP_PCT) / 100;

/** The approved excess covering a line: approved, and at least what the line exceeds by. */
export const approvedExcess = (doc, line, excess) => (doc.overrides || []).find((o) => o.lineKey === line.key
  && o.status === 'AUTHORISED' && Number(o.excessQty) >= excess);

/** V12: the requirement is closed or gone, or the cell changed since it was added. */
export const gpoRequirementChange = (line, state) => {
  const req = state?.[line.gprId];
  if (!req || !GPO_VISIBLE.includes(req.status)) return `${line.gprNo} is no longer available`;
  const cell = gpoLiveCell(line, state);
  if (!cell) return `${gpoLineLabel(line)} no longer exists on ${line.gprNo}`;
  if (cell.required !== line.snapshot.required || cell.seqNo !== line.snapshot.seqNo) {
    return `${gpoLineLabel(line)} changed on ${line.gprNo} since it was added (required ${n(line.snapshot.required)} → ${n(cell.required)}) — remove and add it again`;
  }
  return null;
};

/** Empty rates take the vendor's last approved rate for the process and UOM (§14). */
export const withLastRates = (lines, byKey) => lines.map((l) => (l.rate == null && byKey?.[l.uom] != null ? { ...l, rate: byKey[l.uom] } : l));

export const gpoValue = (doc) => poValue({
  lines: doc.lines.filter((l) => Number(l.poQty) > 0), discountType: doc.discountType, discountValue: doc.discountValue,
  otherCharges: doc.otherCharges, gstRatePercent: doc.process?.gstRatePercent, igst: Boolean(doc.vendor?.igstApplicable),
});

/**
 * The checks a draft save makes: V1 and V2, and the line integrity the screen already keeps
 * — one line per requirement cell (V9) and one process per PO (deviation D23).
 */
export const gpoSaveBlocking = (doc) => {
  const out = [...(doc.vendor ? [] : ['Select a vendor (V1).']), ...(doc.lines.length ? [] : ['Add at least one requirement (V2).'])];
  const seen = new Set();
  doc.lines.forEach((l) => {
    const cell = `${l.gprId}|${l.gprLineKey}|${l.color}|${l.size}`;
    if (seen.has(cell)) out.push(`${gpoLineLabel(l)}: line already added (V9).`);
    seen.add(cell);
  });
  const processes = [...new Set(doc.lines.map((l) => l.processLabel))];
  if (processes.length > 1) out.push(`One process per PO: ${processes.join(', ')} need separate POs.`);
  return out;
};

const dateChecks = (doc, blocking, warnings) => {
  if (!doc.requiredDate) blocking.push('Enter the required date.');
  if (!doc.returnTo || (doc.returnTo === 'OTHER' && !String(doc.returnToOther || '').trim())) blocking.push('Select where the garments return to (V14).');
  if (!doc.plannedSendDate || !doc.expectedReturnDate) {
    blocking.push('Planned send and expected return dates are mandatory (V14).');
    return;
  }
  if (doc.poDate && dayjs(doc.plannedSendDate).isBefore(doc.poDate, 'day')) blocking.push('The planned send date cannot be before the PO date (V14).');
  if (dayjs(doc.expectedReturnDate).isBefore(doc.plannedSendDate, 'day')) blocking.push('Check dates: the expected return is before the planned send date (V14).');
  if (doc.requiredDate && dayjs(doc.expectedReturnDate).isAfter(doc.requiredDate, 'day')) warnings.push('The expected return is after the required date (§8.3).');
};

/**
 * Every check for Submit (§17). `ctx` = gpoContext(): { state, eligibility, stage? };
 * `stage: 'submit'` words a lost balance as V15. Returns { blocking, warnings, byLine } —
 * byLine maps a line key to its own message, shown on the line (§19 UX).
 */
export const validateGpo = (doc, ctx, { today = dayjs() } = {}) => {
  const blocking = gpoSaveBlocking(doc);
  const warnings = [];
  const byLine = {};
  const lineError = (l, i, msg) => {
    const text = `Line ${i + 1} (${gpoLineLabel(l)}): ${msg}`;
    blocking.push(text);
    byLine[l.key] = byLine[l.key] || msg;
  };
  if (doc.poDate && dayjs(doc.poDate).isAfter(today, 'day')) blocking.push('The PO date cannot be in the future.');
  doc.lines.forEach((l, i) => {
    if (!(Number(l.poQty) > 0)) lineError(l, i, 'enter a quantity (V5)');
    else if (!dp(l.poQty, 2)) lineError(l, i, 'quantity takes at most two decimals');
    if (!hasValue(l.rate) || !(Number(l.rate) > 0)) lineError(l, i, 'enter a rate (V6)');
    else if (!dp(l.rate, 4)) lineError(l, i, 'rate takes at most four decimals (§14)');
    if (!l.uom) lineError(l, i, 'select a UOM (V7)');
    else if (isKeyedBilling(l.uom) && !(Number(l.billingQty) > 0)) lineError(l, i, `enter the billing quantity in ${jobWorkUomLabel(l.uom)}`);
    const change = ctx?.state ? gpoRequirementChange(l, ctx.state) : null;
    if (change) lineError(l, i, `${change} (V12)`);
    const excess = Number(l.poQty) - gpoLiveBalance(l, ctx, doc.held);
    if (!change && excess > 0 && !approvedExcess(doc, l, excess)) {
      lineError(l, i, ctx?.stage === 'submit' ? `balance changed; exceeds it by ${n(excess)} — review the line (V15)` : `exceeds balance by ${n(excess)} (V4)`);
    }
  });
  dateChecks(doc, blocking, warnings);
  (ctx?.eligibility?.issues || []).forEach((issue) => {
    if (issue.warnOnly) warnings.push(`${doc.vendor?.name}: ${issue.text} — the approver signs this off (§13).`);
    else blocking.push(`${doc.vendor?.name}: ${issue.text} — choose another vendor (§13).`);
  });
  const { basic, discount } = gpoValue(doc);
  if (Number(doc.discountValue) < 0 || Number(doc.otherCharges) < 0) blocking.push('Discount and other charges cannot be negative (§8.4).');
  if (discount > basic) blocking.push('The discount cannot exceed the subtotal (§8.4).');
  return { blocking: [...new Set(blocking)], warnings, byLine };
};

/**
 * Requirement cards (§19 ③): per GPR line on the PO, what the requirement holds for it —
 * required, what OTHER POs hold, this PO and the balance after. "This PO" is its quantity
 * while it is a draft, then what it holds (a short close keeps only what came back).
 */
export const requirementCards = (doc, ctx) => {
  const groups = new Map();
  doc.lines.forEach((l) => {
    const key = `${l.gprId}|${l.gprLineKey}`;
    const g = groups.get(key) || { key, gprId: l.gprId, gprNo: l.gprNo, gprLineKey: l.gprLineKey, orderId: l.orderId, orderNo: l.orderNo, buyer: l.buyer, styleNo: l.styleNo, seqNo: l.seqNo, processLabel: l.processLabel, lines: [] };
    g.lines.push(l);
    groups.set(key, g);
  });
  const byQty = doc.status === 'DRAFT';
  return [...groups.values()].map((g) => {
    const u = ctx?.state?.[g.gprId]?.usage.byLine[g.gprLineKey];
    const own = g.lines.reduce((s, l) => s + (doc.held?.[l.key]?.allocated ?? 0), 0);
    const thisPo = byQty ? g.lines.reduce((s, l) => s + (Number(l.poQty) || 0), 0) : own;
    const required = u ? u.required : g.lines.reduce((s, l) => s + l.required, 0);
    const prevPoQty = u ? u.allocated - own : g.lines.reduce((s, l) => s + l.prevPoQty, 0);
    return {
      ...g, required, prevPoQty, thisPo, balanceAfter: required - prevPoQty - thisPo,
      colors: [...new Set(g.lines.map((l) => l.color))], sizes: [...new Set(g.lines.map((l) => l.size))],
      remarks: ctx?.state?.[g.gprId]?.doc.remarks || '',
    };
  });
};
