/**
 * Demo stand-ins for the Stage 2 bill endpoints: list (+ KPI stats), get, create, update and delete a draft.
 * Every write returns the decorated bill, version bumped, as the API will.
 */
import dayjs from 'dayjs';
import { decorateBill, toUnits } from '../../../utils/jobWorkBillCalc';
import { QUICK_FILTER_STATUSES, areDebitsEditable, currentFinancialYear } from '../../../utils/billPassingConstants';
import { loadJwbDb, mutateJwbDb, nextDocNo, nextId, notFound, refuse } from './jwbDemoStore';
import { buildBill, listRowOf, logActivity, snapshotFromPo } from './jwbMockSnapshot';
import { isBillablePo, liveBillOn } from './jwbMockSources';

export const findBill = (db, id) => {
  const bill = db.bills.find((b) => String(b.id) === String(id));
  if (!bill) throw notFound('Job-work bill', id);
  return bill;
};

const statsOf = (bills) => {
  const now = dayjs();
  const monthStart = now.startOf('month');
  const inMonth = (at) => at && !dayjs(at).isBefore(monthStart) && !dayjs(at).isAfter(now);
  const count = (statuses) => bills.filter((b) => statuses.includes(b.status)).length;
  const passed = bills.filter((b) => ['APPROVED', 'SENT_TO_ACCOUNTS'].includes(b.status) && inMonth(b.approvedAt));
  const sent = bills.filter((b) => b.status === 'SENT_TO_ACCOUNTS' && inMonth(b.sentToAccountsAt));
  const sum = (rows, key) => Math.round(rows.reduce((s, r) => s + (r[key] || 0), 0) * 100) / 100;
  return {
    pendingVerification: count(['SUBMITTED', 'UNDER_VERIFICATION']),
    pendingApproval: count(['PENDING_APPROVAL']),
    onHoldOrQuery: count(['ON_HOLD', 'QUERY_RAISED', 'REFERRED_BACK']),
    passedThisMonth: passed.length,
    totalDebitMtd: sum(passed, 'deductionTotal'),
    sentToAccountsMtd: sum(sent, 'netPayable'),
  };
};

/** `sources` narrows to the job-work sources asked for; KPIs count every bill of those sources, not the filter. */
export const mockListBills = ({ sources, search, partyId, poId, status, quickFilter, invoiceFrom, invoiceTo, page = 0, size = 10 }) => {
  const all = loadJwbDb().bills.filter((b) => sources.includes(b.source)).map(decorateBill);
  const q = (search || '').trim().toLowerCase();
  const quick = quickFilter ? QUICK_FILTER_STATUSES[quickFilter] : null;
  const rows = all
    .filter((b) => !q || [b.jwbNumber, b.vendorName, b.vendorInvoiceNo, b.poNumber].some((v) => v?.toLowerCase().includes(q)))
    .filter((b) => !partyId || b.vendorId === partyId)
    .filter((b) => !poId || b.poId === poId)
    .filter((b) => !status || b.status === status)
    .filter((b) => !quick || quick.includes(b.status))
    .filter((b) => !invoiceFrom || (b.vendorInvoiceDate && b.vendorInvoiceDate >= invoiceFrom))
    .filter((b) => !invoiceTo || (b.vendorInvoiceDate && b.vendorInvoiceDate <= invoiceTo))
    .sort((a, b) => b.id - a.id)
    .map(listRowOf);
  return { content: rows.slice(page * size, (page + 1) * size), totalElements: rows.length, stats: statsOf(all) };
};

export const mockGetBill = (id) => decorateBill(findBill(loadJwbDb(), id));

export const mockCreateBill = ({ source, vendorId, poId }) => mutateJwbDb((db) => {
  const po = db.pos.find((p) => p.id === poId && p.vendorId === vendorId && p.source === source);
  if (!po) throw notFound('Job-work PO', poId);
  const live = liveBillOn(db, po.id);
  if (live) throw refuse(`${po.poNumber} already has ${live.jwbNumber}; one bill per PO`);
  if (!isBillablePo(db, po, source)) {
    throw refuse(`${po.poNumber} is ${po.status}; a vendor bill is raised once every line is back or the PO is short-closed`);
  }
  const vendor = db.vendors.find((v) => v.id === vendorId);
  const today = dayjs().format('YYYY-MM-DD');
  const bill = buildBill(db, {
    id: nextId(db, 'bill'), jwbNumber: nextDocNo(db, 'JWB'), po, vendor, createdAt: dayjs().toISOString(),
    vendorInvoiceDate: today,
  });
  bill.activity = logActivity(bill, 'Created as draft', `${po.poNumber} · ${po.dcs.length} DC(s)`);
  db.bills.push(bill);
  return decorateBill(bill);
});

/** D9: one vendor invoice no. per financial year across live bills, unless an override reason is recorded. */
export const assertNotDuplicate = (db, bill) => {
  const no = (bill.vendorInvoiceNo || '').trim().toLowerCase();
  if (!no || bill.duplicateOverrideReason) return;
  const other = db.bills.find((b) => b.id !== bill.id && b.status !== 'REJECTED' && b.vendorId === bill.vendorId
    && b.financialYear === bill.financialYear && (b.vendorInvoiceNo || '').trim().toLowerCase() === no);
  if (other) {
    throw refuse(`Invoice ${bill.vendorInvoiceNo} of ${bill.vendorName} is already booked on ${other.jwbNumber} (FY ${bill.financialYear})`,
      { error: 'DUPLICATE_INVOICE' });
  }
};

const checkLine = (line, keyed) => {
  const returnedUnits = toUnits(line.goodQty + line.rejectedReceiptQty, line);
  const what = [line.color, line.panel, line.size].filter(Boolean).join(' · ');
  if ([keyed.invoiceUnits, keyed.invoiceRate, keyed.passedUnits].some((v) => v != null && v < 0)) {
    throw refuse(`${what}: quantities and rates cannot be negative`, { status: 400, error: 'VALIDATION_FAILED' });
  }
  if (keyed.passedUnits != null && keyed.passedUnits > returnedUnits) {
    throw refuse(`${what}: cannot pass ${keyed.passedUnits} — only ${returnedUnits} came back`, { status: 400, error: 'VALIDATION_FAILED' });
  }
};

export const mockUpdateBill = (id, payload) => mutateJwbDb((db) => {
  const bill = findBill(db, id);
  if (!areDebitsEditable(bill.status)) throw refuse(`${bill.jwbNumber} is ${bill.status} and can no longer be edited`);
  const po = db.pos.find((p) => p.id === bill.poId);
  const keyed = new Map((payload.lines || []).map((l) => [l.id, l]));
  // Re-read the DCs and their checks: a check may still change while the bill is with the clerk.
  const snap = snapshotFromPo(db, po, bill);
  snap.lines = snap.lines.map((l) => {
    const k = keyed.get(l.id);
    if (!k) return l;
    checkLine(l, k);
    return { ...l, invoiceUnits: k.invoiceUnits ?? null, invoiceRate: k.invoiceRate ?? null, passedUnits: k.passedUnits ?? null };
  });
  const next = {
    ...bill, ...snap,
    vendorInvoiceNo: payload.vendorInvoiceNo ?? bill.vendorInvoiceNo,
    vendorInvoiceDate: payload.vendorInvoiceDate ?? bill.vendorInvoiceDate,
    headerRemarks: payload.headerRemarks ?? bill.headerRemarks,
    otherCharges: Number(payload.otherCharges ?? bill.otherCharges) || 0,
    invoiceCgst: Number(payload.invoiceCgst ?? bill.invoiceCgst) || 0,
    invoiceSgst: Number(payload.invoiceSgst ?? bill.invoiceSgst) || 0,
    invoiceIgst: Number(payload.invoiceIgst ?? bill.invoiceIgst) || 0,
    invoiceRoundOff: Number(payload.invoiceRoundOff ?? bill.invoiceRoundOff) || 0,
    duplicateOverrideReason: payload.duplicateOverrideReason || bill.duplicateOverrideReason || null,
    version: bill.version + 1,
  };
  next.financialYear = currentFinancialYear(new Date(next.vendorInvoiceDate));
  assertNotDuplicate(db, next);
  const edited = bill.status === 'DRAFT' ? 'Bill saved' : `Bill updated — edited while ${bill.status}`;
  next.activity = logActivity(next, edited, payload.duplicateOverrideReason ? `Duplicate invoice override: ${payload.duplicateOverrideReason}` : '');
  Object.assign(bill, next);
  return decorateBill(bill);
});

export const mockDeleteBill = (id) => mutateJwbDb((db) => {
  const bill = findBill(db, id);
  if (bill.status !== 'DRAFT') throw refuse(`${bill.jwbNumber} has been submitted; only a draft can be deleted`);
  db.bills = db.bills.filter((b) => b.id !== bill.id);
  return { id: bill.id };
});
