import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Row, Col, Spin, Alert, Typography, Space, List, Tag, theme } from 'antd';
import dayjs from 'dayjs';
import { getMyPayComparison } from '../../services/hr/essService';
import { rupees, signedRupees, days } from './essFormat';

const { Text, Title, Paragraph } = Typography;

/**
 * "Why is my pay less this month?"
 *
 * The answer leads, in a sentence, before any table. Somebody asking this is
 * not looking for a payslip - they have one - they are looking for the reason,
 * and making them derive it from two columns of figures is what sends them to
 * the HR counter in the first place.
 */
const MyPay = () => {
  const { token } = theme.useToken();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // No month argument: the server returns the most recent payslip, which is
      // what somebody asking this question is almost always holding.
      setData(await getMyPayComparison({}));
    } catch (err) {
      setData(null);
      setError(err?.response?.data?.message || 'Your pay details could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const difference = data?.difference == null ? null : Number(data.difference);
  const headline = useMemo(() => {
    if (!data) return null;
    if (difference == null) return 'This is your first payslip, so there is nothing to compare it with yet.';
    if (difference === 0) return 'Your pay is the same as last month.';
    return difference < 0
      ? `Your pay is ${rupees(Math.abs(difference))} less than ${data.previousPeriod.label}.`
      : `Your pay is ${rupees(difference)} more than ${data.previousPeriod.label}.`;
  }, [data, difference]);

  return (
    <Spin spinning={loading}>
      {error && <Alert type="warning" showIcon title="Nothing to show" description={error} />}

      {data && (
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <Card size="small">
            <Row gutter={[12, 12]} align="middle" justify="space-between">
              <Col>
                <Text type="secondary" style={{ fontSize: 12 }}>Payslip for</Text>
                <Title level={4} style={{ margin: 0 }}>{data.thisPeriod.label}</Title>
              </Col>
              <Col>
                <Text type="secondary" style={{ fontSize: 12 }}>Net pay</Text>
                <Title level={4} style={{ margin: 0 }}>{rupees(data.thisPeriod.netSalary)}</Title>
              </Col>
            </Row>

            <Paragraph style={{ margin: '14px 0 0', fontSize: 16 }}>
              {headline}
            </Paragraph>
          </Card>

          {data.reasons?.length > 0 && (
            <Card size="small" title="Why">
              <List
                dataSource={data.reasons}
                renderItem={(r) => {
                  const amount = Number(r.amount);
                  return (
                    <List.Item>
                      <List.Item.Meta
                        title={r.headline}
                        description={r.detail && (
                          <Text type="secondary" style={{ fontSize: 12 }}>{r.detail}</Text>
                        )}
                      />
                      <Text strong style={{
                        color: amount < 0 ? token.colorWarning : token.colorSuccess,
                        whiteSpace: 'nowrap',
                      }}>
                        {signedRupees(amount)}
                      </Text>
                    </List.Item>
                  );
                }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                These add up to exactly the difference — nothing is left unexplained.
              </Text>
            </Card>
          )}

          {data.lopDates?.length > 0 && (
            <Card size="small" title={`Days not paid in ${data.thisPeriod.label}`}>
              <Space size={[8, 8]} wrap>
                {data.lopDates.map((d) => (
                  <Tag key={d.date} color={d.reason === 'Marked absent' ? 'warning' : 'default'}>
                    {dayjs(d.date).format('DD MMM')} — {d.reason}
                  </Tag>
                ))}
              </Space>
              <Paragraph type="secondary" style={{ fontSize: 12, margin: '12px 0 0' }}>
                A day with nothing recorded is not paid, the same as an absence. If one of these looks
                wrong, it is worth raising with your supervisor before the next run.
              </Paragraph>
            </Card>
          )}

          <Card size="small" title="The two months side by side">
            <Row gutter={[16, 8]}>
              <Col xs={12}><Text type="secondary" style={{ fontSize: 12 }}>&nbsp;</Text></Col>
              <Col xs={6} style={{ textAlign: 'right' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>{data.thisPeriod.label}</Text>
              </Col>
              <Col xs={6} style={{ textAlign: 'right' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {data.previousPeriod?.label || '-'}
                </Text>
              </Col>
              {[
                ['Days paid for', 'payableDays', days],
                ['Days not paid', 'lopDays', days],
                ['Overtime hours', 'otHours', days],
                ['Total earnings', 'totalEarnings', rupees],
                ['Total deductions', 'totalDeductions', rupees],
                ['Net pay', 'netSalary', rupees],
              ].map(([label, field, format]) => (
                <Row key={field} style={{ width: '100%', padding: '4px 8px' }} gutter={[16, 0]}>
                  <Col xs={12}><Text>{label}</Text></Col>
                  <Col xs={6} style={{ textAlign: 'right' }}>
                    <Text strong>{format(data.thisPeriod[field])}</Text>
                  </Col>
                  <Col xs={6} style={{ textAlign: 'right' }}>
                    <Text type="secondary">
                      {data.previousPeriod ? format(data.previousPeriod[field]) : '-'}
                    </Text>
                  </Col>
                </Row>
              ))}
            </Row>
          </Card>
        </Space>
      )}
    </Spin>
  );
};

export default MyPay;
