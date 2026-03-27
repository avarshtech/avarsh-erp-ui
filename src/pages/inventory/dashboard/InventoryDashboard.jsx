import { useState, useEffect, useCallback } from 'react';
import { App, Card, Row, Col, Progress, Typography } from 'antd';
import PageHeader from '../../../components/PageHeader';
import StatCard from '../../../components/StatCard';
import { getDashboardStats } from '../../../services/inventoryService';
import { formatNumber } from '../../../utils/formatters';
import DashboardKPICards from './DashboardKPICards';
import DashboardAlerts from './DashboardAlerts';

const { Text } = Typography;

const CATEGORY_COLORS = [
  '#1677ff', '#52c41a', '#fa8c16', '#722ed1', '#eb2f96',
  '#13c2c2', '#faad14', '#2f54eb', '#a0d911', '#f5222d', '#597ef7',
];

const InventoryDashboard = () => {
  const { message } = App.useApp();
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDashboardStats();
      setStats(data || {});
    } catch {
      message.error('Failed to load dashboard stats');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { loadData(); }, [loadData]);

  const styles = stats.stockByStyle || [];
  const maxStyleValue = Math.max(...styles.map((c) => c.value), 1);

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Inventory Dashboard" />

      <DashboardKPICards stats={stats} loading={loading} />

      <Row gutter={24} align="stretch" style={{ marginBottom: 24 }}>
        <Col xs={24} lg={14}>
          <Card title="Stock by Style" loading={loading} style={{ height: '100%' }}>
            {styles.map((cat, idx) => (
              <div key={cat.category} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text>{cat.category}</Text>
                  <Text type="secondary">{cat.count} GRNs &middot; ₹{formatNumber(cat.value, 0)}</Text>
                </div>
                <Progress
                  percent={Math.round((cat.value / maxStyleValue) * 100)}
                  strokeColor={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]}
                  showInfo={false}
                  size="small"
                />
              </div>
            ))}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <DashboardAlerts alerts={stats.alerts || []} loading={loading} />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <StatCard
            title="GRNs This Month"
            value={stats.grnThisMonth ?? 0}
            suffix={stats.grnThisMonthValue ? `(₹${formatNumber(stats.grnThisMonthValue, 0)})` : undefined}
            color="var(--primary-color)"
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={8}>
          <StatCard
            title="QC Pass Rate"
            value={stats.qcPassRate ?? 92}
            suffix="%"
            color="var(--success-color)"
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={8}>
          <StatCard
            title="Styles with Pending Material"
            value={stats.stylesWithPendingMaterial ?? 0}
            color="#1677ff"
            loading={loading}
          />
        </Col>
      </Row>
    </div>
  );
};

export default InventoryDashboard;
