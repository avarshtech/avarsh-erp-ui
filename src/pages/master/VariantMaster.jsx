import React, { useState, useEffect, useCallback, useRef } from 'react';
import MasterSplitView from '../../components/MasterSplitView';
import { Form, Input, Button, Space, App, Tag, Select } from 'antd';
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

const VariantMaster = ({ onDirtyChange }) => {
  const { message, modal } = App.useApp();
  const { attributes, addItem, updateItem, removeItem } = useStore();
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
    skipDirty.current = true;
    setSelectedId(null);
    setIsEditing(true);
    form.resetFields();
    form.setFieldsValue({ dataType: 'string', values: [] });
    markDirty(false);
    setTimeout(() => { skipDirty.current = false; }, 300);
  };

  const handleSelect = (record) => {
    if (!canView && !canUpdate) {
      message.warning('You do not have permission to view attribute details');
      return;
    }
    skipDirty.current = true;
    setSelectedId(record.id);
    setIsEditing(true);
    form.setFieldsValue({
      ...record,
      attributeName: record.attributeName || record.name,
      values: record.values || [],
    });
    markDirty(false);
    setTimeout(() => { skipDirty.current = false; }, 300);
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
        const selectedRecord = attributes.find(a => a.id === selectedId);
        const response = await updateAttribute(selectedId, { ...values, version: selectedRecord?.version });
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
      markDirty(false);
      setIsEditing(false);
      setSelectedId(null);
    } catch (error) {
      // Error toast already shown by axiosInstance interceptor
      console.error('Failed to save attribute:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!canDelete) {
      message.warning('You do not have permission to delete attributes');
      return;
    }

    modal.confirm({
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
          // Error toast already shown by axiosInstance interceptor
          console.error('Failed to delete attribute:', error);
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
    setFilteredData(attributes.filter(item => 
      (item.attributeName || item.name || '').toLowerCase().includes(lower)
    ));
  };

  const isReadOnly = selectedId && !canUpdate;
  const dataType = Form.useWatch('dataType', form);

  return (
    <MasterSplitView
      title="Variants / Attributes"
      subtitle="Item"
      addLabel="Add Attribute"
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
      )}
    />
  );
};

export default VariantMaster;
