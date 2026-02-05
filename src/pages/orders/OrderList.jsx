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
  Tooltip,
  Modal,
  message,
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
  ReloadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const OrderList = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedStatus, setSelectedStatus] = useState(null);

  const orders = [
    {
      key: '1',
      orderId: 'ORD-2024-0001',
      orderDate: '2024-01-28',
      customer: 'Fashion Forward Ltd',
      buyerRef: 'FF-2024-089',
      style: 'Men\'s Casual Shirts',
      color: 'Navy Blue, White',
      size: 'S, M, L, XL',
      quantity: 5000,
      unitPrice: 12.50,
      totalAmount: 62500,
      deliveryDate: '2024-03-15',
      status: 'In Production',
      priority: 'High',
    },
    {
      key: '2',
      orderId: 'ORD-2024-0002',
      orderDate: '2024-01-27',
      customer: 'Urban Style Co',
      buyerRef: 'USC-456',
      style: 'Women\'s Summer Dresses',
      color: 'Floral Print',
      size: 'XS, S, M, L',
      quantity: 3000,
      unitPrice: 18.75,
      totalAmount: 56250,
      deliveryDate: '2024-03-20',
      status: 'Pending',
      priority: 'Medium',
    },
    {
      key: '3',
      orderId: 'ORD-2024-0003',
      orderDate: '2024-01-26',
      customer: 'Kids Kingdom',
      buyerRef: 'KK-789',
      style: 'Children\'s T-Shirts',
      color: 'Multicolor',
      size: '2Y, 4Y, 6Y, 8Y',
      quantity: 8000,
      unitPrice: 6.25,
      totalAmount: 50000,
      deliveryDate: '2024-02-28',
      status: 'Completed',
      priority: 'Low',
    },
    {
      key: '4',
      orderId: 'ORD-2024-0004',
      orderDate: '2024-01-25',
      customer: 'Elite Apparel',
      buyerRef: 'EA-2024-012',
      style: 'Premium Polo Shirts',
      color: 'Black, Grey',
      size: 'M, L, XL, XXL',
      quantity: 2500,
      unitPrice: 22.00,
      totalAmount: 55000,
      deliveryDate: '2024-03-10',
      status: 'Quality Check',
      priority: 'High',
    },
    {
      key: '5',
      orderId: 'ORD-2024-0005',
      orderDate: '2024-01-24',
      customer: 'Denim Designers',
      buyerRef: 'DD-567',
      style: 'Slim Fit Jeans',
      color: 'Indigo, Black',
      size: '28, 30, 32, 34, 36',
      quantity: 4000,
      unitPrice: 28.50,
      totalAmount: 114000,
      deliveryDate: '2024-04-01',
      status: 'Cutting',
      priority: 'Medium',
    },
    {
      key: '6',
      orderId: 'ORD-2024-0006',
      orderDate: '2024-01-23',
      customer: 'Sports Active',
      buyerRef: 'SA-890',
      style: 'Athletic Shorts',
      color: 'Blue, Red, Green',
      size: 'S, M, L, XL',
      quantity: 6000,
      unitPrice: 14.00,
      totalAmount: 84000,
      deliveryDate: '2024-02-25',
      status: 'Sewing',
      priority: 'High',
    },
  ];

  const statusColors = {
    'Pending': { color: 'gold', bg: '#fef3c7' },
    'In Production': { color: 'blue', bg: '#dbeafe' },
    'Cutting': { color: 'purple', bg: '#e9d5ff' },
    'Sewing': { color: 'cyan', bg: '#cffafe' },
    'Quality Check': { color: 'geekblue', bg: '#c7d2fe' },
    'Completed': { color: 'green', bg: '#d1fae5' },
    'Cancelled': { color: 'red', bg: '#fee2e2' },
  };

  const priorityColors = {
    'High': 'red',
    'Medium': 'orange',
    'Low': 'green',
  };

  const columns = [
    {
      title: 'Order ID',
      dataIndex: 'orderId',
      key: 'orderId',
      fixed: 'left',
      width: 140,
      render: (text) => (
        <Text strong style={{ color: '#6366f1', cursor: 'pointer' }}>
          {text}
        </Text>
      ),
    },
    {
      title: 'Order Date',
      dataIndex: 'orderDate',
      key: 'orderDate',
      width: 110,
      sorter: (a, b) => new Date(a.orderDate) - new Date(b.orderDate),
    },
    {
      title: 'Customer',
      dataIndex: 'customer',
      key: 'customer',
      width: 160,
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: 'Buyer Ref',
      dataIndex: 'buyerRef',
      key: 'buyerRef',
      width: 120,
    },
    {
      title: 'Style',
      dataIndex: 'style',
      key: 'style',
      width: 180,
    },
    {
      title: 'Color',
      dataIndex: 'color',
      key: 'color',
      width: 130,
      render: (text) => (
        <Tooltip title={text}>
          <Text ellipsis style={{ maxWidth: 110 }}>{text}</Text>
        </Tooltip>
      ),
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      align: 'right',
      render: (qty) => <Text strong>{qty.toLocaleString()}</Text>,
      sorter: (a, b) => a.quantity - b.quantity,
    },
    {
      title: 'Total Amount',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 130,
      align: 'right',
      render: (amount) => (
        <Text strong style={{ color: '#10b981' }}>
          ${amount.toLocaleString()}
        </Text>
      ),
      sorter: (a, b) => a.totalAmount - b.totalAmount,
    },
    {
      title: 'Delivery Date',
      dataIndex: 'deliveryDate',
      key: 'deliveryDate',
      width: 120,
      sorter: (a, b) => new Date(a.deliveryDate) - new Date(b.deliveryDate),
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (priority) => (
        <Tag color={priorityColors[priority]}>{priority}</Tag>
      ),
      filters: [
        { text: 'High', value: 'High' },
        { text: 'Medium', value: 'Medium' },
        { text: 'Low', value: 'Low' },
      ],
      onFilter: (value, record) => record.priority === value,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      fixed: 'right',
      render: (status) => (
        <Tag
          color={statusColors[status]?.color}
          style={{ borderRadius: 20, fontWeight: 500 }}
        >
          {status}
        </Tag>
      ),
      filters: Object.keys(statusColors).map((s) => ({ text: s, value: s })),
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
              { key: 'edit', icon: <EditOutlined />, label: 'Edit Order' },
              { type: 'divider' },
              { key: 'delete', icon: <DeleteOutlined />, label: 'Delete', danger: true },
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
        message.info(`Viewing order: ${record.orderId}`);
        break;
      case 'edit':
        navigate(`/orders/edit/${record.key}`);
        break;
      case 'delete':
        Modal.confirm({
          title: 'Delete Order',
          content: `Are you sure you want to delete order ${record.orderId}?`,
          okText: 'Delete',
          okType: 'danger',
          onOk: () => message.success('Order deleted successfully'),
        });
        break;
      default:
        break;
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    // Refresh data immediately - no artificial delay
    setLoading(false);
    message.success('Data refreshed');
  };

  return (
    <div className="animate-fade-in-up">
      <div className="page-header">
        <h1>Order Management</h1>
        <div className="header-actions">
          <Button icon={<ExportOutlined />}>Export</Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/orders/new')}
          >
            New Order
          </Button>
        </div>
      </div>

      <Card>
        {/* Filters */}
        <Space wrap style={{ marginBottom: 16, width: '100%' }}>
          <Input
            placeholder="Search orders..."
            prefix={<SearchOutlined />}
            style={{ width: 250 }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
          />
          <Select
            placeholder="Status"
            style={{ width: 150 }}
            allowClear
            options={Object.keys(statusColors).map((s) => ({ label: s, value: s }))}
            value={selectedStatus}
            onChange={setSelectedStatus}
          />
          <RangePicker style={{ width: 280 }} />
          <Button icon={<FilterOutlined />}>More Filters</Button>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
            Refresh
          </Button>
        </Space>

        {/* Table */}
        <Table
          columns={columns}
          dataSource={orders}
          loading={loading}
          scroll={{ x: 1600 }}
          pagination={{
            total: orders.length,
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} orders`,
          }}
          rowSelection={{
            type: 'checkbox',
            onChange: (selectedRowKeys) => {
              console.log('Selected:', selectedRowKeys);
            },
          }}
        />
      </Card>
    </div>
  );
};

export default OrderList;
