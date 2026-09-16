import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Select, DatePicker, Row, Col, Spin, Alert, Typography, Space, Collapse, Table, Tag, theme } from 'antd';
import { CheckCircleOutlined, WarningOutlined, StopOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getPayrollReadiness } from '../../../services/hr/hrAnalyticsService';
import { getActiveFactories } from '../../../services/master/factoryService';

const { Text, Title } = Typography;

const Figure = ({ label, value, colour, hint }) => (
  <Col xs={12} md={6}>
    <Text type="secondary" style={{ fontSize: 12 }}>{label}</Text>
    <Title level={4} style={{ margin: '2px 0 0', color: colour }}>{value}</Title>
    {hint && <Text type="secondary" style={{ fontSize: 12 }}>{hint}</Text>}
  </Col>
);

/**
 * What will break the next payroll run.
 *
 * Grouped by problem rather than by employee, because that is the shape of the
 * work: "forty people have no bank account" is one afternoon's chasing, while
 * the same forty spread through a list sorted by name is forty separate
 * discoveries.
 *
 * These are the run's own checks, asked before the run exists — which is when
 * there is still time to do anything about them.
 */
const PayrollReadiness = () => {
  const { token } = theme.useToken();
  const [factories, setFactories] = useState([]);
  const [factoryId, setFactoryId] = useState(undefined);
  const [month, setMonth] = useState(dayjs());

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

  const params = useMemo(() => (factoryId && month ? {
    factoryId, month: month.month() + 1, year: month.year(),
  } : null), [factoryId, month]);

  const fetchData = useCallback(async () => {
    if (!params) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getPayrollReadiness(params));
    } catch (err) {
      setData(null);
      setError(err?.response?.data?.message || 'Readiness could not be checked.');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const employeeColumns = useMemo(() => [
    { title: 'Employee No', dataIndex: 'employeeNo', key: 'employeeNo', width: 130 },
    { title: 'Name', dataIndex: 'employeeName', key: 'employeeName', width: 200, ellipsis: true },
    { title: 'Detail', dataIndex: 'message', key: 'message', ellipsis: true },
  ], []);

  const panels = useMemo(() => (data?.problems || []).map((p) => {
    const blocking = p.severity === 'BLOCKING';
    return {
      key: p.code,
      label: (
        <Space wrap>
          {blocking
            ? <StopOutlined style={{ color: token.colorError }} />
            : <WarningOutlined style={{ color: token.colorWarning }} />}
          <Text strong>{p.headline}</Text>
          {p.employeeCount > 0 && <Tag>{p.employeeCount} employees</Tag>}
          {blocking && <Tag color="error">stops the run</Tag>}
        </Space>
      ),
      children: p.employees?.length > 0 ? (
        <Table
          rowKey="employeeId"
          columns={employeeColumns}
          dataSource={p.employees}
          size="small"
          scroll={{ x: 620 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} employees` }}
        />
      ) : (
        <Text type="secondary">
          This one is about the period rather than any one person, so there is nobody to list.
        </Text>
      ),
    };
  }), [data, employeeColumns, token]);

  return (
    <>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="bottom">
          <Col xs={24} md={12}>
            <Text type="secondary" style={{ fontSize: 12 }}>Factory</Text>
            <Select name="factory" value={factoryId} onChange={setFactoryId}
              style={{ width: '100%' }} placeholder="Select factory"
              options={factories.map((f) => ({
                value: f.id,
                label: `${f.factoryCode || ''} ${f.factoryName || ''}`.trim(),
              }))} />
          </Col>
          <Col xs={24} md={8}>
            <Text type="secondary" style={{ fontSize: 12 }}>Period to check</Text>
            <DatePicker name="month" picker="month" value={month} onChange={setMonth}
              format="MMM YYYY" allowClear={false} style={{ width: '100%' }} />
          </Col>
        </Row>
      </Card>

      {error && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }}
          title="Nothing to check" description={error} />
      )}

      <Spin spinning={loading}>
        {data && (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Card size="small">
              <Row gutter={[16, 16]}>
                <Figure label="Employees" value={data.totalEmployees} hint="active this period" />
                <Figure label="Would be paid" value={data.payableEmployees}
                  hint={data.totalEmployees > data.payableEmployees
                    ? `${data.totalEmployees - data.payableEmployees} would be skipped` : 'everybody'} />
                <Figure label="Blocking" value={data.blockingCount}
                  colour={data.blockingCount > 0 ? token.colorError : undefined} />
                <Figure label="Warnings" value={data.warningCount}
                  colour={data.warningCount > 0 ? token.colorWarning : undefined} />
              </Row>
            </Card>

            {data.ready ? (
              <Alert type="success" showIcon icon={<CheckCircleOutlined />}
                title="Nothing is stopping this run"
                description={data.warningCount > 0
                  ? 'There are warnings below. None of them stop the run, but each one makes the result worse for somebody.'
                  : 'No problems found for this period.'} />
            ) : (
              <Alert type="error" showIcon
                title={`${data.blockingCount} problems would stop this run`}
                description="An employee with a blocking problem is skipped by payroll and simply not
                  paid. Clear these before processing." />
            )}

            {panels.length > 0 && (
              <Card size="small" title="Problems, grouped by what needs doing">
                <Collapse items={panels} />
              </Card>
            )}
          </Space>
        )}
      </Spin>
    </>
  );
};

export default PayrollReadiness;
