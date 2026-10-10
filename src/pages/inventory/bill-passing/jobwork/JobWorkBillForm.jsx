import { useCallback, useMemo, useState } from 'react';
import { App, Card, Result, Skeleton, Space, Tag } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../../../components/PageHeader';
import { ActionButton } from '../../../../components/buttons';
import useUnsavedChanges from '../../../../hooks/useUnsavedChanges';
import useBillWorkflow from '../../../../hooks/useBillWorkflow';
import { hasPermission } from '../../../../utils/permissions';
import { decorateBill } from '../../../../utils/jobWorkBillCalc';
import { BILL_PASSING_STATUS_COLOR, BILL_PASSING_STATUS_LABEL, BP_MODULE_ID } from '../../../../utils/billPassingConstants';
import { billSourceOf } from '../../../../utils/jobWorkBillConstants';
import { printVendorDebitNote } from '../../../../utils/vendorDebitNotePrint';
import { getCachedOrganisation } from '../../../../services/admin/organisationService';
import { JOB_WORK_BILL_DEMO, JOB_WORK_VERBS } from '../../../../services/inventory/jobWorkBill/jobWorkBillService';
import BillWorkflowBar from '../BillWorkflowBar';
import BillReasonModal from '../BillReasonModal';
import BillAlerts from '../BillAlerts';
import { buildBillActions } from '../billWorkflowActions';
import useJwbLoad from './useJwbLoad';
import useJwbSave from './useJwbSave';
import useJwbDeductions from './useJwbDeductions';
import JwbHeaderCard from './JwbHeaderCard';
import JwbSummaryCard from './JwbSummaryCard';
import JwbDcTable from './JwbDcTable';
import JwbLinesGrid from './JwbLinesGrid';
import JwbDeductionTable from './JwbDeductionTable';
import JwbDeductionEditor from './JwbDeductionEditor';
import JwbCalculationPanel from './JwbCalculationPanel';

const BACK = '/inventory/bill-passing';

/**
 * A job-work vendor bill (Cut Panel PO / Garment Process PO): the vendor's invoice against what came back on his
 * DCs and what their checks rejected; what is passed; the deductions that become the Vendor Debit Note.
 * Opened on an existing draft — New Bill on the list creates it.
 */
const JobWorkBillForm = () => {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const { bill, setBill, loading, loadError } = useJwbLoad(id);
  const [isDirty, setIsDirty] = useState(false);
  const { clearDirty } = useUnsavedChanges(isDirty);
  const adopt = useCallback((next) => { setBill(next); setIsDirty(false); clearDirty(); }, [setBill, clearDirty]);
  const { busyProps, run, openReason, reasonModal } = useBillWorkflow(adopt);
  const confirm = useCallback((cfg) => modal.confirm(cfg), [modal]);
  const can = useMemo(() => ({
    update: hasPermission(BP_MODULE_ID, 'update'), verify: hasPermission(BP_MODULE_ID, 'verify'), approve: hasPermission(BP_MODULE_ID, 'approve'),
  }), []);

  // Local edits re-derive the whole bill (lines, totals, blockers) as the user types; Save sends them.
  const patch = useCallback((p) => { setBill((prev) => decorateBill({ ...prev, ...p })); setIsDirty(true); }, [setBill]);
  const patchLine = useCallback((lineId, field, value) => {
    setBill((prev) => decorateBill({
      ...prev, lines: prev.lines.map((l) => (l.id === lineId ? { ...l, keyed: { ...l.keyed, [field]: value ?? null } } : l)),
    }));
    setIsDirty(true);
  }, [setBill]);

  const { handleSave, handleSubmit } = useJwbSave({ bill, run, openReason, confirm });
  const deductions = useJwbDeductions({ bill, run, openReason, isDirty, handleSave });

  const handlePrint = useCallback(() => {
    if (!printVendorDebitNote(bill, getCachedOrganisation() || {}, { demo: JOB_WORK_BILL_DEMO })) message.warning('Allow pop-ups to print the debit note');
  }, [bill, message]);

  const submitBlockReason = useMemo(() => {
    if (!bill) return null;
    if (!bill.vendorInvoiceNo?.trim() || !bill.vendorInvoiceDate) return "Enter the vendor's invoice no. and date";
    if (!bill.lines.some((l) => l.invoiceUnits > 0)) return 'Nothing on this bill is invoiced';
    return null;
  }, [bill]);

  const headerActions = useMemo(() => (
    <BillWorkflowBar busyProps={busyProps} actions={buildBillActions({
      bill, docNo: bill?.jwbNumber, partyLabel: 'vendor', verifyAgainst: 'the PO, the vendor DCs and their checks',
      can, verbs: JOB_WORK_VERBS, submitBlockReason,
      ui: { run, openReason, confirm, onSave: handleSave, onSubmit: handleSubmit },
      print: bill?.vdnNumber ? { text: 'Print Debit Note', onClick: handlePrint } : null,
    })} />
  ), [bill, busyProps, can, submitBlockReason, run, openReason, confirm, handleSave, handleSubmit, handlePrint]);

  if (loading) {
    return (
      <div className="animate-fade-in-up inv-page">
        <PageHeader title="Bill Passing" backPath={BACK} />
        <Card style={{ marginBottom: 16 }}><Skeleton active paragraph={{ rows: 3 }} /></Card>
        <Card><Skeleton active paragraph={{ rows: 8 }} /></Card>
      </div>
    );
  }
  if (loadError || !bill) {
    return (
      <div className="animate-fade-in-up inv-page">
        <PageHeader title="Bill Passing" backPath={BACK} />
        <Result status="warning" title="This bill could not be opened" subTitle={loadError}
          extra={<ActionButton action="back" text="Back to Bill Passing" onClick={() => navigate(BACK)} />} />
      </div>
    );
  }

  const readOnly = !bill.editable || !can.update;
  return (
    <div className="animate-fade-in-up inv-page">
      <PageHeader
        title={bill.jwbNumber}
        subtitle={`${bill.vendorName} · ${billSourceOf(bill.source).label} ${bill.poNumber}`}
        backPath={BACK}
        status={(
          <Space size={6}>
            <Tag color={BILL_PASSING_STATUS_COLOR[bill.status]} style={{ fontSize: 13, padding: '2px 10px' }}>{BILL_PASSING_STATUS_LABEL[bill.status]}</Tag>
            {JOB_WORK_BILL_DEMO && <Tag color="orange">Demo data</Tag>}
          </Space>
        )}
        extra={headerActions}
        style={{ position: 'sticky', top: 64, zIndex: 10 }}
      />
      <BillAlerts bill={bill} />
      <JwbHeaderCard bill={bill} readOnly={readOnly} onChange={patch} />
      <JwbSummaryCard bill={bill} />
      <JwbDcTable bill={bill} />
      <JwbLinesGrid bill={bill} readOnly={readOnly} onLineChange={patchLine} />
      <JwbDeductionTable bill={bill} readOnly={!bill.debitsEditable || !can.update} busyProps={busyProps} dirty={isDirty} {...deductions.tableProps} />
      <JwbCalculationPanel bill={bill} readOnly={readOnly} onChange={patch} />
      <JwbDeductionEditor bill={bill} {...deductions.editorProps} />
      <BillReasonModal {...reasonModal} />
    </div>
  );
};

export default JobWorkBillForm;
