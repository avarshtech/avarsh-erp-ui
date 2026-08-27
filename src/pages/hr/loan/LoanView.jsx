import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Descriptions, Table, Tag, Card, Spin, Button, Modal, Form, InputNumber, DatePicker, Input, Alert } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { getLoanById, getLoanRecoveries, recordLoanRecovery } from '../../../services/hr/loanService';
import { hasPermission } from '../../../utils/permissions';
import { LOAN_STATUS } from '../../../utils/hrConstants';
import PageHeader from '../../../components/PageHeader';

const statusMap = Object.fromEntries(LOAN_STATUS.map((s) => [s.value, s]));

const formatCurrency = (val) =>
  val != null ? `\u20B9${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-';

const LoanView = () => {
  const { message } = App.useApp();
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [loan, setLoan] = useState(null);
  // Recoveries are their own resource. This screen used to read
  // loan.recoveries, which LoanDTO does not carry, so the schedule was
  // empty however many repayments had actually been taken.
  const [recoveries, setRecoveries] = useState([]);
  const [payOpen, setPayOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [payForm] = Form.useForm();

  const canUpdate = hasPermission('hr-loans', 'update');

  const fetchLoan = useCallback(async () => {
    setLoading(true);
    try {
      const [loanResult, recoveryResult] = await Promise.all([
        getLoanById(id),
        getLoanRecoveries(id),
      ]);
      setLoan(loanResult);
      setRecoveries(Array.isArray(recoveryResult) ? recoveryResult : recoveryResult?.content || []);
    } catch {
      setRecoveries([]);
      setLoan(null);
      // axiosInstance already toasts the server's message; adding another here showed two.
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchLoan();
  }, [fetchLoan]);

  const statusInfo = statusMap[loan?.status];

  const recoveryColumns = useMemo(
    () => [
      // There is no installmentNo on LoanRecovery - it was never a column.
      // Recoveries come back oldest first, so the row position is the sequence.
      { title: '#', key: 'seq', width: 60, render: (_, __, idx) => idx + 1 },
      {
        title: 'Date',
        dataIndex: 'recoveryDate',
        key: 'recoveryDate',
        width: 120,
        render: (val) => val ? dayjs(val).format('DD-MMM-YYYY') : '-',
      },
      { title: 'Amount', dataIndex: 'amount', key: 'amount', width: 120, align: 'right', render: formatCurrency },
      { title: 'Balance After', dataIndex: 'balanceAfter', key: 'balanceAfter', width: 130, align: 'right', render: formatCurrency },
      {
        title: 'Source',
        key: 'source',
        width: 110,
        // Distinguishes an automatic payroll deduction from one keyed in here.
        render: (_, r) => (r.payrollRunId
          ? <Tag color="blue">Payroll</Tag>
          : <Tag>Manual</Tag>),
      },
      { title: 'Remarks', dataIndex: 'remarks', key: 'remarks' },
    ],
    [],
  );

  const handleRecordRepayment = useCallback(async () => {
    try {
      const values = await payForm.validateFields();
      setSaving(true);
      await recordLoanRecovery(id, {
        amount: values.amount,
        recoveryDate: values.recoveryDate.format('YYYY-MM-DD'),
        remarks: values.remarks,
      });
      message.success('Repayment recorded');
      setPayOpen(false);
      payForm.resetFields();
      fetchLoan();
    } catch (err) {
      if (err?.errorFields) return;
      // axiosInstance already toasts the server's message; adding another here showed two.
    } finally {
      setSaving(false);
    }
  }, [id, payForm, message, fetchLoan]);

  if (loading) return <Spin style={{ display: 'block', margin: '100px auto' }} />;
  // Returning null here used to be indistinguishable from the crash above it.
  // Say why the page is empty instead.
  if (!loan) {
    return (
      <>
        <PageHeader title="Loan Details" onBack={() => navigate('/hr/loans')} />
        <Alert
          type="error"
          showIcon
          message="This loan could not be loaded"
          description="It may have been deleted, or the server did not respond. Go back to the list and try again."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Loan Details"
        onBack={() => navigate('/hr/loans')}
        extra={statusInfo && <Tag color={statusInfo.color}>{statusInfo.label}</Tag>}
      />
      <Card style={{ marginBottom: 16 }}>
        <Descriptions column={{ xs: 1, sm: 2, md: 3 }} bordered size="small">
          <Descriptions.Item label="Employee">{loan.employeeName || '-'}</Descriptions.Item>
          <Descriptions.Item label="Employee No">{loan.employeeNo || '-'}</Descriptions.Item>
          <Descriptions.Item label="Loan Date">{loan.loanDate ? dayjs(loan.loanDate).format('DD-MMM-YYYY') : '-'}</Descriptions.Item>
          <Descriptions.Item label="Amount">{formatCurrency(loan.amount)}</Descriptions.Item>
          <Descriptions.Item label="EMI">{formatCurrency(loan.emiAmount)}</Descriptions.Item>
          <Descriptions.Item label="Total Installments">{loan.totalInstallments ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="EMI Start Date">{loan.dueStartDate ? dayjs(loan.dueStartDate).format('DD-MMM-YYYY') : '-'}</Descriptions.Item>
          <Descriptions.Item label="Balance">{formatCurrency(loan.balance)}</Descriptions.Item>
          <Descriptions.Item label="Purpose">{loan.purpose || '-'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card
        title="Repayment Schedule"
        extra={loan.status === 'ACTIVE' && canUpdate && (
          <Button type="primary" size="small" onClick={() => setPayOpen(true)}>Record Repayment</Button>
        )}
      >
        {recoveries.length === 0 && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="No repayments yet"
            description="An instalment is recorded automatically when a payroll run covering this loan's EMI start date is approved. Use Record Repayment for anything paid outside payroll - cash, an early settlement, or a correction."
          />
        )}
        <Table
          rowKey={(r, idx) => r.id || idx}
          dataSource={recoveries}
          columns={recoveryColumns}
          pagination={false}
          size="small"
          locale={{ emptyText: 'No recoveries recorded yet' }}
        />
      </Card>

      <Modal
        title="Record Repayment"
        open={payOpen}
        onCancel={() => setPayOpen(false)}
        onOk={handleRecordRepayment}
        confirmLoading={saving}
        okText="Record"
        destroyOnHidden
      >
        <p style={{ color: 'rgba(0,0,0,0.55)', marginTop: 0 }}>
          For repayments made outside payroll. Payroll records its own EMI deductions automatically.
        </p>
        <Descriptions size="small" column={1} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Outstanding">{formatCurrency(loan.balance)}</Descriptions.Item>
        </Descriptions>
        <Form form={payForm} layout="vertical" initialValues={{ recoveryDate: dayjs(), amount: loan.emiAmount }}>
          <Form.Item
            name="amount"
            label="Amount"
            rules={[
              { required: true, message: 'Amount is required' },
              {
                validator: (_, value) => {
                  if (value == null) return Promise.resolve();
                  if (value <= 0) return Promise.reject(new Error('Must be greater than zero'));
                  if (Number(value) > Number(loan.balance)) {
                    return Promise.reject(new Error(`Cannot exceed the outstanding ${formatCurrency(loan.balance)}`));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <InputNumber style={{ width: '100%' }} min={0} prefix={'₹'} />
          </Form.Item>
          <Form.Item name="recoveryDate" label="Date" rules={[{ required: true, message: 'Date is required' }]}>
            <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
          </Form.Item>
          <Form.Item name="remarks" label="Remarks" extra="e.g. cash repayment, early settlement">
            <Input.TextArea rows={2} maxLength={300} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default LoanView;
