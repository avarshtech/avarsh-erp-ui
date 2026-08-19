import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Tag, Button, Space, Tabs, Drawer, Form, Select, DatePicker, TimePicker, Input, Descriptions, Alert } from 'antd';
import { PlusOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { createMissPunch, getMissPunchByStatus, approveMissPunch, rejectMissPunch } from '../../../services/hr/missPunchService';
import { searchEmployees } from '../../../services/hr/employeeService';
import { hasPermission } from '../../../utils/permissions';
import { LEAVE_STATUS, PUNCH_TYPE } from '../../../utils/hrConstants';
import { employeeOptions } from '../../../utils/hrLabels';
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

  // Detail view for a single request, opened by clicking its row.
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
      const result = await getMissPunchByStatus(status);
      setData(result || []);
    } catch (err) {
      setData([]); // don't leave the previous tab's rows looking like a success
      message.error(err?.response?.data?.message || 'Failed to load miss punch requests');
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
    let reason = '';
    modal.confirm({
      title: 'Reject Miss Punch Request?',
      content: (
        <div>
          <p style={{ marginBottom: 8 }}>The requester will see this reason.</p>
          <Input.TextArea
            rows={3}
            placeholder="Why is this being rejected?"
            onChange={(e) => { reason = e.target.value; }}
          />
        </div>
      ),
      okText: 'Reject',
      okButtonProps: { danger: true },
      onOk: async () => {
        if (!reason.trim()) {
          message.error('A reason is required to reject');
          return Promise.reject(new Error('reason required'));
        }
        try {
          await rejectMissPunch(id, reason.trim());
          message.success('Miss punch rejected');
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
        // The API field is requestDate. Sending `date` left request_date null,
        // which the NOT NULL column rejected.
        requestDate: values.date.format('YYYY-MM-DD'),
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
      dataIndex: 'requestDate',
      key: 'requestDate',
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
          // stopPropagation, otherwise clicking an action also opens the
          // detail drawer behind the confirmation.
          <Space size="small">
            <Button
              type="link" size="small" icon={<CheckOutlined />}
              onClick={(e) => { e.stopPropagation(); handleApprove(record.id); }}
            >
              Approve
            </Button>
            <Button
              type="link" size="small" danger icon={<CloseOutlined />}
              onClick={(e) => { e.stopPropagation(); handleReject(record.id); }}
            >
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
        onRow={(record) => ({
          onClick: () => openDetail(record),
          style: { cursor: 'pointer' },
        })}
      />

      {/* Full detail for one request, with the actions available on it. The
          inline row buttons only appear on pending rows, so without this there
          was no way to read a request's full reason or see who approved it. */}
      <Drawer
        title="Miss Punch Request"
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={460}
        extra={
          selected?.status === 'PENDING' && canApprove && (
            <Space>
              <Button
                danger
                icon={<CloseOutlined />}
                onClick={() => handleReject(selected.id)}
              >
                Reject
              </Button>
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={() => handleApprove(selected.id)}
              >
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
                {selected.requestDate ? dayjs(selected.requestDate).format('DD MMM YYYY') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Punch Type">
                {PUNCH_TYPE.find((p) => p.value === selected.punchType)?.label || selected.punchType || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Corrected Time">{selected.correctedTime || '-'}</Descriptions.Item>
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
              options={employeeOptions(employees)}
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
