/**
 * Mock Invoice API (R2 — dual types under one "Invoices" menu):
 *  - COMMERCIAL (series EXSG): customs paperwork raised BEFORE dispatch for
 *    overseas parcels ("SAMPLES ONLY — NO COMMERCIAL VALUE"); feeds the
 *    dispatch-level gate.
 *  - SAMPLE (series SA): chargeable recovery invoice raised AFTER dispatch,
 *    only when the sample did not convert to a bulk order (typically 2× the
 *    sample cost — a wizard hint, never printed).
 * Numbers on Issue only; issued invoices immutable (cancel WITH REASON +
 * duplicate to correct); cancelling releases SRs for re-invoicing.
 */
import { loadDb, saveDb, nextInvoiceNo } from './srMockStore';
import { fail, currentUserName, todayStr } from './srMockApi';
import { isOverseas } from './srMockTransitions';
import {
  SAMPLE_INVOICE_STATUS, SR_STATUS, INVOICE_TYPES, INVOICE_TYPE_SERIES,
} from '../../utils/sampleRequestConstants';

const delay = (ms = 150) => new Promise((r) => setTimeout(r, ms));
const clone = (v) => JSON.parse(JSON.stringify(v));

const typeOf = (inv) => inv.invoiceType || INVOICE_TYPES.COMMERCIAL;

const invActivity = (inv, action, details) => {
  inv.activity = inv.activity || [];
  inv.activity.unshift({
    id: (inv.activity[0]?.id || 0) + 1,
    timestamp: `${todayStr()} 00:00`,
    user: currentUserName(),
    action,
    ...(details ? { details } : {}),
  });
};

const totals = (inv) => {
  const qty = (inv.lines || []).reduce((s, l) => s + (Number(l.quantity) || 0), 0);
  const ratesMissing = (inv.lines || []).some((l) => l.rate == null || l.rate === '');
  const value = ratesMissing
    ? null
    : (inv.lines || []).reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.rate) || 0), 0);
  return { totalQty: qty, declaredValue: value, ratesMissing };
};

const decorateInvoice = (inv) => ({
  ...clone(inv),
  invoiceType: typeOf(inv),
  ...totals(inv),
  srCount: (inv.srIds || []).length,
});

export const listInvoices = async (params = {}) => {
  await delay();
  const db = loadDb();
  let rows = db.invoices.map(decorateInvoice);
  if (params.search) {
    const q = params.search.toLowerCase();
    rows = rows.filter((i) => `${i.invoiceNo || 'draft'} ${i.consigneeName} ${(i.lines || []).map((l) => `${l.srNo || ''} ${l.styleNo || ''}`).join(' ')}`
      .toLowerCase().includes(q));
  }
  if (params.status) rows = rows.filter((i) => i.status === params.status);
  if (params.invoiceType) rows = rows.filter((i) => i.invoiceType === params.invoiceType);
  if (params.consignee) rows = rows.filter((i) => i.consigneeName === params.consignee);
  if (params.dateFrom) rows = rows.filter((i) => i.invoiceDate >= params.dateFrom);
  if (params.dateTo) rows = rows.filter((i) => i.invoiceDate <= params.dateTo);
  rows.sort((a, b) => b.id - a.id);

  const overseasReady = db.requests.filter((sr) => isOverseas(sr, db)
    && sr.status === SR_STATUS.IN_PRODUCTION
    && !db.invoices.some((i) => typeOf(i) === INVOICE_TYPES.COMMERCIAL
      && [SAMPLE_INVOICE_STATUS.ISSUED, SAMPLE_INVOICE_STATUS.DISPATCHED].includes(i.status)
      && (i.srIds || []).includes(sr.id)));
  const stats = {
    invoicesThisFy: db.invoices.filter((i) => i.status !== SAMPLE_INVOICE_STATUS.DRAFT).length,
    drafts: db.invoices.filter((i) => i.status === SAMPLE_INVOICE_STATUS.DRAFT).length,
    awaitingDispatch: db.invoices.filter((i) => i.status === SAMPLE_INVOICE_STATUS.ISSUED
      && typeOf(i) === INVOICE_TYPES.COMMERCIAL).length,
    srsReadyNoInvoice: overseasReady.length,
  };

  return { content: rows, totalElements: rows.length, stats };
};

export const getInvoice = async (id) => {
  await delay();
  const inv = loadDb().invoices.find((i) => i.id === Number(id));
  if (!inv) fail('NOT_FOUND', `Invoice ${id} not found`);
  return decorateInvoice(inv);
};

const dispatchModeForSr = (db, srId) => {
  const d = (db.dispatches || []).find((x) => (x.srIds || []).includes(srId));
  return d?.dispatchMode || null;
};

const coveredBy = (db, srId, type) => db.invoices.find((i) => typeOf(i) === type
  && [SAMPLE_INVOICE_STATUS.ISSUED, SAMPLE_INVOICE_STATUS.DISPATCHED].includes(i.status)
  && (i.srIds || []).includes(srId));

const SAMPLE_ELIGIBLE_STATUSES = [
  SR_STATUS.DISPATCHED, SR_STATUS.FEEDBACK_RECEIVED,
  SR_STATUS.APPROVED, SR_STATUS.REJECTED, SR_STATUS.REVISION_REQUIRED,
];

/**
 * Eligibility per invoice type.
 * COMMERCIAL: overseas SRs at IN_PRODUCTION (before dispatch, incl. on a draft
 * dispatch); dispatched / already-covered / other-consignee rows shown greyed
 * with the reason. `dispatchId` pre-scopes to that dispatch's SRs.
 * SAMPLE: any dispatched-or-closed SR of ONE customer, not already on an
 * issued SAMPLE invoice; domestic customers included.
 */
export const listEligibleSrs = async ({ type = INVOICE_TYPES.COMMERCIAL, consigneeName, dispatchId } = {}) => {
  await delay();
  const db = loadDb();
  const dispatch = dispatchId ? (db.dispatches || []).find((d) => d.id === Number(dispatchId)) : null;
  const scope = type === INVOICE_TYPES.COMMERCIAL
    ? db.requests.filter((sr) => isOverseas(sr, db))
    : db.requests.filter((sr) => SAMPLE_ELIGIBLE_STATUSES.includes(sr.status)
      || sr.status === SR_STATUS.IN_PRODUCTION /* shown w/ reason */);

  return scope.map((sr) => {
    let reason = null;
    if (type === INVOICE_TYPES.COMMERCIAL) {
      const covered = coveredBy(db, sr.id, INVOICE_TYPES.COMMERCIAL);
      if (sr.status !== SR_STATUS.IN_PRODUCTION && sr.status !== SR_STATUS.DISPATCHED) reason = 'Not yet In Production';
      if (sr.status === SR_STATUS.DISPATCHED) reason = 'Already dispatched';
      if (covered) reason = `Covered by ${covered.invoiceNo}`;
      if (!reason && dispatch && !(dispatch.srIds || []).includes(sr.id)) reason = `Not on ${dispatch.dispatchNo}`;
    } else {
      const covered = coveredBy(db, sr.id, INVOICE_TYPES.SAMPLE);
      if (!SAMPLE_ELIGIBLE_STATUSES.includes(sr.status)) reason = 'Not yet dispatched';
      if (covered) reason = `Covered by ${covered.invoiceNo}`;
    }
    if (!reason && consigneeName && sr.buyerName !== consigneeName) reason = 'Different consignee';
    return {
      id: sr.id, srNo: sr.srNo, orderNo: sr.orderNo, styleNo: sr.styleNo, garmentName: sr.garmentName,
      sampleTypeName: sr.sampleTypeName, status: sr.status,
      buyerName: sr.buyerName, buyerCountry: sr.buyerCountry,
      quantity: (sr.sampleQty || 0) * (sr.sizes?.length || 0),
      dispatchDeadline: sr.dispatchDeadline,
      dispatchMode: dispatchModeForSr(db, sr.id),
      eligible: !reason, reason,
    };
  });
};

export const createInvoice = async (payload) => {
  await delay();
  const db = loadDb();
  const invoiceType = payload.invoiceType || INVOICE_TYPES.COMMERCIAL;
  const inv = {
    ...clone(payload),
    invoiceType,
    series: payload.series || INVOICE_TYPE_SERIES[invoiceType],
    id: Math.max(0, ...db.invoices.map((i) => i.id)) + 1,
    invoiceNo: null, // assigned on Issue only
    status: SAMPLE_INVOICE_STATUS.DRAFT,
    cancelReason: null,
    activity: [],
    version: 0,
  };
  invActivity(inv, `${invoiceType === INVOICE_TYPES.SAMPLE ? 'Sample' : 'Commercial'} invoice draft created`);
  db.invoices.push(inv);
  saveDb(db);
  return decorateInvoice(inv);
};

export const updateInvoice = async (id, payload) => {
  await delay();
  const db = loadDb();
  const inv = db.invoices.find((i) => i.id === Number(id));
  if (!inv) fail('NOT_FOUND', `Invoice ${id} not found`);
  if (inv.status !== SAMPLE_INVOICE_STATUS.DRAFT) {
    fail('CONFLICT', 'Issued invoices are immutable — cancel and duplicate to correct');
  }
  invActivity(inv, 'Invoice draft updated');
  Object.assign(inv, clone(payload), {
    id: inv.id, invoiceNo: null, status: inv.status, activity: inv.activity,
    cancelReason: null, version: (inv.version || 0) + 1,
  });
  saveDb(db);
  return decorateInvoice(inv);
};

export const issueInvoice = async (id) => {
  await delay();
  const db = loadDb();
  const inv = db.invoices.find((i) => i.id === Number(id));
  if (!inv) fail('NOT_FOUND', `Invoice ${id} not found`);
  if (inv.status !== SAMPLE_INVOICE_STATUS.DRAFT) fail('CONFLICT', 'Only a Draft invoice can be issued');

  const missing = [];
  if (!inv.consigneeName) missing.push('Consignee');
  if (!inv.invoiceDate) missing.push('Invoice Date');
  if (!inv.countryOfOrigin) missing.push('Country of Origin');
  if (!inv.destinationCountry) missing.push('Country of Final Destination');
  if (!inv.termsOfDelivery) missing.push('Terms of Delivery & Payment');
  if (!inv.lines?.length) missing.push('at least one line');
  if ((inv.lines || []).some((l) => l.rate == null || l.rate === '')) missing.push('a Rate on every line');
  if (missing.length) fail('VALIDATION', `Cannot issue — missing: ${missing.join(', ')}`);

  inv.invoiceNo = nextInvoiceNo(db, inv.series || INVOICE_TYPE_SERIES[typeOf(inv)]);
  inv.status = SAMPLE_INVOICE_STATUS.ISSUED;
  inv.version = (inv.version || 0) + 1;
  const { declaredValue } = totals(inv);
  invActivity(inv, 'Invoice issued', `${inv.invoiceNo} · ${inv.currency} ${declaredValue?.toFixed(2)}`);

  (inv.srIds || []).forEach((srId) => {
    const sr = db.requests.find((r) => r.id === srId);
    if (sr) {
      sr.invoiceRef = { invoiceId: inv.id, invoiceNo: inv.invoiceNo, invoiceType: typeOf(inv), declaredValue };
      sr.activity = sr.activity || [];
      sr.activity.unshift({
        id: (sr.activity[0]?.id || 0) + 1,
        timestamp: `${todayStr()} 00:00`,
        user: currentUserName(),
        action: `${typeOf(inv) === INVOICE_TYPES.SAMPLE ? 'Sample' : 'Commercial'} invoice ${inv.invoiceNo} issued and linked`,
      });
    }
  });

  saveDb(db);
  return decorateInvoice(inv);
};

/** Cancel WITH mandatory reason — logged and shown in the view (R2). */
export const cancelInvoice = async (id, reason) => {
  await delay();
  const db = loadDb();
  const inv = db.invoices.find((i) => i.id === Number(id));
  if (!inv) fail('NOT_FOUND', `Invoice ${id} not found`);
  if (inv.status !== SAMPLE_INVOICE_STATUS.ISSUED) fail('CONFLICT', 'Only an Issued invoice can be cancelled');
  if (!reason || !String(reason).trim()) fail('VALIDATION', 'A cancellation reason is required');
  inv.status = SAMPLE_INVOICE_STATUS.CANCELLED;
  inv.cancelReason = String(reason).trim();
  inv.version = (inv.version || 0) + 1;
  invActivity(inv, 'Invoice cancelled — linked SRs released for re-invoicing', `Reason: ${inv.cancelReason}`);
  (inv.srIds || []).forEach((srId) => {
    const sr = db.requests.find((r) => r.id === srId);
    if (sr && sr.invoiceRef?.invoiceId === inv.id) sr.invoiceRef = null;
  });
  saveDb(db);
  return decorateInvoice(inv);
};

export const duplicateInvoice = async (id) => {
  await delay();
  const db = loadDb();
  const inv = db.invoices.find((i) => i.id === Number(id));
  if (!inv) fail('NOT_FOUND', `Invoice ${id} not found`);
  const copy = {
    ...clone(inv),
    id: Math.max(0, ...db.invoices.map((i) => i.id)) + 1,
    invoiceNo: null,
    status: SAMPLE_INVOICE_STATUS.DRAFT,
    invoiceDate: todayStr(),
    cancelReason: null,
    activity: [],
    version: 0,
  };
  invActivity(copy, `Duplicated from ${inv.invoiceNo || 'draft'}`);
  db.invoices.push(copy);
  saveDb(db);
  return decorateInvoice(copy);
};
