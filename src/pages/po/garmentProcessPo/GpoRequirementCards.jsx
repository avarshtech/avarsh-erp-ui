import { memo } from 'react';
import { Card, Col, Progress, Row, Space, Tag, Typography } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import RecordLink from '../../../components/RecordLink';
import FactSheet from '../../../components/FactSheet';
import { formatDate } from '../../../utils/formatters';

const { Text } = Typography;
const n = (v) => Number(v || 0).toLocaleString('en-IN');
const pct = (v, of) => (of > 0 ? Math.max(0, Math.min(100, (v / of) * 100)) : 0);

/**
 * Process requirement details (PRD §19): one read-only card per requirement line on the
 * PO — to change them, edit the Garment Process Requirement — with the requirement's
 * remarks (FR-15) and the allocation bar: previously PO'd (green), this PO (blue), balance
 * after, with the four figures as tiles under it. `cards` = requirementCards().
 */
const GpoRequirementCards = memo(function GpoRequirementCards({ cards, orders, onOpenGpr }) {
  if (!cards.length) return null;
  return (
    <Card id="gpo-requirements" size="small" style={{ marginBottom: 16 }}
      title={<Space>Process Requirement Details<Tag icon={<LockOutlined />}>Read-only · from requirement</Tag></Space>}
      extra={<Text type="secondary" style={{ fontSize: 12 }}>To change, edit the Garment Process Requirement</Text>}>
      <Row gutter={[12, 12]}>
        {cards.map((c) => (
          // Full width up to xxl: in a half-width card the four figure tiles would wrap
          <Col key={c.key} xs={24} xxl={cards.length > 1 ? 12 : 24}>
            <Card size="small" type="inner"
              title={<Space><RecordLink text={c.gprNo} onClick={() => onOpenGpr(c.gprId)} /><Tag>Seq {c.seqNo} · {c.processLabel}</Tag></Space>}
              extra={<Text type="secondary" style={{ fontSize: 12 }}>Required by {formatDate(orders?.[c.orderId]?.deliveryDate)}</Text>}>
              <FactSheet
                fields={[
                  { label: 'Order · Buyer', value: `${c.orderNo} · ${c.buyer}` },
                  { label: 'Style No.', value: c.styleNo },
                  { label: 'Garment', value: orders?.[c.orderId]?.garment },
                ]}
                chips={[
                  { label: 'Colours', items: c.colors.map((x) => ({ key: x, text: x })) },
                  { label: 'Sizes', items: c.sizes.map((x) => ({ key: x, text: x })) },
                ]}
                footer={c.remarks && `Requirement remarks: ${c.remarks}`}
              />
              <Progress percent={pct(c.prevPoQty + c.thisPo, c.required)} success={{ percent: pct(c.prevPoQty, c.required) }} showInfo={false} style={{ margin: '12px 0 8px' }} />
              <FactSheet tiles={[
                { label: 'Required', value: n(c.required) },
                { label: "Previously PO'd", value: n(c.prevPoQty) },
                { label: 'This PO', value: n(c.thisPo), accent: true },
                { label: 'Balance after', value: n(c.balanceAfter), danger: c.balanceAfter < 0 },
              ]} />
            </Card>
          </Col>
        ))}
      </Row>
    </Card>
  );
});

export default GpoRequirementCards;
