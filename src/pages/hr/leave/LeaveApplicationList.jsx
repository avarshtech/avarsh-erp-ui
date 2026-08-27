import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Tag, Button, Space, Tabs, Input } from 'antd';
import { PlusOutlined, CheckOutlined, CloseOutlined, StopOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getLeavesByStatus, approveLeave, rejectLeave, cancelLeave } from '../../../services/hr/leaveService';
import { hasPermission } from '../../../utils/permissions';
import { LEAVE_STATUS } from '../../../utils/hrConstants';
import PageHeader from '../../../components/PageHeader';
import LeaveApplyDrawer from './LeaveApplyDrawer';

const statusMap = Object.fromEntries(LEAVE_STATUS.map((s) => [s.value, s]));

const LeaveApplicationList = () => {
  const { message, modal } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [activeTab, setActiveTab] = useState('ALL');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState([]);

  const canAdd = hasPermission('hr-leave', 'add');
  const canApprove = hasPermission('hr-leave', 'approve');
  // hr-leave declares reject as its own operation. Gating the Reject button on
  // approve meant a role granted one but not the other got the wrong buttons.
  const canReject = hasPermission('hr-leave', 'reject');
  const canUpdate = hasPermission('hr-leave', 'update');

  // Load leave types for the drawer
  useEffect(() => {
    import('../../../services/master/hrMasterService').then((mod) => {
      if (mod.getActiveLeaveTypes) {
        mod.getActiveLeaveTypes().then(setLeaveTypes).catch(() => {});
      }
    });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const status = activeTab === 'ALL' ? undefined : activeTab;
      const result = await getLeavesByStatus(status);
      setData(result || []);
    } catch {
      // Clear on failure. Leaving the previous tab's rows on screen made a
      // failed load look like a successful one, which is why switching tabs
      // and back appeared to "fix" it.
      setData([]);
      // axiosInstance already toasts the server's message; adding another here showed two.
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = useCallback(async (id) => {
    try {
      await approveLeave(id);
      message.success('Leave approved');
      fetchData();
    } catch {
      // axiosInstance already toasts the server's message; adding another here showed two.
    }
  }, [fetchData, message]);

  const handleReject = useCallback(async (id) => {
    let rejectReason = '';
    modal.confirm({
      title: 'Reject Leave Application?',
      content: (
        <Input.TextArea
          rows={3}
          placeholder="Enter reason for rejection"
          onChange={(e) => { rejectReason = e.target.value; }}
        />
      ),
      okText: 'Reject',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          if (!rejectReason.trim()) {
            message.error('A reason is required to reject');
            return Promise.reject(new Error('reason required'));
          }
          await rejectLeave(id, rejectReason.trim());
          message.success('Leave rejected');
          fetchData();
        } catch {
          // axiosInstance already toasts the server's message; adding another here showed two.
        }
      },
    });
  }, [fetchData, message, modal]);

  // Cancel withdraws an application. cancelLeave existed in the service layer
  // and the API, but nothing ever called it, so there was no way to reach the
  // Cancelled state from the UI at all.
  const handleCancel = useCallback(async (record) => {
    modal.confirm({
      title: 'Cancel this leave application?',
      content: record.status === 'APPROVED'
        ? 'This leave is already approved. Cancelling returns the days to the employee’s balance.'
        : 'The application will be withdrawn.',
      okText: 'Cancel Leave',
      okButtonProps: { danger: true },
      cancelText: 'Keep',
      onOk: async () => {
        try {
          await cancelLeave(record.id);
          message.success('Leave cancelled');
          fetchData();
        } catch {
          // axiosInstance already toasts the server's message; adding another here showed two.
        }
      },
    });
  }, [fetchData, message, modal]);

  const columns = useMemo(() => [
    { title: 'Emp No', dataIndex: 'employeeNo', key: 'employeeNo', width: 100 },
    { title: 'Employee Name', dataIndex: 'employeeName', key: 'employeeName', width: 180 },
    { title: 'Leave Type', dataIndex: 'leaveTypeName', key: 'leaveTypeName', width: 120 },
    {
      title: 'From',
      dataIndex: 'fromDate',
      key: 'fromDate',
      width: 120,
      render: (val) => val ? dayjs(val).format('DD MMM YYYY') : '-',
    },
    {
      title: 'To',
      dataIndex: 'toDate',
      key: 'toDate',
      width: 120,
      render: (val) => val ? dayjs(val).format('DD MMM YYYY') : '-',
    },
    // The API field is `days`, not `totalDays` - this column was always blank.
    { title: 'Days', dataIndex: 'days', key: 'days', width: 70, align: 'center' },
    {
      title: 'Half Day',
      dataIndex: 'isHalfDay',
      key: 'isHalfDay',
      width: 90,
      render: (val, record) => val ? (record.halfDayType === 'FIRST_HALF' ? '1st Half' : '2nd Half') : '-',
    },
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
        // Cancel stays available on an approved leave that has not started yet,
        // which is the usual reason someone withdraws one.
        const cancellable = record.status === 'PENDING'
          || (record.status === 'APPROVED' && dayjs(record.fromDate).isAfter(dayjs(), 'day'));

        return (
          <Space size="small">
            {record.status === 'PENDING' && canApprove && (
              <Button type="link" size="small" icon={<CheckOutlined />} onClick={() => handleApprove(record.id)}>
                Approve
              </Button>
            )}
            {record.status === 'PENDING' && canReject && (
              <Button type="link" size="small" danger icon={<CloseOutlined />} onClick={() => handleReject(record.id)}>
                Reject
              </Button>
            )}
            {cancellable && canUpdate && (
              <Button type="link" size="small" icon={<StopOutlined />} onClick={() => handleCancel(record)}>
                Cancel
              </Button>
            )}
          </Space>
        );
      },
    },
  ], [canApprove, canReject, canUpdate, handleApprove, handleReject, handleCancel]);

  const tabItems = useMemo(() => [
    { key: 'ALL', label: 'All' },
    { key: 'PENDING', label: 'Pending' },
    { key: 'APPROVED', label: 'Approved' },
    { key: 'REJECTED', label: 'Rejected' },
    { key: 'CANCELLED', label: 'Cancelled' },
  ], []);

  return (
    <>
      <PageHeader
        title="Leave Applications"
        extra={
          canAdd && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>
              Apply Leave
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

      <LeaveApplyDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSuccess={fetchData}
        leaveTypes={leaveTypes}
      />
    </>
  );
};

export default LeaveApplicationList;
