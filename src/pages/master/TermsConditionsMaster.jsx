import { useState, useEffect, useCallback } from 'react';
import { Form, Input, Button, Space, message, Modal, Spin, Tag, Typography } from 'antd';
import { SaveOutlined, CloseOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useStore } from '../../context/StoreContext';
import {
  getAllTermsConditions,
  createTermsConditions,
  updateTermsConditions,
  deleteTermsConditions,
} from '../../services/termsConditionsService';
import { hasPermission } from '../../utils/permissions';
import PermissionGuard from '../../components/PermissionGuard';
import RichTextEditor from '../../components/RichTextEditor';
import MasterSplitView from '../../components/MasterSplitView';

const { Text } = Typography;

const MODULE_ID = 'terms-conditions';

const TermsConditionsMaster = () => {
  const {
    termsConditions,
    setData,
    setLoading: setStoreLoading,
    loading: storeLoading,
    isCacheValid,
    addItem,
    updateItem,
    removeItem,
  } = useStore();

  const [filteredData, setFilteredData] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const [description, setDescription] = useState('');

  const canAdd = hasPermission(MODULE_ID, 'add');
  const canUpdate = hasPermission(MODULE_ID, 'update');
  const canDelete = hasPermission(MODULE_ID, 'delete');
  const canView = hasPermission(MODULE_ID, 'view');

  // Fetch data on mount
  const fetchData = useCallback(async (force = false) => {
    if (!force && isCacheValid('termsConditions') && termsConditions?.length > 0) {
      setFilteredData(termsConditions);
      return;
    }

    setStoreLoading('termsConditions', true);
    try {
      const response = await getAllTermsConditions();
      const data = Array.isArray(response)
        ? response
        : response?.data
          ? Array.isArray(response.data) ? response.data : [response.data]
          : response?.content || [];
      setData('termsConditions', data);
      setFilteredData(data);
    } catch (error) {
      console.error('Failed to fetch terms & conditions:', error);
      message.error('Failed to load terms & conditions');
    } finally {
      setStoreLoading('termsConditions', false);
    }
  }, [termsConditions, isCacheValid, setData, setStoreLoading]);

  useEffect(() => {
    fetchData();
  }, []);

  // Sync local state with store
  useEffect(() => {
    if (termsConditions?.length > 0) {
      setFilteredData(termsConditions);
    }
  }, [termsConditions]);

  const columns = [
    {
      title: 'Title',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
      render: (name) => <Text strong>{name}</Text>,
    },
  ];

  const handleAdd = () => {
    if (!canAdd) {
      message.warning('You do not have permission to add terms & conditions');
      return;
    }
    setSelectedId(null);
    setIsEditing(true);
    form.resetFields();
    setDescription('');
  };

  const handleSelect = (record) => {
    if (!canView && !canUpdate) {
      message.warning('You do not have permission to view terms & conditions');
      return;
    }
    setSelectedId(record.id);
    setIsEditing(true);
    form.setFieldsValue({ name: record.name });
    // Set the description (HTML) as-is from the API
    setDescription(record.description || '');
  };

  const handleSave = async (values) => {
    if (selectedId && !canUpdate) {
      message.warning('You do not have permission to update terms & conditions');
      return;
    }
    if (!selectedId && !canAdd) {
      message.warning('You do not have permission to add terms & conditions');
      return;
    }

    const name = (values.name || '').trim();
    if (!name) {
      message.error('Title is required');
      return;
    }

    // Check for duplicate name
    const exists = (termsConditions || []).some(
      (tc) => (tc.name || '').trim().toLowerCase() === name.toLowerCase() && tc.id !== selectedId
    );
    if (exists) {
      message.error('Terms & Conditions with this title already exists');
      return;
    }

    if (!description || description === '<br>' || description === '<div><br></div>') {
      message.error('Description content is required');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: name,
        description: description, // Save HTML as-is
      };

      if (selectedId) {
        const response = await updateTermsConditions(selectedId, payload);
        const updated = response?.data || response || { id: selectedId, ...payload };
        updateItem('termsConditions', selectedId, updated);
        message.success('Terms & Conditions updated successfully');
      } else {
        const response = await createTermsConditions(payload);
        const newItem = response?.data || response || { id: Date.now(), ...payload };
        addItem('termsConditions', newItem);
        setSelectedId(newItem.id);
        message.success('Terms & Conditions created successfully');
      }

      // Refresh from server to ensure consistency
      await fetchData(true);
    } catch (error) {
      console.error('Failed to save terms & conditions:', error);
      message.error(selectedId ? 'Failed to update terms & conditions' : 'Failed to create terms & conditions');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!canDelete) {
      message.warning('You do not have permission to delete terms & conditions');
      return;
    }

    Modal.confirm({
      title: 'Delete Terms & Conditions',
      icon: <ExclamationCircleOutlined />,
      content: 'Are you sure you want to delete this entry? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await deleteTermsConditions(selectedId);
          removeItem('termsConditions', selectedId);
          message.success('Terms & Conditions deleted successfully');
          handleCancel();
          await fetchData(true);
        } catch (error) {
          console.error('Failed to delete terms & conditions:', error);
          message.error('Failed to delete terms & conditions');
        }
      },
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSelectedId(null);
    form.resetFields();
    setDescription('');
  };

  const handleSearch = (value) => {
    const lower = value.toLowerCase();
    setFilteredData(
      (termsConditions || []).filter(
        (item) =>
          item.name?.toLowerCase().includes(lower) ||
          (item.description && item.description.replace(/<[^>]+>/g, '').toLowerCase().includes(lower))
      )
    );
  };

  const isReadOnly = selectedId && !canUpdate;

  return (
    <MasterSplitView
      title="Terms & Conditions"
      data={filteredData}
      columns={columns}
      loading={storeLoading.termsConditions}
      selectedId={selectedId}
      isEditing={isEditing}
      onAdd={canAdd ? handleAdd : undefined}
      onSelectRow={handleSelect}
      onSearch={handleSearch}
      searchPlaceholder="Search terms & conditions..."
      renderForm={() => (
        <Spin spinning={submitting}>
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Sticky Header */}
            <div
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 10,
                background: 'var(--card-bg, #fff)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 24px',
                borderBottom: '1px solid var(--border-color, #f0f0f0)',
              }}
            >
              <div>
                <h2 style={{ margin: 0 }}>
                  {selectedId ? (isReadOnly ? 'View Terms & Conditions' : 'Edit Terms & Conditions') : 'New Terms & Conditions'}
                </h2>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {selectedId ? 'Modify the title and content below' : 'Create a new terms & conditions template for purchase orders'}
                </Text>
              </div>
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
                      Save
                    </Button>
                  </PermissionGuard>
                )}
              </Space>
            </div>

            {/* Scrollable Form Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: 24, paddingBottom: 48 }}>
              <Form form={form} layout="vertical" onFinish={handleSave} disabled={isReadOnly}>
                <Form.Item
                  name="name"
                  label="Title"
                  rules={[
                    { required: true, message: 'Please enter a title for this T&C template' },
                    { min: 2, message: 'Title must be at least 2 characters' },
                    { max: 100, message: 'Title cannot exceed 100 characters' },
                    {
                      validator: (_, value) => {
                        if (!value) return Promise.resolve();
                        const trimmed = value.trim().toLowerCase();
                        const duplicate = (termsConditions || []).some(
                          (tc) => (tc.name || '').trim().toLowerCase() === trimmed && tc.id !== selectedId
                        );
                        return duplicate
                          ? Promise.reject(new Error('A Terms & Conditions with this title already exists'))
                          : Promise.resolve();
                      },
                    },
                  ]}
                  extra="This title will appear in the PO dropdown for selection"
                >
                  <Input placeholder="e.g. Standard Fabric Purchase Terms" size="large" />
                </Form.Item>

                <Form.Item
                  label={
                    <Space>
                      <span>Description / Content</span>
                      <Tag color="blue" style={{ fontSize: 11 }}>Rich Text</Tag>
                    </Space>
                  }
                  required
                >
                  <RichTextEditor
                    value={description}
                    onChange={setDescription}
                    placeholder="Enter terms and conditions content here. Use the toolbar above for formatting like bullet points, numbered lists, bold text, alignment, etc."
                    readOnly={isReadOnly}
                  />
                </Form.Item>
                <div
                  style={{
                    padding: '8px 4px',
                    fontSize: 13,
                    color: 'var(--text-muted, #94a3b8)',
                  }}
                >
                  This content will be appended to the PO document during PDF generation. Use formatting tools for clean presentation.
                </div>
              </Form>
            </div>
          </div>
        </Spin>
      )}
    />
  );
};

export default TermsConditionsMaster;
