import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Tag, Button, Space, Tabs, Drawer, Form, Select, DatePicker, TimePicker, Input, Descriptions, Alert } from 'antd';
import { PlusOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { createGatePass, getGatePassByStatus, approveGatePass, rejectGatePass } from '../../../services/hr/gatePassService';
import { searchEmployees } from '../../../services/hr/employeeService';
import { hasPermission } from '../../../utils/permissions';
import { LEAVE_STATUS, GATE_PASS_TYPE } from '../../../utils/hrConstants';
import { employeeOptions } from '../../../utils/hrLabels';
import PageHeader from '../../../components/PageHeader';

const statusMap = Object.fromEntries(LEAVE_STATUS.map((s) => [s.value, s]));

const GatePassList = () => {
  const { message, modal } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [activeTab, setActiveTab] = useState('ALL');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [employees, setEmployees] = useState([]);

  // Detail view for a single pass, opened by clicking its row.
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState(null);

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
      const result = await getGatePassByStatus(status);
      setData(result || []);
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to load gate pass requests');
    } finally {
      setLoading(false);
    }
  }, [activeTab, message]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = useCallback(async (id) => {
    try {
      await approveGatePass(id);
      message.success('Gate pass approved');
      setDetailOpen(false);
      fetchData();
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to approve');
    }
  }, [fetchData, message]);

  const openDetail = useCallback((record) => {
    setSelected(record);
    setDetailOpen(true);
  }, []);

  const handleReject = useCallback(async (id) => {
    modal.confirm({
      title: 'Reject Gate Pass?',
      content: 'Are you sure you want to reject this gate pass?',
      okText: 'Reject',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await rejectGatePass(id);
          message.success('Gate pass rejected');
          setDetailOpen(false);
          fetchData();
        } catch (err) {
          message.error(err?.response?.data?.message || 'Failed to reject');
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
        // The API fields are entryDate and entryType. Sending date/type left
        // both null, and entry_date is NOT NULL.
        entryDate: values.date.format('YYYY-MM-DD'),
        entryType: values.type,
        fromTime: values.fromTime.format('HH:mm'),
        toTime: values.toTime.format('HH:mm'),
        reason: values.reason,
        destination: values.destination || null,
      };
      await createGatePass(payload);
      message.success('Gate pass created');
      setDrawerOpen(false);
      form.resetFields();
      fetchData();
    } catch (err) {
      if (err.errorFields) return;
      message.error('Failed to create gate pass');
    } finally {
      setSubmitting(false);
    }
  }, [form, message, fetchData]);

  const columns = useMemo(() => [
    { title: 'Emp No', dataIndex: 'employeeNo', key: 'employeeNo', width: 100 },
    { title: 'Employee Name', dataIndex: 'employeeName', key: 'employeeName', width: 180 },
    {
      title: 'Date',
      dataIndex: 'entryDate',
      key: 'entryDate',
      width: 120,
      render: (val) => val ? dayjs(val).format('DD MMM YYYY') : '-',
    },
    {
      title: 'Type',
      dataIndex: 'entryType',
      key: 'entryType',
      width: 110,
      render: (val) => GATE_PASS_TYPE.find((g) => g.value === val)?.label || val,
    },
    { title: 'From', dataIndex: 'fromTime', key: 'fromTime', width: 90 },
    { title: 'To', dataIndex: 'toTime', key: 'toTime', width: 90 },
    { title: 'Reason', dataIndex: 'reason', key: 'reason', width: 200, ellipsis: true },
    { title: 'Destination', dataIndex: 'destination', key: 'destination', width: 150, ellipsis: true },
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
            <Button type="link" size="small" icon={<CheckOutlined />} onClick={(e) => { e.stopPropagation(); handleApprove(record.id); }}>
              Approve
            </Button>
            <Button type="link" size="small" danger icon={<CloseOutlined />} onClick={(e) => { e.stopPropagation(); handleReject(record.id); }}>
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
        title="Gate Pass"
        extra={
          canAdd && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>
              New Gate Pass
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
        scroll={{ x: 1200 }}
        size="small"
        pagination={{ pageSize: 25, showSizeChanger: true }}
        onRow={(record) => ({
          onClick: () => openDetail(record),
          style: { cursor: 'pointer' },
        })}
      />

      {/* Full detail for one pass, with its available actions. */}
      <Drawer
        title="Gate Pass"
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={460}
        extra={
          selected?.status === 'PENDING' && canApprove && (
            <Space>
              <Button danger icon={<CloseOutlined />} onClick={() => handleReject(selected.id)}>
                Reject
              </Button>
              <Button type="primary" icon={<CheckOutlined />} onClick={() => handleApprove(selected.id)}>
                Approve
              </Button>
            </Space>
          )
        }
      >
        {selected && (
          <>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Status">
                {statusMap[selected.status]
                  ? <Tag color={statusMap[selected.status].color}>{statusMap[selected.status].label}</Tag>
                  : selected.status}
              </Descriptions.Item>
              <Descriptions.Item label="Employee No">{selected.employeeNo || '-'}</Descriptions.Item>
              <Descriptions.Item label="Employee">{selected.employeeName || '-'}</Descriptions.Item>
              <Descriptions.Item label="Date">
                {selected.entryDate ? dayjs(selected.entryDate).format('DD MMM YYYY') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Type">
                {GATE_PASS_TYPE.find((g) => g.value === selected.entryType)?.label || selected.entryType || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="From">{selected.fromTime || '-'}</Descriptions.Item>
              <Descriptions.Item label="To">{selected.toTime || '-'}</Descriptions.Item>
              <Descriptions.Item label="Destination">{selected.destination || '-'}</Descriptions.Item>
              <Descriptions.Item label="Reason">{selected.reason || '-'}</Descriptions.Item>
              <Descriptions.Item label="Raised On">
                {selected.createdAt ? dayjs(selected.createdAt).format('DD MMM YYYY HH:mm') : '-'}
              </Descriptions.Item>
              {selected.status !== 'PENDING' && (
                <Descriptions.Item label="Actioned On">
                  {selected.approvedAt ? dayjs(selected.approvedAt).format('DD MMM YYYY HH:mm') : '-'}
                </Descriptions.Item>
              )}
            </Descriptions>

            {selected.status === 'PENDING' && !canApprove && (
              <Alert
                type="info"
                showIcon
                style={{ marginTop: 16 }}
                message="You do not have permission to approve or reject requests."
              />
            )}
          </>
        )}
      </Drawer>

      <Drawer
        title="New Gate Pass"
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
              options={employeeOptions(employees)}
            />
          </Form.Item>
          <Form.Item name="date" label="Date" rules={[{ required: true, message: 'Please select a date' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="type" label="Type" rules={[{ required: true, message: 'Please select type' }]}>
            <Select options={GATE_PASS_TYPE} placeholder="Select Type" />
          </Form.Item>
          <Form.Item name="fromTime" label="From Time" rules={[{ required: true, message: 'Please enter from time' }]}>
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="toTime" label="To Time" rules={[{ required: true, message: 'Please enter to time' }]}>
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="destination" label="Destination">
            <Input placeholder="Destination (optional)" />
          </Form.Item>
          <Form.Item name="reason" label="Reason" rules={[{ required: true, message: 'Please enter a reason' }]}>
            <Input.TextArea rows={3} placeholder="Reason for gate pass" />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  );
};

export default GatePassList;
