import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Tag, Card, Row, Col, Statistic, Button, Modal, Form, DatePicker, Input, Select, Space } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { getPayrollRunById, getPayrollRecords, markPayrollPaid } from '../../../services/hr/payrollService';
import { PAYMENT_MODES } from '../../../utils/hrConstants';
import { hasPermission } from '../../../utils/permissions';
import dayjs from 'dayjs';
import { PAYROLL_STATUS } from '../../../utils/hrConstants';
import PageHeader from '../../../components/PageHeader';

const statusMap = Object.fromEntries(PAYROLL_STATUS.map((s) => [s.value, s]));

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const formatCurrency = (val) =>
  val != null ? `\u20B9${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-';

const PayrollRunView = () => {
  const { message } = App.useApp();
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [run, setRun] = useState(null);
  const [records, setRecords] = useState([]);
  const [payOpen, setPayOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payForm] = Form.useForm();

  const canUpdate = hasPermission('hr-payroll', 'update');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [runResult, recsResult] = await Promise.all([
        getPayrollRunById(id),
        getPayrollRecords(id),
      ]);
      setRun(runResult);
      setRecords(Array.isArray(recsResult) ? recsResult : recsResult?.content || []);
    } catch {
      message.error('Failed to load payroll run');
    } finally {
      setLoading(false);
    }
  }, [id, message]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns = useMemo(
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
      {
        title: 'Slip',
        key: 'slip',
        width: 70,
        fixed: 'right',
        render: (_, r) => (
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/hr/payroll/slip/${r.id}`)}
          />
        ),
      },
    ],
    [navigate],
  );

  const totals = useMemo(() => {
    const sum = (key) => records.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
    return { gross: sum('grossSalary'), deductions: sum('totalDeductions'), net: sum('netSalary') };
  }, [records]);

  const statusInfo = statusMap[run?.status];
  const monthYear = run ? `${MONTH_NAMES[(run.month || 1) - 1]} ${run.year}` : '';

  const handleMarkPaid = useCallback(async () => {
    try {
      const values = await payForm.validateFields();
      setPaying(true);
      await markPayrollPaid(id, {
        paymentDate: values.paymentDate.format('YYYY-MM-DD'),
        reference: values.reference,
        mode: values.mode,
      });
      message.success('Payroll marked as paid');
      setPayOpen(false);
      payForm.resetFields();
      fetchData();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || 'Could not mark this run as paid');
    } finally {
      setPaying(false);
    }
  }, [id, payForm, message, fetchData]);

  return (
    <>
      <PageHeader
        title={`Payroll Run — ${monthYear}`}
        onBack={() => navigate('/hr/payroll')}
        extra={
          <Space>
            {statusInfo && <Tag color={statusInfo.color}>{statusInfo.label}</Tag>}
            {run?.status === 'APPROVED' && canUpdate && (
              <Button type="primary" onClick={() => setPayOpen(true)}>Mark as Paid</Button>
            )}
          </Space>
        }
      />
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="Employees" value={run?.totalEmployees || records.length} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="Total Gross" value={totals.gross} precision={2} prefix={'\u20B9'} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="Total Deductions" value={totals.deductions} precision={2} prefix={'\u20B9'} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="Total Net" value={totals.net} precision={2} prefix={'\u20B9'} valueStyle={{ color: '#3f8600' }} /></Card>
        </Col>
      </Row>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={records}
        columns={columns}
        scroll={{ x: 1100 }}
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
              <Table.Summary.Cell index={9} />
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />

      <Modal
        title="Mark Payroll as Paid"
        open={payOpen}
        onCancel={() => setPayOpen(false)}
        onOk={handleMarkPaid}
        confirmLoading={paying}
        okText="Confirm Payment"
        destroyOnHidden
      >
        <p style={{ color: 'rgba(0,0,0,0.55)', marginTop: 0 }}>
          Records that the money has actually been transferred. A paid run cannot be changed afterwards.
        </p>
        <Form form={payForm} layout="vertical" initialValues={{ paymentDate: dayjs(), mode: 'BANK_TRANSFER' }}>
          <Form.Item name="paymentDate" label="Payment Date" rules={[{ required: true, message: 'Payment date is required' }]}>
            <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
          </Form.Item>
          <Form.Item name="mode" label="Payment Mode" rules={[{ required: true, message: 'Payment mode is required' }]}>
            <Select options={PAYMENT_MODES} />
          </Form.Item>
          <Form.Item name="reference" label="Reference" extra="Bank transaction or cheque number, for reconciliation">
            <Input maxLength={100} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default PayrollRunView;
