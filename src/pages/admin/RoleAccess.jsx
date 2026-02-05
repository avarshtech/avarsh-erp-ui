import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
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
  Popconfirm,
  Checkbox,
  Divider,
  Badge,
  Switch,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import { getRoles, createRole, updateRole, deleteRole } from '../../services/roleService';
import { MODULES, OPERATIONS, getEmptyPermissions } from '../../utils/permissions';
import PermissionGuard from '../../components/PermissionGuard';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

// Modules to show in permissions matrix (excluding technical ones)
const PERMISSION_MODULES = [
  { id: 'dashboard', name: 'Dashboard' },
  { id: 'orders', name: 'Orders' },
  { id: 'bom', name: 'Bill of Materials' },
  { id: 'purchase-orders', name: 'Purchase Orders' },
  { id: 'po-approval', name: 'PO Approval' },
  { id: 'grn', name: 'Goods Received' },
  { id: 'suppliers', name: 'Suppliers' },
  { id: 'items', name: 'Items' },
  { id: 'master-data', name: 'Master Data' },
  { id: 'users', name: 'Users' },
  { id: 'roles', name: 'Roles & Access' },
  { id: 'settings', name: 'Settings' },
];

// Standard operations for most modules
const STANDARD_OPERATIONS = ['view', 'add', 'update', 'delete'];

// PO Approval has special operations
const PO_APPROVAL_OPERATIONS = ['view', 'approve', 'reject', 'cancel', 'refer_back'];

const RoleAccess = () => {
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [form] = Form.useForm();
  const [permissions, setPermissions] = useState(getEmptyPermissions());

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

  // Open modal for add/edit
  const openModal = (role = null) => {
    setEditingRole(role);
    if (role) {
      form.setFieldsValue({
        name: role.name,
        description: role.description,
        active: role.active !== false,
      });
      setPermissions(role.permissions || getEmptyPermissions());
    } else {
      form.resetFields();
      form.setFieldsValue({ active: true });
      setPermissions(getEmptyPermissions());
    }
    setModalVisible(true);
  };

  // Handle permission change
  const handlePermissionChange = (moduleId, operationId, checked) => {
    setPermissions((prev) => {
      const updated = { ...prev };
      if (!updated[moduleId]) {
        updated[moduleId] = { access: false, operations: {} };
      }
      
      // If changing 'view' to false, disable all other operations
      if (operationId === 'view' && !checked) {
        updated[moduleId] = {
          access: false,
          operations: Object.keys(updated[moduleId].operations || {}).reduce((acc, op) => {
            acc[op] = false;
            return acc;
          }, {}),
        };
      } else {
        updated[moduleId].operations = {
          ...updated[moduleId].operations,
          [operationId]: checked,
        };
        // Set access based on whether any operation is enabled
        updated[moduleId].access = Object.values(updated[moduleId].operations).some(Boolean);
      }
      
      return updated;
    });
  };

  // Handle select all for a module
  const handleSelectAllModule = (moduleId, checked) => {
    const operations = moduleId === 'po-approval' ? PO_APPROVAL_OPERATIONS : STANDARD_OPERATIONS;
    setPermissions((prev) => {
      const updated = { ...prev };
      updated[moduleId] = {
        access: checked,
        operations: operations.reduce((acc, op) => {
          acc[op] = checked;
          return acc;
        }, {}),
      };
      return updated;
    });
  };

  // Check if all operations are selected for a module
  const isAllSelectedForModule = (moduleId) => {
    const operations = moduleId === 'po-approval' ? PO_APPROVAL_OPERATIONS : STANDARD_OPERATIONS;
    const modulePerms = permissions[moduleId]?.operations || {};
    return operations.every((op) => modulePerms[op] === true);
  };

  // Handle form submit
  const handleSubmit = async (values) => {
    try {
      const roleData = {
        ...values,
        permissions,
      };

      if (editingRole) {
        await updateRole(editingRole.id, roleData);
        message.success('Role updated successfully');
      } else {
        await createRole(roleData);
        message.success('Role created successfully');
      }
      setModalVisible(false);
      form.resetFields();
      setPermissions(getEmptyPermissions());
      fetchRoles();
    } catch (error) {
      message.error(error.errorMessage || 'Failed to save role');
    }
  };

  // Handle delete
  const handleDelete = async (roleId) => {
    try {
      await deleteRole(roleId);
      message.success('Role deleted successfully');
      fetchRoles();
    } catch (error) {
      message.error(error.errorMessage || 'Failed to delete role');
    }
  };

  // Count permissions for a role
  const countPermissions = (role) => {
    if (!role.permissions) return 0;
    let count = 0;
    Object.values(role.permissions).forEach((module) => {
      if (module.operations) {
        count += Object.values(module.operations).filter(Boolean).length;
      }
    });
    return count;
  };

  // Table columns
  const columns = [
    {
      title: 'Role Name',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space>
          <SafetyOutlined style={{ color: '#6366f1' }} />
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
          style={{ backgroundColor: '#6366f1' }} 
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
      render: (active) => (
        <Badge 
          status={active !== false ? 'success' : 'default'} 
          text={active !== false ? 'Active' : 'Inactive'} 
        />
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date) => date ? dayjs(date).format('DD MMM YYYY') : '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'center',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <PermissionGuard module="roles" operation="update">
            <Tooltip title="Edit">
              <Button 
                type="text" 
                icon={<EditOutlined />} 
                onClick={() => openModal(record)}
                disabled={record.isSystem}
              />
            </Tooltip>
          </PermissionGuard>
          <PermissionGuard module="roles" operation="delete">
            <Popconfirm
              title="Delete Role"
              description="Are you sure? This will affect all users with this role."
              onConfirm={() => handleDelete(record.id)}
              okText="Yes"
              cancelText="No"
              icon={<ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
              disabled={record.isSystem}
            >
              <Tooltip title={record.isSystem ? 'System roles cannot be deleted' : 'Delete'}>
                <Button 
                  type="text" 
                  danger 
                  icon={<DeleteOutlined />} 
                  disabled={record.isSystem}
                />
              </Tooltip>
            </Popconfirm>
          </PermissionGuard>
        </Space>
      ),
    },
  ];

  // Render permissions matrix
  const renderPermissionsMatrix = () => (
    <div style={{ marginTop: 16 }}>
      <Title level={5}>Permissions Matrix</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Configure module access and operations for this role
      </Text>
      
      <Table
        className="permissions-matrix-table"
        size="small"
        pagination={false}
        bordered
        dataSource={PERMISSION_MODULES}
        rowKey="id"
        columns={[
          {
            title: 'Module',
            dataIndex: 'name',
            key: 'name',
            width: 180,
            fixed: 'left',
            render: (name, record) => (
              <Space>
                <Checkbox
                  checked={isAllSelectedForModule(record.id)}
                  indeterminate={
                    permissions[record.id]?.access && !isAllSelectedForModule(record.id)
                  }
                  onChange={(e) => handleSelectAllModule(record.id, e.target.checked)}
                />
                <Text strong>{name}</Text>
              </Space>
            ),
          },
          ...(STANDARD_OPERATIONS.map((op) => ({
            title: op.charAt(0).toUpperCase() + op.slice(1),
            key: op,
            align: 'center',
            width: 72,
            render: (_, record) => {
              // PO Approval module does not show standard operation checkboxes
              if (record.id === 'po-approval') {
                return <Text type="secondary">-</Text>;
              }
              return (
                <Checkbox
                  checked={permissions[record.id]?.operations?.[op] || false}
                  onChange={(e) => handlePermissionChange(record.id, op, e.target.checked)}
                />
              );
            },
          }))),
          // Special columns for PO Approval
          {
            title: 'Approve',
            key: 'approve',
            align: 'center',
            width: 80,
            render: (_, record) => {
              if (record.id !== 'po-approval') {
                return <Text type="secondary">-</Text>;
              }
              return (
                <Checkbox
                  checked={permissions[record.id]?.operations?.approve || false}
                  onChange={(e) => handlePermissionChange(record.id, 'approve', e.target.checked)}
                />
              );
            },
          },
          {
            title: 'Reject',
            key: 'reject',
            align: 'center',
            width: 80,
            render: (_, record) => {
              if (record.id !== 'po-approval') {
                return <Text type="secondary">-</Text>;
              }
              return (
                <Checkbox
                  checked={permissions[record.id]?.operations?.reject || false}
                  onChange={(e) => handlePermissionChange(record.id, 'reject', e.target.checked)}
                />
              );
            },
          },
          {
            title: 'Cancel',
            key: 'cancel',
            align: 'center',
            width: 80,
            render: (_, record) => {
              if (record.id !== 'po-approval') {
                return <Text type="secondary">-</Text>;
              }
              return (
                <Checkbox
                  checked={permissions[record.id]?.operations?.cancel || false}
                  onChange={(e) => handlePermissionChange(record.id, 'cancel', e.target.checked)}
                />
              );
            },
          },
          {
            title: 'Refer Back',
            key: 'refer_back',
            align: 'center',
            width: 100,
            render: (_, record) => {
              if (record.id !== 'po-approval') {
                return <Text type="secondary">-</Text>;
              }
              return (
                <Checkbox
                  checked={permissions[record.id]?.operations?.refer_back || false}
                  onChange={(e) => handlePermissionChange(record.id, 'refer_back', e.target.checked)}
                />
              );
            },
          },
        ]}
        scroll={{ x: 900 }}
      />
    </div>
  );

  return (
    <div>
      <Card>
        <div style={{ marginBottom: 24 }}>
          <Row justify="space-between" align="middle">
            <Col>
              <Title level={4} style={{ margin: 0 }}>Role & Access Management</Title>
              <Text type="secondary">Define roles and configure permissions</Text>
            </Col>
            <Col>
              <PermissionGuard module="roles" operation="add">
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => openModal()}
                >
                  Add Role
                </Button>
              </PermissionGuard>
            </Col>
          </Row>
        </div>

        {/* Filters */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="Search by role name or description..."
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col>
            <Tooltip title="Refresh">
              <Button icon={<ReloadOutlined />} onClick={fetchRoles} />
            </Tooltip>
          </Col>
        </Row>

        {/* Table */}
        <Table
          columns={columns}
          dataSource={filteredRoles}
          rowKey="id"
          loading={loading}
          pagination={{
            showSizeChanger: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} roles`,
          }}
        />
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        title={editingRole ? 'Edit Role' : 'Add New Role'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
          setPermissions(getEmptyPermissions());
        }}
        footer={null}
        width={1000}
        style={{ top: 20 }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="Role Name"
                rules={[{ required: true, message: 'Please enter role name' }]}
              >
                <Input placeholder="Enter role name (e.g., Manager, Approver)" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="active"
                label="Status"
                valuePropName="checked"
              >
                <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="description"
            label="Description"
          >
            <Input.TextArea 
              placeholder="Enter role description" 
              rows={2}
            />
          </Form.Item>

          <Divider />

          {renderPermissionsMatrix()}

          <div style={{ textAlign: 'right', marginTop: 24 }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">
                {editingRole ? 'Update Role' : 'Create Role'}
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default RoleAccess;
