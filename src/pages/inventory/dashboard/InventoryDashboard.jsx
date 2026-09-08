import { useState, useEffect, useCallback } from 'react';
import { App, Card, Row, Col, Progress, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import StatCard from '../../../components/StatCard';
import { getDashboardStats } from '../../../services/inventory/inventoryService';
import { formatNumber } from '../../../utils/formatters';
import DashboardKPICards from './DashboardKPICards';
import DashboardAlerts from './DashboardAlerts';

const { Text } = Typography;

const CATEGORY_COLORS = [
  '#1677ff', '#52c41a', '#fa8c16', '#722ed1', '#eb2f96',
  '#13c2c2', '#faad14', '#2f54eb', '#a0d911', '#f5222d', '#597ef7',
];

/** `quick` matches the segmented filter above the bill passing grid. */
const BILL_CARDS = [
  { key: 'billsPendingVerification', title: 'Bills Pending Verification', quick: 'PENDING', color: 'var(--primary-color)' },
  { key: 'billsPendingApproval', title: 'Bills Pending Approval', quick: 'PENDING', color: 'var(--warning-color)' },
  { key: 'billsParked', title: 'On Hold / Query / Referred', quick: 'ON_HOLD', color: 'var(--error-color)' },
  { key: 'billPassingNetPayableMtd', title: 'Sent to Accounts (MTD)', quick: 'PASSED', color: 'var(--success-color)', currency: true },
];

const InventoryDashboard = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
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
            value={stats.qcPassRate ?? 0}
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

      {/* Supplier invoices waiting on someone. Each card opens the register
          already filtered to what it counts. */}
      <Text strong style={{ display: 'block', margin: '24px 0 12px', fontSize: 15 }}>
        Bill Passing
      </Text>
      <Row gutter={[16, 16]}>
        {BILL_CARDS.map((card) => (
          <Col xs={24} sm={12} lg={6} key={card.key}>
            <div
              role="link"
              tabIndex={0}
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/inventory/bill-passing?quick=${card.quick}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(`/inventory/bill-passing?quick=${card.quick}`);
                }
              }}
            >
              <StatCard
                title={card.title}
                value={stats[card.key] ?? 0}
                prefix={card.currency ? '₹' : undefined}
                precision={card.currency ? 2 : undefined}
                color={card.color}
                loading={loading}
              />
            </div>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default InventoryDashboard;
