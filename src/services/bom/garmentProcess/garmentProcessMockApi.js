/**
 * Garment Process Requirement — mock API (UI design phase), persisted to localStorage.
 * Each function names the endpoint it stands in for (PRD §18.1).
 *
 * Partially / Fully Used and consumedQty are derived on every read from the job-work PO
 * ledger (Garment Process PO PRD §10) and never stored: the store keeps Draft, Submitted or Closed.
 */
import { loadMockStore, saveMockStore, detach, mockDelay, mockError } from '../requirementMockStore';
import { usageInputs, posForRequirement } from '../../po/jobWork/allocationReader';
import { requirementUsage, REQUIREMENT_SOURCE } from '../../../utils/jobWorkAllocation';
import { getMockOrderContext, getMockGprEligibleOrders } from '../requirementMockOrders';
import { buildGprSeed, GPR_SEED_VERSION, GPR_STORAGE_KEY } from './garmentProcessMockData';
import { gprLineLabel, gprLineTotals, toSavedLine, validateGpr } from '../../../utils/garmentProcessCalc';
import { GPR_PREFIX, GPR_VAL } from '../../../utils/garmentProcessConstants';
import {
  nextRequirementNumber, isRequirementEditable, isRequirementEditableInPlace, isRequirementClosable, REQUIREMENT_STATUS,
} from '../../../utils/requirementStatus';
import { canSubmitGarmentProcessOverQty } from '../../../utils/permissions';
import { getCurrentFinancialYear } from '../../../utils/numbering';
import { getCurrentUser } from '../../auth/authService';

const load = () => loadMockStore(GPR_STORAGE_KEY, GPR_SEED_VERSION, buildGprSeed);
const persist = (db) => saveMockStore(GPR_STORAGE_KEY, db);
const who = () => getCurrentUser()?.name || getCurrentUser()?.username || 'You';
const now = () => new Date().toISOString();
const fyStartYear = () => `20${getCurrentFinancialYear().slice(0, 2)}`;

/**
 * The document as the PO ledger leaves it: derived status, consumed (allocated) qty and the
 * placed POs that end editing it in place.
 */
const live = (doc, inputs = usageInputs(REQUIREMENT_SOURCE.GPR)) => {
  const usage = requirementUsage(REQUIREMENT_SOURCE.GPR, doc, inputs);
  return { ...doc, status: usage.status, consumedQty: usage.consumedQty, placedPos: inputs.placed.get(doc.id) || [] };
};

/** Derived fields never reach the store. */
const stored = (doc) => {
  const out = { ...doc };
  delete out.consumedQty;
  delete out.placedPos;
  return out;
};

const findDoc = (db, id) => {
  const doc = db.docs.find((d) => d.id === Number(id));
  if (!doc) throw mockError('Garment process requirement not found', 404);
  return doc;
};

const addAudit = (db, id, action, details) => {
  const rows = db.audits[id] || [];
  db.audits[id] = [{ id: `a${id}-${rows.length + 1}`, type: 'user', user: who(), action, details, timestamp: now() }, ...rows];
};

const lineSummaries = (d) => {
  const order = getMockOrderContext(d.orderId);
  return d.lines.map((l) => ({ label: gprLineLabel(l) || '—', total: order ? gprLineTotals(l, order).total : 0 }));
};

/** Lines added, removed, moved, re-processed or re-quantified, for a revision's audit row. */
const lineChanges = (before, after) => {
  const old = new Map(before.map((l) => [l.key, l]));
  const has = new Set(after.map((l) => l.key));
  return [
    ...after.flatMap((l) => {
      const b = old.get(l.key);
      if (!b) return [`added Seq ${l.seqNo} ${gprLineLabel(l)}`];
      return [
        gprLineLabel(b) !== gprLineLabel(l) && `Seq ${l.seqNo}: ${gprLineLabel(b)} → ${gprLineLabel(l)}`,
        b.seqNo !== l.seqNo && `${gprLineLabel(l)}: Seq ${b.seqNo} → ${l.seqNo}`,
        JSON.stringify(b.qty) !== JSON.stringify(l.qty) && `Seq ${l.seqNo} ${gprLineLabel(l)}: quantities changed`,
      ].filter(Boolean);
    }),
    ...before.filter((b) => !has.has(b.key)).map((b) => `removed ${gprLineLabel(b)}`),
  ];
};

const overQtyNotes = (lines) => lines.flatMap((l) => Object.entries(l.overQtyReasons || {})
  .map(([cell, r]) => `Seq ${l.seqNo} ${cell.replace('|', ' ')}: ${r}`));

const summary = (d) => ({
  id: d.id, requirementNo: d.requirementNo, orderId: d.orderId, orderNo: d.orderNo, styleNo: d.styleNo, buyer: d.buyer,
  lines: lineSummaries(d), status: d.status, placedPos: d.placedPos, createdBy: d.createdBy, createdOn: d.createdOn,
});

/** GET /gpr — newest first; filters run client-side in the mock. */
export const listGprs = async () => {
  await mockDelay();
  const inputs = usageInputs(REQUIREMENT_SOURCE.GPR);
  return detach(load().docs.map((d) => summary(live(d, inputs))).reverse());
};

/** GET /gpr/{id} */
export const getGpr = async (id) => { await mockDelay(); return detach(live(findDoc(load(), id))); };

/** The order's other open requirements, with per-line totals (PRD OP-2). */
export const getGprsForOrder = async (orderId, exceptId) => {
  const inputs = usageInputs(REQUIREMENT_SOURCE.GPR);
  return detach(load().docs
    .filter((d) => d.orderId === Number(orderId) && d.id !== Number(exceptId) && d.status !== REQUIREMENT_STATUS.CLOSED)
    .map((d) => summary(live(d, inputs))));
};

/** GET /api/gpr/{id}/allocation — per-cell usage and the POs raised against it (GPO PRD FR-20). */
export const getGprAllocation = async (id) => {
  await mockDelay(150);
  const doc = findDoc(load(), id);
  const usage = requirementUsage(REQUIREMENT_SOURCE.GPR, doc, usageInputs(REQUIREMENT_SOURCE.GPR));
  return detach({ doc: { ...doc, status: usage.status }, usage, pos: posForRequirement(REQUIREMENT_SOURCE.GPR, doc.id) });
};

/** Confirmed, non-cancelled orders. */
export const getGprEligibleOrders = async () => { await mockDelay(150); return getMockGprEligibleOrders(); };

/** GET /orders/{id}/process-matrix */
export const getGprOrderContext = async (orderId) => { await mockDelay(150); return getMockOrderContext(orderId); };

/** POST /gpr (number on first save) · PUT /gpr/{id} (whole-document save, Draft only). */
export const saveGpr = async (doc) => {
  await mockDelay();
  const db = load();
  const order = getMockOrderContext(doc.orderId);
  if (!order) throw mockError(GPR_VAL.V1);
  const lines = doc.lines.map((l) => toSavedLine(l, order));
  if (!doc.id) {
    const requirementNo = nextRequirementNumber(GPR_PREFIX, fyStartYear(), db.issuedNos);
    const created = { ...stored(doc), lines, id: db.nextId, requirementNo, status: REQUIREMENT_STATUS.DRAFT, createdBy: who(), createdOn: now(), version: 1 };
    db.nextId += 1;
    db.issuedNos.push(requirementNo);
    db.docs.push(created);
    addAudit(db, created.id, `created ${requirementNo}`, `${doc.orderNo} · ${lines.length} process line(s)`);
    persist(db);
    return detach(live(created));
  }
  const existing = findDoc(db, doc.id);
  if (!isRequirementEditable(existing.status)) throw mockError('Only a draft is saved this way — a submitted requirement changes with Edit.', 409);
  const saved = { ...existing, ...stored(doc), lines, status: existing.status, version: existing.version + 1, modifiedBy: who(), modifiedOn: now() };
  db.docs = db.docs.map((d) => (d.id === saved.id ? saved : d));
  addAudit(db, saved.id, 'saved the draft', `${lines.length} process line(s)`);
  persist(db);
  return detach(live(saved));
};

/** POST /gpr/{id}/submit — snapshots each cell's order qty; over-qty reasons are logged. */
export const submitGpr = async (id) => {
  await mockDelay();
  const db = load();
  const doc = findDoc(db, id);
  if (!isRequirementEditable(doc.status)) throw mockError('Only a draft can be submitted.', 409);
  const order = getMockOrderContext(doc.orderId);
  const reasons = overQtyNotes(doc.lines);
  Object.assign(doc, {
    status: REQUIREMENT_STATUS.SUBMITTED, submittedBy: who(), submittedOn: now(), version: doc.version + 1,
    orderQtySnapshot: JSON.parse(JSON.stringify(order.qtyMatrix)),
  });
  addAudit(db, doc.id, 'submitted the requirement', `Released to the PO module · ${doc.lines.length} process(es)${reasons.length ? ` · Above order qty: ${reasons.join('; ')}` : ''}`);
  persist(db);
  return detach(live(doc));
};

/**
 * POST /gpr/{id}/revise — edits a submitted GPR in place, until a PO against it is placed.
 * It stays Submitted, passes Submit's checks again and re-snapshots the order qty; draft POs
 * on it are flagged and re-fetch. The order cannot change.
 */
export const reviseGpr = async (doc) => {
  await mockDelay();
  const db = load();
  const existing = findDoc(db, doc.id);
  const current = live(existing);
  if (!isRequirementEditableInPlace(current.status, current.placedPos)) throw mockError(GPR_VAL.LOCKED, 409);
  const order = getMockOrderContext(existing.orderId);
  const { errors } = validateGpr({ ...doc, orderId: existing.orderId }, order, { forSubmit: true, canOverQty: canSubmitGarmentProcessOverQty() });
  if (errors.length) throw mockError(errors[0], 422);
  const lines = doc.lines.map((l) => toSavedLine(l, order));
  if (JSON.stringify(lines) === JSON.stringify(existing.lines) && (doc.remarks || '') === (existing.remarks || '')) {
    throw mockError('The revision changes nothing yet.', 422);
  }
  const changes = lineChanges(existing.lines, lines);
  const reasons = overQtyNotes(lines);
  const revisionNo = (existing.revisionNo || 0) + 1;
  Object.assign(existing, {
    lines, lastLineNo: doc.lastLineNo ?? existing.lastLineNo, remarks: doc.remarks, orderQtySnapshot: JSON.parse(JSON.stringify(order.qtyMatrix)),
    version: existing.version + 1, revisionNo, modifiedBy: who(), modifiedOn: now(),
  });
  addAudit(db, existing.id, `revised the requirement (R${revisionNo})`,
    [changes.join('; ') || 'Remarks changed', reasons.length && `Above order qty: ${reasons.join('; ')}`].filter(Boolean).join(' · '));
  persist(db);
  return detach(live(existing));
};

/** POST /gpr/{id}/close — releases the unconsumed balance; reason mandatory. */
export const closeGpr = async (id, reason) => {
  await mockDelay();
  const db = load();
  const doc = findDoc(db, id);
  const current = live(doc);
  if (!isRequirementClosable(current.status)) throw mockError('Only a submitted or partially used requirement can be closed.', 409);
  Object.assign(doc, { status: REQUIREMENT_STATUS.CLOSED, closeReason: reason, closedBy: who(), closedOn: now(), version: doc.version + 1 });
  addAudit(db, doc.id, 'closed the requirement', reason);
  persist(db);
  return detach(live(doc));
};

export const getGprAudit = async (id) => { await mockDelay(150); return detach(load().audits[id] || []); };
