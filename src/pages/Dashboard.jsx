import { useState, useEffect, useCallback } from 'react';
import { Row, Col, Alert, Button } from 'antd';
import {
  ShoppingCartOutlined,
  FileTextOutlined,
  ShoppingOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import { Navigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { hasModuleAccess, getFirstAccessibleRoute } from '../utils/permissions';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import RecentOrdersCard from '../components/dashboard/RecentOrdersCard';
import PendingPosCard from '../components/dashboard/PendingPosCard';
import QuickStatsCard from '../components/dashboard/QuickStatsCard';
import { getDashboardSummary } from '../services/dashboard/dashboardService';

const STATS_CONFIG = [
  { key: 'totalOrders', title: 'Total Orders', icon: <ShoppingCartOutlined />, color: 'var(--primary-color)', period: 'vs last month' },
  { key: 'activeBoms', title: 'Active BOMs', icon: <FileTextOutlined />, color: 'var(--success-color)', period: 'vs last month' },
  { key: 'pendingPos', title: 'Pending POs', icon: <ShoppingOutlined />, color: 'var(--warning-color)', period: 'vs last month' },
  { key: 'grnToday', title: 'GRN Today', icon: <InboxOutlined />, color: 'var(--error-color)', period: 'vs yesterday' },
];

const Dashboard = () => {
  const { isDarkMode } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getDashboardSummary());
    } catch {
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  // If user doesn't have dashboard access, redirect to first accessible menu
  if (!hasModuleAccess('dashboard')) {
    const firstRoute = getFirstAccessibleRoute();
    if (firstRoute !== '/') {
      return <Navigate to={firstRoute} replace />;
    }
  }

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Dashboard" subtitle="Welcome back! Here's what's happening with your garments business." />

      {error && (
        <Alert
          type="error"
          showIcon
          message={error}
          style={{ marginBottom: 16 }}
          action={<Button size="small" onClick={loadSummary}>Retry</Button>}
        />
      )}

      {/* Stats Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {STATS_CONFIG.map(({ key, title, icon, color, period }) => {
          const metric = data?.stats?.[key];
          const growth = metric?.growthPercent ?? 0;
          return (
            <Col xs={24} sm={12} lg={6} key={key}>
              <StatCard
                title={title}
                value={metric?.value ?? 0}
                icon={icon}
                color={color}
                loading={loading}
                trend={growth >= 0 ? 'up' : 'down'}
                trendValue={`${Math.abs(growth)}% ${period}`}
              />
            </Col>
          );
        })}
      </Row>

      {/* Recent Orders + Quick Stats */}
      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={16}>
          <RecentOrdersCard orders={data?.recentOrders} loading={loading} />
        </Col>
        <Col xs={24} lg={8}>
          <QuickStatsCard quickStats={data?.quickStats} isDarkMode={isDarkMode} loading={loading} />
        </Col>
      </Row>

      {/* Pending Purchase Orders */}
      <Row gutter={[24, 24]}>
        <Col xs={24}>
          <PendingPosCard pos={data?.pendingPurchaseOrders} loading={loading} />
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
