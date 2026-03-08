import React, { useState, useEffect } from 'react';
import MasterSplitView from '../../components/MasterSplitView';
import { Form, Input, Button, Space, message, Tag, Select, Switch, Modal, Spin, Row, Col } from 'antd';
import { SaveOutlined, CloseOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useStore } from '../../context/StoreContext';
import { saveStyle, deleteStyle } from '../../services/styleService';
import { hasPermission } from '../../utils/permissions';
import PermissionGuard from '../../components/PermissionGuard';
import { SEASONS } from '../../utils/costingConstants';

const MODULE_ID = 'master-data';

const StyleMaster = () => {
  const { styles, buyers, addItem, updateItem, removeItem } = useStore();
  const [filteredData, setFilteredData] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [form] = Form.useForm();

  const canAdd = hasPermission(MODULE_ID, 'add');
  const canUpdate = hasPermission(MODULE_ID, 'update');
  const canDelete = hasPermission(MODULE_ID, 'delete');
  const canView = hasPermission(MODULE_ID, 'view');

  useEffect(() => {
    setFilteredData(styles);
  }, [styles]);

  // Build a buyer lookup map for display
  const buyerMap = {};
  buyers.forEach(b => { buyerMap[b.id] = b.name; });

  const columns = [
    {
      title: 'Style No',
      dataIndex: 'styleNo',
      width: 120,
      sorter: (a, b) => (a.styleNo || '').localeCompare(b.styleNo || ''),
      render: (text) => text ? <Tag color="blue">{text}</Tag> : '-',
    },
    {
      title: 'Garment',
      dataIndex: 'garmentName',
      sorter: (a, b) => (a.garmentName || '').localeCompare(b.garmentName || ''),
    },
    {
      title: 'Buyer',
      dataIndex: 'buyerId',
      render: (buyerId) => buyerMap[buyerId] || buyerId || '-',
    },
    {
      title: 'Season',
      dataIndex: 'season',
      width: 100,
      render: (val) => {
        const found = SEASONS.find(s => s.value === val);
        return found ? <Tag>{found.label}</Tag> : (val || '-');
      },
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      width: 80,
      render: (val) => val === false
        ? <Tag color="default">Inactive</Tag>
        : <Tag color="green">Active</Tag>,
    },
  ];

  const handleAdd = () => {
    if (!canAdd) {
      message.warning('You do not have permission to add styles');
      return;
    }
    setSelectedId(null);
    setIsEditing(true);
    form.resetFields();
    form.setFieldsValue({ isActive: true });
    setUnsavedChanges(false);
  };

  const handleSelect = (record) => {
    if (!canView && !canUpdate) {
      message.warning('You do not have permission to view style details');
      return;
    }
    setSelectedId(record.id);
    setIsEditing(true);
    form.setFieldsValue({
      ...record,
      isActive: record.isActive !== false,
    });
    setUnsavedChanges(false);
  };

  const handleSave = async (values) => {
    if (selectedId && !canUpdate) {
      message.warning('You do not have permission to update styles');
      return;
    }
    if (!selectedId && !canAdd) {
      message.warning('You do not have permission to add styles');
      return;
    }

    // Duplicate styleNo validation
    const styleNo = (values.styleNo || '').trim();
    const exists = styles.some(
      s => (s.styleNo || '').trim().toLowerCase() === styleNo.toLowerCase() && s.id !== selectedId
    );
    if (exists) {
      message.error('A style with this Style No already exists');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...values,
        ...(selectedId ? { id: selectedId } : {}),
      };
      const saved = await saveStyle(payload);
      if (selectedId) {
        updateItem('styles', selectedId, saved);
        message.success('Style updated successfully');
      } else {
        addItem('styles', saved);
        setSelectedId(saved.id);
        message.success('Style created successfully');
      }
      setUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to save style:', error);
      message.error(selectedId ? 'Failed to update style' : 'Failed to create style');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!canDelete) {
      message.warning('You do not have permission to delete styles');
      return;
    }

    Modal.confirm({
      title: 'Delete Style',
      icon: <ExclamationCircleOutlined />,
      content: 'Are you sure you want to delete this style? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await deleteStyle(selectedId);
          removeItem('styles', selectedId);
          message.success('Style deleted successfully');
          handleCancel();
        } catch (error) {
          console.error('Failed to delete style:', error);
          message.error('Failed to delete style');
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
    setFilteredData(styles.filter(item =>
      item.styleNo?.toLowerCase().includes(lower) ||
      item.garmentName?.toLowerCase().includes(lower) ||
      buyerMap[item.buyerId]?.toLowerCase().includes(lower)
    ));
  };

  const isReadOnly = selectedId && !canUpdate;

  return (
    <MasterSplitView
      title="Styles"
      data={filteredData}
      columns={columns}
      selectedId={selectedId}
      isEditing={isEditing}
      onAdd={canAdd ? handleAdd : undefined}
      onSelectRow={handleSelect}
      onSearch={handleSearch}
      searchPlaceholder="Search by style no, garment or buyer..."
      renderForm={() => (
        <Spin spinning={submitting}>
          <div style={{ padding: 24 }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 24,
              borderBottom: '1px solid #f0f0f0',
              paddingBottom: 16,
            }}>
              <h2 style={{ margin: 0 }}>
                {selectedId ? (isReadOnly ? 'View Style' : 'Edit Style') : 'New Style'}
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
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="styleNo"
                    label="Style No"
                    rules={[{ required: true, message: 'Please enter Style No' }]}
                  >
                    <Input placeholder="e.g. STY-001" maxLength={50} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="garmentName"
                    label="Garment Name"
                    rules={[{ required: true, message: 'Please enter Garment Name' }]}
                  >
                    <Input placeholder="e.g. Polo T-Shirt" maxLength={150} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="buyerId"
                    label="Buyer"
                    rules={[{ required: true, message: 'Please select a Buyer' }]}
                  >
                    <Select
                      placeholder="Select Buyer"
                      showSearch
                      optionFilterProp="label"
                      options={buyers.map(b => ({ value: b.id, label: b.name }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="season" label="Season">
                    <Select
                      placeholder="Select Season"
                      allowClear
                      options={SEASONS}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="description" label="Description">
                <Input.TextArea rows={3} placeholder="Style description (optional)" maxLength={500} />
              </Form.Item>
              <Form.Item name="isActive" label="Active" valuePropName="checked">
                <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
              </Form.Item>
            </Form>
          </div>
        </Spin>
      )}
    />
  );
};

export default StyleMaster;
