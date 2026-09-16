import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Select, DatePicker, Table, Row, Col, Spin, Alert, Typography, Space, Tooltip, theme } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getSalaryRevisions } from '../../../services/hr/hrAnalyticsService';
import { getActiveFactories } from '../../../services/master/factoryService';
import { formatRupees } from './bridgeFormat';

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;

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
    <Title level={4} style={{ margin: '2px 0 0' }}>{value}</Title>
    {hint && <Text type="secondary" style={{ fontSize: 12 }}>{hint}</Text>}
  </Col>
);

/**
 * What a revision round costs for a full year.
 *
 * The annual figure leads and the monthly one sits under it, deliberately the
 * opposite way round from how a revision gets approved. A round signed off on
 * "two thousand a head" is a very different conversation once it reads as
 * twenty-four thousand a head plus the employer's contributions.
 */
const SalaryRevisions = () => {
  const { token } = theme.useToken();
  const [factories, setFactories] = useState([]);
  const [factoryId, setFactoryId] = useState(undefined);
  const [range, setRange] = useState([dayjs().startOf('year'), dayjs()]);
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
      setData(await getSalaryRevisions(params));
    } catch (err) {
      setData(null);
      setError(err?.response?.data?.message || 'The revision figures could not be built.');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const groupColumns = useMemo(() => [
    { title: GROUPINGS.find((g) => g.value === groupBy)?.label, dataIndex: 'label', key: 'label', ellipsis: true },
    { title: 'Revised', dataIndex: 'employeesRevised', key: 'employeesRevised', width: 90, align: 'right' },
    {
      title: 'Average rise', dataIndex: 'averageIncreasePercent', key: 'averageIncreasePercent',
      width: 120, align: 'right',
      render: (v) => (v == null ? <Text type="secondary">-</Text> : `${v}%`),
    },
    {
      title: 'Monthly', dataIndex: 'monthlyIncrease', key: 'monthlyIncrease',
      width: 130, align: 'right', render: formatRupees,
    },
    {
      title: 'Annual gross', dataIndex: 'annualisedGross', key: 'annualisedGross',
      width: 140, align: 'right', render: formatRupees,
    },
    {
      title: 'Employer PF/ESI', dataIndex: 'annualisedEmployerCost', key: 'annualisedEmployerCost',
      width: 150, align: 'right', render: formatRupees,
    },
    {
      title: 'Annual total', dataIndex: 'annualisedTotal', key: 'annualisedTotal',
      width: 150, align: 'right', fixed: 'right',
      sorter: (a, b) => a.annualisedTotal - b.annualisedTotal,
      render: (v) => <Text strong>{formatRupees(v)}</Text>,
    },
  ], [groupBy]);

  const revisionColumns = useMemo(() => [
    {
      title: 'Employee', key: 'employee', width: 190, ellipsis: true,
      render: (_, r) => (
        <>
          <div>{r.employeeName || '-'}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{r.employeeNo}</Text>
        </>
      ),
    },
    { title: 'Department', dataIndex: 'departmentName', key: 'departmentName', width: 130, ellipsis: true },
    {
      title: 'Effective', dataIndex: 'effectiveFrom', key: 'effectiveFrom', width: 120,
      render: (v) => (v ? dayjs(v).format('DD MMM YYYY') : '-'),
    },
    {
      title: 'Was', dataIndex: 'previousGross', key: 'previousGross',
      width: 115, align: 'right', render: formatRupees,
    },
    {
      title: 'Now', dataIndex: 'newGross', key: 'newGross',
      width: 115, align: 'right', render: formatRupees,
    },
    {
      title: 'Rise', dataIndex: 'increasePercent', key: 'increasePercent',
      width: 90, align: 'right',
      sorter: (a, b) => (a.increasePercent ?? 0) - (b.increasePercent ?? 0),
      render: (v) => (v == null ? '-' : `${v}%`),
    },
    {
      title: 'Annual total', dataIndex: 'annualisedTotal', key: 'annualisedTotal',
      width: 155, align: 'right', fixed: 'right',
      sorter: (a, b) => a.annualisedTotal - b.annualisedTotal,
      render: (v, r) => (
        <span>
          <Text strong>{formatRupees(v)}</Text>
          {r.note && (
            <Tooltip title={r.note}>
              <InfoCircleOutlined style={{ marginLeft: 6, color: token.colorWarning }} />
            </Tooltip>
          )}
        </span>
      ),
    },
  ], [token]);

  return (
    <>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="bottom">
          <Col xs={24} md={9}>
            <Text type="secondary" style={{ fontSize: 12 }}>Revisions effective between</Text>
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
          title="No revisions to show" description={error} />
      )}

      <Spin spinning={loading}>
        {data && (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Card size="small">
              <Row gutter={[16, 16]}>
                <Figure label="People revised" value={data.total.employeesRevised}
                  hint={data.total.averageIncreasePercent != null
                    ? `${data.total.averageIncreasePercent}% average rise` : undefined} />
                <Figure label="Monthly increase" value={formatRupees(data.total.monthlyIncrease)}
                  hint="what the approval note usually says" />
                <Figure label="Employer PF & ESI" value={formatRupees(data.total.annualisedEmployerCost)}
                  hint="over a year, and not optional" />
                <Figure label="Annual cost" value={formatRupees(data.total.annualisedTotal)}
                  hint="what the round really costs" />
              </Row>
            </Card>

            {data.firstTimeStructures > 0 && (
              <Alert type="info" showIcon
                title={`${data.firstTimeStructures} first-time salary structures are excluded`}
                description="They had nothing to revise, so counting them would show a new joiner as an
                  enormous increment." />
            )}

            <Card size="small" title={`By ${data.groupByLabel.toLowerCase()}`}>
              <Table rowKey="key" columns={groupColumns} dataSource={data.groups}
                size="small" scroll={{ x: 900 }} pagination={false}
                locale={{ emptyText: 'No revisions in this period' }} />
            </Card>

            <Card size="small" title="Every revision">
              <Table rowKey="employeeId" columns={revisionColumns} dataSource={data.revisions}
                size="small" scroll={{ x: 920 }}
                pagination={{ pageSize: 25, showSizeChanger: true, showTotal: (t) => `${t} revisions` }}
                locale={{ emptyText: 'No revisions in this period' }} />
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 10 }}>
                The employer share uses each person&apos;s own PF and ESI applicability and the same
                ceilings payroll applies — a raise for somebody already at the PF ceiling adds nothing,
                and one that takes them past the ESI ceiling actually reduces it.
              </Text>
            </Card>
          </Space>
        )}
      </Spin>
    </>
  );
};

export default SalaryRevisions;
