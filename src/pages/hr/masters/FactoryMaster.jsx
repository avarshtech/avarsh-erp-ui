import { useState, useEffect, useCallback, useRef } from 'react';
import MasterSplitView from '../../../components/MasterSplitView';
import { Form, Input, Button, Space, App, Tag, Switch, Typography, Select } from 'antd';
import { SaveOutlined, CloseOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { getAllFactories, createFactory, updateFactory, deleteFactory } from '../../../services/factoryService';
import { hasPermission } from '../../../utils/permissions';
import PermissionGuard from '../../../components/PermissionGuard';
import { INDIAN_STATES } from '../../../utils/hrConstants';

const { Text } = Typography;

const MODULE_ID = 'hr-masters';

const FactoryMaster = ({ onDirtyChange }) => {
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

  const canAdd = hasPermission(MODULE_ID, 'add');
  const canUpdate = hasPermission(MODULE_ID, 'update');
  const canDelete = hasPermission(MODULE_ID, 'delete');
  const canView = hasPermission(MODULE_ID, 'view');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAllFactories();
      const list = Array.isArray(result) ? result : (result?.data || []);
      setData(list);
      setFilteredData(list);
    } catch {
      message.error('Failed to load factories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = [
    {
      title: 'Factory Code',
      dataIndex: 'factoryCode',
      sorter: (a, b) => (a.factoryCode || '').localeCompare(b.factoryCode || ''),
    },
    {
      title: 'Factory Name',
      dataIndex: 'factoryName',
      sorter: (a, b) => (a.factoryName || '').localeCompare(b.factoryName || ''),
    },
    {
      title: 'City',
      dataIndex: 'city',
      width: 120,
    },
    {
      title: 'State',
      dataIndex: 'state',
      width: 120,
      render: (val) => {
        const found = INDIAN_STATES.find(s => s.value === val);
        return found ? found.label : val || '—';
      },
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
    if (!canAdd) { message.warning('You do not have permission to add factories'); return; }
    skipDirty.current = true;
    setSelectedId(null);
    setIsEditing(true);
    form.resetFields();
    form.setFieldsValue({ isActive: true });
    markDirty(false);
    setTimeout(() => { skipDirty.current = false; }, 300);
  };

  const handleSelect = (record) => {
    if (!canView && !canUpdate) { message.warning('You do not have permission to view factories'); return; }
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
    if (selectedId && !canUpdate) { message.warning('You do not have permission to update factories'); return; }
    if (!selectedId && !canAdd) { message.warning('You do not have permission to add factories'); return; }

    setSubmitting(true);
    try {
      if (selectedId) {
        const selectedRecord = data.find(r => r.id === selectedId);
        await updateFactory(selectedId, { ...values, version: selectedRecord?.version });
        message.success('Factory updated successfully');
      } else {
        await createFactory(values);
        message.success('Factory created successfully');
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
    if (!canDelete) { message.warning('You do not have permission to delete factories'); return; }
    modal.confirm({
      title: 'Delete Factory',
      icon: <ExclamationCircleOutlined />,
      content: 'Are you sure you want to delete this factory? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await deleteFactory(selectedId);
          message.success('Factory deleted successfully');
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
        item.factoryCode?.toLowerCase().includes(lower) ||
        item.factoryName?.toLowerCase().includes(lower) ||
        item.city?.toLowerCase().includes(lower)
      )
    );
  };

  const isReadOnly = selectedId && !canUpdate;

  return (
    <MasterSplitView
      title="Factories"
      subtitle="Organization"
      addLabel="Add Factory"
      data={filteredData}
      columns={columns}
      selectedId={selectedId}
      isEditing={isEditing}
      loading={loading}
      onAdd={canAdd ? handleAdd : undefined}
      onSelectRow={handleSelect}
      onSearch={handleSearch}
      onCloseForm={handleCancel}
      searchPlaceholder="Search factories..."
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
                {selectedId ? (isReadOnly ? 'View Factory' : 'Edit Factory') : 'New Factory'}
              </h2>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {selectedId ? 'Modify the factory details below' : 'Add a new factory location'}
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
              <Form.Item name="factoryCode" label="Factory Code" rules={[{ required: true, message: 'Please enter a factory code' }]}>
                <Input placeholder="e.g. FAC-001" maxLength={20} />
              </Form.Item>
              <Form.Item name="factoryName" label="Factory Name" rules={[{ required: true, message: 'Please enter a factory name' }]}>
                <Input placeholder="e.g. Tirupur Unit 1" maxLength={200} />
              </Form.Item>
              <Form.Item name="address" label="Address">
                <Input.TextArea rows={2} placeholder="Street address" maxLength={500} />
              </Form.Item>
              <Form.Item name="city" label="City">
                <Input placeholder="e.g. Tirupur" maxLength={100} />
              </Form.Item>
              <Form.Item name="state" label="State">
                <Select placeholder="Select state" options={INDIAN_STATES} showSearch optionFilterProp="label" allowClear />
              </Form.Item>
              <Form.Item name="pincode" label="Pincode">
                <Input placeholder="e.g. 641604" maxLength={10} />
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

export default FactoryMaster;
