import { memo } from 'react';
import { Card, Col, Descriptions, Progress, Row, Space, Tag, Typography } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import RecordLink from '../../../components/RecordLink';
import { formatDate } from '../../../utils/formatters';

const { Text } = Typography;
const n = (v) => Number(v || 0).toLocaleString('en-IN');
const pct = (v, of) => (of > 0 ? Math.max(0, Math.min(100, (v / of) * 100)) : 0);
const Figure = ({ label, value, strong, danger }) => (
  <div><Text type="secondary" style={{ fontSize: 11 }}>{label}</Text><div style={{ fontVariantNumeric: 'tabular-nums' }}>
    <Text strong={strong} type={danger ? 'danger' : undefined}>{n(value)}</Text></div></div>
);

/**
 * ③ Process requirement details (PRD §19): one read-only card per requirement line on the
 * PO — to change them, edit the Garment Process Requirement — with the allocation bar:
 * previously PO'd (green), this PO (blue), balance after. `cards` = requirementCards().
 */
const GpoRequirementCards = memo(function GpoRequirementCards({ cards, orders, onOpenGpr }) {
  if (!cards.length) return null;
  return (
    <Card id="gpo-requirements" size="small" style={{ marginBottom: 16 }}
      title={<Space>③ Process Requirement Details<Tag icon={<LockOutlined />}>Read-only · from requirement</Tag></Space>}
      extra={<Text type="secondary" style={{ fontSize: 12 }}>To change, edit the Garment Process Requirement</Text>}>
      <Row gutter={[12, 12]}>
        {cards.map((c) => (
          <Col key={c.key} xs={24} lg={12}>
            <Card size="small" type="inner"
              title={<Space><RecordLink text={c.gprNo} onClick={() => onOpenGpr(c.gprId)} /><Tag>Seq {c.seqNo} · {c.processLabel}</Tag></Space>}
              extra={<Text type="secondary" style={{ fontSize: 12 }}>Required by {formatDate(orders?.[c.orderId]?.deliveryDate)}</Text>}>
              <Descriptions size="small" column={2} items={[
                { key: 'order', label: 'Order · Buyer', children: `${c.orderNo} · ${c.buyer}` },
                { key: 'style', label: 'Style No.', children: c.styleNo },
                { key: 'garment', label: 'Garment', children: orders?.[c.orderId]?.garment ?? '—' },
                { key: 'cells', label: 'Colour · Sizes', children: `${c.colors.join(', ')} · ${c.sizes.join(', ')}` },
              ]} />
              <Progress percent={pct(c.prevPoQty + c.thisPo, c.required)} success={{ percent: pct(c.prevPoQty, c.required) }} showInfo={false} style={{ margin: '8px 0 4px' }} />
              <Row gutter={8}>
                <Col span={6}><Figure label="Required" value={c.required} /></Col>
                <Col span={6}><Figure label="Previously PO'd" value={c.prevPoQty} /></Col>
                <Col span={6}><Figure label="This PO" value={c.thisPo} strong /></Col>
                <Col span={6}><Figure label="Balance after" value={c.balanceAfter} strong danger={c.balanceAfter < 0} /></Col>
              </Row>
            </Card>
          </Col>
        ))}
      </Row>
    </Card>
  );
});

export default GpoRequirementCards;
