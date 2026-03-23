import React, { useState, useEffect, useCallback, useRef } from 'react';
import MasterSplitView from '../../components/MasterSplitView';
import { Form, Input, Button, Space, message, Tag, Select, Modal } from 'antd';
import { SaveOutlined, CloseOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useStore } from '../../context/StoreContext';
import { createItemType, updateItemType, deleteItemType } from '../../services/masterDataService';
import { hasPermission } from '../../utils/permissions';
import PermissionGuard from '../../components/PermissionGuard';

const MODULE_ID = 'master-data';

const ItemTypeMaster = ({ onDirtyChange }) => {
  const { itemTypes, subCategories, attributes, uoms, addItem, updateItem, removeItem } = useStore();
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
    skipDirty.current = true;
    setSelectedId(null);
    setIsEditing(true);
    form.resetFields();
    form.setFieldsValue({ attributeIds: [], uomIds: [] });
    markDirty(false);
    setTimeout(() => { skipDirty.current = false; }, 300);
  };

  const handleSelect = (record) => {
    if (!canView && !canUpdate) {
      message.warning('You do not have permission to view item type details');
      return;
    }
    skipDirty.current = true;
    setSelectedId(record.id);
    setIsEditing(true);
    form.setFieldsValue({
      ...record,
      attributeIds: record.attributeIds || record.attributes?.map(a => a.id) || [],
      uomIds: record.uomIds || record.uoms?.map(u => u.id) || [],
    });
    markDirty(false);
    setTimeout(() => { skipDirty.current = false; }, 300);
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
        const selectedRecord = itemTypes.find(it => it.id === selectedId);
        const response = await updateItemType(selectedId, { ...values, version: selectedRecord?.version });
        const updatedItem = response?.data || { id: selectedId, ...values };
        updateItem('itemTypes', selectedId, updatedItem);
        message.success('Item type updated successfully');
      } else {
        const response = await createItemType(values);
        const newItem = response?.data || { id: Date.now(), ...values };
        addItem('itemTypes', newItem);
        setSelectedId(newItem.id);
        message.success('Item type created successfully');
      }
      markDirty(false);
      setIsEditing(false);
      setSelectedId(null);
    } catch (error) {
      // Error toast already shown by axiosInstance interceptor
      console.error('Failed to save item type:', error);
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
          // Error toast already shown by axiosInstance interceptor
          console.error('Failed to delete item type:', error);
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
    setFilteredData(itemTypes.filter(item => 
      item.name?.toLowerCase().includes(lower)
    ));
  };

  const isReadOnly = selectedId && !canUpdate;

  return (
    <MasterSplitView
      title="Item Types"
      subtitle="Item"
      addLabel="Add Item Type"
      data={filteredData}
      columns={columns}
      selectedId={selectedId}
      isEditing={isEditing}
      onAdd={canAdd ? handleAdd : undefined}
      onSelectRow={handleSelect}
      onSearch={handleSearch}
      onCloseForm={handleCancel}
      renderForm={() => (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className="master-form-header" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 24px',
              borderBottom: '1px solid #f0f0f0',
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
                      disabled={selectedId && !unsavedChanges}
                    >
                      Save Changes
                    </Button>
                  </PermissionGuard>
                )}
              </Space>
            </div>

            {/* Scrollable form content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
              <Form
                form={form}
                layout="vertical"
                onFinish={handleSave}
                disabled={isReadOnly}
                onValuesChange={() => { if (!skipDirty.current) markDirty(true); }}
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
                    options={subCategories.map(s => ({ value: s.id, label: s.name }))}
                  />
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
                    options={attributes.map(a => ({ value: a.id, label: a.attributeName || a.name }))}
                  />
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
                    options={uoms.map(u => ({ value: u.id, label: u.name }))}
                  />
                </Form.Item>
              </Form>
            </div>
          </div>
      )}
    />
  );
};

export default ItemTypeMaster;
