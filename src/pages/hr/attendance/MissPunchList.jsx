import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Tag, Button, Space, Tabs, Drawer, Form, Select, DatePicker, TimePicker, Input } from 'antd';
import { PlusOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { createMissPunch, getMissPunchByStatus, approveMissPunch, rejectMissPunch } from '../../../services/hr/missPunchService';
import { searchEmployees } from '../../../services/hr/employeeService';
import { hasPermission } from '../../../utils/permissions';
import { LEAVE_STATUS, PUNCH_TYPE } from '../../../utils/hrConstants';
import PageHeader from '../../../components/PageHeader';

const statusMap = Object.fromEntries(LEAVE_STATUS.map((s) => [s.value, s]));

const MissPunchList = () => {
  const { message, modal } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [activeTab, setActiveTab] = useState('ALL');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [employees, setEmployees] = useState([]);

  const canAdd = hasPermission('hr-attendance', 'add');
  const canApprove = hasPermission('hr-attendance', 'approve');

  useEffect(() => {
    searchEmployees({ status: 'ACTIVE', size: 500 })
      .then((res) => setEmployees(res.content || []))
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const status = activeTab === 'ALL' ? undefined : activeTab;
      const result = await getMissPunchByStatus(status);
      setData(result || []);
    } catch {
      message.error('Failed to load miss punch requests');
    } finally {
      setLoading(false);
    }
  }, [activeTab, message]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = useCallback(async (id) => {
    try {
      await approveMissPunch(id);
      message.success('Miss punch approved');
      fetchData();
    } catch {
      message.error('Failed to approve');
    }
  }, [fetchData, message]);

  const handleReject = useCallback(async (id) => {
    modal.confirm({
      title: 'Reject Miss Punch Request?',
      content: 'Are you sure you want to reject this request?',
      okText: 'Reject',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await rejectMissPunch(id);
          message.success('Miss punch rejected');
          fetchData();
        } catch {
          message.error('Failed to reject');
        }
      },
    });
  }, [fetchData, message, modal]);

  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const payload = {
        employeeId: values.employeeId,
        date: values.date.format('YYYY-MM-DD'),
        punchType: values.punchType,
        correctedTime: values.correctedTime.format('HH:mm'),
        reason: values.reason,
      };
      await createMissPunch(payload);
      message.success('Miss punch request created');
      setDrawerOpen(false);
      form.resetFields();
      fetchData();
    } catch (err) {
      if (err.errorFields) return;
      message.error('Failed to create miss punch request');
    } finally {
      setSubmitting(false);
    }
  }, [form, message, fetchData]);

  const columns = useMemo(() => [
    { title: 'Emp No', dataIndex: 'employeeNo', key: 'employeeNo', width: 100 },
    { title: 'Employee Name', dataIndex: 'employeeName', key: 'employeeName', width: 180 },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      render: (val) => val ? dayjs(val).format('DD MMM YYYY') : '-',
    },
    {
      title: 'Punch Type',
      dataIndex: 'punchType',
      key: 'punchType',
      width: 90,
      render: (val) => PUNCH_TYPE.find((p) => p.value === val)?.label || val,
    },
    { title: 'Corrected Time', dataIndex: 'correctedTime', key: 'correctedTime', width: 120 },
    { title: 'Reason', dataIndex: 'reason', key: 'reason', width: 200, ellipsis: true },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (val) => {
        const s = statusMap[val];
        return s ? <Tag color={s.color}>{s.label}</Tag> : val;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 140,
      fixed: 'right',
      render: (_, record) => {
        if (record.status !== 'PENDING' || !canApprove) return null;
        return (
          <Space size="small">
            <Button type="link" size="small" icon={<CheckOutlined />} onClick={() => handleApprove(record.id)}>
              Approve
            </Button>
            <Button type="link" size="small" danger icon={<CloseOutlined />} onClick={() => handleReject(record.id)}>
              Reject
            </Button>
          </Space>
        );
      },
    },
  ], [canApprove, handleApprove, handleReject]);

  const tabItems = useMemo(() => [
    { key: 'ALL', label: 'All' },
    { key: 'PENDING', label: 'Pending' },
    { key: 'APPROVED', label: 'Approved' },
    { key: 'REJECTED', label: 'Rejected' },
  ], []);

  return (
    <>
      <PageHeader
        title="Miss Punch Requests"
        extra={
          canAdd && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>
              New Request
            </Button>
          )
        }
      />
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} style={{ marginBottom: 16 }} />
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1100 }}
        size="small"
        pagination={{ pageSize: 25, showSizeChanger: true }}
      />

      <Drawer
        title="New Miss Punch Request"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={480}
        afterOpenChange={(open) => { if (!open) form.resetFields(); }}
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
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
              options={employees.map((e) => ({ value: e.id, label: `${e.employeeNo} - ${e.name}` }))}
            />
          </Form.Item>
          <Form.Item name="date" label="Date" rules={[{ required: true, message: 'Please select a date' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="punchType" label="Punch Type" rules={[{ required: true, message: 'Please select punch type' }]}>
            <Select options={PUNCH_TYPE} placeholder="Select Type" />
          </Form.Item>
          <Form.Item name="correctedTime" label="Corrected Time" rules={[{ required: true, message: 'Please enter corrected time' }]}>
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="reason" label="Reason" rules={[{ required: true, message: 'Please enter a reason' }]}>
            <Input.TextArea rows={3} placeholder="Reason for miss punch" />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  );
};

export default MissPunchList;
