import { useState, useEffect, useCallback } from 'react';
import { App, Drawer, Form, Select, DatePicker, Switch, Input, Space, Button, Typography } from 'antd';
import dayjs from 'dayjs';
import { applyLeave, getLeaveBalances } from '../../../services/hr/leaveService';
import { searchEmployees } from '../../../services/hr/employeeService';
import { HALF_DAY_TYPE } from '../../../utils/hrConstants';
import { employeeOptions } from '../../../utils/hrLabels';

const { Text } = Typography;

const LeaveApplyDrawer = ({ open, onClose, onSuccess, leaveTypes = [] }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [balances, setBalances] = useState([]);
  const isHalfDay = Form.useWatch('isHalfDay', form);
  const selectedEmployeeId = Form.useWatch('employeeId', form);
  const selectedLeaveTypeId = Form.useWatch('leaveTypeId', form);
  const fromDate = Form.useWatch('fromDate', form);
  const toDate = Form.useWatch('toDate', form);

  useEffect(() => {
    searchEmployees({ status: 'ACTIVE', size: 500 })
      .then((res) => setEmployees(res.content || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedEmployeeId) {
      getLeaveBalances(selectedEmployeeId, dayjs().year())
        .then(setBalances)
        .catch(() => setBalances([]));
    } else {
      setBalances([]);
    }
  }, [selectedEmployeeId]);

  const getSelectedBalance = useCallback(() => {
    if (!selectedLeaveTypeId || !balances.length) return null;
    return balances.find((b) => b.leaveTypeId === selectedLeaveTypeId);
  }, [selectedLeaveTypeId, balances]);

  const calculateDays = useCallback(() => {
    if (!fromDate || !toDate) return 0;
    const diff = toDate.diff(fromDate, 'day') + 1;
    if (diff <= 0) return 0;
    if (isHalfDay) return 0.5;
    return diff;
  }, [fromDate, toDate, isHalfDay]);

  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const payload = {
        employeeId: values.employeeId,
        leaveTypeId: values.leaveTypeId,
        fromDate: values.fromDate.format('YYYY-MM-DD'),
        toDate: values.toDate.format('YYYY-MM-DD'),
        isHalfDay: values.isHalfDay || false,
        halfDayType: values.isHalfDay ? values.halfDayType : null,
        reason: values.reason,
      };
      await applyLeave(payload);
      message.success('Leave application submitted');
      form.resetFields();
      onSuccess?.();
      onClose?.();
    } catch (err) {
      if (err.errorFields) return;
      message.error('Failed to apply leave');
    } finally {
      setSubmitting(false);
    }
  }, [form, message, onSuccess, onClose]);

  const balance = getSelectedBalance();
  const days = calculateDays();

  const leaveTypeOptions = leaveTypes.map((lt) => {
    const bal = balances.find((b) => b.leaveTypeId === lt.id);
    const suffix = bal ? ` (Bal: ${bal.balance})` : '';
    return { value: lt.id, label: `${lt.name}${suffix}` };
  });

  return (
    <Drawer
      title="Apply Leave"
      open={open}
      onClose={onClose}
      width={480}
      afterOpenChange={(isOpen) => { if (!isOpen) form.resetFields(); }}
      extra={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" onClick={handleSubmit} loading={submitting}>Submit</Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical">
        <Form.Item name="employeeId" label="Employee" rules={[{ required: true, message: 'Please select an employee' }]}>
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Select Employee"
            options={employeeOptions(employees)}
          />
        </Form.Item>
        <Form.Item name="leaveTypeId" label="Leave Type" rules={[{ required: true, message: 'Please select leave type' }]}>
          <Select placeholder="Select Leave Type" options={leaveTypeOptions} />
        </Form.Item>
        {balance && (
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary">Available Balance: </Text>
            <Text strong>{balance.balance}</Text>
          </div>
        )}
        <Form.Item name="fromDate" label="From Date" rules={[{ required: true, message: 'Please select from date' }]}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="toDate" label="To Date" rules={[{ required: true, message: 'Please select to date' }]}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        {days > 0 && (
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary">Total Days: </Text>
            <Text strong>{days}</Text>
          </div>
        )}
        <Form.Item name="isHalfDay" label="Half Day" valuePropName="checked">
          <Switch />
        </Form.Item>
        {isHalfDay && (
          <Form.Item name="halfDayType" label="Half Day Type" rules={[{ required: true, message: 'Please select half day type' }]}>
            <Select options={HALF_DAY_TYPE} placeholder="Select Half Day Type" />
          </Form.Item>
        )}
        <Form.Item name="reason" label="Reason" rules={[{ required: true, message: 'Please enter a reason' }]}>
          <Input.TextArea rows={3} placeholder="Reason for leave" />
        </Form.Item>
      </Form>
    </Drawer>
  );
};

export default LeaveApplyDrawer;
