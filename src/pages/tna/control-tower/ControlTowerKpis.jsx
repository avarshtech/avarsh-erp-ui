import { memo, useMemo } from 'react';
import { Row, Col } from 'antd';
import {
  GlobalOutlined, CheckCircleOutlined, WarningOutlined, FireOutlined, StopOutlined, AuditOutlined,
} from '@ant-design/icons';
import StatCard from '../../../components/StatCard';

/** KPI strip — the six numbers management reads before anything else. */
const ControlTowerKpis = memo(function ControlTowerKpis({ plans, pendingReplans, loading }) {
  const k = useMemo(() => {
    const live = plans.filter((p) => ['ACTIVE', 'DRAFT'].includes(p.planStatus));
    return {
      live: live.length,
      green: live.filter((p) => p.rag === 'GREEN').length,
      amber: live.filter((p) => p.rag === 'AMBER').length,
      red: live.filter((p) => p.rag === 'RED').length,
      criticals: live.reduce((s, p) => s + p.overdueCriticals, 0),
      infeasible: live.filter((p) => p.feasibility === 'INFEASIBLE').length,
    };
  }, [plans]);

  const cards = [
    { title: 'Live Orders', value: k.live, icon: <GlobalOutlined />, color: 'var(--primary-color)' },
    { title: 'On Track', value: k.green, icon: <CheckCircleOutlined />, color: 'var(--success-color)' },
    { title: 'At Risk', value: k.amber, icon: <WarningOutlined />, color: 'var(--warning-color)' },
    { title: 'Delayed', value: k.red, icon: <FireOutlined />, color: 'var(--error-color)' },
    { title: 'Overdue Criticals', value: k.criticals, icon: <FireOutlined />, color: k.criticals ? 'var(--error-color)' : 'var(--success-color)' },
    { title: 'Re-plans Pending', value: pendingReplans, icon: <AuditOutlined />, color: 'var(--accent-color)' },
  ];
  if (k.infeasible) cards[5] = { title: 'Infeasible Plans', value: k.infeasible, icon: <StopOutlined />, color: 'var(--error-color)' };

  return (
    <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
      {cards.map((c) => (
        <Col xs={12} sm={8} xl={4} key={c.title}>
          <StatCard {...c} loading={loading} />
        </Col>
      ))}
    </Row>
  );
});

export default ControlTowerKpis;
