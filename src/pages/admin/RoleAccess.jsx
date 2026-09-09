import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  App, Card, Table, Space, Input, Tag, Modal, Form, Typography, Row, Col, Switch, Divider,
} from 'antd';
import { SearchOutlined, ExclamationCircleOutlined, SafetyOutlined } from '@ant-design/icons';
import { getRoles, createRole, updateRole, deleteRole } from '../../services/admin/roleService';
import {
  getEmptyPermissions,
  applyDependencies,
  validatePermissions,
  normalizePermissionsForSave,
  getCurrentUser,
  setCurrentUser,
  isAdminRole,
} from '../../utils/permissions';
import PermissionGuard from '../../components/PermissionGuard';
import { ActionButton, DeleteConfirm } from '../../components/buttons';
import StatusBadge from '../../components/StatusBadge';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import { formatDate } from '../../utils/formatters';
import { getTablePagination } from '../../utils/paginationConfig';
import { MODAL_WIDTHS } from '../../utils/uiConstants';
import PermissionMatrix from './components/roles/PermissionMatrix';

const { Text } = Typography;

const countPermissions = (role) =>
  Object.values(role?.permissions ?? {})
    .reduce((n, mod) => n + Object.values(mod?.operations ?? {}).filter(Boolean).length, 0);

const RoleAccess = () => {
  const { message, modal } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [form] = Form.useForm();
  const [permissions, setPermissions] = useState(getEmptyPermissions);
  const [initialPermissions, setInitialPermissions] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const initialFormValuesRef = useRef(null);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getRoles();
      setRoles(Array.isArray(response) ? response : (response.content || response.data || []));
    } catch (error) {
      console.error('Error fetching roles:', error);
      message.error('Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  const filteredRoles = roles.filter((role) =>
    !searchText ||
    role.name?.toLowerCase().includes(searchText.toLowerCase()) ||
    role.description?.toLowerCase().includes(searchText.toLowerCase()));

  // Dirty state is derived, not stored. It used to be set from inside a
  // setPermissions updater — impure, and run twice under StrictMode.
  const formValues = Form.useWatch([], form);
  const permsJson = useMemo(() => JSON.stringify(permissions), [permissions]);
  const formDirty = useMemo(() => {
    const initial = initialFormValuesRef.current;
    if (!initial) return false;
    return (formValues?.name ?? '') !== (initial.name ?? '')
      || (formValues?.description || '') !== (initial.description || '')
      || (formValues?.active ?? true) !== initial.active
      || permsJson !== initialPermissions;
  }, [formValues, permsJson, initialPermissions]);

  const openModal = (role = null) => {
    setEditingRole(role);
    if (role) {
      const formVals = { name: role.name, description: role.description, active: role.status !== 'INACTIVE' };
      form.setFieldsValue(formVals);
      initialFormValuesRef.current = { ...formVals };

      // Merge onto a fresh template so a newly added screen has a key, then
      // derive access from the operations rather than trusting the stored flag,
      // which is free-form jsonb and can disagree with them. Unknown keys are
      // carried through untouched instead of being dropped on the floor.
      const empty = getEmptyPermissions();
      const stored = role.permissions || {};
      const merged = { ...empty };
      Object.keys(stored).forEach((moduleId) => {
        if (!merged[moduleId]) { merged[moduleId] = stored[moduleId]; return; }
        const operations = { ...merged[moduleId].operations };
        Object.keys(operations).forEach((op) => {
          operations[op] = stored[moduleId]?.operations?.[op] === true;
        });
        merged[moduleId] = { access: Object.values(operations).some(Boolean), operations };
      });
      const resolved = applyDependencies(merged);
      setPermissions(resolved);
      setInitialPermissions(JSON.stringify(resolved));
    } else {
      form.resetFields();
      form.setFieldsValue({ active: true });
      const empty = getEmptyPermissions();
      setPermissions(empty);
      setInitialPermissions(JSON.stringify(empty));
      initialFormValuesRef.current = { name: '', description: '', active: true };
    }
    setModalVisible(true);
  };

  const handleSubmit = async (values) => {
    const validation = validatePermissions(permissions);
    if (!validation.valid) { message.warning(validation.message); return; }

    setSaving(true);
    try {
      const normalizedPermissions = normalizePermissionsForSave(permissions);
      const roleData = {
        name: values.name,
        description: values.description,
        status: values.active !== false ? 'ACTIVE' : 'INACTIVE',
        permissions: normalizedPermissions,
      };

      if (editingRole) {
        await updateRole(editingRole.id, { ...roleData, version: editingRole.version });
        message.success('Role updated successfully');
        // Refresh the current user's session permissions immediately so UI
        // guards reflect the change without requiring a re-login.
        const currentUser = getCurrentUser();
        if (currentUser && currentUser.role?.toLowerCase() === editingRole.name?.toLowerCase()) {
          setCurrentUser({ ...currentUser, permissions: normalizedPermissions });
        }
      } else {
        await createRole(roleData);
        message.success('Role created successfully');
      }
      setModalVisible(false);
      fetchRoles();
    } catch (error) {
      message.error(error.errorMessage || 'Failed to save role');
    } finally {
      setSaving(false);
    }
  };

  const handleModalClose = () => {
    if (!formDirty) { setModalVisible(false); return; }
    modal.confirm({
      title: 'Unsaved Changes',
      icon: <ExclamationCircleOutlined />,
      content: 'You have unsaved changes. Are you sure you want to discard them?',
      okText: 'Discard',
      okType: 'danger',
      cancelText: 'Keep Editing',
      onOk: () => setModalVisible(false),
    });
  };

  const handleModalAfterClose = () => {
    form.resetFields();
    setPermissions(getEmptyPermissions());
    initialFormValuesRef.current = null;
  };

  const handleDelete = async (roleId) => {
    setDeletingId(roleId);
    try {
      await deleteRole(roleId);
      message.success('Role deleted successfully');
      fetchRoles();
    } catch (error) {
      message.error(error.errorMessage || 'Failed to delete role');
    } finally {
      setDeletingId(null);
    }
  };

  // `isSystem` is not a field on RoleDTO, so the old record.isSystem was always
  // undefined and the guard never fired. The admin roles are the ones that must
  // not be edited away, and they are identified by name.
  const isProtected = (record) => isAdminRole(record.name);

  const columns = useMemo(() => [
    {
      title: 'Role Name',
      dataIndex: 'name',
      key: 'name',
      fixed: 'left',
      width: 200,
      render: (name, record) => (
        <Space>
          <SafetyOutlined style={{ color: 'var(--primary-color)' }} />
          <Text strong style={{ whiteSpace: 'nowrap' }}>{name}</Text>
          {isProtected(record) && <Tag color="orange">System</Tag>}
        </Space>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      width: 220,
      ellipsis: true,
      render: (desc) => <Text type="secondary">{desc || '-'}</Text>,
    },
    {
      title: 'Permissions',
      key: 'permissions',
      align: 'center',
      width: 140,
      render: (_, record) => {
        const count = countPermissions(record);
        return <Tag color={count > 20 ? 'green' : count > 10 ? 'blue' : 'default'}>{count} rights</Tag>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      align: 'center',
      width: 90,
      render: (status) => <StatusBadge status={status !== 'INACTIVE' ? 'active' : 'inactive'} />,
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date) => formatDate(date, 'DD MMM YYYY'),
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'center',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <PermissionGuard module="roles" operation="update">
            <ActionButton action="edit" size="small" onClick={() => openModal(record)} disabled={isProtected(record)} />
          </PermissionGuard>
          <PermissionGuard module="roles" operation="delete">
            <DeleteConfirm
              title="Delete Role"
              recordLabel={record.name}
              onConfirm={() => handleDelete(record.id)}
              loading={deletingId === record.id}
              disabled={isProtected(record)}
            >
              <ActionButton
                action="delete"
                size="small"
                tooltip={isProtected(record) ? 'System roles cannot be deleted' : 'Delete'}
                disabled={isProtected(record)}
              />
            </DeleteConfirm>
          </PermissionGuard>
        </Space>
      ),
    },
    // openModal and handleDelete are stable enough for this table; deletingId is
    // what actually changes between renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [deletingId]);

  const noRightsYet = !validatePermissions(permissions).valid;

  return (
    <div>
      <Card>
        <PageHeader title="Role & Access Management" subtitle="Define roles and configure permissions">
          <PermissionGuard module="roles" operation="add">
            <ActionButton action="create" text="Add Role" onClick={() => openModal()} />
          </PermissionGuard>
        </PageHeader>

        <Row gutter={[12, 12]} style={{ marginBottom: 16 }} align="middle">
          <Col xs={20} sm={12} md={8}>
            <Input
              placeholder="Search by role name or description..."
              prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={4} sm={4} md={2} style={{ display: 'flex' }}>
            <ActionButton action="refresh" tooltip="Refresh" size="middle" onClick={fetchRoles} />
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={filteredRoles}
          rowKey="id"
          loading={loading}
          scroll={{ x: 900 }}
          pagination={getTablePagination(undefined, 'roles')}
          locale={{ emptyText: <EmptyState description="No roles found" /> }}
        />
      </Card>

      <Modal
        title={editingRole ? `Edit Role — ${editingRole.name}` : 'Add New Role'}
        open={modalVisible}
        onCancel={handleModalClose}
        afterClose={handleModalAfterClose}
        width={MODAL_WIDTHS.XLARGE}
        centered
        style={{ maxWidth: 'calc(100vw - 32px)' }}
        styles={{ body: { maxHeight: '76vh', overflowY: 'auto', paddingBottom: 0 } }}
        footer={
          <div style={{ textAlign: 'right' }}>
            <Space>
              <ActionButton action="cancel" text="Cancel" onClick={handleModalClose} />
              <ActionButton
                action="save"
                text={editingRole ? 'Update Role' : 'Create Role'}
                onClick={() => form.submit()}
                disabled={(editingRole && !formDirty) || noRightsYet}
                tooltip={noRightsYet ? 'A role needs at least one right' : undefined}
                loading={saving}
              />
            </Space>
          </div>
        }
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ width: '99%' }}>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="name"
                label="Role Name"
                rules={[
                  { required: true, message: 'Please enter role name' },
                  { pattern: /^[a-zA-Z\s]+$/, message: 'Role name can only contain letters and spaces' },
                  { min: 2, message: 'Role name must be at least 2 characters' },
                  { max: 50, message: 'Role name cannot exceed 50 characters' },
                ]}
              >
                <Input placeholder="Enter role name (e.g., Manager, Approver)" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="active" label="Status" valuePropName="checked">
                <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="Description">
            <Input.TextArea placeholder="Enter role description" rows={2} />
          </Form.Item>

          <Divider style={{ margin: '12px 0' }} />

          <PermissionMatrix
            value={permissions}
            onChange={setPermissions}
            roles={roles}
            currentRoleId={editingRole?.id}
          />
        </Form>
      </Modal>
    </div>
  );
};

export default RoleAccess;
