import { Card, Row, Col, Typography, Button, Tag, theme } from 'antd';
import { WarningOutlined, CheckCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

const hrs = (v) => `${Number(v) || 0} hrs`;

/**
 * The compliance reading of the same hours.
 *
 * Kept apart from the cost figures because it answers a different question and
 * a total cannot answer it: a factory can sit well under any average while one
 * person is far past a quarterly limit. So the unit here is the person and the
 * window is the whole quarter, whatever periods were selected.
 */
const OvertimeCompliance = ({ quarters, capHours, employeesOverCap, onShowBreaches }) => {
  const { token } = theme.useToken();
  const clean = !employeesOverCap;

  return (
    <Card
      size="small"
      title={(
        <span>
          {clean
            ? <CheckCircleOutlined style={{ color: token.colorSuccess }} />
            : <WarningOutlined style={{ color: token.colorWarning }} />}
          {' '}Against {capHours} hours a quarter
        </span>
      )}
      extra={!clean && (
        <Button type="link" size="small" onClick={onShowBreaches}>
          Show the {employeesOverCap} over
        </Button>
      )}
    >
      <Row gutter={[16, 16]}>
        {quarters.map((q) => {
          const over = q.employeesOverCap > 0;
          return (
            <Col xs={24} sm={12} md={8} key={q.label}>
              <div style={{
                border: `1px solid ${over ? token.colorWarningBorder : token.colorBorderSecondary}`,
                background: over ? token.colorWarningBg : 'transparent',
                borderRadius: token.borderRadius,
                padding: '10px 12px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <Text strong>{q.label}</Text>
                  {over
                    ? <Tag color="warning">{q.employeesOverCap} over</Tag>
                    : <Tag>within</Tag>}
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {hrs(q.totalOtHours)} across {q.employeesWithOt} people
                </Text>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Highest one person: {hrs(q.highestEmployeeHours)}
                  </Text>
                </div>
              </div>
            </Col>
          );
        })}
      </Row>

      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 12 }}>
        Each quarter is measured in full, including months outside the periods you selected — a limit
        defined per quarter is not a check of anything if only part of it is counted. The limit itself is
        yours to set: nothing in the system holds the current statutory figure, so confirm it against the
        notification in force before relying on this.
      </Text>
    </Card>
  );
};

export default OvertimeCompliance;
