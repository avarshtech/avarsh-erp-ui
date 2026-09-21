import { Card, Row, Col, Typography, Tag, Alert } from 'antd';

const { Text, Title } = Typography;

const Field = ({ label, children }) => (
  <Col xs={12} sm={8} md={6}>
    <Text type="secondary" style={{ fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>
      {label}
    </Text>
    <Text strong style={{ fontSize: 14 }}>{children || '—'}</Text>
  </Col>
);

/**
 * Section A — header auto-populated from the sample Order + BOM, read-only
 * (PRD §8.2 A). Round 2+ SRs additionally show the prior round's comments
 * carried forward as read-only reference (§8.2 B).
 */
const SectionHeader = ({ srNo, header, round, priorFeedbackRef }) => (
  <Card size="small" style={{ marginBottom: 16 }} title={<Title level={5} style={{ margin: 0 }}>A · Header — auto-populated from BOM &amp; Order</Title>}>
    <Row gutter={[24, 16]}>
      <Field label="SR Number">{srNo || 'Auto on save (SRQ-YYYY-NNNN)'}</Field>
      {/* No SAMPLE badge here — inside the SR module every order is a sample */}
      <Field label="Order Number">{header?.orderNo}</Field>
      <Field label="BOM Reference">{header?.bomId ? `BOM #${header.bomId}` : '—'}</Field>
      <Field label="Style Number">{header?.styleNo}</Field>
      <Field label="Garment Name">{header?.garmentName}</Field>
      <Field label="Buyer">{header?.buyerName}</Field>
      <Field label="Season">{header?.season}</Field>
      <Field label="Sample Round"><Tag>{`Round ${round || 1}`}</Tag></Field>
      {header?.orderQty != null && <Field label="Order Qty">{header.orderQty.toLocaleString()} pcs</Field>}
      {header?.buyerCountry && <Field label="Consignee Country">{header.buyerCountry}</Field>}
    </Row>

    {priorFeedbackRef && (
      <Alert
        style={{ marginTop: 16 }}
        type="warning"
        showIcon
        message={`Round ${priorFeedbackRef.round} buyer comments — carried forward (read-only, from ${priorFeedbackRef.srNo})`}
        description={
          <div>
            <div>
              <Text strong>Decision: </Text>
              <Tag color="orange">{(priorFeedbackRef.decision || '').replace(/_/g, ' ')}</Tag>
              <Text type="secondary" style={{ marginInlineStart: 8 }}>
                {priorFeedbackRef.date} · {priorFeedbackRef.from}
              </Text>
            </div>
            {Object.entries(priorFeedbackRef.comments || {})
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} style={{ marginTop: 4 }}>
                  <Text strong style={{ textTransform: 'capitalize' }}>{k.replace(/([A-Z])/g, ' $1')}: </Text>
                  <Text>{v}</Text>
                </div>
              ))}
          </div>
        }
      />
    )}
  </Card>
);

export default SectionHeader;
