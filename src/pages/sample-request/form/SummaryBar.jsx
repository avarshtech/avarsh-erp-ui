import { Card, Row, Col, Form, Input, Button, Typography } from 'antd';
import { ShoppingCartOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { TextArea } = Input;

/**
 * Section E — summary counters + remarks (PRD v3 §8.2 E, Figure 8). Each
 * counter is a roomy accented block with a caption explaining what the number
 * means; the shortfall counter doubles as a route into the Raise PO drawer.
 */
const Counter = ({ label, value, caption, color, extra }) => (
  <Card
    size="small"
    style={{ borderTop: `3px solid ${color}`, height: '100%' }}
    styles={{ body: { padding: '14px 16px' } }}
  >
    <Text type="secondary" style={{ fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', display: 'block' }}>
      {label}
    </Text>
    <div style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.3, color }}>{value}</div>
    {caption && <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{caption}</Text>}
    {extra}
  </Card>
);

const SummaryBar = ({ totals, onRaisePoFromShortfall, readOnly = false }) => (
  <Card size="small" style={{ marginBottom: 16 }} title={<Title level={5} style={{ margin: 0 }}>E · Summary &amp; Actions</Title>}>
    <Row gutter={[16, 16]}>
      <Col xs={24} sm={12} lg={6}>
        <Counter
          label="Total Material Lines"
          value={totals.total}
          caption={`${totals.fabric} fabric · ${totals.trims} trims`}
          color="#8b5cf6"
        />
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Counter
          label="Materials Available"
          value={totals.available}
          caption="Indicative — no live stock check in v1"
          color="var(--success-color)"
        />
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Counter
          label="Shortfall Items"
          value={totals.shortfall}
          caption={totals.shortfall ? 'Special qualities are often bought in for the sample' : 'Nothing flagged short'}
          color={totals.shortfall ? 'var(--error-color)' : 'var(--success-color)'}
          extra={totals.shortfall > 0 && !readOnly && (
            <Button type="link" size="small" style={{ padding: 0 }} icon={<ShoppingCartOutlined />} onClick={onRaisePoFromShortfall}>
              Raise PO →
            </Button>
          )}
        />
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Counter
          label="Sample POs Raised"
          value={totals.posRaised}
          caption={totals.posRaised ? 'PO Pending until goods are received' : 'None yet against this SR'}
          color="#fa8c16"
        />
      </Col>
    </Row>
    {!readOnly && (
      <Form.Item name="remarks" label="Remarks" style={{ marginTop: 16, marginBottom: 0 }}>
        <TextArea rows={1} placeholder="Internal notes for the sampling team…" />
      </Form.Item>
    )}
  </Card>
);

export default SummaryBar;
