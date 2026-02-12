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
  message,
  Popconfirm,
  Tooltip,
  Typography,
  Drawer,
  Descriptions,
  Divider,
  Switch,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  getLocationByPincode,
} from '../../services/buyerService';
import { hasPermission } from '../../utils/permissions';
import { useStore } from '../../context/StoreContext';

const { Text } = Typography;

// Validation patterns
const PAN_REGEX = /^[A-Z]{3}[PCAFHTBLJG][A-Z][0-9]{4}[A-Z]$/;
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{3}[PCAFHTBLJG][A-Z][0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Static sample buyers (no API yet)
const STATIC_BUYERS = [
  {
    id: 1,
    name: 'Avarsh Fashion Pvt Ltd',
    contactPerson: 'Ranjith Kumar',
    email: 'ranjith@avarshfashion.com',
    phone: '9876543210',
    address1: '12, Textile Park',
    address2: 'Tirupur Road',
    city: 'Tirupur',
    state: 'Tamil Nadu',
    country: 'India',
    pincode: '641604',
    pan: 'ABCDE1234F',
    gstin: '33ABCDE1234F1Z5',
    stateCode: '33',
    igstApplicable: false,
    active: true,
  },
  {
    id: 2,
    name: 'Global Garments Inc',
    contactPerson: 'Sarah Johnson',
    email: 'sarah@globalgarments.com',
    phone: '9123456789',
    address1: '45, Industrial Estate',
    address2: '',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    pincode: '560001',
    pan: 'FGHIJ5678K',
    gstin: '29FGHIJ5678K1Z3',
    stateCode: '29',
    igstApplicable: true,
    active: true,
  },
];

const BuyerMaster = () => {
  // Store context
  const {
    buyers: storeBuyers,
    setData,
    isCacheValid,
    setLoading: setStoreLoading,
    loading: storeLoading,
    addItem,
    updateItem,
    removeItem,
    invalidateCache,
  } = useStore();

  // State
  const [buyers, setBuyers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBuyer, setEditingBuyer] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [viewDrawerVisible, setViewDrawerVisible] = useState(false);
  const [viewingBuyer, setViewingBuyer] = useState(null);
  const [form] = Form.useForm();

  // Permissions - use 'buyer-info' module or fallback to always-allowed for now
  const canView = hasPermission('buyer-info', 'view') || true;
  const canAdd = hasPermission('buyer-info', 'add') || true;
  const canUpdate = hasPermission('buyer-info', 'update') || true;
  const canDelete = hasPermission('buyer-info', 'delete') || true;

  // Initialize buyers from static data (no API yet)
  const fetchBuyers = useCallback((force = false) => {
    if (!force && isCacheValid('buyers') && storeBuyers.length > 0) {
      setBuyers(storeBuyers);
      return;
    }
    const data = STATIC_BUYERS.slice().sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
    setBuyers(data);
    setData('buyers', data);
  }, [storeBuyers, isCacheValid, setData]);

  useEffect(() => {
    fetchBuyers();
  }, []);

  // Sync local state with store
  useEffect(() => {
    if (storeBuyers.length > 0) {
      const sorted = storeBuyers.slice().sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
      setBuyers(sorted);
    }
  }, [storeBuyers]);

  // Filtered data based on search
  const filteredBuyers = useMemo(() => {
    if (!searchText.trim()) return buyers;
    const search = searchText.toLowerCase();
    return buyers.filter(
      (b) =>
        b.name?.toLowerCase().includes(search) ||
        b.email?.toLowerCase().includes(search) ||
        b.phone?.includes(search) ||
        b.city?.toLowerCase().includes(search) ||
        b.state?.toLowerCase().includes(search) ||
        b.contactPerson?.toLowerCase().includes(search) ||
        b.pan?.toLowerCase().includes(search) ||
        b.gstin?.toLowerCase().includes(search)
    );
  }, [buyers, searchText]);

  // Handle View
  const handleView = (record) => {
    setViewingBuyer(record);
    setViewDrawerVisible(true);
  };

  // Handle Add
  const handleAdd = () => {
    setEditingBuyer(null);
    form.resetFields();
    form.setFieldsValue({ active: true, igstApplicable: false });
    setModalVisible(true);
    setUnsavedChanges(false);
  };

  // Handle Edit
  const handleEdit = (record) => {
    setEditingBuyer(record);
    form.setFieldsValue({
      ...record,
      igstApplicable: Boolean(record.igstApplicable ?? false),
    });
    setModalVisible(true);
    setUnsavedChanges(false);
  };

  // Handle Delete (local only - no API)
  const handleDelete = async (id) => {
    try {
      removeItem('buyers', id);
      setBuyers((prev) => prev.filter((b) => Number(b.id) !== Number(id)));
      message.success('Buyer deleted successfully');
    } catch (error) {
      message.error('Failed to delete buyer');
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
        setUnsavedChanges(true);
      }
    }
  };

  // Form submit (local only - no API)
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const gstin = values.gstin?.toUpperCase();
      const stateCode = gstin && gstin.length >= 2 ? gstin.substring(0, 2) : '';

      const buyerData = {
        ...values,
        active: true,
        pan: values.pan?.toUpperCase(),
        gstin: gstin,
        stateCode: stateCode,
      };

      if (editingBuyer) {
        const updatedBuyer = { ...buyerData, id: editingBuyer.id };
        updateItem('buyers', editingBuyer.id, updatedBuyer);
        setBuyers((prev) => {
          const arr = Array.isArray(prev) ? prev.slice() : [];
          const exists = arr.some((b) => Number(b.id) === Number(updatedBuyer.id));
          if (exists) {
            return arr.map((b) => (Number(b.id) === Number(updatedBuyer.id) ? updatedBuyer : b))
              .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
          }
          arr.unshift(updatedBuyer);
          return arr.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
        });
        if (viewingBuyer && Number(viewingBuyer.id) === Number(editingBuyer.id)) {
          setViewingBuyer(updatedBuyer);
        }
        message.success('Buyer updated successfully');
      } else {
        const newBuyer = { ...buyerData, id: Date.now() };
        addItem('buyers', newBuyer);
        setBuyers((prev) => {
          const arr = Array.isArray(prev) ? prev.slice() : [];
          arr.unshift(newBuyer);
          return arr.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
        });
        message.success('Buyer added successfully');
      }

      setModalVisible(false);
      form.resetFields();
      setEditingBuyer(null);
    } catch (error) {
      if (error?.errorFields) return;
      message.error(`Failed to ${editingBuyer ? 'update' : 'create'} buyer`);
    } finally {
      setSubmitting(false);
    }
  };

  const doCloseModal = () => {
    setModalVisible(false);
    setEditingBuyer(null);
    form.resetFields();
    setUnsavedChanges(false);
  };

  const handleModalClose = () => {
    if (unsavedChanges) {
      Modal.confirm({
        title: 'Unsaved changes',
        content: 'You have unsaved changes. Discard and close?',
        okText: 'Discard',
        cancelText: 'Continue Editing',
        onOk: () => doCloseModal(),
      });
      return;
    }
    doCloseModal();
  };

  // Table columns
  const columns = [
    {
      title: 'Buyer Name',
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
      title: 'Contact Person',
      dataIndex: 'contactPerson',
      key: 'contactPerson',
      width: 160,
      ellipsis: true,
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
              <Button type="text" size="middle" icon={<EyeOutlined />} onClick={() => handleView(record)} style={{ color: '#1890ff' }} />
            </Tooltip>
          )}
          {canUpdate && (
            <Tooltip title="Edit">
              <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} style={{ color: '#52c41a' }} />
            </Tooltip>
          )}
          {canDelete && (
            <Popconfirm
              title="Delete Buyer"
              description={`Are you sure you want to delete "${record.name}"?`}
              onConfirm={() => handleDelete(record.id)}
              okText="Yes"
              cancelText="No"
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="Delete">
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card
        title={
          <Space>
            <span>Buyers</span>
            <Tag>{filteredBuyers.length}</Tag>
          </Space>
        }
        extra={
          <Space>
            <Input
              placeholder="Search buyers..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              style={{ width: 260 }}
            />
            {canAdd && (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                Add Buyer
              </Button>
            )}
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={filteredBuyers}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1000 }}
          size="small"
          pagination={{
            showSizeChanger: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} buyers`,
          }}
        />
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        title={editingBuyer ? 'Edit Buyer' : 'Add Buyer'}
        open={modalVisible}
        onCancel={handleModalClose}
        width={700}
        footer={
          <Space>
            <Button onClick={handleModalClose}>Cancel</Button>
            <Button
              type="primary"
              onClick={handleSubmit}
              loading={submitting}
              disabled={editingBuyer && !unsavedChanges}
            >
              {editingBuyer ? 'Update' : 'Save'}
            </Button>
          </Space>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onValuesChange={() => setUnsavedChanges(true)}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="Buyer Name"
                rules={[
                  { required: true, message: 'Please enter buyer name' },
                  { min: 2, message: 'Name must be at least 2 characters' },
                  { max: 100, message: 'Name cannot exceed 100 characters' },
                ]}
              >
                <Input placeholder="Enter buyer name" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="contactPerson"
                label="Contact Person"
                rules={[{ max: 100, message: 'Name cannot exceed 100 characters' }]}
              >
                <Input placeholder="Enter contact person" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { required: true, message: 'Please enter email' },
                  { pattern: EMAIL_REGEX, message: 'Please enter a valid email' },
                ]}
              >
                <Input placeholder="Enter email address" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="phone"
                label="Phone"
                rules={[
                  { required: true, message: 'Please enter phone number' },
                  { pattern: /^\d{10}$/, message: 'Phone must be exactly 10 digits' },
                ]}
              >
                <Input
                  placeholder="Enter phone number"
                  maxLength={10}
                  onKeyDown={(e) => {
                    if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                      e.preventDefault();
                    }
                  }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: '12px 0' }} />

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="address1" label="Address Line 1">
                <Input placeholder="Address line 1" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="address2" label="Address Line 2">
                <Input placeholder="Address line 2" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="pincode"
                label="Pincode"
                rules={[{ pattern: /^\d{6}$/, message: 'Pincode must be 6 digits' }]}
              >
                <Input
                  placeholder="Enter pincode"
                  maxLength={6}
                  onBlur={handlePincodeBlur}
                  onKeyDown={(e) => {
                    if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                      e.preventDefault();
                    }
                  }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="city" label="City">
                <Input placeholder="City" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="state" label="State">
                <Input placeholder="State" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="country" label="Country">
                <Input placeholder="Country" />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: '12px 0' }} />

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="pan"
                label="PAN"
                rules={[
                  { pattern: PAN_REGEX, message: 'Invalid PAN format (e.g., ABCDE1234F)' },
                ]}
                normalize={(v) => v?.toUpperCase()}
              >
                <Input placeholder="ABCDE1234F" maxLength={10} style={{ textTransform: 'uppercase' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="gstin"
                label="GSTIN"
                rules={[
                  { pattern: GSTIN_REGEX, message: 'Invalid GSTIN format' },
                ]}
                normalize={(v) => v?.toUpperCase()}
              >
                <Input placeholder="22ABCDE1234F1Z5" maxLength={15} style={{ textTransform: 'uppercase' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="igstApplicable" label="IGST Applicable" valuePropName="checked">
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* View Drawer */}
      <Drawer
        title={
          <Space>
            <span>Buyer Details</span>
            {viewingBuyer && (
              <Tag color={viewingBuyer.active !== false ? 'success' : 'default'}>
                {viewingBuyer.active !== false ? 'Active' : 'Inactive'}
              </Tag>
            )}
          </Space>
        }
        placement="right"
        size="large"
        onClose={() => {
          setViewDrawerVisible(false);
          setViewingBuyer(null);
        }}
        open={viewDrawerVisible}
        extra={
          <Space>
            {canUpdate && viewingBuyer && (
              <Button
                icon={<EditOutlined />}
                onClick={() => {
                  handleEdit(viewingBuyer);
                }}
              >
                Edit
              </Button>
            )}
          </Space>
        }
      >
        {viewingBuyer && (
          <>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="Buyer Name" span={2}>
                <Text strong>{viewingBuyer.name}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Contact Person">
                {viewingBuyer.contactPerson || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Email">
                {viewingBuyer.email || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Phone">
                {viewingBuyer.phone || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="IGST Applicable">
                {viewingBuyer.igstApplicable ? 'Yes' : 'No'}
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            <Descriptions column={2} bordered size="small" title="Address">
              <Descriptions.Item label="Address Line 1">
                {viewingBuyer.address1 || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Address Line 2">
                {viewingBuyer.address2 || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="City">
                {viewingBuyer.city || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="State">
                {viewingBuyer.state || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Pincode">
                {viewingBuyer.pincode || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Country">
                {viewingBuyer.country || '-'}
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            <Descriptions column={2} bordered size="small" title="Tax Information">
              <Descriptions.Item label="PAN">
                {viewingBuyer.pan || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="GSTIN">
                {viewingBuyer.gstin || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="State Code">
                {viewingBuyer.stateCode || '-'}
              </Descriptions.Item>
            </Descriptions>

            {(viewingBuyer.createdAt || viewingBuyer.updatedAt) && (
              <>
                <Divider />
                <Descriptions column={2} bordered size="small" title="Timestamps">
                  {viewingBuyer.createdAt && (
                    <Descriptions.Item label="Created">
                      {dayjs(viewingBuyer.createdAt).format('DD MMM YYYY, HH:mm')}
                    </Descriptions.Item>
                  )}
                  {viewingBuyer.updatedAt && (
                    <Descriptions.Item label="Updated">
                      {dayjs(viewingBuyer.updatedAt).format('DD MMM YYYY, HH:mm')}
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </>
            )}
          </>
        )}
      </Drawer>
    </>
  );
};

export default BuyerMaster;
