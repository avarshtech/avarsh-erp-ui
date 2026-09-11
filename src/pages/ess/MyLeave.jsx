import { useState, useEffect, useCallback } from 'react';
import { Card, DatePicker, Row, Col, Spin, Alert, Typography, Space, Tag, Progress, theme } from 'antd';
import dayjs from 'dayjs';
import { getMyLeaveLedger } from '../../services/hr/essService';
import { days } from './essFormat';

const { Text, Title } = Typography;

const Line = ({ label, value, muted }) => (
  <Row justify="space-between" style={{ padding: '3px 0' }}>
    <Text type={muted ? 'secondary' : undefined} style={{ fontSize: 13 }}>{label}</Text>
    <Text type={muted ? 'secondary' : undefined} style={{ fontSize: 13 }}>{days(value)}</Text>
  </Row>
);

/**
 * How much leave is left, and why it is that number.
 *
 * The working is shown under every balance rather than behind a link. "How
 * many days do I have" and "where did the rest go" are the same conversation,
 * and splitting them across two screens is what makes it an argument.
 */
const MyLeave = () => {
  const { token } = theme.useToken();
  const [year, setYear] = useState(dayjs());
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getMyLeaveLedger({ year: year.year() }));
    } catch (err) {
      setData(null);
      setError(err?.response?.data?.message || 'Your leave balance could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>Leave year</Text>
        <DatePicker name="year" picker="year" value={year} onChange={setYear}
          allowClear={false} style={{ width: 160, display: 'block' }} />
      </Card>

      {error && <Alert type="warning" showIcon title="Nothing to show" description={error} />}

      <Spin spinning={loading}>
        {data && (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Card size="small">
              <Text type="secondary" style={{ fontSize: 12 }}>Available across all types</Text>
              <Title level={3} style={{ margin: '2px 0 0' }}>
                {days(data.totalAvailable)} days
              </Title>
            </Card>

            {data.types?.length === 0 && (
              <Alert type="info" showIcon
                title={`No leave recorded for ${data.year}`}
                description="A balance appears once leave has been granted or applied for in this year." />
            )}

            <Row gutter={[16, 16]}>
              {data.types?.map((t) => {
                const accrued = Number(t.accrued) || 0;
                const closing = Number(t.closing) || 0;
                return (
                  <Col xs={24} md={12} key={t.leaveTypeId}>
                    <Card size="small" title={(
                      <Space>
                        {t.name}
                        {t.encashable
                          ? <Tag color="success">can be encashed</Tag>
                          : <Tag>lapses at year end</Tag>}
                      </Space>
                    )}>
                      <Row justify="space-between" align="bottom">
                        <Title level={4} style={{ margin: 0 }}>{days(t.closing)}</Title>
                        <Text type="secondary" style={{ fontSize: 12 }}>days left</Text>
                      </Row>
                      <Progress
                        percent={accrued > 0 ? Math.round((closing / accrued) * 100) : 0}
                        showInfo={false}
                        size="small"
                        strokeColor={token.colorPrimary}
                        style={{ margin: '6px 0 10px' }}
                      />
                      <Line label="Carried over from last year" value={t.opening} muted />
                      <Line label="Granted this year" value={t.accrued} />
                      <Line label="Taken" value={t.used} />
                      {Number(t.encashed) > 0 && <Line label="Encashed" value={t.encashed} />}
                      {Number(t.lapsed) > 0 && <Line label="Lapsed" value={t.lapsed} />}
                      <div style={{ borderTop: `1px solid ${token.colorBorderSecondary}`, marginTop: 6 }}>
                        <Line label="Left" value={t.closing} />
                      </div>

                      {t.inconsistent && (
                        <Alert type="warning" showIcon style={{ marginTop: 10 }}
                          title="These figures do not add up"
                          description="The balance on file does not match its own working. Please ask HR
                            to check it — applications are approved against the figure on file." />
                      )}
                    </Card>
                  </Col>
                );
              })}
            </Row>

            {data.carryForwardMissing && (
              <Alert type="info" showIcon
                title="Last year's balance is not carried over yet"
                description="Year-end carry-forward has not been set up, so anything left from last year
                  is not counted here. Ask HR if you believe you are holding more than this shows." />
            )}
          </Space>
        )}
      </Spin>
    </>
  );
};

export default MyLeave;
