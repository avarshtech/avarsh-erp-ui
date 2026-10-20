import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import MasterSplitView from '../../../components/MasterSplitView';
import { Form, Input, Button, Space, App, Tag, Switch, Typography, Select } from 'antd';
import { SaveOutlined, CloseOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { getAllDesignations, createDesignation, updateDesignation, deleteDesignation } from '../../../services/master/hrMasterService';
import { getActiveDepartments } from '../../../services/master/hrMasterService';
import { getActiveUnits } from '../../../services/master/unitService';
import { hasPermission } from '../../../utils/permissions';
import PermissionGuard from '../../../components/PermissionGuard';
import { EMPLOYEE_CATEGORY } from '../../../utils/hrConstants';

const { Text } = Typography;

const MODULE_ID = 'hr-masters';

const DesignationMaster = ({ onDirtyChange }) => {
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

  const [departments, setDepartments] = useState([]);
  const [units, setUnits] = useState([]);
  // Which unit the form is currently filtering departments by.
  const selectedUnitId = Form.useWatch('unitId', form);

  const canAdd = hasPermission(MODULE_ID, 'add');
  const canUpdate = hasPermission(MODULE_ID, 'update');
  const canDelete = hasPermission(MODULE_ID, 'delete');
  const canView = hasPermission(MODULE_ID, 'view');

  const unitOptions = useMemo(() =>
    units.map(u => ({ value: u.id, label: u.unitName })),
  [units]);

  // Only the chosen unit's departments. Two units can both have a "Sewing", and
  // an unfiltered list would show both under the same label with nothing to tell
  // them apart - which is exactly how a designation ends up on the wrong one.
  const departmentOptions = useMemo(() =>
    departments
      .filter(d => !selectedUnitId || d.unitId === selectedUnitId)
      .map(d => ({ value: d.id, label: d.name })),
  [departments, selectedUnitId]);

  const departmentMap = useMemo(() => {
    const map = {};
    departments.forEach(d => { map[d.id] = d.name; });
    return map;
  }, [departments]);

  const unitMap = useMemo(() => {
    const map = {};
    units.forEach(u => { map[u.id] = u.unitName; });
    return map;
  }, [units]);

  const categoryMap = useMemo(() => {
    const map = {};
    EMPLOYEE_CATEGORY.forEach(c => { map[c.value] = c.label; });
    return map;
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAllDesignations();
      const list = Array.isArray(result) ? result : (result?.data || []);
      setData(list);
      setFilteredData(list);
    } catch {
      // axiosInstance already toasts the server's message; adding another here showed two.
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDepartments = useCallback(async () => {
    try {
      const result = await getActiveDepartments();
      const list = Array.isArray(result) ? result : (result?.data || []);
      setDepartments(list);
    } catch {
      // Silent — department dropdown will just be empty
    }
  }, []);

  const fetchUnits = useCallback(async () => {
    try {
      const result = await getActiveUnits();
      setUnits(Array.isArray(result) ? result : (result?.data || []));
    } catch {
      // Silent — the unit dropdown will just be empty
    }
  }, []);

  useEffect(() => { fetchData(); fetchDepartments(); fetchUnits(); }, [fetchData, fetchDepartments, fetchUnits]);

  const columns = [
    {
      // Unit then department then designation - the chain that actually
      // identifies the row. "Helper" alone identifies nothing.
      title: 'Unit',
      dataIndex: 'unitId',
      width: 150,
      sorter: (a, b) => (unitMap[a.unitId] || '').localeCompare(unitMap[b.unitId] || ''),
      render: (val, row) => unitMap[val] || row.unitName || '—',
    },
    {
      title: 'Department',
      dataIndex: 'departmentId',
      width: 150,
      render: (val, row) => departmentMap[val] || row.departmentName || '—',
    },
    {
      title: 'Designation',
      dataIndex: 'name',
      sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      width: 100,
      render: (val) => val ? <Tag>{categoryMap[val] || val}</Tag> : '—',
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
    if (!canAdd) { message.warning('You do not have permission to add designations'); return; }
    skipDirty.current = true;
    setSelectedId(null);
    setIsEditing(true);
    form.resetFields();
    form.setFieldsValue({ isActive: true });
    markDirty(false);
    setTimeout(() => { skipDirty.current = false; }, 300);
  };

  const handleSelect = (record) => {
    if (!canView && !canUpdate) { message.warning('You do not have permission to view designations'); return; }
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
    if (selectedId && !canUpdate) { message.warning('You do not have permission to update designations'); return; }
    if (!selectedId && !canAdd) { message.warning('You do not have permission to add designations'); return; }

    setSubmitting(true);
    try {
      if (selectedId) {
        const selectedRecord = data.find(r => r.id === selectedId);
        await updateDesignation(selectedId, { ...values, version: selectedRecord?.version });
        message.success('Designation updated successfully');
      } else {
        await createDesignation(values);
        message.success('Designation created successfully');
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
    if (!canDelete) { message.warning('You do not have permission to delete designations'); return; }
    modal.confirm({
      title: 'Delete Designation',
      icon: <ExclamationCircleOutlined />,
      content: 'Are you sure you want to delete this designation? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await deleteDesignation(selectedId);
          message.success('Designation deleted successfully');
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
        item.category?.toLowerCase().includes(lower)
      )
    );
  };

  const isReadOnly = selectedId && !canUpdate;

  return (
    <MasterSplitView orderBy="id"
      title="Designations"
      subtitle="Organization"
      addLabel="Add Designation"
      data={filteredData}
      columns={columns}
      selectedId={selectedId}
      isEditing={isEditing}
      loading={loading}
      onAdd={canAdd ? handleAdd : undefined}
      onSelectRow={handleSelect}
      onSearch={handleSearch}
      onCloseForm={handleCancel}
      searchPlaceholder="Search designations..."
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
                {selectedId ? (isReadOnly ? 'View Designation' : 'Edit Designation') : 'New Designation'}
              </h2>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {selectedId ? 'Modify the designation details below' : 'Create a new designation under a department'}
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
              {/* Unit, then department, then the name - the order the thing is built in. */}
              <Form.Item
                name="unitId"
                label="Unit"
                rules={[{ required: true, message: 'Please select the unit' }]}
              >
                <Select
                  placeholder="Select unit"
                  options={unitOptions}
                  showSearch
                  optionFilterProp="label"
                  onChange={() => form.setFieldValue('departmentId', undefined)}
                />
              </Form.Item>
              <Form.Item
                name="departmentId"
                label="Department"
                extra="Only this unit's departments are listed."
                rules={[{ required: true, message: 'Please select the department this designation belongs to' }]}
              >
                <Select
                  placeholder={selectedUnitId ? 'Select department' : 'Pick a unit first'}
                  disabled={!selectedUnitId}
                  options={departmentOptions}
                  showSearch
                  optionFilterProp="label"
                />
              </Form.Item>
              <Form.Item name="name" label="Designation Name" rules={[{ required: true, message: 'Please enter a designation name' }]}>
                <Input placeholder="e.g. Packer" maxLength={200} />
              </Form.Item>
              <Form.Item name="category" label="Employee Category" rules={[{ required: true, message: 'Please select a category' }]}>
                <Select placeholder="Select category" options={EMPLOYEE_CATEGORY} allowClear />
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

export default DesignationMaster;
