import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Steps, Button, Card, Select, InputNumber, Table, Row, Col, Statistic, Space, Spin, Result, Alert, Tag, Collapse } from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined, CheckCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { initiatePayrollRun, processPayrollRun, approvePayrollRun, getPayrollRecords, validatePayrollRun } from '../../../services/hr/payrollService';
import { getActiveFactories } from '../../../services/master/factoryService';
import { factoryOptions } from '../../../utils/hrLabels';
import PageHeader from '../../../components/PageHeader';
import SalaryRecordDrawer from './SalaryRecordDrawer';

const MONTH_OPTIONS = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
  { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
  { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' },
];

const formatCurrency = (val) =>
  val != null ? `\u20B9${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-';

const PayrollWizard = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();

  const [current, setCurrent] = useState(0);
  // Clicking a row opens the derivation behind its figures.
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [validation, setValidation] = useState(null);
  const [validating, setValidating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [factories, setFactories] = useState([]);
  const [factoryId, setFactoryId] = useState(undefined);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [runData, setRunData] = useState(null);
  const [records, setRecords] = useState([]);

  useEffect(() => {
    getActiveFactories().then(setFactories).catch(() => message.error('Failed to load factories'));
  }, [message]);

  // Step 1 — Initialize
  const handleInitiate = useCallback(async () => {
    if (!factoryId) { message.warning('Please select a factory'); return; }
    setLoading(true);
    try {
      const result = await initiatePayrollRun({ factoryId, month, year });
      setRunData(result);
      setCurrent(1);
      message.success('Payroll run initiated');

      // Check the inputs straight away. Processing silently skips anyone
      // without a salary structure, so problems are worth surfacing before
      // any numbers are calculated.
      setValidating(true);
      try {
        setValidation(await validatePayrollRun(result.id));
      } catch {
        setValidation(null);
      } finally {
        setValidating(false);
      }
    } catch {
      // axiosInstance already toasts the server's message; adding another here showed two.
    } finally {
      setLoading(false);
    }
  }, [factoryId, month, year, message]);

  // Step 2 — Process
  const handleProcess = useCallback(async () => {
    if (!runData?.id) return;
    if (validation && validation.blockingCount > 0) {
      message.error(`${validation.blockingCount} employee(s) cannot be paid. Resolve the blocking issues first.`);
      return;
    }
    setLoading(true);
    try {
      const result = await processPayrollRun(runData.id);
      setRunData(result);
      const recs = await getPayrollRecords(runData.id);
      setRecords(Array.isArray(recs) ? recs : recs?.content || []);
      setCurrent(2);
      message.success('Salaries processed successfully');
    } catch {
      // axiosInstance already toasts the server's message; adding another here showed two.
    } finally {
      setLoading(false);
    }
  }, [runData, validation, message]);

  // Step 4 — Approve
  const handleApprove = useCallback(async () => {
    if (!runData?.id) return;
    setLoading(true);
    try {
      await approvePayrollRun(runData.id);
      message.success('Payroll approved and finalized');
      navigate(`/hr/payroll/${runData.id}`);
    } catch {
      // axiosInstance already toasts the server's message; adding another here showed two.
    } finally {
      setLoading(false);
    }
  }, [runData, message, navigate]);

  const recordColumns = useMemo(
    () => [
      { title: 'Emp No', dataIndex: 'employeeNo', key: 'employeeNo', width: 100 },
      { title: 'Name', dataIndex: 'employeeName', key: 'employeeName', width: 180 },
      { title: 'Payable Days', dataIndex: 'payableDays', key: 'payableDays', width: 110, align: 'right' },
      // There is no grossSalary on SalaryRecordDTO, so this column was empty on
      // every row. totalEarnings is the figure that belongs beside Deductions
      // and Net, because those three are what reconcile: earnings less
      // deductions is net. earnedGross excludes overtime and would not.
      { title: 'Earnings', dataIndex: 'totalEarnings', key: 'totalEarnings', width: 130, align: 'right', render: formatCurrency },
      { title: 'PF', dataIndex: 'pfEmployee', key: 'pfEmployee', width: 90, align: 'right', render: formatCurrency },
      { title: 'ESI', dataIndex: 'esiEmployee', key: 'esiEmployee', width: 90, align: 'right', render: formatCurrency },
      { title: 'PT', dataIndex: 'professionalTax', key: 'professionalTax', width: 90, align: 'right', render: formatCurrency },
      { title: 'Deductions', dataIndex: 'totalDeductions', key: 'totalDeductions', width: 120, align: 'right', render: formatCurrency },
      { title: 'Net', dataIndex: 'netSalary', key: 'netSalary', width: 120, align: 'right', render: formatCurrency },
    ],
    [],
  );

  const totals = useMemo(() => {
    const sum = (key) => records.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
    return { earnings: sum('totalEarnings'), deductions: sum('totalDeductions'), net: sum('netSalary') };
  }, [records]);

  const steps = [
    { title: 'Select' },
    { title: 'Process' },
    { title: 'Review' },
    { title: 'Approve' },
  ];

  const stepContent = [
    // Step 0 — Select
    <Card key="select" style={{ maxWidth: 500 }}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <div>
          <div style={{ marginBottom: 4, fontWeight: 500 }}>Factory</div>
          <Select
            placeholder="Select factory"
            style={{ width: '100%' }}
            value={factoryId}
            onChange={setFactoryId}
            options={factoryOptions(factories)}
          />
        </div>
        <Row gutter={16}>
          <Col span={12}>
            <div style={{ marginBottom: 4, fontWeight: 500 }}>Month</div>
            <Select style={{ width: '100%' }} value={month} onChange={setMonth} options={MONTH_OPTIONS} />
          </Col>
          <Col span={12}>
            <div style={{ marginBottom: 4, fontWeight: 500 }}>Year</div>
            <InputNumber style={{ width: '100%' }} value={year} onChange={setYear} min={2020} max={2099} />
          </Col>
        </Row>
        <Button type="primary" loading={loading} onClick={handleInitiate} block>
          Initialize Run
        </Button>
      </Space>
    </Card>,

    // Step 1 — Process
    <Card key="process" style={{ maxWidth: 720 }}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Row gutter={16}>
          <Col span={8}><Statistic title="Factory" value={runData?.factoryName || '-'} /></Col>
          <Col span={8}><Statistic title="Employees" value={validation?.totalEmployees ?? 0} /></Col>
          <Col span={8}>
            <Statistic
              title="Would Be Paid"
              value={validation?.payableEmployees ?? 0}
              valueStyle={{ color: validation && validation.blockingCount > 0 ? '#ff4d4f' : '#52c41a' }}
            />
          </Col>
        </Row>

        <Spin spinning={validating}>
          {validation && validation.blockingCount > 0 && (
            <Alert
              type="error"
              showIcon
              message={`${validation.blockingCount} employee(s) cannot be paid`}
              description="Processing skips these employees silently, so they would simply not be paid. Fix them before processing."
            />
          )}
          {validation && validation.blockingCount === 0 && validation.warningCount > 0 && (
            <Alert
              type="warning"
              showIcon
              message={`${validation.warningCount} thing(s) worth checking`}
              description="Processing can continue, but review these first."
            />
          )}
          {validation && validation.blockingCount === 0 && validation.warningCount === 0 && (
            <Alert type="success" showIcon message="All checks passed" />
          )}

          {validation?.issues?.length > 0 && (
            <Collapse
              size="small"
              style={{ marginTop: 12 }}
              items={[{
                key: 'issues',
                label: `Details (${validation.issues.length})`,
                children: (
                  <Table
                    rowKey={(r, i) => `${r.employeeId ?? 'run'}-${r.code}-${i}`}
                    dataSource={validation.issues}
                    size="small"
                    pagination={{ pageSize: 8, showSizeChanger: false }}
                    columns={[
                      {
                        title: '', dataIndex: 'severity', key: 'severity', width: 96,
                        render: (v) => <Tag color={v === 'BLOCKING' ? 'error' : 'warning'}>{v}</Tag>,
                      },
                      { title: 'Emp No', dataIndex: 'employeeNo', key: 'employeeNo', width: 100, render: (v) => v || '—' },
                      { title: 'Employee', dataIndex: 'employeeName', key: 'employeeName', width: 160, ellipsis: true, render: (v) => v || '—' },
                      { title: 'Problem', dataIndex: 'message', key: 'message' },
                    ]}
                  />
                ),
              }]}
            />
          )}
        </Spin>

        <Button
          type="primary"
          loading={loading}
          onClick={handleProcess}
          block
          disabled={validating || (validation && validation.blockingCount > 0)}
          icon={loading ? <LoadingOutlined /> : undefined}
        >
          Process Salaries
        </Button>
      </Space>
    </Card>,

    // Step 2 — Review
    <Card key="review">
      <Table
        rowKey="id"
        dataSource={records}
        columns={recordColumns}
        scroll={{ x: 1000 }}
        pagination={false}
        size="small"
        onRow={(r) => ({
          onClick: () => setSelectedRecord(r),
          style: { cursor: 'pointer' },
        })}
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={3}><strong>Totals</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="right"><strong>{formatCurrency(totals.earnings)}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={4} colSpan={3} />
              <Table.Summary.Cell index={7} align="right"><strong>{formatCurrency(totals.deductions)}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={8} align="right"><strong>{formatCurrency(totals.net)}</strong></Table.Summary.Cell>
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />
    </Card>,

    // Step 3 — Approve
    <Card key="approve" style={{ maxWidth: 600 }}>
      <Row gutter={[16, 16]}>
        <Col span={8}><Statistic title="Total Earnings" value={totals.earnings} precision={2} prefix={'\u20B9'} /></Col>
        <Col span={8}><Statistic title="Total Deductions" value={totals.deductions} precision={2} prefix={'\u20B9'} /></Col>
        <Col span={8}><Statistic title="Total Net" value={totals.net} precision={2} prefix={'\u20B9'} valueStyle={{ color: '#3f8600' }} /></Col>
      </Row>
      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <Button type="primary" size="large" loading={loading} icon={<CheckCircleOutlined />} onClick={handleApprove}>
          Approve &amp; Finalize
        </Button>
      </div>
    </Card>,
  ];

  return (
    <>
      <PageHeader title="New Payroll Run" onBack={() => navigate('/hr/payroll')} />
      <Steps current={current} items={steps} style={{ marginBottom: 24 }} />
      <Spin spinning={loading && current > 0}>
        {stepContent[current]}
      </Spin>

      <SalaryRecordDrawer
        record={selectedRecord}
        open={Boolean(selectedRecord)}
        onClose={() => setSelectedRecord(null)}
      />

      {current > 0 && current < 3 && (
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between' }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => setCurrent((c) => c - 1)}>
            Back
          </Button>
          {current === 2 && (
            <Button type="primary" icon={<ArrowRightOutlined />} onClick={() => setCurrent(3)}>
              Next
            </Button>
          )}
        </div>
      )}
    </>
  );
};

export default PayrollWizard;
