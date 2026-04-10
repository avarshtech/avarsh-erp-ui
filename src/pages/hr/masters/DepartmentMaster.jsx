import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import MasterSplitView from '../../../components/MasterSplitView';
import { Form, Input, Button, Space, App, Tag, Switch, Typography, Select } from 'antd';
import { SaveOutlined, CloseOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { getAllDepartments, createDepartment, updateDepartment, deleteDepartment } from '../../../services/hrMasterService';
import { getActiveFactories } from '../../../services/factoryService';
import { hasPermission } from '../../../utils/permissions';
import PermissionGuard from '../../../components/PermissionGuard';

const { Text } = Typography;

const MODULE_ID = 'hr-masters';

const DepartmentMaster = ({ onDirtyChange }) => {
  const { message, modal } = App.useApp();

  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const markDirty = useCallback((dirty) => { setUnsavedChanges(dirty); onDirtyChange?.(dirty); }, [onDirtyChange]);
  const [form] = Form.useForm();
  const skipDirty = useRef(false);

  const [factories, setFactories] = useState([]);

  const canAdd = hasPermission(MODULE_ID, 'add');
  const canUpdate = hasPermission(MODULE_ID, 'update');
  const canDelete = hasPermission(MODULE_ID, 'delete');
  const canView = hasPermission(MODULE_ID, 'view');

  const factoryOptions = useMemo(() =>
    factories.map(f => ({ value: f.id, label: `${f.factoryCode} - ${f.factoryName}` })),
  [factories]);

  const factoryMap = useMemo(() => {
    const map = {};
    factories.forEach(f => { map[f.id] = f.factoryName; });
    return map;
  }, [factories]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAllDepartments();
      const list = Array.isArray(result) ? result : (result?.data || []);
      setData(list);
      setFilteredData(list);
    } catch {
      message.error('Failed to load departments');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFactories = useCallback(async () => {
    try {
      const result = await getActiveFactories();
      const list = Array.isArray(result) ? result : (result?.data || []);
      setFactories(list);
    } catch {
      // Silent — factory dropdown will just be empty
    }
  }, []);

  useEffect(() => { fetchData(); fetchFactories(); }, [fetchData, fetchFactories]);

  const columns = [
    {
      title: 'Code',
      dataIndex: 'code',
      width: 100,
      sorter: (a, b) => (a.code || '').localeCompare(b.code || ''),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
    },
    {
      title: 'Factory',
      dataIndex: 'factoryId',
      width: 140,
      render: (val) => factoryMap[val] || '—',
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      width: 90,
      render: (val) => val === false
        ? <Tag color="default">Inactive</Tag>
        : <Tag color="green">Active</Tag>,
    },
  ];

  const handleAdd = () => {
    if (!canAdd) { message.warning('You do not have permission to add departments'); return; }
    skipDirty.current = true;
    setSelectedId(null);
    setIsEditing(true);
    form.resetFields();
    form.setFieldsValue({ isActive: true });
    markDirty(false);
    setTimeout(() => { skipDirty.current = false; }, 300);
  };

  const handleSelect = (record) => {
    if (!canView && !canUpdate) { message.warning('You do not have permission to view departments'); return; }
    skipDirty.current = true;
    setSelectedId(record.id);
    setIsEditing(true);
    form.setFieldsValue({
      ...record,
      isActive: record.isActive !== false,
    });
    markDirty(false);
    setTimeout(() => { skipDirty.current = false; }, 300);
  };

  const handleSave = async (values) => {
    if (selectedId && !canUpdate) { message.warning('You do not have permission to update departments'); return; }
    if (!selectedId && !canAdd) { message.warning('You do not have permission to add departments'); return; }

    setSubmitting(true);
    try {
      if (selectedId) {
        const selectedRecord = data.find(r => r.id === selectedId);
        await updateDepartment(selectedId, { ...values, version: selectedRecord?.version });
        message.success('Department updated successfully');
      } else {
        await createDepartment(values);
        message.success('Department created successfully');
      }
      markDirty(false);
      setIsEditing(false);
      setSelectedId(null);
      fetchData();
    } catch {
      // Error toast already shown by axiosInstance interceptor
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!canDelete) { message.warning('You do not have permission to delete departments'); return; }
    modal.confirm({
      title: 'Delete Department',
      icon: <ExclamationCircleOutlined />,
      content: 'Are you sure you want to delete this department? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await deleteDepartment(selectedId);
          message.success('Department deleted successfully');
          handleCancel();
          fetchData();
        } catch {
          // Error toast already shown by axiosInstance interceptor
        }
      },
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSelectedId(null);
    form.resetFields();
    markDirty(false);
  };

  const handleSearch = (value) => {
    const lower = value.toLowerCase();
    setFilteredData(
      data.filter((item) =>
        item.code?.toLowerCase().includes(lower) ||
        item.name?.toLowerCase().includes(lower)
      )
    );
  };

  const isReadOnly = selectedId && !canUpdate;

  return (
    <MasterSplitView
      title="Departments"
      subtitle="Organization"
      addLabel="Add Department"
      data={filteredData}
      columns={columns}
      selectedId={selectedId}
      isEditing={isEditing}
      loading={loading}
      onAdd={canAdd ? handleAdd : undefined}
      onSelectRow={handleSelect}
      onSearch={handleSearch}
      onCloseForm={handleCancel}
      searchPlaceholder="Search departments..."
      renderForm={() => (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Sticky header */}
          <div className="master-form-header" style={{
            flexShrink: 0,
            position: 'sticky',
            top: 0,
            zIndex: 10,
            background: 'var(--card-bg, #fff)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-color, #f0f0f0)',
          }}>
            <div>
              <h2 style={{ margin: 0 }}>
                {selectedId ? (isReadOnly ? 'View Department' : 'Edit Department') : 'New Department'}
              </h2>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {selectedId ? 'Modify the department details below' : 'Create a new department under a factory'}
              </Text>
            </div>
            <Space>
              {selectedId && canDelete && (
                <Button danger onClick={handleDelete} icon={<DeleteOutlined />}>
                  Delete
                </Button>
              )}
              <Button onClick={handleCancel} icon={<CloseOutlined />}>
                {isReadOnly ? 'Close' : 'Cancel'}
              </Button>
              {!isReadOnly && (
                <PermissionGuard module={MODULE_ID} operation={selectedId ? 'update' : 'add'}>
                  <Button
                    type="primary"
                    onClick={() => form.submit()}
                    icon={<SaveOutlined />}
                    loading={submitting}
                    disabled={selectedId && !unsavedChanges}
                  >
                    Save
                  </Button>
                </PermissionGuard>
              )}
            </Space>
          </div>

          {/* Form content */}
          <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSave}
              disabled={isReadOnly}
              onValuesChange={() => { if (!skipDirty.current) markDirty(true); }}
            >
              <Form.Item name="code" label="Department Code" rules={[{ required: true, message: 'Please enter a department code' }]}>
                <Input placeholder="e.g. PROD" maxLength={20} />
              </Form.Item>
              <Form.Item name="name" label="Department Name" rules={[{ required: true, message: 'Please enter a department name' }]}>
                <Input placeholder="e.g. Production" maxLength={200} />
              </Form.Item>
              <Form.Item name="factoryId" label="Factory" rules={[{ required: true, message: 'Please select a factory' }]}>
                <Select placeholder="Select factory" options={factoryOptions} showSearch optionFilterProp="label" allowClear />
              </Form.Item>
              <Form.Item name="isActive" label="Active" valuePropName="checked">
                <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
              </Form.Item>
            </Form>
          </div>
        </div>
      )}
    />
  );
};

export default DepartmentMaster;
