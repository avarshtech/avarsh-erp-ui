import { Row, Col, Card, Statistic, Table, Tag, Progress, Space, Typography } from 'antd';
import {
  ShoppingCartOutlined,
  FileTextOutlined,
  ShoppingOutlined,
  InboxOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useTheme } from '../context/ThemeContext';

const { Title, Text } = Typography;

const Dashboard = () => {
  const { isDarkMode } = useTheme();
  
  const statsData = [
    {
      title: 'Total Orders',
      value: 1284,
      icon: <ShoppingCartOutlined />,
      growth: 12.5,
      color: isDarkMode ? '#818cf8' : '#6366f1',
      bgColor: isDarkMode ? '#312e81' : '#e0e7ff',
    },
    {
      title: 'Active BOMs',
      value: 89,
      icon: <FileTextOutlined />,
      growth: 8.2,
      color: isDarkMode ? '#4ade80' : '#10b981',
      bgColor: isDarkMode ? '#14532d' : '#d1fae5',
    },
    {
      title: 'Pending POs',
      value: 156,
      icon: <ShoppingOutlined />,
      growth: -3.1,
      color: isDarkMode ? '#fbbf24' : '#f59e0b',
      bgColor: isDarkMode ? '#78350f' : '#fef3c7',
    },
    {
      title: 'GRN Today',
      value: 24,
      icon: <InboxOutlined />,
      growth: 18.7,
      color: isDarkMode ? '#f87171' : '#ef4444',
      bgColor: isDarkMode ? '#7f1d1d' : '#fee2e2',
    },
  ];

  const recentOrders = [
    {
      key: '1',
      orderId: 'ORD-2024-0001',
      customer: 'Fashion Forward Ltd',
      product: 'Men\'s Casual Shirts',
      quantity: 5000,
      status: 'In Production',
      date: '2024-01-28',
    },
    {
      key: '2',
      orderId: 'ORD-2024-0002',
      customer: 'Urban Style Co',
      product: 'Women\'s Summer Dresses',
      quantity: 3000,
      status: 'Pending',
      date: '2024-01-27',
    },
    {
      key: '3',
      orderId: 'ORD-2024-0003',
      customer: 'Kids Kingdom',
      product: 'Children\'s T-Shirts',
      quantity: 8000,
      status: 'Completed',
      date: '2024-01-26',
    },
    {
      key: '4',
      orderId: 'ORD-2024-0004',
      customer: 'Elite Apparel',
      product: 'Premium Polo Shirts',
      quantity: 2500,
      status: 'Quality Check',
      date: '2024-01-25',
    },
  ];

  const pendingPOs = [
    {
      key: '1',
      poNumber: 'PO-2024-0156',
      supplier: 'Fabric World Inc',
      material: 'Cotton Fabric 40s',
      amount: '$15,450',
      dueDate: '2024-02-05',
    },
    {
      key: '2',
      poNumber: 'PO-2024-0157',
      supplier: 'Thread Masters',
      material: 'Polyester Thread',
      amount: '$3,200',
      dueDate: '2024-02-03',
    },
    {
      key: '3',
      poNumber: 'PO-2024-0158',
      supplier: 'Button Bazaar',
      material: 'Shell Buttons 20mm',
      amount: '$1,800',
      dueDate: '2024-02-01',
    },
  ];

  const orderColumns = [
    {
      title: 'Order ID',
      dataIndex: 'orderId',
      key: 'orderId',
      render: (text) => <Text strong style={{ color: isDarkMode ? '#818cf8' : '#6366f1' }}>{text}</Text>,
    },
    {
      title: 'Customer',
      dataIndex: 'customer',
      key: 'customer',
    },
    {
      title: 'Product',
      dataIndex: 'product',
      key: 'product',
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (qty) => qty.toLocaleString(),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const colors = {
          'Pending': 'gold',
          'In Production': 'blue',
          'Quality Check': 'purple',
          'Completed': 'green',
        };
        return <Tag color={colors[status]}>{status}</Tag>;
      },
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
    },
  ];

  const poColumns = [
    {
      title: 'PO Number',
      dataIndex: 'poNumber',
      key: 'poNumber',
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: 'Supplier',
      dataIndex: 'supplier',
      key: 'supplier',
    },
    {
      title: 'Material',
      dataIndex: 'material',
      key: 'material',
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount) => <Text strong style={{ color: isDarkMode ? '#4ade80' : '#10b981' }}>{amount}</Text>,
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
    },
  ];

  return (
    <div className="animate-fade-in-up">
      <div className="page-header">
        <h1>Dashboard</h1>
        <Text type="secondary">Welcome back! Here's what's happening with your garments business.</Text>
      </div>

      {/* Stats Cards */}
      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        {statsData.map((stat, index) => (
          <Col xs={24} sm={12} lg={6} key={index}>
            <Card hoverable>
              <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 14 }}>{stat.title}</Text>
                  <Title level={2} style={{ margin: '8px 0', fontWeight: 700 }}>
                    {stat.value.toLocaleString()}
                  </Title>
                  <Space>
                    {stat.growth >= 0 ? (
                      <Text style={{ color: '#22c55e', fontSize: 12 }}>
                        <ArrowUpOutlined /> {stat.growth}%
                      </Text>
                    ) : (
                      <Text style={{ color: '#ef4444', fontSize: 12 }}>
                        <ArrowDownOutlined /> {Math.abs(stat.growth)}%
                      </Text>
                    )}
                    <Text type="secondary" style={{ fontSize: 12 }}>vs last month</Text>
                  </Space>
                </div>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 12,
                    background: stat.bgColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 24,
                    color: stat.color,
                  }}
                >
                  {stat.icon}
                </div>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Production Progress */}
      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={16}>
          <Card title="Recent Orders" extra={<a href="/orders/list">View All</a>}>
            <Table
              columns={orderColumns}
              dataSource={recentOrders}
              pagination={false}
              size="middle"
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Production Progress">
            <Space orientation="vertical" style={{ width: '100%' }} size={16}>
              <div>
                <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text>Cutting Department</Text>
                  <Text strong>85%</Text>
                </Space>
                <Progress percent={85} strokeColor="#6366f1" showInfo={false} />
              </div>
              <div>
                <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text>Sewing Lines</Text>
                  <Text strong>72%</Text>
                </Space>
                <Progress percent={72} strokeColor="#10b981" showInfo={false} />
              </div>
              <div>
                <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text>Finishing</Text>
                  <Text strong>58%</Text>
                </Space>
                <Progress percent={58} strokeColor="#f59e0b" showInfo={false} />
              </div>
              <div>
                <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text>Packing</Text>
                  <Text strong>45%</Text>
                </Space>
                <Progress percent={45} strokeColor="#ef4444" showInfo={false} />
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Pending POs & Quick Stats */}
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Card title="Pending Purchase Orders" extra={<a href="/purchase-orders/list">View All</a>}>
            <Table
              columns={poColumns}
              dataSource={pendingPOs}
              pagination={false}
              size="middle"
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Quick Stats">
            <Space orientation="vertical" style={{ width: '100%' }} size={16}>
              <Card size="small" style={{ background: isDarkMode ? '#14532d' : '#f0fdf4' }}>
                <Space>
                  <CheckCircleOutlined style={{ fontSize: 24, color: isDarkMode ? '#4ade80' : '#22c55e' }} />
                  <div>
                    <Text type="secondary">Completed Today</Text>
                    <Title level={4} style={{ margin: 0 }}>12 Orders</Title>
                  </div>
                </Space>
              </Card>
              <Card size="small" style={{ background: isDarkMode ? '#78350f' : '#fef3c7' }}>
                <Space>
                  <ClockCircleOutlined style={{ fontSize: 24, color: isDarkMode ? '#fbbf24' : '#f59e0b' }} />
                  <div>
                    <Text type="secondary">Pending Approval</Text>
                    <Title level={4} style={{ margin: 0 }}>8 POs</Title>
                  </div>
                </Space>
              </Card>
              <Card size="small" style={{ background: isDarkMode ? '#312e81' : '#e0e7ff' }}>
                <Space>
                  <InboxOutlined style={{ fontSize: 24, color: isDarkMode ? '#818cf8' : '#6366f1' }} />
                  <div>
                    <Text type="secondary">Expected Deliveries</Text>
                    <Title level={4} style={{ margin: 0 }}>5 GRNs</Title>
                  </div>
                </Space>
              </Card>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
