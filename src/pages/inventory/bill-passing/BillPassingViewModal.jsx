import { useState, useEffect, useMemo, useCallback } from 'react';
import { App, Alert, Table, Tag, Typography, Space } from 'antd';
import dayjs from 'dayjs';
import ViewDialog from '../../../components/ViewDialog';
import DetailCard from '../../../components/DetailCard';
import CurrencyDisplay from '../../../components/CurrencyDisplay';
import EmptyState from '../../../components/EmptyState';
import { ActionButton } from '../../../components/buttons';
import useResponsive from '../../../hooks/useResponsive';
import { formatNumber } from '../../../utils/formatters';
import { getBill, listBpSuppliers } from '../../../services/inventory/billPassingService';
import { billLinesWithGrn } from '../../../utils/billPassingCalc';
import {
  BILL_PASSING_STATUS_COLOR,
  BILL_PASSING_STATUS_LABEL,
  DEBIT_STATUS_COLOR,
  DEBIT_TYPES,
} from '../../../utils/billPassingConstants';
import { printBillPassingVoucher } from '../../../utils/billPassingVoucherPrint';

const { Text } = Typography;

// Hero accent per status — the same cue the list page uses, in CSS vars.
const HERO_ACCENT = {
  DRAFT: 'var(--text-secondary)',
  SUBMITTED: 'var(--primary-color)',
  UNDER_VERIFICATION: 'var(--primary-color)',
  QUERY_RAISED: 'var(--warning-color)',
  ON_HOLD: 'var(--warning-color)',
  PENDING_APPROVAL: 'var(--primary-color)',
  APPROVED: 'var(--success-color)',
  REJECTED: 'var(--error-color)',
  SENT_TO_ACCOUNTS: 'var(--success-color)',
};

const debitName = (code) => DEBIT_TYPES.find((t) => t.code === code)?.name || code || '-';
const showDate = (d) => (d ? dayjs(d).format('DD-MMM-YYYY') : '-');

const sectionStyle = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', margin: '20px 0 8px' };
const totalRowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 12px', borderBottom: '1px solid var(--border-color)' };

const BillPassingViewModal = ({ open, onClose, billId }) => {
  const { message } = App.useApp();
  const { isMobile, isTablet } = useResponsive();
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !billId) { setBill(null); return undefined; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const data = await getBill(billId);
        // The bill snapshot carries no GSTIN or payment terms; the voucher needs
        // both, so enrich from the supplier master. A failure here is not fatal.
        let supplier = null;
        try {
          supplier = (await listBpSuppliers()).find((s) => s.id === data.supplierId) || null;
        } catch { /* optional enrichment */ }
        if (!cancelled) setBill({ ...data, supplierGstin: supplier?.gstin, paymentTerms: supplier?.paymentTerms });
      } catch (e) {
        if (!cancelled) { setBill(null); message.error(e.message || 'Failed to load the bill'); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, billId, message]);

  const lines = useMemo(() => (bill ? billLinesWithGrn(bill) : []), [bill]);

  const lineColumns = useMemo(() => [
    { title: 'GRN', dataIndex: 'grnNumber', align: 'center', width: 120 },
    { title: 'Item Code', dataIndex: 'itemCode', align: 'center', width: 110 },
    {
      title: 'Description', dataIndex: 'description', ellipsis: true,
      render: (v, r) => (
        <div>
          <div>{v || '-'}</div>
          {(r.color || r.size) && (
            <Text type="secondary" style={{ fontSize: 11 }}>{[r.color, r.size].filter(Boolean).join(' / ')}</Text>
          )}
        </div>
      ),
    },
    { title: 'UOM', dataIndex: 'uom', align: 'center', width: 70 },
    { title: 'Billed Qty', dataIndex: 'billedQty', align: 'center', width: 100, render: (v) => formatNumber(v, 3) },
    { title: 'Rate', dataIndex: 'invoiceRate', align: 'right', width: 110, render: (v, r) => <CurrencyDisplay amount={v ?? r.rate} currency="INR" strong={false} color="var(--text-primary)" /> },
    { title: 'Value', dataIndex: 'billedValue', align: 'right', width: 130, render: (v) => <CurrencyDisplay amount={v} currency="INR" /> },
  ], []);

  const debitColumns = useMemo(() => [
    { title: 'Debit Type', dataIndex: 'debitTypeCode', width: 170, render: (v) => debitName(v) },
    { title: 'Reason', dataIndex: 'reasonText', ellipsis: true, render: (v, r) => [r.reasonCode, v, r.remarks].filter(Boolean).join(' - ') || '-' },
    { title: 'Qty', dataIndex: 'debitQty', align: 'center', width: 90, render: (v) => formatNumber(v, 3) },
    { title: 'Amount', dataIndex: 'debitAmount', align: 'right', width: 130, render: (v) => <CurrencyDisplay amount={v} currency="INR" color="var(--error-color)" /> },
    { title: 'Status', dataIndex: 'status', align: 'center', width: 110, render: (v) => <Tag color={DEBIT_STATUS_COLOR[v]}>{v}</Tag> },
  ], []);

  const buildUp = useMemo(() => {
    if (!bill) return [];
    const rows = [
      { key: 'basic', label: 'Basic Value', value: bill.invoiceBasicAmount },
      { key: 'charges', label: 'Charges', value: bill.chargesTotal },
    ];
    (bill.taxes || []).forEach((t) => rows.push({
      key: `tax-${t.id}`, sub: true,
      label: `${t.taxType} @ ${formatNumber(t.ratePercent, 2)}%`,
      value: t.asPerInvoiceAmount,
    }));
    rows.push({ key: 'debits', label: 'Less: Confirmed Debits', value: -(Number(bill.debitTotal) || 0), negative: true });
    rows.push({ key: 'adj', label: 'Less: Adjustments', value: -(Number(bill.adjustmentTotal) || 0), negative: true });
    return rows;
  }, [bill]);

  const handlePrint = useCallback(() => {
    if (!bill) return;
    if (!printBillPassingVoucher(bill)) message.warning('Allow pop-ups to print the bill passing voucher');
  }, [bill, message]);

  const reason = bill && (bill.rejectReason || bill.holdReason || bill.queryReason);
  const reasonType = bill?.rejectReason ? 'error' : 'warning';
  const reasonLabel = bill?.rejectReason ? 'Rejected' : bill?.holdReason ? 'On hold' : 'Query raised';

  return (
    <ViewDialog
      open={open}
      onClose={onClose}
      loading={loading}
      className="po-view-modal"
      width={isMobile ? '100vw' : isTablet ? '94vw' : 1100}
      hero={bill ? {
        title: bill.bpNumber,
        accentColor: HERO_ACCENT[bill.status] || 'var(--primary-color)',
        status: <Tag color={BILL_PASSING_STATUS_COLOR[bill.status]}>{BILL_PASSING_STATUS_LABEL[bill.status]}</Tag>,
        tags: [
          <Tag key="supplier">{bill.supplierName}</Tag>,
          <Tag key="po" color="blue">{bill.poNumber || 'No PO'}</Tag>,
        ],
        highlight: { label: 'Net Payable', value: <CurrencyDisplay amount={bill.netPayable} currency="INR" color="var(--primary-color)" /> },
      } : undefined}
      footer={(
        <>
          <Space>
            <ActionButton action="print" text="Print Voucher" onClick={handlePrint} disabled={!bill} />
          </Space>
          <ActionButton action="close" text="Close" onClick={onClose} />
        </>
      )}
    >
      {!bill ? (
        <EmptyState title="Bill unavailable" description="This bill could not be loaded. Close and try again." showAction={false} />
      ) : (
        <>
          {reason && (
            <Alert type={reasonType} showIcon style={{ marginBottom: 16 }} message={reasonLabel} description={reason} />
          )}

          <DetailCard title="Bill Details">
            <DetailCard.Field label="Supplier" value={bill.supplierName} />
            <DetailCard.Field label="Supplier GSTIN" value={bill.supplierGstin} />
            <DetailCard.Field label="Purchase Order" value={bill.poNumber} />
            <DetailCard.Field label="Supplier Invoice No." value={bill.supplierInvoiceNo} />
            <DetailCard.Field label="Invoice Date" value={showDate(bill.invoiceDate)} />
            <DetailCard.Field label="Financial Year" value={bill.financialYear} />
            <DetailCard.Field label="Challan Numbers" value={bill.challanNumbers} />
            <DetailCard.Field label="Payment Terms" value={bill.paymentTerms} />
            <DetailCard.Field label="Tally Reference" value={bill.tallyReferenceNo} />
            <DetailCard.Field label="Submitted On" value={showDate(bill.submittedAt)} />
            <DetailCard.Field label="Approved On" value={showDate(bill.approvedAt)} />
            <DetailCard.Field label="Sent to Accounts" value={showDate(bill.sentToAccountsAt)} />
            {bill.headerRemarks && <DetailCard.Field label="Remarks" value={bill.headerRemarks} span={24} />}
          </DetailCard>

          <div style={sectionStyle}>{`Billed Lines (${lines.length}) across ${bill.grnCount || 0} GRN(s)`}</div>
          <Table
            rowKey="id"
            size="small"
            columns={lineColumns}
            dataSource={lines}
            pagination={false}
            scroll={{ x: 900, y: 260 }}
            locale={{ emptyText: <EmptyState title="No lines" description="No GRN lines are attached to this bill." showAction={false} /> }}
          />

          <div style={sectionStyle}>{`Debits (${(bill.debits || []).length})`}</div>
          <Table
            rowKey="id"
            size="small"
            columns={debitColumns}
            dataSource={bill.debits || []}
            pagination={false}
            scroll={{ x: 700 }}
            locale={{ emptyText: <EmptyState title="No debits" description="Nothing has been debited against this bill." showAction={false} /> }}
          />

          <div style={sectionStyle}>Calculation</div>
          <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)', maxWidth: 460, marginLeft: 'auto' }}>
            {buildUp.map((r) => (
              <div key={r.key} style={totalRowStyle}>
                <Text type="secondary" style={{ fontSize: 13, paddingLeft: r.sub ? 12 : 0 }}>{r.label}</Text>
                <CurrencyDisplay
                  amount={r.value}
                  currency="INR"
                  strong={!r.sub}
                  color={r.negative ? 'var(--error-color)' : 'var(--text-primary)'}
                />
              </div>
            ))}
            <div style={{ ...totalRowStyle, borderBottom: 'none', padding: '12px' }}>
              <Text strong style={{ fontSize: 14 }}>Net Payable</Text>
              <CurrencyDisplay amount={bill.netPayable} currency="INR" color="var(--primary-color)" style={{ fontSize: 16 }} />
            </div>
          </div>
        </>
      )}
    </ViewDialog>
  );
};

export default BillPassingViewModal;
