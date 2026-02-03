import { useState } from 'react';
import { Card, Row, Col, Typography, Tabs, Table, Button, Space, Tag, Switch, Input, Form, Select, Modal, message, Statistic, Avatar, List, Divider, Badge } from 'antd';
import { SettingOutlined, UserOutlined, TeamOutlined, SafetyOutlined, DatabaseOutlined, BellOutlined, PlusOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined, CloseCircleOutlined, MailOutlined, PhoneOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('users');
  const [userModal, setUserModal] = useState({ open: false, data: null });
  const [form] = Form.useForm();

  const users = [
    { key: '1', name: 'John Doe', email: 'john.doe@garments.com', role: 'Admin', department: 'Management', status: 'Active', lastLogin: '2024-01-28 10:30' },
    { key: '2', name: 'Jane Smith', email: 'jane.smith@garments.com', role: 'Manager', department: 'Production', status: 'Active', lastLogin: '2024-01-28 09:15' },
    { key: '3', name: 'Mike Johnson', email: 'mike.j@garments.com', role: 'Supervisor', department: 'Warehouse', status: 'Active', lastLogin: '2024-01-27 16:45' },
    { key: '4', name: 'Sarah Wilson', email: 'sarah.w@garments.com', role: 'User', department: 'Purchase', status: 'Inactive', lastLogin: '2024-01-20 11:20' },
  ];

  const roles = [
    { key: '1', name: 'Admin', description: 'Full system access', users: 2, permissions: ['All'] },
    { key: '2', name: 'Manager', description: 'Department management access', users: 5, permissions: ['View', 'Create', 'Edit', 'Approve'] },
    { key: '3', name: 'Supervisor', description: 'Team supervision access', users: 8, permissions: ['View', 'Create', 'Edit'] },
    { key: '4', name: 'User', description: 'Basic access', users: 25, permissions: ['View', 'Create'] },
  ];

  const systemStats = [
    { title: 'Total Users', value: 40, icon: <UserOutlined />, color: '#6366f1' },
    { title: 'Active Sessions', value: 12, icon: <CheckCircleOutlined />, color: '#10b981' },
    { title: 'Pending Approvals', value: 8, icon: <BellOutlined />, color: '#f59e0b' },
    { title: 'System Alerts', value: 2, icon: <SafetyOutlined />, color: '#ef4444' },
  ];

  const userColumns = [
    { title: 'User', render: (_, record) => (
      <Space><Avatar style={{ background: '#6366f1' }}>{record.name.charAt(0)}</Avatar><div><Text strong>{record.name}</Text><br /><Text type="secondary" style={{ fontSize: 12 }}>{record.email}</Text></div></Space>
    )},
    { title: 'Role', dataIndex: 'role', render: (role) => <Tag color={role === 'Admin' ? 'purple' : role === 'Manager' ? 'blue' : 'default'}>{role}</Tag> },
    { title: 'Department', dataIndex: 'department' },
    { title: 'Status', dataIndex: 'status', render: (status) => <Badge status={status === 'Active' ? 'success' : 'default'} text={status} /> },
    { title: 'Last Login', dataIndex: 'lastLogin' },
    { title: 'Actions', render: (_, record) => (
      <Space>
        <Button type="text" icon={<EditOutlined />} onClick={() => setUserModal({ open: true, data: record })} />
        <Button type="text" danger icon={<DeleteOutlined />} />
      </Space>
    )},
  ];

  const roleColumns = [
    { title: 'Role Name', dataIndex: 'name', render: (name) => <Text strong>{name}</Text> },
    { title: 'Description', dataIndex: 'description' },
    { title: 'Users', dataIndex: 'users', align: 'center' },
    { title: 'Permissions', dataIndex: 'permissions', render: (perms) => perms.map(p => <Tag key={p} color="blue">{p}</Tag>) },
    { title: 'Actions', render: () => <Space><Button type="text" icon={<EditOutlined />} /><Button type="text" danger icon={<DeleteOutlined />} /></Space> },
  ];

  const tabItems = [
    { key: 'users', label: <span><UserOutlined /> Users</span>, children: (
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Input.Search placeholder="Search users..." style={{ width: 300 }} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setUserModal({ open: true, data: null })}>Add User</Button>
        </div>
        <Table columns={userColumns} dataSource={users} pagination={{ pageSize: 10 }} />
      </Card>
    )},
    { key: 'roles', label: <span><TeamOutlined /> Roles</span>, children: (
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Title level={5} style={{ margin: 0 }}>Role Management</Title>
          <Button type="primary" icon={<PlusOutlined />}>Add Role</Button>
        </div>
        <Table columns={roleColumns} dataSource={roles} pagination={false} />
      </Card>
    )},
    { key: 'settings', label: <span><SettingOutlined /> Settings</span>, children: (
      <Row gutter={24}>
        <Col xs={24} md={12}>
          <Card title="General Settings" style={{ marginBottom: 24 }}>
            <Form layout="vertical">
              <Form.Item label="Company Name"><Input defaultValue="Garments Manufacturing Co." /></Form.Item>
              <Form.Item label="Default Currency"><Select defaultValue="USD" options={[{ value: 'USD', label: 'USD' }, { value: 'EUR', label: 'EUR' }, { value: 'INR', label: 'INR' }]} /></Form.Item>
              <Form.Item label="Fiscal Year Start"><Select defaultValue="april" options={[{ value: 'january', label: 'January' }, { value: 'april', label: 'April' }]} /></Form.Item>
              <Button type="primary">Save Settings</Button>
            </Form>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Notification Settings" style={{ marginBottom: 24 }}>
            <List itemLayout="horizontal" dataSource={[
              { title: 'Email Notifications', desc: 'Receive email for important updates' },
              { title: 'PO Approval Alerts', desc: 'Get notified when POs need approval' },
              { title: 'Low Stock Alerts', desc: 'Alert when inventory is low' },
              { title: 'Daily Summary', desc: 'Receive daily activity summary' },
            ]} renderItem={(item) => <List.Item actions={[<Switch defaultChecked />]}><List.Item.Meta title={item.title} description={item.desc} /></List.Item>} />
          </Card>
        </Col>
      </Row>
    )},
    { key: 'audit', label: <span><DatabaseOutlined /> Audit Log</span>, children: (
      <Card>
        <Table columns={[
          { title: 'Timestamp', dataIndex: 'timestamp', width: 180 },
          { title: 'User', dataIndex: 'user' },
          { title: 'Action', dataIndex: 'action' },
          { title: 'Module', dataIndex: 'module', render: (m) => <Tag>{m}</Tag> },
          { title: 'Details', dataIndex: 'details' },
        ]} dataSource={[
          { key: '1', timestamp: '2024-01-28 10:30:15', user: 'John Doe', action: 'Created', module: 'Purchase Order', details: 'Created PO-2024-0156' },
          { key: '2', timestamp: '2024-01-28 10:25:00', user: 'Jane Smith', action: 'Approved', module: 'GRN', details: 'Approved GRN-2024-0089' },
          { key: '3', timestamp: '2024-01-28 09:45:30', user: 'Mike Johnson', action: 'Updated', module: 'BOM', details: 'Updated BOM-2024-0001' },
        ]} pagination={{ pageSize: 10 }} />
      </Card>
    )},
  ];

  return (
    <div className="animate-fade-in-up">
      <div className="page-header"><h1>Admin Dashboard</h1></div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {systemStats.map((stat, i) => (
          <Col xs={12} sm={6} key={i}>
            <Card hoverable>
              <Space>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: `${stat.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: stat.color, fontSize: 20 }}>{stat.icon}</div>
                <div><Text type="secondary">{stat.title}</Text><Title level={3} style={{ margin: 0, color: stat.color }}>{stat.value}</Title></div>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

      <Modal title={userModal.data ? 'Edit User' : 'Add User'} open={userModal.open} onCancel={() => setUserModal({ open: false, data: null })} onOk={() => { message.success('User saved!'); setUserModal({ open: false, data: null }); }} width={500}>
        <Form form={form} layout="vertical" initialValues={userModal.data || {}}>
          <Form.Item name="name" label="Full Name" rules={[{ required: true }]}><Input prefix={<UserOutlined />} /></Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}><Input prefix={<MailOutlined />} /></Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="role" label="Role" rules={[{ required: true }]}><Select options={roles.map(r => ({ value: r.name, label: r.name }))} /></Form.Item></Col>
            <Col span={12}><Form.Item name="department" label="Department"><Select options={[{ value: 'Management', label: 'Management' }, { value: 'Production', label: 'Production' }, { value: 'Purchase', label: 'Purchase' }, { value: 'Warehouse', label: 'Warehouse' }]} /></Form.Item></Col>
          </Row>
          <Form.Item name="status" label="Status"><Switch checkedChildren="Active" unCheckedChildren="Inactive" defaultChecked /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminDashboard;
