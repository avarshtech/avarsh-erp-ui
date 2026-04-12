import { useState, useEffect, useCallback } from 'react';
import { App, Drawer, Form, Select, DatePicker, InputNumber, Input, Button, Space } from 'antd';
import dayjs from 'dayjs';
import { createLoan } from '../../../services/hr/loanService';
import { searchEmployees } from '../../../services/hr/employeeService';

const LoanDrawer = ({ open, onClose, onSuccess }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [empLoading, setEmpLoading] = useState(false);

  useEffect(() => {
    if (open) {
      form.resetFields();
      fetchEmployees();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchEmployees = useCallback(async () => {
    setEmpLoading(true);
    try {
      const result = await searchEmployees({ status: 'ACTIVE', size: 1000 });
      setEmployees(result?.content || []);
    } catch {
      message.error('Failed to load employees');
    } finally {
      setEmpLoading(false);
    }
  }, [message]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const payload = {
        ...values,
        loanDate: values.loanDate?.format('YYYY-MM-DD'),
        dueStartDate: values.dueStartDate?.format('YYYY-MM-DD'),
        balance: values.amount,
      };
      await createLoan(payload);
      message.success('Loan created successfully');
      onSuccess?.();
    } catch (err) {
      if (err?.errorFields) return; // validation error
      message.error(err?.response?.data?.message || 'Failed to create loan');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer
      title="New Loan"
      open={open}
      onClose={onClose}
      width={480}
      destroyOnClose
      extra={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" loading={submitting} onClick={handleSubmit}>Save</Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" initialValues={{ loanDate: dayjs() }}>
        <Form.Item name="employeeId" label="Employee" rules={[{ required: true, message: 'Select an employee' }]}>
          <Select
            showSearch
            placeholder="Search employee..."
            loading={empLoading}
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={employees.map((e) => ({
              value: e.id,
              label: `${e.employeeNo} - ${e.firstName} ${e.lastName || ''}`.trim(),
            }))}
          />
        </Form.Item>
        <Form.Item name="loanDate" label="Loan Date" rules={[{ required: true, message: 'Select loan date' }]}>
          <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
        </Form.Item>
        <Form.Item name="amount" label="Loan Amount" rules={[{ required: true, message: 'Enter amount' }]}>
          <InputNumber style={{ width: '100%' }} min={1} prefix={'\u20B9'} formatter={(v) => v ? Number(v).toLocaleString('en-IN') : ''} />
        </Form.Item>
        <Form.Item name="dueStartDate" label="EMI Start Date" rules={[{ required: true, message: 'Select start date' }]}>
          <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
        </Form.Item>
        <Form.Item name="emiAmount" label="EMI Amount" rules={[{ required: true, message: 'Enter EMI amount' }]}>
          <InputNumber style={{ width: '100%' }} min={1} prefix={'\u20B9'} formatter={(v) => v ? Number(v).toLocaleString('en-IN') : ''} />
        </Form.Item>
        <Form.Item name="totalInstallments" label="Total Installments" rules={[{ required: true, message: 'Enter installments' }]}>
          <InputNumber style={{ width: '100%' }} min={1} max={120} />
        </Form.Item>
        <Form.Item name="purpose" label="Purpose">
          <Input.TextArea rows={3} placeholder="Loan purpose (optional)" maxLength={500} showCount />
        </Form.Item>
      </Form>
    </Drawer>
  );
};

export default LoanDrawer;
