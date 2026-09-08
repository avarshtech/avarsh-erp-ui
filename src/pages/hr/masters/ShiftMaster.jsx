import { useState, useEffect, useCallback, useRef } from 'react';
import MasterSplitView from '../../../components/MasterSplitView';
import { Form, Input, InputNumber, Button, Space, App, Tag, Switch, Typography, TimePicker } from 'antd';
import { SaveOutlined, CloseOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getAllShifts, createShift, updateShift, deleteShift } from '../../../services/master/hrMasterService';
import { hasPermission } from '../../../utils/permissions';
import PermissionGuard from '../../../components/PermissionGuard';

const { Text } = Typography;

const MODULE_ID = 'hr-masters';
const TIME_FORMAT = 'HH:mm';

const ShiftMaster = ({ onDirtyChange }) => {
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
      const result = await getAllShifts();
      const list = Array.isArray(result) ? result : (result?.data || []);
      setData(list);
      setFilteredData(list);
    } catch {
      // axiosInstance already toasts the server's message; adding another here showed two.
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
      title: 'Timing',
      width: 120,
      render: (_, record) => {
        const start = record.startTime || '—';
        const end = record.endTime || '—';
        return `${start} - ${end}`;
      },
    },
    {
      title: 'Break',
      dataIndex: 'breakMinutes',
      width: 80,
      render: (val) => val ? `${val} min` : '—',
    },
    {
      title: 'Night Shift',
      dataIndex: 'isNightShift',
      width: 100,
      render: (val) => val ? <Tag color="purple">Yes</Tag> : <Tag color="default">No</Tag>,
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
    if (!canAdd) { message.warning('You do not have permission to add shifts'); return; }
    skipDirty.current = true;
    setSelectedId(null);
    setIsEditing(true);
    form.resetFields();
    form.setFieldsValue({ isActive: true, isNightShift: false, breakMinutes: 30 });
    markDirty(false);
    setTimeout(() => { skipDirty.current = false; }, 300);
  };

  const handleSelect = (record) => {
    if (!canView && !canUpdate) { message.warning('You do not have permission to view shifts'); return; }
    skipDirty.current = true;
    setSelectedId(record.id);
    setIsEditing(true);
    form.setFieldsValue({
      ...record,
      startTime: record.startTime ? dayjs(record.startTime, TIME_FORMAT) : null,
      endTime: record.endTime ? dayjs(record.endTime, TIME_FORMAT) : null,
      isActive: record.isActive !== false,
      isNightShift: record.isNightShift || false,
    });
    markDirty(false);
    setTimeout(() => { skipDirty.current = false; }, 300);
  };

  const handleSave = async (values) => {
    if (selectedId && !canUpdate) { message.warning('You do not have permission to update shifts'); return; }
    if (!selectedId && !canAdd) { message.warning('You do not have permission to add shifts'); return; }

    setSubmitting(true);
    try {
      const payload = {
        ...values,
        startTime: values.startTime ? values.startTime.format(TIME_FORMAT) : null,
        endTime: values.endTime ? values.endTime.format(TIME_FORMAT) : null,
      };
      if (selectedId) {
        const selectedRecord = data.find(r => r.id === selectedId);
        await updateShift(selectedId, { ...payload, version: selectedRecord?.version });
        message.success('Shift updated successfully');
      } else {
        await createShift(payload);
        message.success('Shift created successfully');
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
    if (!canDelete) { message.warning('You do not have permission to delete shifts'); return; }
    modal.confirm({
      title: 'Delete Shift',
      icon: <ExclamationCircleOutlined />,
      content: 'Are you sure you want to delete this shift? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await deleteShift(selectedId);
          message.success('Shift deleted successfully');
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
      title="Shifts"
      subtitle="Work Schedule"
      addLabel="Add Shift"
      data={filteredData}
      columns={columns}
      selectedId={selectedId}
      isEditing={isEditing}
      loading={loading}
      onAdd={canAdd ? handleAdd : undefined}
      onSelectRow={handleSelect}
      onSearch={handleSearch}
      onCloseForm={handleCancel}
      searchPlaceholder="Search shifts..."
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
                {selectedId ? (isReadOnly ? 'View Shift' : 'Edit Shift') : 'New Shift'}
              </h2>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {selectedId ? 'Modify the shift details below' : 'Define a new work shift schedule'}
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
              <Form.Item name="code" label="Shift Code" rules={[{ required: true, message: 'Please enter a shift code' }]}>
                <Input placeholder="e.g. GEN" maxLength={20} />
              </Form.Item>
              <Form.Item name="name" label="Shift Name" rules={[{ required: true, message: 'Please enter a shift name' }]}>
                <Input placeholder="e.g. General Shift" maxLength={200} />
              </Form.Item>
              <Form.Item name="startTime" label="Start Time" rules={[{ required: true, message: 'Please select a start time' }]}>
                <TimePicker format={TIME_FORMAT} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="endTime" label="End Time" rules={[{ required: true, message: 'Please select an end time' }]}>
                <TimePicker format={TIME_FORMAT} style={{ width: '100%' }} />
              </Form.Item>
              {/* NOT NULL in the schema, so an empty box has to mean zero rather
                  than nothing. */}
              <Form.Item
                name="breakMinutes"
                label="Break Duration (minutes)"
                rules={[{ required: true, message: 'Enter the break duration, or 0 for none' }]}
              >
                <InputNumber min={0} max={120} placeholder="e.g. 30" style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="isNightShift" label="Night Shift" valuePropName="checked">
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
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

export default ShiftMaster;
