import { Card, Row, Col, Form, Input, Typography } from 'antd';

const { Title, Text } = Typography;
const { TextArea } = Input;

/**
 * Section E — summary counters + remarks (PRD v3 §8.2 E, Figure 8). Each
 * counter is a roomy accented block with a caption explaining what the number
 * means.
 */
const Counter = ({ label, value, caption, color }) => (
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
  </Card>
);

const SummaryBar = ({ totals, readOnly = false }) => (
  <Card size="small" style={{ marginBottom: 16 }} title={<Title level={5} style={{ margin: 0 }}>E · Summary &amp; Actions</Title>}>
    <Row gutter={[16, 16]}>
      <Col xs={24} sm={12} lg={8}>
        <Counter
          label="Total Material Lines"
          value={totals.total}
          caption={`${totals.fabric} fabric · ${totals.trims} trims`}
          color="#8b5cf6"
        />
      </Col>
      <Col xs={24} sm={12} lg={8}>
        <Counter
          label="Materials Available"
          value={totals.available}
          caption="Live stock as of page load"
          color="var(--success-color)"
        />
      </Col>
      <Col xs={24} sm={12} lg={8}>
        <Counter
          label="Shortfall Items"
          value={totals.shortfall}
          caption={totals.shortfall ? 'Special qualities are often bought in for the sample' : 'Nothing flagged short'}
          color={totals.shortfall ? 'var(--error-color)' : 'var(--success-color)'}
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
