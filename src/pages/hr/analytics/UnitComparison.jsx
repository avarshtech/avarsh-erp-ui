import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Select, DatePicker, InputNumber, Table, Row, Col, Spin, Alert, Typography, Space, Tag, theme } from 'antd';
import dayjs from 'dayjs';
import { getUnitComparison } from '../../../services/hr/hrAnalyticsService';
import { formatRupees } from './bridgeFormat';

const { Text } = Typography;

const GROUPINGS = [
  { value: 'FACTORY', label: 'Factory' },
  { value: 'DEPARTMENT', label: 'Department' },
  { value: 'CATEGORY', label: 'Category' },
  { value: 'DESIGNATION', label: 'Designation' },
];

const MEASURES = [
  { value: 'CTC', label: 'Cost to company' },
  { value: 'GROSS', label: 'Gross earnings' },
  { value: 'NET', label: 'Net pay' },
];

const METRIC_LABEL = {
  costPerHead: 'cost per head',
  lopDaysPerHead: 'loss of pay',
  otHoursPerHead: 'overtime',
  attendanceRate: 'attendance',
  overtimeShare: 'overtime share',
};

/**
 * Every unit on the same metrics, with the odd ones out named.
 *
 * The outlier marks are the feature. A comparison table is easy to build and
 * nobody reads one: the eye does not find the unusual row across six columns
 * and a dozen units, so the server does that and the screen says which figure
 * is the unusual one.
 */
const UnitComparison = () => {
  const { token } = theme.useToken();
  const [month, setMonth] = useState(dayjs().subtract(1, 'month'));
  const [groupBy, setGroupBy] = useState('FACTORY');
  const [measure, setMeasure] = useState('CTC');
  const [threshold, setThreshold] = useState(25);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const params = useMemo(() => (month && threshold > 0 ? {
    month: month.month() + 1, year: month.year(),
    groupBy, measure,
    outlierThreshold: threshold / 100,
  } : null), [month, groupBy, measure, threshold]);

  const fetchData = useCallback(async () => {
    if (!params) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getUnitComparison(params));
    } catch (err) {
      setData(null);
      setError(err?.response?.data?.message || 'The comparison could not be built.');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /** Marks a cell when this unit is an outlier on that metric. */
  const metric = useCallback((key, render) => ({
    width: 130,
    align: 'right',
    sorter: (a, b) => (a[key] ?? 0) - (b[key] ?? 0),
    render: (v, r) => {
      const flagged = r.outlierOn?.includes(key);
      if (v == null) return <Text type="secondary">-</Text>;
      return (
        <Text strong={flagged} style={flagged ? { color: token.colorWarning } : undefined}>
          {render(v)}
        </Text>
      );
    },
  }), [token]);

  const columns = useMemo(() => [
    {
      title: GROUPINGS.find((g) => g.value === groupBy)?.label,
      dataIndex: 'label', key: 'label', ellipsis: true, width: 170,
      render: (v, r) => (
        <>
          <div>{v}</div>
          {r.outlierOn?.length > 0 && (
            <Text type="warning" style={{ fontSize: 11 }}>
              unusual {r.outlierOn.map((m) => METRIC_LABEL[m]).join(', ')}
            </Text>
          )}
        </>
      ),
    },
    { title: 'Paid', dataIndex: 'employeesPaid', key: 'employeesPaid', width: 80, align: 'right' },
    {
      title: 'Total cost', dataIndex: 'totalCost', key: 'totalCost',
      width: 140, align: 'right', render: formatRupees,
    },
    { title: 'Cost per head', dataIndex: 'costPerHead', key: 'costPerHead', ...metric('costPerHead', formatRupees) },
    { title: 'LOP / head', dataIndex: 'lopDaysPerHead', key: 'lopDaysPerHead', ...metric('lopDaysPerHead', (v) => `${v} days`) },
    { title: 'OT / head', dataIndex: 'otHoursPerHead', key: 'otHoursPerHead', ...metric('otHoursPerHead', (v) => `${v} hrs`) },
    { title: 'Attendance', dataIndex: 'attendanceRate', key: 'attendanceRate', ...metric('attendanceRate', (v) => `${v}%`) },
    { title: 'OT share', dataIndex: 'overtimeShare', key: 'overtimeShare', ...metric('overtimeShare', (v) => `${v}%`) },
  ], [groupBy, metric]);

  const outliers = useMemo(
    () => (data?.units || []).filter((u) => u.outlierOn?.length > 0),
    [data],
  );

  return (
    <>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="bottom">
          <Col xs={12} md={5}>
            <Text type="secondary" style={{ fontSize: 12 }}>Period</Text>
            <DatePicker name="month" picker="month" value={month} onChange={setMonth}
              format="MMM YYYY" allowClear={false} style={{ width: '100%' }} />
          </Col>
          <Col xs={12} md={6}>
            <Text type="secondary" style={{ fontSize: 12 }}>Compare</Text>
            <Select name="groupBy" value={groupBy} onChange={setGroupBy}
              options={GROUPINGS} style={{ width: '100%' }} />
          </Col>
          <Col xs={12} md={7}>
            <Text type="secondary" style={{ fontSize: 12 }}>Cost measure</Text>
            <Select name="measure" value={measure} onChange={setMeasure}
              options={MEASURES} style={{ width: '100%' }} />
          </Col>
          <Col xs={12} md={6}>
            <Text type="secondary" style={{ fontSize: 12 }}>Flag beyond</Text>
            <InputNumber name="threshold" value={threshold} onChange={setThreshold}
              min={5} max={200} suffix="% from median" style={{ width: '100%' }} />
          </Col>
        </Row>
      </Card>

      {error && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }}
          title="No comparison to show" description={error} />
      )}

      <Spin spinning={loading}>
        {data && (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            {outliers.length > 0 ? (
              <Alert type="warning" showIcon
                title={`${outliers.length} of ${data.units.length} sit well away from the middle`}
                description={(
                  <Space size={[8, 8]} wrap style={{ marginTop: 4 }}>
                    {outliers.map((u) => (
                      <Tag key={u.key} color="warning">
                        {u.label}: {u.outlierOn.map((m) => METRIC_LABEL[m]).join(', ')}
                      </Tag>
                    ))}
                  </Space>
                )} />
            ) : (
              <Alert type="success" showIcon
                title="No unit stands out"
                description={data.units.length < 3
                  ? 'Fewer than three units, so there is no middle to compare against.'
                  : `Every unit is within ${threshold}% of the median on all metrics.`} />
            )}

            <Card size="small" title={`${data.label} — by ${data.groupByLabel.toLowerCase()}`}>
              <Table rowKey="key" columns={columns} dataSource={data.units}
                size="small" scroll={{ x: 1000 }} pagination={false}
                locale={{ emptyText: 'No processed payroll runs for this period' }} />
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 10 }}>
                Compared against the median rather than the average, so one very large unit does not
                drag the middle towards itself — which is exactly the unit this is meant to find.
              </Text>
            </Card>

            {data.unitsWithoutRun?.length > 0 && (
              <Alert type="info" showIcon
                title="Some factories have no processed run for this period"
                description={`${data.unitsWithoutRun.join(', ')}. They are absent rather than shown as
                  zero, which would make them look like the cheapest unit.`} />
            )}
          </Space>
        )}
      </Spin>
    </>
  );
};

export default UnitComparison;
