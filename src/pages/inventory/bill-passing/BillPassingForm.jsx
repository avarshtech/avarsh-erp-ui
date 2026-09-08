import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { App, Card, Form, Input, DatePicker, Row, Col, Collapse, Typography, Tag, Alert, Space, Modal, Skeleton, Result } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { QuestionCircleOutlined } from '@ant-design/icons';
import PageHeader from '../../../components/PageHeader';
import ApprovalActionBar from '../../../components/approval/ApprovalActionBar';
import { ActionButton } from '../../../components/buttons';
import useUnsavedChanges from '../../../hooks/useUnsavedChanges';
import useBusyAction from '../../../hooks/useBusyAction';
import useBillPassingMasters from '../../../hooks/useBillPassingMasters';
import { useTheme } from '../../../context/ThemeContext';
import { hasPermission } from '../../../utils/permissions';
import { formatCurrency, formatNumber } from '../../../utils/formatters';
import { DATE_FORMAT } from '../../../utils/uiConstants';
import { recalcBill, recalcTaxes, billLines, debitPercentOfInvoice, hasSupplierInvoice } from '../../../utils/billPassingCalc';
import { printBillPassingVoucher } from '../../../utils/billPassingVoucherPrint';
import {
  BILL_PASSING_STATUS as S,
  BILL_PASSING_STATUS_COLOR,
  BILL_PASSING_STATUS_LABEL,
  EXCEPTION_SEVERITY,
  ISSUE_STATUS,
  BP_MODULE_ID,
  isBillSubmittable,
  canReferBackBill,
  getBillReason,
} from '../../../utils/billPassingConstants';
import {
  getBill, updateBill, getPoBillingSource,
  submitBill, startVerification, raiseQuery, referBackBill, holdBill, releaseHold, sendForApproval,
  approveBill, rejectBill, reopenBill, sendToAccounts, recordTallyReference,
  saveDebit, setDebitStatus, deleteDebit, refreshProposedDebits,
  addIssue, setIssueStatus, withdrawIssue, addAttachment, removeAttachment,
} from '../../../services/inventory/billPassingService';
import BpPoSummaryCard from './BpPoSummaryCard';
import BpGrnSelectionTable from './BpGrnSelectionTable';
import BpQcPanel from './BpQcPanel';
import BpReconciliationPanel from './BpReconciliationPanel';
import BpDebitTable from './BpDebitTable';
import BpCalculationPanel from './BpCalculationPanel';
import BpIssueLog from './BpIssueLog';
import BpAttachments from './BpAttachments';

const { Text } = Typography;
const { TextArea } = Input;

const SECTION_KEYS = ['po', 'grn', 'qc', 'recon', 'debits', 'calc', 'issues', 'docs'];

/**
 * The bill workspace, always opened on an existing draft — the supplier/PO pick
 * that starts one lives in BillPassingCreateModal, off the list page.
 */
const BillPassingForm = () => {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const { isDarkMode } = useTheme();
  const [form] = Form.useForm();

  const [bill, setBill] = useState(null);
  const [source, setSource] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  // The key of the mutation in flight (see `run`), so only that action's button spins.
  const { busy, setBusy, busyProps } = useBusyAction();
  // Cached across screens rather than fetched on every bill open.
  const { debitTypes, chargeTypes, issueTypes } = useBillPassingMasters();

  const [isDirty, setIsDirty] = useState(false);
  const { clearDirty } = useUnsavedChanges(isDirty);

  // Reason capture — one modal serves every action that needs a typed justification
  const [reasonCfg, setReasonCfg] = useState(null);
  const [reasonText, setReasonText] = useState('');

  // Permissions come from the session token and do not change while the page is mounted.
  const { canUpdate, canVerify, canApprove } = useMemo(() => ({
    canUpdate: hasPermission(BP_MODULE_ID, 'update'),
    canVerify: hasPermission(BP_MODULE_ID, 'verify'),
    canApprove: hasPermission(BP_MODULE_ID, 'approve'),
  }), []);

  // Open until the bill is passed, but only to someone allowed to update it — a
  // verify-only user gets the same read-only workspace they would after approval.
  const readOnly = !bill?.editable || !canUpdate;

  // ==================== LOAD ====================

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    (async () => {
      try {
        const b = await getBill(id);
        if (cancelled) return;
        setBill(b);
        const src = await getPoBillingSource(b.poId, { excludeBillId: b.id });
        if (!cancelled) setSource(src);
      } catch (e) {
        if (!cancelled) setLoadError(e.message || 'Failed to load this bill');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, message]);

  // The header fields are pushed in only once the form is on screen. While the
  // bill is loading the workspace renders a skeleton, and writing to a
  // `useForm` instance whose <Form> has not mounted warns in the console.
  const seededBillId = useRef(null);
  useEffect(() => {
    if (loading || !bill || seededBillId.current === bill.id) return;
    seededBillId.current = bill.id;
    form.setFieldsValue({
      supplierInvoiceNo: bill.supplierInvoiceNo,
      invoiceDate: bill.invoiceDate ? dayjs(bill.invoiceDate) : null,
      headerRemarks: bill.headerRemarks,
    });
  }, [loading, bill, form]);

  /** Re-read the bill after the approval engine has acted on it. */
  const reloadBill = useCallback(async () => {
    try {
      setBill(await getBill(id));
    } catch (e) {
      if (!e.response) message.error(e.message || 'Failed to reload the bill');
    }
  }, [id, message]);

  const reloadSource = useCallback(async (b) => {
    try {
      setSource(await getPoBillingSource(b.poId, { excludeBillId: b.id }));
    } catch (e) {
      message.error(e.message || 'Failed to refresh PO billing data');
    }
  }, [message]);

  // ==================== MUTATION PLUMBING ====================

  /**
   * Runs a service call, folds the returned bill into state and toasts the outcome.
   * `key` names the action so its own button (via `busyProps(key)`) is the one that spins.
   */
  const run = useCallback(async (key, fn, successMsg) => {
    setBusy(key);
    try {
      const next = await fn();
      if (next?.id) {
        // Adopt what came back, version included: the next call sends that
        // version, and holding the copy we had would make it look stale.
        setBill(next);
        setIsDirty(false);
        clearDirty();
      }
      if (successMsg) message.success(successMsg);
      return next;
    } catch (e) {
      // axiosInstance already toasts the server's message; only say something
      // when it could not have.
      if (!e.response) message.error(e.message || 'Action failed');
      return null;
    } finally {
      setBusy(null);
    }
  }, [message, setBusy, clearDirty]);

  /** Local, in-progress edits (GRN picks, charges, adjustments) — recalculated live. */
  const patchBill = useCallback((patch) => {
    setBill((prev) => {
      if (!prev) return prev;
      const merged = { ...prev, ...patch };
      const next = recalcBill({ ...merged, taxes: patch.taxes ?? recalcTaxes(merged) });
      // Keep the section header counters honest while the user is still editing —
      // grnCount/lineCount/debitPercent are server decorations that go stale on a local patch.
      return {
        ...next,
        grnCount: (next.grns || []).length,
        lineCount: billLines(next).length,
        debitPercent: debitPercentOfInvoice(next),
      };
    });
    setIsDirty(true);
  }, []);

  // `busyKey` lets Submit's save-then-submit keep the Submit button spinning
  // throughout. `quiet` drops the "Bill saved" toast when the save is only the
  // first half of a submit, so a refused submit shows one message, not a
  // success followed by an error.
  const handleSave = useCallback(async (busyKey = 'save', { quiet = false } = {}) => {
    let values;
    try {
      values = await form.validateFields();
    } catch {
      message.warning('Please complete the invoice details before saving');
      return null;
    }
    const next = await run(busyKey, () => updateBill(bill.id, {
      supplierInvoiceNo: values.supplierInvoiceNo,
      invoiceDate: values.invoiceDate.format('YYYY-MM-DD'),
      headerRemarks: values.headerRemarks || '',
      adjustmentTotal: bill.adjustmentTotal,
      grns: (bill.grns || []).map((g) => ({
        grnId: g.grnId,
        lines: (g.lines || []).map((l) => ({
          grnLineItemId: l.grnLineItemId,
          billedQty: l.billedQty,
          invoiceRate: l.invoiceRate,
        })),
      })),
      // A row the user just added has a temporary key rather than an id; the
      // server assigns the real one and the panel re-seeds from the response.
      charges: (bill.charges || []).map((c) => ({
        ...c,
        id: typeof c.id === 'string' && c.id.startsWith('tmp-') ? null : c.id,
      })),
      taxes: (bill.taxes || []).map((t) => ({
        ...t,
        id: typeof t.id === 'string' && t.id.startsWith('tmp-') ? null : t.id,
      })),
      version: bill.version,
    }), quiet ? null : 'Bill saved');
    if (next) reloadSource(next);
    return next;
  }, [form, run, bill, reloadSource, message]);

  const handleSubmit = useCallback(() => {
    modal.confirm({
      title: `Submit ${bill.bpNumber}?`,
      content: 'The bill is saved and moves to the verification queue. It stays editable until it is approved.',
      okText: 'Save & Submit',
      onOk: async () => {
        const saved = await handleSave('submit', { quiet: true });
        if (saved) {
          await run('submit', () => submitBill(saved.id, saved.version),
            'Bill submitted for verification');
        }
      },
    });
  }, [bill, handleSave, modal, run]);

  const openReason = useCallback((cfg) => { setReasonText(''); setReasonCfg(cfg); }, []);

  const submitReason = useCallback(async () => {
    if (!reasonCfg) return;
    const text = reasonText.trim();
    const min = reasonCfg.minLength ?? 10;
    if (text.length < min) {
      message.warning(`Please enter at least ${min} characters`);
      return;
    }
    const cfg = reasonCfg;
    setReasonCfg(null);
    await run(cfg.key, () => cfg.onSubmit(text), cfg.successMsg);
  }, [reasonCfg, reasonText, run, message]);

  // The same voucher the view dialog prints. GSTIN and payment terms live on the
  // supplier master, which the PO billing source already carries, so the window
  // opens synchronously inside the click and pop-up blockers stay quiet.
  const handlePrint = useCallback(() => {
    if (!bill) return;
    const ok = printBillPassingVoucher({
      ...bill,
      supplierGstin: source?.supplier?.gstin,
      paymentTerms: source?.supplier?.paymentTerms,
    });
    if (!ok) message.warning('Allow pop-ups to print the bill passing voucher');
  }, [bill, source, message]);

  // ==================== HEADER ACTIONS ====================

  // Submit is refused without a billed line or the supplier invoice copy
  // (BR-15). Mirroring those two checks here lets the button say why it is
  // disabled instead of saving the bill and then failing the round trip.
  const submitBlockReason = useMemo(() => {
    if (!bill) return null;
    if (!billLines(bill).length) return 'Select at least one GRN line to bill';
    // Whether the invoice copy is mandatory is the server's rule, not ours: it
    // is switched off where there is no file storage to attach one to.
    if (bill.requireInvoiceAttachment && !hasSupplierInvoice(bill)) {
      return 'Attach the supplier invoice before submitting (BR-15)';
    }
    return null;
  }, [bill]);

  const headerActions = useMemo(() => {
    if (!bill) return null;
    const btns = [];
    const push = (el) => btns.push(el);

    if (bill.editable && canUpdate) {
      push(<ActionButton key="save" action="save" variant="draft" text="Save" {...busyProps('save')} onClick={() => handleSave()} />);
    }
    if (isBillSubmittable(bill.status) && canUpdate) {
      push(<ActionButton key="submit" action="save" text="Submit" {...busyProps('submit', Boolean(submitBlockReason))}
        tooltip={submitBlockReason || undefined} onClick={handleSubmit} />);
    }
    if (bill.status === S.SUBMITTED && canVerify) {
      push(<ActionButton key="verify" action="approve" text="Start Verification" {...busyProps('verify')} onClick={() => modal.confirm({
        title: `Start verification of ${bill.bpNumber}?`,
        content: 'You take up the bill for checking against the PO, GRN and QC records. The clerk can still correct it until it is approved, and every edit is logged on the activity trail.',
        okText: 'Start',
        onOk: () => run('verify', () => startVerification(bill.id, bill.version), 'Verification started'),
      })} />);
    }
    if (canReferBackBill(bill.status) && (canVerify || canApprove)) {
      push(<ActionButton key="referback" action="refer-back" text="Refer Back" {...busyProps('referback')} onClick={() => openReason({
        key: 'referback',
        title: 'Refer this bill back for correction', label: 'What needs correcting', successMsg: 'Bill referred back',
        onSubmit: (t) => referBackBill(bill.id, t, bill.version),
      })} />);
    }
    if ((bill.status === S.UNDER_VERIFICATION || bill.status === S.PENDING_APPROVAL) && (canVerify || canApprove)) {
      push(<ActionButton key="query" action="refer-back" icon={<QuestionCircleOutlined />} text="Raise Query" {...busyProps('query')} onClick={() => openReason({
        key: 'query',
        title: 'Raise a query with the supplier', label: 'Query details', successMsg: 'Query raised',
        onSubmit: (t) => raiseQuery(bill.id, t, bill.version),
      })} />);
      push(<ActionButton key="hold" action="cancel" text="Hold" {...busyProps('hold')} onClick={() => openReason({
        key: 'hold',
        title: 'Put this bill on hold', label: 'Hold reason', successMsg: 'Bill put on hold',
        onSubmit: (t) => holdBill(bill.id, t, bill.version),
      })} />);
    }
    if (bill.status === S.UNDER_VERIFICATION && canVerify) {
      push(<ActionButton key="approval" action="send" text="Send for Approval"
        {...busyProps('approval', !bill.canSendForApproval && !bill.blockers?.length)}
        onClick={() => {
          if (bill.blockers?.length) {
            openReason({
              key: 'approval',
              title: 'Override and send for approval', label: 'Override justification',
              successMsg: 'Sent for approval with override',
              onSubmit: (t) => sendForApproval(bill.id, { overrideReason: t }, bill.version),
            });
            return;
          }
          run('approval', () => sendForApproval(bill.id, {}, bill.version), 'Sent for approval');
        }} />);
    }
    if (bill.status === S.ON_HOLD && canVerify) {
      push(<ActionButton key="release" action="refresh" text="Release Hold" {...busyProps('release')} onClick={() => openReason({
        key: 'release',
        title: 'Release this bill from hold', label: 'Release remarks', successMsg: 'Hold released',
        onSubmit: (t) => releaseHold(bill.id, t, bill.version),
      })} />);
    }
    // When an approval flow governs this bill the engine owns the decision and
    // ApprovalActionBar carries it; these buttons are for the case where no
    // flow matched, which is the default until an admin configures one.
    if (bill.status === S.PENDING_APPROVAL && canApprove && bill.approvalMode !== 'ENGINE') {
      // The bill stays editable while it waits, so a blocker can appear after
      // Send for Approval cleared it — the same gate applies here.
      const blocked = Boolean(bill.blockers?.length);
      push(<ActionButton key="approve" action="approve" text="Approve" {...busyProps('approve', blocked)}
        tooltip={blocked ? 'Clear the blockers listed above before approving' : undefined}
        onClick={() => modal.confirm({
        title: `Approve ${bill.bpNumber}?`,
        content: `Net payable ${formatCurrency(bill.netPayable)} will be cleared for accounts.`,
        okText: 'Approve',
        onOk: () => run('approve', () => approveBill(bill.id, '', bill.version), 'Bill approved'),
      })} />);
      push(<ActionButton key="reject" action="reject" text="Reject" {...busyProps('reject')} onClick={() => openReason({
        key: 'reject',
        title: 'Reject this bill', label: 'Rejection reason', danger: true, okText: 'Reject',
        successMsg: 'Bill rejected', onSubmit: (t) => rejectBill(bill.id, t, bill.version),
      })} />);
    }
    if (bill.status === S.APPROVED) {
      if (canApprove) {
        push(<ActionButton key="accounts" action="send" text="Send to Accounts" {...busyProps('accounts')} onClick={() => modal.confirm({
          title: `Send ${bill.bpNumber} to accounts?`,
          content: 'The bill is handed to Tally for payment processing and can no longer be reopened by verification.',
          okText: 'Send',
          onOk: () => run('accounts', () => sendToAccounts(bill.id, bill.version), 'Sent to accounts'),
        })} />);
        push(<ActionButton key="reopen" action="refer-back" text="Reopen" {...busyProps('reopen')} onClick={() => openReason({
          key: 'reopen',
          title: 'Reopen this bill for verification', label: 'Reopen reason', successMsg: 'Bill reopened',
          onSubmit: (t) => reopenBill(bill.id, t, bill.version),
        })} />);
      }
      push(<ActionButton key="print" action="print" text="Print Voucher" onClick={handlePrint} />);
    }
    if (bill.status === S.SENT_TO_ACCOUNTS) {
      if (canApprove) {
        push(<ActionButton key="tally" action="save" variant="draft" text="Record Tally Ref" {...busyProps('tally')} onClick={() => openReason({
          key: 'tally',
          title: 'Record the Tally reference', label: 'Tally reference no', minLength: 3,
          placeholder: 'e.g. TLY/26-27/00412', successMsg: 'Tally reference recorded',
          onSubmit: (t) => recordTallyReference(bill.id, t, bill.version),
        })} />);
      }
      push(<ActionButton key="print" action="print" text="Print Voucher" onClick={handlePrint} />);
    }
    return <Space wrap>{btns}</Space>;
  }, [bill, submitBlockReason, canUpdate, canVerify, canApprove, busyProps, handleSave, handleSubmit, handlePrint, modal, run, openReason]);

  // ==================== SECTION STYLES ====================

  const sectionHeaderStyle = (color) => ({
    background: isDarkMode
      ? `linear-gradient(135deg, ${color}22 0%, ${color}11 100%)`
      : `linear-gradient(135deg, ${color}15 0%, ${color}08 100%)`,
    borderRadius: 8,
    border: `1px solid ${isDarkMode ? `${color}33` : `${color}22`}`,
  });

  const warnExceptions = useMemo(
    () => (bill?.exceptions || []).filter((x) => x.severity === EXCEPTION_SEVERITY.WARN),
    [bill],
  );

  const openIssues = useMemo(
    () => (bill?.issues || []).filter((i) => i.status === ISSUE_STATUS.OPEN || i.status === ISSUE_STATUS.IN_PROGRESS).length,
    [bill],
  );

  // Why the bill is back with the clerk (or parked), shown above the workspace.
  const reason = getBillReason(bill);

  const label = (text, color, tag) => (
    <Space size={8}>
      <Text strong style={{ fontSize: 15, color }}>{text}</Text>
      {tag}
    </Space>
  );

  const collapseItems = useMemo(() => {
    if (!bill) return [];
    return [
      {
        key: 'po',
        label: label('PO Summary', '#6366f1', source?.po?.poNumber ? <Tag color="geekblue">{source.po.poNumber}</Tag> : null),
        style: sectionHeaderStyle('#6366f1'),
        children: <BpPoSummaryCard source={source} bill={bill} />,
      },
      {
        key: 'grn',
        label: label('GRN / Challan Details', 'var(--info-color)', <Tag color="cyan">{`${bill.grnCount || 0} GRN · ${bill.lineCount || 0} lines`}</Tag>),
        style: sectionHeaderStyle('#0891b2'),
        children: (
          <BpGrnSelectionTable
            source={source}
            bill={bill}
            readOnly={readOnly}
            onChange={(grns) => patchBill({ grns })}
          />
        ),
      },
      {
        key: 'qc',
        label: label('QC Details', '#8b5cf6', null),
        style: sectionHeaderStyle('#8b5cf6'),
        children: <BpQcPanel bill={bill} source={source} />,
      },
      {
        key: 'recon',
        label: label('Reconciliation', '#0ea5e9', bill.exceptions?.length ? <Tag color="orange">{`${bill.exceptions.length} exception${bill.exceptions.length > 1 ? 's' : ''}`}</Tag> : <Tag color="green">Clean</Tag>),
        style: sectionHeaderStyle('#0ea5e9'),
        children: <BpReconciliationPanel bill={bill} />,
      },
      {
        key: 'debits',
        label: label('Debits', '#ef4444', <Tag color="red">{`${formatCurrency(bill.debitTotal)} · ${formatNumber(bill.debitPercent, 2)}%`}</Tag>),
        style: sectionHeaderStyle('#ef4444'),
        children: (
          <BpDebitTable
            bill={bill}
            debitTypes={debitTypes}
            readOnly={!bill.debitsEditable}
            onSave={(debit) => run('debit', () => saveDebit(bill.id, { ...debit, version: bill.version }), 'Debit saved')}
            onSetStatus={(debitId, status, reason) => run('debit', () => setDebitStatus(bill.id, debitId, status, reason, bill.version), 'Debit updated')}
            onDelete={(debitId) => run('debit', () => deleteDebit(bill.id, debitId, bill.version), 'Debit removed')}
            onRefreshProposals={() => run('debit', () => refreshProposedDebits(bill.id, bill.version), 'Proposed debits refreshed')}
          />
        ),
      },
      {
        key: 'calc',
        label: label('Calculation', '#10b981', <Tag color="green">{`Net ${formatCurrency(bill.netPayable)}`}</Tag>),
        style: sectionHeaderStyle('#10b981'),
        children: (
          <BpCalculationPanel
            bill={bill}
            chargeTypes={chargeTypes}
            readOnly={readOnly}
            onChange={patchBill}
          />
        ),
      },
      {
        key: 'issues',
        label: label('Issues', '#f59e0b', openIssues ? <Tag color="orange">{`${openIssues} open`}</Tag> : null),
        style: sectionHeaderStyle('#f59e0b'),
        children: (
          <BpIssueLog
            bill={bill}
            issueTypes={issueTypes}
            onAdd={(issue) => run('issue', () => addIssue(bill.id, { ...issue, version: bill.version }), 'Issue logged')}
            onSetStatus={(issueId, status, remarks) => run('issue', () => setIssueStatus(bill.id, issueId, status, remarks, bill.version), 'Issue updated')}
            onWithdraw={(issueId, reason) => run('issue', () => withdrawIssue(bill.id, issueId, reason, bill.version), 'Issue withdrawn')}
          />
        ),
      },
      {
        key: 'docs',
        label: label('Attachments', '#64748b', bill.attachments?.length ? <Tag>{bill.attachments.length}</Tag> : null),
        style: sectionHeaderStyle('#64748b'),
        children: (
          <BpAttachments
            bill={bill}
            readOnly={readOnly}
            onAdd={(att) => run('attachment', () => addAttachment(bill.id, att), 'Attachment added')}
            onRemove={(attId) => run('attachment', () => removeAttachment(bill.id, attId), 'Attachment removed')}
          />
        ),
      },
    ];
    // sectionHeaderStyle/label are cheap pure closures over isDarkMode
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bill, source, readOnly, isDarkMode, debitTypes, chargeTypes, issueTypes, openIssues, patchBill, run]);

  // ==================== RENDER ====================

  if (loading) {
    return (
      <div className="animate-fade-in-up inv-page">
        <PageHeader title="Bill Passing" backPath="/inventory/bill-passing" />
        <Card style={{ marginBottom: 16 }}><Skeleton active paragraph={{ rows: 3 }} /></Card>
        <Card><Skeleton active paragraph={{ rows: 8 }} /></Card>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="animate-fade-in-up inv-page">
        <PageHeader title="Bill Passing" backPath="/inventory/bill-passing" />
        <Result
          status="warning"
          title="This bill could not be opened"
          subTitle={loadError}
          extra={<ActionButton action="back" text="Back to Bill Passing" onClick={() => navigate('/inventory/bill-passing')} />}
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up inv-page">
      <PageHeader
        title={bill?.bpNumber || 'New Bill Passing'}
        subtitle={bill ? `${bill.supplierName} · PO ${bill.poNumber}` : undefined}
        backPath="/inventory/bill-passing"
        status={bill ? (
          <Tag color={BILL_PASSING_STATUS_COLOR[bill.status]} style={{ fontSize: 13, padding: '2px 10px' }}>
            {BILL_PASSING_STATUS_LABEL[bill.status]}
          </Tag>
        ) : undefined}
        extra={headerActions}
        style={{ position: 'sticky', top: 64, zIndex: 10 }}
      />

      {reason && (
        <Alert type={reason.type} showIcon style={{ marginBottom: 16 }} title={reason.label} description={reason.text} />
      )}

      {/* An approval flow, once an admin configures one, decides this bill
          rather than the Approve and Reject buttons in the header. */}
      {bill?.approvalMode === 'ENGINE' && (
        <ApprovalActionBar
          entityType="BILL_PASSING"
          entityId={bill.id}
          docLabel="Bill Passing"
          docNumber={bill.bpNumber}
          onActionComplete={reloadBill}
        />
      )}

      {bill?.blockers?.length > 0 && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          title={`${bill.blockers.length} blocker${bill.blockers.length > 1 ? 's' : ''} must be cleared before this bill can be approved`}
          description={<ul style={{ margin: 0, paddingLeft: 18 }}>{bill.blockers.map((b, i) => <li key={i}>{b}</li>)}</ul>}
        />
      )}

      {warnExceptions.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title={`${warnExceptions.length} tolerance warning${warnExceptions.length > 1 ? 's' : ''}`}
          description={<ul style={{ margin: 0, paddingLeft: 18 }}>{warnExceptions.map((x) => <li key={x.code}>{x.title} — {x.detail}</li>)}</ul>}
        />
      )}

      <Card style={{ marginBottom: 16, borderLeft: '3px solid var(--primary-color)' }} title="Invoice Details">
        <Form form={form} layout="vertical" disabled={readOnly} onValuesChange={() => setIsDirty(true)}>
          <Row gutter={16}>
            <Col xs={24} md={6}>
              <Form.Item label="Supplier">
                <Input value={bill?.supplierName || ''} disabled />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item label="Purchase Order">
                <Input value={bill?.poNumber || ''} disabled />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item
                label="Supplier Invoice No"
                name="supplierInvoiceNo"
                rules={[{ required: true, message: 'Supplier invoice number is required' }]}
              >
                <Input placeholder="As printed on the supplier invoice" maxLength={40} />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item
                label="Invoice Date"
                name="invoiceDate"
                rules={[{ required: true, message: 'Invoice date is required' }]}
              >
                <DatePicker
                  format={DATE_FORMAT}
                  style={{ width: '100%' }}
                  disabledDate={(d) => d && d.isAfter(dayjs(), 'day')}
                />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item label="Header Remarks" name="headerRemarks">
                <TextArea rows={2} maxLength={500} showCount placeholder="Anything the verifier or approver should know about this invoice" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <Collapse defaultActiveKey={SECTION_KEYS} items={collapseItems} />

      <Modal
        open={Boolean(reasonCfg)}
        title={reasonCfg?.title}
        width={480}
        destroyOnHidden
        okText={reasonCfg?.okText || 'Confirm'}
        okButtonProps={{ danger: reasonCfg?.danger, loading: busy !== null }}
        onOk={submitReason}
        onCancel={() => setReasonCfg(null)}
      >
        <Text type="secondary" style={{ color: 'var(--text-secondary)' }}>
          {reasonCfg?.label} — recorded on the bill's audit trail.
        </Text>
        <TextArea
          rows={4}
          value={reasonText}
          maxLength={500}
          showCount
          autoFocus
          style={{ marginTop: 8 }}
          placeholder={reasonCfg?.placeholder || `Minimum ${reasonCfg?.minLength ?? 10} characters`}
          onChange={(e) => setReasonText(e.target.value)}
        />
      </Modal>
    </div>
  );
};

export default BillPassingForm;
