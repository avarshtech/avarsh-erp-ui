import { useEffect, useState } from 'react';
import { App, Card, Row, Col, Alert, Spin, Statistic, Space, Tag } from 'antd';
import EmptyState from '../../../components/EmptyState';
import { DHU_TARGET_PCT, RFT_TARGET_PCT, ALTERATION_ALERT_PCT, WIP_AGING_DAYS } from '../../../utils/finishingConstants';
import { getFinishingDashboard } from '../../../services/production/finishingService';

/** Finishing floor overview — DHU/RFT/alteration KPIs, station funnel, alerts. */
const FinishingDashboard = () => {
  const { message } = App.useApp();
  const [data, setData] = useState(null);

  useEffect(() => {
    getFinishingDashboard().then(setData).catch(() => message.error('Failed to load finishing dashboard'));
  }, [message]);

  if (!data) return <div style={{ textAlign: 'center', padding: 80 }}><Spin /></div>;

  const maxFunnel = Math.max(1, ...data.funnel.map((f) => f.qty));

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={5}>
          <Card size="small">
            <Statistic title={`DHU today (target < ${DHU_TARGET_PCT}%)`} value={data.dhu} suffix="%"
              styles={{ content: { color: data.dhu <= DHU_TARGET_PCT ? 'var(--success-color)' : 'var(--error-color)' } }} />
          </Card>
        </Col>
        <Col xs={12} md={5}>
          <Card size="small">
            <Statistic title={`RFT % (target > ${RFT_TARGET_PCT}%)`} value={data.rft} suffix="%"
              styles={{ content: { color: data.rft >= RFT_TARGET_PCT ? 'var(--success-color)' : 'var(--warning-color)' } }} />
          </Card>
        </Col>
        <Col xs={12} md={5}>
          <Card size="small">
            <Statistic title={`Alteration rate (alert > ${ALTERATION_ALERT_PCT}%)`} value={data.alterationRate} suffix="%"
              styles={{ content: { color: data.alterationRate <= ALTERATION_ALERT_PCT ? 'var(--success-color)' : 'var(--error-color)' } }} />
          </Card>
        </Col>
        <Col xs={12} md={5}>
          <Card size="small">
            <Statistic title="WIP on floor (pcs)" value={data.wip} />
          </Card>
        </Col>
        <Col xs={12} md={4}>
          <Card size="small">
            <Statistic title={`Oldest batch (limit ${WIP_AGING_DAYS}d)`} value={data.oldestReceiving} suffix="days"
              styles={{ content: { color: data.oldestReceiving > WIP_AGING_DAYS ? 'var(--warning-color)' : 'var(--success-color)' } }} />
          </Card>
        </Col>
      </Row>

      <Card title="Station Throughput (cumulative pieces through each stage)" size="small" style={{ marginBottom: 16 }}>
        {data.funnel.map((f) => (
          <div key={f.stage} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <span style={{ width: 140, fontSize: 13 }}>{f.stage}</span>
            <div style={{ flex: 1, background: 'var(--bg-secondary)', borderRadius: 4, height: 14, overflow: 'hidden' }}>
              <div style={{ width: `${Math.round((f.qty / maxFunnel) * 100)}%`, height: '100%', background: 'var(--primary-color)', borderRadius: 4, opacity: 0.85 }} />
            </div>
            <strong style={{ width: 50, textAlign: 'right' }}>{f.qty}</strong>
          </div>
        ))}
        <Space style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: 12 }} wrap>
          A widening gap between adjacent stages
          <Tag color="orange" style={{ marginInline: 0 }}>WIP building up</Tag>
          points at the bottleneck station.
        </Space>
      </Card>

      <Card title="Alerts" size="small">
        {data.alerts.length === 0
          ? <EmptyState title="No alerts" description="Finishing floor healthy" />
          : data.alerts.map((a, i) => <Alert key={i} type={a.type} showIcon title={a.text} style={{ marginBottom: 8 }} />)}
      </Card>
    </div>
  );
};

export default FinishingDashboard;
