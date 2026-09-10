import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Select, DatePicker, Table, Row, Col, Spin, Alert, Typography, Space, Button } from 'antd';
import dayjs from 'dayjs';
import { getHeadcountMovement } from '../../../services/hr/hrAnalyticsService';
import { getActiveFactories } from '../../../services/master/factoryService';
import HeadcountFlow from './HeadcountFlow';
import HeadcountEmployeeDrawer from './HeadcountEmployeeDrawer';

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

/**
 * How the workforce changed over a date range, and where.
 *
 * A free date range here, unlike the payroll screens: headcount comes from
 * joining and leaving dates rather than payroll runs, so any range is a real
 * question.
 */
const HeadcountMovement = () => {
  const [factories, setFactories] = useState([]);
  const [factoryId, setFactoryId] = useState(undefined);
  const [range, setRange] = useState([dayjs().subtract(2, 'month').startOf('month'), dayjs()]);
  const [groupBy, setGroupBy] = useState('DEPARTMENT');

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [cell, setCell] = useState(null);

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
      setData(await getHeadcountMovement(params));
    } catch (err) {
      setData(null);
      setError(err?.response?.data?.message || 'The movement could not be built.');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCell = useCallback((movement, label, group) => {
    setCell({ movement, label, groupKey: group?.key ?? null, groupLabel: group?.label ?? null });
  }, []);

  const countCell = useCallback((movement, label) => ({
    align: 'right',
    width: 110,
    render: (value, row) => (
      <Button type="link" size="small" style={{ padding: 0, fontVariantNumeric: 'tabular-nums' }}
        onClick={() => openCell(movement, label, row)} disabled={!value}>
        {value}
      </Button>
    ),
  }), [openCell]);

  const columns = useMemo(() => [
    { title: GROUPINGS.find((g) => g.value === groupBy)?.label, dataIndex: 'label', key: 'label', ellipsis: true },
    { title: 'Opening', dataIndex: 'opening', key: 'opening', ...countCell('OPENING', 'Opening headcount') },
    { title: 'Joiners', dataIndex: 'joiners', key: 'joiners', ...countCell('JOINERS', 'Joiners') },
    { title: 'Leavers', dataIndex: 'leavers', key: 'leavers', ...countCell('LEAVERS', 'Leavers') },
    { title: 'Closing', dataIndex: 'closing', key: 'closing', ...countCell('CLOSING', 'Closing headcount') },
    {
      title: 'Net', dataIndex: 'netChange', key: 'netChange', width: 90, align: 'right',
      sorter: (a, b) => a.netChange - b.netChange,
      render: (v) => (
        <Text type={v > 0 ? 'success' : v < 0 ? 'warning' : 'secondary'}>
          {v > 0 ? '+' : ''}{v}
        </Text>
      ),
    },
    {
      title: 'Attrition', dataIndex: 'attritionPercent', key: 'attritionPercent', width: 110, align: 'right',
      sorter: (a, b) => (a.attritionPercent ?? 0) - (b.attritionPercent ?? 0),
      render: (v) => (v == null ? <Text type="secondary">-</Text> : `${v}%`),
    },
  ], [groupBy, countCell]);

  const quality = data && (data.exitsWithoutLeavingDate || data.activeWithLeavingDate
    || data.employeesWithoutJoiningDate);

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
          title="No movement to show" description={error} />
      )}

      <Spin spinning={loading}>
        {data && (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <HeadcountFlow total={data.total} onSelect={(movement, label) => openCell(movement, label)} />

            {quality > 0 && (
              <Alert
                type="warning"
                showIcon
                title="Some records distort these counts"
                description={(
                  <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                    {data.exitsWithoutLeavingDate > 0 && (
                      <li>{data.exitsWithoutLeavingDate} left the company by status but carry no leaving
                        date, so they still count as present.</li>
                    )}
                    {data.activeWithLeavingDate > 0 && (
                      <li>{data.activeWithLeavingDate} have a leaving date but are still marked Active.</li>
                    )}
                    {data.employeesWithoutJoiningDate > 0 && (
                      <li>{data.employeesWithoutJoiningDate} have no joining date, so they cannot be placed
                        in time and appear in none of the figures above.</li>
                    )}
                  </ul>
                )}
              />
            )}

            <Card size="small" title={`By ${data.groupByLabel.toLowerCase()}`}>
              <Table
                rowKey="key"
                columns={columns}
                dataSource={data.groups}
                size="small"
                scroll={{ x: 820 }}
                pagination={false}
                locale={{ emptyText: 'Nobody employed in this period' }}
              />
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 10 }}>
                Employees are grouped by where they sit today. The system keeps no transfer history, so
                somebody who moved department appears under their current one for every period.
              </Text>
            </Card>
          </Space>
        )}
      </Spin>

      <HeadcountEmployeeDrawer cell={cell} params={params} onClose={() => setCell(null)} />
    </>
  );
};

export default HeadcountMovement;
