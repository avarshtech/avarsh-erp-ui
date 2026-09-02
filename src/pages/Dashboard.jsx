import { useState, useEffect, useCallback, useMemo } from 'react';
import { Row, Col, Alert, Button, Card, Tabs } from 'antd';
import {
  ShoppingCartOutlined,
  FileTextOutlined,
  ShoppingOutlined,
  InboxOutlined,
  ExperimentOutlined,
  WarningOutlined,
  ContainerOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { Navigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { hasModuleAccess, getFirstAccessibleRoute } from '../utils/permissions';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import RecentOrdersCard from '../components/dashboard/RecentOrdersCard';
import PendingPosCard from '../components/dashboard/PendingPosCard';
import QuickStatsCard from '../components/dashboard/QuickStatsCard';
import SampleDeadlinesCard from '../components/dashboard/SampleDeadlinesCard';
import SampleStatusBreakdownCard from '../components/dashboard/SampleStatusBreakdownCard';
import useSampleDashboard from '../components/dashboard/useSampleDashboard';
import useExpDocDashboard from '../components/dashboard/useExpDocDashboard';
import ShipmentReadinessCard from '../components/dashboard/ShipmentReadinessCard';
import ExportDocsPendingCard from '../components/dashboard/ExportDocsPendingCard';
import SampleKpiRow from '../components/sample/SampleKpiRow';
import SampleDeadlineAlert from '../components/sample/SampleDeadlineAlert';
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
  // Sample Request widgets — render nothing for users without the module
  const sample = useSampleDashboard();
  // Export Documentation widgets — same contract: nothing renders without the module.
  const expdoc = useExpDocDashboard();

  const sampleQuickStats = useMemo(() => (sample.enabled && sample.data ? [
    {
      icon: <ExperimentOutlined style={{ fontSize: 24, color: '#8b5cf6' }} />,
      label: 'Samples Due Today', value: sample.data.quickStats.dueToday, unit: 'SRs',
      background: isDarkMode ? '#3b0764' : '#f5f3ff',
    },
    {
      icon: <WarningOutlined style={{ fontSize: 24, color: 'var(--error-color)' }} />,
      label: 'Overdue Samples', value: sample.data.quickStats.overdue, unit: 'SRs',
      background: isDarkMode ? '#7f1d1d' : '#fef2f2',
    },
    {
      icon: <CheckCircleOutlined style={{ fontSize: 24, color: 'var(--success-color)' }} />,
      label: 'Samples Approved This Week', value: sample.data.quickStats.approvedThisWeek, unit: 'SRs',
      background: isDarkMode ? '#14532d' : '#f0fdf4',
    },
  ] : []), [sample.enabled, sample.data, isDarkMode]);

  const expDocQuickStats = useMemo(() => (expdoc.enabled && expdoc.data ? [
    {
      icon: <ContainerOutlined style={{ fontSize: 24, color: '#0369a1' }} />,
      label: 'Export Docs Awaiting Approval', value: expdoc.data.quickStats.awaitingApproval, unit: 'docs',
      background: isDarkMode ? '#082f49' : '#f0f9ff',
    },
    {
      icon: <WarningOutlined style={{ fontSize: 24, color: 'var(--warning-color)' }} />,
      label: 'Shipments At Risk', value: expdoc.data.quickStats.shipmentsAtRisk, unit: 'shipments',
      background: isDarkMode ? '#78350f' : '#fffbeb',
    },
  ] : []), [expdoc.enabled, expdoc.data, isDarkMode]);


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

      {sample.enabled && <SampleDeadlineAlert alerts={sample.data?.alerts || []} />}

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

      {/* Sample KPI second row (PRD §12.1) */}
      {sample.enabled && (
        <SampleKpiRow kpis={sample.data?.kpis} loading={sample.loading} style={{ marginBottom: 16 }} />
      )}

      {/* Recent Orders (+ Sample Deadlines tab) + Quick Stats */}
      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={16}>
          {sample.enabled ? (
            <Tabs
              defaultActiveKey="orders"
              items={[
                {
                  key: 'orders',
                  label: 'Recent Orders',
                  children: <RecentOrdersCard orders={data?.recentOrders} loading={loading} />,
                },
                {
                  key: 'samples',
                  label: 'Sample Deadlines',
                  children: <SampleDeadlinesCard deadlines={sample.data?.deadlines} loading={sample.loading} />,
                },
              ]}
            />
          ) : (
            <RecentOrdersCard orders={data?.recentOrders} loading={loading} />
          )}
        </Col>
        <Col xs={24} lg={8}>
          <QuickStatsCard
            quickStats={data?.quickStats}
            isDarkMode={isDarkMode}
            loading={loading}
            extraItems={[...sampleQuickStats, ...expDocQuickStats]}
          />
        </Col>
      </Row>

      {/* Export Documentation (PRD §11.1 "Receives back") — shipment readiness and
          what is waiting on whom. Absent entirely for users without the module. */}
      {expdoc.enabled && (
        <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
          <Col xs={24} lg={14}>
            <Card title="Shipment Readiness" size="small">
              <ShipmentReadinessCard
                rows={expdoc.data?.readiness}
                total={expdoc.data?.readinessTotal || 0}
                loading={expdoc.loading}
              />
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card title="Export Documents Pending" size="small">
              <ExportDocsPendingCard
                rows={expdoc.data?.pending}
                total={expdoc.data?.pendingTotal || 0}
                loading={expdoc.loading}
              />
            </Card>
          </Col>
        </Row>
      )}


      {/* Pending Purchase Orders + Sample Status Breakdown */}
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={sample.enabled ? 16 : 24}>
          <PendingPosCard pos={data?.pendingPurchaseOrders} loading={loading} />
        </Col>
        {sample.enabled && (
          <Col xs={24} lg={8}>
            <SampleStatusBreakdownCard
              byStatus={sample.data?.byStatus}
              byType={sample.data?.byType}
              pendingApprovals={sample.data?.kpis?.pendingApprovals || 0}
              loading={sample.loading}
            />
          </Col>
        )}
      </Row>
    </div>
  );
};

export default Dashboard;
