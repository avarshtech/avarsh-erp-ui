import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Select, DatePicker, Table, Row, Col, Spin, Alert, Typography, Space, theme } from 'antd';
import dayjs from 'dayjs';
import { getAttendanceSummary } from '../../../services/hr/hrAnalyticsService';
import { getActiveFactories } from '../../../services/master/factoryService';
import AttendanceHeadline from './AttendanceHeadline';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const GROUPINGS = [
  { value: 'DEPARTMENT', label: 'Department' },
  { value: 'FACTORY', label: 'Factory' },
  { value: 'CATEGORY', label: 'Category' },
  { value: 'DESIGNATION', label: 'Designation' },
  { value: 'EMPLOYEE_TYPE', label: 'Employment type' },
  { value: 'GRADE', label: 'Grade' },
];

const num = { align: 'right', width: 95 };

/**
 * Attendance over a date range, grouped.
 *
 * The screen the cost bridge points at: when the bridge says attendance moved
 * the payroll total, this says which departments lost days and whether anyone
 * was actually absent or the register simply went unfilled.
 */
const AttendanceSummary = () => {
  const { token } = theme.useToken();
  const [factories, setFactories] = useState([]);
  const [factoryId, setFactoryId] = useState(undefined);
  const [range, setRange] = useState([dayjs().subtract(1, 'month').startOf('month'),
    dayjs().subtract(1, 'month').endOf('month')]);
  const [groupBy, setGroupBy] = useState('DEPARTMENT');

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getActiveFactories()
      .then((list) => setFactories(Array.isArray(list) ? list : list?.content || []))
      .catch(() => setFactories([]));
  }, []);

  const params = useMemo(() => (range?.[0] && range?.[1] ? {
    from: range[0].format('YYYY-MM-DD'),
    to: range[1].format('YYYY-MM-DD'),
    groupBy,
    ...(factoryId ? { factoryId } : {}),
  } : null), [range, groupBy, factoryId]);

  const fetchData = useCallback(async () => {
    if (!params) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getAttendanceSummary(params));
    } catch (err) {
      setData(null);
      setError(err?.response?.data?.message || 'The summary could not be built.');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const hasOther = data?.groups?.some((g) => g.otherDays > 0);

  const columns = useMemo(() => [
    { title: GROUPINGS.find((g) => g.value === groupBy)?.label, dataIndex: 'label', key: 'label', ellipsis: true, width: 150 },
    { title: 'Staff', dataIndex: 'employees', key: 'employees', ...num, width: 80 },
    { title: 'Present', dataIndex: 'presentDays', key: 'presentDays', ...num },
    { title: 'Half', dataIndex: 'halfDays', key: 'halfDays', ...num, width: 75 },
    { title: 'On duty', dataIndex: 'onDutyDays', key: 'onDutyDays', ...num, width: 85 },
    { title: 'Leave', dataIndex: 'leaveDays', key: 'leaveDays', ...num, width: 85 },
    {
      title: 'Absent', dataIndex: 'absentDays', key: 'absentDays', ...num,
      sorter: (a, b) => a.absentDays - b.absentDays,
    },
    {
      title: 'Off & holidays', key: 'nonWorking', ...num, width: 120,
      render: (_, r) => r.weeklyOffDays + r.holidayDays,
    },
    ...(hasOther ? [{ title: 'Other', dataIndex: 'otherDays', key: 'otherDays', ...num, width: 80 }] : []),
    {
      title: 'Unmarked', dataIndex: 'unmarkedDays', key: 'unmarkedDays', ...num, width: 105,
      sorter: (a, b) => a.unmarkedDays - b.unmarkedDays,
      render: (v) => (v > 0
        ? <Text strong style={{ color: token.colorWarning }}>{v}</Text>
        : <Text type="secondary">0</Text>),
    },
    { title: 'OT hrs', dataIndex: 'otHours', key: 'otHours', ...num, width: 85 },
    {
      title: 'Attendance', dataIndex: 'attendancePercent', key: 'attendancePercent', ...num, width: 110,
      sorter: (a, b) => (a.attendancePercent ?? 0) - (b.attendancePercent ?? 0),
      render: (v) => (v == null ? <Text type="secondary">-</Text> : `${v}%`),
    },
    {
      title: 'Absenteeism', dataIndex: 'absenteeismPercent', key: 'absenteeismPercent', ...num, width: 115,
      render: (v) => (v == null ? <Text type="secondary">-</Text> : `${v}%`),
    },
  ], [groupBy, hasOther, token]);

  return (
    <>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="bottom">
          <Col xs={24} md={9}>
            <Text type="secondary" style={{ fontSize: 12 }}>Period</Text>
            <RangePicker name="range" value={range} onChange={setRange} allowClear={false}
              format="DD MMM YYYY" style={{ width: '100%' }} />
          </Col>
          <Col xs={12} md={8}>
            <Text type="secondary" style={{ fontSize: 12 }}>Factory</Text>
            <Select name="factory" value={factoryId} onChange={setFactoryId} allowClear
              placeholder="All factories" style={{ width: '100%' }}
              options={factories.map((f) => ({
                value: f.id,
                label: `${f.factoryCode || ''} ${f.factoryName || ''}`.trim(),
              }))} />
          </Col>
          <Col xs={12} md={7}>
            <Text type="secondary" style={{ fontSize: 12 }}>Break down by</Text>
            <Select name="groupBy" value={groupBy} onChange={setGroupBy}
              options={GROUPINGS} style={{ width: '100%' }} />
          </Col>
        </Row>
      </Card>

      {error && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }}
          title="No summary to show" description={error} />
      )}

      <Spin spinning={loading}>
        {data && (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <AttendanceHeadline total={data.total} />

            {data.total.unmarkedDays > 0 && (
              <Alert
                type="warning"
                showIcon
                title={`${data.total.unmarkedDays} days were never marked`}
                description="Payroll works out loss of pay as calendar days minus payable days, and payable
                  days come from what attendance recorded. A day nobody marked is deducted exactly as if the
                  employee had been absent, so these are unpaid unless the register is completed before the
                  run is processed."
              />
            )}

            <Card size="small" title={`By ${data.groupByLabel.toLowerCase()}`}>
              <Table
                rowKey="key"
                columns={columns}
                dataSource={data.groups}
                size="small"
                scroll={{ x: 1250 }}
                pagination={false}
                locale={{ emptyText: 'Nobody employed in this period' }}
              />
            </Card>
          </Space>
        )}
      </Spin>
    </>
  );
};

export default AttendanceSummary;
