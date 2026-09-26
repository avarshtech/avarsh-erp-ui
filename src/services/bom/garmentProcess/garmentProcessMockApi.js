/**
 * Garment Process Requirement — mock API (UI design phase), persisted to localStorage.
 * Each function names the endpoint it stands in for (PRD §18.1).
 */
import { loadMockStore, saveMockStore, detach, mockDelay, mockError } from '../requirementMockStore';
import { getMockOrderContext, getMockGprEligibleOrders } from '../requirementMockOrders';
import { buildGprSeed, GPR_SEED_VERSION, GPR_STORAGE_KEY } from './garmentProcessMockData';
import { gprLineLabel, gprLineTotals, toSavedLine } from '../../../utils/garmentProcessCalc';
import { GPR_PREFIX, GPR_VAL } from '../../../utils/garmentProcessConstants';
import {
  nextRequirementNumber, isRequirementEditable, isRequirementReopenable, isRequirementClosable, REQUIREMENT_STATUS,
} from '../../../utils/requirementStatus';
import { getCurrentFinancialYear } from '../../../utils/numbering';
import { getCurrentUser } from '../../auth/authService';

const load = () => loadMockStore(GPR_STORAGE_KEY, GPR_SEED_VERSION, buildGprSeed);
const persist = (db) => saveMockStore(GPR_STORAGE_KEY, db);
const who = () => getCurrentUser()?.name || getCurrentUser()?.username || 'You';
const now = () => new Date().toISOString();
const fyStartYear = () => `20${getCurrentFinancialYear().slice(0, 2)}`;

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

const summary = (d) => ({
  id: d.id, requirementNo: d.requirementNo, orderId: d.orderId, orderNo: d.orderNo, styleNo: d.styleNo, buyer: d.buyer,
  lines: lineSummaries(d), status: d.status, createdBy: d.createdBy, createdOn: d.createdOn,
});

/** GET /gpr — newest first; filters run client-side in the mock. */
export const listGprs = async () => { await mockDelay(); return detach(load().docs.map(summary).reverse()); };

/** GET /gpr/{id} */
export const getGpr = async (id) => { await mockDelay(); return detach(findDoc(load(), id)); };

/** The order's other open requirements, with per-line totals (PRD OP-2). */
export const getGprsForOrder = async (orderId, exceptId) => detach(load().docs
  .filter((d) => d.orderId === Number(orderId) && d.id !== Number(exceptId) && d.status !== REQUIREMENT_STATUS.CLOSED)
  .map(summary));

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
    const created = { ...doc, lines, id: db.nextId, requirementNo, status: REQUIREMENT_STATUS.DRAFT, createdBy: who(), createdOn: now(), version: 1, consumedQty: 0 };
    db.nextId += 1;
    db.issuedNos.push(requirementNo);
    db.docs.push(created);
    addAudit(db, created.id, `created ${requirementNo}`, `${doc.orderNo} · ${lines.length} process line(s)`);
    persist(db);
    return detach(created);
  }
  const existing = findDoc(db, doc.id);
  if (!isRequirementEditable(existing.status)) throw mockError('This requirement is submitted and can no longer be edited.', 409);
  const saved = { ...existing, ...doc, lines, status: existing.status, version: existing.version + 1, modifiedBy: who(), modifiedOn: now() };
  db.docs = db.docs.map((d) => (d.id === saved.id ? saved : d));
  addAudit(db, saved.id, 'saved the draft', `${lines.length} process line(s)`);
  persist(db);
  return detach(saved);
};

/** POST /gpr/{id}/submit — snapshots each cell's order qty; over-qty reasons are logged. */
export const submitGpr = async (id) => {
  await mockDelay();
  const db = load();
  const doc = findDoc(db, id);
  if (!isRequirementEditable(doc.status)) throw mockError('Only a draft can be submitted.', 409);
  const order = getMockOrderContext(doc.orderId);
  const reasons = doc.lines.flatMap((l) => Object.entries(l.overQtyReasons || {}).map(([cell, r]) => `Seq ${l.seqNo} ${cell.replace('|', ' ')}: ${r}`));
  Object.assign(doc, {
    status: REQUIREMENT_STATUS.SUBMITTED, submittedBy: who(), submittedOn: now(), version: doc.version + 1,
    orderQtySnapshot: JSON.parse(JSON.stringify(order.qtyMatrix)),
  });
  addAudit(db, doc.id, 'submitted the requirement', `Released to the PO module · ${doc.lines.length} process(es)${reasons.length ? ` · Above order qty: ${reasons.join('; ')}` : ''}`);
  persist(db);
  return detach(doc);
};

/** POST /gpr/{id}/reopen — only with zero consumption (PRD OP-1). */
export const reopenGpr = async (id) => {
  await mockDelay();
  const db = load();
  const doc = findDoc(db, id);
  if (!isRequirementReopenable(doc.status, doc.consumedQty)) throw mockError('Only a submitted requirement that no PO has used can be reopened.', 409);
  Object.assign(doc, { status: REQUIREMENT_STATUS.DRAFT, version: doc.version + 1 });
  addAudit(db, doc.id, 'reopened the requirement', 'Lines withdrawn from the PO module; back to Draft');
  persist(db);
  return detach(doc);
};

/** POST /gpr/{id}/close — releases the unconsumed balance; reason mandatory. */
export const closeGpr = async (id, reason) => {
  await mockDelay();
  const db = load();
  const doc = findDoc(db, id);
  if (!isRequirementClosable(doc.status)) throw mockError('Only a submitted or partially used requirement can be closed.', 409);
  Object.assign(doc, { status: REQUIREMENT_STATUS.CLOSED, closeReason: reason, closedBy: who(), closedOn: now(), version: doc.version + 1 });
  addAudit(db, doc.id, 'closed the requirement', reason);
  persist(db);
  return detach(doc);
};

export const getGprAudit = async (id) => { await mockDelay(150); return detach(load().audits[id] || []); };
