import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card,
  Table,
  Space,
  Input,
  Tag,
  Modal,
  Form,
  message,
  Typography,
  Row,
  Col,
  Tooltip,
  Checkbox,
  Divider,
  Badge,
  Switch,
  Alert,
  Collapse,
} from 'antd';
import {
  SearchOutlined,
  ExclamationCircleOutlined,
  SafetyOutlined,
  DashboardOutlined,
  ShoppingCartOutlined,
  DatabaseOutlined,
  SettingOutlined,
  LinkOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { getRoles, createRole, updateRole, deleteRole } from '../../services/roleService';
import {
  getEmptyPermissions,
  getOperationsForModule,
  validatePermissions,
  normalizePermissionsForSave,
  PERMISSION_GROUPS,
} from '../../utils/permissions';
import PermissionGuard from '../../components/PermissionGuard';
import { ActionButton, DeleteConfirm } from '../../components/buttons';
import StatusBadge from '../../components/StatusBadge';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import { formatDate } from '../../utils/formatters';
import { getTablePagination } from '../../utils/paginationConfig';
import { MODAL_WIDTHS } from '../../utils/uiConstants';
const { Text } = Typography;

// Icon map for group rendering
const GROUP_ICONS = {
  DashboardOutlined: <DashboardOutlined />,
  ShoppingCartOutlined: <ShoppingCartOutlined />,
  DatabaseOutlined: <DatabaseOutlined />,
  SettingOutlined: <SettingOutlined />,
};

// Operation label helpers
const OP_LABELS = {
  view: 'View',
  add: 'Add',
  update: 'Update',
  delete: 'Delete',
  approve: 'Approve',
  reject: 'Reject',
  cancel: 'Cancel',
  refer_back: 'Refer Back',
};

const OP_COLORS = {
  view: '#6366f1',
  add: '#22c55e',
  update: '#f59e0b',
  delete: '#ef4444',
  approve: '#10b981',
  reject: '#f43f5e',
  cancel: '#64748b',
  refer_back: '#8b5cf6',
};

const RoleAccess = () => {
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [form] = Form.useForm();
  const [permissions, setPermissions] = useState(getEmptyPermissions());
  const [formDirty, setFormDirty] = useState(false);
  const [initialPermissions, setInitialPermissions] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const initialFormValuesRef = useRef(null);

  // Fetch roles
  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getRoles();
      const roleData = Array.isArray(response) ? response : (response.content || response.data || []);
      setRoles(roleData);
    } catch (error) {
      console.error('Error fetching roles:', error);
      message.error('Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  // Filter roles based on search
  const filteredRoles = roles.filter((role) =>
    !searchText ||
    role.name?.toLowerCase().includes(searchText.toLowerCase()) ||
    role.description?.toLowerCase().includes(searchText.toLowerCase())
  );

  // Check if form or permissions have changed from initial values
  const checkIfDirty = (currentFormValues, currentPermissions) => {
    if (!initialFormValuesRef.current) return false;
    const initial = initialFormValuesRef.current;
    const formChanged =
      currentFormValues.name !== initial.name ||
      (currentFormValues.description || '') !== (initial.description || '') ||
      currentFormValues.active !== initial.active;
    const permsChanged = JSON.stringify(currentPermissions) !== initialPermissions;
    return formChanged || permsChanged;
  };

  // Open modal for add/edit
  const openModal = (role = null) => {
    setEditingRole(role);
    if (role) {
      const formVals = {
        name: role.name,
        description: role.description,
        active: role.active !== false,
      };
      form.setFieldsValue(formVals);
      initialFormValuesRef.current = { ...formVals };
      // Merge role permissions with empty template so every key exists
      const empty = getEmptyPermissions();
      const rolePerms = role.permissions || {};
      const merged = { ...empty };
      Object.keys(rolePerms).forEach((moduleId) => {
        if (merged[moduleId]) {
          merged[moduleId] = {
            access: !!rolePerms[moduleId]?.access,
            operations: {
              ...merged[moduleId].operations,
              ...(rolePerms[moduleId]?.operations || {}),
            },
          };
        }
      });
      setPermissions(merged);
      setInitialPermissions(JSON.stringify(merged));
    } else {
      form.resetFields();
      form.setFieldsValue({ active: true });
      const empty = getEmptyPermissions();
      setPermissions(empty);
      setInitialPermissions(JSON.stringify(empty));
      initialFormValuesRef.current = { name: '', description: '', active: true };
    }
    setFormDirty(false);
    setModalVisible(true);
  };

  // Handle permission change
  const handlePermissionChange = (moduleId, operationId, checked) => {
    setPermissions((prev) => {
      const updated = JSON.parse(JSON.stringify(prev));
      if (!updated[moduleId]) {
        const ops = getOperationsForModule(moduleId);
        updated[moduleId] = {
          access: false,
          operations: ops.reduce((acc, op) => { acc[op] = false; return acc; }, {}),
        };
      }

      // Approval/action modules have no 'view' — skip the view-cascade logic for them
      const isApprovalModule = ['po-approval', 'order-actions', 'costing-approval'].includes(moduleId);

      // If disabling 'view' for standard modules, disable all operations
      if (operationId === 'view' && !checked && !isApprovalModule) {
        const ops = getOperationsForModule(moduleId);
        ops.forEach((op) => { updated[moduleId].operations[op] = false; });
        updated[moduleId].access = false;
      } else {
        updated[moduleId].operations[operationId] = checked;
        // If enabling any operation other than view, also enable view
        if (checked && operationId !== 'view' && !isApprovalModule) {
          updated[moduleId].operations.view = true;
        }
        updated[moduleId].access = Object.values(updated[moduleId].operations).some(Boolean);
      }

      // Enforce PO-approval → PO link
      if (moduleId === 'purchase-orders' && !updated['purchase-orders'].access) {
        const approvalOps = getOperationsForModule('po-approval');
        if (updated['po-approval']) {
          approvalOps.forEach((op) => { updated['po-approval'].operations[op] = false; });
          updated['po-approval'].access = false;
        }
      }

      // Enforce order-actions → orders link
      if (moduleId === 'orders' && !updated['orders'].access) {
        const actionOps = getOperationsForModule('order-actions');
        if (updated['order-actions']) {
          actionOps.forEach((op) => { updated['order-actions'].operations[op] = false; });
          updated['order-actions'].access = false;
        }
      }

      // Enforce costing-approval → costing link
      if (moduleId === 'costing' && !updated['costing'].access) {
        const approvalOps = getOperationsForModule('costing-approval');
        if (updated['costing-approval']) {
          approvalOps.forEach((op) => { updated['costing-approval'].operations[op] = false; });
          updated['costing-approval'].access = false;
        }
      }

      return updated;
    });
    // Recalculate dirty after permission change
    setPermissions((latest) => {
      const vals = form.getFieldsValue();
      setFormDirty(checkIfDirty(vals, latest));
      return latest;
    });
  };

  // Handle select all for a module
  const handleSelectAllModule = (moduleId, checked) => {
    const operations = getOperationsForModule(moduleId);
    setPermissions((prev) => {
      const updated = JSON.parse(JSON.stringify(prev));
      updated[moduleId] = {
        access: checked,
        operations: operations.reduce((acc, op) => {
          acc[op] = checked;
          return acc;
        }, {}),
      };

      // Enforce PO-approval → PO link on uncheck
      if (moduleId === 'purchase-orders' && !checked) {
        const approvalOps = getOperationsForModule('po-approval');
        updated['po-approval'] = {
          access: false,
          operations: approvalOps.reduce((acc, op) => { acc[op] = false; return acc; }, {}),
        };
      }

      // Enforce order-actions → orders link on uncheck
      if (moduleId === 'orders' && !checked) {
        const actionOps = getOperationsForModule('order-actions');
        updated['order-actions'] = {
          access: false,
          operations: actionOps.reduce((acc, op) => { acc[op] = false; return acc; }, {}),
        };
      }

      // Enforce costing-approval → costing link on uncheck
      if (moduleId === 'costing' && !checked) {
        const approvalOps = getOperationsForModule('costing-approval');
        updated['costing-approval'] = {
          access: false,
          operations: approvalOps.reduce((acc, op) => { acc[op] = false; return acc; }, {}),
        };
      }

      return updated;
    });
    setPermissions((latest) => {
      const vals = form.getFieldsValue();
      setFormDirty(checkIfDirty(vals, latest));
      return latest;
    });
  };

  // Handle select all for entire group
  const handleSelectAllGroup = (group, checked) => {
    setPermissions((prev) => {
      const updated = JSON.parse(JSON.stringify(prev));
      group.modules.forEach((mod) => {
        // For linked approval modules, enforce parent access when unchecking the group
        const linkedParent = { 'po-approval': 'purchase-orders', 'order-actions': 'orders', 'costing-approval': 'costing' };
        if (!checked && linkedParent[mod.id] && !updated[linkedParent[mod.id]]?.access) {
          const ops = getOperationsForModule(mod.id);
          updated[mod.id] = {
            access: false,
            operations: ops.reduce((acc, op) => { acc[op] = false; return acc; }, {}),
          };
          return;
        }
        const ops = getOperationsForModule(mod.id);
        updated[mod.id] = {
          access: checked,
          operations: ops.reduce((acc, op) => { acc[op] = checked; return acc; }, {}),
        };
      });
      return updated;
    });
    setPermissions((latest) => {
      const vals = form.getFieldsValue();
      setFormDirty(checkIfDirty(vals, latest));
      return latest;
    });
  };

  // Check states
  const isAllSelectedForModule = (moduleId) => {
    const ops = getOperationsForModule(moduleId);
    const modulePerms = permissions[moduleId]?.operations || {};
    return ops.length > 0 && ops.every((op) => modulePerms[op] === true);
  };

  const isSomeSelectedForModule = (moduleId) => {
    const ops = getOperationsForModule(moduleId);
    const modulePerms = permissions[moduleId]?.operations || {};
    const selected = ops.filter((op) => modulePerms[op] === true);
    return selected.length > 0 && selected.length < ops.length;
  };

  const isAllSelectedForGroup = (group) => {
    return group.modules.every((mod) => isAllSelectedForModule(mod.id));
  };

  const isSomeSelectedForGroup = (group) => {
    const allSelected = group.modules.every((mod) => isAllSelectedForModule(mod.id));
    const someSelected = group.modules.some((mod) =>
      permissions[mod.id]?.access === true
    );
    return someSelected && !allSelected;
  };

  // Count permissions
  const countPermissions = (role) => {
    if (!role.permissions) return 0;
    let count = 0;
    Object.values(role.permissions).forEach((mod) => {
      if (mod.operations) {
        count += Object.values(mod.operations).filter(Boolean).length;
      }
    });
    return count;
  };

  const countTotalSelectedPermissions = () => {
    let count = 0;
    Object.values(permissions).forEach((mod) => {
      if (mod.operations) {
        count += Object.values(mod.operations).filter(Boolean).length;
      }
    });
    return count;
  };

  // Handle form submit
  const handleSubmit = async (values) => {
    // Validate: at least one permission
    const validation = validatePermissions(permissions);
    if (!validation.valid) {
      message.warning(validation.message);
      return;
    }

    setSaving(true);
    try {
      // Normalize permissions before save
      const normalizedPermissions = normalizePermissionsForSave(permissions);

      const roleData = {
        ...values,
        permissions: normalizedPermissions,
      };

      if (editingRole) {
        await updateRole(editingRole.id, { ...roleData, version: editingRole.version });
        message.success('Role updated successfully');
        // Refresh the current user's session permissions immediately
        // so UI guards reflect the change without requiring a re-login.
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

  // Close modal with unsaved changes check
  const handleModalClose = () => {
    if (formDirty) {
      Modal.confirm({
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
    setPermissions(getEmptyPermissions());
    setFormDirty(false);
  };

  // Handle delete
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

  // Table columns
  const columns = [
    {
      title: 'Role Name',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space>
          <SafetyOutlined style={{ color: 'var(--primary-color)' }} />
          <div>
            <Text strong>{name}</Text>
            {record.isSystem && (
              <Tag color="orange" style={{ marginLeft: 8 }}>System</Tag>
            )}
          </div>
        </Space>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc) => <Text type="secondary">{desc || '-'}</Text>,
    },
    {
      title: 'Users',
      dataIndex: 'userCount',
      key: 'userCount',
      align: 'center',
      width: 100,
      render: (count) => (
        <Badge
          count={count || 0}
          showZero
          style={{ backgroundColor: 'var(--primary-color)' }}
        />
      ),
    },
    {
      title: 'Permissions',
      key: 'permissions',
      align: 'center',
      width: 130,
      render: (_, record) => {
        const count = countPermissions(record);
        return (
          <Tag color={count > 20 ? 'green' : count > 10 ? 'blue' : 'default'}>
            {count} permissions
          </Tag>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'active',
      key: 'status',
      align: 'center',
      width: 100,
      render: (active) => <StatusBadge status={active !== false ? 'active' : 'inactive'} />,
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
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <PermissionGuard module="roles" operation="update">
            <ActionButton
              action="edit"
              size="small"
              onClick={() => openModal(record)}
              disabled={record.isSystem}
            />
          </PermissionGuard>
          <PermissionGuard module="roles" operation="delete">
            <DeleteConfirm
              title="Delete Role"
              recordLabel={record.name}
              onConfirm={() => handleDelete(record.id)}
              loading={deletingId === record.id}
              disabled={record.isSystem}
            >
              <ActionButton
                action="delete"
                size="small"
                tooltip={record.isSystem ? 'System roles cannot be deleted' : 'Delete'}
                disabled={record.isSystem}
              />
            </DeleteConfirm>
          </PermissionGuard>
        </Space>
      ),
    },
  ];

  /* Render Permission Group */

  const renderModuleRow = (mod) => {
    const ops = getOperationsForModule(mod.id);
    const isPOApproval      = mod.id === 'po-approval';
    const isOrderActions    = mod.id === 'order-actions';
    const isCostingApproval = mod.id === 'costing-approval';
    const poHasAccess      = permissions['purchase-orders']?.access;
    const ordersHasAccess  = permissions['orders']?.access;
    const costingHasAccess = permissions['costing']?.access;
    const isLinkedDisabled =
      (isPOApproval      && !poHasAccess)      ||
      (isOrderActions    && !ordersHasAccess)  ||
      (isCostingApproval && !costingHasAccess);

    return (
      <div
        key={mod.id}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '10px 16px',
          borderBottom: '1px solid var(--border-color, #f0f0f0)',
          background: isLinkedDisabled ? 'var(--bg-tertiary, #fafafa)' : 'transparent',
          opacity: isLinkedDisabled ? 0.5 : 1,
          transition: 'all 0.2s',
        }}
      >
        {/* Module name + select all checkbox */}
        <div style={{ flex: '0 0 260px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Checkbox
            checked={isAllSelectedForModule(mod.id)}
            indeterminate={isSomeSelectedForModule(mod.id)}
            onChange={(e) => handleSelectAllModule(mod.id, e.target.checked)}
            disabled={isLinkedDisabled}
          />
          <div>
            <Text strong style={{ fontSize: 13 }}>{mod.name}</Text>
            {mod.path && (
              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                {mod.path}
              </Text>
            )}
            {mod.description && (
              <Text type="secondary" style={{ fontSize: 11, display: 'block', fontStyle: 'italic' }}>
                {mod.description}
              </Text>
            )}
          </div>
          {isPOApproval && (
            <Tooltip title="Requires Purchase Orders access to be enabled">
              <LinkOutlined style={{ color: 'var(--primary-hover)', fontSize: 12 }} />
            </Tooltip>
          )}
          {isOrderActions && (
            <Tooltip title="Requires Orders access to be enabled">
              <LinkOutlined style={{ color: 'var(--primary-hover)', fontSize: 12 }} />
            </Tooltip>
          )}
          {isCostingApproval && (
            <Tooltip title="Requires Costing access to be enabled">
              <LinkOutlined style={{ color: 'var(--primary-hover)', fontSize: 12 }} />
            </Tooltip>
          )}
        </div>

        {/* Operation checkboxes */}
        <div style={{ flex: 1, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {ops.map((op) => (
            <div
              key={op}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 10px',
                borderRadius: 6,
                border: `1px solid ${permissions[mod.id]?.operations?.[op] ? OP_COLORS[op] + '40' : 'var(--border-color, #e2e8f0)'}`,
                background: permissions[mod.id]?.operations?.[op] ? OP_COLORS[op] + '10' : 'transparent',
                transition: 'all 0.2s',
                minWidth: 90,
              }}
            >
              <Checkbox
                checked={permissions[mod.id]?.operations?.[op] || false}
                onChange={(e) => handlePermissionChange(mod.id, op, e.target.checked)}
                disabled={isLinkedDisabled}
              />
              <Text
                style={{
                  fontSize: 12,
                  color: permissions[mod.id]?.operations?.[op] ? OP_COLORS[op] : 'var(--text-secondary, #64748b)',
                  fontWeight: permissions[mod.id]?.operations?.[op] ? 600 : 400,
                }}
              >
                {OP_LABELS[op] || op}
              </Text>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderPermissionsMatrix = () => {
    const totalSelected = countTotalSelectedPermissions();

    const collapseItems = PERMISSION_GROUPS.map((group) => ({
      key: group.key,
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
          <Checkbox
            checked={isAllSelectedForGroup(group)}
            indeterminate={isSomeSelectedForGroup(group)}
            onChange={(e) => {
              e.stopPropagation();
              handleSelectAllGroup(group, e.target.checked);
            }}
            onClick={(e) => e.stopPropagation()}
          />
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {GROUP_ICONS[group.icon] || <SettingOutlined />}
            <Text strong style={{ fontSize: 14 }}>{group.label}</Text>
          </span>
          {group.description && (
            <Tooltip title={group.description}>
              <InfoCircleOutlined style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 12 }} />
            </Tooltip>
          )}
          <Tag
            style={{ marginLeft: 'auto', marginRight: 8 }}
            color={group.modules.every((m) => isAllSelectedForModule(m.id)) ? 'green' : 'default'}
          >
            {group.modules.filter((m) => permissions[m.id]?.access).length}/{group.modules.length} active
          </Tag>
        </div>
      ),
      children: (
        <div style={{ margin: -12 }}>
          {group.modules.map((mod) => renderModuleRow(mod))}
        </div>
      ),
    }));

    return (
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h4 style={{ margin: 0 }}>Permission Matrix</h4>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Configure page access and operations for this role
            </Text>
          </div>
          <Tag color={totalSelected > 0 ? 'blue' : 'default'} style={{ fontSize: 13, padding: '2px 12px' }}>
            {totalSelected} permission{totalSelected !== 1 ? 's' : ''} selected
          </Tag>
        </div>

        {/* PO Approval dependency notice */}
        {permissions['purchase-orders']?.access && (
          <Alert
            message="PO Approval Actions are linked to Purchase Orders access"
            description="Approve, Reject, Cancel, and Refer Back operations require the Purchase Orders module to be enabled."
            type="info"
            showIcon
            icon={<LinkOutlined />}
            style={{ marginBottom: 12 }}
            closable
          />
        )}

        {/* Order Approval Actions dependency notice */}
        {permissions['orders']?.access && (
          <Alert
            message="Order Approval Actions are linked to Orders access"
            description="Refer Back, Cancel, Approve, and Reject operations require the Orders module to be enabled."
            type="info"
            showIcon
            icon={<LinkOutlined />}
            style={{ marginBottom: 12 }}
            closable
          />
        )}

        {/* Costing Approval Actions dependency notice */}
        {permissions['costing']?.access && (
          <Alert
            message="Costing Approval Actions are linked to Costing access"
            description="Approve operation requires the Costing module to be enabled."
            type="info"
            showIcon
            icon={<LinkOutlined />}
            style={{ marginBottom: 12 }}
            closable
          />
        )}

        <Collapse
          defaultActiveKey={PERMISSION_GROUPS.map((g) => g.key)}
          items={collapseItems}
          size="small"
          style={{
            background: 'var(--card-bg, #fff)',
            borderRadius: 8,
          }}
        />
      </div>
    );
  };

  return (
    <div>
      <Card>
        <PageHeader title="Role & Access Management" subtitle="Define roles and configure permissions">
          <PermissionGuard module="roles" operation="add">
            <ActionButton action="create" text="Add Role" onClick={() => openModal()} />
          </PermissionGuard>
        </PageHeader>

        {/* Filters */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="Search by role name or description..."
              prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col>
            <ActionButton action="refresh" tooltip="Refresh" onClick={fetchRoles} />
          </Col>
        </Row>

        {/* Table */}
        <Table
          columns={columns}
          dataSource={filteredRoles}
          rowKey="id"
          loading={loading}
          pagination={getTablePagination(undefined, 'roles')}
          locale={{
            emptyText: <EmptyState description="No roles found" />,
          }}
        />
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        title={editingRole ? "Edit Role" : "Add New Role"}
        open={modalVisible}
        onCancel={handleModalClose}
        afterClose={handleModalAfterClose}
        width={MODAL_WIDTHS.LARGE}
        centered
        styles={{
          body: { maxHeight: "70vh", overflowY: "auto", paddingBottom: 0 },
        }}
        footer={
          <div style={{ textAlign: "right" }}>
            <Space>
              <ActionButton action="cancel" text="Cancel" onClick={handleModalClose} />
              <ActionButton
                action="save"
                text={editingRole ? "Update Role" : "Create Role"}
                onClick={() => form.submit()}
                disabled={editingRole && !formDirty}
                loading={saving}
              />
            </Space>
          </div>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          onValuesChange={() => {
            const vals = form.getFieldsValue();
            setFormDirty(checkIfDirty(vals, permissions));
          }}
          style={{ width: "99%" }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="Role Name"
                rules={[
                  { required: true, message: "Please enter role name" },
                  {
                    pattern: /^[a-zA-Z\s]+$/,
                    message: "Role name can only contain letters and spaces",
                  },
                  {
                    min: 2,
                    message: "Role name must be at least 2 characters",
                  },
                  { max: 50, message: "Role name cannot exceed 50 characters" },
                ]}
              >
                <Input
                  placeholder="Enter role name (e.g., Manager, Approver)"
                  onKeyDown={(e) => {
                    if (
                      /[0-9!@#$%^&*()_+=\[\]{};':"\\|,.<>\/?`~\-]/.test(
                        e.key,
                      ) &&
                      e.key.length === 1
                    ) {
                      e.preventDefault();
                    }
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="active" label="Status" valuePropName="checked">
                <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="Description">
            <Input.TextArea placeholder="Enter role description" rows={2} />
          </Form.Item>

          <Divider style={{ margin: "12px 0" }} />

          {renderPermissionsMatrix()}
        </Form>
      </Modal>
    </div>
  );
};

export default RoleAccess;
