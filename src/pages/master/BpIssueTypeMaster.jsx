import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import MasterSplitView from '../../components/MasterSplitView';
import { Form, Input, Button, Space, Switch, App, Tag, InputNumber } from 'antd';
import { SaveOutlined, CloseOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { integerInputProps } from '../../utils/inputHelpers';
import { listIssueTypes, saveIssueType, deleteIssueType } from '../../services/inventory/billPassingService';
import { BP_MODULE_ID } from '../../utils/billPassingConstants';
import { hasPermission } from '../../utils/permissions';
import PermissionGuard from '../../components/PermissionGuard';

const BpIssueTypeMaster = ({ onDirtyChange }) => {
  const { message, modal } = App.useApp();
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [form] = Form.useForm();
  const skipDirty = useRef(false);

  const canAdd = hasPermission(BP_MODULE_ID, 'add');
  const canUpdate = hasPermission(BP_MODULE_ID, 'update');
  const canDelete = hasPermission(BP_MODULE_ID, 'delete');

  const markDirty = useCallback((dirty) => { setUnsavedChanges(dirty); onDirtyChange?.(dirty); }, [onDirtyChange]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listIssueTypes();
      setData(list);
      setFilteredData(list);
    } catch (e) {
      message.error(e.message || 'Failed to load issue types');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { loadData(); }, [loadData]);

  const columns = useMemo(() => [
    { title: 'Code', dataIndex: 'code', width: 210, render: (v) => <Tag color="blue">{v}</Tag> },
    { title: 'Name', dataIndex: 'name', sorter: (a, b) => (a.name || '').localeCompare(b.name || '') },
    { title: 'Blocking', dataIndex: 'blocking', align: 'center', width: 120, render: (v) => (v ? <Tag color="error">Blocking</Tag> : <Tag color="default">Advisory</Tag>) },
    { title: 'Status', dataIndex: 'active', align: 'center', width: 100, render: (v) => (v ? <Tag color="success">Active</Tag> : <Tag>Inactive</Tag>) },
  ], []);

  const handleAdd = useCallback(() => {
    if (!canAdd) { message.warning('You do not have permission to add issue types'); return; }
    skipDirty.current = true;
    setSelectedId(null);
    setIsEditing(true);
    form.resetFields();
    form.setFieldsValue({ blocking: false, active: true, sortOrder: (data.length + 1) * 10 });
    markDirty(false);
    setTimeout(() => { skipDirty.current = false; }, 300);
  }, [canAdd, data.length, form, markDirty, message]);

  const handleSelect = useCallback((record) => {
    skipDirty.current = true;
    setSelectedId(record.id);
    setIsEditing(true);
    form.setFieldsValue(record);
    markDirty(false);
    setTimeout(() => { skipDirty.current = false; }, 300);
  }, [form, markDirty]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setSelectedId(null);
    form.resetFields();
    markDirty(false);
  }, [form, markDirty]);

  const handleSave = useCallback(async (values) => {
    const code = (values.code || '').trim().toUpperCase();
    const name = (values.name || '').trim();
    if (!code) { message.error('Issue type code is required'); return; }
    if (!name) { message.error('Issue type name is required'); return; }
    if (data.some((r) => (r.code || '').toUpperCase() === code && r.id !== selectedId)) {
      message.error('An issue type with this code already exists');
      return;
    }
    if (data.some((r) => (r.name || '').trim().toLowerCase() === name.toLowerCase() && r.id !== selectedId)) {
      message.error('An issue type with this name already exists');
      return;
    }

    setSubmitting(true);
    try {
      await saveIssueType({ ...values, code, name, id: selectedId || undefined });
      message.success(selectedId ? 'Issue type updated' : 'Issue type created');
      await loadData();
      handleCancel();
    } catch (e) {
      message.error(e.message || 'Failed to save issue type');
    } finally {
      setSubmitting(false);
    }
  }, [data, selectedId, loadData, handleCancel, message]);

  const handleDelete = useCallback(() => {
    modal.confirm({
      title: 'Delete Issue Type',
      icon: <ExclamationCircleOutlined />,
      content: 'This permanently removes the issue type. A type already used on a bill cannot be deleted — switch it to Inactive instead so past bills keep their history. Continue?',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await deleteIssueType(selectedId);
          message.success('Issue type deleted');
          await loadData();
          handleCancel();
        } catch (e) {
          message.error(e.message || 'Failed to delete issue type');
        }
      },
    });
  }, [modal, selectedId, loadData, handleCancel, message]);

  const handleSearch = useCallback((value) => {
    const lower = value.trim().toLowerCase();
    setFilteredData(data.filter((r) => (r.name || '').toLowerCase().includes(lower) || (r.code || '').toLowerCase().includes(lower)));
  }, [data]);

  const isReadOnly = !!selectedId && !canUpdate;

  return (
    <MasterSplitView
      title="Issue Types"
      subtitle="Bill Passing"
      addLabel="Add Issue Type"
      data={filteredData}
      columns={columns}
      loading={loading}
      selectedId={selectedId}
      isEditing={isEditing}
      onAdd={canAdd ? handleAdd : undefined}
      onSelectRow={handleSelect}
      onSearch={handleSearch}
      onCloseForm={handleCancel}
      searchPlaceholder="Search code or name..."
      renderForm={() => (
        <div style={{ padding: 24 }}>
          <div className="master-form-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottom: '1px solid var(--border-color)', paddingBottom: 16 }}>
            <h2 style={{ margin: 0 }}>{selectedId ? (isReadOnly ? 'View Issue Type' : 'Edit Issue Type') : 'New Issue Type'}</h2>
            <Space>
              {selectedId && canDelete && <Button danger onClick={handleDelete} icon={<DeleteOutlined />}>Delete</Button>}
              <Button onClick={handleCancel} icon={<CloseOutlined />}>{isReadOnly ? 'Close' : 'Cancel'}</Button>
              {!isReadOnly && (
                <PermissionGuard module={BP_MODULE_ID} operation={selectedId ? 'update' : 'add'}>
                  <Button type="primary" onClick={() => form.submit()} icon={<SaveOutlined />} loading={submitting} disabled={!!selectedId && !unsavedChanges}>
                    Save Changes
                  </Button>
                </PermissionGuard>
              )}
            </Space>
          </div>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSave}
            disabled={isReadOnly}
            onValuesChange={() => { if (!skipDirty.current) markDirty(true); }}
          >
            <Form.Item
              name="code"
              label="Code"
              normalize={(v) => (v || '').toUpperCase()}
              extra={selectedId ? 'Locked once saved — bills store this code against their logged issues.' : 'Uppercase, e.g. INVOICE_MISMATCH. Cannot be changed after saving.'}
              rules={[{ required: true, message: 'Please enter a code' }]}
            >
              <Input placeholder="e.g. INVOICE_MISMATCH" style={{ width: '60%' }} disabled={!!selectedId} />
            </Form.Item>
            <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Please enter a name' }]}>
              <Input placeholder="e.g. Invoice Mismatch" size="large" />
            </Form.Item>
            <Form.Item name="blocking" label="Blocking" valuePropName="checked" extra="an open issue of this type stops the bill reaching approval">
              <Switch />
            </Form.Item>
            <Form.Item name="sortOrder" label="Sort Order" extra="position of this type in the issue dropdown">
              <InputNumber min={0} max={9999} style={{ width: '40%' }} {...integerInputProps} />
            </Form.Item>
            <Form.Item name="active" label="Active" valuePropName="checked" extra="inactive types stay on old bills but are no longer offered on new ones">
              <Switch />
            </Form.Item>
          </Form>
        </div>
      )}
    />
  );
};

export default BpIssueTypeMaster;
