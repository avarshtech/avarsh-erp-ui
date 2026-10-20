/**
 * Demo stand-in for the Stage 2 workflow endpoints. One `transition(id, verb, body)` driven by the supplier
 * bill's allowed moves (API calc/BillTransitions.java) — both kinds of bill move the same way. Approval is
 * DIRECT: the demo has no approval engine, and the self-approval guard is relaxed so one reviewer can walk
 * the whole flow.
 */
import dayjs from 'dayjs';
import { decorateBill } from '../../../utils/jobWorkBillCalc';
import { EXCEPTION_SEVERITY } from '../../../utils/billPassingConstants';
import { mutateJwbDb, nextDocNo, refuse } from './jwbDemoStore';
import { logActivity, snapshotFromPo } from './jwbMockSnapshot';
import { assertNotDuplicate, findBill } from './jwbMockBills';

const ALLOWED = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['UNDER_VERIFICATION', 'REFERRED_BACK', 'QUERY_RAISED', 'ON_HOLD'],
  UNDER_VERIFICATION: ['PENDING_APPROVAL', 'REFERRED_BACK', 'QUERY_RAISED', 'ON_HOLD'],
  REFERRED_BACK: ['SUBMITTED'],
  QUERY_RAISED: ['SUBMITTED'],
  ON_HOLD: ['UNDER_VERIFICATION', 'REFERRED_BACK'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'REFERRED_BACK', 'QUERY_RAISED', 'ON_HOLD'],
  APPROVED: ['SENT_TO_ACCOUNTS', 'QUERY_RAISED'],
  SENT_TO_ACCOUNTS: ['QUERY_RAISED'],
  REJECTED: [],
};

const now = () => dayjs().toISOString();

const requireNoBlockers = (bill) => {
  const d = decorateBill(bill);
  if (d.blockers.length) throw refuse(`Resolve before approval: ${d.blockers.join('; ')}`);
  return d;
};

/** Each verb: target status (null = stays), the reason field it records, and what else it checks or stamps. */
const VERBS = {
  submit: {
    to: 'SUBMITTED', log: 'Submitted',
    apply: (db, b) => {
      // The figures are read one last time; from here on the DC checks are frozen.
      Object.assign(b, snapshotFromPo(db, db.pos.find((p) => p.id === b.poId), b));
      if (!b.vendorInvoiceNo?.trim() || !b.vendorInvoiceDate) throw refuse('Enter the vendor invoice no. and date before submitting');
      if (!decorateBill(b).lines.some((l) => l.invoiceUnits > 0)) throw refuse('Nothing on this bill is invoiced');
      assertNotDuplicate(db, b);
      b.submittedAt = now();
    },
  },
  startVerification: { to: 'UNDER_VERIFICATION', log: 'Verification started', apply: (db, b) => { b.verifiedAt = now(); } },
  query: { to: 'QUERY_RAISED', reason: 'queryReason', log: 'Query raised' },
  hold: { to: 'ON_HOLD', reason: 'holdReason', log: 'Put on hold', apply: (db, b) => { b.holdSince = now(); } },
  release: { to: 'UNDER_VERIFICATION', reason: 'releaseRemarks', log: 'Hold released' },
  referBack: { to: 'REFERRED_BACK', reason: 'referBackReason', log: 'Referred back' },
  sendForApproval: {
    to: 'PENDING_APPROVAL', log: 'Sent for approval',
    apply: (db, b, body) => {
      const d = requireNoBlockers(b);
      const overridable = d.exceptions.filter((x) => x.severity === EXCEPTION_SEVERITY.BLOCK_WITH_OVERRIDE);
      if (overridable.length && !body.overrideReason?.trim()) {
        throw refuse(`An authorised override with a reason is required: ${overridable.map((x) => x.title).join('; ')}`);
      }
      b.overrideReason = body.overrideReason?.trim() || null;
      b.sentForApprovalAt = now();
    },
  },
  approve: {
    to: 'APPROVED', log: 'Approved',
    apply: (db, b) => {
      const d = requireNoBlockers(b);
      b.approvedAt = now();
      // D5: confirmed deductions become the Vendor Debit Note; a reopened bill keeps its number.
      if (d.debitNoteTotal > 0 || b.vdnNumber) {
        b.vdnRevision = b.vdnNumber ? (b.vdnRevision || 1) + 1 : 1;
        b.vdnNumber = b.vdnNumber || nextDocNo(db, 'VDN');
        b.vdnDate = dayjs().format('YYYY-MM-DD');
        b.vdnAmount = d.debitNoteTotal;
      }
    },
  },
  reject: { to: 'REJECTED', reason: 'rejectReason', log: 'Rejected', apply: (db, b) => { b.rejectedAt = now(); } },
  reopen: {
    to: 'QUERY_RAISED', reason: 'reopenReason', log: 'Reopened',
    apply: (db, b) => {
      if (b.tallyReferenceNo) throw refuse(`${b.jwbNumber} is booked in Tally (${b.tallyReferenceNo}) and cannot be reopened`);
      b.approvedAt = null;
      b.sentToAccountsAt = null;
    },
  },
  sendToAccounts: { to: 'SENT_TO_ACCOUNTS', log: 'Sent to accounts', apply: (db, b) => { b.sentToAccountsAt = now(); } },
  tallyReference: {
    to: null, log: 'Tally reference recorded',
    apply: (db, b, body) => {
      if (b.status !== 'SENT_TO_ACCOUNTS') throw refuse('A Tally reference is recorded once the bill is with accounts');
      b.tallyReferenceNo = body.reason.trim();
    },
  },
};

export const transition = (id, verb, body = {}) => mutateJwbDb((db) => {
  const v = VERBS[verb];
  const bill = findBill(db, id);
  if (v.to && !ALLOWED[bill.status]?.includes(v.to)) {
    throw refuse(`${bill.jwbNumber} is ${bill.status.replaceAll('_', ' ').toLowerCase()} and cannot be ${v.log.toLowerCase()}`);
  }
  if ((v.reason || verb === 'tallyReference') && !body.reason?.trim()) {
    throw refuse('A reason is required', { status: 400, error: 'VALIDATION_FAILED' });
  }
  v.apply?.(db, bill, body);
  if (v.reason) bill[v.reason] = body.reason.trim();
  if (v.to) bill.status = v.to;
  bill.version += 1;
  const detail = v.reason || verb === 'tallyReference' ? body.reason.trim()
    : (verb === 'approve' && bill.vdnNumber ? `Vendor Debit Note ${bill.vdnNumber}` : (bill.overrideReason && verb === 'sendForApproval' ? `Override: ${bill.overrideReason}` : ''));
  bill.activity = logActivity(bill, v.log, detail);
  return decorateBill(bill);
});
