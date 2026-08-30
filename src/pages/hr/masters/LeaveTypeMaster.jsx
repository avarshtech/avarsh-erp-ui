import { useState, useEffect, useCallback, useRef } from 'react';
import MasterSplitView from '../../../components/MasterSplitView';
import { Form, Input, InputNumber, Button, Space, App, Tag, Switch, Typography, Select } from 'antd';
import { SaveOutlined, CloseOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { getAllLeaveTypes, createLeaveType, updateLeaveType, deleteLeaveType } from '../../../services/master/hrMasterService';
import { hasPermission } from '../../../utils/permissions';
import PermissionGuard from '../../../components/PermissionGuard';
import { LEAVE_ACCRUAL_TYPES, EMPLOYEE_CATEGORY } from '../../../utils/hrConstants';

const { Text } = Typography;

const MODULE_ID = 'hr-masters';

const LeaveTypeMaster = ({ onDirtyChange }) => {
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

  const accrualMap = {};
  LEAVE_ACCRUAL_TYPES.forEach(t => { accrualMap[t.value] = t.label; });

  const applicableCategoryOptions = [
    { value: null, label: 'All Categories' },
    ...EMPLOYEE_CATEGORY,
  ];

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAllLeaveTypes();
      const list = Array.isArray(result) ? result : (result?.data || []);
      setData(list);
      setFilteredData(list);
    } catch {
      message.error('Failed to load leave types');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = [
    {
      title: 'Code',
      dataIndex: 'code',
      width: 80,
      sorter: (a, b) => (a.code || '').localeCompare(b.code || ''),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
    },
    {
      title: 'Days/Year',
      dataIndex: 'daysPerYear',
      width: 90,
      render: (val) => val ?? '—',
    },
    {
      title: 'Accrual',
      dataIndex: 'accrualType',
      width: 90,
      render: (val) => accrualMap[val] || val || '—',
    },
    {
      title: 'Carry Forward',
      dataIndex: 'isCarryForward',
      width: 110,
      render: (val) => val ? <Tag color="blue">Yes</Tag> : <Tag color="default">No</Tag>,
    },
    {
      title: 'Encashable',
      dataIndex: 'isEncashable',
      width: 100,
      render: (val) => val ? <Tag color="green">Yes</Tag> : <Tag color="default">No</Tag>,
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
    if (!canAdd) { message.warning('You do not have permission to add leave types'); return; }
    skipDirty.current = true;
    setSelectedId(null);
    setIsEditing(true);
    form.resetFields();
    form.setFieldsValue({
      isActive: true,
      isCarryForward: false,
      isEncashable: false,
      accrualType: 'MONTHLY',
      daysPerYear: 12,
      applicableCategory: null,
    });
    markDirty(false);
    setTimeout(() => { skipDirty.current = false; }, 300);
  };

  const handleSelect = (record) => {
    if (!canView && !canUpdate) { message.warning('You do not have permission to view leave types'); return; }
    skipDirty.current = true;
    setSelectedId(record.id);
    setIsEditing(true);
    form.setFieldsValue({
      ...record,
      isActive: record.isActive !== false,
      isCarryForward: record.isCarryForward || false,
      isEncashable: record.isEncashable || false,
    });
    markDirty(false);
    setTimeout(() => { skipDirty.current = false; }, 300);
  };

  const handleSave = async (values) => {
    if (selectedId && !canUpdate) { message.warning('You do not have permission to update leave types'); return; }
    if (!selectedId && !canAdd) { message.warning('You do not have permission to add leave types'); return; }

    setSubmitting(true);
    try {
      const payload = { ...values };
      if (!payload.isCarryForward) {
        payload.maxCarryForward = null;
      }
      if (selectedId) {
        const selectedRecord = data.find(r => r.id === selectedId);
        await updateLeaveType(selectedId, { ...payload, version: selectedRecord?.version });
        message.success('Leave type updated successfully');
      } else {
        await createLeaveType(payload);
        message.success('Leave type created successfully');
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
    if (!canDelete) { message.warning('You do not have permission to delete leave types'); return; }
    modal.confirm({
      title: 'Delete Leave Type',
      icon: <ExclamationCircleOutlined />,
      content: 'Are you sure you want to delete this leave type? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await deleteLeaveType(selectedId);
          message.success('Leave type deleted successfully');
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
        item.name?.toLowerCase().includes(lower) ||
        item.accrualType?.toLowerCase().includes(lower)
      )
    );
  };

  const isReadOnly = selectedId && !canUpdate;

  const isCarryForward = Form.useWatch('isCarryForward', form);

  return (
    <MasterSplitView
      title="Leave Types"
      subtitle="Leave Policy"
      addLabel="Add Leave Type"
      data={filteredData}
      columns={columns}
      selectedId={selectedId}
      isEditing={isEditing}
      loading={loading}
      onAdd={canAdd ? handleAdd : undefined}
      onSelectRow={handleSelect}
      onSearch={handleSearch}
      onCloseForm={handleCancel}
      searchPlaceholder="Search leave types..."
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
                {selectedId ? (isReadOnly ? 'View Leave Type' : 'Edit Leave Type') : 'New Leave Type'}
              </h2>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {selectedId ? 'Modify the leave type details below' : 'Define a new leave type policy'}
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
              <Form.Item name="code" label="Leave Code" rules={[{ required: true, message: 'Please enter a leave code' }]}>
                <Input placeholder="e.g. CL" maxLength={20} />
              </Form.Item>
              <Form.Item name="name" label="Leave Name" rules={[{ required: true, message: 'Please enter a leave name' }]}>
                <Input placeholder="e.g. Casual Leave" maxLength={200} />
              </Form.Item>
              <Form.Item name="daysPerYear" label="Days Per Year" rules={[{ required: true, message: 'Please enter days per year' }]}>
                <InputNumber min={0} max={365} precision={1} placeholder="e.g. 12" style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="accrualType" label="Accrual Type" rules={[{ required: true, message: 'Please select an accrual type' }]}>
                <Select placeholder="Select accrual type" options={LEAVE_ACCRUAL_TYPES} />
              </Form.Item>
              <Form.Item name="isCarryForward" label="Carry Forward" valuePropName="checked">
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
              </Form.Item>
              {isCarryForward && (
                <Form.Item name="maxCarryForward" label="Max Carry Forward Days">
                  <InputNumber min={0} max={365} precision={1} placeholder="e.g. 5" style={{ width: '100%' }} />
                </Form.Item>
              )}
              <Form.Item name="isEncashable" label="Encashable" valuePropName="checked">
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
              </Form.Item>
              <Form.Item name="maxAccumulation" label="Max Accumulation Days">
                <InputNumber min={0} max={999} precision={1} placeholder="e.g. 30" style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="applicableCategory" label="Applicable Category" tooltip="Leave empty for all categories">
                <Select placeholder="All Categories" options={applicableCategoryOptions} allowClear />
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

export default LeaveTypeMaster;
