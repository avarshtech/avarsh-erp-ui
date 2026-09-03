import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import MasterSplitView from '../../components/MasterSplitView';
import { Form, Input, Button, Space, Switch, App, Tag } from 'antd';
import { SaveOutlined, CloseOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { getAllCouriers, createCourier, updateCourier, deleteCourier } from '../../services/master/courierService';
import { hasPermission } from '../../utils/permissions';
import { toastUnlessHandled } from '../../utils/apiError';
import PermissionGuard from '../../components/PermissionGuard';

const MODULE_ID = 'couriers';

/**
 * Courier master — the carriers a sample dispatch can go out with. "Hand
 * delivery" is a courier row too (flagged local) because the dispatch screen
 * picks a carrier either way; the flag is what hides the tracking number and
 * freight cost for a walk-over to the buying office.
 */
const CourierMaster = ({ onDirtyChange }) => {
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

  const canAdd = hasPermission(MODULE_ID, 'add');
  const canUpdate = hasPermission(MODULE_ID, 'update');
  const canDelete = hasPermission(MODULE_ID, 'delete');

  const markDirty = useCallback((dirty) => { setUnsavedChanges(dirty); onDirtyChange?.(dirty); }, [onDirtyChange]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // includeInactive: a retired carrier must stay visible here to be revived
      const { data: list } = await getAllCouriers(true);
      setData(list || []);
      setFilteredData(list || []);
    } catch (e) {
      toastUnlessHandled(message, e, 'Failed to load couriers');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { loadData(); }, [loadData]);

  const columns = useMemo(() => [
    { title: 'Courier', dataIndex: 'name', sorter: (a, b) => (a.name || '').localeCompare(b.name || '') },
    {
      title: 'Delivery',
      dataIndex: 'isLocal',
      align: 'center',
      width: 140,
      render: (v) => (v ? <Tag color="purple">Hand Delivery</Tag> : <Tag color="blue">Carrier</Tag>),
    },
    {
      title: 'Status',
      dataIndex: 'active',
      align: 'center',
      width: 100,
      render: (v) => (v === false ? <Tag>Inactive</Tag> : <Tag color="success">Active</Tag>),
    },
  ], []);

  const openForm = useCallback((record) => {
    skipDirty.current = true;
    setSelectedId(record?.id ?? null);
    setIsEditing(true);
    if (record) form.setFieldsValue({ ...record, active: record.active !== false });
    else { form.resetFields(); form.setFieldsValue({ isLocal: false, active: true }); }
    markDirty(false);
    setTimeout(() => { skipDirty.current = false; }, 300);
  }, [form, markDirty]);

  const handleAdd = useCallback(() => {
    if (!canAdd) { message.warning('You do not have permission to add couriers'); return; }
    openForm(null);
  }, [canAdd, openForm, message]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setSelectedId(null);
    form.resetFields();
    markDirty(false);
  }, [form, markDirty]);

  const handleSave = useCallback(async (values) => {
    const name = (values.name || '').trim();
    // The server rejects a duplicate too; checking here keeps the message next
    // to the field instead of arriving as a toast after a round trip
    if (data.some((c) => (c.name || '').trim().toLowerCase() === name.toLowerCase() && c.id !== selectedId)) {
      message.error('A courier with this name already exists');
      return;
    }

    setSubmitting(true);
    try {
      const payload = { name, isLocal: !!values.isLocal, active: values.active !== false };
      if (selectedId) {
        await updateCourier(selectedId, { ...payload, version: data.find((c) => c.id === selectedId)?.version });
      } else {
        await createCourier(payload);
      }
      message.success(selectedId ? 'Courier updated' : 'Courier created');
      await loadData();
      handleCancel();
    } catch (e) {
      toastUnlessHandled(message, e, 'Failed to save courier');
    } finally {
      setSubmitting(false);
    }
  }, [data, selectedId, loadData, handleCancel, message]);

  const handleDelete = useCallback(() => {
    modal.confirm({
      title: 'Delete Courier',
      icon: <ExclamationCircleOutlined />,
      content: 'This permanently removes the courier. One already used on a dispatch cannot be deleted — switch it to Inactive instead so past dispatches keep their carrier. Continue?',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await deleteCourier(selectedId);
          message.success('Courier deleted');
          await loadData();
          handleCancel();
        } catch (e) {
          toastUnlessHandled(message, e, 'Failed to delete courier');
        }
      },
    });
  }, [modal, selectedId, loadData, handleCancel, message]);

  const handleSearch = useCallback((value) => {
    const lower = value.trim().toLowerCase();
    setFilteredData(data.filter((c) => (c.name || '').toLowerCase().includes(lower)));
  }, [data]);

  const isReadOnly = !!selectedId && !canUpdate;

  return (
    <MasterSplitView
      title="Couriers"
      subtitle="Sampling"
      addLabel="Add Courier"
      data={filteredData}
      columns={columns}
      loading={loading}
      selectedId={selectedId}
      isEditing={isEditing}
      onAdd={canAdd ? handleAdd : undefined}
      onSelectRow={openForm}
      onSearch={handleSearch}
      onCloseForm={handleCancel}
      searchPlaceholder="Search couriers..."
      renderForm={() => (
        <div style={{ padding: 24 }}>
          <div className="master-form-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottom: '1px solid var(--border-color)', paddingBottom: 16 }}>
            <h2 style={{ margin: 0 }}>{selectedId ? (isReadOnly ? 'View Courier' : 'Edit Courier') : 'New Courier'}</h2>
            <Space>
              {selectedId && canDelete && <Button danger onClick={handleDelete} icon={<DeleteOutlined />}>Delete</Button>}
              <Button onClick={handleCancel} icon={<CloseOutlined />}>{isReadOnly ? 'Close' : 'Cancel'}</Button>
              {!isReadOnly && (
                <PermissionGuard module={MODULE_ID} operation={selectedId ? 'update' : 'add'}>
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
            <Form.Item name="name" label="Courier Name" rules={[{ required: true, message: 'Please enter a courier name' }]}>
              <Input placeholder="e.g. DHL Express" size="large" maxLength={150} />
            </Form.Item>
            <Form.Item name="isLocal" label="Hand Delivery" valuePropName="checked" extra="handed over in person — the dispatch then asks for a buying office and who took it, not a tracking number">
              <Switch />
            </Form.Item>
            <Form.Item name="active" label="Active" valuePropName="checked" extra="inactive couriers stay on past dispatches but are no longer offered on new ones">
              <Switch />
            </Form.Item>
          </Form>
        </div>
      )}
    />
  );
};

export default CourierMaster;
