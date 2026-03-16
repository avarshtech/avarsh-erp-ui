import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card, Table, Button, Space, Input, Tag, Modal, Form, Select, message,
  Avatar, Badge, Popconfirm, Typography, Row, Col, Tooltip, Drawer, Divider, Switch,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, UserOutlined,
  MailOutlined, PhoneOutlined, ReloadOutlined, KeyOutlined,
  ExclamationCircleOutlined, LockOutlined,
} from '@ant-design/icons';
import { getUsers, createUser, updateUser, deleteUser } from '../../services/userService';
import { adminResetPassword, getCurrentUser } from '../../services/authService';
import { getRoles } from '../../services/roleService';
import PermissionGuard from '../../components/PermissionGuard';
import { isAdminRole } from '../../utils/permissions';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const UserManagement = () => {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [form] = Form.useForm();
  const [formDirty, setFormDirty] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const initialFormValuesRef = useRef(null);

  // Admin password reset modal state
  const [resetPwdModalVisible, setResetPwdModalVisible] = useState(false);
  const [resetPwdUserId, setResetPwdUserId] = useState(null);
  const [resetPwdUserName, setResetPwdUserName] = useState('');
  const [resetPwdForm] = Form.useForm();
  const [resettingPwd, setResettingPwd] = useState(false);

  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role ? isAdminRole(currentUser.role) : false;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getUsers();
      const userData = Array.isArray(response) ? response : (response.content || response.data || []);
      setUsers(userData);
    } catch (error) {
      console.error('Error fetching users:', error);
      message.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRoles = useCallback(async () => {
    try {
      const response = await getRoles();
      const roleData = Array.isArray(response) ? response : (response.content || response.data || []);
      setRoles(roleData);
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, [fetchUsers, fetchRoles]);

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      !searchText ||
      user.name?.toLowerCase().includes(searchText.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchText.toLowerCase()) ||
      user.username?.toLowerCase().includes(searchText.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && user.active !== false) ||
      (statusFilter === 'inactive' && user.active === false);
    return matchesSearch && matchesStatus;
  });

  const openModal = (user = null) => {
    setEditingUser(user);
    if (user) {
      const editValues = {
        name: user.name,
        username: user.username,
        email: user.email,
        phone: user.phone || '',
        roleId: user.roleId || user.role?.id,
        isActive: user.isActive ?? user.active ?? true,
      };
      form.setFieldsValue(editValues);
      initialFormValuesRef.current = { ...editValues };
    } else {
      form.resetFields();
      initialFormValuesRef.current = null;
    }
    setFormDirty(false);
    setModalVisible(true);
  };

  // Check if form values have changed from initial for edit mode
  const checkFormChanged = () => {
    if (!editingUser || !initialFormValuesRef.current) return true;
    const currentValues = form.getFieldsValue();
    const initial = initialFormValuesRef.current;
    return Object.keys(initial).some((key) => {
      const iv = initial[key];
      const cv = currentValues[key];
      if (iv == null && cv == null) return false;
      return String(iv ?? '') !== String(cv ?? '');
    });
  };

  const handleValuesChange = () => {
    if (!editingUser) {
      setFormDirty(true);
      return;
    }
    setFormDirty(checkFormChanged());
  };

  const handleSubmit = async (values) => {
    setSaving(true);
    try {
      // Build clean payload (no department field)
      const payload = {
        name: values.name,
        username: values.username,
        email: values.email,
        phone: values.phone,
        roleId: values.roleId,
        isActive: values.isActive ?? true,
      };
      if (!editingUser && values.password) {
        payload.password = values.password;
      }

      if (editingUser) {
        await updateUser(editingUser.id, { ...payload, version: editingUser.version });
        message.success('User updated successfully');
      } else {
        await createUser(payload);
        message.success('User created successfully');
      }
      setModalVisible(false);
      form.resetFields();
      setFormDirty(false);
      initialFormValuesRef.current = null;
      fetchUsers();
    } catch (error) {
      message.error(error.errorMessage || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const handleModalClose = () => {
    if (formDirty) {
      Modal.confirm({
        title: 'Unsaved Changes',
        icon: <ExclamationCircleOutlined />,
        content: 'You have unsaved changes. Are you sure you want to discard them?',
        okText: 'Discard',
        okType: 'danger',
        cancelText: 'Keep Editing',
        onOk: () => {
          setModalVisible(false);
          form.resetFields();
          setFormDirty(false);
          initialFormValuesRef.current = null;
        },
      });
    } else {
      setModalVisible(false);
      form.resetFields();
      initialFormValuesRef.current = null;
    }
  };

  const handleDelete = async (userId) => {
    setDeletingId(userId);
    try {
      await deleteUser(userId);
      message.success('User deleted successfully');
      fetchUsers();
    } catch (error) {
      message.error(error.errorMessage || 'Failed to delete user');
    } finally {
      setDeletingId(null);
    }
  };

  // Admin Password Reset
  const openResetPwdModal = (userId, userName) => {
    setResetPwdUserId(userId);
    setResetPwdUserName(userName);
    resetPwdForm.resetFields();
    setResetPwdModalVisible(true);
  };

  const handleAdminResetPwd = async (values) => {
    setResettingPwd(true);
    try {
      await adminResetPassword({ userId: resetPwdUserId, newPassword: values.newPassword });
      message.success(`Password reset successfully for ${resetPwdUserName}`);
      setResetPwdModalVisible(false);
      resetPwdForm.resetFields();
    } catch (error) {
      message.error(error.errorMessage || error.response?.data?.message || 'Failed to reset password');
    } finally {
      setResettingPwd(false);
    }
  };

  const viewUserDetails = (user) => { setSelectedUser(user); setDrawerVisible(true); };

  const columns = [
    {
      title: 'User', key: 'user',
      render: (_, record) => (
        <Space>
          <Avatar style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }} icon={<UserOutlined />}>
            {record.name?.charAt(0)?.toUpperCase()}
          </Avatar>
          <div>
            <Text strong style={{ display: 'block' }}>{record.name}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>@{record.username}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Email', dataIndex: 'email', key: 'email',
      render: (email) => <Space><MailOutlined style={{ color: '#8c8c8c' }} /><Text>{email}</Text></Space>,
    },
    {
      title: 'Role', dataIndex: 'role', key: 'role',
      render: (role, record) => {
        const roleName = typeof role === 'object' ? role?.name : (role || record.roleName);
        const colorMap = { admin: 'purple', manager: 'blue', supervisor: 'cyan', approver: 'green', user: 'default' };
        return <Tag color={colorMap[roleName?.toLowerCase()] || 'default'}>{roleName || 'N/A'}</Tag>;
      },
    },
    {
      title: 'Status', dataIndex: 'active', key: 'status', align: 'center',
      render: (active) => <Badge status={active !== false ? 'success' : 'default'} text={active !== false ? 'Active' : 'Inactive'} />,
    },
    {
      title: 'Last Login', dataIndex: 'lastLogin', key: 'lastLogin',
      render: (date) => date ? dayjs(date).format('DD MMM YYYY HH:mm') : 'Never',
    },
    {
      title: 'Actions', key: 'actions', align: 'center', width: 180,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View Details">
            <Button type="text" icon={<UserOutlined />} onClick={() => viewUserDetails(record)} />
          </Tooltip>
          <PermissionGuard module="users" operation="update">
            <Tooltip title="Edit">
              <Button type="text" icon={<EditOutlined />} onClick={() => openModal(record)} />
            </Tooltip>
          </PermissionGuard>
          {isAdmin && (
            <Tooltip title="Reset Password">
              <Button type="text" icon={<LockOutlined />} onClick={() => openResetPwdModal(record.id, record.name)} style={{ color: '#faad14' }} />
            </Tooltip>
          )}
          <PermissionGuard module="users" operation="delete">
            <Popconfirm title="Delete User" description="Are you sure you want to delete this user?" onConfirm={() => handleDelete(record.id)} okText="Yes" cancelText="No" icon={<ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />} okButtonProps={{ danger: true, loading: deletingId === record.id }}>
              <Tooltip title="Delete"><Button type="text" danger icon={<DeleteOutlined />} /></Tooltip>
            </Popconfirm>
          </PermissionGuard>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card>
        <div style={{ marginBottom: 24 }}>
          <Row justify="space-between" align="middle">
            <Col><Title level={4} style={{ margin: 0 }}>User Management</Title><Text type="secondary">Manage user accounts and access</Text></Col>
            <Col><PermissionGuard module="users" operation="add"><Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>Add User</Button></PermissionGuard></Col>
          </Row>
        </div>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={8}><Input placeholder="Search by name, username, or email..." prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />} value={searchText} onChange={(e) => setSearchText(e.target.value)} allowClear /></Col>
          <Col xs={24} sm={8} md={4}><Select style={{ width: '100%' }} value={statusFilter} onChange={setStatusFilter} options={[{ value: 'all', label: 'All Status' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} /></Col>
          <Col><Tooltip title="Refresh"><Button icon={<ReloadOutlined />} onClick={fetchUsers} /></Tooltip></Col>
        </Row>
        <Table columns={columns} dataSource={filteredUsers} rowKey="id" loading={loading} pagination={{ showSizeChanger: true, showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} users` }} />
      </Card>

      {/* Add/Edit Modal */}
      <Modal title={editingUser ? 'Edit User' : 'Add New User'} open={modalVisible} onCancel={handleModalClose} footer={null} width={600}>
        <Form form={form} layout="vertical" onFinish={handleSubmit} onValuesChange={handleValuesChange} initialValues={{ isActive: true }}>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="name" label="Full Name" rules={[{ required: true, message: 'Please enter full name' }]}><Input placeholder="Enter full name" /></Form.Item></Col>
            <Col span={12}><Form.Item name="username" label="Username" rules={[{ required: true, message: 'Please enter username' }, { min: 3, message: 'Username must be at least 3 characters' }]}><Input placeholder="Enter username" /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="email" label="Email" rules={[{ required: true, message: 'Please enter email' }, { type: 'email', message: 'Please enter a valid email' }]}><Input placeholder="Enter email address" /></Form.Item></Col>
            <Col span={12}><Form.Item name="phone" label="Phone"><Input placeholder="Enter phone number" /></Form.Item></Col>
          </Row>
          {!editingUser && (<Form.Item name="password" label="Password" rules={[{ required: true, message: 'Please enter password' }, { min: 6, message: 'Password must be at least 6 characters' }]}><Input.Password placeholder="Enter password" /></Form.Item>)}
          <Row gutter={16}>
            <Col span={12}><Form.Item name="roleId" label="Role" rules={[{ required: true, message: 'Please select a role' }]}><Select placeholder="Select role" options={roles.map(r => ({ value: r.id, label: r.name }))} /></Form.Item></Col>
            <Col span={12}><Form.Item name="isActive" label="Status" valuePropName="checked"><Switch checkedChildren="Active" unCheckedChildren="Inactive" /></Form.Item></Col>
          </Row>
          <div style={{ textAlign: 'right', marginTop: 24 }}>
            <Space>
              <Button onClick={handleModalClose}>Cancel</Button>
              <Button type="primary" htmlType="submit" disabled={editingUser && !formDirty} loading={saving}>{editingUser ? 'Update' : 'Create'}</Button>
            </Space>
          </div>
        </Form>
      </Modal>

      {/* Admin Password Reset Modal */}
      <Modal
        title={<Space><LockOutlined style={{ color: '#faad14' }} /><span>Reset Password - {resetPwdUserName}</span></Space>}
        open={resetPwdModalVisible}
        onCancel={() => { setResetPwdModalVisible(false); resetPwdForm.resetFields(); }}
        footer={null} width={450} destroyOnHidden
      >
        <Form form={resetPwdForm} layout="vertical" onFinish={handleAdminResetPwd} style={{ marginTop: 16 }}>
          <Form.Item name="newPassword" label="New Password" rules={[{ required: true, message: 'Please enter new password' }, { min: 6, message: 'Password must be at least 6 characters' }]}>
            <Input.Password placeholder="Enter new password" prefix={<LockOutlined />} />
          </Form.Item>
          <Form.Item name="confirmPassword" label="Confirm Password" dependencies={['newPassword']} rules={[{ required: true, message: 'Please confirm the password' }, ({ getFieldValue }) => ({ validator(_, value) { if (!value || getFieldValue('newPassword') === value) return Promise.resolve(); return Promise.reject(new Error('Passwords do not match')); } })]}>
            <Input.Password placeholder="Confirm new password" prefix={<LockOutlined />} />
          </Form.Item>
          <div style={{ textAlign: 'right', marginTop: 24 }}>
            <Space>
              <Button onClick={() => { setResetPwdModalVisible(false); resetPwdForm.resetFields(); }}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={resettingPwd} icon={<KeyOutlined />}>Reset Password</Button>
            </Space>
          </div>
        </Form>
      </Modal>

      {/* User Details Drawer */}
      <Drawer title="User Details" placement="right" onClose={() => setDrawerVisible(false)} open={drawerVisible} styles={{ wrapper: { width: 400 } }}>
        {selectedUser && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <Avatar size={80} style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }} icon={<UserOutlined />}>{selectedUser.name?.charAt(0)?.toUpperCase()}</Avatar>
              <Title level={4} style={{ marginTop: 12, marginBottom: 4 }}>{selectedUser.name}</Title>
              <Text type="secondary">@{selectedUser.username}</Text>
            </div>
            <Divider />
            <div style={{ marginBottom: 16 }}><Text type="secondary">Email</Text><div><MailOutlined /> {selectedUser.email}</div></div>
            <div style={{ marginBottom: 16 }}><Text type="secondary">Phone</Text><div><PhoneOutlined /> {selectedUser.phone || 'Not provided'}</div></div>
            <div style={{ marginBottom: 16 }}><Text type="secondary">Role</Text><div><Tag color="blue">{typeof selectedUser.role === 'object' ? selectedUser.role?.name : selectedUser.role || selectedUser.roleName}</Tag></div></div>
            <div style={{ marginBottom: 16 }}><Text type="secondary">Status</Text><div><Badge status={selectedUser.active !== false ? 'success' : 'default'} text={selectedUser.active !== false ? 'Active' : 'Inactive'} /></div></div>
            <div style={{ marginBottom: 16 }}><Text type="secondary">Created</Text><div>{selectedUser.createdAt ? dayjs(selectedUser.createdAt).format('DD MMM YYYY HH:mm') : 'Unknown'}</div></div>
            <Divider />
            <Space direction="vertical" style={{ width: '100%' }}>
              <PermissionGuard module="users" operation="update">
                <Button block icon={<EditOutlined />} onClick={() => { setDrawerVisible(false); openModal(selectedUser); }}>Edit User</Button>
              </PermissionGuard>
              {isAdmin && (
                <Button block icon={<LockOutlined />} onClick={() => openResetPwdModal(selectedUser.id, selectedUser.name)} style={{ borderColor: '#faad14', color: '#faad14' }}>
                  Reset Password
                </Button>
              )}
            </Space>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default UserManagement;
