import React, { useState, useEffect } from 'react';
import MasterSplitView from '../../components/MasterSplitView';
import { Form, Input, Button, Space, message, Tag, InputNumber, Modal, Spin } from 'antd';
import { SaveOutlined, CloseOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useStore } from '../../context/StoreContext';
import { createUOM, updateUOM, deleteUOM } from '../../services/masterDataService';
import { hasPermission } from '../../utils/permissions';
import PermissionGuard from '../../components/PermissionGuard';

const MODULE_ID = 'master-data';

const UomMaster = () => {
  const { uoms, addItem, updateItem, removeItem } = useStore();
  const [filteredData, setFilteredData] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [form] = Form.useForm();

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
    setSelectedId(null);
    setIsEditing(true);
    form.resetFields();
    form.setFieldsValue({ decimalPrecision: 2 });
    setUnsavedChanges(false);
  };

  const handleSelect = (record) => {
    if (!canView && !canUpdate) {
      message.warning('You do not have permission to view UOM details');
      return;
    }
    setSelectedId(record.id);
    setIsEditing(true);
    form.setFieldsValue(record);
    setUnsavedChanges(false);
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
        const response = await updateUOM(selectedId, values);
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
    } catch (error) {
      console.error('Failed to save UOM:', error);
      message.error(selectedId ? 'Failed to update UOM' : 'Failed to create UOM');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!canDelete) {
      message.warning('You do not have permission to delete UOMs');
      return;
    }

    Modal.confirm({
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
          console.error('Failed to delete UOM:', error);
          message.error('Failed to delete UOM');
        }
      },
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSelectedId(null);
    form.resetFields();
    setUnsavedChanges(false);
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
      title="Unit of Measure"
      data={filteredData}
      columns={columns}
      selectedId={selectedId}
      isEditing={isEditing}
      onAdd={canAdd ? handleAdd : undefined}
      onSelectRow={handleSelect}
      onSearch={handleSearch}
      renderForm={() => (
        <Spin spinning={submitting}>
          <div style={{ padding: 24 }}>
            <div style={{ 
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
              onValuesChange={() => setUnsavedChanges(true)}
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
                <InputNumber min={0} max={6} style={{ width: '50%' }} />
              </Form.Item>
            </Form>
          </div>
        </Spin>
      )}
    />
  );
};

export default UomMaster;
