import { useMemo } from 'react';
import { ProfileOutlined } from '@ant-design/icons';
import DetailCard from '../../../../components/DetailCard';
import FactSheet from '../../../../components/FactSheet';
import { formatCurrency, formatDate, formatNumber } from '../../../../utils/formatters';

const sum = (lines, key) => lines.reduce((s, l) => s + (l[key] || 0), 0);

/** The PO against what came back, in pieces — the figures the bill is passed on. */
const JwbSummaryCard = ({ bill }) => {
  const t = useMemo(() => ({
    po: sum(bill.lines, 'poQty'), issued: sum(bill.lines, 'issuedQty'), returned: sum(bill.lines, 'returnedQty'),
    accepted: sum(bill.lines, 'acceptedQty'), rejected: sum(bill.lines, 'rejectedQty'), short: sum(bill.lines, 'shortQty'),
    allowance: sum(bill.lines, 'allowanceUsed'),
  }), [bill.lines]);
  const gst = bill.igstApplicable ? `IGST ${bill.gstRatePercent}%` : `CGST + SGST ${bill.gstRatePercent}%`;
  return (
    <DetailCard title="PO & Receipts" icon={<ProfileOutlined />} bare style={{ marginBottom: 16 }}>
      <FactSheet
        fields={[
          { label: 'Vendor GSTIN', value: bill.vendorGstin },
          { label: 'GST', value: `${gst} · SAC ${bill.sacCode}` },
          { label: 'Payment terms', value: bill.paymentTerms },
          { label: 'PO date', value: formatDate(bill.poDate) },
          { label: 'Expected back', value: formatDate(bill.expectedReturnDate) },
          { label: 'PO status', value: bill.poStatus === 'CLOSED' ? 'Short-closed' : 'Completed' },
        ]}
        tiles={[
          { label: 'PO qty', value: formatNumber(t.po) },
          { label: 'Issued', value: formatNumber(t.issued) },
          { label: 'Returned', value: formatNumber(t.returned) },
          { label: 'Accepted', value: formatNumber(t.accepted), accent: true },
          { label: 'Rejected', value: formatNumber(t.rejected), danger: t.rejected > 0 },
          ...(bill.poStatus === 'CLOSED' ? [{ label: 'Never returned', value: formatNumber(t.short), danger: t.short > 0 }] : []),
          ...(t.allowance ? [{ label: 'Loss allowance used', value: formatNumber(t.allowance) }] : []),
          { label: 'PO value', value: formatCurrency(bill.poValue) },
          ...(bill.lateDays ? [{ label: 'Late', value: `${bill.lateDays} day${bill.lateDays > 1 ? 's' : ''}`, danger: true }] : []),
        ]}
      />
    </DetailCard>
  );
};

export default JwbSummaryCard;
