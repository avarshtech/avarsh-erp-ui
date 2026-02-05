import React, { useState, useEffect } from 'react';
import MasterSplitView from '../../components/MasterSplitView';
import { Form, Input, Button, Space, message, Tag, Select, Modal, Spin } from 'antd';
import { SaveOutlined, CloseOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useStore } from '../../context/StoreContext';
import { createItemType, updateItemType, deleteItemType } from '../../services/masterDataService';
import { hasPermission } from '../../utils/permissions';
import PermissionGuard from '../../components/PermissionGuard';

const MODULE_ID = 'master-data';

const ItemTypeMaster = () => {
  const { itemTypes, subCategories, attributes, uoms, addItem, updateItem, removeItem } = useStore();
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
    setFilteredData(itemTypes);
  }, [itemTypes]);

  const getSubCategoryName = (id) => subCategories.find(s => s.id === id)?.name || 'Unknown';

  const columns = [
    { 
      title: 'Name', 
      dataIndex: 'name', 
      sorter: (a, b) => (a.name || '').localeCompare(b.name || '') 
    },
    { 
      title: 'Sub Category', 
      dataIndex: 'subCategoryId', 
      render: (id) => id ? <Tag color="blue">{getSubCategoryName(id)}</Tag> : '-'
    },
  ];

  const handleAdd = () => {
    if (!canAdd) {
      message.warning('You do not have permission to add item types');
      return;
    }
    setSelectedId(null);
    setIsEditing(true);
    form.resetFields();
    form.setFieldsValue({ attributeIds: [], uomIds: [] });
  };

  const handleSelect = (record) => {
    if (!canView && !canUpdate) {
      message.warning('You do not have permission to view item type details');
      return;
    }
    setSelectedId(record.id);
    setIsEditing(true);
    form.setFieldsValue({
      ...record,
      attributeIds: record.attributeIds || record.attributes?.map(a => a.id) || [],
      uomIds: record.uomIds || record.uoms?.map(u => u.id) || [],
    });
  };

  const handleSave = async (values) => {
    if (selectedId && !canUpdate) {
      message.warning('You do not have permission to update item types');
      return;
    }
    if (!selectedId && !canAdd) {
      message.warning('You do not have permission to add item types');
      return;
    }

    // Duplicate name validation within the same sub-category
    const name = (values.name || '').trim().toLowerCase();
    if (!name) {
      message.error('Item type name is required');
      return;
    }
    const subCatId = values.subCategoryId;
    const exists = itemTypes.some(it => (it.name || '').trim().toLowerCase() === name && it.subCategoryId === subCatId && it.id !== selectedId);
    if (exists) {
      message.error('Item type with this name already exists in the selected sub-category');
      return;
    }

    setSubmitting(true);
    try {
      if (selectedId) {
        const response = await updateItemType(selectedId, values);
        const updatedItem = response || { id: selectedId, ...values };
        updateItem('itemTypes', selectedId, updatedItem);
        message.success('Item type updated successfully');
      } else {
        const response = await createItemType(values);
        const newItem = response || { id: Date.now(), ...values };
        addItem('itemTypes', newItem);
        setSelectedId(newItem.id);
        message.success('Item type created successfully');
      }
    } catch (error) {
      console.error('Failed to save item type:', error);
      message.error(selectedId ? 'Failed to update item type' : 'Failed to create item type');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!canDelete) {
      message.warning('You do not have permission to delete item types');
      return;
    }

    Modal.confirm({
      title: 'Delete Item Type',
      icon: <ExclamationCircleOutlined />,
      content: 'Are you sure you want to delete this item type? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await deleteItemType(selectedId);
          removeItem('itemTypes', selectedId);
          message.success('Item type deleted successfully');
          handleCancel();
        } catch (error) {
          console.error('Failed to delete item type:', error);
          message.error('Failed to delete item type');
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
    setFilteredData(itemTypes.filter(item => 
      item.name?.toLowerCase().includes(lower)
    ));
  };

  const isReadOnly = selectedId && !canUpdate;

  return (
    <MasterSplitView
      title="Item Types"
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
                {selectedId ? (isReadOnly ? 'View Item Type' : 'Edit Item Type') : 'New Item Type'}
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
                name="subCategoryId" 
                label="Sub Category"
              >
                <Select 
                  placeholder="Select Sub Category" 
                  size="large"
                  showSearch
                  allowClear
                  optionFilterProp="children"
                >
                  {subCategories.map(s => (
                    <Select.Option key={s.id} value={s.id}>{s.name}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item 
                name="name" 
                label="Item Type Name" 
                rules={[{ required: true, message: 'Please enter item type name' }]}
              >
                <Input placeholder="e.g. Raw Material" size="large"/>
              </Form.Item>
              <Form.Item name="description" label="Description">
                <Input.TextArea rows={3} />
              </Form.Item>
              <Form.Item 
                name="attributeIds" 
                label="Attributes"
              >
                <Select 
                  mode="multiple"
                  placeholder="Select Attributes" 
                  size="large"
                  showSearch
                  optionFilterProp="children"
                >
                  {attributes.map(a => (
                    <Select.Option key={a.id} value={a.id}>{a.attributeName || a.name}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item 
                name="uomIds" 
                label="Units of Measure"
              >
                <Select 
                  mode="multiple"
                  placeholder="Select UOMs" 
                  size="large"
                  showSearch
                  optionFilterProp="children"
                >
                  {uoms.map(u => (
                    <Select.Option key={u.id} value={u.id}>{u.name}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Form>
          </div>
        </Spin>
      )}
    />
  );
};

export default ItemTypeMaster;
