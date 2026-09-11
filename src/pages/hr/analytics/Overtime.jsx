import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Select, DatePicker, InputNumber, Table, Row, Col, Spin, Alert, Typography, Space, Button, theme } from 'antd';
import dayjs from 'dayjs';
import { getOvertimeAnalysis } from '../../../services/hr/hrAnalyticsService';
import { getActiveFactories } from '../../../services/master/factoryService';
import { formatRupees } from './bridgeFormat';
import OvertimeCompliance from './OvertimeCompliance';
import OvertimeRegisterDrawer from './OvertimeRegisterDrawer';

const { Text, Title } = Typography;

const GROUPINGS = [
  { value: 'DEPARTMENT', label: 'Department' },
  { value: 'CATEGORY', label: 'Category' },
  { value: 'DESIGNATION', label: 'Designation' },
  { value: 'GRADE', label: 'Grade' },
];

const Figure = ({ label, value, hint, colour }) => (
  <Col xs={12} md={6}>
    <Text type="secondary" style={{ fontSize: 12 }}>{label}</Text>
    <Title level={4} style={{ margin: '2px 0 0', color: colour, fontVariantNumeric: 'tabular-nums' }}>
      {value}
    </Title>
    {hint && <Text type="secondary" style={{ fontSize: 12 }}>{hint}</Text>}
  </Col>
);

/**
 * Overtime, read two ways.
 *
 * Cost is the total and the money; compliance is whether any one person went
 * past a per-quarter limit. They are kept in separate cards because reading one
 * as the other is the mistake this screen exists to prevent.
 */
const Overtime = () => {
  const { token } = theme.useToken();
  const [factories, setFactories] = useState([]);
  const [factoryId, setFactoryId] = useState(undefined);
  const [from, setFrom] = useState(dayjs().subtract(3, 'month'));
  const [to, setTo] = useState(dayjs().subtract(1, 'month'));
  const [groupBy, setGroupBy] = useState('DEPARTMENT');
  const [capHours, setCapHours] = useState(50);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [register, setRegister] = useState(null);

  useEffect(() => {
    getActiveFactories()
      .then((list) => {
        const rows = Array.isArray(list) ? list : list?.content || [];
        setFactories(rows);
        if (rows.length && factoryId === undefined) setFactoryId(rows[0].id);
      })
      .catch(() => setFactories([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const params = useMemo(() => (from && to && capHours > 0 ? {
    fromMonth: from.month() + 1, fromYear: from.year(),
    toMonth: to.month() + 1, toYear: to.year(),
    groupBy, capHours,
    ...(factoryId ? { factoryId } : {}),
  } : null), [from, to, groupBy, factoryId, capHours]);

  const fetchData = useCallback(async () => {
    if (!params) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getOvertimeAnalysis(params));
    } catch (err) {
      setData(null);
      setError(err?.response?.data?.message || 'The overtime figures could not be built.');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const peakHours = useMemo(
    () => Math.max(...(data?.months || []).map((m) => Number(m.otHours) || 0), 1),
    [data],
  );

  const monthColumns = useMemo(() => [
    { title: 'Period', dataIndex: 'label', key: 'label', width: 105 },
    {
      title: 'Hours', dataIndex: 'otHours', key: 'otHours', width: 200,
      render: (v) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            height: 10, borderRadius: 2, background: token.colorPrimary,
            width: `${((Number(v) || 0) / peakHours) * 100}%`, minWidth: Number(v) ? 2 : 0,
          }} />
          <Text style={{ fontVariantNumeric: 'tabular-nums' }}>{Number(v) || 0}</Text>
        </div>
      ),
    },
    { title: 'People', dataIndex: 'employeesWithOt', key: 'employeesWithOt', width: 90, align: 'right' },
    {
      title: 'Paid hours', dataIndex: 'paidOtHours', key: 'paidOtHours', width: 110, align: 'right',
      render: (v) => (v == null ? <Text type="secondary">not run</Text> : Number(v)),
    },
    {
      title: 'Unpaid', dataIndex: 'unpaidHours', key: 'unpaidHours', width: 100, align: 'right',
      render: (v, r) => (!r.payrollProcessed ? <Text type="secondary">-</Text>
        : Number(v) > 0 ? <Text strong style={{ color: token.colorWarning }}>{Number(v)}</Text>
          : <Text type="secondary">0</Text>),
    },
    {
      title: 'Amount', dataIndex: 'otAmount', key: 'otAmount', width: 120, align: 'right',
      render: (v) => (v == null ? <Text type="secondary">-</Text> : formatRupees(v)),
    },
  ], [peakHours, token]);

  const groupColumns = useMemo(() => [
    { title: GROUPINGS.find((g) => g.value === groupBy)?.label, dataIndex: 'label', key: 'label', ellipsis: true },
    { title: 'Staff', dataIndex: 'employees', key: 'employees', width: 80, align: 'right' },
    { title: 'Worked OT', dataIndex: 'employeesWithOt', key: 'employeesWithOt', width: 105, align: 'right' },
    {
      title: 'Hours', dataIndex: 'otHours', key: 'otHours', width: 95, align: 'right',
      sorter: (a, b) => a.otHours - b.otHours,
    },
    { title: 'On days', dataIndex: 'otDays', key: 'otDays', width: 95, align: 'right' },
    {
      title: 'Avg per worker', dataIndex: 'averageHoursPerWorker', key: 'averageHoursPerWorker',
      width: 130, align: 'right',
      render: (v) => (v == null ? <Text type="secondary">-</Text> : `${v} hrs`),
    },
    {
      title: '', key: 'register', width: 90, align: 'right',
      render: (_, r) => (
        <Button type="link" size="small"
          onClick={() => setRegister({ groupKey: r.key, title: `Overtime — ${r.label}`, overCapOnly: false })}>
          Who
        </Button>
      ),
    },
  ], [groupBy]);

  return (
    <>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="bottom">
          <Col xs={24} sm={12} md={6}>
            <Text type="secondary" style={{ fontSize: 12 }}>Factory</Text>
            <Select name="factory" value={factoryId} onChange={setFactoryId} allowClear
              placeholder="All factories" style={{ width: '100%' }}
              options={factories.map((f) => ({
                value: f.id,
                label: `${f.factoryCode || ''} ${f.factoryName || ''}`.trim(),
              }))} />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Text type="secondary" style={{ fontSize: 12 }}>From</Text>
            <DatePicker name="from" picker="month" value={from} onChange={setFrom}
              format="MMM YYYY" allowClear={false} style={{ width: '100%' }} />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Text type="secondary" style={{ fontSize: 12 }}>To</Text>
            <DatePicker name="to" picker="month" value={to} onChange={setTo}
              format="MMM YYYY" allowClear={false} style={{ width: '100%' }} />
          </Col>
          <Col xs={12} md={5}>
            <Text type="secondary" style={{ fontSize: 12 }}>Break down by</Text>
            <Select name="groupBy" value={groupBy} onChange={setGroupBy}
              options={GROUPINGS} style={{ width: '100%' }} />
          </Col>
          <Col xs={12} md={5}>
            <Text type="secondary" style={{ fontSize: 12 }}>Limit per quarter</Text>
            <InputNumber name="capHours" value={capHours} onChange={setCapHours}
              min={1} max={500} suffix="hrs" style={{ width: '100%' }} />
          </Col>
        </Row>
      </Card>

      {error && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }}
          title="No overtime figures to show" description={error} />
      )}

      <Spin spinning={loading}>
        {data && (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Card size="small">
              <Row gutter={[16, 16]}>
                <Figure label="Overtime hours" value={Number(data.total.otHours) || 0}
                  hint={`over ${data.total.otDays} days`} />
                <Figure label="People who worked it" value={data.total.employeesWithOt}
                  hint={`of ${data.total.employees} employed`} />
                <Figure label="Paid" value={formatRupees(data.total.otAmount)}
                  hint={factoryId ? 'processed runs only' : 'select a factory for amounts'} />
                <Figure label="Over the limit" value={data.employeesOverCap}
                  colour={data.employeesOverCap > 0 ? token.colorWarning : undefined}
                  hint={`${data.capHours} hrs a quarter`} />
              </Row>
            </Card>

            <OvertimeCompliance
              quarters={data.quarters}
              capHours={data.capHours}
              employeesOverCap={data.employeesOverCap}
              onShowBreaches={() => setRegister({
                title: `Over ${data.capHours} hours in a quarter`, overCapOnly: true,
              })}
            />

            {Number(data.unpaidHours) > 0 && (
              <Alert type="warning" showIcon
                title={`${Number(data.unpaidHours)} recorded hours have not been paid`}
                description="Payroll reads attendance when a run is processed, so overtime added or edited
                  afterwards is never picked up. These hours will stay unpaid unless the affected run is
                  reprocessed." />
            )}

            <Card size="small" title="Month by month">
              <Table rowKey="label" columns={monthColumns} dataSource={data.months}
                size="small" scroll={{ x: 730 }} pagination={false} />
            </Card>

            <Card size="small" title={`By ${data.groupByLabel.toLowerCase()}`}
              extra={(
                <Button type="link" size="small"
                  onClick={() => setRegister({ title: 'Everyone who worked overtime', overCapOnly: false })}>
                  Full register
                </Button>
              )}>
              <Table rowKey="key" columns={groupColumns} dataSource={data.groups}
                size="small" scroll={{ x: 720 }} pagination={false}
                locale={{ emptyText: 'No overtime in these periods' }} />
            </Card>
          </Space>
        )}
      </Spin>

      <OvertimeRegisterDrawer
        open={Boolean(register)}
        title={register?.title}
        overCapOnly={Boolean(register?.overCapOnly)}
        params={register ? { ...params, ...(register.groupKey ? { groupKey: register.groupKey } : {}) } : null}
        onClose={() => setRegister(null)}
      />
    </>
  );
};

export default Overtime;
