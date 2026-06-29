import { memo, useMemo, useState, useCallback } from 'react';
import { Row, Col, Typography, Tag, Button, Tooltip } from 'antd';
import { ShopOutlined, FileTextOutlined, UserOutlined, CalendarOutlined, DownOutlined, UpOutlined } from '@ant-design/icons';
import { formatDate, formatNumber, formatCurrency } from '../../../utils/formatters';
import AllowanceLineCard from './AllowanceLineCard';

const { Text, Title } = Typography;

const MetaItem = ({ icon, label, value }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, lineHeight: 1, height: 16 }}>
    <span style={{ color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, lineHeight: 1, height: 16, width: 16 }}>{icon}</span>
    <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, lineHeight: 1, display: 'inline-flex', alignItems: 'center', height: 16 }}>{label}</Text>
    <Text strong style={{ fontSize: 13, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-flex', alignItems: 'center', height: 16 }}>{value || '—'}</Text>
  </div>
);

const AllowanceDocket = memo(function AllowanceDocket({ grn }) {
  const topSeverity = grn.offendingLines.some((l) => l.severity === 'high') ? 'high' : 'medium';
  const accent = topSeverity === 'high' ? 'var(--error-color)' : 'var(--warning-color)';
  const [expanded, setExpanded] = useState(true);
  const toggle = useCallback(() => setExpanded((v) => !v), []);
  const totalExcessValue = useMemo(
    () => grn.offendingLines.reduce((s, l) => s + (l.excessQty || 0) * (l.rate || 0), 0),
    [grn.offendingLines],
  );
  const totalExcessQty = useMemo(
    () => grn.offendingLines.reduce((s, l) => s + (l.excessQty || 0), 0),
    [grn.offendingLines],
  );

  return (
    <div
      style={{
        border: '1px solid var(--border-color)',
        borderRadius: 14,
        background: 'var(--bg-primary)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        overflow: 'hidden',
      }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Collapse' : 'Expand'} ${grn.grnNumber}`}
        style={{
          borderLeft: `5px solid ${accent}`,
          padding: '14px 20px',
          background: `color-mix(in srgb, ${accent} 5%, var(--bg-primary))`,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 260 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Title level={5} style={{ margin: 0, fontFamily: 'var(--font-mono, ui-monospace, monospace)' }}>
              {grn.grnNumber}
            </Title>
            <Tag color={grn.type === 'Fabric' ? 'blue' : 'purple'} style={{ margin: 0 }}>{grn.type}</Tag>
            <Tag color={topSeverity === 'high' ? 'error' : 'warning'} style={{ margin: 0, fontWeight: 600 }}>
              {grn.offendingLines.length} line{grn.offendingLines.length === 1 ? '' : 's'} over allowance
            </Tag>
          </div>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', rowGap: 4 }}>
            <MetaItem icon={<CalendarOutlined />} label="Date" value={formatDate(grn.grnDate)} />
            <MetaItem icon={<ShopOutlined />} label="Supplier" value={grn.supplier} />
            <MetaItem icon={<FileTextOutlined />} label="PO" value={grn.poNumber} />
            {grn.styleNumber && <MetaItem icon={<UserOutlined />} label="Style" value={`${grn.styleNumber}${grn.buyerName ? ` · ${grn.buyerName}` : ''}`} />}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Text type="secondary" style={{ fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase' }}>Total excess</Text>
            <Text strong style={{ fontSize: 18, color: accent, fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrency(totalExcessValue)}
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>{formatNumber(totalExcessQty, 2)} units across lines</Text>
          </div>
          <Tooltip title={expanded ? 'Collapse' : 'Expand'}>
            <Button
              type="text"
              shape="circle"
              icon={expanded ? <UpOutlined /> : <DownOutlined />}
              onClick={(e) => { e.stopPropagation(); toggle(); }}
              aria-label={expanded ? 'Collapse details' : 'Expand details'}
            />
          </Tooltip>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: 16, background: 'var(--bg-secondary)' }}>
          <Row gutter={[16, 16]}>
            {grn.offendingLines.map((line) => (
              <Col key={line.lineKey} xs={24} md={12} xl={8}>
                <AllowanceLineCard line={line} />
              </Col>
            ))}
          </Row>
        </div>
      )}
    </div>
  );
});

export default AllowanceDocket;
