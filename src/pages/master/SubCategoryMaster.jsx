import React, { useState, useEffect } from 'react';
import MasterSplitView from '../../components/MasterSplitView';
import { Form, Input, Button, Space, message, Tag, Select, Modal, Spin } from 'antd';
import { SaveOutlined, CloseOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useStore } from '../../context/StoreContext';
import { createSubCategory, updateSubCategory, deleteSubCategory } from '../../services/masterDataService';
import { hasPermission } from '../../utils/permissions';
import PermissionGuard from '../../components/PermissionGuard';

const MODULE_ID = 'master-data';

const SubCategoryMaster = () => {
  const { categories, subCategories, addItem, updateItem, removeItem } = useStore();
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
    setFilteredData(subCategories);
  }, [subCategories]);

  const getCategoryName = (id) => categories.find(c => c.id === id)?.name || 'Unknown';

  const columns = [
    { 
      title: 'Name', 
      dataIndex: 'name', 
      sorter: (a, b) => (a.name || '').localeCompare(b.name || '') 
    },
    { 
      title: 'Category', 
      dataIndex: 'categoryId', 
      render: (id) => <Tag color="blue">{getCategoryName(id)}</Tag> 
    },
  ];

  const handleAdd = () => {
    if (!canAdd) {
      message.warning('You do not have permission to add sub-categories');
      return;
    }
    setSelectedId(null);
    setIsEditing(true);
    form.resetFields();
  };

  const handleSelect = (record) => {
    if (!canView && !canUpdate) {
      message.warning('You do not have permission to view sub-category details');
      return;
    }
    setSelectedId(record.id);
    setIsEditing(true);
    form.setFieldsValue(record);
  };

  const handleSave = async (values) => {
    if (selectedId && !canUpdate) {
      message.warning('You do not have permission to update sub-categories');
      return;
    }
    if (!selectedId && !canAdd) {
      message.warning('You do not have permission to add sub-categories');
      return;
    }

    // Duplicate name validation within the same category
    const name = (values.name || '').trim().toLowerCase();
    if (!name) {
      message.error('Sub-category name is required');
      return;
    }
    const catId = values.categoryId;
    const exists = subCategories.some(sc => (sc.name || '').trim().toLowerCase() === name && sc.categoryId === catId && sc.id !== selectedId);
    if (exists) {
      message.error('Sub-category with this name already exists in the selected category');
      return;
    }

    setSubmitting(true);
    try {
      if (selectedId) {
        const response = await updateSubCategory(selectedId, values);
        const updatedItem = response || { id: selectedId, ...values };
        updateItem('subCategories', selectedId, updatedItem);
        message.success('Sub-category updated successfully');
      } else {
        const response = await createSubCategory(values);
        const newItem = response || { id: Date.now(), ...values };
        addItem('subCategories', newItem);
        setSelectedId(newItem.id);
        message.success('Sub-category created successfully');
      }
    } catch (error) {
      console.error('Failed to save sub-category:', error);
      message.error(selectedId ? 'Failed to update sub-category' : 'Failed to create sub-category');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!canDelete) {
      message.warning('You do not have permission to delete sub-categories');
      return;
    }

    Modal.confirm({
      title: 'Delete Sub-Category',
      icon: <ExclamationCircleOutlined />,
      content: 'Are you sure you want to delete this sub-category? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await deleteSubCategory(selectedId);
          removeItem('subCategories', selectedId);
          message.success('Sub-category deleted successfully');
          handleCancel();
        } catch (error) {
          console.error('Failed to delete sub-category:', error);
          message.error('Failed to delete sub-category');
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
    setFilteredData(subCategories.filter(item => 
      item.name?.toLowerCase().includes(lower) || 
      getCategoryName(item.categoryId).toLowerCase().includes(lower)
    ));
  };

  const isReadOnly = selectedId && !canUpdate;

  return (
    <MasterSplitView
      title="Sub Categories"
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
                {selectedId ? (isReadOnly ? 'View Sub Category' : 'Edit Sub Category') : 'New Sub Category'}
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
                name="categoryId" 
                label="Parent Category" 
                rules={[{ required: true, message: 'Please select a category' }]}
              >
                <Select
                  placeholder="Select Category"
                  size="large"
                  showSearch
                  options={categories.map(c => ({ value: c.id, label: c.name }))}
                />
              </Form.Item>
              <Form.Item 
                name="name" 
                label="Sub Category Name" 
                rules={[{ required: true, message: 'Please enter name' }]}
              >
                <Input placeholder="e.g. Cotton" size="large" />
              </Form.Item>
              <Form.Item name="description" label="Description">
                <Input.TextArea rows={4} />
              </Form.Item>
            </Form>
          </div>
        </Spin>
      )}
    />
  );
};

export default SubCategoryMaster;
