/**
 * Mock Commercial Invoice API (PRD v3 §10). One invoice covers 1..n SRs for the
 * SAME consignee + destination. Numbers are assigned on Issue only; issued
 * invoices are immutable (correct via cancel + duplicate). Cancelling releases
 * its SRs back to Step-1 eligibility (OQ5 decision).
 */
import { loadDb, saveDb, nextInvoiceNo } from './srMockStore';
import { fail, currentUserName, todayStr, decorate } from './srMockApi';
import { isOverseas } from './srMockTransitions';
import { SAMPLE_INVOICE_STATUS, SR_STATUS } from '../../utils/sampleRequestConstants';

const delay = (ms = 150) => new Promise((r) => setTimeout(r, ms));
const clone = (v) => JSON.parse(JSON.stringify(v));

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

const decorateInvoice = (inv) => ({ ...clone(inv), ...totals(inv), srCount: (inv.srIds || []).length });

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
  if (params.consignee) rows = rows.filter((i) => i.consigneeName === params.consignee);
  if (params.destination) rows = rows.filter((i) => i.destinationCountry === params.destination);
  if (params.dateFrom) rows = rows.filter((i) => i.invoiceDate >= params.dateFrom);
  if (params.dateTo) rows = rows.filter((i) => i.invoiceDate <= params.dateTo);
  rows.sort((a, b) => b.id - a.id);

  // KPI strip (PRD §10.2)
  const overseasReady = db.requests.filter((sr) => isOverseas(sr, db)
    && [SR_STATUS.IN_PRODUCTION].includes(sr.status)
    && !(sr.invoiceRef && db.invoices.find((i) => i.id === sr.invoiceRef.invoiceId
      && [SAMPLE_INVOICE_STATUS.ISSUED, SAMPLE_INVOICE_STATUS.DISPATCHED].includes(i.status))));
  const stats = {
    invoicesThisFy: db.invoices.filter((i) => i.status !== SAMPLE_INVOICE_STATUS.DRAFT).length,
    drafts: db.invoices.filter((i) => i.status === SAMPLE_INVOICE_STATUS.DRAFT).length,
    awaitingDispatch: db.invoices.filter((i) => i.status === SAMPLE_INVOICE_STATUS.ISSUED).length,
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

/**
 * Step-1 eligibility (PRD §10.3): SRs at In Production or later, not already
 * covered by an issued invoice, not already dispatched. Ineligible rows are
 * returned WITH their reason so the wizard can grey them out.
 */
export const listEligibleSrs = async ({ consigneeName, destinationCountry } = {}) => {
  await delay();
  const db = loadDb();
  const overseas = db.requests.filter((sr) => isOverseas(sr, db));
  return overseas.map((sr) => {
    const covered = sr.invoiceRef && db.invoices.find((i) => i.id === sr.invoiceRef.invoiceId
      && [SAMPLE_INVOICE_STATUS.ISSUED, SAMPLE_INVOICE_STATUS.DISPATCHED].includes(i.status));
    let reason = null;
    if (![SR_STATUS.IN_PRODUCTION, SR_STATUS.DISPATCHED].includes(sr.status)) reason = 'Not yet In Production';
    if (sr.status === SR_STATUS.DISPATCHED) reason = 'Already dispatched';
    if (covered) reason = `Covered by ${covered.invoiceNo}`;
    if (!reason && consigneeName && sr.buyerName !== consigneeName) reason = 'Different consignee';
    if (!reason && destinationCountry && sr.buyerCountry !== destinationCountry) reason = 'Different destination';
    const dec = decorate(sr);
    return {
      id: sr.id, srNo: sr.srNo, orderNo: sr.orderNo, styleNo: sr.styleNo, garmentName: sr.garmentName,
      sampleTypeName: sr.sampleTypeName, round: sr.round, status: sr.status,
      buyerName: sr.buyerName, buyerCountry: sr.buyerCountry,
      quantity: (sr.sampleQty || 0) * (sr.sizes?.length || 0),
      dispatchDeadline: sr.dispatchDeadline, daysToDispatch: dec.daysToDispatch,
      dispatchMode: sr.dispatch?.dispatchMode || null,
      eligible: !reason, reason,
    };
  });
};

export const createInvoice = async (payload) => {
  await delay();
  const db = loadDb();
  const inv = {
    ...clone(payload),
    id: Math.max(0, ...db.invoices.map((i) => i.id)) + 1,
    invoiceNo: null, // assigned on Issue only (PRD §10.8)
    status: SAMPLE_INVOICE_STATUS.DRAFT,
    activity: [],
    version: 0,
  };
  invActivity(inv, 'Invoice draft created');
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
  Object.assign(inv, clone(payload), { id: inv.id, invoiceNo: null, status: inv.status, activity: inv.activity, version: (inv.version || 0) + 1 });
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

  inv.invoiceNo = nextInvoiceNo(db, inv.series || 'EXSG');
  inv.status = SAMPLE_INVOICE_STATUS.ISSUED;
  inv.version = (inv.version || 0) + 1;
  const { declaredValue } = totals(inv);
  invActivity(inv, 'Invoice issued', `${inv.invoiceNo} · ${inv.currency} ${declaredValue?.toFixed(2)}`);

  // Lock + link to every SR it covers
  (inv.srIds || []).forEach((srId) => {
    const sr = db.requests.find((r) => r.id === srId);
    if (sr) {
      sr.invoiceRef = { invoiceId: inv.id, invoiceNo: inv.invoiceNo, declaredValue };
      sr.activity = sr.activity || [];
      sr.activity.unshift({
        id: (sr.activity[0]?.id || 0) + 1,
        timestamp: `${todayStr()} 00:00`,
        user: currentUserName(),
        action: `Commercial invoice ${inv.invoiceNo} issued and linked`,
      });
    }
  });

  saveDb(db);
  return decorateInvoice(inv);
};

export const cancelInvoice = async (id) => {
  await delay();
  const db = loadDb();
  const inv = db.invoices.find((i) => i.id === Number(id));
  if (!inv) fail('NOT_FOUND', `Invoice ${id} not found`);
  if (inv.status !== SAMPLE_INVOICE_STATUS.ISSUED) fail('CONFLICT', 'Only an Issued invoice can be cancelled');
  inv.status = SAMPLE_INVOICE_STATUS.CANCELLED;
  inv.version = (inv.version || 0) + 1;
  invActivity(inv, 'Invoice cancelled — linked SRs released for re-invoicing');
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
    activity: [],
    version: 0,
  };
  invActivity(copy, `Duplicated from ${inv.invoiceNo || 'draft'}`);
  db.invoices.push(copy);
  saveDb(db);
  return decorateInvoice(copy);
};
