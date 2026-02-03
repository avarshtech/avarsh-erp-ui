import { useState } from 'react';
import {
  Table,
  Card,
  Button,
  Space,
  Input,
  Tag,
  Dropdown,
  DatePicker,
  Select,
  Typography,
  Modal,
  message,
  Statistic,
  Row,
  Col,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  FilterOutlined,
  ExportOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  MoreOutlined,
  PrinterOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DollarOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const POList = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  const purchaseOrders = [
    {
      key: '1',
      poNumber: 'PO-2024-0156',
      poDate: '2024-01-28',
      supplier: 'Fabric World Inc',
      supplierCode: 'FWI-001',
      category: 'Fabric',
      items: 3,
      totalAmount: 15450.00,
      currency: 'USD',
      expectedDate: '2024-02-05',
      status: 'Pending Approval',
      createdBy: 'John Doe',
    },
    {
      key: '2',
      poNumber: 'PO-2024-0157',
      poDate: '2024-01-27',
      supplier: 'Thread Masters Ltd',
      supplierCode: 'TML-002',
      category: 'Trims',
      items: 5,
      totalAmount: 3200.00,
      currency: 'USD',
      expectedDate: '2024-02-03',
      status: 'Approved',
      createdBy: 'Jane Smith',
    },
    {
      key: '3',
      poNumber: 'PO-2024-0158',
      poDate: '2024-01-26',
      supplier: 'Button Bazaar',
      supplierCode: 'BB-003',
      category: 'Accessories',
      items: 8,
      totalAmount: 1800.00,
      currency: 'USD',
      expectedDate: '2024-02-01',
      status: 'Partially Received',
      createdBy: 'John Doe',
    },
    {
      key: '4',
      poNumber: 'PO-2024-0159',
      poDate: '2024-01-25',
      supplier: 'Denim Suppliers Co',
      supplierCode: 'DSC-004',
      category: 'Fabric',
      items: 2,
      totalAmount: 28500.00,
      currency: 'USD',
      expectedDate: '2024-02-10',
      status: 'Sent to Supplier',
      createdBy: 'Mike Johnson',
    },
    {
      key: '5',
      poNumber: 'PO-2024-0160',
      poDate: '2024-01-24',
      supplier: 'Label Express',
      supplierCode: 'LE-005',
      category: 'Labels',
      items: 4,
      totalAmount: 950.00,
      currency: 'USD',
      expectedDate: '2024-01-30',
      status: 'Completed',
      createdBy: 'Jane Smith',
    },
    {
      key: '6',
      poNumber: 'PO-2024-0161',
      poDate: '2024-01-23',
      supplier: 'Zipper Zone',
      supplierCode: 'ZZ-006',
      category: 'Trims',
      items: 6,
      totalAmount: 2100.00,
      currency: 'USD',
      expectedDate: '2024-02-08',
      status: 'Cancelled',
      createdBy: 'John Doe',
    },
  ];

  const statusConfig = {
    'Draft': { color: 'default', icon: <FileTextOutlined /> },
    'Pending Approval': { color: 'gold', icon: <ClockCircleOutlined /> },
    'Approved': { color: 'blue', icon: <CheckCircleOutlined /> },
    'Sent to Supplier': { color: 'purple', icon: <FileTextOutlined /> },
    'Partially Received': { color: 'orange', icon: <ClockCircleOutlined /> },
    'Completed': { color: 'green', icon: <CheckCircleOutlined /> },
    'Cancelled': { color: 'red', icon: <CloseCircleOutlined /> },
  };

  const summaryStats = [
    { title: 'Total POs', value: 156, color: '#6366f1' },
    { title: 'Pending Approval', value: 12, color: '#f59e0b' },
    { title: 'Total Value', value: 485000, prefix: '$', color: '#10b981' },
    { title: 'Overdue', value: 3, color: '#ef4444' },
  ];

  const columns = [
    {
      title: 'PO Number',
      dataIndex: 'poNumber',
      key: 'poNumber',
      fixed: 'left',
      width: 140,
      render: (text) => (
        <Text strong style={{ color: '#6366f1', cursor: 'pointer' }}>
          {text}
        </Text>
      ),
    },
    {
      title: 'PO Date',
      dataIndex: 'poDate',
      key: 'poDate',
      width: 110,
      sorter: (a, b) => new Date(a.poDate) - new Date(b.poDate),
    },
    {
      title: 'Supplier',
      key: 'supplier',
      width: 180,
      render: (_, record) => (
        <div>
          <Text strong>{record.supplier}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.supplierCode}
          </Text>
        </div>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 110,
      render: (cat) => <Tag>{cat}</Tag>,
      filters: [
        { text: 'Fabric', value: 'Fabric' },
        { text: 'Trims', value: 'Trims' },
        { text: 'Accessories', value: 'Accessories' },
        { text: 'Labels', value: 'Labels' },
      ],
      onFilter: (value, record) => record.category === value,
    },
    {
      title: 'Items',
      dataIndex: 'items',
      key: 'items',
      width: 80,
      align: 'center',
    },
    {
      title: 'Total Amount',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 140,
      align: 'right',
      render: (amount, record) => (
        <Text strong style={{ color: '#10b981' }}>
          ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </Text>
      ),
      sorter: (a, b) => a.totalAmount - b.totalAmount,
    },
    {
      title: 'Expected Date',
      dataIndex: 'expectedDate',
      key: 'expectedDate',
      width: 120,
      sorter: (a, b) => new Date(a.expectedDate) - new Date(b.expectedDate),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      fixed: 'right',
      render: (status) => (
        <Tag
          color={statusConfig[status]?.color}
          icon={statusConfig[status]?.icon}
          style={{ borderRadius: 20 }}
        >
          {status}
        </Tag>
      ),
      filters: Object.keys(statusConfig).map((s) => ({ text: s, value: s })),
      onFilter: (value, record) => record.status === value,
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 80,
      render: (_, record) => (
        <Dropdown
          menu={{
            items: [
              { key: 'view', icon: <EyeOutlined />, label: 'View Details' },
              { key: 'edit', icon: <EditOutlined />, label: 'Edit PO' },
              { key: 'print', icon: <PrinterOutlined />, label: 'Print' },
              { key: 'approve', icon: <CheckCircleOutlined />, label: 'Approve', disabled: record.status !== 'Pending Approval' },
              { type: 'divider' },
              { key: 'cancel', icon: <CloseCircleOutlined />, label: 'Cancel', danger: true },
            ],
            onClick: ({ key }) => handleAction(key, record),
          }}
          trigger={['click']}
        >
          <Button type="text" icon={<MoreOutlined />} />
        </Dropdown>
      ),
    },
  ];

  const handleAction = (key, record) => {
    switch (key) {
      case 'view':
        message.info(`Viewing PO: ${record.poNumber}`);
        break;
      case 'edit':
        navigate(`/purchase-orders/edit/${record.key}`);
        break;
      case 'print':
        message.success('Print dialog opened');
        break;
      case 'approve':
        Modal.confirm({
          title: 'Approve Purchase Order',
          content: `Are you sure you want to approve ${record.poNumber}?`,
          okText: 'Approve',
          onOk: () => message.success('PO approved successfully'),
        });
        break;
      case 'cancel':
        Modal.confirm({
          title: 'Cancel Purchase Order',
          content: `Are you sure you want to cancel ${record.poNumber}?`,
          okText: 'Cancel PO',
          okType: 'danger',
          onOk: () => message.success('PO cancelled'),
        });
        break;
      default:
        break;
    }
  };

  return (
    <div className="animate-fade-in-up">
      <div className="page-header">
        <h1>Purchase Orders</h1>
        <div className="header-actions">
          <Button icon={<ExportOutlined />}>Export</Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/purchase-orders/new')}
          >
            New Purchase Order
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {summaryStats.map((stat, index) => (
          <Col xs={12} sm={6} key={index}>
            <Card size="small" hoverable>
              <Statistic
                title={stat.title}
                value={stat.value}
                prefix={stat.prefix}
                valueStyle={{ color: stat.color, fontWeight: 600 }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card>
        <Space wrap style={{ marginBottom: 16, width: '100%' }}>
          <Input
            placeholder="Search PO..."
            prefix={<SearchOutlined />}
            style={{ width: 250 }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
          />
          <Select
            placeholder="Supplier"
            style={{ width: 180 }}
            allowClear
            options={[
              { label: 'Fabric World Inc', value: 'FWI-001' },
              { label: 'Thread Masters Ltd', value: 'TML-002' },
              { label: 'Button Bazaar', value: 'BB-003' },
            ]}
          />
          <Select
            placeholder="Status"
            style={{ width: 150 }}
            allowClear
            options={Object.keys(statusConfig).map((s) => ({ label: s, value: s }))}
          />
          <RangePicker style={{ width: 280 }} />
          <Button icon={<FilterOutlined />}>More Filters</Button>
        </Space>

        <Table
          columns={columns}
          dataSource={purchaseOrders}
          loading={loading}
          scroll={{ x: 1400 }}
          pagination={{
            total: purchaseOrders.length,
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} POs`,
          }}
          rowSelection={{
            type: 'checkbox',
          }}
        />
      </Card>
    </div>
  );
};

export default POList;
