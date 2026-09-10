import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Select, DatePicker, Table, Row, Col, Spin, Alert, Typography, Space, Button, Tag } from 'antd';
import dayjs from 'dayjs';
import { getLeaveLiability } from '../../../services/hr/hrAnalyticsService';
import { getActiveFactories } from '../../../services/master/factoryService';
import { formatRupees } from './bridgeFormat';
import LeaveHolderDrawer from './LeaveHolderDrawer';

const { Text, Title } = Typography;

const GROUPINGS = [
  { value: 'DEPARTMENT', label: 'Department' },
  { value: 'FACTORY', label: 'Factory' },
  { value: 'CATEGORY', label: 'Category' },
  { value: 'DESIGNATION', label: 'Designation' },
  { value: 'GRADE', label: 'Grade' },
];

const Figure = ({ label, value, hint }) => (
  <Col xs={12} md={6}>
    <Text type="secondary" style={{ fontSize: 12 }}>{label}</Text>
    <Title level={4} style={{ margin: '2px 0 0', fontVariantNumeric: 'tabular-nums' }}>{value}</Title>
    {hint && <Text type="secondary" style={{ fontSize: 12 }}>{hint}</Text>}
  </Col>
);

/**
 * What unused leave is worth, and who is holding it.
 *
 * Days and money are shown side by side throughout rather than collapsed into
 * one figure, because leave on a type that cannot be encashed lapses and is
 * worth nothing however much of it somebody has accumulated.
 */
const LeaveLiability = () => {
  const [factories, setFactories] = useState([]);
  const [factoryId, setFactoryId] = useState(undefined);
  const [year, setYear] = useState(dayjs());
  const [groupBy, setGroupBy] = useState('DEPARTMENT');

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [register, setRegister] = useState(null);

  useEffect(() => {
    getActiveFactories()
      .then((list) => setFactories(Array.isArray(list) ? list : list?.content || []))
      .catch(() => setFactories([]));
  }, []);

  const params = useMemo(() => (year ? {
    year: year.year(),
    groupBy,
    ...(factoryId ? { factoryId } : {}),
  } : null), [year, groupBy, factoryId]);

  const fetchData = useCallback(async () => {
    if (!params) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getLeaveLiability(params));
    } catch (err) {
      setData(null);
      setError(err?.response?.data?.message || 'The liability could not be built.');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const groupColumns = useMemo(() => [
    { title: GROUPINGS.find((g) => g.value === groupBy)?.label, dataIndex: 'label', key: 'label', ellipsis: true },
    { title: 'Staff', dataIndex: 'employees', key: 'employees', width: 80, align: 'right' },
    { title: 'Days held', dataIndex: 'balanceDays', key: 'balanceDays', width: 100, align: 'right' },
    { title: 'Encashable', dataIndex: 'encashableDays', key: 'encashableDays', width: 110, align: 'right' },
    {
      title: 'Worth', dataIndex: 'liabilityAmount', key: 'liabilityAmount', width: 130, align: 'right',
      sorter: (a, b) => a.liabilityAmount - b.liabilityAmount,
      render: (v) => <Text strong>{formatRupees(v)}</Text>,
    },
    {
      title: '', key: 'register', width: 100, align: 'right',
      render: (_, r) => (
        <Button type="link" size="small"
          onClick={() => setRegister({ groupKey: r.key, title: `Leave held — ${r.label}` })}>
          Who
        </Button>
      ),
    },
  ], [groupBy]);

  const typeColumns = useMemo(() => [
    {
      title: 'Leave type', key: 'name', ellipsis: true,
      render: (_, r) => (
        <>
          {r.name}{' '}
          {r.encashable
            ? <Tag color="success">encashable</Tag>
            : <Tag>lapses</Tag>}
        </>
      ),
    },
    { title: 'Days held', dataIndex: 'balanceDays', key: 'balanceDays', width: 110, align: 'right' },
    {
      title: 'Worth', dataIndex: 'liabilityAmount', key: 'liabilityAmount', width: 130, align: 'right',
      render: (v, r) => (r.encashable
        ? <Text strong>{formatRupees(v)}</Text>
        : <Text type="secondary">nil</Text>),
    },
    {
      title: '', key: 'register', width: 100, align: 'right',
      render: (_, r) => (
        <Button type="link" size="small"
          onClick={() => setRegister({ leaveTypeId: r.leaveTypeId, title: `${r.name} held` })}>
          Who
        </Button>
      ),
    },
  ], []);

  return (
    <>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="bottom">
          <Col xs={12} md={5}>
            <Text type="secondary" style={{ fontSize: 12 }}>Leave year</Text>
            <DatePicker name="year" picker="year" value={year} onChange={setYear}
              allowClear={false} style={{ width: '100%' }} />
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
          <Col xs={12} md={6}>
            <Text type="secondary" style={{ fontSize: 12 }}>Break down by</Text>
            <Select name="groupBy" value={groupBy} onChange={setGroupBy}
              options={GROUPINGS} style={{ width: '100%' }} />
          </Col>
          <Col xs={12} md={5} style={{ textAlign: 'right' }}>
            <Button onClick={() => setRegister({ title: 'Everyone holding leave' })}>
              Full register
            </Button>
          </Col>
        </Row>
      </Card>

      {error && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }}
          title="No liability to show" description={error} />
      )}

      <Spin spinning={loading}>
        {data && (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Card size="small">
              <Row gutter={[16, 16]}>
                <Figure label="Employees" value={data.total.employees}
                  hint={`as at ${dayjs(data.valuationDate).format('DD MMM YYYY')}`} />
                <Figure label="Days held" value={data.total.balanceDays}
                  hint="all leave types" />
                <Figure label="Encashable days" value={data.total.encashableDays}
                  hint="the rest lapses" />
                <Figure label="Liability" value={formatRupees(data.total.liabilityAmount)}
                  hint="at basic + DA over 26" />
              </Row>
            </Card>

            {data.employeesWithoutSalaryStructure > 0 && (
              <Alert type="warning" showIcon
                title={`${data.employeesWithoutSalaryStructure} employees cannot be valued`}
                description="They have no current salary structure, so their days are counted above but
                  carry no rate. The liability figure is understated by their share." />
            )}

            {data.carryForwardMissing && (
              <Alert type="info" showIcon
                title="Balances are only right within a leave year"
                description="Year-end carry-forward and lapse have not been built, so every opening
                  balance is zero and a balance carried over from last year will not appear here." />
            )}

            <Row gutter={[16, 16]}>
              <Col xs={24} lg={14}>
                <Card size="small" title={`By ${data.groupByLabel.toLowerCase()}`}>
                  <Table rowKey="key" columns={groupColumns} dataSource={data.groups}
                    size="small" scroll={{ x: 640 }} pagination={false}
                    locale={{ emptyText: 'No leave balances for this year' }} />
                </Card>
              </Col>
              <Col xs={24} lg={10}>
                <Card size="small" title="By leave type">
                  <Table rowKey="leaveTypeId" columns={typeColumns} dataSource={data.leaveTypes}
                    size="small" scroll={{ x: 480 }} pagination={false}
                    locale={{ emptyText: 'No leave balances for this year' }} />
                </Card>
              </Col>
            </Row>
          </Space>
        )}
      </Spin>

      <LeaveHolderDrawer
        open={Boolean(register)}
        title={register?.title}
        params={register ? { ...params, ...(register.groupKey ? { groupKey: register.groupKey } : {}),
          ...(register.leaveTypeId ? { leaveTypeId: register.leaveTypeId } : {}) } : null}
        onClose={() => setRegister(null)}
      />
    </>
  );
};

export default LeaveLiability;
