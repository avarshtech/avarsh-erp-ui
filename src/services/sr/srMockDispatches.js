/**
 * Dispatch entity (R2): ONE dispatch groups MANY SRs of a single customer.
 * IN_PRODUCTION → DISPATCHED happens ONLY here. COMMERCIAL invoice comes
 * BEFORE dispatch (customs paperwork travels with the parcel) — the overseas
 * gate blocks markDispatched until every included SR is covered, naming the
 * uncovered ones. A dispatch locks permanently once dispatched.
 */
import { loadDb, saveDb, nextDispatchNo } from './srMockStore';
import { fail, pushActivity, currentUserName, todayStr } from './srMockApi';
import { stampStatus, isOverseas } from './srMockTransitions';
import {
  SR_STATUS, DISPATCH_STATUS, DELIVERY_METHODS, SAMPLE_INVOICE_STATUS, INVOICE_TYPES,
} from '../../utils/sampleRequestConstants';

const delay = (ms = 150) => new Promise((r) => setTimeout(r, ms));
const clone = (v) => JSON.parse(JSON.stringify(v));

const findDispatch = (db, id) => {
  const d = (db.dispatches || []).find((x) => x.id === Number(id));
  if (!d) fail('NOT_FOUND', `Dispatch ${id} not found`);
  return d;
};

const dspActivity = (d, action, details) => {
  d.activity = d.activity || [];
  d.activity.unshift({
    id: (d.activity[0]?.id || 0) + 1,
    timestamp: `${todayStr()} 00:00`,
    user: currentUserName(),
    action,
    ...(details ? { details } : {}),
  });
};

const decorateDispatch = (db, d) => ({
  ...clone(d),
  srCount: (d.srIds || []).length,
  srs: (d.srIds || []).map((id) => {
    const sr = db.requests.find((r) => r.id === id);
    return sr ? {
      id: sr.id, srNo: sr.srNo, styleNo: sr.styleNo, garmentName: sr.garmentName,
      sampleTypeName: sr.sampleTypeName, status: sr.status,
      quantity: (sr.sampleQty || 0) * (sr.sizes?.length || 0),
      dispatchDeadline: sr.dispatchDeadline,
    } : { id, srNo: `#${id}`, status: 'MISSING' };
  }),
  overseas: Boolean(d.buyerCountry)
    && d.buyerCountry.toLowerCase() !== (db.masters.companyProfileExtra.exporterCountryFallback || 'India').toLowerCase(),
});

export const searchDispatches = async (params = {}) => {
  await delay();
  const db = loadDb();
  let rows = (db.dispatches || []).map((d) => decorateDispatch(db, d));
  if (params.search) {
    const q = params.search.toLowerCase();
    rows = rows.filter((d) => `${d.dispatchNo} ${d.buyerName} ${d.trackingNo || ''} ${d.srs.map((s) => s.srNo).join(' ')}`
      .toLowerCase().includes(q));
  }
  if (params.status) rows = rows.filter((d) => d.status === params.status);
  if (params.customer) rows = rows.filter((d) => d.buyerName === params.customer);
  rows.sort((a, b) => b.id - a.id);
  return { content: rows, totalElements: rows.length };
};

export const getDispatch = async (id) => {
  await delay();
  const db = loadDb();
  return decorateDispatch(db, findDispatch(db, id));
};

/** IN_PRODUCTION SRs not already on another dispatch; optional customer filter. */
export const listDispatchableSrs = async (buyerName) => {
  await delay();
  const db = loadDb();
  const taken = new Set((db.dispatches || []).flatMap((d) => d.srIds || []));
  return db.requests
    .filter((sr) => sr.status === SR_STATUS.IN_PRODUCTION && !taken.has(sr.id)
      && (!buyerName || sr.buyerName === buyerName))
    .map((sr) => ({
      id: sr.id, srNo: sr.srNo, orderNo: sr.orderNo, styleNo: sr.styleNo,
      garmentName: sr.garmentName, sampleTypeName: sr.sampleTypeName,
      buyerName: sr.buyerName, buyerCountry: sr.buyerCountry,
      quantity: (sr.sampleQty || 0) * (sr.sizes?.length || 0),
      dispatchDeadline: sr.dispatchDeadline,
    }));
};

/** Distinct customers with dispatchable SRs (drives the customer select). */
export const listDispatchableCustomers = async () => {
  const rows = await listDispatchableSrs();
  const seen = new Map();
  rows.forEach((r) => { if (!seen.has(r.buyerName)) seen.set(r.buyerName, r.buyerCountry); });
  return [...seen.entries()].map(([name, country]) => ({ name, country }));
};

const validateDraft = (db, dto, existingId = null) => {
  if (!dto.buyerName) fail('VALIDATION', 'Select the customer');
  if (!dto.srIds?.length) fail('VALIDATION', 'Add at least one sample request to the dispatch');
  const takenElsewhere = new Set((db.dispatches || [])
    .filter((d) => d.id !== existingId)
    .flatMap((d) => d.srIds || []));
  dto.srIds.forEach((id) => {
    const sr = db.requests.find((r) => r.id === id);
    if (!sr) fail('VALIDATION', `SR ${id} not found`);
    if (sr.buyerName !== dto.buyerName) fail('VALIDATION', `${sr.srNo} belongs to ${sr.buyerName}, not ${dto.buyerName}`);
    if (takenElsewhere.has(id)) fail('VALIDATION', `${sr.srNo} is already on another dispatch`);
    if (sr.status !== SR_STATUS.IN_PRODUCTION) fail('VALIDATION', `${sr.srNo} is ${sr.status} — only In Production SRs can be dispatched`);
  });
};

export const createDispatch = async (dto) => {
  await delay();
  const db = loadDb();
  db.dispatches = db.dispatches || [];
  validateDraft(db, dto);
  const d = {
    ...clone(dto),
    id: Math.max(0, ...db.dispatches.map((x) => x.id)) + 1,
    dispatchNo: nextDispatchNo(db),
    status: DISPATCH_STATUS.DRAFT,
    dispatchedBy: null,
    activity: [],
  };
  dspActivity(d, `Dispatch draft created — ${d.srIds.length} SR(s) for ${d.buyerName}`);
  db.dispatches.push(d);
  saveDb(db);
  return decorateDispatch(db, d);
};

export const updateDispatch = async (id, dto) => {
  await delay();
  const db = loadDb();
  const d = findDispatch(db, id);
  if (d.status !== DISPATCH_STATUS.DRAFT) fail('CONFLICT', 'A dispatched record is locked for audit integrity');
  validateDraft(db, dto, d.id);
  Object.assign(d, clone(dto), { id: d.id, dispatchNo: d.dispatchNo, status: d.status, activity: d.activity });
  dspActivity(d, 'Dispatch draft updated');
  saveDb(db);
  return decorateDispatch(db, d);
};

export const deleteDispatch = async (id) => {
  await delay();
  const db = loadDb();
  const d = findDispatch(db, id);
  if (d.status !== DISPATCH_STATUS.DRAFT) fail('CONFLICT', 'Only draft dispatches can be deleted');
  db.dispatches = db.dispatches.filter((x) => x.id !== d.id);
  saveDb(db);
};

/** All srIds covered by an ISSUED/DISPATCHED COMMERCIAL invoice? Returns uncovered SR nos. */
export const uncoveredSrs = (db, d) => {
  const covered = new Set((db.invoices || [])
    .filter((i) => (i.invoiceType || INVOICE_TYPES.COMMERCIAL) === INVOICE_TYPES.COMMERCIAL
      && [SAMPLE_INVOICE_STATUS.ISSUED, SAMPLE_INVOICE_STATUS.DISPATCHED].includes(i.status))
    .flatMap((i) => i.srIds || []));
  return (d.srIds || [])
    .filter((id) => !covered.has(id))
    .map((id) => db.requests.find((r) => r.id === id)?.srNo || `#${id}`);
};

export const markDispatched = async (id) => {
  await delay();
  const db = loadDb();
  const d = findDispatch(db, id);
  if (d.status !== DISPATCH_STATUS.DRAFT) fail('CONFLICT', 'This dispatch has already been dispatched');
  validateDraft(db, d, d.id);

  const isLocal = d.deliveryMethod === DELIVERY_METHODS.LOCAL_HAND;
  const missing = [];
  if (!d.dispatchedDate) missing.push('Dispatched Date');
  if (!d.courierId && !d.courierName) missing.push('Courier / Carrier');
  if (!d.dispatchMode) missing.push('Dispatch Mode');
  if (!isLocal && !d.trackingNo) missing.push('Tracking Number');
  if (isLocal && !d.buyingOffice) missing.push('Buying Office / Location');
  if (isLocal && !d.handedOverTo) missing.push('Handed Over To');
  if (missing.length) fail('VALIDATION', `Dispatch incomplete — missing: ${missing.join(', ')}`);

  const dec = decorateDispatch(db, d);
  if (dec.overseas) {
    const uncovered = uncoveredSrs(db, d);
    if (uncovered.length) {
      fail('INVOICE_REQUIRED',
        `Overseas consignee (${d.buyerCountry}) — a commercial invoice must be issued before dispatch. Not yet covered: ${uncovered.join(', ')}`);
    }
  }

  d.status = DISPATCH_STATUS.DISPATCHED;
  d.dispatchedBy = currentUserName();
  dspActivity(d, 'Marked as Dispatched — record locked for audit integrity');

  d.srIds.forEach((srId) => {
    const sr = db.requests.find((r) => r.id === srId);
    if (!sr) return;
    sr.dispatchRef = { dispatchId: d.id, dispatchNo: d.dispatchNo };
    stampStatus(sr, SR_STATUS.DISPATCHED);
    pushActivity(sr, `Dispatched via ${d.dispatchNo} — buyer approval countdown started`);
  });

  // Covering ISSUED COMMERCIAL invoices whose SRs have now all shipped flip to DISPATCHED
  (db.invoices || []).forEach((inv) => {
    if ((inv.invoiceType || INVOICE_TYPES.COMMERCIAL) !== INVOICE_TYPES.COMMERCIAL) return;
    if (inv.status !== SAMPLE_INVOICE_STATUS.ISSUED) return;
    const allShipped = (inv.srIds || []).every((srId) => {
      const sr = db.requests.find((r) => r.id === srId);
      return sr && [SR_STATUS.DISPATCHED, SR_STATUS.FEEDBACK_RECEIVED, SR_STATUS.APPROVED,
        SR_STATUS.REJECTED, SR_STATUS.REVISION_REQUIRED].includes(sr.status);
    });
    if (allShipped && (inv.srIds || []).length) {
      inv.status = SAMPLE_INVOICE_STATUS.DISPATCHED;
      inv.activity = inv.activity || [];
      inv.activity.unshift({
        id: (inv.activity[0]?.id || 0) + 1,
        timestamp: `${todayStr()} 00:00`,
        user: currentUserName(),
        action: `All covered SRs dispatched via ${d.dispatchNo} — invoice marked Dispatched`,
      });
    }
  });

  saveDb(db);
  return decorateDispatch(db, d);
};

/** Dispatch containing this SR (any status), for the SR view's read-only card. */
export const getDispatchForSr = (srId, db = loadDb()) => {
  const d = (db.dispatches || []).find((x) => (x.srIds || []).includes(Number(srId)));
  return d ? decorateDispatch(db, d) : null;
};

// Re-exported for screens that need the SR-level check
export { isOverseas };
