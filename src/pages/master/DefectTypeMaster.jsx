import { useState, useEffect, useCallback, useRef } from 'react';
import MasterSplitView from '../../components/MasterSplitView';
import { Form, Input, Button, Space, Switch, App, Tag } from 'antd';
import { SaveOutlined, CloseOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import {
  getDefectTypes,
  createDefectType,
  updateDefectType,
  deleteDefectType,
} from '../../services/master/defectTypeService';

const DefectTypeMaster = ({ onDirtyChange }) => {
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

  const markDirty = useCallback((dirty) => { setUnsavedChanges(dirty); onDirtyChange?.(dirty); }, [onDirtyChange]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getDefectTypes();
      setData(list);
      setFilteredData(list);
    } catch {
      message.error('Failed to load defect types');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { loadData(); }, [loadData]);

  const columns = [
    { title: 'Name', dataIndex: 'name', align: 'center', sorter: (a, b) => (a.name || '').localeCompare(b.name || '') },
    { title: 'Description', dataIndex: 'description', align: 'center', ellipsis: true },
    { title: 'Status', dataIndex: 'active', align: 'center', render: (v) => v ? <Tag color="success">Active</Tag> : <Tag>Inactive</Tag> },
  ];

  const handleAdd = () => {
    skipDirty.current = true;
    setSelectedId(null);
    setIsEditing(true);
    form.resetFields();
    form.setFieldsValue({ active: true });
    markDirty(false);
    setTimeout(() => { skipDirty.current = false; }, 300);
  };

  const handleSelect = (record) => {
    skipDirty.current = true;
    setSelectedId(record.id);
    setIsEditing(true);
    form.setFieldsValue(record);
    markDirty(false);
    setTimeout(() => { skipDirty.current = false; }, 300);
  };

  const handleSave = async (values) => {
    const name = (values.name || '').trim();
    if (!name) { message.error('Defect type name is required'); return; }
    const exists = data.some((d) => (d.name || '').trim().toLowerCase() === name.toLowerCase() && d.id !== selectedId);
    if (exists) { message.error('Defect type with this name already exists'); return; }

    setSubmitting(true);
    try {
      if (selectedId) {
        const updated = await updateDefectType(selectedId, values);
        setData((prev) => prev.map((d) => d.id === selectedId ? updated : d));
        setFilteredData((prev) => prev.map((d) => d.id === selectedId ? updated : d));
        message.success('Defect type updated');
      } else {
        const created = await createDefectType(values);
        setData((prev) => [...prev, created]);
        setFilteredData((prev) => [...prev, created]);
        message.success('Defect type created');
      }
      markDirty(false);
      setIsEditing(false);
      setSelectedId(null);
    } catch {
      message.error('Failed to save defect type');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    modal.confirm({
      title: 'Delete Defect Type',
      icon: <ExclamationCircleOutlined />,
      content: 'This will permanently delete the defect type. Deletion is blocked if it is already used by QC records — use the Active switch to deactivate instead. Continue?',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteDefectType(selectedId);
          await loadData();
          message.success('Defect type deleted');
          handleCancel();
        } catch {
          message.error('Failed to delete defect type');
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
    setFilteredData(data.filter((item) => item.name?.toLowerCase().includes(lower) || (item.description && item.description.toLowerCase().includes(lower))));
  };

  return (
    <MasterSplitView
      title="Defect Types"
      subtitle="Quality Control"
      addLabel="Add Defect Type"
      data={filteredData}
      columns={columns}
      loading={loading}
      selectedId={selectedId}
      isEditing={isEditing}
      onAdd={handleAdd}
      onSelectRow={handleSelect}
      onSearch={handleSearch}
      onCloseForm={handleCancel}
      renderForm={() => (
        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottom: '1px solid var(--border-color, #f0f0f0)', paddingBottom: 16 }}>
            <h2 style={{ margin: 0 }}>{selectedId ? 'Edit Defect Type' : 'New Defect Type'}</h2>
            <Space>
              {selectedId && <Button danger onClick={handleDelete} icon={<DeleteOutlined />}>Delete</Button>}
              <Button onClick={handleCancel} icon={<CloseOutlined />}>Cancel</Button>
              <Button type="primary" onClick={() => form.submit()} icon={<SaveOutlined />} loading={submitting} disabled={selectedId && !unsavedChanges}>
                Save
              </Button>
            </Space>
          </div>
          <Form form={form} layout="vertical" onFinish={handleSave} onValuesChange={() => { if (!skipDirty.current) markDirty(true); }}>
            <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Please enter defect type name' }]}>
              <Input placeholder="e.g. Hole" size="large" />
            </Form.Item>
            <Form.Item name="description" label="Description">
              <Input.TextArea rows={3} placeholder="Description of the defect type..." />
            </Form.Item>
            <Form.Item name="active" label="Active" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Form>
        </div>
      )}
    />
  );
};

export default DefectTypeMaster;
