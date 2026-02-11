import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Input,
  Tag,
  Modal,
  Form,
  Row,
  Col,
  Checkbox,
  message,
  Popconfirm,
  Tooltip,
  Typography,
  Empty,
  Drawer,
  Descriptions,
  Divider,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getLocationByPincode,
} from '../../services/supplierService';
import { hasPermission } from '../../utils/permissions';
import { useStore } from '../../context/StoreContext';

const { Text, Title } = Typography;

// Validation patterns
const PAN_REGEX = /^[A-Z]{3}[PCAFHTBLJG][A-Z][0-9]{4}[A-Z]$/;
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{3}[PCAFHTBLJG][A-Z][0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SupplierMaster = () => {
  // Store context
  const { 
    suppliers: storeSuppliers, 
    setData, 
    isCacheValid, 
    setLoading: setStoreLoading, 
    loading: storeLoading,
    addItem,
    updateItem,
    removeItem,
    invalidateCache
  } = useStore();

  // State
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [supplierUnsaved, setSupplierUnsaved] = useState(false);
  const [viewDrawerVisible, setViewDrawerVisible] = useState(false);
  const [viewingSupplier, setViewingSupplier] = useState(null);
  const [form] = Form.useForm();

  // Permissions
  const canView = hasPermission('supplier-info', 'view');
  const canAdd = hasPermission('supplier-info', 'add');
  const canUpdate = hasPermission('supplier-info', 'update');
  const canDelete = hasPermission('supplier-info', 'delete');

  // Fetch suppliers with store caching
  const fetchSuppliers = useCallback(async (force = false) => {
    // Use cache if valid
    if (!force && isCacheValid('suppliers') && storeSuppliers.length > 0) {
      setSuppliers(storeSuppliers);
      return;
    }

    setLoading(true);
    setStoreLoading('suppliers', true);
    try {
      const response = await getSuppliers();
      let data = Array.isArray(response) ? response : response?.content || response?.data || [];
      // Ensure consistent descending order by id
      if (Array.isArray(data)) {
        data = data.slice().sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
      }
      setSuppliers(data);
      setData('suppliers', data);
    } catch (error) {
      message.error('Failed to load suppliers');
      setSuppliers([]);
    } finally {
      setLoading(false);
      setStoreLoading('suppliers', false);
    }
  }, [storeSuppliers, isCacheValid, setData, setStoreLoading]);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  // Sync local state with store
  useEffect(() => {
    if (storeSuppliers.length > 0) {
      const sorted = storeSuppliers.slice().sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
      setSuppliers(sorted);
    }
  }, [storeSuppliers]);

  // Filtered data based on search
  const filteredSuppliers = useMemo(() => {
    if (!searchText.trim()) return suppliers;
    const search = searchText.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.name?.toLowerCase().includes(search) ||
        s.email?.toLowerCase().includes(search) ||
        s.phone?.includes(search) ||
        s.city?.toLowerCase().includes(search) ||
        s.state?.toLowerCase().includes(search) ||
        s.pan?.toLowerCase().includes(search) ||
        s.gstin?.toLowerCase().includes(search)
    );
  }, [suppliers, searchText]);

  // Handle View
  const handleView = (record) => {
    setViewingSupplier(record);
    setViewDrawerVisible(true);
  };

  // Handle Add
  const handleAdd = () => {
    setEditingSupplier(null);
    form.resetFields();
    form.setFieldsValue({
      active: true,
      suppliesFabric: false,
      suppliesTrims: false,
      igstApplicable: false,
    });
    setModalVisible(true);
    setSupplierUnsaved(false);
  };

  // Handle Edit
  const handleEdit = (record) => {
    setEditingSupplier(record);
    form.setFieldsValue({
      ...record,
      igstApplicable: Boolean(record.igstApplicable ?? record.igst_applicable ?? false),
    });
    setModalVisible(true);
    setSupplierUnsaved(false);
  };

  // Handle Delete
  const handleDelete = async (id) => {
    try {
      await deleteSupplier(id);
      // Update store
      removeItem('suppliers', id);
      message.success('Supplier deleted successfully');
    } catch (error) {
      message.error(error?.errorMessage || 'Failed to delete supplier');
    }
  };

  // Handle Pincode blur - auto-fill city/state/country
  const handlePincodeBlur = async (e) => {
    const pincode = e.target.value;
    if (pincode?.length === 6) {
      const location = await getLocationByPincode(pincode);
      if (location) {
        form.setFieldsValue({
          city: location.city,
          state: location.state,
          country: location.country,
        });
      }
    }
  };

  // Form submit
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // Additional custom validations
      if (!values.suppliesFabric && !values.suppliesTrims) {
        message.error('At least one supply product (Fabric or Trims) must be selected');
        return;
      }

      setSubmitting(true);

      const supplierData = {
        ...values,
        active: true,
        pan: values.pan?.toUpperCase(),
        gstin: values.gstin?.toUpperCase(),
      };

      if (editingSupplier) {
        const response = await updateSupplier({ ...supplierData, id: editingSupplier.id });
        // Update store
        const updatedSupplier = response || { ...supplierData, id: editingSupplier.id };
        updateItem('suppliers', editingSupplier.id, updatedSupplier);
        // Update local suppliers state immediately so view reflects changes
        setSuppliers((prev) => {
          const arr = Array.isArray(prev) ? prev.slice() : [];
          const exists = arr.some((s) => Number(s.id) === Number(updatedSupplier.id));
          if (exists) {
            return arr.map((s) => (Number(s.id) === Number(updatedSupplier.id) ? updatedSupplier : s)).sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
          }
          arr.unshift(updatedSupplier);
          return arr.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
        });
        // If viewing drawer open for this supplier, update it immediately
        if (viewingSupplier && Number(viewingSupplier.id) === Number(editingSupplier.id)) {
          setViewingSupplier(updatedSupplier);
        }
        message.success('Supplier updated successfully');
      } else {
        const response = await createSupplier(supplierData);
        // Add to store
        const newSupplier = response || { ...supplierData, id: Date.now() };
        addItem('suppliers', newSupplier);
        // Update local suppliers list immediately
        setSuppliers((prev) => {
          const arr = Array.isArray(prev) ? prev.slice() : [];
          arr.unshift(newSupplier);
          return arr.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
        });
        message.success('Supplier added successfully');
      }

      // Invalidate cache and refresh supplier list to ensure table reflects latest data
      try {
        invalidateCache && invalidateCache('suppliers');
      } catch (e) {
        // ignore
      }
      try {
        await fetchSuppliers(true);
      } catch (e) {
        // ignore - fetchSuppliers already handles errors
      }

      setModalVisible(false);
      form.resetFields();
      setEditingSupplier(null);
    } catch (error) {
      if (error?.errorFields) {
        // Form validation error - already handled by Ant Design
        return;
      }
      message.error(error?.errorMessage || `Failed to ${editingSupplier ? 'update' : 'create'} supplier`);
    } finally {
      setSubmitting(false);
    }
  };

  const doCloseSupplierModal = () => {
    setModalVisible(false);
    setEditingSupplier(null);
    form.resetFields();
    setSupplierUnsaved(false);
  };

  const handleSupplierModalClose = () => {
    if (supplierUnsaved) {
      Modal.confirm({
        title: 'Unsaved changes',
        content: 'You have unsaved changes. Discard and close?',
        okText: 'Discard',
        cancelText: 'Continue Editing',
        onOk: () => doCloseSupplierModal(),
      });
      return;
    }
    doCloseSupplierModal();
  };

  // Table columns - simplified for better readability
  const columns = [
    {
      title: 'Supplier Name',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
      ellipsis: true,
      render: (name, record) => (
        <Button type="link" onClick={() => handleView(record)} style={{ padding: 0 }}>
          <Text strong>{name}</Text>
        </Button>
      ),
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
      width: 130,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 200,
      ellipsis: true,
    },
    {
      title: 'Location',
      key: 'location',
      width: 180,
      ellipsis: true,
      render: (_, record) => (
        <Text type="secondary">
          {[record.city, record.state].filter(Boolean).join(', ') || '-'}
        </Text>
      ),
    },
    {
      title: 'Supplies',
      key: 'supplies',
      width: 140,
      render: (_, record) => (
        <Space size={4} wrap>
          {record.suppliesFabric && <Tag color="success">Fabric</Tag>}
          {record.suppliesTrims && <Tag color="processing">Trims</Tag>}
          {!record.suppliesFabric && !record.suppliesTrims && (
            <Text type="secondary">-</Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'active',
      key: 'active',
      width: 90,
      render: (active) => (
        <Tag color={active !== false ? 'success' : 'default'}>
          {active !== false ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          {canView && (
            <Tooltip title="View">
              <Button
                type="text"
                size="middle"
                icon={<EyeOutlined />}
                onClick={() => handleView(record)}
                style={{ color: '#1890ff' }}
              />
            </Tooltip>
          )}
          {canUpdate && (
            <Tooltip title="Edit">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
                style={{ color: '#52c41a' }}
              />
            </Tooltip>
          )}
          {canDelete && (
            <Popconfirm
              title="Delete Supplier"
              description={`Are you sure you want to delete "${record.name}"?`}
              onConfirm={() => handleDelete(record.id)}
              okText="Delete"
              cancelText="Cancel"
              okButtonProps={{ danger: true }}
              icon={<ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
            >
              <Tooltip title="Delete">
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  danger
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card
      title={
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Suppliers</div>
          <div style={{ fontSize: 12, color: '#888' }}>Manage supplier master data</div>
        </div>
      }
    >
      <div>
      {/* Header */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <Input
          placeholder="Search suppliers..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          style={{ width: 280 }}
        />
        {canAdd && (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            Add Supplier
          </Button>
        )}
      </div>

      {/* Table */}
      <Table
        columns={columns}
        dataSource={filteredSuppliers}
        rowKey="id"
        loading={loading}
        size="small"
        scroll={{ x: 1000 }}
        pagination={{
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} suppliers`,
          pageSizeOptions: ['10', '20', '50', '100'],
          defaultPageSize: 10,
        }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No suppliers found"
            >
              {canAdd && (
                <Button type="primary" onClick={handleAdd}>
                  Add Supplier
                </Button>
              )}
            </Empty>
          ),
        }}
      />

      {/* View Drawer */}
      <Drawer
        title={
          <Space>
            <EyeOutlined />
            <span>Supplier Details</span>
          </Space>
        }
        placement="right"
        styles={{ wrapper: { width: 520 } }}
        onClose={() => {
          setViewDrawerVisible(false);
          setViewingSupplier(null);
        }}
        open={viewDrawerVisible}
        extra={
          <Space>
            {canUpdate && (
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={() => {
                  setViewDrawerVisible(false);
                  handleEdit(viewingSupplier);
                }}
              >
                Edit
              </Button>
            )}
          </Space>
        }
      >
        {viewingSupplier && (
          <>
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Title level={4} style={{ margin: 0 }}>{viewingSupplier.name}</Title>
                <Tag color={viewingSupplier.active !== false ? 'success' : 'default'}>
                  {viewingSupplier.active !== false ? 'Active' : 'Inactive'}
                </Tag>
              </div>
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Supplies:</span>
                {viewingSupplier.suppliesFabric && <Tag color="success">Fabric</Tag>}
                {viewingSupplier.suppliesTrims && <Tag color="processing">Trims</Tag>}
              </div>
            </div>

            <Divider titlePlacement="start">Basic Information</Divider>
            <Descriptions column={1} size="small" styles={{ label: { width: 120 } }} items={[
              { key: 'id', label: 'Supplier ID', children: viewingSupplier.id },
              { key: 'email', label: 'Email', children: viewingSupplier.email || '-' },
              { key: 'phone', label: 'Phone', children: viewingSupplier.phone || '-' },
            ]} />

            <Divider titlePlacement="start">Address</Divider>
            <Descriptions column={1} size="small" styles={{ label: { width: 120 } }} items={[
              { key: 'address', label: 'Address', children: viewingSupplier.address || '-' },
              { key: 'city', label: 'City', children: viewingSupplier.city || '-' },
              { key: 'state', label: 'State', children: viewingSupplier.state || '-' },
              { key: 'pincode', label: 'Pincode', children: viewingSupplier.pincode || '-' },
              { key: 'country', label: 'Country', children: viewingSupplier.country || '-' },
            ]} />

            <Divider titlePlacement="start">Tax Information</Divider>
            <Descriptions column={1} size="small" styles={{ label: { width: 120 } }} items={[
              { key: 'pan', label: 'PAN', children: viewingSupplier.pan || '-' },
              { key: 'gstin', label: 'GSTIN', children: viewingSupplier.gstin || '-' },
              {
                key: 'igst',
                label: 'IGST Applicable',
                children: (
                  <Tag color={viewingSupplier.igstApplicable ? 'blue' : 'default'}>
                    {viewingSupplier.igstApplicable ? 'Yes' : 'No'}
                  </Tag>
                ),
              },
            ]} />

            <Divider titlePlacement="start">Metadata</Divider>
            <Descriptions column={1} size="small" styles={{ label: { width: 120 } }} items={[
              {
                key: 'created',
                label: 'Created',
                children: viewingSupplier.createdAt
                  ? dayjs(viewingSupplier.createdAt).format('YYYY-MM-DD HH:mm')
                  : '-',
              },
              {
                key: 'updated',
                label: 'Updated',
                children: viewingSupplier.updatedAt
                  ? dayjs(viewingSupplier.updatedAt).format('YYYY-MM-DD HH:mm')
                  : '-',
              },
            ]} />
          </>
        )}
      </Drawer>

      {/* Add/Edit Modal */}
      <Modal
        title={editingSupplier ? 'Update Supplier' : 'Add Supplier'}
        open={modalVisible}
        onCancel={() => handleSupplierModalClose()}
        width={720}
        footer={[
          <Button
            key="cancel"
            onClick={() => handleSupplierModalClose()}
          >
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={submitting}
            onClick={handleSubmit}
          >
            {editingSupplier ? 'Update' : 'Save'}
          </Button>,
        ]}
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark="optional"
          initialValues={{
            active: true,
            suppliesFabric: false,
            suppliesTrims: false,
            igstApplicable: false,
          }}
          onValuesChange={() => setSupplierUnsaved(true)}
        >
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="name"
                label="Supplier Name"
                rules={[
                  { required: true, message: 'Supplier Name is required' },
                  { pattern: /^[a-zA-Z\s]+$/, message: 'Only letters and spaces allowed' },
                ]}
              >
                <Input
                  placeholder="Enter Supplier Name"
                  disabled={!!editingSupplier}
                  maxLength={100}
                />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item
                name="address"
                label="Address"
                rules={[
                  { required: true, message: 'Address is required' },
                  { pattern: /^[a-zA-Z0-9\s\-/]+$/, message: 'Only letters, numbers, spaces, - and / allowed' },
                ]}
              >
                <Input placeholder="Enter Address" maxLength={200} />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                name="pincode"
                label="Pincode"
                rules={[
                  { required: true, message: 'Pincode is required' },
                  { pattern: /^[0-9]{6}$/, message: 'Pincode must be 6 digits' },
                ]}
              >
                <Input
                  placeholder="Enter Pincode"
                  maxLength={6}
                  onBlur={handlePincodeBlur}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                    form.setFieldValue('pincode', value);
                  }}
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                name="city"
                label="City"
                rules={[
                  { required: true, message: 'City is required' },
                  { pattern: /^[a-zA-Z\s]+$/, message: 'Only letters and spaces allowed' },
                ]}
              >
                <Input placeholder="Enter City" maxLength={50} />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                name="state"
                label="State"
                rules={[
                  { required: true, message: 'State is required' },
                  { pattern: /^[a-zA-Z\s]+$/, message: 'Only letters and spaces allowed' },
                ]}
              >
                <Input placeholder="Enter State" maxLength={50} />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                name="country"
                label="Country"
                rules={[
                  { required: true, message: 'Country is required' },
                  { pattern: /^[a-zA-Z\s]+$/, message: 'Only letters and spaces allowed' },
                ]}
              >
                <Input placeholder="Enter Country" maxLength={50} />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                name="pan"
                label="PAN"
                rules={[
                  { required: true, message: 'PAN is required' },
                  {
                    pattern: PAN_REGEX,
                    message: 'Invalid PAN format (e.g., ABCPD1234E)',
                  },
                ]}
                normalize={(value) => value?.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10)}
              >
                <Input placeholder="Enter PAN (e.g., ABCPD1234E)" maxLength={10} />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                name="gstin"
                label="GSTIN"
                rules={[
                  { required: true, message: 'GSTIN is required' },
                  {
                    pattern: GSTIN_REGEX,
                    message: 'Invalid GSTIN format (e.g., 22ABCPD1234E1Z5)',
                  },
                ]}
                normalize={(value) => value?.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 15)}
              >
                <Input placeholder="Enter GSTIN (e.g., 22ABCPD1234E1Z5)" maxLength={15} />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { required: true, message: 'Email is required' },
                  { pattern: EMAIL_REGEX, message: 'Invalid email format' },
                ]}
              >
                <Input placeholder="Enter Email" maxLength={100} />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                name="phone"
                label="Phone Number"
                rules={[
                  { required: true, message: 'Phone Number is required' },
                  { pattern: /^[0-9]{10}$/, message: 'Phone must be 10 digits' },
                ]}
                normalize={(value) => value?.replace(/[^0-9]/g, '').slice(0, 10)}
              >
                <Input placeholder="Enter Phone Number" maxLength={10} />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item label="Supplies" required>
                <Space>
                  <Form.Item name="suppliesFabric" valuePropName="checked" noStyle>
                    <Checkbox>Fabric</Checkbox>
                  </Form.Item>
                  <Form.Item name="suppliesTrims" valuePropName="checked" noStyle>
                    <Checkbox>Trims</Checkbox>
                  </Form.Item>
                </Space>
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item label="Tax Settings">
                <Form.Item name="igstApplicable" valuePropName="checked" noStyle>
                  <Checkbox>IGST Applicable</Checkbox>
                </Form.Item>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
      </div>
    </Card>
  );
};

export default SupplierMaster;
