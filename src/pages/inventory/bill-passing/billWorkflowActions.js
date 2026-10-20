import { formatCurrency } from '../../../utils/formatters';
import {
  BILL_PASSING_STATUS as S, EXCEPTION_SEVERITY, isBillSubmittable, canReferBackBill,
} from '../../../utils/billPassingConstants';

/**
 * A bill's workflow buttons as data — which apply to this bill, in its status, for this user, and what each
 * does. The supplier and the job-work bill workspaces both render this list (BillWorkflowBar), so they offer
 * the same verbs, in the same order, with the same wording.
 *
 * `verbs` are the service calls; both facades take the same arguments (id, …, version).
 * `ui` carries the screen's helpers: run, openReason, confirm, onSave, onSubmit.
 * `print` is `{ text, onClick }` or null; it shows once the bill is approved.
 */
export const buildBillActions = ({
  bill, docNo, partyLabel = 'supplier', verifyAgainst = 'the PO, GRN and QC records',
  can, verbs, ui, submitBlockReason, print,
}) => {
  if (!bill) return [];
  const { run, openReason, confirm, onSave, onSubmit } = ui;
  const v = bill.version;
  const out = [];
  const ask = (key, title, label, successMsg, call, extra = {}) => () => openReason({
    key, title, label, successMsg, onSubmit: (t) => call(t), ...extra,
  });

  if (bill.editable && can.update) {
    out.push({ key: 'save', action: 'save', variant: 'draft', text: 'Save', onClick: () => onSave() });
  }
  if (isBillSubmittable(bill.status) && can.update) {
    out.push({
      key: 'submit', action: 'save', text: 'Submit', disabled: Boolean(submitBlockReason),
      tooltip: submitBlockReason || undefined, onClick: onSubmit,
    });
  }
  if (bill.status === S.SUBMITTED && can.verify) {
    out.push({
      key: 'verify', action: 'approve', text: 'Start Verification', onClick: () => confirm({
        title: `Start verification of ${docNo}?`,
        content: `You take up the bill for checking against ${verifyAgainst}. The clerk can still correct it until it is approved, and every edit is logged on the activity trail.`,
        okText: 'Start',
        onOk: () => run('verify', () => verbs.startVerification(bill.id, v), 'Verification started'),
      }),
    });
  }
  if (canReferBackBill(bill.status) && (can.verify || can.approve)) {
    out.push({
      key: 'referback', action: 'refer-back', text: 'Refer Back',
      onClick: ask('referback', 'Refer this bill back for correction', 'What needs correcting', 'Bill referred back',
        (t) => verbs.referBack(bill.id, t, v)),
    });
  }
  if ((bill.status === S.UNDER_VERIFICATION || bill.status === S.PENDING_APPROVAL) && (can.verify || can.approve)) {
    out.push({
      key: 'query', action: 'refer-back', iconKey: 'query', text: 'Raise Query',
      onClick: ask('query', `Raise a query with the ${partyLabel}`, 'Query details', 'Query raised',
        (t) => verbs.raiseQuery(bill.id, t, v)),
    });
    out.push({
      key: 'hold', action: 'cancel', text: 'Hold',
      onClick: ask('hold', 'Put this bill on hold', 'Hold reason', 'Bill put on hold', (t) => verbs.hold(bill.id, t, v)),
    });
  }
  if (bill.status === S.UNDER_VERIFICATION && can.verify) {
    // The server's rule (BpApprovalService.sendForApproval): `blockers` (BLOCK) refuse outright; a
    // BLOCK_WITH_OVERRIDE exception goes through only with a recorded reason.
    const blocked = Boolean(bill.blockers?.length);
    const overridable = (bill.exceptions || []).filter((x) => x.severity === EXCEPTION_SEVERITY.BLOCK_WITH_OVERRIDE);
    out.push({
      key: 'approval', action: 'send', text: 'Send for Approval', disabled: blocked,
      tooltip: blocked ? 'Clear the blockers listed above first' : undefined,
      onClick: () => {
        if (overridable.length) {
          ask('approval', 'Override and send for approval',
            `Override justification (${overridable.map((x) => x.title).join('; ')})`, 'Sent for approval with override',
            (t) => verbs.sendForApproval(bill.id, { overrideReason: t }, v))();
          return;
        }
        run('approval', () => verbs.sendForApproval(bill.id, {}, v), 'Sent for approval');
      },
    });
  }
  if (bill.status === S.ON_HOLD && can.verify) {
    out.push({
      key: 'release', action: 'refresh', text: 'Release Hold',
      onClick: ask('release', 'Release this bill from hold', 'Release remarks', 'Hold released',
        (t) => verbs.releaseHold(bill.id, t, v)),
    });
  }
  // With an approval flow the engine owns the decision (ApprovalActionBar); these buttons serve the case where
  // no flow matched. The bill stays editable while it waits, so the blocker gate applies here too.
  if (bill.status === S.PENDING_APPROVAL && can.approve && bill.approvalMode !== 'ENGINE') {
    const blocked = Boolean(bill.blockers?.length);
    out.push({
      key: 'approve', action: 'approve', text: 'Approve', disabled: blocked,
      tooltip: blocked ? 'Clear the blockers listed above before approving' : undefined,
      onClick: () => confirm({
        title: `Approve ${docNo}?`,
        content: `Net payable ${formatCurrency(bill.netPayable)} will be cleared for accounts.`,
        okText: 'Approve',
        onOk: () => run('approve', () => verbs.approve(bill.id, '', v), 'Bill approved'),
      }),
    });
    out.push({
      key: 'reject', action: 'reject', text: 'Reject',
      onClick: ask('reject', 'Reject this bill', 'Rejection reason', 'Bill rejected', (t) => verbs.reject(bill.id, t, v),
        { danger: true, okText: 'Reject' }),
    });
  }
  const printBtn = print ? { key: 'print', action: 'print', text: print.text, onClick: print.onClick, noBusy: true } : null;
  if (bill.status === S.APPROVED) {
    if (can.approve) {
      out.push({
        key: 'accounts', action: 'send', text: 'Send to Accounts', onClick: () => confirm({
          title: `Send ${docNo} to accounts?`,
          content: 'The bill is handed to Tally for payment processing and can no longer be reopened by verification.',
          okText: 'Send',
          onOk: () => run('accounts', () => verbs.sendToAccounts(bill.id, v), 'Sent to accounts'),
        }),
      });
      out.push({
        key: 'reopen', action: 'refer-back', text: 'Reopen',
        onClick: ask('reopen', 'Reopen this bill for verification', 'Reopen reason', 'Bill reopened',
          (t) => verbs.reopen(bill.id, t, v)),
      });
    }
    if (printBtn) out.push(printBtn);
  }
  if (bill.status === S.SENT_TO_ACCOUNTS) {
    if (can.approve) {
      out.push({
        key: 'tally', action: 'save', variant: 'draft', text: 'Record Tally Ref',
        onClick: ask('tally', 'Record the Tally reference', 'Tally reference no', 'Tally reference recorded',
          (t) => verbs.recordTallyReference(bill.id, t, v), { minLength: 3, placeholder: 'e.g. TLY/26-27/00412' }),
      });
    }
    if (printBtn) out.push(printBtn);
  }
  return out;
};
