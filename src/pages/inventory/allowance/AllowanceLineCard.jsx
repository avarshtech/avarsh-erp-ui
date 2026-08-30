import { memo } from 'react';
import { Typography, Tag } from 'antd';
import { formatNumber, formatCurrency } from '../../../utils/formatters';
import AllowanceGauge from './AllowanceGauge';

const { Text } = Typography;

const chipStyle = {
  padding: '2px 10px',
  borderRadius: 6,
  background: 'var(--bg-secondary)',
  fontSize: 12,
  color: 'var(--text-secondary)',
  lineHeight: '20px',
};

const MetricRow = ({ label, value, accent }) => (
  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
    <Text style={{ fontSize: 11, letterSpacing: 0.4, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{label}</Text>
    <Text strong style={{ fontSize: 14, color: accent || 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</Text>
  </div>
);

const AllowanceLineCard = memo(function AllowanceLineCard({ line }) {
  const isHigh = line.severity === 'high';
  const accent = isHigh ? 'var(--error-color)' : 'var(--warning-color)';
  const isFabric = line.type === 'Fabric';
  const excessValue = (line.excessQty || 0) * (line.rate || 0);

  return (
    <div
      style={{
        border: '1px solid var(--border-color)',
        borderLeft: `4px solid ${accent}`,
        borderRadius: 10,
        padding: 16,
        background: 'var(--bg-primary)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minHeight: 280,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text strong style={{ fontSize: 14, display: 'block', fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)' }}>
            {line.variantCode || line.itemCode}
          </Text>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {line.description || '—'}
          </Text>
        </div>
        <Tag color={isHigh ? 'error' : 'warning'} style={{ margin: 0, fontWeight: 600 }}>
          {isHigh ? 'Critical' : 'Review'}
        </Tag>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {isFabric ? (
          <>
            {line.width != null && <span style={chipStyle}>W {line.width}"</span>}
            {line.gsm != null && <span style={chipStyle}>{line.gsm} GSM</span>}
          </>
        ) : (
          <>
            {line.color && (
              <span style={{ ...chipStyle, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: line.colorHex || '#94a3b8', border: '1px solid var(--border-color)', display: 'inline-block' }} />
                {line.color}
              </span>
            )}
            {line.size && <span style={chipStyle}>{line.size}</span>}
          </>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 4 }}>
        <AllowanceGauge overPct={line.overPct} allowedPct={line.allowedPct} severity={line.severity} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px dashed var(--border-color)', paddingTop: 10 }}>
        <MetricRow label="PO balance" value={`${formatNumber(line.balance, 2)} ${line.uom || ''}`} />
        <MetricRow label="Received" value={`${formatNumber(line.receivedQty, 2)} ${line.uom || ''}`} />
        <MetricRow label="Excess" value={`+${formatNumber(line.excessQty, 2)} ${line.uom || ''}`} accent={accent} />
        <MetricRow label="Rate" value={formatCurrency(line.rate)} />
        <MetricRow label="Excess value" value={formatCurrency(excessValue)} accent={accent} />
      </div>
    </div>
  );
});

export default AllowanceLineCard;
