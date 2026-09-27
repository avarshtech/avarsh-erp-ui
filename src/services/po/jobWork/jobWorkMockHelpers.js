/**
 * Plumbing shared by the Cut Panel PO and Garment Process PO mocks: who is acting,
 * finding a PO, the audit trail, ledger postings and PO numbering. The mocks stand in for
 * the server, so every rule the server will enforce is checked here, not only on screen.
 */
import { mockError } from '../../bom/requirementMockStore';
import { getCurrentUser } from '../../auth/authService';
import { nextRequirementNumber } from '../../../utils/requirementStatus';
import { getCurrentFinancialYear } from '../../../utils/numbering';
import { poLineRequirementCell, LEDGER_ENTRY } from '../../../utils/jobWorkAllocation';

export const actor = () => {
  const u = getCurrentUser() || {};
  return { name: u.name || u.username || 'You', username: u.username || 'you', superuser: u.isSuperuser === true };
};

export const now = () => new Date().toISOString();

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const findPo = (db, id, type) => {
  const doc = db.docs.find((d) => d.id === Number(id) && d.type === type);
  if (!doc) throw mockError('Purchase order not found', 404);
  return doc;
};

export const expectStatus = (doc, statuses, message) => {
  if (!statuses.includes(doc.status)) throw mockError(message || 'This PO is not in a state that allows this action.', 409);
};

/** Audit row; `changes` are field-level [{ field, from, to }] (CPP PRD §23). */
export const addPoAudit = (db, id, action, details = '', changes = []) => {
  const rows = db.audits[id] || [];
  const who = actor();
  db.audits[id] = [{
    id: `${id}-${rows.length + 1}-${Date.now()}`, type: 'user', user: who.name, action, details, changes, timestamp: now(),
  }, ...rows];
};

/** Append-only ledger posting for one PO line. */
export const postLedger = (db, doc, line, type, qty, { reasonCode = null, remark = '' } = {}) => {
  if (!(qty > 0)) return;
  db.ledger.push({
    id: `E${db.nextEntryId}`, ...poLineRequirementCell(doc.type, line), poType: doc.type, poId: doc.id,
    poLineKey: line.key, type, qty, at: now(), by: actor().name, reasonCode, remark,
  });
  db.nextEntryId += 1;
};

/** Net allocation (allocate + override − release) and completion held by one PO line. */
export const lineLedger = (db, poId, lineKey) => db.ledger
  .filter((e) => e.poId === poId && e.poLineKey === lineKey)
  .reduce((t, e) => {
    if (e.type === LEDGER_ENTRY.ALLOCATE || e.type === LEDGER_ENTRY.OVERRIDE_ALLOCATE) t.allocated += e.qty;
    if (e.type === LEDGER_ENTRY.RELEASE) t.allocated -= e.qty;
    if (e.type === LEDGER_ENTRY.COMPLETE) t.completed += e.qty;
    return t;
  }, { allocated: 0, completed: 0 });

/** The PO as the screen reads it: with what each line holds in the ledger (and its requirement). */
export const withHeld = (db, doc) => ({
  ...doc, held: Object.fromEntries(doc.lines.map((l) => [l.key, { ...lineLedger(db, doc.id, l.key), cprId: l.cprId }])),
});

/** Releases whatever a PO line still holds beyond `keep` (0 = everything). */
export const releaseLine = (db, doc, line, keep, reason) => {
  const held = lineLedger(db, doc.id, line.key).allocated;
  postLedger(db, doc, line, LEDGER_ENTRY.RELEASE, held - keep, reason);
};

export const nextPoNumber = (db, prefix) =>
  nextRequirementNumber(prefix, `20${getCurrentFinancialYear().slice(0, 2)}`, db.issuedNos);
