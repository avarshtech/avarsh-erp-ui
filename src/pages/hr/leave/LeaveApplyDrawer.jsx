import { useState, useEffect, useCallback } from 'react';
import { App, Drawer, Form, Select, DatePicker, Radio, Input, Space, Button, Typography } from 'antd';
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
  const durationType = Form.useWatch('durationType', form) ?? 'SINGLE';
  const isRange = durationType === 'RANGE';
  const selectedEmployeeId = Form.useWatch('employeeId', form);
  const selectedLeaveTypeId = Form.useWatch('leaveTypeId', form);
  const fromDate = Form.useWatch('fromDate', form);
  const toDate = Form.useWatch('toDate', form);
  const leaveDate = Form.useWatch('leaveDate', form);

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
    if (durationType === 'HALF') return leaveDate ? 0.5 : 0;
    if (durationType === 'SINGLE') return leaveDate ? 1 : 0;
    if (!fromDate || !toDate) return 0;
    const diff = toDate.diff(fromDate, 'day') + 1;
    return diff > 0 ? diff : 0;
  }, [durationType, leaveDate, fromDate, toDate]);

  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      // Half and single day collapse to the same date on both ends, so the API
      // contract stays a from/to range regardless of how it was entered.
      const isRangeMode = values.durationType === 'RANGE';
      const single = values.leaveDate?.format('YYYY-MM-DD');

      const payload = {
        employeeId: values.employeeId,
        leaveTypeId: values.leaveTypeId,
        fromDate: isRangeMode ? values.fromDate.format('YYYY-MM-DD') : single,
        toDate: isRangeMode ? values.toDate.format('YYYY-MM-DD') : single,
        isHalfDay: values.durationType === 'HALF',
        halfDayType: values.durationType === 'HALF' ? values.halfDayType : null,
        // days is derived by the server from the dates and the half-day flag.
        // It used to be sent from here and trusted, which put the number that
        // gates the balance check in the browser's hands.
        reason: values.reason,
      };
      await applyLeave(payload);
      message.success('Leave application submitted');
      form.resetFields();
      onSuccess?.();
      onClose?.();
    } catch (err) {
      if (err.errorFields) return;
      // axiosInstance already toasts the server's message; adding another here showed two.
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
      <Form form={form} layout="vertical" initialValues={{ durationType: 'SINGLE' }}>
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
        {/* A half day or single day needs one date, not a range. Asking for
            From and To in those cases made the user enter the same date twice. */}
        <Form.Item name="durationType" label="Duration">
          <Radio.Group
            optionType="button"
            buttonStyle="solid"
            options={[
              { value: 'HALF', label: 'Half Day' },
              { value: 'SINGLE', label: 'One Day' },
              { value: 'RANGE', label: 'Multiple Days' },
            ]}
          />
        </Form.Item>

        {isRange ? (
          <>
            <Form.Item name="fromDate" label="From Date" rules={[{ required: true, message: 'Please select from date' }]}>
              <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
            </Form.Item>
            <Form.Item
              name="toDate"
              label="To Date"
              dependencies={['fromDate']}
              rules={[
                { required: true, message: 'Please select to date' },
                ({ getFieldValue }) => ({
                  validator: (_, value) => {
                    const from = getFieldValue('fromDate');
                    if (!value || !from || !value.isBefore(from, 'day')) return Promise.resolve();
                    return Promise.reject(new Error('To date cannot be before from date'));
                  },
                }),
              ]}
            >
              <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
            </Form.Item>
          </>
        ) : (
          <Form.Item name="leaveDate" label="Leave Date" rules={[{ required: true, message: 'Please select the leave date' }]}>
            <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
          </Form.Item>
        )}

        {durationType === 'HALF' && (
          <Form.Item name="halfDayType" label="Half Day Type" rules={[{ required: true, message: 'Please select half day type' }]}>
            <Select options={HALF_DAY_TYPE} placeholder="Select Half Day Type" />
          </Form.Item>
        )}

        {days > 0 && (
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary">Total Days: </Text>
            <Text strong>{days}</Text>
          </div>
        )}
        <Form.Item name="reason" label="Reason" rules={[{ required: true, message: 'Please enter a reason' }]}>
          <Input.TextArea rows={3} placeholder="Reason for leave" />
        </Form.Item>
      </Form>
    </Drawer>
  );
};

export default LeaveApplyDrawer;
