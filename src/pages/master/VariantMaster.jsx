import React, { useState, useEffect } from 'react';
import MasterSplitView from '../../components/MasterSplitView';
import { Form, Input, Button, Space, message, Tag, Select, Modal, Spin } from 'antd';
import { SaveOutlined, CloseOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useStore } from '../../context/StoreContext';
import { createAttribute, updateAttribute, deleteAttribute } from '../../services/masterDataService';
import { hasPermission } from '../../utils/permissions';
import PermissionGuard from '../../components/PermissionGuard';

const MODULE_ID = 'master-data';

// Data type options for attribute configuration
const DATA_TYPES = [
  { value: 'string', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Yes/No' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' },
  { value: 'multiselect', label: 'Multi-Select' },
];

const VariantMaster = () => {
  const { attributes, addItem, updateItem, removeItem } = useStore();
  const [filteredData, setFilteredData] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  // Check permissions
  const canAdd = hasPermission(MODULE_ID, 'add');
  const canUpdate = hasPermission(MODULE_ID, 'update');
  const canDelete = hasPermission(MODULE_ID, 'delete');
  const canView = hasPermission(MODULE_ID, 'view');

  useEffect(() => {
    setFilteredData(attributes);
  }, [attributes]);

  const columns = [
    { 
      title: 'Name', 
      dataIndex: 'attributeName', 
      sorter: (a, b) => (a.attributeName || '').localeCompare(b.attributeName || ''),
      render: (text, record) => text || record.name 
    },
    { 
      title: 'Data Type', 
      dataIndex: 'dataType', 
      render: (type) => {
        const found = DATA_TYPES.find(d => d.value === type);
        return <Tag color="blue">{found?.label || type || '-'}</Tag>;
      }
    },
  ];

  const handleAdd = () => {
    if (!canAdd) {
      message.warning('You do not have permission to add attributes');
      return;
    }
    setSelectedId(null);
    setIsEditing(true);
    form.resetFields();
    form.setFieldsValue({ dataType: 'string', values: [] });
  };

  const handleSelect = (record) => {
    if (!canView && !canUpdate) {
      message.warning('You do not have permission to view attribute details');
      return;
    }
    setSelectedId(record.id);
    setIsEditing(true);
    form.setFieldsValue({
      ...record,
      attributeName: record.attributeName || record.name,
      values: record.values || [],
    });
  };

  const handleSave = async (values) => {
    if (selectedId && !canUpdate) {
      message.warning('You do not have permission to update attributes');
      return;
    }
    if (!selectedId && !canAdd) {
      message.warning('You do not have permission to add attributes');
      return;
    }

    // Duplicate attribute/variant name validation
    const name = (values.attributeName || values.name || '').trim().toLowerCase();
    if (!name) {
      message.error('Attribute name is required');
      return;
    }
    const exists = attributes.some(a => ((a.attributeName || a.name || '').trim().toLowerCase() === name) && a.id !== selectedId);
    if (exists) {
      message.error('Attribute with this name already exists');
      return;
    }

    setSubmitting(true);
    try {
      if (selectedId) {
        const response = await updateAttribute(selectedId, values);
        const updatedItem = response?.data || { id: selectedId, ...values };
        updateItem('attributes', selectedId, updatedItem);
        message.success('Attribute updated successfully');
      } else {
        const response = await createAttribute(values);
        const newItem = response?.data || { id: Date.now(), ...values };
        addItem('attributes', newItem);
        setSelectedId(newItem.id);
        message.success('Attribute created successfully');
      }
    } catch (error) {
      console.error('Failed to save attribute:', error);
      message.error(selectedId ? 'Failed to update attribute' : 'Failed to create attribute');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!canDelete) {
      message.warning('You do not have permission to delete attributes');
      return;
    }

    Modal.confirm({
      title: 'Delete Attribute',
      icon: <ExclamationCircleOutlined />,
      content: 'Are you sure you want to delete this attribute? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await deleteAttribute(selectedId);
          removeItem('attributes', selectedId);
          message.success('Attribute deleted successfully');
          handleCancel();
        } catch (error) {
          console.error('Failed to delete attribute:', error);
          message.error('Failed to delete attribute');
        }
      },
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSelectedId(null);
    form.resetFields();
  };

  const handleSearch = (value) => {
    const lower = value.toLowerCase();
    setFilteredData(attributes.filter(item => 
      (item.attributeName || item.name || '').toLowerCase().includes(lower)
    ));
  };

  const isReadOnly = selectedId && !canUpdate;
  const dataType = Form.useWatch('dataType', form);

  return (
    <MasterSplitView
      title="Variants / Attributes"
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
                {selectedId ? (isReadOnly ? 'View Attribute' : 'Edit Attribute') : 'New Attribute'}
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
            >
              <Form.Item 
                name="attributeName" 
                label="Attribute Name" 
                rules={[{ required: true, message: 'Please enter attribute name' }]}
              >
                <Input placeholder="e.g. Color, Size" size="large" />
              </Form.Item>
              <Form.Item 
                name="dataType" 
                label="Data Type" 
                rules={[{ required: true, message: 'Please select data type' }]}
              >
                <Select
                  placeholder="Select data type"
                  size="large"
                  options={DATA_TYPES}
                />
              </Form.Item>
              {(dataType === 'select' || dataType === 'multiselect') && (
                <Form.Item 
                  name="values" 
                  label="Dropdown Options"
                  tooltip="Type and press enter to add values"
                >
                  <Select 
                    mode="tags" 
                    placeholder="Type and press enter to add values" 
                    style={{ width: '100%' }} 
                    tokenSeparators={[',']} 
                  />
                </Form.Item>
              )}
            </Form>
          </div>
        </Spin>
      )}
    />
  );
};

export default VariantMaster;
