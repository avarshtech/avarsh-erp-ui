import { Card, Row, Col, Typography, Tag } from 'antd';
import { srRevisionLabel } from '../../../utils/sampleRequestConstants';

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
 * Section A — header auto-populated from the sample Order + BOM, read-only.
 * No SAMPLE badge (everything in this module is a sample). A revision says so
 * beside its number, and names the request it re-makes.
 */
const SectionHeader = ({ srNo, header }) => (
  <Card size="small" style={{ marginBottom: 16 }} title={<Title level={5} style={{ margin: 0 }}>A · Header — auto-populated from BOM &amp; Order</Title>}>
    <Row gutter={[24, 16]}>
      <Field label="SR Number">
        {srNo || 'Auto on save (SRQ/FY/NNNN)'}
        {srRevisionLabel(header) && (
          <Tag color="gold" style={{ marginInlineStart: 8, fontSize: 11 }}>{srRevisionLabel(header)}</Tag>
        )}
      </Field>
      {header?.parentSrNo && <Field label="Revision of">{header.parentSrNo}</Field>}
      <Field label="Order Number">{header?.orderNo}</Field>
      <Field label="BOM Reference">{header?.bomId ? `BOM #${header.bomId}` : '—'}</Field>
      <Field label="Style Number">{header?.styleNo}</Field>
      <Field label="Garment Name">{header?.garmentName}</Field>
      <Field label="Buyer">{header?.buyerName}</Field>
      <Field label="Season">{header?.season}</Field>
      {header?.orderQty != null && <Field label="Order Qty">{header.orderQty.toLocaleString()} pcs</Field>}
      {header?.buyerCountry && <Field label="Consignee Country">{header.buyerCountry}</Field>}
    </Row>
  </Card>
);

export default SectionHeader;
