import React, { useState, useEffect, useCallback, useRef } from 'react';
import MasterSplitView from '../../components/MasterSplitView';
import { Form, Input, Button, Space, message, Tag, InputNumber, Switch, Modal, Typography, Row, Col } from 'antd';
import { SaveOutlined, CloseOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { numericInputProps, integerInputProps } from '../../utils/inputHelpers';

const { Text } = Typography;
import { useStore } from '../../context/StoreContext';
import { createPaymentTerms, updatePaymentTerms, deletePaymentTerms } from '../../services/paymentTermsService';
import { hasPermission } from '../../utils/permissions';
import PermissionGuard from '../../components/PermissionGuard';

const MODULE_ID = 'payment-terms';

const PaymentTermsMaster = ({ onDirtyChange }) => {
  const { paymentTerms, addItem, updateItem, removeItem } = useStore();
  const [filteredData, setFilteredData] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const markDirty = useCallback((dirty) => { setUnsavedChanges(dirty); onDirtyChange?.(dirty); }, [onDirtyChange]);
  const [form] = Form.useForm();
  const skipDirty = useRef(false);

  const canAdd = hasPermission(MODULE_ID, 'add');
  const canUpdate = hasPermission(MODULE_ID, 'update');
  const canDelete = hasPermission(MODULE_ID, 'delete');
  const canView = hasPermission(MODULE_ID, 'view');

  useEffect(() => {
    setFilteredData(paymentTerms);
  }, [paymentTerms]);

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
    },
    {
      title: 'Payment Days',
      dataIndex: 'paymentDays',
      width: 130,
      render: (val) => val != null ? <Tag color="blue">{val} days</Tag> : '-',
    },
    {
      title: 'Advance %',
      dataIndex: 'advancePercentage',
      width: 110,
      render: (val) => {
        if (val == null || Number(val) === 0) return <Tag>{0}%</Tag>;
        return <Tag color="geekblue">{Number(val)}%</Tag>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'active',
      width: 90,
      render: (val) => val === false
        ? <Tag color="default">Inactive</Tag>
        : <Tag color="green">Active</Tag>,
    },
  ];

  const handleAdd = () => {
    if (!canAdd) {
      message.warning('You do not have permission to add payment terms');
      return;
    }
    skipDirty.current = true;
    setSelectedId(null);
    setIsEditing(true);
    form.resetFields();
    form.setFieldsValue({ active: true });
    markDirty(false);
    setTimeout(() => { skipDirty.current = false; }, 300);
  };

  const handleSelect = (record) => {
    if (!canView && !canUpdate) {
      message.warning('You do not have permission to view payment terms');
      return;
    }
    skipDirty.current = true;
    setSelectedId(record.id);
    setIsEditing(true);
    form.setFieldsValue({
      ...record,
      active: record.active !== false,
    });
    markDirty(false);
    setTimeout(() => { skipDirty.current = false; }, 300);
  };

  const handleSave = async (values) => {
    if (selectedId && !canUpdate) {
      message.warning('You do not have permission to update payment terms');
      return;
    }
    if (!selectedId && !canAdd) {
      message.warning('You do not have permission to add payment terms');
      return;
    }

    const name = (values.name || '').trim();
    const exists = paymentTerms.some(
      (pt) => (pt.name || '').trim().toLowerCase() === name.toLowerCase() && pt.id !== selectedId
    );
    if (exists) {
      message.error('Payment terms with this name already exists');
      return;
    }

    setSubmitting(true);
    try {
      if (selectedId) {
        const selectedRecord = paymentTerms.find(pt => pt.id === selectedId);
        const response = await updatePaymentTerms(selectedId, { ...values, version: selectedRecord?.version });
        const updated = response?.data || { id: selectedId, ...values };
        updateItem('paymentTerms', selectedId, updated);
        message.success('Payment terms updated successfully');
      } else {
        const response = await createPaymentTerms(values);
        const newItem = response?.data || { id: Date.now(), ...values };
        addItem('paymentTerms', newItem);
        setSelectedId(newItem.id);
        message.success('Payment terms created successfully');
      }
      markDirty(false);
      setIsEditing(false);
      setSelectedId(null);
    } catch (error) {
      // Error toast already shown by axiosInstance interceptor
      console.error('Failed to save payment terms:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!canDelete) {
      message.warning('You do not have permission to delete payment terms');
      return;
    }

    Modal.confirm({
      title: 'Delete Payment Terms',
      icon: <ExclamationCircleOutlined />,
      content: 'Are you sure you want to delete this payment terms? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await deletePaymentTerms(selectedId);
          removeItem('paymentTerms', selectedId);
          message.success('Payment terms deleted successfully');
          handleCancel();
        } catch (error) {
          // Error toast already shown by axiosInstance interceptor
          console.error('Failed to delete payment terms:', error);
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
    setFilteredData(
      paymentTerms.filter((item) =>
        item.name?.toLowerCase().includes(lower) ||
        item.description?.toLowerCase().includes(lower)
      )
    );
  };

  const isReadOnly = selectedId && !canUpdate;

  return (
    <MasterSplitView
      title="Payment Terms"
      subtitle="Order Entry"
      addLabel="Add Payment Terms"
      data={filteredData}
      columns={columns}
      selectedId={selectedId}
      isEditing={isEditing}
      onAdd={canAdd ? handleAdd : undefined}
      onSelectRow={handleSelect}
      onSearch={handleSearch}
      onCloseForm={handleCancel}
      searchPlaceholder="Search payment terms..."
      renderForm={() => (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Sticky header */}
          <div className="master-form-header" style={{
            flexShrink: 0,
            position: 'sticky',
            top: 0,
            zIndex: 10,
            background: 'var(--card-bg, #fff)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-color, #f0f0f0)',
          }}>
            <div>
              <h2 style={{ margin: 0 }}>
                {selectedId ? (isReadOnly ? 'View Payment Terms' : 'Edit Payment Terms') : 'New Payment Terms'}
              </h2>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {selectedId ? 'Modify the payment terms details below' : 'Create a new payment terms template for order entry'}
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
                    disabled={selectedId && !unsavedChanges}
                  >
                    Save
                  </Button>
                </PermissionGuard>
              )}
            </Space>
          </div>

          {/* Scrollable form content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 24px' }}>
              <Form
                form={form}
                layout="vertical"
                onFinish={handleSave}
                disabled={isReadOnly}
                onValuesChange={() => { if (!skipDirty.current) markDirty(true); }}
              >
                <Form.Item
                  name="name"
                  label="Name"
                  rules={[{ required: true, message: 'Please enter a name' }]}
                >
                  <Input placeholder="e.g. Net 30, 50/50 T/T, LC at Sight" size="large" maxLength={100} />
                </Form.Item>
                <Form.Item name="description" label="Description">
                  <Input.TextArea rows={3} placeholder="Additional details (optional)" maxLength={500} />
                </Form.Item>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item
                      name="paymentDays"
                      label="Payment Days"
                      rules={[{ required: true, message: 'Please enter payment days' }]}
                    >
                      <InputNumber min={0} max={365} controls={false} placeholder="e.g. 30" addonAfter="days" style={{ width: 100 }} {...integerInputProps} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="advancePercentage" label="Advance Percentage">
                      <InputNumber min={0} max={100} precision={2} controls={false} placeholder="e.g. 50" addonAfter="%" style={{ width: 100 }} {...numericInputProps} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="active" label="Active" valuePropName="checked">
                      <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
          </div>
        </div>
      )}
    />
  );
};

export default PaymentTermsMaster;
