/**
 * Garment Process PO — mock API (UI mock phase), on the shared job-work store. Each
 * function names the endpoint it stands in for (PRD §21). The workflow (submit, approve,
 * reject, cancel, short close, excess) is in garmentProcessPoWorkflowMock.js.
 */
import { detach, mockDelay, mockError } from '../../bom/requirementMockStore';
import { loadJobWorkDb, saveJobWorkDb } from '../jobWork/jobWorkMockStore';
import { getMockOrderContext } from '../../bom/requirementMockOrders';
import { actor, now, findPo, expectStatus, addPoAudit, nextPoNumber, withHeld } from '../jobWork/jobWorkMockHelpers';
import { JW_PO_STATUS as S, JOB_WORK_PO_TYPE as T } from '../../../utils/jobWorkPoStatus';
import { gpoValue, gpoSaveBlocking, gpoLineLabel } from '../../../utils/garmentProcessPoCalc';
import { GPO_AMEND_FIELDS, GPO_RETURN_TO, optionLabel, jobWorkUomLabel } from '../../../utils/jobWorkConstants';
import { deliveryIssues } from '../../../utils/jobWorkDelivery';
import { formatDate } from '../../../utils/formatters';

/** Fields the screen may write on a draft; everything else is owned by the workflow. */
const DRAFT_FIELDS = ['poDate', 'branchId', 'branchName', 'currency', 'process', 'vendor', 'paymentTerms', 'requiredDate',
  'returnTo', 'returnToOther', 'returnUnitId', 'returnUnitName', 'returnUnitAddress', 'expectedReturnDate', 'instructions',
  'otherCharges', 'lastLineNo'];

/** Audited fields and their names; the return unit shows by its name and delivery place, never its id. */
const LABELS = {
  vendor: 'Vendor', paymentTerms: 'Payment terms', requiredDate: 'Required date',
  returnTo: 'Return to', returnToOther: 'Return to (other)', returnUnitName: 'Return unit', returnUnitAddress: 'Delivery place',
  expectedReturnDate: 'Expected delivery date', instructions: 'Processing instructions', otherCharges: 'Other charges', poDate: 'PO date',
};
const AUDITED = Object.keys(LABELS);
const LINE_FIELDS = [['poQty', 'PO qty'], ['uom', 'UOM', jobWorkUomLabel], ['rate', 'Rate'], ['billingQty', 'Billing qty']];

const pick = (src, fields) => Object.fromEntries(fields.filter((f) => f in src).map((f) => [f, src[f]]));
/** Blank is blank: null, undefined and '' are one value, so emptying an empty field changes nothing. */
const bare = (v) => (v === '' ? null : v ?? null);
const same = (a, b) => JSON.stringify(bare(a)) === JSON.stringify(bare(b));
const shown = (f, v) => {
  if (v == null || v === '') return '—';
  if (typeof v === 'object') return v.name ?? '—';
  if (f === 'returnTo') return optionLabel(GPO_RETURN_TO, v);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? formatDate(v) : v;
};
const fieldChanges = (before, after, fields) => fields.filter((f) => LABELS[f] && !same(before[f], after[f]))
  .map((f) => ({ field: LABELS[f], from: shown(f, before[f]), to: shown(f, after[f]) }));

/** Lines added or removed, and per-line quantity, UOM and rate changes (§18). */
const lineChanges = (before, after) => {
  const old = new Map(before.map((l) => [l.key, l]));
  const out = [];
  after.forEach((l) => {
    const b = old.get(l.key);
    if (!b) { out.push({ field: `${gpoLineLabel(l)} — line`, from: '—', to: 'added' }); return; }
    LINE_FIELDS.filter(([f]) => !same(b[f], l[f])).forEach(([f, label, fmt = (v) => v ?? '—']) => out.push({
      field: `${gpoLineLabel(l)} — ${label}`, from: fmt(b[f]), to: fmt(l[f]),
    }));
  });
  before.filter((b) => !after.some((l) => l.key === b.key)).forEach((b) => out.push({ field: `${gpoLineLabel(b)} — line`, from: 'on the PO', to: 'removed' }));
  return out;
};

const summary = (d) => ({
  id: d.id, type: d.type, poNo: d.poNo, poDate: d.poDate, status: d.status, vendorName: d.vendor?.name ?? '—',
  processLabel: d.lines[0]?.processLabel ?? d.process?.label ?? d.process?.name ?? '—',
  gprNos: [...new Set(d.lines.map((l) => l.gprNo))], orderNos: [...new Set(d.lines.map((l) => l.orderNo))],
  styleNos: [...new Set(d.lines.map((l) => l.styleNo))], buyers: [...new Set(d.lines.map((l) => l.buyer))],
  poQty: d.lines.reduce((s, l) => s + (Number(l.poQty) || 0), 0), poValue: gpoValue(d).total,
  requiredDate: d.requiredDate, expectedReturnDate: d.expectedReturnDate, approvedOn: d.approvedOn, createdByUser: d.createdByUser,
  orderCancelled: [...new Set(d.lines.map((l) => l.orderId))].some((id) => getMockOrderContext(id)?.status === 'CANCELLED'),
});

/** GET /garment-process-po — newest first; filters run client-side in the mock. */
export const listGpos = async () => {
  await mockDelay();
  return detach(loadJobWorkDb().docs.filter((d) => d.type === T.GPO).map(summary).reverse());
};

/** GET /garment-process-po/{id} — with what each line holds in the ledger. */
export const getGpo = async (id) => {
  await mockDelay();
  const db = loadJobWorkDb();
  return detach(withHeld(db, findPo(db, id, T.GPO)));
};

/**
 * POST /garment-process-po (number on first save) · PUT /garment-process-po/{id}: Draft
 * only; a vendor and one line even to save (V1, V2). Vendor and line changes are audited.
 */
export const saveGpo = async (doc) => {
  await mockDelay();
  const blocking = gpoSaveBlocking(doc);
  if (blocking.length) throw mockError(blocking[0], 422);
  const db = loadJobWorkDb();
  const who = actor();
  const lines = doc.lines.map((l) => ({ ...l }));
  if (!doc.id) {
    const poNo = nextPoNumber(db, 'GPO');
    const created = {
      ...pick(doc, DRAFT_FIELDS), id: db.nextId, type: T.GPO, poNo, status: S.DRAFT, lines, overrides: [], approvals: [],
      createdBy: who.name, createdByUser: who.username, createdOn: now(), version: 1,
    };
    db.nextId += 1;
    db.issuedNos.push(poNo);
    db.docs.push(created);
    addPoAudit(db, created.id, `created ${poNo}`, `${lines[0]?.processLabel ?? '—'} · ${created.vendor.name} · ${lines.length} line(s)`);
    saveJobWorkDb(db);
    return detach(withHeld(db, created));
  }
  const existing = findPo(db, doc.id, T.GPO);
  expectStatus(existing, [S.DRAFT], 'Only a draft can be edited.');
  if (doc.version != null && doc.version !== existing.version) throw mockError('This PO was changed by someone else. Reload and try again.', 409);
  const changes = [...fieldChanges(existing, doc, AUDITED), ...lineChanges(existing.lines, lines)];
  const keys = new Set(lines.map((l) => l.key));
  Object.assign(existing, pick(doc, DRAFT_FIELDS), {
    lines, overrides: existing.overrides.filter((o) => keys.has(o.lineKey)),
    version: existing.version + 1, modifiedBy: who.name, modifiedByUser: who.username, modifiedOn: now(),
  });
  if (changes.length) addPoAudit(db, existing.id, 'saved the draft', '', changes);
  saveJobWorkDb(db);
  return detach(withHeld(db, existing));
};

/** The delivery rules an amended PO must still meet (V14): the required date and the Delivery Instructions. */
const amendBlocking = (d) => [
  ...(d.requiredDate ? [] : ['Enter the required date.']),
  ...deliveryIssues(d, 'expectedReturnDate').map((issue) => `${issue} (V14).`),
  ...(d.expectedReturnDate && d.poDate && d.expectedReturnDate < d.poDate ? ['The expected delivery date cannot be before the PO date (V14).'] : []),
];

/** PATCH /garment-process-po/{id}/delivery — Amend delivery / instructions on an issued PO (§16), with a reason. */
export const amendGpoDates = async (id, patch, reason) => {
  await mockDelay();
  if (!String(reason || '').trim()) throw mockError('An amendment needs a reason.');
  const db = loadJobWorkDb();
  const doc = findPo(db, id, T.GPO);
  expectStatus(doc, [S.APPROVED, S.SENT_TO_VENDOR], 'Delivery and instructions are amended on an approved or sent PO.');
  const clean = pick(patch, GPO_AMEND_FIELDS);
  const next = { ...doc, ...clean };
  const broken = amendBlocking(next);
  if (broken.length) throw mockError(broken[0], 422);
  // Any real change counts — a new unit id alone included, though the history never shows it.
  if (GPO_AMEND_FIELDS.every((f) => same(doc[f], next[f]))) throw mockError('The amendment changes nothing yet.');
  const changes = fieldChanges(doc, next, GPO_AMEND_FIELDS);
  Object.assign(doc, clean, { version: doc.version + 1, modifiedBy: actor().name, modifiedOn: now() });
  addPoAudit(db, doc.id, 'amended delivery / instructions', reason, changes);
  saveJobWorkDb(db);
  return detach(withHeld(db, doc));
};

/** GET /garment-process-po/{id}/audit — newest first; field changes read "field: before → after" (§18). */
export const getGpoAudit = async (id) => {
  await mockDelay(150);
  return detach((loadJobWorkDb().audits[id] || []).map((r) => ({
    ...r, details: [r.details, ...(r.changes || []).map((c) => `${c.field}: ${c.from} → ${c.to}`)].filter(Boolean).join(' · '),
  })));
};
