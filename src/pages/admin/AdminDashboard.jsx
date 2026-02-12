import { useState, useEffect, useCallback } from 'react';
import {
  Card, Row, Col, Typography, Table, Button, Space, Tag, Input, message,
  Statistic, Avatar, DatePicker, Select, Tooltip, Empty, Spin, Descriptions
} from 'antd';
import {
  UserOutlined, TeamOutlined, SafetyOutlined, LoginOutlined,
  ReloadOutlined, SearchOutlined, CheckCircleOutlined,
  CloseCircleOutlined, DesktopOutlined, MobileOutlined,
  ClockCircleOutlined, FilterOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { getUsers } from '../../services/userService';
import { getRoles } from '../../services/roleService';
import { getActivityLogsByDateRange } from '../../services/activityLogService';

dayjs.extend(relativeTime);

const { Text } = Typography;
const { RangePicker } = DatePicker;

const ACTION_TYPE_CONFIG = {
  LOGIN: { color: 'green', label: 'Login' },
  LOGIN_FAILED: { color: 'red', label: 'Login Failed' },
  LOGOUT: { color: 'default', label: 'Logout' },
  PASSWORD_RESET: { color: 'orange', label: 'Password Reset' },
  PASSWORD_CHANGE: { color: 'blue', label: 'Password Change' },
  SESSION_EXPIRED: { color: 'volcano', label: 'Session Expired' },
  TOKEN_REFRESH: { color: 'cyan', label: 'Token Refresh' },
  ACCOUNT_LOCKED: { color: 'red', label: 'Account Locked' },
  ACCOUNT_UNLOCKED: { color: 'green', label: 'Account Unlocked' },
};

const AdminDashboard = () => {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [dateRange, setDateRange] = useState([dayjs().subtract(7, 'day'), dayjs()]);
  const [searchText, setSearchText] = useState('');
  const [actionFilter, setActionFilter] = useState(null);

  // Fetch users and roles for stats
  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([getUsers(), getRoles()]);
      const usersData = Array.isArray(usersRes) ? usersRes : (usersRes?.content || usersRes?.data || []);
      const rolesData = Array.isArray(rolesRes) ? rolesRes : (rolesRes?.content || rolesRes?.data || []);
      setUsers(usersData);
      setRoles(rolesData);
    } catch (error) {
      console.error('Error fetching stats:', error);
      message.error('Failed to load dashboard stats');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch activity logs by date range
  const fetchActivityLogs = useCallback(async () => {
    if (!dateRange || dateRange.length !== 2) return;
    setActivityLoading(true);
    try {
      const startDate = dateRange[0].startOf('day').toISOString();
      const endDate = dateRange[1].endOf('day').toISOString();
      const data = await getActivityLogsByDateRange(startDate, endDate);
      const logs = Array.isArray(data) ? data : (data?.content || []);
      setActivityLogs(logs);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      message.error('Failed to load activity logs');
      setActivityLogs([]);
    } finally {
      setActivityLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchActivityLogs();
  }, [fetchActivityLogs]);

  // Computed stats
  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.isActive).length;
  const totalRoles = roles.length;
  const recentLogins = activityLogs.filter((l) => l.actionType === 'LOGIN' && l.isSuccess).length;
  const failedLogins = activityLogs.filter((l) => l.actionType === 'LOGIN_FAILED' || (l.actionType === 'LOGIN' && !l.isSuccess)).length;

  // Filtered logs
  const filteredLogs = activityLogs.filter((log) => {
    const matchesSearch = !searchText ||
      log.username?.toLowerCase().includes(searchText.toLowerCase()) ||
      log.ipAddress?.toLowerCase().includes(searchText.toLowerCase()) ||
      log.browserName?.toLowerCase().includes(searchText.toLowerCase());
    const matchesAction = !actionFilter || log.actionType === actionFilter;
    return matchesSearch && matchesAction;
  });

  const stats = [
    { title: 'Total Users', value: totalUsers, icon: <UserOutlined />, color: '#6366f1', suffix: <Text type="secondary" style={{ fontSize: 13 }}>{activeUsers} active</Text> },
    { title: 'Total Roles', value: totalRoles, icon: <TeamOutlined />, color: '#8b5cf6', suffix: <Text type="secondary" style={{ fontSize: 13 }}>{totalRoles} defined</Text> },
    { title: 'Successful Logins', value: recentLogins, icon: <LoginOutlined />, color: '#10b981', suffix: <Text type="secondary" style={{ fontSize: 13 }}>in selected range</Text> },
    { title: 'Failed Attempts', value: failedLogins, icon: <SafetyOutlined />, color: failedLogins > 0 ? '#ef4444' : '#64748b', suffix: <Text type="secondary" style={{ fontSize: 13 }}>in selected range</Text> },
  ];

  const activityColumns = [
    {
      title: 'Time',
      dataIndex: 'activityTimestamp',
      width: 170,
      sorter: (a, b) => dayjs(a.activityTimestamp).unix() - dayjs(b.activityTimestamp).unix(),
      defaultSortOrder: 'descend',
      render: (val) => val ? (
        <Tooltip title={dayjs(val).format('YYYY-MM-DD HH:mm:ss')}>
          <Space size={4}>
            <ClockCircleOutlined style={{ color: 'var(--text-muted)' }} />
            <Text style={{ fontSize: 13 }}>{dayjs(val).format('DD MMM, HH:mm')}</Text>
          </Space>
        </Tooltip>
      ) : '-',
    },
    {
      title: 'User',
      dataIndex: 'username',
      width: 180,
      render: (username) => (
        <Space>
          <Avatar size="small" style={{ background: '#6366f1' }}>{(username || '?')[0]?.toUpperCase()}</Avatar>
          <Text strong>{username || '-'}</Text>
        </Space>
      ),
    },
    {
      title: 'Action',
      dataIndex: 'actionType',
      width: 160,
      filters: Object.entries(ACTION_TYPE_CONFIG).map(([key, cfg]) => ({ text: cfg.label, value: key })),
      onFilter: (value, record) => record.actionType === value,
      render: (actionType) => {
        const config = ACTION_TYPE_CONFIG[actionType] || { color: 'default', label: actionType };
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'isSuccess',
      width: 100,
      align: 'center',
      filters: [{ text: 'Success', value: true }, { text: 'Failed', value: false }],
      onFilter: (value, record) => record.isSuccess === value,
      render: (isSuccess) => isSuccess
        ? <CheckCircleOutlined style={{ color: '#10b981', fontSize: 16 }} />
        : <CloseCircleOutlined style={{ color: '#ef4444', fontSize: 16 }} />,
    },
    {
      title: 'Device / Browser',
      width: 200,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Space size={4}>
            {record.deviceType?.toLowerCase() === 'mobile'
              ? <MobileOutlined style={{ color: 'var(--text-muted)' }} />
              : <DesktopOutlined style={{ color: 'var(--text-muted)' }} />}
            <Text style={{ fontSize: 13 }}>{record.browserName || '-'}</Text>
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.operatingSystem || '-'}</Text>
        </Space>
      ),
    },
    {
      title: 'IP Address',
      dataIndex: 'ipAddress',
      width: 140,
      render: (ip) => <Text copyable={{ text: ip }} style={{ fontSize: 13 }}>{ip || '-'}</Text>,
    },
    {
      title: 'Location',
      width: 160,
      render: (_, record) => {
        const parts = [record.city, record.country].filter(Boolean);
        return parts.length > 0 ? <Text style={{ fontSize: 13 }}>{parts.join(', ')}</Text> : '-';
      },
    },
    {
      title: 'Details',
      dataIndex: 'failureReason',
      ellipsis: true,
      render: (reason, record) => reason
        ? <Text type="danger" style={{ fontSize: 13 }}>{reason}</Text>
        : record.additionalInfo
          ? <Text type="secondary" style={{ fontSize: 13 }}>{record.additionalInfo}</Text>
          : '-',
    },
  ];

  return (
    <div className="animate-fade-in-up">
      <div className="page-header">
        <h1>Admin Dashboard</h1>
        <Button icon={<ReloadOutlined />} onClick={() => { fetchStats(); fetchActivityLogs(); }}>
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <Spin spinning={loading}>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {stats.map((stat, i) => (
            <Col xs={12} sm={6} key={i}>
              <Card hoverable style={{ borderTop: `3px solid ${stat.color}` }}>
                <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 13 }}>{stat.title}</Text>
                    <div style={{ fontSize: 28, fontWeight: 700, color: stat.color, lineHeight: 1.2, marginTop: 4 }}>
                      {stat.value}
                    </div>
                    {stat.suffix && <div style={{ marginTop: 2 }}>{stat.suffix}</div>}
                  </div>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: `${stat.color}15`, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    color: stat.color, fontSize: 20,
                  }}>
                    {stat.icon}
                  </div>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </Spin>

      {/* Activity Logs */}
      <Card
        title={
          <Space>
            <SafetyOutlined />
            <span>User Activity Log</span>
            <Tag>{filteredLogs.length} records</Tag>
          </Space>
        }
        extra={
          <Space wrap>
            <RangePicker
              value={dateRange}
              onChange={(dates) => setDateRange(dates)}
              allowClear={false}
              presets={[
                { label: 'Today', value: [dayjs(), dayjs()] },
                { label: 'Last 7 Days', value: [dayjs().subtract(7, 'day'), dayjs()] },
                { label: 'Last 30 Days', value: [dayjs().subtract(30, 'day'), dayjs()] },
                { label: 'This Month', value: [dayjs().startOf('month'), dayjs()] },
              ]}
              style={{ minWidth: 240 }}
            />
            <Select
              placeholder="All Actions"
              allowClear
              value={actionFilter}
              onChange={setActionFilter}
              style={{ minWidth: 150 }}
              options={Object.entries(ACTION_TYPE_CONFIG).map(([key, cfg]) => ({
                value: key,
                label: cfg.label,
              }))}
            />
            <Input
              placeholder="Search user, IP..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              style={{ width: 200 }}
            />
          </Space>
        }
      >
        <Table
          columns={activityColumns}
          dataSource={filteredLogs}
          rowKey={(record) => record.id || `${record.userId}-${record.activityTimestamp}`}
          loading={activityLoading}
          pagination={{
            showSizeChanger: true,
            defaultPageSize: 20,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} records`,
          }}
          scroll={{ x: 1100 }}
          size="small"
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No activity logs found for the selected date range"
              />
            ),
          }}
        />
      </Card>
    </div>
  );
};

export default AdminDashboard;
