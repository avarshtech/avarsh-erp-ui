/**
 * Cut Panel PO amendment — mock (PRD FR-29, §15.3). An amendment is a PENDING revision
 * (R1, R2 …) kept beside the live PO: the live revision keeps its allocation until the
 * amendment is approved. Approval checks the amendment against the balance PLUS what the
 * live PO already holds, then releases R0 and allocates R1 line by line. Rejecting,
 * sending back or discarding an amendment leaves the live PO exactly as it was.
 */
import { detach, mockDelay, mockError } from '../../bom/requirementMockStore';
import { loadJobWorkDb, saveJobWorkDb } from '../jobWork/jobWorkMockStore';
import { actor, now, findPo, addPoAudit, lineLedger, releaseLine, withHeld } from '../jobWork/jobWorkMockHelpers';
import { cppContext, allocateLines, isMaker } from './cutPanelPoWorkflowMock';
import { validateCpp, approvalLevels } from '../../../utils/cutPanelPoCalc';
import { revisionChanges, mergedRevision, REVISION_FIELDS } from '../../../utils/cutPanelPoRevision';
import { JW_PO_STATUS as S, JOB_WORK_PO_TYPE as T } from '../../../utils/jobWorkPoStatus';

const pick = (src, fields) => Object.fromEntries(fields.filter((f) => f in src).map((f) => [f, src[f]]));

const open = async (id, revStatus) => {
  await mockDelay();
  const db = loadJobWorkDb();
  const doc = findPo(db, id, T.CPP);
  const rev = doc.pendingRevision;
  if (revStatus && rev?.status !== revStatus) throw mockError('There is no amendment in that state on this PO.', 409);
  return { db, doc, rev, who: actor() };
};

const commit = (db, doc, action, details) => {
  doc.version = (doc.version || 1) + 1;
  addPoAudit(db, doc.id, action, details);
  saveJobWorkDb(db);
  return detach(withHeld(db, doc));
};

/** POST /cut-panel-po/{id}/amend — Approved or Sent, nothing received (VR-19), one amendment at a time. */
export const amendCpp = async (id, reason) => {
  const { db, doc, who } = await open(id);
  if (![S.APPROVED, S.SENT_TO_VENDOR].includes(doc.status)) throw mockError('Only an approved or sent PO can be amended.', 409);
  if (doc.lines.some((l) => Number(l.receivedQty) > 0)) throw mockError('Panels have been received on this PO — close it short and raise a fresh PO (VR-19).', 409);
  if (doc.pendingRevision) throw mockError(`Amendment R${doc.pendingRevision.revisionNo} is already open on this PO.`, 409);
  if (!String(reason || '').trim()) throw mockError('An amendment needs a reason.');
  doc.pendingRevision = {
    ...pick(doc, REVISION_FIELDS), revisionNo: (doc.revisionNo || 0) + 1, status: S.DRAFT, reason,
    lines: JSON.parse(JSON.stringify(doc.lines)), approvals: [], createdBy: who.name, createdByUser: who.username, createdOn: now(),
  };
  return commit(db, doc, `opened amendment R${doc.pendingRevision.revisionNo}`, reason);
};

/** PUT /cut-panel-po/{id}/amendment — quantities, rates, UOM, discount, charges, dates and terms. */
export const saveCppRevision = async (id, patch) => {
  const { db, doc, rev } = await open(id, S.DRAFT);
  const keys = new Set(rev.lines.map((l) => l.key));
  const lines = (patch.lines || rev.lines).filter((l) => keys.has(l.key));
  Object.assign(rev, pick(patch, REVISION_FIELDS), { lines, modifiedByUser: actor().username });
  return commit(db, doc, `saved amendment R${rev.revisionNo}`, `${revisionChanges(doc, rev).length} change(s)`);
};

export const submitCppRevision = async (id) => {
  const { db, doc, rev, who } = await open(id, S.DRAFT);
  const merged = mergedRevision(doc, rev);
  const held = Object.fromEntries(doc.lines.map((l) => [l.key, lineLedger(db, doc.id, l.key).allocated]));
  const { blocking } = validateCpp(merged, await cppContext(merged, { ownAllocation: held }));
  if (blocking.length) throw mockError(blocking[0], 422);
  if (!revisionChanges(doc, rev).length) throw mockError('The amendment changes nothing yet.');
  const levels = approvalLevels(merged);
  Object.assign(rev, { status: S.SUBMITTED, submittedBy: who.name, submittedByUser: who.username, submittedOn: now(), levelNames: levels, requiredLevels: levels.length, approvals: [] });
  return commit(db, doc, `submitted amendment R${rev.revisionNo}`, `${levels.length} level(s)`);
};

/** One level per call; on the last, R0's allocation is released and R1's taken (§15.3). */
export const approveCppRevision = async (id, remark = '') => {
  const { db, doc, rev, who } = await open(id, S.SUBMITTED);
  const self = isMaker(rev, who.username);
  if (self && !who.superuser) throw mockError('You raised, edited or submitted this amendment, so you cannot approve it (BR-15).', 403);
  if (!who.superuser && rev.approvals.some((a) => a.byUser === who.username)) throw mockError('You approved an earlier level; the next level needs another approver.', 409);
  const merged = mergedRevision(doc, rev);
  const held = Object.fromEntries(doc.lines.map((l) => [l.key, lineLedger(db, doc.id, l.key).allocated]));
  const ctx = await cppContext(merged, { ownAllocation: held });
  const { blocking } = validateCpp(merged, ctx);
  if (blocking.length) throw mockError(blocking[0], 422);
  const level = rev.approvals.length + 1;
  rev.approvals.push({ level, name: rev.levelNames?.[level - 1] ?? `Level ${level}`, by: who.name, byUser: who.username, at: now(), remark, selfApproved: self });
  if (level < rev.requiredLevels) return commit(db, doc, `approved amendment R${rev.revisionNo}, level ${level} of ${rev.requiredLevels}`, remark);
  doc.lines.forEach((l) => releaseLine(db, doc, l, 0, { reasonCode: 'AMENDMENT', remark: `Superseded by R${rev.revisionNo}` }));
  allocateLines(db, { ...merged, id: doc.id, type: doc.type }, ctx);
  const changes = revisionChanges(doc, rev);
  Object.assign(doc, pick(rev, REVISION_FIELDS), {
    lines: rev.lines, revisionNo: rev.revisionNo, pendingRevision: null,
    revisions: [...(doc.revisions || []), { revisionNo: rev.revisionNo, reason: rev.reason, approvedBy: who.name, approvedOn: now(), changes }],
  });
  return commit(db, doc, `approved amendment R${rev.revisionNo}`, `${changes.length} change(s); allocation adjusted`);
};

export const sendBackCppRevision = async (id, note) => {
  if (!String(note || '').trim()) throw mockError('Sending back needs a reason.');
  const { db, doc, rev } = await open(id, S.SUBMITTED);
  Object.assign(rev, { status: S.DRAFT, approvals: [], sendBackNote: note });
  return commit(db, doc, `sent amendment R${rev.revisionNo} back`, note);
};

/** Reject or discard: the amendment goes, the live PO and its allocation stay as they were. */
export const dropCppRevision = async (id, reason) => {
  if (!String(reason || '').trim()) throw mockError('Rejecting or discarding an amendment needs a reason.');
  const { db, doc, rev } = await open(id);
  if (!rev) throw mockError('There is no open amendment on this PO.', 409);
  doc.pendingRevision = null;
  return commit(db, doc, `dropped amendment R${rev.revisionNo}`, reason);
};
