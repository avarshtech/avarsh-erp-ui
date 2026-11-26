import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import MasterSplitView from '../../../components/MasterSplitView';
import { Form, Input, Button, Space, App, Tag, Switch, Typography, Alert } from 'antd';
import { SaveOutlined, CloseOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import {
  getContractors, createContractor, updateContractor, deleteContractor,
} from '../../../services/hr/contractorService';

const { Text } = Typography;

/**
 * Labour contractors - administrator only.
 *
 * HrDashboard shows this tab to the superuser alone, and the server refuses every
 * call from anyone else, so no permission checks are repeated here: whoever can
 * see this screen may do everything on it.
 */
const ContractorMaster = ({ onDirtyChange }) => {
  const { message, modal } = App.useApp();
  const [data, setData] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const markDirty = useCallback((dirty) => { setUnsavedChanges(dirty); onDirtyChange?.(dirty); }, [onDirtyChange]);
  const [form] = Form.useForm();
  const skipDirty = useRef(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getContractors());
    } catch {
      // axiosInstance already toasts the server's message.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredData = useMemo(() => {
    const lower = search.toLowerCase();
    return data.filter((c) => c.name?.toLowerCase().includes(lower) || c.contactPerson?.toLowerCase().includes(lower));
  }, [data, search]);

  const columns = useMemo(() => [
    { title: 'Contractor', dataIndex: 'name', sorter: (a, b) => (a.name || '').localeCompare(b.name || '') },
    { title: 'Contact', dataIndex: 'contactPerson', width: 140, render: (v) => v || '—' },
    { title: 'Workers', dataIndex: 'employeeCount', width: 90, align: 'right' },
    {
      title: 'Status', dataIndex: 'isActive', width: 90,
      render: (val) => (val === false ? <Tag color="default">Inactive</Tag> : <Tag color="green">Active</Tag>),
    },
  ], []);

  const open = (record) => {
    skipDirty.current = true;
    setSelectedId(record?.id ?? null);
    setIsEditing(true);
    form.resetFields();
    form.setFieldsValue(record ? { ...record, isActive: record.isActive !== false } : { isActive: true });
    markDirty(false);
    setTimeout(() => { skipDirty.current = false; }, 300);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSelectedId(null);
    form.resetFields();
    markDirty(false);
  };

  const handleSave = async (values) => {
    setSubmitting(true);
    try {
      if (selectedId) {
        const current = data.find((r) => r.id === selectedId);
        await updateContractor(selectedId, { ...values, version: current?.version });
        message.success('Contractor updated');
      } else {
        await createContractor(values);
        message.success('Contractor added');
      }
      handleCancel();
      fetchData();
    } catch {
      // Error toast already shown by axiosInstance interceptor
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    modal.confirm({
      title: 'Delete Contractor',
      icon: <ExclamationCircleOutlined />,
      content: 'A contractor who has ever supplied a worker cannot be deleted - mark them Inactive instead.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteContractor(selectedId);
          message.success('Contractor deleted');
          handleCancel();
          fetchData();
        } catch {
          // Error toast already shown by axiosInstance interceptor
        }
      },
    });
  };

  return (
    <MasterSplitView orderBy="id"
      title="Contractors"
      subtitle="Administrator only"
      addLabel="Add Contractor"
      data={filteredData}
      columns={columns}
      selectedId={selectedId}
      isEditing={isEditing}
      loading={loading}
      onAdd={() => open(null)}
      onSelectRow={open}
      onSearch={setSearch}
      onCloseForm={handleCancel}
      searchPlaceholder="Search contractors..."
      renderForm={() => (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div className="master-form-header" style={{
            flexShrink: 0, position: 'sticky', top: 0, zIndex: 10,
            background: 'var(--card-bg, #fff)', display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--border-color, #f0f0f0)',
          }}>
            <div>
              <h2 style={{ margin: 0 }}>{selectedId ? 'Edit Contractor' : 'New Contractor'}</h2>
              <Text type="secondary" style={{ fontSize: 12 }}>Labour contractor supplying contract workers</Text>
            </div>
            <Space>
              {selectedId && <Button danger onClick={handleDelete} icon={<DeleteOutlined />}>Delete</Button>}
              <Button onClick={handleCancel} icon={<CloseOutlined />}>Cancel</Button>
              <Button type="primary" onClick={() => form.submit()} icon={<SaveOutlined />}
                loading={submitting} disabled={selectedId && !unsavedChanges}>
                Save
              </Button>
            </Space>
          </div>

          <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              title="Only the administrator sees contractors"
              description="To everyone else a contract worker shows as an ordinary employee of their unit. Link a worker to a contractor from the employee form (Employee Type = Contract)."
            />
            <Form form={form} layout="vertical" onFinish={handleSave}
              onValuesChange={() => { if (!skipDirty.current) markDirty(true); }}>
              <Form.Item name="name" label="Contractor Name" rules={[{ required: true, whitespace: true, message: 'Please enter the contractor name' }]}>
                <Input placeholder="e.g. Suresh & Raja" maxLength={150} />
              </Form.Item>
              <Form.Item name="contactPerson" label="Contact Person">
                <Input maxLength={150} />
              </Form.Item>
              <Form.Item name="phone" label="Phone">
                <Input maxLength={20} />
              </Form.Item>
              <Form.Item name="address" label="Address">
                <Input.TextArea rows={2} maxLength={500} />
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

export default ContractorMaster;
