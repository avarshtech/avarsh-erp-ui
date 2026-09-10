import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Select, DatePicker, Segmented, Row, Col, Table, Spin, Alert, Typography, Space } from 'antd';
import dayjs from 'dayjs';
import { getCostPerHead } from '../../../services/hr/hrAnalyticsService';
import { getActiveFactories } from '../../../services/master/factoryService';
import { formatRupees, formatSigned } from './bridgeFormat';
import CostPerHeadChart from './CostPerHeadChart';
import CostPerHeadVerdict from './CostPerHeadVerdict';

const { Text } = Typography;

const MEASURES = [
  { value: 'CTC', label: 'Cost to company' },
  { value: 'GROSS', label: 'Gross earnings' },
  { value: 'NET', label: 'Net pay' },
];

/**
 * Cost per head over a run of periods.
 *
 * Defaults to cost to company, because this screen is about what the workforce
 * costs the company rather than what lands in anyone's account.
 */
const CostPerHead = () => {
  const [factories, setFactories] = useState([]);
  const [factoryId, setFactoryId] = useState(undefined);
  const [from, setFrom] = useState(dayjs().subtract(6, 'month'));
  const [to, setTo] = useState(dayjs().subtract(1, 'month'));
  const [measure, setMeasure] = useState('CTC');

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

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

  const params = useMemo(() => (factoryId && from && to ? {
    factoryId,
    fromMonth: from.month() + 1, fromYear: from.year(),
    toMonth: to.month() + 1, toYear: to.year(),
    measure,
  } : null), [factoryId, from, to, measure]);

  const fetchData = useCallback(async () => {
    if (!params) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getCostPerHead(params));
    } catch (err) {
      setData(null);
      setError(err?.response?.data?.message || 'The trend could not be built.');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = useMemo(() => [
    { title: 'Period', dataIndex: 'label', key: 'label', width: 110 },
    {
      title: 'Total', dataIndex: 'totalCost', key: 'totalCost',
      width: 140, align: 'right', render: formatRupees,
    },
    {
      title: 'Paid', dataIndex: 'headcount', key: 'headcount',
      width: 80, align: 'right',
    },
    {
      title: 'Per head', dataIndex: 'costPerHead', key: 'costPerHead',
      width: 130, align: 'right', render: formatRupees,
    },
    {
      title: 'Change', key: 'totalChange', width: 140, align: 'right',
      render: (_, r) => (r.change ? formatSigned(r.change.totalChange) : <Text type="secondary">-</Text>),
    },
    {
      title: 'From people', key: 'volumeEffect', width: 145, align: 'right',
      render: (_, r) => (r.change ? (
        <>
          <div>{formatSigned(r.change.volumeEffect)}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {r.change.headcountChange > 0 ? '+' : ''}{r.change.headcountChange} paid
          </Text>
        </>
      ) : <Text type="secondary">-</Text>),
    },
    {
      title: 'From pay', key: 'rateEffect', width: 145, align: 'right',
      render: (_, r) => (r.change ? (
        <>
          <div>{formatSigned(r.change.rateEffect)}</div>
          {r.change.costPerHeadChange != null && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {formatSigned(r.change.costPerHeadChange)} each
            </Text>
          )}
        </>
      ) : <Text type="secondary">-</Text>),
    },
  ], []);

  return (
    <>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="bottom">
          <Col xs={24} sm={12} md={7}>
            <Text type="secondary" style={{ fontSize: 12 }}>Factory</Text>
            <Select name="factory" value={factoryId} onChange={setFactoryId}
              style={{ width: '100%' }} placeholder="Select factory"
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
          <Col xs={24} md={9}>
            <div><Text type="secondary" style={{ fontSize: 12 }}>Measure</Text></div>
            <Segmented options={MEASURES} value={measure} onChange={setMeasure} />
          </Col>
        </Row>
      </Card>

      {error && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }}
          title="No trend to show" description={error} />
      )}

      <Spin spinning={loading}>
        {data && (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <CostPerHeadVerdict overall={data.overall} measureLabel={data.measureLabel} />

            {data.missingPeriods?.length > 0 && (
              <Alert
                type="info"
                showIcon
                title="Some periods have no processed payroll run"
                description={`${data.missingPeriods.join(', ')}. Comparisons either side of a gap span
                  more than one month, so each row states the two periods it actually compares.`}
              />
            )}

            {data.points?.length > 1 && (
              <Card size="small" title="Headcount and cost per head">
                <CostPerHeadChart points={data.points} />
              </Card>
            )}

            <Card size="small" title="Period by period">
              <Table
                rowKey="label"
                columns={columns}
                dataSource={data.points}
                size="small"
                scroll={{ x: 900 }}
                pagination={false}
                locale={{ emptyText: 'No processed payroll runs in this range' }}
              />
            </Card>
          </Space>
        )}
      </Spin>
    </>
  );
};

export default CostPerHead;
