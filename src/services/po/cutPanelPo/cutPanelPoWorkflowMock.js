/**
 * Cut Panel PO workflow — mock (PRD §16–17). Balance is consumed on the LAST approval
 * (BR-10): ALLOCATE per line, OVERRIDE_ALLOCATE for an authorised excess. Cancel releases
 * everything, short close the unreceived part. Every Submit and Approve re-runs the full
 * checks against the requirement and the vendor as they are now (EC-10, EC-11, VR-20).
 */
import dayjs from 'dayjs';
import { detach, mockDelay, mockError } from '../../bom/requirementMockStore';
import { getCprOrderContext } from '../../bom/cutPanel/cutPanelService';
import { loadJobWorkDb, saveJobWorkDb } from '../jobWork/jobWorkMockStore';
import { actor, now, findPo, expectStatus, addPoAudit, postLedger, releaseLine, withHeld } from '../jobWork/jobWorkMockHelpers';
import { lastRates, duplicatePos } from '../jobWork/jobWorkLookupsMock';
import { cppRequirementState } from './cutPanelPoLookupsMock';
import { validateCpp, approvalLevels, liveCell, coveringOverride } from '../../../utils/cutPanelPoCalc';
import { vendorEligibility } from '../../../utils/vendorEligibility';
import { LEDGER_ENTRY } from '../../../utils/jobWorkAllocation';
import { JW_PO_STATUS as S, JOB_WORK_PO_TYPE as T } from '../../../utils/jobWorkPoStatus';

/** What validateCpp needs, gathered as the server will: requirements, order dates, vendor, rates, duplicates. */
export const cppContext = async (doc, { ownAllocation = null } = {}) => {
  const lines = doc.lines.filter((l) => Number(l.poQty) > 0);
  const cprIds = [...new Set(lines.map((l) => l.cprId))];
  const label = doc.process?.label ?? doc.process?.name;
  const orders = await Promise.all([...new Set(lines.map((l) => l.orderId))].map((id) => getCprOrderContext(id)));
  const vendor = doc.vendor;
  const rates = vendor ? await lastRates({ type: T.CPP, gstin: vendor.gstin, processLabel: label }) : { byKey: {}, recent: [] };
  return {
    state: await cppRequirementState(cprIds),
    orderDue: Object.fromEntries(orders.filter(Boolean).map((o) => [o.id, o.deliveryDate])),
    orderStatus: Object.fromEntries(orders.filter(Boolean).map((o) => [o.id, o.status])),
    eligibility: vendor ? vendorEligibility(vendor, { processId: doc.process?.id ?? null, processLabel: label, onDate: dayjs() }) : null,
    lastRates: rates.byKey,
    recentRates: rates.recent,
    duplicates: vendor ? await duplicatePos({ type: T.CPP, gstin: vendor.gstin, processLabel: label, reqIds: cprIds, poDate: doc.poDate, exceptId: doc.id }) : [],
    ownAllocation,
  };
};

const fail = (blocking) => {
  const err = mockError(blocking[0], 422);
  err.response.data.errors = blocking;
  throw err;
};

const commit = (db, doc, action, details) => {
  doc.version = (doc.version || 1) + 1;
  addPoAudit(db, doc.id, action, details);
  saveJobWorkDb(db);
  return detach(withHeld(db, doc));
};

const open = async (id, statuses, message) => {
  await mockDelay();
  const db = loadJobWorkDb();
  const doc = findPo(db, id, T.CPP);
  expectStatus(doc, statuses, message);
  return { db, doc, who: actor() };
};

const needReason = (text, what) => { if (!String(text || '').trim()) throw mockError(`${what} needs a reason.`); };

/** Allocation at the last approval: the balance first, any authorised excess as OVERRIDE_ALLOCATE. */
export const allocateLines = (db, doc, ctx) => doc.lines.forEach((l) => {
  const cell = liveCell(l, ctx.state);
  const balance = Math.max(0, cell.required - cell.allocated + (ctx.ownAllocation?.[l.key] || 0));
  const qty = Number(l.poQty);
  const normal = Math.min(qty, balance);
  const o = coveringOverride(doc, l, qty - balance);
  postLedger(db, doc, l, LEDGER_ENTRY.ALLOCATE, normal);
  postLedger(db, doc, l, LEDGER_ENTRY.OVERRIDE_ALLOCATE, qty - normal, { reasonCode: o?.reasonCode, remark: o?.justification });
});

/** POST /cut-panel-po/{id}/submit — the levels are fixed here from the PO value (§16.2). */
export const submitCpp = async (id) => {
  const { db, doc, who } = await open(id, [S.DRAFT], 'Only a draft can be submitted.');
  const { blocking } = validateCpp(doc, await cppContext(doc));
  if (blocking.length) fail(blocking);
  const levels = approvalLevels(doc);
  Object.assign(doc, { status: S.SUBMITTED, submittedBy: who.name, submittedByUser: who.username, submittedOn: now(), levelNames: levels, requiredLevels: levels.length, approvals: [] });
  return commit(db, doc, 'submitted the PO for approval', `${levels.length} level(s): ${levels.join(' → ')}`);
};

/** POST /cut-panel-po/{id}/recall — the creator takes a submitted PO back to Draft. */
export const recallCpp = async (id) => {
  const { db, doc, who } = await open(id, [S.SUBMITTED], 'Only a submitted PO can be recalled.');
  if (doc.createdByUser !== who.username && !who.superuser) throw mockError('Only the creator can recall this PO.', 403);
  Object.assign(doc, { status: S.DRAFT, approvals: [] });
  return commit(db, doc, 'recalled the PO to Draft');
};

/**
 * POST /cut-panel-po/{id}/approve — one level per call. The creator never approves (BR-15)
 * and one person approves one level, except a superuser (deviation D21, logged).
 */
export const approveCpp = async (id, remark = '') => {
  const { db, doc, who } = await open(id, [S.SUBMITTED], 'Only a submitted PO can be approved.');
  const self = doc.createdByUser === who.username;
  if (self && !who.superuser) throw mockError('You raised this PO, so you cannot approve it (BR-15).', 403);
  if (!who.superuser && doc.approvals.some((a) => a.byUser === who.username)) throw mockError('You approved an earlier level; the next level needs another approver.', 409);
  const ctx = { ...(await cppContext(doc)), stage: 'approve' };
  const { blocking } = validateCpp(doc, ctx);
  if (blocking.length) fail(blocking);
  const level = doc.approvals.length + 1;
  doc.approvals.push({ level, name: doc.levelNames?.[level - 1] ?? `Level ${level}`, by: who.name, byUser: who.username, at: now(), remark, selfApproved: self });
  const note = self ? ' · self-approved (superuser)' : '';
  if (level < doc.requiredLevels) return commit(db, doc, `approved level ${level} of ${doc.requiredLevels}`, `${remark}${note}`);
  allocateLines(db, doc, ctx);
  Object.assign(doc, { status: S.APPROVED, approvedBy: who.name, approvedOn: now() });
  return commit(db, doc, 'approved the PO', `Allocation committed on ${doc.lines.length} line(s)${note}`);
};

/** POST /cut-panel-po/{id}/send-back — back to Draft with the approver's note; nothing was allocated. */
export const sendBackCpp = async (id, note) => {
  needReason(note, 'Sending back');
  const { db, doc } = await open(id, [S.SUBMITTED], 'Only a submitted PO can be sent back.');
  Object.assign(doc, { status: S.DRAFT, approvals: [], sendBackNote: note });
  return commit(db, doc, 'sent the PO back for correction', note);
};

/** POST /cut-panel-po/{id}/reject — terminal; a fresh PO must be raised. */
export const rejectCpp = async (id, reason) => {
  needReason(reason, 'Rejecting');
  const { db, doc, who } = await open(id, [S.SUBMITTED], 'Only a submitted PO can be rejected.');
  Object.assign(doc, { status: S.REJECTED, closeRemark: reason, closedBy: who.name, closedOn: now() });
  return commit(db, doc, 'rejected the PO', reason);
};

/** POST /cut-panel-po/{id}/send — VR-17: a reference must be linked where the process needs artwork. */
export const sendCppToVendor = async (id) => {
  const { db, doc } = await open(id, [S.APPROVED], 'Only an approved PO can be sent to the vendor.');
  if (doc.process?.artworkRequired && !(doc.references || []).length) {
    throw mockError(`${doc.process.name} needs an artwork or placement reference linked before the PO goes to the vendor (VR-17).`, 422);
  }
  Object.assign(doc, { status: S.SENT_TO_VENDOR, sentOn: now() });
  return commit(db, doc, 'sent the PO to the vendor', doc.vendor?.name);
};

const received = (doc) => doc.lines.some((l) => Number(l.receivedQty) > 0);

/** POST /cut-panel-po/{id}/cancel — before any receipt; releases the whole allocation (BR-18, AC-18). */
export const cancelCpp = async (id, { reasonCode, remark }) => {
  needReason(reasonCode && remark, 'Cancelling (reason code and remark)');
  const { db, doc, who } = await open(id, [S.DRAFT, S.SUBMITTED, S.APPROVED, S.SENT_TO_VENDOR], 'This PO can no longer be cancelled.');
  if (received(doc)) throw mockError('Panels have been received on this PO — close it short instead (VR-19).', 409);
  doc.lines.forEach((l) => releaseLine(db, doc, l, 0, { reasonCode, remark }));
  Object.assign(doc, { status: S.CANCELLED, pendingRevision: null, closeReasonCode: reasonCode, closeRemark: remark, closedBy: who.name, closedOn: now() });
  return commit(db, doc, 'cancelled the PO', remark);
};

/** POST /cut-panel-po/{id}/short-close — releases allocated less received back to the CPR (BR-18, AC-17). */
export const shortCloseCpp = async (id, { reasonCode, remark }) => {
  needReason(reasonCode && remark, 'Closing short (reason code and remark)');
  const { db, doc, who } = await open(id, [S.APPROVED, S.SENT_TO_VENDOR, S.PARTIALLY_COMPLETED, S.COMPLETED], 'Only an issued PO can be closed short.');
  doc.lines.forEach((l) => releaseLine(db, doc, l, Number(l.receivedQty) || 0, { reasonCode, remark }));
  Object.assign(doc, { status: S.CLOSED, pendingRevision: null, closeReasonCode: reasonCode, closeRemark: remark, closedBy: who.name, closedOn: now() });
  return commit(db, doc, 'closed the PO short', remark);
};

/** POST /cut-panel-po/{id}/lines/{key}/override — the requester asks; nothing is allowed yet (§14.4). */
export const requestCppOverride = async (id, { lineKey, excessQty, reasonCode, justification }) => {
  needReason(reasonCode && justification, 'An override (reason code and justification)');
  const { db, doc, who } = await open(id, [S.DRAFT], 'Overrides are requested on a draft.');
  if (!doc.lines.some((l) => l.key === lineKey) || !(excessQty > 0)) throw mockError('Nothing on that line exceeds its balance.');
  doc.overrides = doc.overrides.filter((o) => o.lineKey !== lineKey);
  doc.overrides.push({
    id: `O${Date.now()}`, type: 'OVER_ALLOCATION', lineKey, excessQty, reasonCode, justification,
    requestedBy: who.name, requestedByUser: who.username, requestedAt: now(), status: 'REQUESTED',
  });
  return commit(db, doc, 'requested an over-allocation override', `${lineKey} +${excessQty} · ${justification}`);
};

/** POST /cut-panel-po/{id}/overrides/{oid}/authorise — never by the requester (a superuser may, logged). */
export const authoriseCppOverride = async (id, overrideId) => {
  const { db, doc, who } = await open(id, [S.DRAFT], 'Overrides are authorised before the PO is submitted.');
  const o = doc.overrides.find((x) => x.id === overrideId && x.status === 'REQUESTED');
  if (!o) throw mockError('That override is not awaiting authorisation.', 409);
  const self = o.requestedByUser === who.username;
  if (self && !who.superuser) throw mockError('You requested this override, so someone else must authorise it.', 403);
  Object.assign(o, { status: 'AUTHORISED', authorisedBy: who.name, authorisedByUser: who.username, authorisedAt: now(), selfAuthorised: self });
  return commit(db, doc, 'authorised an over-allocation override', `${o.lineKey} +${o.excessQty}${self ? ' · self-authorised (superuser)' : ''}`);
};
