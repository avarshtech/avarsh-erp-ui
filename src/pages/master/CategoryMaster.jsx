import { useState, useEffect, useCallback, useRef } from 'react';
import MasterSplitView from '../../components/MasterSplitView';
import { Form, Input, Button, Space, App } from 'antd';
import { SaveOutlined, CloseOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useStore } from '../../context/StoreContext';
import { createCategory, updateCategory, deleteCategory } from '../../services/masterDataService';
import { hasPermission } from '../../utils/permissions';
import PermissionGuard from '../../components/PermissionGuard';

const MODULE_ID = 'master-data';

const CategoryMaster = ({ onDirtyChange }) => {
  const { message, modal } = App.useApp();
  const { categories, addItem, updateItem, removeItem } = useStore();
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

  // Update filtered data when categories change
  useEffect(() => {
    setFilteredData(categories);
  }, [categories]);

  const columns = [
    { 
      title: 'Name', 
      dataIndex: 'name', 
      sorter: (a, b) => (a.name || '').localeCompare(b.name || '') 
    },
    { 
      title: 'Description', 
      dataIndex: 'description',
      ellipsis: true,
    },
  ];

  const handleAdd = () => {
    if (!canAdd) {
      message.warning('You do not have permission to add categories');
      return;
    }
    skipDirty.current = true;
    setSelectedId(null);
    setIsEditing(true);
    form.resetFields();
    markDirty(false);
    setTimeout(() => { skipDirty.current = false; }, 300);
  };

  const handleSelect = (record) => {
    if (!canView && !canUpdate) {
      message.warning('You do not have permission to view category details');
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
    // Check permissions
    if (selectedId && !canUpdate) {
      message.warning('You do not have permission to update categories');
      return;
    }
    if (!selectedId && !canAdd) {
      message.warning('You do not have permission to add categories');
      return;
    }

    // Duplicate name validation
    const name = (values.name || '').trim().toLowerCase();
    if (!name) {
      message.error('Category name is required');
      return;
    }
    const exists = categories.some(c => (c.name || '').trim().toLowerCase() === name && c.id !== selectedId);
    if (exists) {
      message.error('Category with this name already exists');
      return;
    }

    setSubmitting(true);
    try {
      if (selectedId) {
        // Update existing category
        const selectedRecord = categories.find(c => c.id === selectedId);
        const response = await updateCategory(selectedId, { ...values, version: selectedRecord?.version });
        const updatedCategory = response?.data || { id: selectedId, ...values };
        updateItem('categories', selectedId, updatedCategory);
        message.success('Category updated successfully');
      } else {
        // Create new category
        const response = await createCategory(values);
        const newCategory = response?.data || { id: Date.now(), ...values };
        addItem('categories', newCategory);
        setSelectedId(newCategory.id);
        message.success('Category created successfully');
      }
      markDirty(false);
      setIsEditing(false);
      setSelectedId(null);
    } catch (error) {
      // Error toast already shown by axiosInstance interceptor
      console.error('Failed to save category:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!canDelete) {
      message.warning('You do not have permission to delete categories');
      return;
    }

    modal.confirm({
      title: 'Delete Category',
      icon: <ExclamationCircleOutlined />,
      content: 'Are you sure you want to delete this category? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await deleteCategory(selectedId);
          removeItem('categories', selectedId);
          message.success('Category deleted successfully');
          handleCancel();
        } catch (error) {
          // Error toast already shown by axiosInstance interceptor
          console.error('Failed to delete category:', error);
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
    setFilteredData(categories.filter(item => 
      item.name?.toLowerCase().includes(lower) || 
      (item.description && item.description.toLowerCase().includes(lower))
    ));
  };

  // Check if form should be read-only (view mode)
  const isReadOnly = selectedId && !canUpdate;

  return (
    <MasterSplitView
      title="Categories"
      subtitle="Item"
      addLabel="Add Category"
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
                {selectedId ? (isReadOnly ? 'View Category' : 'Edit Category') : 'New Category'}
              </h2>
              <Space>
                {selectedId && canDelete && (
                  <Button 
                    danger 
                    onClick={handleDelete} 
                    icon={<DeleteOutlined />}
                  >
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
                label="Category Name" 
                rules={[{ required: true, message: 'Please enter category name' }]}
              >
                <Input placeholder="e.g. Fabrics" size="large" />
              </Form.Item>
              <Form.Item name="description" label="Description">
                <Input.TextArea rows={4} placeholder="Description about the category..." />
              </Form.Item>
            </Form>
          </div>
      )}
    />
  );
};

export default CategoryMaster;
