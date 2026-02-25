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
  Empty,
  Drawer,
  Descriptions,
  Divider,
  Select,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  ExclamationCircleOutlined,
  BankOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  getBuyers,
  createBuyer,
  updateBuyer,
  deleteBuyer,
} from '../../services/buyerService';
import { hasPermission } from '../../utils/permissions';
import { useStore } from '../../context/StoreContext';
import { COUNTRIES, getCountryISO2 } from '../../utils/countries';
import { lookupPostalCode } from '../../services/locationService';

const { Text, Title } = Typography;

// Validation patterns
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SWIFT_REGEX = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

// Input normalizers — strip special chars on type
const alphanumericOnly = (val) => val?.replace(/[^a-zA-Z0-9\s]/g, '') || '';
const lettersOnly = (val) => val?.replace(/[^a-zA-Z\s.'-]/g, '') || '';
const postalCodeOnly = (val) => val?.replace(/[^a-zA-Z0-9\s-]/g, '') || '';
const phoneOnly = (val) => val?.replace(/[^0-9+\-\s()]/g, '') || '';
const nameWithSpecial = (val) => val?.replace(/[^a-zA-Z0-9\s.&',-]/g, '') || '';

const BuyerMaster = () => {
  // Store context
  const {
    buyers: storeBuyers,
    setData,
    isCacheValid,
    setLoading: setStoreLoading,
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

  // Shipping locations state (managed outside Form)
  const [shippingLocations, setShippingLocations] = useState([]);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [locationForm] = Form.useForm();

  // Permissions
  const canView = hasPermission('buyer-info', 'view');
  const canAdd = hasPermission('buyer-info', 'add');
  const canUpdate = hasPermission('buyer-info', 'update');
  const canDelete = hasPermission('buyer-info', 'delete');

  // Fetch buyers with store caching
  const fetchBuyers = useCallback(async (force = false) => {
    if (!force && isCacheValid('buyers') && storeBuyers.length > 0) {
      setBuyers(storeBuyers);
      return;
    }

    setLoading(true);
    setStoreLoading('buyers', true);
    try {
      const response = await getBuyers();
      let data = Array.isArray(response) ? response : response?.content || response?.data || [];
      if (Array.isArray(data)) {
        data = data.slice().sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
      }
      setBuyers(data);
      setData('buyers', data);
    } catch (error) {
      message.error('Failed to load buyers');
      setBuyers([]);
    } finally {
      setLoading(false);
      setStoreLoading('buyers', false);
    }
  }, [storeBuyers, isCacheValid, setData, setStoreLoading]);

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
        b.contactPerson?.toLowerCase().includes(search)
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
    form.setFieldsValue({ active: true });
    setShippingLocations([]);
    setModalVisible(true);
    setUnsavedChanges(false);
  };

  // Handle Edit
  const handleEdit = (record) => {
    setEditingBuyer(record);
    form.setFieldsValue({ ...record });
    setShippingLocations(
      (record.shippingLocations || []).map((loc, idx) => ({
        ...loc,
        key: loc.id || `loc_${idx}_${Date.now()}`,
      }))
    );
    setModalVisible(true);
    setUnsavedChanges(false);
  };

  // Handle Delete
  const handleDelete = async (id) => {
    try {
      await deleteBuyer(id);
      removeItem('buyers', id);
      message.success('Buyer deleted successfully');
    } catch (error) {
      message.error(error?.errorMessage || 'Failed to delete buyer');
    }
  };

  // Form submit
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // Validate at least one shipping location
      if (shippingLocations.length === 0) {
        message.warning('Please add at least one shipping location');
        return;
      }

      setSubmitting(true);

      const buyerData = {
        ...values,
        active: true,
        swiftCode: values.swiftCode?.toUpperCase() || null,
        shippingLocations: shippingLocations.map(({ key, ...loc }) => ({
          ...loc,
          active: loc.active !== false,
        })),
      };

      if (editingBuyer) {
        const response = await updateBuyer({ ...buyerData, id: editingBuyer.id });
        const updatedBuyer = response?.data || response || { ...buyerData, id: editingBuyer.id };
        updateItem('buyers', editingBuyer.id, updatedBuyer);
        setBuyers((prev) => {
          const arr = Array.isArray(prev) ? prev.slice() : [];
          const exists = arr.some((b) => Number(b.id) === Number(updatedBuyer.id));
          if (exists) {
            return arr
              .map((b) => (Number(b.id) === Number(updatedBuyer.id) ? updatedBuyer : b))
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
        const response = await createBuyer(buyerData);
        const newBuyer = response?.data || response || { ...buyerData, id: Date.now() };
        addItem('buyers', newBuyer);
        setBuyers((prev) => {
          const arr = Array.isArray(prev) ? prev.slice() : [];
          arr.unshift(newBuyer);
          return arr.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
        });
        message.success('Buyer added successfully');
      }

      // Invalidate cache and refresh
      try { invalidateCache && invalidateCache('buyers'); } catch (e) { /* ignore */ }
      try { await fetchBuyers(true); } catch (e) { /* ignore */ }

      setModalVisible(false);
      form.resetFields();
      setEditingBuyer(null);
      setShippingLocations([]);
    } catch (error) {
      if (error?.errorFields) return;
      message.error(error?.errorMessage || `Failed to ${editingBuyer ? 'update' : 'create'} buyer`);
    } finally {
      setSubmitting(false);
    }
  };

  const doCloseModal = () => {
    setModalVisible(false);
    setEditingBuyer(null);
    form.resetFields();
    setShippingLocations([]);
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

  // --- Shipping Location CRUD ---
  const handleAddLocation = () => {
    setEditingLocation(null);
    locationForm.resetFields();
    setLocationModalVisible(true);
  };

  const handleEditLocation = (loc) => {
    setEditingLocation(loc);
    locationForm.setFieldsValue({ ...loc });
    setLocationModalVisible(true);
  };

  const handleDeleteLocation = (key) => {
    setShippingLocations((prev) => prev.filter((l) => l.key !== key));
    setUnsavedChanges(true);
  };

  const handleLocationSubmit = async () => {
    try {
      const values = await locationForm.validateFields();
      if (editingLocation) {
        setShippingLocations((prev) =>
          prev.map((l) => (l.key === editingLocation.key ? { ...l, ...values } : l))
        );
      } else {
        setShippingLocations((prev) => [
          ...prev,
          { ...values, key: `loc_${Date.now()}`, active: true },
        ]);
      }
      setLocationModalVisible(false);
      locationForm.resetFields();
      setEditingLocation(null);
      setUnsavedChanges(true);
    } catch {
      // validation error
    }
  };

  // Handle postal code blur in location form - auto-fill city/state
  const handleLocationPostalCodeBlur = async (e) => {
    const postalCode = e.target.value?.trim();
    const country = locationForm.getFieldValue('country');
    if (!postalCode || !country) return;
    const iso2 = getCountryISO2(country);
    if (!iso2) return;
    try {
      const result = await lookupPostalCode(iso2, postalCode);
      if (result) {
        locationForm.setFieldsValue({ city: result.city, state: result.state });
      }
    } catch {
      message.info('Postal code lookup is temporarily unavailable. Please enter city and state manually.');
    }
  };

  // Check if buyer has bank details
  const hasBankDetails = (buyer) => buyer?.bankName || buyer?.swiftCode;

  // Table columns
  const columns = [
    {
      title: 'Buyer Name',
      dataIndex: 'name',
      key: 'name',
      width: 220,
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
      render: (val) => val || '-',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 220,
      ellipsis: true,
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
      width: 140,
      ellipsis: true,
      render: (val) => val || '-',
    },
    {
      title: 'Locations',
      key: 'locations',
      width: 100,
      align: 'center',
      render: (_, record) => {
        const count = record.shippingLocations?.length || 0;
        return count > 0 ? (
          <Tag icon={<EnvironmentOutlined />} color="blue">{count}</Tag>
        ) : (
          <Text type="secondary">0</Text>
        );
      },
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
              title="Delete Buyer"
              description={`Are you sure you want to delete "${record.name}"?`}
              onConfirm={() => handleDelete(record.id)}
              okText="Delete"
              cancelText="Cancel"
              okButtonProps={{ danger: true }}
              icon={<ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
            >
              <Tooltip title="Delete">
                <Button type="text" size="small" icon={<DeleteOutlined />} danger />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  // Shipping locations table columns (inside buyer modal)
  const locationColumns = [
    {
      title: 'Label',
      dataIndex: 'label',
      key: 'label',
      width: 150,
      ellipsis: true,
      render: (val) => <Text strong>{val}</Text>,
    },
    {
      title: 'Address',
      dataIndex: 'address',
      key: 'address',
      width: 180,
      ellipsis: true,
    },
    {
      title: 'City',
      dataIndex: 'city',
      key: 'city',
      width: 120,
      ellipsis: true,
    },
    {
      title: 'Country',
      dataIndex: 'country',
      key: 'country',
      width: 120,
      ellipsis: true,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Edit">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEditLocation(record)}
              style={{ color: '#1890ff' }}
            />
          </Tooltip>
          <Tooltip title="Remove">
            <Button
              type="text"
              size="small"
              icon={<DeleteOutlined />}
              danger
              onClick={() => handleDeleteLocation(record.key)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title={
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Buyers</div>
          <div style={{ fontSize: 12, color: '#888' }}>Manage buyer master data</div>
        </div>
      }
    >
      <div>
        {/* Header */}
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Input
            placeholder="Search buyers..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{ width: 280 }}
          />
          {canAdd && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              Add Buyer
            </Button>
          )}
        </div>

        {/* Table */}
        <Table
          columns={columns}
          dataSource={filteredBuyers}
          rowKey="id"
          loading={loading}
          size="small"
          scroll={{ x: 1000 }}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} buyers`,
            pageSizeOptions: ['10', '20', '50', '100'],
            defaultPageSize: 10,
          }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No buyers found"
              >
                {canAdd && (
                  <Button type="primary" onClick={handleAdd}>
                    Add Buyer
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
              <span>Buyer Details</span>
            </Space>
          }
          placement="right"
          styles={{ wrapper: { width: 600 } }}
          onClose={() => {
            setViewDrawerVisible(false);
            setViewingBuyer(null);
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
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Title level={4} style={{ margin: 0 }}>{viewingBuyer.name}</Title>
                  <Tag color={viewingBuyer.active !== false ? 'success' : 'default'}>
                    {viewingBuyer.active !== false ? 'Active' : 'Inactive'}
                  </Tag>
                </div>
              </div>

              <Divider titlePlacement="start">Contact Information</Divider>
              <Descriptions column={1} size="small" styles={{ label: { width: 140 } }} items={[
                { key: 'contactPerson', label: 'Contact Person', children: viewingBuyer.contactPerson || '-' },
                { key: 'email', label: 'Email', children: viewingBuyer.email || '-' },
                { key: 'phone', label: 'Phone', children: viewingBuyer.phone || '-' },
              ]} />

              <Divider titlePlacement="start"><BankOutlined style={{ marginRight: 6 }} />Bank Details</Divider>
              {hasBankDetails(viewingBuyer) ? (
                <Descriptions column={1} size="small" styles={{ label: { width: 140 } }} items={[
                  { key: 'bankName', label: 'Bank Name', children: viewingBuyer.bankName || '-' },
                  { key: 'swiftCode', label: 'SWIFT Code', children: viewingBuyer.swiftCode || '-' },
                ]} />
              ) : (
                <Text type="secondary" style={{ fontSize: 13 }}>No bank details provided</Text>
              )}

              <Divider titlePlacement="start"><EnvironmentOutlined style={{ marginRight: 6 }} />Shipping Locations</Divider>
              {viewingBuyer.shippingLocations?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {viewingBuyer.shippingLocations.map((loc, idx) => (
                    <Card
                      key={loc.id || idx}
                      size="small"
                      title={<Text strong>{loc.label}</Text>}
                      style={{ borderColor: 'var(--border-color, #d9d9d9)' }}
                    >
                      <Descriptions column={2} size="small" items={[
                        { key: 'address', label: 'Address', children: loc.address || '-', span: 2 },
                        { key: 'city', label: 'City', children: loc.city || '-' },
                        { key: 'country', label: 'Country', children: loc.country || '-' },
                        { key: 'state', label: 'State', children: loc.state || '-' },
                        { key: 'postalCode', label: 'Postal Code', children: loc.postalCode || '-' },
                      ]} />
                    </Card>
                  ))}
                </div>
              ) : (
                <Text type="secondary" style={{ fontSize: 13 }}>No shipping locations configured</Text>
              )}

              <Divider titlePlacement="start">Metadata</Divider>
              <Descriptions column={1} size="small" styles={{ label: { width: 140 } }} items={[
                {
                  key: 'created',
                  label: 'Created',
                  children: viewingBuyer.createdAt
                    ? dayjs(viewingBuyer.createdAt).format('YYYY-MM-DD HH:mm')
                    : '-',
                },
                {
                  key: 'updated',
                  label: 'Updated',
                  children: viewingBuyer.updatedAt
                    ? dayjs(viewingBuyer.updatedAt).format('YYYY-MM-DD HH:mm')
                    : '-',
                },
              ]} />
            </>
          )}
        </Drawer>

        {/* Add/Edit Buyer Modal */}
        <Modal
          title={editingBuyer ? 'Update Buyer' : 'Add Buyer'}
          open={modalVisible}
          onCancel={() => handleModalClose()}
          centered
          width={960}
          styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden', paddingRight: 16 } }}
          footer={[
            <Button key="cancel" onClick={() => handleModalClose()}>
              Cancel
            </Button>,
            <Button
              key="submit"
              type="primary"
              loading={submitting}
              onClick={handleSubmit}
              disabled={editingBuyer && !unsavedChanges}
            >
              {editingBuyer ? 'Update' : 'Save'}
            </Button>,
          ]}
        >
          <Form
            form={form}
            layout="vertical"
            requiredMark
            initialValues={{ active: true }}
            onValuesChange={() => setUnsavedChanges(true)}
          >
            {/* --- Buyer Information --- */}
            <Divider orientation="left" style={{ marginTop: 0, fontSize: 13, fontWeight: 600 }}>Buyer Information</Divider>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="name"
                  label="Buyer Name"
                  rules={[
                    { required: true, message: 'Buyer Name is required' },
                    { min: 2, message: 'Name must be at least 2 characters' },
                  ]}
                  normalize={nameWithSpecial}
                >
                  <Input
                    placeholder="Enter Buyer Name"
                    disabled={!!editingBuyer}
                    maxLength={150}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  name="contactPerson"
                  label="Contact Person"
                  rules={[{ required: true, message: 'Contact Person is required' }]}
                  normalize={lettersOnly}
                >
                  <Input placeholder="Enter Contact Person" maxLength={100} />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  name="email"
                  label="Email"
                  rules={[
                    { required: true, message: 'Email is required' },
                    { pattern: EMAIL_REGEX, message: 'Invalid email format' },
                  ]}
                >
                  <Input placeholder="Enter Email" maxLength={150} />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  name="phone"
                  label="Phone"
                  normalize={phoneOnly}
                >
                  <Input placeholder="Enter Phone (with country code)" maxLength={20} />
                </Form.Item>
              </Col>
            </Row>

            {/* --- Bank Details --- */}
            <Divider orientation="left" style={{ fontSize: 13, fontWeight: 600 }}>
              <BankOutlined style={{ marginRight: 6 }} />Bank Details
            </Divider>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="bankName"
                  label="Bank Name"
                  normalize={nameWithSpecial}
                >
                  <Input placeholder="Enter Bank Name" maxLength={100} />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  name="swiftCode"
                  label="SWIFT Code"
                  rules={[
                    {
                      pattern: SWIFT_REGEX,
                      message: 'Invalid SWIFT format (e.g., INGBNL2A)',
                    },
                  ]}
                  normalize={(value) => value?.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 11)}
                >
                  <Input placeholder="e.g., INGBNL2A" maxLength={11} />
                </Form.Item>
              </Col>
            </Row>
          </Form>

          {/* --- Shipping Locations (outside Form) --- */}
          <Divider orientation="left" style={{ fontSize: 13, fontWeight: 600 }}>
            <EnvironmentOutlined style={{ marginRight: 6 }} />Shipping Locations
            <Text type="danger" style={{ fontSize: 11, marginLeft: 8 }}>* At least one required</Text>
          </Divider>

          <div style={{ marginBottom: 12 }}>
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={handleAddLocation}
              block
            >
              Add Shipping Location
            </Button>
          </div>

          {shippingLocations.length > 0 && (
            <Table
              columns={locationColumns}
              dataSource={shippingLocations}
              rowKey="key"
              size="small"
              pagination={false}
              scroll={{ x: 650 }}
              style={{ marginBottom: 8 }}
            />
          )}
        </Modal>

        {/* Shipping Location Sub-Modal */}
        <Modal
          title={editingLocation ? 'Edit Shipping Location' : 'Add Shipping Location'}
          open={locationModalVisible}
          onCancel={() => {
            setLocationModalVisible(false);
            locationForm.resetFields();
            setEditingLocation(null);
          }}
          width={640}
          onOk={handleLocationSubmit}
          okText={editingLocation ? 'Update' : 'Add'}
        >
          <Form form={locationForm} layout="vertical" requiredMark>
            <Row gutter={16}>
              <Col span={24}>
                <Form.Item
                  name="label"
                  label="Location Label"
                  rules={[{ required: true, message: 'Location label is required' }]}
                  normalize={nameWithSpecial}
                >
                  <Input placeholder='e.g., "EU Warehouse", "UK Office", "Main HQ"' maxLength={100} />
                </Form.Item>
              </Col>

              <Col span={24}>
                <Form.Item
                  name="address"
                  label="Address"
                  rules={[{ required: true, message: 'Address is required' }]}
                  normalize={alphanumericOnly}
                >
                  <Input placeholder="Enter Address" maxLength={200} />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  name="country"
                  label="Country"
                  rules={[{ required: true, message: 'Country is required' }]}
                >
                  <Select
                    showSearch
                    placeholder="Select Country"
                    options={COUNTRIES}
                    filterOption={(input, option) =>
                      option.label.toLowerCase().includes(input.toLowerCase())
                    }
                  />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  name="postalCode"
                  label="Postal Code"
                  rules={[{ required: true, message: 'Postal Code is required' }]}
                  normalize={postalCodeOnly}
                >
                  <Input placeholder="Postal Code" maxLength={20} onBlur={handleLocationPostalCodeBlur} />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  name="city"
                  label="City"
                  rules={[{ required: true, message: 'City is required' }]}
                  normalize={lettersOnly}
                >
                  <Input placeholder="Enter City" maxLength={100} />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  name="state"
                  label="State / Province"
                  rules={[{ required: true, message: 'State is required' }]}
                  normalize={lettersOnly}
                >
                  <Input placeholder="Enter State" maxLength={100} />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Modal>
      </div>
    </Card>
  );
};

export default BuyerMaster;
