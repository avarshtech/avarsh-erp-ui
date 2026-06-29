import { useState, useEffect, useCallback, useRef } from 'react';
import {
  App, Card, Table, Space, Input, Tag, Modal, Form, Select,
  Avatar, Typography, Row, Col, Drawer, Divider, Switch,
} from 'antd';
import {
  SearchOutlined, UserOutlined,
  MailOutlined, PhoneOutlined, KeyOutlined,
  ExclamationCircleOutlined, LockOutlined,
} from '@ant-design/icons';
import { getUsers, createUser, updateUser, deleteUser } from '../../services/admin/userService';
import { adminResetPassword, getCurrentUser } from '../../services/auth/authService';
import { getRoles } from '../../services/admin/roleService';
import PermissionGuard from '../../components/PermissionGuard';
import { isAdminRole } from '../../utils/permissions';
import { ActionButton, DeleteConfirm } from '../../components/buttons';
import StatusBadge from '../../components/StatusBadge';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import { formatDate } from '../../utils/formatters';
import { getTablePagination } from '../../utils/paginationConfig';
import { MODAL_WIDTHS } from '../../utils/uiConstants';
const { Text } = Typography;

const UserManagement = () => {
  const { message, modal } = App.useApp();
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
  const usernameManuallyEditedRef = useRef(false);

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
      (statusFilter === 'active' && user.isActive !== false) ||
      (statusFilter === 'inactive' && user.isActive === false);
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
        isActive: user.isActive ?? true,
      };
      form.setFieldsValue(editValues);
      initialFormValuesRef.current = { ...editValues };
    } else {
      form.resetFields();
      initialFormValuesRef.current = null;
    }
    setFormDirty(false);
    usernameManuallyEditedRef.current = false;
    setModalVisible(true);
  };

  const sanitizeUsername = (value) =>
    value.toLowerCase().replace(/[^a-z0-9_.]/g, '');

  const generateUsername = (fullName) =>
    sanitizeUsername(fullName.trim().replace(/\s+/g, ''));

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

  const handleValuesChange = (changedValues) => {
    if (!editingUser) {
      // Auto-generate username from name when in add mode
      if ('name' in changedValues && !usernameManuallyEditedRef.current) {
        const generated = generateUsername(changedValues.name || '');
        form.setFieldValue('username', generated);
      }
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
      fetchUsers();
    } catch (error) {
      message.error(error.errorMessage || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const handleModalClose = () => {
    if (formDirty) {
      modal.confirm({
        title: 'Unsaved Changes',
        icon: <ExclamationCircleOutlined />,
        content: 'You have unsaved changes. Are you sure you want to discard them?',
        okText: 'Discard',
        okType: 'danger',
        cancelText: 'Keep Editing',
        onOk: () => setModalVisible(false),
      });
    } else {
      setModalVisible(false);
    }
  };

  const handleModalAfterClose = () => {
    form.resetFields();
    setFormDirty(false);
    initialFormValuesRef.current = null;
    usernameManuallyEditedRef.current = false;
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
      title: 'User', key: 'user', fixed: 'left', width: 200,
      render: (_, record) => (
        <Space>
          <Avatar style={{ background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--primary-hover) 100%)' }} icon={<UserOutlined />}>
            {record.name?.charAt(0)?.toUpperCase()}
          </Avatar>
          <div>
            <Text strong style={{ display: 'block', whiteSpace: 'nowrap' }}>{record.name}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>@{record.username}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Email', dataIndex: 'email', key: 'email', width: 220, ellipsis: true,
      render: (email) => <Space><MailOutlined style={{ color: 'var(--text-muted)' }} /><Text>{email}</Text></Space>,
    },
    {
      title: 'Role', dataIndex: 'role', key: 'role', width: 130,
      render: (role, record) => {
        const roleName = typeof role === 'object' ? role?.name : (role || record.roleName);
        const colorMap = { admin: 'purple', manager: 'blue', supervisor: 'cyan', approver: 'green', user: 'default' };
        return <Tag color={colorMap[roleName?.toLowerCase()] || 'default'}>{roleName || 'N/A'}</Tag>;
      },
    },
    {
      title: 'Status', dataIndex: 'isActive', key: 'status', align: 'center', width: 90,
      render: (isActive) => <StatusBadge status={isActive !== false ? 'active' : 'inactive'} />,
    },
    {
      title: 'Last Login', dataIndex: 'lastLoginAt', key: 'lastLoginAt', width: 200,
      render: (date) => date ? formatDate(date, 'DD MMM YYYY HH:mm') : 'Never',
    },
    {
      title: 'Actions', key: 'actions', align: 'center', width: 150, fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <ActionButton action="view" size="small" onClick={() => viewUserDetails(record)} />
          <PermissionGuard module="users" operation="update">
            <ActionButton action="edit" size="small" onClick={() => openModal(record)} />
          </PermissionGuard>
          {isAdmin && (
            <ActionButton
              action="custom"
              icon={<LockOutlined />}
              color="var(--btn-history-color)"
              tooltip="Reset Password"
              size="small"
              onClick={() => openResetPwdModal(record.id, record.name)}
            />
          )}
          <PermissionGuard module="users" operation="delete">
            <DeleteConfirm
              title="Delete User"
              recordLabel={record.name}
              onConfirm={() => handleDelete(record.id)}
              loading={deletingId === record.id}
            >
              <ActionButton action="delete" size="small" />
            </DeleteConfirm>
          </PermissionGuard>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card>
        <PageHeader title="User Management" subtitle="Manage user accounts and access">
          <PermissionGuard module="users" operation="add">
            <ActionButton action="create" text="Add User" onClick={() => openModal()} />
          </PermissionGuard>
        </PageHeader>
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }} align="middle">
          <Col xs={24} sm={12} md={8}><Input placeholder="Search by name, username, or email..." prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />} value={searchText} onChange={(e) => setSearchText(e.target.value)} allowClear /></Col>
          <Col xs={24} sm={12} md={6} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Select style={{ flex: 1 }} value={statusFilter} onChange={setStatusFilter} options={[{ value: 'all', label: 'All Status' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
            <ActionButton action="refresh" tooltip="Refresh" size="middle" onClick={fetchUsers} />
          </Col>
        </Row>
        <Table
          columns={columns}
          dataSource={filteredUsers}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1000 }}
          pagination={getTablePagination(undefined, 'users')}
          locale={{
            emptyText: <EmptyState description="No users found" />,
          }}
        />
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        title={editingUser ? 'Edit User' : 'Add New User'}
        open={modalVisible}
        onCancel={handleModalClose}
        afterClose={handleModalAfterClose}
        width={MODAL_WIDTHS.MEDIUM}
        centered
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto', overflowX: 'hidden' } }}
        footer={
          <div style={{ textAlign: 'right' }}>
            <Space>
              <ActionButton action="cancel" text="Cancel" onClick={handleModalClose} />
              <ActionButton action="save" text={editingUser ? 'Update' : 'Create'} onClick={() => form.submit()} disabled={editingUser && !formDirty} loading={saving} />
            </Space>
          </div>
        }
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} onValuesChange={handleValuesChange} initialValues={{ isActive: true }}>
          <Row gutter={16}>
            <Col xs={24} sm={12}><Form.Item name="name" label="Full Name" rules={[{ required: true, message: 'Please enter full name' }]}><Input placeholder="Enter full name" /></Form.Item></Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="username"
                label="Username"
                rules={[
                  { required: true, message: 'Please enter username' },
                  { min: 3, message: 'Username must be at least 3 characters' },
                  { pattern: /^[a-z0-9_.]+$/, message: 'Only lowercase letters, numbers, underscores and dots allowed' },
                ]}
              >
                <Input
                  placeholder="Enter username"
                  onChange={(e) => {
                    const sanitized = sanitizeUsername(e.target.value);
                    form.setFieldValue('username', sanitized);
                    if (!editingUser) usernameManuallyEditedRef.current = sanitized.length > 0;
                    handleValuesChange({ username: sanitized });
                  }}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12}><Form.Item name="email" label="Email" rules={[{ required: true, message: 'Please enter email' }, { type: 'email', message: 'Please enter a valid email' }]}><Input placeholder="Enter email address" /></Form.Item></Col>
            <Col xs={24} sm={12}><Form.Item name="phone" label="Phone"><Input placeholder="Enter phone number" /></Form.Item></Col>
          </Row>
          {!editingUser && (<Form.Item name="password" label="Password" rules={[{ required: true, message: 'Please enter password' }, { min: 6, message: 'Password must be at least 6 characters' }]}><Input.Password placeholder="Enter password" /></Form.Item>)}
          <Row gutter={16}>
            <Col xs={24} sm={12}><Form.Item name="roleId" label="Role" rules={[{ required: true, message: 'Please select a role' }]}><Select placeholder="Select role" options={roles.map(r => ({ value: r.id, label: r.name }))} /></Form.Item></Col>
            <Col xs={24} sm={12}><Form.Item name="isActive" label="Status" valuePropName="checked"><Switch checkedChildren="Active" unCheckedChildren="Inactive" /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      {/* Admin Password Reset Modal */}
      <Modal
        title={<Space><LockOutlined style={{ color: 'var(--warning-color)' }} /><span>Reset Password - {resetPwdUserName}</span></Space>}
        open={resetPwdModalVisible}
        onCancel={() => setResetPwdModalVisible(false)}
        afterClose={() => resetPwdForm.resetFields()}
        width={MODAL_WIDTHS.SMALL}
        centered
        destroyOnHidden
        footer={
          <div style={{ textAlign: 'right' }}>
            <Space>
              <ActionButton action="cancel" text="Cancel" onClick={() => setResetPwdModalVisible(false)} />
              <ActionButton action="custom" text="Reset Password" icon={<KeyOutlined />} color="var(--btn-history-color)" onClick={() => resetPwdForm.submit()} loading={resettingPwd} />
            </Space>
          </div>
        }
      >
        <Form form={resetPwdForm} layout="vertical" onFinish={handleAdminResetPwd} style={{ marginTop: 16 }}>
          <Form.Item name="newPassword" label="New Password" rules={[{ required: true, message: 'Please enter new password' }, { min: 6, message: 'Password must be at least 6 characters' }]}>
            <Input.Password placeholder="Enter new password" prefix={<LockOutlined />} />
          </Form.Item>
          <Form.Item name="confirmPassword" label="Confirm Password" dependencies={['newPassword']} rules={[{ required: true, message: 'Please confirm the password' }, ({ getFieldValue }) => ({ validator(_, value) { if (!value || getFieldValue('newPassword') === value) return Promise.resolve(); return Promise.reject(new Error('Passwords do not match')); } })]}>
            <Input.Password placeholder="Confirm new password" prefix={<LockOutlined />} />
          </Form.Item>
        </Form>
      </Modal>

      {/* User Details Drawer */}
      <Drawer title="User Details" placement="right" onClose={() => setDrawerVisible(false)} open={drawerVisible} styles={{ wrapper: { width: 400 } }}>
        {selectedUser && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <Avatar size={80} style={{ background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--primary-hover) 100%)' }} icon={<UserOutlined />}>{selectedUser.name?.charAt(0)?.toUpperCase()}</Avatar>
              <h3 style={{ marginTop: 12, marginBottom: 4 }}>{selectedUser.name}</h3>
              <Text type="secondary">@{selectedUser.username}</Text>
            </div>
            <Divider />
            <div style={{ marginBottom: 16 }}><Text type="secondary">Email</Text><div><MailOutlined /> {selectedUser.email}</div></div>
            <div style={{ marginBottom: 16 }}><Text type="secondary">Phone</Text><div><PhoneOutlined /> {selectedUser.phone || 'Not provided'}</div></div>
            <div style={{ marginBottom: 16 }}><Text type="secondary">Role</Text><div><Tag color="blue">{typeof selectedUser.role === 'object' ? selectedUser.role?.name : selectedUser.role || selectedUser.roleName}</Tag></div></div>
            <div style={{ marginBottom: 16 }}><Text type="secondary">Status</Text><div><StatusBadge status={selectedUser.isActive !== false ? 'active' : 'inactive'} /></div></div>
            <div style={{ marginBottom: 16 }}><Text type="secondary">Last Login</Text><div>{selectedUser.lastLoginAt ? formatDate(selectedUser.lastLoginAt, 'DD MMM YYYY HH:mm') : 'Never'}</div></div>
            <div style={{ marginBottom: 16 }}><Text type="secondary">Created</Text><div>{formatDate(selectedUser.createdAt, 'DD MMM YYYY HH:mm')}</div></div>
            <Divider />
            <Space direction="vertical" style={{ width: '100%' }}>
              <PermissionGuard module="users" operation="update">
                <ActionButton action="edit" text="Edit User" block onClick={() => { setDrawerVisible(false); openModal(selectedUser); }} />
              </PermissionGuard>
              {isAdmin && (
                <ActionButton
                  action="custom"
                  text="Reset Password"
                  icon={<LockOutlined />}
                  color="var(--btn-history-color)"
                  block
                  onClick={() => openResetPwdModal(selectedUser.id, selectedUser.name)}
                />
              )}
            </Space>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default UserManagement;
