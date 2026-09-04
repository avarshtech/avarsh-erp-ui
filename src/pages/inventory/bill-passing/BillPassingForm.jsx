import { useState, useEffect, useMemo, useCallback } from 'react';
import { App, Card, Form, Input, DatePicker, Row, Col, Collapse, Typography, Tag, Alert, Space, Modal, Skeleton, Result } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import useUnsavedChanges from '../../../hooks/useUnsavedChanges';
import useBusyAction from '../../../hooks/useBusyAction';
import { useTheme } from '../../../context/ThemeContext';
import { hasPermission } from '../../../utils/permissions';
import { formatCurrency, formatNumber } from '../../../utils/formatters';
import { DATE_FORMAT } from '../../../utils/uiConstants';
import { recalcBill, recalcTaxes, billLines, debitPercentOfInvoice } from '../../../utils/billPassingCalc';
import {
  BILL_PASSING_STATUS as S,
  BILL_PASSING_STATUS_COLOR,
  BILL_PASSING_STATUS_LABEL,
  EXCEPTION_SEVERITY,
  ISSUE_STATUS,
  BP_MODULE_ID,
} from '../../../utils/billPassingConstants';
import {
  getBill, updateBill, getPoBillingSource,
  submitBill, startVerification, raiseQuery, holdBill, releaseHold, sendForApproval,
  approveBill, rejectBill, reopenBill, sendToAccounts, recordTallyReference,
  listDebitTypes, listChargeTypes, listIssueTypes,
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
  const [debitTypes, setDebitTypes] = useState([]);
  const [chargeTypes, setChargeTypes] = useState([]);
  const [issueTypes, setIssueTypes] = useState([]);

  const [isDirty, setIsDirty] = useState(false);
  const { clearDirty } = useUnsavedChanges(isDirty);

  // Reason capture — one modal serves every action that needs a typed justification
  const [reasonCfg, setReasonCfg] = useState(null);
  const [reasonText, setReasonText] = useState('');

  const readOnly = !bill?.editable;

  // ==================== LOAD ====================

  useEffect(() => {
    Promise.all([listDebitTypes(), listChargeTypes(), listIssueTypes()])
      .then(([d, c, i]) => { setDebitTypes(d); setChargeTypes(c); setIssueTypes(i); })
      .catch((e) => message.error(e.message || 'Failed to load bill passing masters'));
  }, [message]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    (async () => {
      try {
        const b = await getBill(id);
        if (cancelled) return;
        setBill(b);
        form.setFieldsValue({
          supplierInvoiceNo: b.supplierInvoiceNo,
          invoiceDate: b.invoiceDate ? dayjs(b.invoiceDate) : null,
          headerRemarks: b.headerRemarks,
        });
        const src = await getPoBillingSource(b.poId, { excludeBillId: b.id });
        if (!cancelled) setSource(src);
      } catch (e) {
        if (!cancelled) setLoadError(e.message || 'Failed to load this bill');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, form, message]);

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
      if (next?.id) setBill(next);
      if (successMsg) message.success(successMsg);
      return next;
    } catch (e) {
      message.error(e.message || 'Action failed');
      return null;
    } finally {
      setBusy(null);
    }
  }, [message, setBusy]);

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

  // `busyKey` lets Submit's save-then-submit keep the Submit button spinning throughout.
  const handleSave = useCallback(async (busyKey = 'save') => {
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
      grns: bill.grns,
      charges: bill.charges,
      taxes: bill.taxes,
    }), 'Bill saved');
    if (next) { setIsDirty(false); clearDirty(); reloadSource(next); }
    return next;
  }, [form, run, bill, clearDirty, reloadSource, message]);

  const handleSubmit = useCallback(() => {
    modal.confirm({
      title: `Submit ${bill.bpNumber}?`,
      content: 'The bill is saved, moves to the verification queue, and the header, GRN picks and charges become read-only.',
      okText: 'Save & Submit',
      onOk: async () => {
        const saved = await handleSave('submit');
        if (saved) await run('submit', () => submitBill(saved.id), 'Bill submitted for verification');
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

  const handlePrint = useCallback(() => window.print(), []);

  // ==================== HEADER ACTIONS ====================

  const headerActions = useMemo(() => {
    if (!bill) return null;
    const canUpdate = hasPermission(BP_MODULE_ID, 'update');
    const canVerify = hasPermission(BP_MODULE_ID, 'verify');
    const canApprove = hasPermission(BP_MODULE_ID, 'approve');
    const btns = [];
    const push = (el) => btns.push(el);

    if (bill.status === S.DRAFT || bill.status === S.QUERY_RAISED) {
      if (canUpdate) {
        push(<ActionButton key="save" action="save" variant="draft" text="Save" {...busyProps('save')} onClick={() => handleSave()} />);
        push(<ActionButton key="submit" action="save" text="Submit" {...busyProps('submit')} onClick={handleSubmit} />);
      }
    }
    if (bill.status === S.SUBMITTED && canVerify) {
      push(<ActionButton key="verify" action="approve" text="Start Verification" {...busyProps('verify')} onClick={() => modal.confirm({
        title: `Start verification of ${bill.bpNumber}?`,
        content: 'The bill is locked to you for checking against the PO, GRN and QC records.',
        okText: 'Start',
        onOk: () => run('verify', () => startVerification(bill.id), 'Verification started'),
      })} />);
    }
    if ((bill.status === S.UNDER_VERIFICATION || bill.status === S.PENDING_APPROVAL) && (canVerify || canApprove)) {
      push(<ActionButton key="query" action="refer-back" text="Raise Query" {...busyProps('query')} onClick={() => openReason({
        key: 'query',
        title: 'Raise a query with the supplier', label: 'Query details', successMsg: 'Query raised',
        onSubmit: (t) => raiseQuery(bill.id, t),
      })} />);
      push(<ActionButton key="hold" action="cancel" text="Hold" {...busyProps('hold')} onClick={() => openReason({
        key: 'hold',
        title: 'Put this bill on hold', label: 'Hold reason', successMsg: 'Bill put on hold',
        onSubmit: (t) => holdBill(bill.id, t),
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
              onSubmit: (t) => sendForApproval(bill.id, { overrideReason: t }),
            });
            return;
          }
          run('approval', () => sendForApproval(bill.id, {}), 'Sent for approval');
        }} />);
    }
    if (bill.status === S.ON_HOLD && canVerify) {
      push(<ActionButton key="release" action="refresh" text="Release Hold" {...busyProps('release')} onClick={() => openReason({
        key: 'release',
        title: 'Release this bill from hold', label: 'Release remarks', successMsg: 'Hold released',
        onSubmit: (t) => releaseHold(bill.id, t),
      })} />);
    }
    if (bill.status === S.PENDING_APPROVAL && canApprove) {
      push(<ActionButton key="approve" action="approve" text="Approve" {...busyProps('approve')} onClick={() => modal.confirm({
        title: `Approve ${bill.bpNumber}?`,
        content: `Net payable ${formatCurrency(bill.netPayable)} will be cleared for accounts.`,
        okText: 'Approve',
        onOk: () => run('approve', () => approveBill(bill.id, ''), 'Bill approved'),
      })} />);
      push(<ActionButton key="reject" action="reject" text="Reject" {...busyProps('reject')} onClick={() => openReason({
        key: 'reject',
        title: 'Reject this bill', label: 'Rejection reason', danger: true, okText: 'Reject',
        successMsg: 'Bill rejected', onSubmit: (t) => rejectBill(bill.id, t),
      })} />);
    }
    if (bill.status === S.APPROVED) {
      if (canApprove) {
        push(<ActionButton key="accounts" action="send" text="Send to Accounts" {...busyProps('accounts')} onClick={() => modal.confirm({
          title: `Send ${bill.bpNumber} to accounts?`,
          content: 'The bill is handed to Tally for payment processing and can no longer be reopened by verification.',
          okText: 'Send',
          onOk: () => run('accounts', () => sendToAccounts(bill.id), 'Sent to accounts'),
        })} />);
        push(<ActionButton key="reopen" action="refer-back" text="Reopen" {...busyProps('reopen')} onClick={() => openReason({
          key: 'reopen',
          title: 'Reopen this bill for verification', label: 'Reopen reason', successMsg: 'Bill reopened',
          onSubmit: (t) => reopenBill(bill.id, t),
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
          onSubmit: (t) => recordTallyReference(bill.id, t),
        })} />);
      }
      push(<ActionButton key="print" action="print" text="Print Voucher" onClick={handlePrint} />);
    }
    return <Space wrap>{btns}</Space>;
  }, [bill, busyProps, handleSave, handleSubmit, handlePrint, modal, run, openReason]);

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
            onSave={(debit) => run('debit', () => saveDebit(bill.id, debit), 'Debit saved')}
            onSetStatus={(debitId, status, reason) => run('debit', () => setDebitStatus(bill.id, debitId, status, reason), 'Debit updated')}
            onDelete={(debitId) => run('debit', () => deleteDebit(bill.id, debitId), 'Debit removed')}
            onRefreshProposals={() => run('debit', () => refreshProposedDebits(bill.id), 'Proposed debits refreshed')}
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
            onAdd={(issue) => run('issue', () => addIssue(bill.id, issue), 'Issue logged')}
            onSetStatus={(issueId, status, remarks) => run('issue', () => setIssueStatus(bill.id, issueId, status, remarks), 'Issue updated')}
            onWithdraw={(issueId, reason) => run('issue', () => withdrawIssue(bill.id, issueId, reason), 'Issue withdrawn')}
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

      {bill?.blockers?.length > 0 && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={`${bill.blockers.length} blocker${bill.blockers.length > 1 ? 's' : ''} must be cleared before this bill can be approved`}
          description={<ul style={{ margin: 0, paddingLeft: 18 }}>{bill.blockers.map((b, i) => <li key={i}>{b}</li>)}</ul>}
        />
      )}

      {warnExceptions.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={`${warnExceptions.length} tolerance warning${warnExceptions.length > 1 ? 's' : ''}`}
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
