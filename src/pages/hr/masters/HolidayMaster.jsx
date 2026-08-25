import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import MasterSplitView from '../../../components/MasterSplitView';
import { Form, Input, Button, Space, App, Tag, Switch, Typography, Select, DatePicker } from 'antd';
import { SaveOutlined, CloseOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getHolidaysByYear, createHoliday, updateHoliday, deleteHoliday } from '../../../services/master/hrMasterService';
import { getActiveFactories } from '../../../services/master/factoryService';
import { hasPermission } from '../../../utils/permissions';
import PermissionGuard from '../../../components/PermissionGuard';
import { HOLIDAY_TYPES } from '../../../utils/hrConstants';

const { Text } = Typography;

const MODULE_ID = 'hr-masters';

const HolidayMaster = ({ onDirtyChange }) => {
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
  const [filterYear, setFilterYear] = useState(dayjs().year());

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

  const holidayTypeMap = useMemo(() => {
    const map = {};
    HOLIDAY_TYPES.forEach(t => { map[t.value] = t; });
    return map;
  }, []);

  // Generate year options (current year -1 to +2)
  const yearOptions = useMemo(() => {
    const current = dayjs().year();
    return Array.from({ length: 4 }, (_, i) => {
      const y = current - 1 + i;
      return { value: y, label: String(y) };
    });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getHolidaysByYear(filterYear);
      const list = Array.isArray(result) ? result : (result?.data || []);
      setData(list);
      setFilteredData(list);
    } catch {
      // axiosInstance already toasts the server's message; adding another here showed two.
    } finally {
      setLoading(false);
    }
  }, [filterYear]);

  const fetchFactories = useCallback(async () => {
    try {
      const result = await getActiveFactories();
      const list = Array.isArray(result) ? result : (result?.data || []);
      setFactories(list);
    } catch {
      // Silent
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchFactories(); }, [fetchFactories]);

  const columns = [
    {
      title: 'Date',
      dataIndex: 'holidayDate',
      width: 110,
      sorter: (a, b) => (a.holidayDate || '').localeCompare(b.holidayDate || ''),
      render: (val) => val ? dayjs(val).format('DD MMM YYYY') : '—',
    },
    {
      title: 'Name',
      dataIndex: 'name',
      sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
    },
    {
      title: 'Type',
      dataIndex: 'holidayType',
      width: 140,
      render: (val) => {
        const ht = holidayTypeMap[val];
        return ht ? <Tag color={ht.color}>{ht.label}</Tag> : (val || '—');
      },
    },
    {
      title: 'Factory',
      dataIndex: 'factoryId',
      width: 120,
      render: (val) => factoryMap[val] || 'All',
    },
    {
      title: 'Paid',
      dataIndex: 'isPaid',
      width: 70,
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
    if (!canAdd) { message.warning('You do not have permission to add holidays'); return; }
    skipDirty.current = true;
    setSelectedId(null);
    setIsEditing(true);
    form.resetFields();
    form.setFieldsValue({ isActive: true, isPaid: true, holidayType: 'NATIONAL' });
    markDirty(false);
    setTimeout(() => { skipDirty.current = false; }, 300);
  };

  const handleSelect = (record) => {
    if (!canView && !canUpdate) { message.warning('You do not have permission to view holidays'); return; }
    skipDirty.current = true;
    setSelectedId(record.id);
    setIsEditing(true);
    form.setFieldsValue({
      ...record,
      holidayDate: record.holidayDate ? dayjs(record.holidayDate) : null,
      isActive: record.isActive !== false,
      isPaid: record.isPaid !== false,
    });
    markDirty(false);
    setTimeout(() => { skipDirty.current = false; }, 300);
  };

  const handleSave = async (values) => {
    if (selectedId && !canUpdate) { message.warning('You do not have permission to update holidays'); return; }
    if (!selectedId && !canAdd) { message.warning('You do not have permission to add holidays'); return; }

    setSubmitting(true);
    try {
      const payload = {
        ...values,
        holidayDate: values.holidayDate ? values.holidayDate.format('YYYY-MM-DD') : null,
        year: values.holidayDate ? values.holidayDate.year() : filterYear,
      };
      if (selectedId) {
        const selectedRecord = data.find(r => r.id === selectedId);
        await updateHoliday(selectedId, { ...payload, version: selectedRecord?.version });
        message.success('Holiday updated successfully');
      } else {
        await createHoliday(payload);
        message.success('Holiday created successfully');
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
    if (!canDelete) { message.warning('You do not have permission to delete holidays'); return; }
    modal.confirm({
      title: 'Delete Holiday',
      icon: <ExclamationCircleOutlined />,
      content: 'Are you sure you want to delete this holiday? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await deleteHoliday(selectedId);
          message.success('Holiday deleted successfully');
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
        item.name?.toLowerCase().includes(lower) ||
        item.holidayType?.toLowerCase().includes(lower)
      )
    );
  };

  const isReadOnly = selectedId && !canUpdate;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Year filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexShrink: 0 }}>
        <Text type="secondary" style={{ fontSize: 13 }}>Year:</Text>
        <Select
          value={filterYear}
          onChange={setFilterYear}
          options={yearOptions}
          style={{ width: 100 }}
          size="small"
        />
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <MasterSplitView
          title="Holidays"
          subtitle="Work Schedule"
          addLabel="Add Holiday"
          data={filteredData}
          columns={columns}
          selectedId={selectedId}
          isEditing={isEditing}
          loading={loading}
          onAdd={canAdd ? handleAdd : undefined}
          onSelectRow={handleSelect}
          onSearch={handleSearch}
          onCloseForm={handleCancel}
          searchPlaceholder="Search holidays..."
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
                    {selectedId ? (isReadOnly ? 'View Holiday' : 'Edit Holiday') : 'New Holiday'}
                  </h2>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {selectedId ? 'Modify the holiday details below' : 'Add a new holiday to the calendar'}
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
                  <Form.Item name="name" label="Holiday Name" rules={[{ required: true, message: 'Please enter a holiday name' }]}>
                    <Input placeholder="e.g. Republic Day" maxLength={200} />
                  </Form.Item>
                  <Form.Item name="holidayDate" label="Date" rules={[{ required: true, message: 'Please select a date' }]}>
                    <DatePicker format="DD MMM YYYY" style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item name="holidayType" label="Holiday Type" rules={[{ required: true, message: 'Please select a type' }]}>
                    <Select placeholder="Select type" options={HOLIDAY_TYPES} allowClear />
                  </Form.Item>
                  <Form.Item name="factoryId" label="Factory" tooltip="Leave empty if applicable to all factories">
                    <Select placeholder="All factories" options={factoryOptions} showSearch optionFilterProp="label" allowClear />
                  </Form.Item>
                  <Form.Item name="isPaid" label="Paid Holiday" valuePropName="checked">
                    <Switch checkedChildren="Paid" unCheckedChildren="Unpaid" />
                  </Form.Item>
                  <Form.Item name="isActive" label="Active" valuePropName="checked">
                    <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
                  </Form.Item>
                </Form>
              </div>
            </div>
          )}
        />
      </div>
    </div>
  );
};

export default HolidayMaster;
