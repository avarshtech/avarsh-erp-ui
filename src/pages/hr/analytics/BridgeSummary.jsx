import { Card, Row, Col, Typography, Tag, theme } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { formatRupees, periodLabel } from './bridgeFormat';

const { Text, Title } = Typography;

const Figure = ({ label, value, hint, colour }) => (
  <Col xs={12} md={6}>
    <Text type="secondary" style={{ fontSize: 12 }}>{label}</Text>
    <Title level={4} style={{ margin: '2px 0 0', color: colour, fontVariantNumeric: 'tabular-nums' }}>
      {value}
    </Title>
    {hint && <Text type="secondary" style={{ fontSize: 12 }}>{hint}</Text>}
  </Col>
);

/** The two totals, the movement between them, and the headcount behind each. */
const BridgeSummary = ({ bridge }) => {
  const { token } = theme.useToken();
  const movement = Number(bridge.movement) || 0;
  const rose = movement > 0;
  const colour = movement === 0 ? undefined : rose ? token.colorWarning : token.colorSuccess;

  return (
    <Card size="small">
      <Row gutter={[16, 16]} align="top">
        <Figure
          label={periodLabel(bridge.fromMonth, bridge.fromYear)}
          value={formatRupees(bridge.openingTotal)}
          hint={`${bridge.openingHeadcount} employees`}
        />
        <Figure
          label={periodLabel(bridge.toMonth, bridge.toYear)}
          value={formatRupees(bridge.closingTotal)}
          hint={`${bridge.closingHeadcount} employees`}
        />
        <Figure
          label="Change"
          colour={colour}
          value={(
            <>
              {movement !== 0 && (rose ? <ArrowUpOutlined /> : <ArrowDownOutlined />)}{' '}
              {formatRupees(Math.abs(movement))}
            </>
          )}
          hint={bridge.movementPercent != null
            ? `${rose ? '+' : '−'}${Math.abs(Number(bridge.movementPercent))}%`
            : 'no earlier total to compare against'}
        />
        <Col xs={12} md={6}>
          <Text type="secondary" style={{ fontSize: 12 }}>Measure</Text>
          <div style={{ marginTop: 4 }}>
            <Tag>{bridge.measureLabel}</Tag>
          </div>
          {bridge.reconciled && (
            <Text type="success" style={{ fontSize: 12 }}>
              <CheckCircleOutlined /> Drivers reconcile exactly
            </Text>
          )}
        </Col>
      </Row>
    </Card>
  );
};

export default BridgeSummary;
