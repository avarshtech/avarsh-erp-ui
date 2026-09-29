/**
 * Cut Panel Requirement — mock API (UI design phase), persisted to localStorage.
 * Each function names the endpoint it stands in for (PRD §17, without /approve and
 * /reject — there is no approval step; /revise edits a submitted CPR in place instead).
 *
 * Partially / Fully Used and consumedQty are derived on every read from the job-work PO
 * ledger (Cut Panel PO PRD §15) and never stored: the store keeps Draft, Submitted or Closed.
 */
import { loadMockStore, saveMockStore, detach, mockDelay, mockError } from '../requirementMockStore';
import { usageInputs, posForRequirement } from '../../po/jobWork/allocationReader';
import { requirementUsage, REQUIREMENT_SOURCE } from '../../../utils/jobWorkAllocation';
import { getMockOrderContext, getMockCprEligibleOrders } from '../requirementMockOrders';
import { buildCprSeed, CPR_SEED_VERSION, CPR_STORAGE_KEY } from './cutPanelMockData';
import { lineTotal, processLabel, runPreSubmitChecks } from '../../../utils/cutPanelCalc';
import { CPR_PREFIX, CPR_VAL } from '../../../utils/cutPanelConstants';
import {
  nextRequirementNumber, isRequirementEditable, isRequirementEditableInPlace, isRequirementClosable,
} from '../../../utils/requirementStatus';
import { getCurrentFinancialYear } from '../../../utils/numbering';
import { getCurrentUser } from '../../auth/authService';

const load = () => loadMockStore(CPR_STORAGE_KEY, CPR_SEED_VERSION, buildCprSeed);
const persist = (db) => saveMockStore(CPR_STORAGE_KEY, db);
const who = () => getCurrentUser()?.name || getCurrentUser()?.username || 'You';
const now = () => new Date().toISOString();
const fyStartYear = () => `20${getCurrentFinancialYear().slice(0, 2)}`;

/**
 * The document as the PO ledger leaves it: derived status, consumed (allocated) qty and the
 * placed POs that end editing it in place.
 */
const live = (doc, inputs = usageInputs(REQUIREMENT_SOURCE.CPR)) => {
  const usage = requirementUsage(REQUIREMENT_SOURCE.CPR, doc, inputs);
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
  if (!doc) throw mockError('Cut panel requirement not found', 404);
  return doc;
};

const addAudit = (db, id, action, details) => {
  const rows = db.audits[id] || [];
  db.audits[id] = [{ id: `a${id}-${rows.length + 1}`, type: 'user', user: who(), action, details, timestamp: now() }, ...rows];
};

/** Quantity changes between two saves of the same CPR, for the audit trail (PRD §19). */
const qtyChanges = (before, after) => {
  const prev = Object.fromEntries((before || []).map((l) => [l.key, l]));
  const out = [];
  after.forEach((l) => {
    const p = prev[l.key];
    if (!p) return;
    Object.entries(l.sizes).forEach(([size, c]) => {
      const was = p.sizes[size]?.requiredQty;
      if (was !== undefined && Number(was) !== Number(c.requiredQty)) {
        out.push(`${l.colorName} ${l.panelName} ${processLabel(l)} ${size}: ${was} → ${c.requiredQty}`);
      }
    });
  });
  return out;
};

/** Lines added or removed and quantity changes, for a revision's audit row. */
const lineChanges = (before, after) => {
  const label = (l) => `${l.fabricName} ${l.colorName} ${l.panelName} ${processLabel(l)}`;
  const had = new Set(before.map((l) => l.key));
  const has = new Set(after.map((l) => l.key));
  return [
    ...after.filter((l) => !had.has(l.key)).map((l) => `added ${label(l)}`),
    ...before.filter((l) => !has.has(l.key)).map((l) => `removed ${label(l)}`),
    ...qtyChanges(before, after),
  ];
};

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** What a revision may change; the order, BOM version and header stay as submitted. */
const REVISED_FIELDS = ['lines', 'lastLineNo', 'remarks', 'orderQtySnapshot'];

const summary = (d) => ({
  id: d.id, cprNo: d.cprNo, orderId: d.orderId, orderNo: d.orderNo, buyer: d.buyer, styleNo: d.styleNo,
  fabrics: [...new Set(d.lines.map((l) => l.fabricName))],
  colorCount: new Set(d.lines.map((l) => l.colorName)).size,
  processCount: new Set(d.lines.map(processLabel)).size,
  totalQty: d.lines.reduce((s, l) => s + lineTotal(l), 0),
  status: d.status, placedPos: d.placedPos, createdBy: d.createdBy, createdOn: d.createdOn,
});

/** GET /cut-panel-requirements — newest first; filters run client-side in the mock. */
export const listCprs = async () => {
  await mockDelay();
  const inputs = usageInputs(REQUIREMENT_SOURCE.CPR);
  return detach(load().docs.map((d) => summary(live(d, inputs))).reverse());
};

/** GET /cut-panel-requirements/{id} */
export const getCpr = async (id) => { await mockDelay(); return detach(live(findDoc(load(), id))); };

/** Other requirements on the same order (WRN-07). */
export const getCprsForOrder = async (orderId, exceptId) => {
  const inputs = usageInputs(REQUIREMENT_SOURCE.CPR);
  return detach(load().docs
    .filter((d) => d.orderId === Number(orderId) && d.id !== Number(exceptId))
    .map((d) => ({ id: d.id, cprNo: d.cprNo, status: live(d, inputs).status })));
};

/** GET /cut-panel-requirements/{id}/allocation — per-cell usage and the POs raised against it (FR-27). */
export const getCprAllocation = async (id) => {
  await mockDelay(150);
  const doc = findDoc(load(), id);
  const usage = requirementUsage(REQUIREMENT_SOURCE.CPR, doc, usageInputs(REQUIREMENT_SOURCE.CPR));
  return detach({ doc: { ...doc, status: usage.status }, usage, pos: posForRequirement(REQUIREMENT_SOURCE.CPR, doc.id) });
};

/** GET /orders/approved-bom */
export const getCprEligibleOrders = async () => { await mockDelay(150); return getMockCprEligibleOrders(); };

/** GET /orders/{orderId}/context + GET /bom/{bomId}/fabrics */
export const getCprOrderContext = async (orderId) => { await mockDelay(150); return getMockOrderContext(orderId); };

/** POST /cut-panel-requirements (number on first save) · PUT /cut-panel-requirements/{id} */
export const saveCpr = async (doc) => {
  await mockDelay();
  const db = load();
  if (!doc.orderId) throw mockError(CPR_VAL.VAL_01);
  if (!doc.id) {
    const cprNo = nextRequirementNumber(CPR_PREFIX, fyStartYear(), db.issuedNos);
    const created = { ...stored(doc), id: db.nextId, cprNo, status: 'DRAFT', createdBy: who(), createdOn: now(), version: 1 };
    db.nextId += 1;
    db.issuedNos.push(cprNo);
    db.docs.push(created);
    addAudit(db, created.id, `created ${cprNo}`, `${doc.orderNo} · BOM ${doc.bomVersion} · ${doc.lines.length} line(s)`);
    persist(db);
    return detach(live(created));
  }
  const existing = findDoc(db, doc.id);
  if (!isRequirementEditable(existing.status)) throw mockError('Only a draft is saved this way — a submitted requirement changes with Edit.', 409);
  const changes = qtyChanges(existing.lines, doc.lines);
  const saved = { ...existing, ...stored(doc), status: existing.status, version: existing.version + 1, modifiedBy: who(), modifiedOn: now() };
  db.docs = db.docs.map((d) => (d.id === saved.id ? saved : d));
  addAudit(db, saved.id, 'saved the draft', changes.length ? `Quantity changes: ${changes.slice(0, 8).join('; ')}${changes.length > 8 ? ` (+${changes.length - 8} more)` : ''}` : `${doc.lines.length} line(s)`);
  persist(db);
  return detach(live(saved));
};

/** POST /cut-panel-requirements/{id}/submit — the screen saves first, then submits. */
export const submitCpr = async (id) => {
  await mockDelay();
  const db = load();
  const doc = findDoc(db, id);
  if (!isRequirementEditable(doc.status)) throw mockError('Only a draft can be submitted.', 409);
  if (!doc.lines.length) throw mockError(CPR_VAL.VAL_04);
  Object.assign(doc, { status: 'SUBMITTED', submittedBy: who(), submittedOn: now(), version: doc.version + 1 });
  addAudit(db, doc.id, 'submitted the requirement', `Released to the PO module · ${doc.lines.length} line(s) · ${doc.lines.reduce((s, l) => s + lineTotal(l), 0).toLocaleString('en-IN')} pcs`);
  persist(db);
  return detach(live(doc));
};

/**
 * POST /cut-panel-requirements/{id}/revise — edits a submitted CPR in place, until a PO
 * against it is placed. It stays Submitted and passes Submit's checks again; draft POs on
 * it are flagged and re-fetch.
 */
export const reviseCpr = async (doc) => {
  await mockDelay();
  const db = load();
  const existing = findDoc(db, doc.id);
  const current = live(existing);
  if (!isRequirementEditableInPlace(current.status, current.placedPos)) throw mockError(CPR_VAL.VAL_10, 409);
  const { blocking } = runPreSubmitChecks(doc.lines, getMockOrderContext(existing.orderId), existing.orderAllowancePct);
  if (blocking.length) throw mockError(blocking[0], 422);
  if (REVISED_FIELDS.every((f) => same(existing[f], doc[f]))) throw mockError('The revision changes nothing yet.', 422);
  const changes = lineChanges(existing.lines, doc.lines);
  const revisionNo = (existing.revisionNo || 0) + 1;
  Object.assign(existing, Object.fromEntries(REVISED_FIELDS.map((f) => [f, doc[f]])), {
    version: existing.version + 1, revisionNo, modifiedBy: who(), modifiedOn: now(),
  });
  addAudit(db, existing.id, `revised the requirement (R${revisionNo})`, changes.length
    ? `${changes.slice(0, 8).join('; ')}${changes.length > 8 ? ` (+${changes.length - 8} more)` : ''}`
    : 'Sequence, allowance or reason changes');
  persist(db);
  return detach(live(existing));
};

/** POST /cut-panel-requirements/{id}/close — reason is permanent (BR-16). */
export const closeCpr = async (id, reason) => {
  await mockDelay();
  const db = load();
  const doc = findDoc(db, id);
  const current = live(doc);
  if (!isRequirementClosable(current.status)) throw mockError('Only a submitted or partially used requirement can be closed.', 409);
  Object.assign(doc, { status: 'CLOSED', closeReason: reason, closedBy: who(), closedOn: now(), version: doc.version + 1 });
  addAudit(db, doc.id, 'closed the requirement', reason);
  persist(db);
  return detach(live(doc));
};

/** DELETE /cut-panel-requirements/{id} — Draft only; the number is never reused. */
export const deleteCpr = async (id) => {
  await mockDelay();
  const db = load();
  const doc = findDoc(db, id);
  if (!isRequirementEditable(doc.status)) throw mockError('Only a draft can be deleted.', 409);
  db.docs = db.docs.filter((d) => d.id !== doc.id);
  persist(db);
};

/** Audit trail, newest first (PRD §19). */
export const getCprAudit = async (id) => { await mockDelay(150); return detach(load().audits[id] || []); };
