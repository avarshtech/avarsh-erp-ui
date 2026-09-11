import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, DatePicker, Row, Col, Spin, Alert, Typography, Space, Tooltip, theme } from 'antd';
import dayjs from 'dayjs';
import { getMyAttendance } from '../../services/hr/essService';
import { days } from './essFormat';

const { Text, Title } = Typography;

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const STATUS_LABEL = {
  PRESENT: 'Present',
  HALF_DAY: 'Half day',
  ABSENT: 'Absent',
  LEAVE: 'Leave',
  WEEKLY_OFF: 'Weekly off',
  NATIONAL_HOLIDAY: 'Holiday',
  ON_DUTY: 'On duty',
};

const Figure = ({ label, value, colour }) => (
  <Col xs={8} sm={6} md={3}>
    <Text type="secondary" style={{ fontSize: 12 }}>{label}</Text>
    <Title level={5} style={{ margin: '2px 0 0', color: colour }}>{value}</Title>
  </Col>
);

/**
 * My attendance for a month, with the days that cost pay marked.
 *
 * A calendar that only colours statuses leaves the reader to work out which of
 * them reduced their pay, and the answer is not obvious - a day nobody recorded
 * costs exactly what an absence costs. So the days that cost pay carry a mark
 * of their own, on top of whatever status they have.
 */
const MyAttendance = () => {
  const { token } = theme.useToken();
  const [month, setMonth] = useState(dayjs().subtract(1, 'month'));
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getMyAttendance({ month: month.month() + 1, year: month.year() }));
    } catch (err) {
      setData(null);
      setError(err?.response?.data?.message || 'Your attendance could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const colourFor = useCallback((day) => {
    if (day.costsPay) return token.colorWarningBg;
    switch (day.status) {
      case 'PRESENT': case 'ON_DUTY': return token.colorSuccessBg;
      case 'LEAVE': return token.colorInfoBg;
      default: return token.colorFillQuaternary;
    }
  }, [token]);

  /** Blank cells so the first day lands under the right weekday. */
  const leadingBlanks = useMemo(() => {
    if (!data?.days?.length) return 0;
    return (dayjs(data.days[0].date).day() + 6) % 7;
  }, [data]);

  return (
    <>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>Month</Text>
        <DatePicker name="month" picker="month" value={month} onChange={setMonth}
          format="MMM YYYY" allowClear={false} style={{ width: 180, display: 'block' }} />
      </Card>

      {error && <Alert type="warning" showIcon title="Nothing to show" description={error} />}

      <Spin spinning={loading}>
        {data && (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Card size="small">
              <Row gutter={[12, 12]}>
                <Figure label="Present" value={data.presentDays} />
                <Figure label="Leave" value={data.leaveDays} />
                <Figure label="Absent" value={data.absentDays} />
                <Figure label="Half days" value={data.halfDays} />
                <Figure label="Not recorded" value={data.unmarkedDays}
                  colour={data.unmarkedDays > 0 ? token.colorWarning : undefined} />
                <Figure label="Overtime" value={`${days(data.otHours)} hrs`} />
                <Figure label="Days not paid" value={days(data.daysCostingPay)}
                  colour={Number(data.daysCostingPay) > 0 ? token.colorWarning : undefined} />
              </Row>
            </Card>

            <Card size="small" title={data.label}>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6,
              }}>
                {WEEKDAYS.map((d, i) => (
                  <Text key={`${d}-${i}`} type="secondary"
                    style={{ fontSize: 11, textAlign: 'center' }}>{d}</Text>
                ))}
                {Array.from({ length: leadingBlanks }, (_, i) => <span key={`blank-${i}`} />)}
                {data.days.map((day) => (
                  <Tooltip
                    key={day.date}
                    title={day.note || STATUS_LABEL[day.status] || 'Nothing recorded'}
                  >
                    <div style={{
                      background: colourFor(day),
                      border: day.costsPay ? `1px solid ${token.colorWarning}` : '1px solid transparent',
                      borderRadius: token.borderRadius,
                      padding: '6px 2px',
                      textAlign: 'center',
                      minHeight: 48,
                    }}>
                      <div style={{ fontWeight: 600 }}>{dayjs(day.date).date()}</div>
                      <Text style={{ fontSize: 10 }} type="secondary">
                        {day.status ? (STATUS_LABEL[day.status] || day.status) : '—'}
                      </Text>
                      {Number(day.otHours) > 0 && (
                        <div><Text style={{ fontSize: 10 }}>+{days(day.otHours)}h</Text></div>
                      )}
                    </div>
                  </Tooltip>
                ))}
              </div>

              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 12 }}>
                Days outlined in amber were not paid for. A day with nothing recorded counts the same
                as an absence, because pay is worked out from what the register holds.
              </Text>
            </Card>

            {data.payrollLopDays != null
              && Number(data.payrollLopDays) !== Number(data.daysCostingPay) && (
              <Alert type="info" showIcon
                title="This month has already been paid, on slightly different figures"
                description={`Payroll charged ${days(data.payrollLopDays)} days of loss of pay, and the
                  register now shows ${days(data.daysCostingPay)}. Attendance has most likely been
                  corrected since the run. Ask HR whether the difference will be adjusted.`} />
            )}
          </Space>
        )}
      </Spin>
    </>
  );
};

export default MyAttendance;
