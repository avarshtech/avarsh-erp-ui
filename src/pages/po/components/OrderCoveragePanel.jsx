import { Card, Row, Col, Statistic, Progress, Typography, Alert, Space, Tag } from 'antd';

const { Text } = Typography;

/**
 * Order-coverage / over-authorization panel (industry-standard planning guard).
 * Shows how much of the order quantity is already authorized by sibling POs of
 * the same type, how much this PO adds, and what remains — flags over-authorization.
 */
const OrderCoveragePanel = ({ orderQty = 0, authorizedQty = 0, thisPoQty = 0, poNumbers = [] }) => {
  const committed = authorizedQty + thisPoQty;
  const remaining = orderQty - committed;
  const over = remaining < 0;
  const percent = orderQty ? Math.round((committed / orderQty) * 100) : 0;

  return (
    <Card size="small" style={{ marginBottom: 16, borderRadius: 'var(--radius-md)' }}>
      <Row gutter={16} align="middle">
        <Col xs={12} sm={6}><Statistic title="Order Qty" value={orderQty} /></Col>
        <Col xs={12} sm={6}><Statistic title="Already Authorized" value={authorizedQty} valueStyle={{ color: '#1677ff' }} /></Col>
        <Col xs={12} sm={6}><Statistic title="This PO" value={thisPoQty} valueStyle={{ color: '#722ed1' }} /></Col>
        <Col xs={12} sm={6}>
          <Statistic title={over ? 'Over by' : 'Remaining'} value={Math.abs(remaining)}
            valueStyle={{ color: over ? '#cf1322' : '#389e0d' }} />
        </Col>
      </Row>
      <Progress
        percent={Math.min(percent, 100)}
        status={over ? 'exception' : percent === 100 ? 'success' : 'active'}
        format={() => `${percent}%`}
        style={{ marginTop: 8 }}
      />
      {poNumbers.length > 0 && (
        <Space wrap size={4} style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>Existing POs for this order:</Text>
          {poNumbers.map((n) => <Tag key={n}>{n}</Tag>)}
        </Space>
      )}
      {over && (
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 10 }}
          message={`This PO would authorize ${Math.abs(remaining).toLocaleString()} pcs over the order quantity of ${orderQty.toLocaleString()}.`}
        />
      )}
    </Card>
  );
};

export default OrderCoveragePanel;
