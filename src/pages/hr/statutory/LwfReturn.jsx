import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card, Row, Col, Select, InputNumber, Button, Table, Statistic, Space, Alert, Tag, Spin, Empty, Typography,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { getLwfReturn } from '../../../services/hr/lwfService';
import { getActiveUnits } from '../../../services/master/unitService';
import { useBranch } from '../../../context/BranchContext';
import { unitOptions } from '../../../utils/hrLabels';
import { hasPermission } from '../../../utils/permissions';
import PageHeader from '../../../components/PageHeader';
import { formatRupees } from '../../../utils/formatters';
import { errorText } from '../../../utils/apiError';

const { Text } = Typography;

/**
 * Why the load failed, in terms the reader can act on.
 *
 * A 404 here does not mean the data is missing - it means the server predates this
 * screen, which is a deployment the reader can chase rather than anything they did
 * wrong. Saying "not found" would send them looking for payroll runs instead.
 */
const reasonFor = (e) => {
  if (e?.response?.status === 404) {
    return {
      title: 'This screen needs a newer server',
      description: 'The Labour Welfare Fund API is not on the server this app is talking to. '
        + 'It arrives when the backend is restarted or redeployed.',
    };
  }
  return {
    title: 'Could not load the fund for that year',
    description: errorText(e, 'The server did not say why.'),
  };
};

const MONTH_NAME = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * The Labour Welfare Fund, a year at a time.
 *
 * Twenty rupees comes out of each member's December wages and the company pays forty
 * alongside it. The forty is the reason this screen exists: it is never deducted from
 * anybody, never part of Cost to Company and never on a payslip, so without somewhere
 * to read it the company would be remitting a figure nothing in the system knew.
 *
 * Every number is payroll's. Nothing is recalculated here, so a revised contribution
 * does not rewrite what an earlier year actually paid.
 */
const LwfReturn = () => {
  const { activeBranchId } = useBranch();
  const canView = hasPermission('hr-statutory', 'view');

  const [units, setUnits] = useState([]);
  const [unitId, setUnitId] = useState(null);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  // Kept on screen rather than toasted away. A failure here is something the
  // reader has to act on - run December's payroll, enter the figures, restart the
  // server - and a message that vanishes after three seconds is not an answer.
  const [failure, setFailure] = useState(null);

  useEffect(() => {
    getActiveUnits(activeBranchId || undefined).then(setUnits).catch(() => setUnits([]));
  }, [activeBranchId]);

  const load = useCallback(async () => {
    if (!unitId) return;
    setLoading(true);
    setFailure(null);
    try {
      setData(await getLwfReturn(unitId, year));
    } catch (e) {
      setData(null);
      setFailure(reasonFor(e));
    } finally {
      setLoading(false);
    }
  }, [unitId, year]);

  const columns = useMemo(() => [
    { title: 'Employee No', dataIndex: 'employeeNo', width: 140 },
    { title: 'Name', dataIndex: 'employeeName' },
    { title: 'Department', dataIndex: 'departmentName', width: 160, render: (v) => v || '—' },
    { title: 'Floor', dataIndex: 'floorName', width: 130, render: (v) => v || '—' },
    {
      title: 'Employee',
      dataIndex: 'employeeShare',
      width: 120,
      align: 'right',
      render: (v) => formatRupees(v),
    },
    {
      title: 'Employer',
      dataIndex: 'employerShare',
      width: 120,
      align: 'right',
      render: (v) => formatRupees(v),
    },
    {
      title: 'Total',
      dataIndex: 'total',
      width: 120,
      align: 'right',
      render: (v) => <strong>{formatRupees(v)}</strong>,
    },
  ], []);

  const month = data?.month ?? data?.deductionMonth;
  const nothingYet = data && data.lines.length === 0;

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Labour Welfare Fund"
        subtitle="What each employee contributed and what the company pays alongside it, for the year"
      />

      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="bottom">
          <Col xs={24} sm={10} md={6}>
            <div style={{ marginBottom: 4 }}><Text type="secondary">Unit</Text></div>
            <Select
              placeholder="Select unit"
              style={{ width: '100%' }}
              value={unitId}
              onChange={setUnitId}
              options={unitOptions(units)}
              showSearch
              optionFilterProp="label"
            />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <div style={{ marginBottom: 4 }}><Text type="secondary">Year</Text></div>
            <InputNumber style={{ width: '100%' }} value={year} onChange={setYear} min={2020} max={2099} />
          </Col>
          <Col xs={12} sm={8} md={6}>
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading} disabled={!unitId || !canView}>
              Load
            </Button>
          </Col>
        </Row>
      </Card>

      <Spin spinning={loading}>
        {failure && (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
            title={failure.title}
            description={failure.description}
          />
        )}

        {data && !data.configured && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            title="The fund is not set up yet"
            description={'No Labour Welfare Fund figures apply to ' + data.year + '. Add the employee '
              + 'and employer contributions and the month they come out in under HR Masters, '
              + 'Statutory Figures - until then payroll deducts nothing.'}
          />
        )}

        {!data && !failure && (
          <Card size="small">
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Choose a unit and a year, then load." />
          </Card>
        )}

        {/* Two ways to contribute nothing, with opposite answers: the month has not
            been run, or it was run before the fund existed and deducted nothing. */}
        {nothingYet && data.configured && !data.payrollRunId && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            title={`Nothing was contributed in ${data.year}`}
            description={`The fund is deducted in ${MONTH_NAME[(data.deductionMonth || 12) - 1]}. `
              + 'It is deducted automatically when that payroll is processed, and appears here.'}
          />
        )}

        {nothingYet && data.configured && data.payrollRunId && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            title={`${MONTH_NAME[(data.deductionMonth || 12) - 1]} ${data.year} was processed, but deducted no fund`}
            description={'That payroll ran before the Labour Welfare Fund was set up, so its records carry '
              + 'nothing for it. Reprocess that run and the deduction will be applied.'}
          />
        )}

        {data && data.lines.length > 0 && (
          <>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Row gutter={[16, 16]}>
                <Col xs={12} sm={8} md={5}>
                  <Statistic title="Contributors" value={data.contributingEmployees} />
                </Col>
                <Col xs={12} sm={8} md={5}>
                  <Statistic title="Employee total" value={data.employeeTotal ?? 0} prefix="₹" precision={2} />
                </Col>
                <Col xs={12} sm={8} md={5}>
                  {/* Paid by the company, not deducted from anyone and not in CTC. */}
                  <Statistic title="Employer total" value={data.employerTotal ?? 0} prefix="₹" precision={2} />
                </Col>
                <Col xs={12} sm={8} md={5}>
                  <Statistic
                    title="Combined total"
                    value={data.combinedTotal ?? 0}
                    prefix="₹"
                    precision={2}
                    styles={{ content: { fontWeight: 600 } }}
                  />
                </Col>
                <Col xs={24} md={4}>
                  <div style={{ marginBottom: 4 }}><Text type="secondary">Deducted in</Text></div>
                  <Space wrap>
                    <Tag>{MONTH_NAME[(month || 12) - 1]} {data.year}</Tag>
                    {/* A draft run is not a figure anyone should be filing. */}
                    {data.payrollStatus && data.payrollStatus !== 'APPROVED' && data.payrollStatus !== 'PAID' && (
                      <Tag color="warning">Payroll {data.payrollStatus.toLowerCase()}</Tag>
                    )}
                  </Space>
                </Col>
              </Row>
            </Card>

            {data.contributingEmployees < data.totalEmployees && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                title={`${data.totalEmployees - data.contributingEmployees} of ${data.totalEmployees} on the payroll contributed nothing`}
                description="Either they are outside the fund on their Statutory tab, or they earned nothing that month."
              />
            )}

            <Card size="small">
              <Table
                columns={columns}
                dataSource={data.lines}
                rowKey="employeeId"
                size="small"
                pagination={false}
                scroll={{ x: 'max-content' }}
              />
            </Card>
          </>
        )}
      </Spin>
    </div>
  );
};

export default LwfReturn;
