import { useEffect, useState } from 'react';
import { App, Space, Tag, Typography } from 'antd';
import { CalendarOutlined, CarOutlined, FileTextOutlined, HistoryOutlined, ShopOutlined } from '@ant-design/icons';
import ViewDialog from '../../../../components/ViewDialog';
import DetailCard from '../../../../components/DetailCard';
import { ActionButton } from '../../../../components/buttons';
import { formatCurrency, formatDate } from '../../../../utils/formatters';
import { BILL_PASSING_STATUS_COLOR, BILL_PASSING_STATUS_LABEL } from '../../../../utils/billPassingConstants';
import { billSourceOf } from '../../../../utils/jobWorkBillConstants';
import { statusAccent } from '../../../../utils/statusAccent';
import { printVendorDebitNote } from '../../../../utils/vendorDebitNotePrint';
import { fetchAndCacheOrganisation, getCachedOrganisation } from '../../../../services/admin/organisationService';
import { getJobWorkBill, JOB_WORK_BILL_DEMO } from '../../../../services/inventory/jobWorkBill/jobWorkBillService';
import BillAlerts from '../BillAlerts';
import JwbSummaryCard from './JwbSummaryCard';
import JwbDcTable from './JwbDcTable';
import JwbLinesGrid from './JwbLinesGrid';
import JwbDeductionTable from './JwbDeductionTable';
import JwbCalculationPanel from './JwbCalculationPanel';

const { Text } = Typography;
const ACCENT_CONFIG = Object.fromEntries(Object.entries(BILL_PASSING_STATUS_COLOR).map(([k, color]) => [k, { color }]));
const noop = () => {};

/**
 * A job-work bill, read-only, in the Supplier PO view's design: the whole bill on one scroll — PO and what came
 * back, the DCs and their checks, the lines as passed, the debit note, the money and the trail.
 */
const JobWorkBillViewModal = ({ open, billId, onClose, onEdit }) => {
  const { message } = App.useApp();
  // Keyed by the bill it holds, so a reopen on another bill shows the skeleton, not the last one.
  const [loaded, setLoaded] = useState({ id: null, bill: null });

  useEffect(() => {
    if (!open || !billId) return undefined;
    let cancelled = false;
    getJobWorkBill(billId)
      .then((b) => { if (!cancelled) setLoaded({ id: billId, bill: b }); })
      .catch(() => { if (!cancelled) setLoaded({ id: billId, bill: null }); });
    // The debit note opens its print window inside the click, so the letterhead is fetched up front.
    if (!getCachedOrganisation()) fetchAndCacheOrganisation().catch(() => {});
    return () => { cancelled = true; };
  }, [open, billId]);

  const loading = loaded.id !== billId;
  const bill = loading ? null : loaded.bill;

  const kind = bill ? billSourceOf(bill.source) : null;
  const hero = bill && {
    title: `Job-work Bill ${bill.jwbNumber}`,
    accentColor: statusAccent(ACCENT_CONFIG, bill.status),
    status: <Tag color={BILL_PASSING_STATUS_COLOR[bill.status]}>{BILL_PASSING_STATUS_LABEL[bill.status]}</Tag>,
    tags: [
      <Tag key="kind" color="purple" style={{ borderRadius: 20 }}>{kind.label}</Tag>,
      JOB_WORK_BILL_DEMO && <Tag key="demo" color="orange" style={{ borderRadius: 20 }}>Demo data</Tag>,
    ].filter(Boolean),
    subtitle: bill.vendorName,
    meta: [
      { icon: <ShopOutlined />, text: `${bill.poNumber} · ${bill.processName}` },
      { icon: <FileTextOutlined />, text: `Invoice ${bill.vendorInvoiceNo || '—'} · ${formatDate(bill.vendorInvoiceDate)}` },
      { icon: <CarOutlined />, text: `${bill.dcCount} vendor DC${bill.dcCount === 1 ? '' : 's'}` },
      bill.vdnNumber && { icon: <CalendarOutlined />, text: `Debit note ${bill.vdnNumber}` },
    ].filter(Boolean),
    highlight: { label: 'Net payable', value: formatCurrency(bill.netPayable) },
  };

  const footer = bill && (
    <>
      <Text type="secondary" style={{ color: 'var(--text-secondary)' }}>
        {bill.lineCount} line{bill.lineCount === 1 ? '' : 's'} · passed {formatCurrency(bill.passedAmount)} · debit note {formatCurrency(bill.debitNoteTotal)}
      </Text>
      <Space>
        {bill.vdnNumber && (
          <ActionButton action="print" text="Print Debit Note" onClick={() => {
            if (!printVendorDebitNote(bill, getCachedOrganisation() || {}, { demo: JOB_WORK_BILL_DEMO })) message.warning('Allow pop-ups to print the debit note');
          }} />
        )}
        {onEdit && bill.editable && <ActionButton action="edit" text="Edit" onClick={() => onEdit(bill)} />}
        <ActionButton action="cancel" text="Close" onClick={onClose} />
      </Space>
    </>
  );

  return (
    <ViewDialog open={open} onClose={onClose} loading={loading || !bill} hero={hero} footer={footer}>
      {bill && (
        <>
          <BillAlerts bill={bill} />
          <JwbSummaryCard bill={bill} />
          <JwbDcTable bill={bill} />
          <JwbLinesGrid bill={bill} readOnly onLineChange={noop} />
          <JwbDeductionTable bill={bill} readOnly busyProps={() => ({})} />
          <JwbCalculationPanel bill={bill} readOnly onChange={noop} />
          <DetailCard title="Activity" icon={<HistoryOutlined />} count={bill.activity?.length || 0} bare>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {(bill.activity || []).map((a) => (
                <li key={a.id} style={{ marginBottom: 4 }}>
                  <Text strong>{a.action}</Text>
                  {a.details ? <Text> — {a.details}</Text> : null}
                  <Text type="secondary" style={{ color: 'var(--text-secondary)', fontSize: 12 }}> · {a.user} · {formatDate(a.timestamp, 'DD-MMM-YYYY HH:mm')}</Text>
                </li>
              ))}
            </ul>
          </DetailCard>
        </>
      )}
    </ViewDialog>
  );
};

export default JobWorkBillViewModal;
