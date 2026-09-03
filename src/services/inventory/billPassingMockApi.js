/**
 * Mock CRUD, workflow and debit handling for Bill Passing. Mirrors the future
 * REST contract: Spring page shape {content, totalElements, totalPages, size,
 * number}, camelCase fields, YYYY-MM-DD dates, `version` for optimistic locking.
 *
 * Every mutation loads the db, edits the object it just loaded, and saves
 * before returning — never cache a db reference at module scope.
 */
import { loadDb, saveDb, nextBillNo } from './billPassingMockStore';
import { getCurrentUser } from '../../utils/permissions';
import {
  BILL_PASSING_STATUS as S, DEBIT_STATUS, DEBIT_ORIGIN, ISSUE_STATUS,
  QUICK_FILTER_STATUSES, isBillEditable, areDebitsEditable, DEFAULT_TOLERANCE,
} from '../../utils/billPassingConstants';
import {
  recalcBill, recalcTaxes, buildReconciliation, buildExceptions, blockingExceptions,
  proposeDebits, cumulativeBilledQty, debitPercentOfInvoice, billLines, billLinesWithGrn, round2, round3,
} from '../../utils/billPassingCalc';

const delay = (ms = 150) => new Promise((r) => setTimeout(r, ms));
const clone = (v) => JSON.parse(JSON.stringify(v));
export const fail = (code, msg) => { const e = new Error(msg); e.code = code; throw e; };

export const currentUserName = () => {
  const u = getCurrentUser();
  if (!u) return 'User';
  if (typeof u === 'string') return u;
  return u.name || u.fullName || u.username || u.email || 'User';
};

const pad = (n) => String(n).padStart(2, '0');
const nowStamp = () => {
  const dt = new Date();
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
};
export const todayStr = () => {
  const dt = new Date();
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
};

const pushActivity = (bill, action, details = '') => {
  bill.activity = bill.activity || [];
  bill.activity.unshift({
    id: (bill.activity[0]?.id || 0) + 1,
    timestamp: nowStamp(), user: currentUserName(), action, details,
  });
};

const nextId = (arr) => Math.max(0, ...arr.map((r) => r.id || 0)) + 1;
const findBill = (db, id) => {
  const b = db.bills.find((x) => x.id === Number(id));
  if (!b) fail('NOT_FOUND', 'Bill not found');
  return b;
};

/** Derived, read-only decoration — never persisted. */
const decorate = (bill, db) => {
  const tolerance = db?.tolerance || DEFAULT_TOLERANCE;
  const exceptions = buildExceptions(bill, tolerance, { requireAttachment: true });
  const blockers = blockingExceptions(exceptions);
  const daysOnHold = bill.holdSince
    ? Math.floor((Date.now() - new Date(bill.holdSince).getTime()) / 86400000)
    : null;
  return {
    ...bill,
    reconciliation: buildReconciliation(bill, tolerance),
    exceptions,
    debitPercent: debitPercentOfInvoice(bill),
    daysOnHold,
    holdEscalated: daysOnHold != null && daysOnHold >= tolerance.holdEscalationDays,
    editable: isBillEditable(bill.status),
    debitsEditable: areDebitsEditable(bill.status),
    canSendForApproval: blockers.length === 0,
    blockers: blockers.map((b) => b.title),
    lineCount: billLines(bill).length,
    grnCount: (bill.grns || []).length,
  };
};

// ── Guards ─────────────────────────────────────────────────────────────────

/** BR-04 — same supplier + invoice no + FY cannot be booked twice. */
const assertNotDuplicate = (db, bill) => {
  if (bill.duplicateOverrideBy) return;
  // A draft is created before its invoice number is keyed, so a blank one is
  // not a duplicate of anything — without this, the second draft raised for a
  // supplier in the same FY collides with the first on ''. BR-15 blocks Submit
  // until the number is filled in, which is where BR-04 actually bites.
  const invoiceNo = String(bill.supplierInvoiceNo || '').trim();
  if (!invoiceNo) return;
  const dup = db.bills.find((b) =>
    b.id !== bill.id &&
    b.status !== S.REJECTED &&
    b.supplierId === bill.supplierId &&
    String(b.supplierInvoiceNo || '').trim().toLowerCase() === invoiceNo.toLowerCase() &&
    b.financialYear === bill.financialYear);
  if (dup) {
    fail('CONFLICT',
      `Invoice ${bill.supplierInvoiceNo} is already booked for this supplier on ${dup.bpNumber}. An Approver can override this with a reason.`);
  }
};

/** BR-23/24 — cumulative billed quantity per GRN line may not exceed its basis. */
const assertNoOverBilling = (db, bill) => {
  billLines(bill).forEach((l) => {
    const others = cumulativeBilledQty(db.bills, l.grnLineItemId, bill.id);
    const total = round3(others + (Number(l.billedQty) || 0));
    const ceiling = round3(l.receivedQty);
    if (total > ceiling) {
      const covering = db.bills
        .filter((b) => b.id !== bill.id && b.status !== S.REJECTED)
        .filter((b) => billLines(b).some((x) => x.grnLineItemId === l.grnLineItemId && x.billedQty > 0))
        .map((b) => b.bpNumber);
      fail('CONFLICT',
        `${l.itemCode}: billing ${l.billedQty} takes the total to ${total} against ${ceiling} received.` +
        (covering.length ? ` Already covered by ${covering.join(', ')}.` : ''));
    }
  });
};

/** BR-22 — every covered GRN must belong to the bill's own PO. */
const assertGrnsBelongToPo = (db, bill) => {
  (bill.grns || []).forEach((g) => {
    const grn = db.grns.find((x) => x.id === g.grnId);
    if (!grn) fail('VALIDATION', `GRN ${g.grnNumber} no longer exists`);
    if (grn.poId !== bill.poId) {
      const owner = db.purchaseOrders.find((p) => p.id === grn.poId);
      fail('VALIDATION',
        `Challan ${grn.challanNo} (${grn.grnNumber}) belongs to ${owner ? owner.poNumber : 'another purchase order'}, not to this bill.`);
    }
  });
};

const assertEditable = (bill) => {
  if (!isBillEditable(bill.status)) {
    fail('CONFLICT', `A bill in ${bill.status.replace(/_/g, ' ').toLowerCase()} cannot be edited. Raise a query or reopen it first.`);
  }
};

// ── Bills: list, read, write ───────────────────────────────────────────────

export const searchBills = async (params = {}) => {
  await delay();
  const db = loadDb();
  const { search, supplierId, poId, status, quickFilter, invoiceFrom, invoiceTo, page = 0, size = 10 } = params;

  let rows = db.bills.map((b) => decorate(b, db));

  if (supplierId) rows = rows.filter((b) => b.supplierId === Number(supplierId));
  if (poId) rows = rows.filter((b) => b.poId === Number(poId));
  if (status) rows = rows.filter((b) => b.status === status);
  if (quickFilter && QUICK_FILTER_STATUSES[quickFilter]) {
    rows = rows.filter((b) => QUICK_FILTER_STATUSES[quickFilter].includes(b.status));
  }
  if (invoiceFrom) rows = rows.filter((b) => b.invoiceDate >= invoiceFrom);
  if (invoiceTo) rows = rows.filter((b) => b.invoiceDate <= invoiceTo);
  if (search) {
    const t = String(search).toLowerCase();
    rows = rows.filter((b) => [b.bpNumber, b.supplierName, b.supplierInvoiceNo, b.poNumber, b.challanNumbers, b.tallyReferenceNo]
      .some((f) => String(f || '').toLowerCase().includes(t)));
  }

  rows.sort((a, b) => (a.invoiceDate < b.invoiceDate ? 1 : a.invoiceDate > b.invoiceDate ? -1 : b.id - a.id));

  const all = db.bills;
  const inMonth = (b) => String(b.invoiceDate || '').slice(0, 7) === todayStr().slice(0, 7);
  const start = Number(page) * Number(size);

  return clone({
    content: rows.slice(start, start + Number(size)),
    totalElements: rows.length,
    totalPages: Math.ceil(rows.length / Number(size)) || 1,
    size: Number(size),
    number: Number(page),
    // FR-BP-101 KPI cards.
    stats: {
      pendingVerification: all.filter((b) => [S.SUBMITTED, S.UNDER_VERIFICATION].includes(b.status)).length,
      pendingApproval: all.filter((b) => b.status === S.PENDING_APPROVAL).length,
      onHoldOrQuery: all.filter((b) => [S.ON_HOLD, S.QUERY_RAISED].includes(b.status)).length,
      passedThisMonth: all.filter((b) => [S.APPROVED, S.SENT_TO_ACCOUNTS].includes(b.status) && inMonth(b)).length,
      totalDebitMtd: round2(all.filter(inMonth).reduce((s, b) => s + b.debitTotal, 0)),
      sentToAccountsMtd: round2(all.filter((b) => b.status === S.SENT_TO_ACCOUNTS && inMonth(b)).reduce((s, b) => s + b.netPayable, 0)),
    },
  });
};

export const getBill = async (id) => {
  await delay();
  const db = loadDb();
  return clone(decorate(findBill(db, id), db));
};

export const createBill = async (payload) => {
  await delay(250);
  const db = loadDb();
  const supplier = db.suppliers.find((s) => s.id === Number(payload.supplierId));
  const po = db.purchaseOrders.find((p) => p.id === Number(payload.poId));
  if (!supplier || !po) fail('VALIDATION', 'Supplier and purchase order are both required');

  const bill = recalcBill({
    id: nextId(db.bills),
    bpNumber: nextBillNo(db),
    supplierId: supplier.id, supplierName: supplier.name,
    poId: po.id, poNumber: po.poNumber,
    supplierInvoiceNo: payload.supplierInvoiceNo || '',
    invoiceDate: payload.invoiceDate || todayStr(),
    financialYear: payload.financialYear,
    challanNumbers: payload.challanNumbers || '',
    adjustmentTotal: round2(payload.adjustmentTotal),
    status: S.DRAFT,
    headerRemarks: payload.headerRemarks || '',
    grns: payload.grns || [],
    charges: payload.charges || [],
    taxes: payload.taxes || [],
    debits: payload.debits || [],
    issues: [], attachments: [], activity: [],
    submittedAt: null, approvedAt: null, sentToAccountsAt: null, tallyReferenceNo: null,
    duplicateOverrideBy: payload.duplicateOverrideBy || null,
    duplicateOverrideReason: payload.duplicateOverrideReason || null,
    queryReason: null, holdReason: null, holdSince: null, rejectReason: null, reopenReason: null,
    version: 1,
  });
  bill.taxes = recalcTaxes(bill);

  assertGrnsBelongToPo(db, bill);
  assertNotDuplicate(db, bill);
  assertNoOverBilling(db, bill);

  pushActivity(bill, 'Draft created');
  db.bills.push(bill);
  saveDb(db);
  return clone(decorate(bill, db));
};

export const updateBill = async (id, payload) => {
  await delay(200);
  const db = loadDb();
  const bill = findBill(db, id);
  assertEditable(bill);

  Object.assign(bill, {
    supplierInvoiceNo: payload.supplierInvoiceNo ?? bill.supplierInvoiceNo,
    invoiceDate: payload.invoiceDate ?? bill.invoiceDate,
    challanNumbers: payload.challanNumbers ?? bill.challanNumbers,
    headerRemarks: payload.headerRemarks ?? bill.headerRemarks,
    adjustmentTotal: payload.adjustmentTotal ?? bill.adjustmentTotal,
    grns: payload.grns ?? bill.grns,
    charges: payload.charges ?? bill.charges,
    debits: payload.debits ?? bill.debits,
    duplicateOverrideBy: payload.duplicateOverrideBy ?? bill.duplicateOverrideBy,
    duplicateOverrideReason: payload.duplicateOverrideReason ?? bill.duplicateOverrideReason,
  });
  if (payload.taxes) bill.taxes = payload.taxes;

  assertGrnsBelongToPo(db, bill);
  assertNotDuplicate(db, bill);
  assertNoOverBilling(db, bill);

  Object.assign(bill, recalcBill(bill));
  bill.taxes = recalcTaxes(bill);
  bill.version += 1;
  pushActivity(bill, 'Bill updated');
  saveDb(db);
  return clone(decorate(bill, db));
};

export const deleteBill = async (id) => {
  await delay();
  const db = loadDb();
  const bill = findBill(db, id);
  if (bill.status !== S.DRAFT) {
    fail('CONFLICT', `${bill.bpNumber} is ${bill.status.replace(/_/g, ' ').toLowerCase()} and is part of the audit trail — it cannot be deleted.`);
  }
  db.bills = db.bills.filter((b) => b.id !== bill.id);
  saveDb(db);
  return { id: bill.id };
};

/**
 * FR-BP-402 — re-read GRN and QC and refresh the stored snapshot. Only while
 * the bill is unapproved; an approved bill is frozen against its snapshot.
 */
export const refreshSourceData = async (id) => {
  await delay(200);
  const db = loadDb();
  const bill = findBill(db, id);
  if ([S.APPROVED, S.SENT_TO_ACCOUNTS, S.REJECTED].includes(bill.status)) {
    fail('CONFLICT', 'An approved bill is frozen against its snapshot and cannot be refreshed.');
  }

  const changes = [];
  (bill.grns || []).forEach((g) => (g.lines || []).forEach((l) => {
    const q = db.qcs.find((x) => x.grnLineItemId === l.grnLineItemId);
    const gl = db.grnLines.find((x) => x.id === l.grnLineItemId);
    if (!gl) return;
    const accepted = q ? q.acceptedQty : 0;
    const rejected = q ? q.rejectedQty : 0;
    if (l.acceptedQty !== accepted || l.rejectedQty !== rejected || l.receivedQty !== gl.receivedQty) {
      changes.push(`${l.itemCode}: accepted ${l.acceptedQty} to ${accepted}, rejected ${l.rejectedQty} to ${rejected}`);
      l.receivedQty = gl.receivedQty;
      l.acceptedQty = accepted;
      l.rejectedQty = rejected;
      l.qcId = q ? q.id : null;
      l.qcNumber = q ? q.qcNumber : null;
      l.qcStatus = q ? q.status : 'Pending';
      l.qcResult = q ? q.overallResult : null;
      l.qtyUnquantified = !q;
    }
  }));

  if (changes.length) {
    Object.assign(bill, recalcBill(bill));
    bill.taxes = recalcTaxes(bill);
    bill.version += 1;
    pushActivity(bill, 'QC data refreshed', changes.join('; '));
    saveDb(db);
  }
  return clone({ ...decorate(bill, db), refreshed: changes.length, changes });
};

// ── Workflow (section 7.2 transition map) ──────────────────────────────────

const transition = (db, bill, to, action, details, mutate) => {
  if (mutate) mutate(bill);
  bill.status = to;
  bill.version += 1;
  pushActivity(bill, action, details);
  saveDb(db);
  return clone(decorate(bill, db));
};

export const submitBill = async (id) => {
  await delay(200);
  const db = loadDb();
  const bill = findBill(db, id);
  if (![S.DRAFT, S.QUERY_RAISED].includes(bill.status)) fail('CONFLICT', 'Only a draft or queried bill can be submitted.');
  if (!bill.supplierInvoiceNo || !bill.invoiceDate || !bill.invoiceBasicAmount) {
    fail('VALIDATION', 'Invoice number, invoice date and basic amount are mandatory before submitting.');
  }
  if (!billLines(bill).length) fail('VALIDATION', 'Select at least one GRN line to bill.');
  if (!(bill.attachments || []).some((a) => a.docType === 'SUPPLIER_INVOICE')) {
    fail('VALIDATION', 'Attach the supplier invoice before submitting (BR-15).');
  }
  assertNotDuplicate(db, bill);
  assertNoOverBilling(db, bill);
  return transition(db, bill, S.SUBMITTED, 'Submitted for verification', '', (b) => {
    b.submittedAt = nowStamp();
    b.queryReason = null;
  });
};

export const startVerification = async (id) => {
  await delay(120);
  const db = loadDb();
  const bill = findBill(db, id);
  if (bill.status !== S.SUBMITTED) return clone(decorate(bill, db));
  return transition(db, bill, S.UNDER_VERIFICATION, 'Opened for verification');
};

export const raiseQuery = async (id, reason) => {
  await delay();
  const db = loadDb();
  const bill = findBill(db, id);
  if (!reason) fail('VALIDATION', 'A reason is mandatory when raising a query.');
  if (![S.SUBMITTED, S.UNDER_VERIFICATION, S.PENDING_APPROVAL].includes(bill.status)) {
    fail('CONFLICT', 'Only a bill in verification or awaiting approval can be queried.');
  }
  return transition(db, bill, S.QUERY_RAISED, 'Query raised', reason, (b) => { b.queryReason = reason; });
};

export const holdBill = async (id, reason) => {
  await delay();
  const db = loadDb();
  const bill = findBill(db, id);
  if (!reason) fail('VALIDATION', 'A hold reason is mandatory.');
  if (![S.SUBMITTED, S.UNDER_VERIFICATION, S.PENDING_APPROVAL].includes(bill.status)) {
    fail('CONFLICT', 'Only a bill in verification or awaiting approval can be put on hold.');
  }
  return transition(db, bill, S.ON_HOLD, 'Put on hold', reason, (b) => {
    b.holdReason = reason;
    b.holdSince = nowStamp();
  });
};

export const releaseHold = async (id, remarks = '') => {
  await delay();
  const db = loadDb();
  const bill = findBill(db, id);
  if (bill.status !== S.ON_HOLD) fail('CONFLICT', 'This bill is not on hold.');
  return transition(db, bill, S.UNDER_VERIFICATION, 'Hold released', remarks, (b) => {
    b.holdReason = null;
    b.holdSince = null;
  });
};

export const sendForApproval = async (id, { overrideReason = null } = {}) => {
  await delay(200);
  const db = loadDb();
  const bill = findBill(db, id);
  if (bill.status !== S.UNDER_VERIFICATION) fail('CONFLICT', 'Verify the bill before sending it for approval.');

  const exceptions = buildExceptions(bill, db.tolerance, { requireAttachment: true });
  const blockers = blockingExceptions(exceptions);
  if (blockers.length) {
    fail('VALIDATION', `Resolve before approval: ${blockers.map((b) => b.title).join('; ')}`);
  }
  const overridable = exceptions.filter((e) => e.severity === 'BLOCK_WITH_OVERRIDE');
  if (overridable.length && !overrideReason) {
    fail('VALIDATION', `An authorised override with a reason is required: ${overridable.map((e) => e.title).join('; ')}`);
  }
  return transition(db, bill, S.PENDING_APPROVAL, 'Sent for approval',
    overrideReason ? `Override: ${overrideReason}` : `Net payable ${bill.netPayable}`);
};

export const approveBill = async (id, comments = '') => {
  await delay(250);
  const db = loadDb();
  const bill = findBill(db, id);
  if (bill.status !== S.PENDING_APPROVAL) fail('CONFLICT', 'Only a bill awaiting approval can be approved.');
  return transition(db, bill, S.APPROVED, 'Approved', comments || `Net payable ${bill.netPayable}`, (b) => {
    b.approvedAt = nowStamp();
    // Immutable snapshot: what was approved can never be silently altered.
    b.snapshot = clone({ ...b, snapshot: undefined });
    b.snapshotAt = nowStamp();
  });
};

export const rejectBill = async (id, reason) => {
  await delay();
  const db = loadDb();
  const bill = findBill(db, id);
  if (!reason) fail('VALIDATION', 'A reason is mandatory when rejecting a bill.');
  if (bill.status !== S.PENDING_APPROVAL) fail('CONFLICT', 'Only a bill awaiting approval can be rejected.');
  return transition(db, bill, S.REJECTED, 'Rejected', reason, (b) => { b.rejectReason = reason; });
};

/** BR-14 — the only correction path once approved, and closed after Tally entry. */
export const reopenBill = async (id, reason) => {
  await delay();
  const db = loadDb();
  const bill = findBill(db, id);
  if (!reason) fail('VALIDATION', 'A reason is mandatory when reopening a bill.');
  if (![S.APPROVED, S.SENT_TO_ACCOUNTS].includes(bill.status)) fail('CONFLICT', 'Only a passed bill can be reopened.');
  if (bill.tallyReferenceNo) {
    fail('CONFLICT', `${bill.bpNumber} is already entered in Tally as ${bill.tallyReferenceNo}. Reverse that voucher in Tally before reopening.`);
  }
  return transition(db, bill, S.QUERY_RAISED, 'Reopened', reason, (b) => {
    b.reopenReason = reason;
    b.approvedAt = null;
    b.sentToAccountsAt = null;
  });
};

export const sendToAccounts = async (id) => {
  await delay();
  const db = loadDb();
  const bill = findBill(db, id);
  if (bill.status !== S.APPROVED) fail('CONFLICT', 'Only an approved bill can be sent to accounts.');
  return transition(db, bill, S.SENT_TO_ACCOUNTS, 'Sent to accounts', 'Voucher produced for Tally entry', (b) => {
    b.sentToAccountsAt = nowStamp();
  });
};

export const recordTallyReference = async (id, tallyReferenceNo) => {
  await delay(120);
  const db = loadDb();
  const bill = findBill(db, id);
  if (bill.status !== S.SENT_TO_ACCOUNTS) fail('CONFLICT', 'Hand the bill to accounts before recording a Tally voucher.');
  bill.tallyReferenceNo = tallyReferenceNo;
  bill.version += 1;
  pushActivity(bill, 'Tally voucher recorded', tallyReferenceNo);
  saveDb(db);
  return clone(decorate(bill, db));
};

// ── Debits ─────────────────────────────────────────────────────────────────

const assertDebitsEditable = (bill) => {
  if (!areDebitsEditable(bill.status)) fail('CONFLICT', 'Debits can no longer be changed at this stage.');
};

/** FR-BP-403 — recompute what the system would recover, net of debit notes. */
export const refreshProposedDebits = async (id) => {
  await delay(200);
  const db = loadDb();
  const bill = findBill(db, id);
  assertDebitsEditable(bill);

  const lineIds = billLines(bill).map((l) => l.grnLineItemId);
  const notes = db.debitNotes.filter((n) => lineIds.includes(n.grnLineItemId));

  // Existing debit-note links are refreshed so nothing is recovered twice.
  const linked = notes.map((n, i) => {
    const line = billLines(bill).find((l) => l.grnLineItemId === n.grnLineItemId) || {};
    return {
      id: 100000 + i,
      debitTypeCode: 'MATERIAL_REJECTION',
      grnId: n.grnId, grnLineItemId: n.grnLineItemId, qcId: n.qcId,
      debitQty: n.qty, rate: n.unitPrice, debitAmount: round2(n.grandTotal),
      reasonCode: 'QC_REJECTION',
      reasonText: `Recovered on ${n.debitNoteNumber} against return ${n.returnNumber}`,
      remarks: 'Raised through Return to Supplier — shown so the same rejection is not debited twice.',
      gstTreatment: 'WITH_GST',
      origin: DEBIT_ORIGIN.LINKED_DEBIT_NOTE,
      status: DEBIT_STATUS.CONFIRMED,
      debitNoteId: n.id, debitNoteNumber: n.debitNoteNumber,
      itemCode: line.itemCode,
    };
  });

  const manual = (bill.debits || []).filter((d) => d.origin === DEBIT_ORIGIN.MANUAL);
  const kept = (bill.debits || []).filter((d) => d.origin === DEBIT_ORIGIN.SYSTEM_PROPOSED && d.status !== DEBIT_STATUS.PROPOSED);
  bill.debits = [...linked, ...kept, ...manual];

  const withGrn = billLinesWithGrn(bill);
  const fresh = proposeDebits(bill, notes).map((p, i) => ({
    id: nextId(bill.debits) + i,
    grnId: (withGrn.find((l) => l.grnLineItemId === p.grnLineItemId) || {}).grnId || null,
    remarks: '', gstTreatment: 'WITHOUT_GST', debitNoteId: null, debitNoteNumber: null,
    ...p,
  }));
  bill.debits = [...bill.debits, ...fresh];

  Object.assign(bill, recalcBill(bill));
  bill.version += 1;
  if (fresh.length) pushActivity(bill, 'Debits proposed from QC', `${fresh.length} line(s)`);
  saveDb(db);
  return clone(decorate(bill, db));
};

export const saveDebit = async (id, debit) => {
  await delay();
  const db = loadDb();
  const bill = findBill(db, id);
  assertDebitsEditable(bill);
  if (!debit.debitTypeCode) fail('VALIDATION', 'Debit type is mandatory.');
  if (!debit.reasonText) fail('VALIDATION', 'A reason is mandatory on every debit (BR-10).');
  const type = db.debitTypes.find((t) => t.code === debit.debitTypeCode);
  if (type?.requiresQc && !debit.qcId) fail('VALIDATION', `${type.name} is a quality debit — a QC reference is mandatory.`);
  if (!debit.grnId) fail('VALIDATION', 'A reference GRN is mandatory on every debit (BR-10).');

  const amount = type?.quantityBased
    ? round2((Number(debit.debitQty) || 0) * (Number(debit.rate) || 0))
    : round2(debit.debitAmount);

  bill.debits = bill.debits || [];
  const existing = bill.debits.find((d) => d.id === debit.id);
  if (existing) {
    if (existing.origin === DEBIT_ORIGIN.LINKED_DEBIT_NOTE) {
      fail('CONFLICT', `This line is recovered on ${existing.debitNoteNumber} and is maintained in the Debit Note module.`);
    }
    Object.assign(existing, debit, { debitAmount: amount });
  } else {
    bill.debits.push({
      id: nextId(bill.debits),
      origin: DEBIT_ORIGIN.MANUAL,
      status: DEBIT_STATUS.PROPOSED,
      debitNoteId: null, debitNoteNumber: null,
      ...debit,
      debitAmount: amount,
    });
  }
  Object.assign(bill, recalcBill(bill));
  bill.version += 1;
  pushActivity(bill, existing ? 'Debit updated' : 'Debit added', `${debit.debitTypeCode} ${amount}`);
  saveDb(db);
  return clone(decorate(bill, db));
};

export const setDebitStatus = async (id, debitId, status, reason = '') => {
  await delay(120);
  const db = loadDb();
  const bill = findBill(db, id);
  assertDebitsEditable(bill);
  const debit = (bill.debits || []).find((d) => d.id === Number(debitId));
  if (!debit) fail('NOT_FOUND', 'Debit line not found');
  if (debit.origin === DEBIT_ORIGIN.LINKED_DEBIT_NOTE) {
    fail('CONFLICT', `This line is recovered on ${debit.debitNoteNumber} and cannot be changed here.`);
  }
  if (status === DEBIT_STATUS.DROPPED && !reason) fail('VALIDATION', 'A reason is required to drop a debit.');
  debit.status = status;
  if (reason) debit.remarks = reason;
  Object.assign(bill, recalcBill(bill));
  bill.version += 1;
  pushActivity(bill, status === DEBIT_STATUS.CONFIRMED ? 'Debit confirmed' : 'Debit dropped',
    `${debit.debitTypeCode} ${debit.debitAmount}${reason ? ` — ${reason}` : ''}`);
  saveDb(db);
  return clone(decorate(bill, db));
};

export const deleteDebit = async (id, debitId) => {
  await delay(120);
  const db = loadDb();
  const bill = findBill(db, id);
  assertDebitsEditable(bill);
  const debit = (bill.debits || []).find((d) => d.id === Number(debitId));
  if (!debit) fail('NOT_FOUND', 'Debit line not found');
  if (debit.origin === DEBIT_ORIGIN.LINKED_DEBIT_NOTE) {
    fail('CONFLICT', 'A debit note raised through Return to Supplier cannot be removed here.');
  }
  bill.debits = bill.debits.filter((d) => d.id !== debit.id);
  Object.assign(bill, recalcBill(bill));
  bill.version += 1;
  pushActivity(bill, 'Debit removed', debit.debitTypeCode);
  saveDb(db);
  return clone(decorate(bill, db));
};

// ── Issue log (insert-only) ────────────────────────────────────────────────

export const addIssue = async (id, issue) => {
  await delay(120);
  const db = loadDb();
  const bill = findBill(db, id);
  if (!issue.issueTypeCode || !issue.description) fail('VALIDATION', 'Issue type and description are both required.');
  bill.issues = bill.issues || [];
  bill.issues.push({
    id: nextId(bill.issues),
    parentIssueId: issue.parentIssueId || null,
    issueTypeCode: issue.issueTypeCode,
    description: issue.description,
    status: ISSUE_STATUS.OPEN,
    resolutionRemarks: '',
    raisedBy: currentUserName(), raisedAt: nowStamp(),
    resolvedBy: null, resolvedAt: null,
    withdrawnBy: null, withdrawnAt: null, withdrawReason: null,
    autoLogged: false,
  });
  bill.version += 1;
  pushActivity(bill, 'Issue raised', issue.issueTypeCode);
  saveDb(db);
  return clone(decorate(bill, db));
};

export const setIssueStatus = async (id, issueId, status, resolutionRemarks = '') => {
  await delay(120);
  const db = loadDb();
  const bill = findBill(db, id);
  const issue = (bill.issues || []).find((i) => i.id === Number(issueId));
  if (!issue) fail('NOT_FOUND', 'Issue not found');
  if (issue.status === ISSUE_STATUS.WITHDRAWN) fail('CONFLICT', 'A withdrawn issue cannot be changed.');
  issue.status = status;
  issue.resolutionRemarks = resolutionRemarks;
  if (status === ISSUE_STATUS.RESOLVED) {
    issue.resolvedBy = currentUserName();
    issue.resolvedAt = nowStamp();
  }
  bill.version += 1;
  pushActivity(bill, `Issue ${status.toLowerCase().replace('_', ' ')}`, issue.issueTypeCode);
  saveDb(db);
  return clone(decorate(bill, db));
};

/** FR-BP-802 — never deleted; the original text stays visible, struck through. */
export const withdrawIssue = async (id, issueId, reason) => {
  await delay(120);
  const db = loadDb();
  const bill = findBill(db, id);
  if (!reason) fail('VALIDATION', 'A reason is mandatory to withdraw an issue.');
  const issue = (bill.issues || []).find((i) => i.id === Number(issueId));
  if (!issue) fail('NOT_FOUND', 'Issue not found');
  issue.status = ISSUE_STATUS.WITHDRAWN;
  issue.withdrawnBy = currentUserName();
  issue.withdrawnAt = nowStamp();
  issue.withdrawReason = reason;
  bill.version += 1;
  pushActivity(bill, 'Issue withdrawn', reason);
  saveDb(db);
  return clone(decorate(bill, db));
};

// ── Attachments ────────────────────────────────────────────────────────────

export const addAttachment = async (id, att) => {
  await delay(200);
  const db = loadDb();
  const bill = findBill(db, id);
  bill.attachments = bill.attachments || [];
  bill.attachments.push({
    id: nextId(bill.attachments),
    docType: att.docType || 'OTHER',
    fileName: att.fileName, size: att.size, mime: att.mime,
    uploadedAt: nowStamp(), uploadedBy: currentUserName(),
  });
  bill.version += 1;
  pushActivity(bill, 'Attachment added', att.fileName);
  saveDb(db);
  return clone(decorate(bill, db));
};

export const removeAttachment = async (id, attachmentId) => {
  await delay(120);
  const db = loadDb();
  const bill = findBill(db, id);
  const att = (bill.attachments || []).find((a) => a.id === Number(attachmentId));
  if (!att) fail('NOT_FOUND', 'Attachment not found');
  bill.attachments = bill.attachments.filter((a) => a.id !== att.id);
  bill.version += 1;
  pushActivity(bill, 'Attachment removed', att.fileName);
  saveDb(db);
  return clone(decorate(bill, db));
};

// ── Dashboard ──────────────────────────────────────────────────────────────

export const getBillPassingDashboard = async () => {
  await delay(120);
  const db = loadDb();
  const bills = db.bills;
  const byStatus = {};
  bills.forEach((b) => { byStatus[b.status] = (byStatus[b.status] || 0) + 1; });

  const debitByType = {};
  bills.forEach((b) => (b.debits || [])
    .filter((x) => x.status === DEBIT_STATUS.CONFIRMED)
    .forEach((x) => { debitByType[x.debitTypeCode] = round2((debitByType[x.debitTypeCode] || 0) + x.debitAmount); }));

  const bySupplier = {};
  bills.filter((b) => ![S.APPROVED, S.SENT_TO_ACCOUNTS, S.REJECTED].includes(b.status))
    .forEach((b) => { bySupplier[b.supplierName] = round2((bySupplier[b.supplierName] || 0) + b.netPayable); });

  return clone({
    byStatus,
    debitByType,
    topSuppliersByPendingValue: Object.entries(bySupplier)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5),
    exceptionCounts: bills.reduce((acc, b) => {
      buildExceptions(b, db.tolerance).forEach((e) => { acc[e.code] = (acc[e.code] || 0) + 1; });
      return acc;
    }, {}),
  });
};
