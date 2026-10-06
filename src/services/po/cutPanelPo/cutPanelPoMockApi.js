/**
 * Cut Panel PO — mock API (UI mock phase), on the shared job-work store. Each function
 * names the endpoint it stands in for. The workflow (submit → approve → send, cancel,
 * short close, overrides) is in cutPanelPoWorkflowMock.js; amendments in
 * cutPanelPoRevisionMock.js.
 */
import { detach, mockDelay, mockError } from '../../bom/requirementMockStore';
import { loadJobWorkDb, saveJobWorkDb } from '../jobWork/jobWorkMockStore';
import { getMockOrderContext } from '../../bom/requirementMockOrders';
import { actor, now, findPo, expectStatus, addPoAudit, nextPoNumber, withHeld } from '../jobWork/jobWorkMockHelpers';
import { JW_PO_STATUS as S, JOB_WORK_PO_TYPE as T } from '../../../utils/jobWorkPoStatus';
import { cppValue, cppLineIntegrity } from '../../../utils/cutPanelPoCalc';
import { ISSUED_FIELDS, fieldLabel } from '../../../utils/cutPanelPoRevision';
import { vendorEligibility } from '../../../utils/vendorEligibility';
import { CPP_RETURN_TO, optionLabel } from '../../../utils/jobWorkConstants';
import { formatDate } from '../../../utils/formatters';

/** Fields the screen may write on a draft; everything else is owned by the workflow. */
const DRAFT_FIELDS = ['poDate', 'branchId', 'branchName', 'currency', 'process', 'vendor', 'paymentTerms',
  'requiredDeliveryDate', 'returnTo', 'returnToOther', 'returnUnitId', 'returnUnitName', 'returnUnitAddress', 'instructions',
  'otherCharges', 'lateDeliveryReason', 'duplicateReason', 'lastLineNo'];

/** Editable in any status, audited (§11.1). */
const NOTE_FIELDS = ['instructions'];

/** Never shown in the history, which names the return unit by its name and delivery place. */
const QUIET_FIELDS = ['returnUnitId'];

const pick = (src, fields) => Object.fromEntries(fields.filter((f) => f in src).map((f) => [f, src[f]]));
/** Blank is blank: null, undefined and '' are one value, so emptying an empty field changes nothing. */
const bare = (v) => (v === '' ? null : v ?? null);
const same = (a, b) => JSON.stringify(bare(a)) === JSON.stringify(bare(b));
const CODED = { returnTo: CPP_RETURN_TO };
/** A value as the history shows it: names, option labels and dates, never raw objects or codes. */
const shown = (f, v) => {
  if (v == null || v === '') return '—';
  if (typeof v === 'object') return v.name ?? '—';
  if (CODED[f]) return optionLabel(CODED[f], v);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? formatDate(v) : v;
};
/** Field-level changes (§23). */
const changesOf = (before, patch) => Object.keys(patch).filter((f) => !QUIET_FIELDS.includes(f) && !same(before[f], patch[f]))
  .map((f) => ({ field: fieldLabel(f), from: shown(f, before[f]), to: shown(f, patch[f]) }));

const summary = (d) => ({
  id: d.id, type: d.type, poNo: d.poNo, poDate: d.poDate, status: d.status, vendorName: d.vendor?.name ?? '—',
  processLabel: d.process?.label ?? d.process?.name, cprNos: [...new Set(d.lines.map((l) => l.cprNo))],
  orderIds: [...new Set(d.lines.map((l) => l.orderId))], orderNos: [...new Set(d.lines.map((l) => l.orderNo))],
  styleNos: [...new Set(d.lines.map((l) => l.styleNo))], buyers: [...new Set(d.lines.map((l) => l.buyer))],
  poQty: d.lines.reduce((s, l) => s + (Number(l.poQty) || 0), 0), poValue: cppValue(d).total,
  requiredDeliveryDate: d.requiredDeliveryDate, approvedOn: d.approvedOn, revisionNo: d.revisionNo || 0,
  pendingRevision: d.pendingRevision?.status ?? null, createdBy: d.createdBy,
  orderCancelled: [...new Set(d.lines.map((l) => l.orderId))].some((id) => getMockOrderContext(id)?.status === 'CANCELLED'),
});


/** GET /cut-panel-po — newest first; filters run client-side in the mock. */
export const listCpps = async () => {
  await mockDelay();
  return detach(loadJobWorkDb().docs.filter((d) => d.type === T.CPP).map(summary).reverse());
};

/** GET /cut-panel-po/{id} — with what each line holds in the ledger. */
export const getCpp = async (id) => {
  await mockDelay();
  const db = loadJobWorkDb();
  return detach(withHeld(db, findPo(db, id, T.CPP)));
};

/** POST /cut-panel-po (number on first save) · PUT /cut-panel-po/{id}: Draft only; zero-qty lines are dropped (BR-08). */
export const saveCpp = async (doc) => {
  await mockDelay();
  const db = loadJobWorkDb();
  if (!doc.process) throw mockError('Choose the panel process first.');
  const lines = doc.lines.filter((l) => Number(l.poQty) > 0);
  const integrity = cppLineIntegrity({ ...doc, lines });
  if (integrity.length) throw mockError(integrity[0], 422);
  const who = actor();
  if (!doc.id) {
    const poNo = nextPoNumber(db, 'CPP');
    const created = {
      ...pick(doc, DRAFT_FIELDS), id: db.nextId, type: T.CPP, poNo, status: S.DRAFT, lines, overrides: [], approvals: [],
      revisionNo: 0, pendingRevision: null, revisions: [], createdBy: who.name, createdByUser: who.username, createdOn: now(), version: 1,
    };
    db.nextId += 1;
    db.issuedNos.push(poNo);
    db.docs.push(created);
    addPoAudit(db, created.id, `created ${poNo}`, `${doc.process.label ?? doc.process.name} · ${lines.length} line(s)`);
    saveJobWorkDb(db);
    return detach(withHeld(db, created));
  }
  const existing = findPo(db, doc.id, T.CPP);
  expectStatus(existing, [S.DRAFT], 'Only a draft can be edited; an approved PO changes by amendment.');
  if (doc.version != null && doc.version !== existing.version) throw mockError('This PO was changed by someone else. Reload and try again.', 409);
  const keys = new Set(lines.map((l) => l.key));
  Object.assign(existing, pick(doc, DRAFT_FIELDS), {
    lines, overrides: existing.overrides.filter((o) => keys.has(o.lineKey)),
    version: existing.version + 1, modifiedBy: who.name, modifiedByUser: who.username, modifiedOn: now(),
  });
  addPoAudit(db, existing.id, 'saved the draft', `${lines.length} line(s)`);
  saveJobWorkDb(db);
  return detach(withHeld(db, existing));
};

/** DELETE /cut-panel-po/{id} — a draft only; its number is never reused. */
export const deleteCpp = async (id) => {
  await mockDelay();
  const db = loadJobWorkDb();
  expectStatus(findPo(db, id, T.CPP), [S.DRAFT], 'Only a draft can be deleted.');
  db.docs = db.docs.filter((d) => !(d.id === Number(id) && d.type === T.CPP));
  saveJobWorkDb(db);
};

/**
 * PATCH /cut-panel-po/{id}/issued-details — Approved, not yet sent (BR-16): vendor, payment
 * terms, the expected delivery date, Return To and the return unit; instructions in any
 * status. Every change is audited field by field.
 */
export const updateCppDetails = async (id, patch) => {
  await mockDelay();
  const db = loadJobWorkDb();
  const doc = findPo(db, id, T.CPP);
  // An open amendment owns the issued terms until it is approved or dropped; notes stay open.
  const allowed = doc.status === S.APPROVED && !doc.pendingRevision ? [...ISSUED_FIELDS, ...NOTE_FIELDS] : NOTE_FIELDS;
  if ([S.CANCELLED, S.REJECTED].includes(doc.status)) throw mockError('A cancelled or rejected PO cannot change.', 409);
  const clean = pick(patch, allowed);
  // Saved on any real change — a new unit id alone included, though the history never shows it.
  if (Object.keys(clean).every((f) => same(doc[f], clean[f]))) return detach(withHeld(db, doc));
  const changes = changesOf(doc, clean);
  // A swapped job worker is re-checked (BR-14); `changes` carries labels, so compare the raw value.
  if (clean.vendor && !same(doc.vendor, clean.vendor)) {
    const check = vendorEligibility(clean.vendor, { processId: doc.process?.id ?? null, processLabel: doc.process?.label ?? doc.process?.name, category: 'Cut Panel' });
    if (!check.eligible) throw mockError(`${clean.vendor.name}: ${check.reason}`, 422);
  }
  Object.assign(doc, clean, { version: doc.version + 1, modifiedBy: actor().name, modifiedOn: now() });
  addPoAudit(db, doc.id, 'updated the PO', '', changes);
  saveJobWorkDb(db);
  return detach(withHeld(db, doc));
};

/** GET /cut-panel-po/{id}/audit — newest first; field-level changes read "field: before → after" (§23). */
export const getCppAudit = async (id) => {
  await mockDelay(150);
  return detach((loadJobWorkDb().audits[id] || []).map((r) => ({
    ...r, details: [r.details, ...(r.changes || []).map((c) => `${c.field}: ${c.from} → ${c.to}`)].filter(Boolean).join(' · '),
  })));
};
