import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Select, Table, Row, Col, Spin, Alert, Typography, Space, Tag } from 'antd';
import { getMyPayslips } from '../../services/hr/essService';
import { rupees, rupeesExact, days } from './essFormat';

const { Text, Title } = Typography;

const Figure = ({ label, value, hint }) => (
  <Col xs={12} md={6}>
    <Text type="secondary" style={{ fontSize: 12 }}>{label}</Text>
    <Title level={4} style={{ margin: '2px 0 0' }}>{value}</Title>
    {hint && <Text type="secondary" style={{ fontSize: 12 }}>{hint}</Text>}
  </Col>
);

/**
 * Every payslip, and the year totalled up.
 *
 * The statutory lines are broken out in the annual summary rather than folded
 * into deductions, because those are the figures somebody is asked to produce
 * - for a loan, a new employer, or a tax return - and hunting for them across
 * twelve payslips is the reason they end up at the HR counter.
 */
const MyPayslips = () => {
  const [year, setYear] = useState(undefined);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getMyPayslips(year ? { year } : {});
      setData(result);
      if (year === undefined && result?.year) setYear(result.year);
    } catch (err) {
      setData(null);
      setError(err?.response?.data?.message || 'Your payslips could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = useMemo(() => [
    { title: 'Month', dataIndex: 'label', key: 'label', width: 140 },
    {
      title: 'Days paid', dataIndex: 'payableDays', key: 'payableDays',
      width: 100, align: 'right', render: days,
    },
    {
      title: 'Not paid', dataIndex: 'lopDays', key: 'lopDays', width: 95, align: 'right',
      render: (v) => (Number(v) > 0 ? <Text type="warning">{days(v)}</Text> : days(v)),
    },
    {
      title: 'Earnings', dataIndex: 'totalEarnings', key: 'totalEarnings',
      width: 125, align: 'right', render: rupees,
    },
    {
      title: 'Deductions', dataIndex: 'totalDeductions', key: 'totalDeductions',
      width: 125, align: 'right', render: rupees,
    },
    {
      title: 'Net pay', dataIndex: 'netSalary', key: 'netSalary',
      width: 130, align: 'right', fixed: 'right',
      render: (v) => <Text strong>{rupeesExact(v)}</Text>,
    },
    {
      title: '', key: 'status', width: 90,
      render: (_, r) => (r.status === 'PAID' ? <Tag color="success">paid</Tag> : <Tag>approved</Tag>),
    },
  ], []);

  return (
    <>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>Year</Text>
        <Select
          name="year"
          value={year}
          onChange={setYear}
          style={{ width: 160, display: 'block' }}
          placeholder="Select year"
          options={(data?.yearsAvailable || []).map((y) => ({ value: y, label: String(y) }))}
        />
      </Card>

      {error && <Alert type="warning" showIcon title="Nothing to show" description={error} />}

      <Spin spinning={loading}>
        {data && (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Card size="small" title={data.year ? `${data.year} in total` : 'Totals'}>
              <Row gutter={[16, 16]}>
                <Figure label="Earned" value={rupees(data.annual.totalEarnings)}
                  hint={`across ${data.annual.monthsPaid} months`} />
                <Figure label="Deducted" value={rupees(data.annual.totalDeductions)} />
                <Figure label="Taken home" value={rupees(data.annual.netSalary)} />
                <Figure label="Overtime" value={`${days(data.annual.otHours)} hrs`} />
              </Row>

              <Row gutter={[16, 16]} style={{ marginTop: 18 }}>
                <Figure label="Provident fund" value={rupees(data.annual.providentFund)} />
                <Figure label="ESI" value={rupees(data.annual.esi)} />
                <Figure label="Professional tax" value={rupees(data.annual.professionalTax)} />
                <Figure label="Income tax" value={rupees(data.annual.incomeTax)} />
              </Row>
            </Card>

            <Card size="small" title="Payslips">
              <Table
                rowKey="label"
                columns={columns}
                dataSource={data.payslips}
                size="small"
                scroll={{ x: 830 }}
                pagination={false}
                locale={{ emptyText: 'No approved payslips for this year' }}
              />
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 10 }}>
                Only months that have been approved appear here. A month still being worked on is
                left out rather than shown with figures that may still change.
              </Text>
            </Card>
          </Space>
        )}
      </Spin>
    </>
  );
};

export default MyPayslips;
