import { memo, useMemo } from 'react';
import { Row, Col, Skeleton, Tooltip, Typography } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import DetailCard from '../../../components/DetailCard';
import CurrencyDisplay from '../../../components/CurrencyDisplay';
import { formatNumber } from '../../../utils/formatters';

const { Text } = Typography;

const fmtDate = (d) => (d ? dayjs(d).format('DD-MMM-YYYY') : '-');

const cellStyle = {
  background: 'var(--bg-secondary)',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-color)',
  padding: '10px 12px',
  height: '100%',
};

const labelStyle = {
  fontSize: 11,
  display: 'block',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--text-secondary)',
  marginBottom: 2,
};

const QtyStat = ({ label, value, color }) => (
  <Col xs={12} sm={8} md={4}>
    <div style={cellStyle}>
      <Text style={labelStyle}>{label}</Text>
      <Text strong style={{ fontSize: 15, color: color || 'var(--text-primary)' }}>
        {formatNumber(value, 3)}
      </Text>
    </div>
  </Col>
);

const MoneyStat = ({ label, amount, color, hint }) => (
  <Col xs={12} sm={12} md={6}>
    <div style={cellStyle}>
      <Text style={labelStyle}>
        {label}
        {hint && (
          <Tooltip title={hint}>
            <Text style={{ marginLeft: 4, color: 'var(--text-secondary)', cursor: 'help' }}>*</Text>
          </Tooltip>
        )}
      </Text>
      <CurrencyDisplay amount={amount} currency="INR" color={color || 'var(--text-primary)'} />
    </div>
  </Col>
);

/** FR-BP-201 / FR-BP-302 — PO facts plus the consolidated GRN-vs-PO-vs-billed strip. */
const BpPoSummaryCard = memo(function BpPoSummaryCard({ source, bill }) {
  const po = source?.po;
  const supplier = source?.supplier;
  const summary = source?.summary;

  const balanceColor = useMemo(() => {
    const balance = Number(summary?.balanceToBill) || 0;
    return balance > 0 ? 'var(--warning-color)' : 'var(--success-color)';
  }, [summary]);

  if (!source) {
    return <Skeleton active paragraph={{ rows: 5 }} />;
  }

  return (
    <DetailCard title="Purchase Order" icon={<FileTextOutlined />}>
      <DetailCard.Field span={6} xs={12} sm={8} md={6} label="PO No" value={po?.poNumber || bill?.poNumber} />
      <DetailCard.Field span={6} xs={12} sm={8} md={6} label="PO Date" value={fmtDate(po?.poDate)} />
      <DetailCard.Field span={6} xs={12} sm={8} md={6} label="Delivery Date" value={fmtDate(po?.deliveryDate)} />
      <DetailCard.Field span={6} xs={12} sm={8} md={6} label="Supplier" value={supplier?.name || bill?.supplierName} />
      <DetailCard.Field span={6} xs={12} sm={8} md={6} label="GSTIN" value={supplier?.gstin} />
      <DetailCard.Field span={6} xs={12} sm={8} md={6} label="Payment Terms" value={supplier?.paymentTerms} />
      <DetailCard.Field
        span={6}
        xs={12}
        sm={8}
        md={6}
        label="GST %"
        value={po?.gstPercent != null ? `${formatNumber(po.gstPercent, 2)} %` : null}
      />

      <Col span={24}>
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 14, marginTop: 2 }}>
          <Text style={{ ...labelStyle, marginBottom: 10 }}>Consolidated Summary</Text>

          <Row gutter={[10, 10]}>
            <QtyStat label="PO Qty" value={summary?.poQty} />
            <QtyStat label="Received" value={summary?.receivedQty} />
            <QtyStat label="Accepted" value={summary?.acceptedQty} color="var(--success-color)" />
            <QtyStat
              label="Rejected"
              value={summary?.rejectedQty}
              color={Number(summary?.rejectedQty) > 0 ? 'var(--error-color)' : undefined}
            />
            <QtyStat
              label="Shortage"
              value={summary?.shortageQty}
              color={Number(summary?.shortageQty) > 0 ? 'var(--warning-color)' : undefined}
            />
            <QtyStat
              label="Excess"
              value={summary?.excessQty}
              color={Number(summary?.excessQty) > 0 ? 'var(--warning-color)' : undefined}
            />
          </Row>

          <Row gutter={[10, 10]} style={{ marginTop: 10 }}>
            <MoneyStat label="PO Value" amount={summary?.poValue} />
            <MoneyStat label="GRN Value" amount={summary?.grnValue} color="var(--primary-color)" />
            <MoneyStat
              label="Billed So Far"
              amount={summary?.billedValue}
              hint={bill?.id ? 'Value already billed on other bills for this PO — this bill is excluded.' : 'Value already billed against this PO.'}
            />
            <MoneyStat label="Balance to Bill" amount={summary?.balanceToBill} color={balanceColor} />
          </Row>
        </div>
      </Col>
    </DetailCard>
  );
});

export default BpPoSummaryCard;
