/**
 * Garment Process PO workflow — mock (PRD §10, §16–17). Balance is consumed FROM SUBMIT:
 * ALLOCATE per line (the approved excess as OVERRIDE_ALLOCATE) after the balance is
 * re-checked (V15); Recall and Reject return the PO to Draft and release it; Cancel
 * releases everything, short close the unreceived part (AC-10).
 */
import dayjs from 'dayjs';
import { detach, mockDelay, mockError } from '../../bom/requirementMockStore';
import { getGprOrderContext } from '../../bom/garmentProcess/garmentProcessService';
import { loadJobWorkDb, saveJobWorkDb } from '../jobWork/jobWorkMockStore';
import { actor, now, findPo, expectStatus, addPoAudit, postLedger, releaseLine, withHeld } from '../jobWork/jobWorkMockHelpers';
import { lastRates } from '../jobWork/jobWorkLookupsMock';
import { gpoRequirementState } from './garmentProcessPoLookupsMock';
import { validateGpo, gpoLiveCell, approvedExcess, excessCap, gpoLineLabel, GPO_LEVELS } from '../../../utils/garmentProcessPoCalc';
import { vendorEligibility } from '../../../utils/vendorEligibility';
import { LEDGER_ENTRY } from '../../../utils/jobWorkAllocation';
import { JW_PO_STATUS as S, JOB_WORK_PO_TYPE as T } from '../../../utils/jobWorkPoStatus';
import { GPO_EXCESS_CAP_PCT } from '../../../utils/jobWorkConstants';

const n = (v) => Number(v || 0).toLocaleString('en-IN');

/** What validateGpo and the screen need, gathered as the server will: requirements, orders, vendor, rates. */
export const gpoContext = async (doc) => {
  const gprIds = [...new Set(doc.lines.map((l) => l.gprId))];
  const label = doc.lines[0]?.processLabel ?? doc.process?.label ?? null;
  const orders = await Promise.all([...new Set(doc.lines.map((l) => l.orderId))].map((id) => getGprOrderContext(id)));
  const vendor = doc.vendor;
  const rates = vendor && label ? await lastRates({ type: T.GPO, gstin: vendor.gstin, processLabel: label }) : { byKey: {}, recent: [] };
  return {
    state: await gpoRequirementState(gprIds),
    orders: Object.fromEntries(orders.filter(Boolean).map((o) => [o.id, { deliveryDate: o.deliveryDate, status: o.status, garment: o.garmentDescription }])),
    eligibility: vendor ? vendorEligibility(vendor, { processId: doc.process?.id ?? null, processLabel: label ?? undefined, onDate: dayjs() }) : null,
    lastRates: rates.byKey,
    recentRates: rates.recent,
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
  const doc = findPo(db, id, T.GPO);
  expectStatus(doc, statuses, message);
  return { db, doc, who: actor() };
};

const needReason = (text, what) => { if (!String(text || '').trim()) throw mockError(`${what} needs a reason.`); };

const releaseAll = (db, doc, reason) => doc.lines.forEach((l) => releaseLine(db, doc, l, 0, reason));

/** POST /garment-process-po/{id}/submit — balance re-checked (V15), then allocated: the balance first, the approved excess on top. */
export const submitGpo = async (id) => {
  const { db, doc, who } = await open(id, [S.DRAFT], 'Only a draft can be submitted.');
  const ctx = { ...(await gpoContext(doc)), stage: 'submit' };
  const { blocking } = validateGpo(doc, ctx);
  if (blocking.length) fail(blocking);
  doc.lines.forEach((l) => {
    const cell = gpoLiveCell(l, ctx.state);
    const qty = Number(l.poQty);
    const normal = Math.min(qty, Math.max(0, cell.required - cell.allocated));
    const o = approvedExcess(doc, l, qty - normal);
    postLedger(db, doc, l, LEDGER_ENTRY.ALLOCATE, normal);
    postLedger(db, doc, l, LEDGER_ENTRY.OVERRIDE_ALLOCATE, qty - normal, { reasonCode: o?.reasonCode, remark: o?.justification });
  });
  Object.assign(doc, {
    status: S.SUBMITTED, submittedBy: who.name, submittedByUser: who.username, submittedOn: now(),
    levelNames: GPO_LEVELS, requiredLevels: GPO_LEVELS.length, approvals: [], rejectNote: null,
  });
  return commit(db, doc, 'submitted the PO for approval', `${n(doc.lines.reduce((s, l) => s + Number(l.poQty), 0))} pcs allocated to the requirement`);
};

/** POST /garment-process-po/{id}/recall — the creator takes it back to Draft; the allocation is released. */
export const recallGpo = async (id) => {
  const { db, doc, who } = await open(id, [S.SUBMITTED], 'Only a submitted PO can be recalled.');
  if (doc.createdByUser !== who.username && !who.superuser) throw mockError('Only the creator can recall this PO.', 403);
  releaseAll(db, doc, { reasonCode: 'RECALLED', remark: 'Recalled to Draft' });
  Object.assign(doc, { status: S.DRAFT, approvals: [] });
  return commit(db, doc, 'recalled the PO to Draft', 'Allocation released');
};

/**
 * POST /garment-process-po/{id}/approve — the Purchase Manager, never the creator (a
 * superuser may, logged — deviation D21). An unapproved or untagged job worker needs the
 * approver's explicit sign-off (§13), recorded on the PO.
 */
export const approveGpo = async (id, { signOff = false, acknowledged = [], remark = '' } = {}) => {
  const { db, doc, who } = await open(id, [S.SUBMITTED], 'Only a submitted PO can be approved.');
  const self = [doc.createdByUser, doc.modifiedByUser, doc.submittedByUser].includes(who.username);
  if (self && !who.superuser) throw mockError('You raised, edited or submitted this PO, so you cannot approve it.', 403);
  const ctx = await gpoContext(doc);
  const issues = ctx.eligibility?.issues || [];
  const blocked = issues.filter((i) => !i.warnOnly);
  if (blocked.length) throw mockError(`${doc.vendor.name}: ${blocked[0].text} — the PO cannot be approved to this vendor.`, 422);
  const own = issues.filter((i) => i.warnOnly).map((i) => i.text);
  if (own.length && !signOff) throw mockError(`${doc.vendor.name}: ${own.join('; ')} — sign off the vendor to approve.`, 422);
  // What the approver signed off: the warnings on the PO's vendor and any the screen saw on the live supplier.
  const warnings = [...new Set([...own, ...(signOff ? acknowledged : [])])];
  doc.approvals = [{ level: 1, name: GPO_LEVELS[0], by: who.name, byUser: who.username, at: now(), remark, selfApproved: self, vendorSignOff: warnings }];
  Object.assign(doc, { status: S.APPROVED, approvedBy: who.name, approvedOn: now() });
  const notes = [self && 'self-approved (superuser)', warnings.length && `vendor signed off: ${warnings.join('; ')}`].filter(Boolean);
  return commit(db, doc, 'approved the PO', notes.join(' · '));
};

/** POST /garment-process-po/{id}/reject — back to Draft with the approver's reason (§16); the allocation is released. */
export const rejectGpo = async (id, reason) => {
  needReason(reason, 'Rejecting');
  const { db, doc, who } = await open(id, [S.SUBMITTED], 'Only a submitted PO can be rejected.');
  releaseAll(db, doc, { reasonCode: 'REJECTED', remark: reason });
  Object.assign(doc, { status: S.DRAFT, approvals: [], rejectNote: reason, rejectedBy: who.name, rejectedOn: now() });
  return commit(db, doc, 'rejected the PO back to Draft', reason);
};

/** POST /garment-process-po/{id}/send — the Purchase Manager sends the approved PO (§5). */
export const sendGpoToVendor = async (id) => {
  const { db, doc } = await open(id, [S.APPROVED], 'Only an approved PO can be sent to the vendor.');
  Object.assign(doc, { status: S.SENT_TO_VENDOR, sentOn: now() });
  return commit(db, doc, 'sent the PO to the vendor', doc.vendor?.name);
};

/** POST /garment-process-po/{id}/cancel — from Draft or Approved (§16), with a reason; releases the allocation. */
export const cancelGpo = async (id, { reasonCode, remark }) => {
  needReason(reasonCode && remark, 'Cancelling (reason code and remark)');
  const { db, doc, who } = await open(id, [S.DRAFT, S.APPROVED], 'Only a draft or an approved PO can be cancelled.');
  releaseAll(db, doc, { reasonCode, remark });
  Object.assign(doc, { status: S.CANCELLED, closeReasonCode: reasonCode, closeRemark: remark, closedBy: who.name, closedOn: now() });
  return commit(db, doc, 'cancelled the PO', remark);
};

/** POST /garment-process-po/{id}/short-close — releases allocated less returned back to the GPR. */
export const shortCloseGpo = async (id, { reasonCode, remark }) => {
  needReason(reasonCode && remark, 'Closing (reason code and remark)');
  const { db, doc, who } = await open(id, [S.SENT_TO_VENDOR, S.PARTIALLY_COMPLETED, S.COMPLETED], 'Only a PO with the vendor can be closed.');
  doc.lines.forEach((l) => releaseLine(db, doc, l, Number(l.receivedQty) || 0, { reasonCode, remark }));
  Object.assign(doc, { status: S.CLOSED, closeReasonCode: reasonCode, closeRemark: remark, closedBy: who.name, closedOn: now() });
  return commit(db, doc, doc.lines.some((l) => Number(l.receivedQty) < Number(l.poQty)) ? 'closed the PO short' : 'closed the PO', remark);
};

/** POST /garment-process-po/{id}/lines/{key}/excess-override — requested on a draft, within the cap (§11). */
export const requestGpoExcess = async (id, { lineKey, excessQty, reasonCode, justification }) => {
  needReason(reasonCode && justification, 'An excess (reason code and justification)');
  const { db, doc, who } = await open(id, [S.DRAFT], 'An excess is requested on a draft.');
  const line = doc.lines.find((l) => l.key === lineKey);
  if (!line || !(excessQty > 0)) throw mockError('Nothing on that line exceeds its balance.');
  const cap = excessCap(line);
  if (excessQty > cap) throw mockError(`${gpoLineLabel(line)}: an excess of ${n(excessQty)} is above ${GPO_EXCESS_CAP_PCT}% of the required ${n(line.required)} (at most ${n(cap)}).`, 422);
  doc.overrides = doc.overrides.filter((o) => o.lineKey !== lineKey);
  doc.overrides.push({
    id: `X${Date.now()}`, type: 'EXCESS', lineKey, excessQty, reasonCode, justification,
    requestedBy: who.name, requestedByUser: who.username, requestedAt: now(), status: 'REQUESTED',
  });
  return commit(db, doc, 'requested an excess override', `${gpoLineLabel(line)} +${n(excessQty)} · ${justification}`);
};

/** POST /garment-process-po/{id}/excess/{oid}/approve — an authorised approver other than the requester (a superuser may, logged). */
export const approveGpoExcess = async (id, overrideId) => {
  const { db, doc, who } = await open(id, [S.DRAFT], 'An excess is approved before the PO is submitted.');
  const o = doc.overrides.find((x) => x.id === overrideId && x.status === 'REQUESTED');
  if (!o) throw mockError('That excess is not awaiting approval.', 409);
  const self = o.requestedByUser === who.username;
  if (self && !who.superuser) throw mockError('You requested this excess, so someone else must approve it.', 403);
  Object.assign(o, { status: 'AUTHORISED', authorisedBy: who.name, authorisedByUser: who.username, authorisedAt: now(), selfAuthorised: self });
  const line = doc.lines.find((l) => l.key === o.lineKey);
  if (line) line.excess = o.excessQty;
  return commit(db, doc, 'approved an excess override', `${line ? gpoLineLabel(line) : o.lineKey} +${n(o.excessQty)}${self ? ' · self-approved (superuser)' : ''}`);
};
