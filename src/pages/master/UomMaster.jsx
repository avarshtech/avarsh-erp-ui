import { useState, useEffect, useCallback, useRef } from 'react';
import MasterSplitView from '../../components/MasterSplitView';
import { Form, Input, Button, Space, App, Tag, InputNumber } from 'antd';
import { SaveOutlined, CloseOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { integerInputProps } from '../../utils/inputHelpers';
import { useStore } from '../../context/StoreContext';
import { createUOM, updateUOM, deleteUOM } from '../../services/masterDataService';
import { hasPermission } from '../../utils/permissions';
import PermissionGuard from '../../components/PermissionGuard';

const MODULE_ID = 'master-data';

const UomMaster = ({ onDirtyChange }) => {
  const { message, modal } = App.useApp();
  const { uoms, addItem, updateItem, removeItem } = useStore();
  const [filteredData, setFilteredData] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const markDirty = useCallback((dirty) => { setUnsavedChanges(dirty); onDirtyChange?.(dirty); }, [onDirtyChange]);
  const [form] = Form.useForm();
  const skipDirty = useRef(false);

  // Check permissions
  const canAdd = hasPermission(MODULE_ID, 'add');
  const canUpdate = hasPermission(MODULE_ID, 'update');
  const canDelete = hasPermission(MODULE_ID, 'delete');
  const canView = hasPermission(MODULE_ID, 'view');

  useEffect(() => {
    setFilteredData(uoms);
  }, [uoms]);

  const columns = [
    { 
      title: 'Symbol', 
      dataIndex: 'symbol', 
      width: 80, 
      render: (text) => text ? <Tag color="orange">{text}</Tag> : '-'
    },
    { 
      title: 'Name', 
      dataIndex: 'name', 
      sorter: (a, b) => (a.name || '').localeCompare(b.name || '') 
    },
  ];

  const handleAdd = () => {
    if (!canAdd) {
      message.warning('You do not have permission to add UOMs');
      return;
    }
    skipDirty.current = true;
    setSelectedId(null);
    setIsEditing(true);
    form.resetFields();
    form.setFieldsValue({ decimalPrecision: 2 });
    markDirty(false);
    setTimeout(() => { skipDirty.current = false; }, 300);
  };

  const handleSelect = (record) => {
    if (!canView && !canUpdate) {
      message.warning('You do not have permission to view UOM details');
      return;
    }
    skipDirty.current = true;
    setSelectedId(record.id);
    setIsEditing(true);
    form.setFieldsValue(record);
    markDirty(false);
    setTimeout(() => { skipDirty.current = false; }, 300);
  };

  const handleSave = async (values) => {
    if (selectedId && !canUpdate) {
      message.warning('You do not have permission to update UOMs');
      return;
    }
    if (!selectedId && !canAdd) {
      message.warning('You do not have permission to add UOMs');
      return;
    }

    // Duplicate name validation
    const name = (values.name || '').trim().toLowerCase();
    if (!name) {
      message.error('UOM name is required');
      return;
    }
    const exists = uoms.some(u => (u.name || '').trim().toLowerCase() === name && u.id !== selectedId);
    if (exists) {
      message.error('UOM with this name already exists');
      return;
    }

    setSubmitting(true);
    try {
      if (selectedId) {
        const selectedRecord = uoms.find(u => u.id === selectedId);
        const response = await updateUOM(selectedId, { ...values, version: selectedRecord?.version });
        const updatedItem = response?.data || { id: selectedId, ...values };
        updateItem('uoms', selectedId, updatedItem);
        message.success('UOM updated successfully');
      } else {
        const response = await createUOM(values);
        const newItem = response?.data || { id: Date.now(), ...values };
        addItem('uoms', newItem);
        setSelectedId(newItem.id);
        message.success('UOM created successfully');
      }
      markDirty(false);
      setIsEditing(false);
      setSelectedId(null);
    } catch (error) {
      // Error toast already shown by axiosInstance interceptor
      console.error('Failed to save UOM:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!canDelete) {
      message.warning('You do not have permission to delete UOMs');
      return;
    }

    modal.confirm({
      title: 'Delete UOM',
      icon: <ExclamationCircleOutlined />,
      content: 'Are you sure you want to delete this UOM? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await deleteUOM(selectedId);
          removeItem('uoms', selectedId);
          message.success('UOM deleted successfully');
          handleCancel();
        } catch (error) {
          // Error toast already shown by axiosInstance interceptor
          console.error('Failed to delete UOM:', error);
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
    setFilteredData(uoms.filter(item => 
      item.name?.toLowerCase().includes(lower) || 
      (item.symbol && item.symbol.toLowerCase().includes(lower))
    ));
  };

  const isReadOnly = selectedId && !canUpdate;

  return (
    <MasterSplitView
      title="Unit of Measurement"
      subtitle="Item"
      addLabel="Add UOM"
      data={filteredData}
      columns={columns}
      selectedId={selectedId}
      isEditing={isEditing}
      onAdd={canAdd ? handleAdd : undefined}
      onSelectRow={handleSelect}
      onSearch={handleSearch}
      onCloseForm={handleCancel}
      renderForm={() => (
          <div style={{ padding: 24 }}>
            <div className="master-form-header" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 24,
              borderBottom: '1px solid #f0f0f0',
              paddingBottom: 16
            }}>
              <h2 style={{ margin: 0 }}>
                {selectedId ? (isReadOnly ? 'View UOM' : 'Edit UOM') : 'New UOM'}
              </h2>
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
                name="name" 
                label="UOM Name" 
                rules={[{ required: true, message: 'Please enter UOM name' }]}
              >
                <Input placeholder="e.g. Kilogram" size="large" />
              </Form.Item>
              <Form.Item 
                name="symbol" 
                label="Symbol" 
                rules={[{ required: true, message: 'Please enter symbol' }]}
              >
                <Input placeholder="e.g. kg" style={{ width: '50%' }} />
              </Form.Item>
              <Form.Item name="decimalPrecision" label="Decimal Precision">
                <InputNumber min={0} max={6} style={{ width: '50%' }} {...integerInputProps} />
              </Form.Item>
            </Form>
          </div>
      )}
    />
  );
};

export default UomMaster;
