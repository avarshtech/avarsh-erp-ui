import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Steps, Button, Card, Select, InputNumber, Table, Row, Col, Statistic, Space, Spin, Result } from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined, CheckCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { initiatePayrollRun, processPayrollRun, approvePayrollRun, getPayrollRecords } from '../../../services/hr/payrollService';
import { getActiveFactories } from '../../../services/master/factoryService';
import { factoryOptions } from '../../../utils/hrLabels';
import PageHeader from '../../../components/PageHeader';

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
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to initiate payroll run');
    } finally {
      setLoading(false);
    }
  }, [factoryId, month, year, message]);

  // Step 2 — Process
  const handleProcess = useCallback(async () => {
    if (!runData?.id) return;
    setLoading(true);
    try {
      const result = await processPayrollRun(runData.id);
      setRunData(result);
      const recs = await getPayrollRecords(runData.id);
      setRecords(Array.isArray(recs) ? recs : recs?.content || []);
      setCurrent(2);
      message.success('Salaries processed successfully');
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to process payroll');
    } finally {
      setLoading(false);
    }
  }, [runData, message]);

  // Step 4 — Approve
  const handleApprove = useCallback(async () => {
    if (!runData?.id) return;
    setLoading(true);
    try {
      await approvePayrollRun(runData.id);
      message.success('Payroll approved and finalized');
      navigate(`/hr/payroll/${runData.id}`);
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to approve payroll');
    } finally {
      setLoading(false);
    }
  }, [runData, message, navigate]);

  const recordColumns = useMemo(
    () => [
      { title: 'Emp No', dataIndex: 'employeeNo', key: 'employeeNo', width: 100 },
      { title: 'Name', dataIndex: 'employeeName', key: 'employeeName', width: 180 },
      { title: 'Payable Days', dataIndex: 'payableDays', key: 'payableDays', width: 110, align: 'right' },
      { title: 'Gross', dataIndex: 'grossSalary', key: 'grossSalary', width: 120, align: 'right', render: formatCurrency },
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
    return { gross: sum('grossSalary'), deductions: sum('totalDeductions'), net: sum('netSalary') };
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
    <Card key="process" style={{ maxWidth: 500 }}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Statistic title="Factory" value={runData?.factoryName || '-'} />
        <Statistic title="Employees" value={runData?.totalEmployees || 0} />
        <Button type="primary" loading={loading} onClick={handleProcess} block icon={loading ? <LoadingOutlined /> : undefined}>
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
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={3}><strong>Totals</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="right"><strong>{formatCurrency(totals.gross)}</strong></Table.Summary.Cell>
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
        <Col span={8}><Statistic title="Total Gross" value={totals.gross} precision={2} prefix="\u20B9" /></Col>
        <Col span={8}><Statistic title="Total Deductions" value={totals.deductions} precision={2} prefix="\u20B9" /></Col>
        <Col span={8}><Statistic title="Total Net" value={totals.net} precision={2} prefix="\u20B9" valueStyle={{ color: '#3f8600' }} /></Col>
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
