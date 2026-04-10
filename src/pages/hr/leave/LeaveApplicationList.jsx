import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Tag, Button, Space, Tabs, Input } from 'antd';
import { PlusOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getLeavesByStatus, approveLeave, rejectLeave } from '../../../services/leaveService';
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

  // Load leave types for the drawer
  useEffect(() => {
    import('../../../services/hrMasterService').then((mod) => {
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
      message.error('Failed to load leave applications');
    } finally {
      setLoading(false);
    }
  }, [activeTab, message]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = useCallback(async (id) => {
    try {
      await approveLeave(id);
      message.success('Leave approved');
      fetchData();
    } catch {
      message.error('Failed to approve leave');
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
          await rejectLeave(id, rejectReason);
          message.success('Leave rejected');
          fetchData();
        } catch {
          message.error('Failed to reject leave');
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
    { title: 'Days', dataIndex: 'totalDays', key: 'totalDays', width: 70, align: 'center' },
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
