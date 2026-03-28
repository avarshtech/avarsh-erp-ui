import { Row, Col, Card, Table, Tag, Progress, Space, Typography } from 'antd';
import {
  ShoppingCartOutlined,
  FileTextOutlined,
  ShoppingOutlined,
  InboxOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { Navigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { hasModuleAccess, getFirstAccessibleRoute } from '../utils/permissions';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';

const { Title, Text } = Typography;

const Dashboard = () => {
  const { isDarkMode } = useTheme();

  // If user doesn't have dashboard access, redirect to first accessible menu
  if (!hasModuleAccess('dashboard')) {
    const firstRoute = getFirstAccessibleRoute();
    if (firstRoute !== '/') {
      return <Navigate to={firstRoute} replace />;
    }
  }

  const statsData = [
    {
      title: 'Total Orders',
      value: 1284,
      icon: <ShoppingCartOutlined />,
      growth: 12.5,
      color: 'var(--primary-color)',
    },
    {
      title: 'Active BOMs',
      value: 89,
      icon: <FileTextOutlined />,
      growth: 8.2,
      color: 'var(--success-color)',
    },
    {
      title: 'Pending POs',
      value: 156,
      icon: <ShoppingOutlined />,
      growth: -3.1,
      color: 'var(--warning-color)',
    },
    {
      title: 'GRN Today',
      value: 24,
      icon: <InboxOutlined />,
      growth: 18.7,
      color: 'var(--error-color)',
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
      render: (text) => <Text strong style={{ color: 'var(--primary-color)' }}>{text}</Text>,
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
      render: (amount) => <Text strong style={{ color: 'var(--success-color)' }}>{amount}</Text>,
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
    },
  ];

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Dashboard" subtitle="Welcome back! Here's what's happening with your garments business." />

      {/* Stats Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {statsData.map((stat, index) => (
          <Col xs={24} sm={12} lg={6} key={index}>
            <StatCard
              title={stat.title}
              value={stat.value}
              icon={stat.icon}
              color={stat.color}
              trend={stat.growth >= 0 ? 'up' : 'down'}
              trendValue={`${Math.abs(stat.growth)}% vs last month`}
            />
          </Col>
        ))}
      </Row>

      {/* Production Progress */}
      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={16}>
          <Card title="Recent Orders" extra={<a href="/orders/list">View All</a>}>
            <Table
              rowKey="key"
              columns={orderColumns}
              dataSource={recentOrders}
              pagination={false}
              size="middle"
              scroll={{ x: 'max-content' }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Production Progress">
            <Space direction="vertical" style={{ width: '100%' }} size={16}>
              <div>
                <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text>Cutting Department</Text>
                  <Text strong>85%</Text>
                </Space>
                <Progress percent={85} strokeColor="var(--primary-color)" showInfo={false} />
              </div>
              <div>
                <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text>Sewing Lines</Text>
                  <Text strong>72%</Text>
                </Space>
                <Progress percent={72} strokeColor="var(--success-color)" showInfo={false} />
              </div>
              <div>
                <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text>Finishing</Text>
                  <Text strong>58%</Text>
                </Space>
                <Progress percent={58} strokeColor="var(--warning-color)" showInfo={false} />
              </div>
              <div>
                <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text>Packing</Text>
                  <Text strong>45%</Text>
                </Space>
                <Progress percent={45} strokeColor="var(--error-color)" showInfo={false} />
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
              rowKey="key"
              columns={poColumns}
              dataSource={pendingPOs}
              pagination={false}
              size="middle"
              scroll={{ x: 'max-content' }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Quick Stats">
            <Space direction="vertical" style={{ width: '100%' }} size={16}>
              <Card size="small" style={{ background: isDarkMode ? '#14532d' : '#f0fdf4' }}>
                <Space>
                  <CheckCircleOutlined style={{ fontSize: 24, color: 'var(--success-color)' }} />
                  <div>
                    <Text type="secondary">Completed Today</Text>
                    <Title level={4} style={{ margin: 0 }}>12 Orders</Title>
                  </div>
                </Space>
              </Card>
              <Card size="small" style={{ background: isDarkMode ? '#78350f' : '#fef3c7' }}>
                <Space>
                  <ClockCircleOutlined style={{ fontSize: 24, color: 'var(--warning-color)' }} />
                  <div>
                    <Text type="secondary">Pending Approval</Text>
                    <Title level={4} style={{ margin: 0 }}>8 POs</Title>
                  </div>
                </Space>
              </Card>
              <Card size="small" style={{ background: isDarkMode ? '#312e81' : '#e0e7ff' }}>
                <Space>
                  <InboxOutlined style={{ fontSize: 24, color: 'var(--primary-color)' }} />
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
