import { useEffect, useState } from 'react';
import { App, Card, Row, Col, Progress, Alert, Space, Tag, Spin, Statistic } from 'antd';
import EmptyState from '../../../components/EmptyState';
import { TRAFFIC_COLORS, EFFICIENCY_BANDS } from '../../../utils/sewingConstants';
import { getFloorDashboard } from '../../../services/production/sewingService';

/** PRD 6.1 — sewing floor overview: per-line traffic lights, targets, WIP, alerts. */
const SewingDashboard = () => {
  const { message } = App.useApp();
  const [data, setData] = useState(null);

  useEffect(() => {
    getFloorDashboard().then(setData).catch(() => message.error('Failed to load floor dashboard'));
  }, [message]);

  if (!data) return <div style={{ textAlign: 'center', padding: 80 }}><Spin /></div>;

  return (
    <div>
      <Space style={{ marginBottom: 12, color: 'var(--text-secondary)' }} wrap>
        Traffic light: <Tag color="green">≥ {EFFICIENCY_BANDS.green}% on target</Tag>
        <Tag color="orange">{EFFICIENCY_BANDS.yellow}–{EFFICIENCY_BANDS.green}% monitor</Tag>
        <Tag color="red">&lt; {EFFICIENCY_BANDS.yellow}% intervene</Tag>
      </Space>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {data.lines.length === 0 && (
          <Col span={24}><Card><EmptyState title="No lines running" description="Start a production plan to see live line status" /></Card></Col>
        )}
        {data.lines.map((l) => (
          <Col xs={24} lg={12} key={l.line}>
            <Card
              size="small"
              styles={{ body: { paddingTop: 12 } }}
              title={(
                <Space size={8}>
                  <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', background: TRAFFIC_COLORS[l.light] }} />
                  <strong>{l.line}</strong>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>{l.orderNo} · {l.styleNo}</span>
                </Space>
              )}
              extra={<Tag color={l.light === 'green' ? 'green' : l.light === 'yellow' ? 'orange' : 'red'}>{l.effPct}% eff.</Tag>}
            >
              <Row gutter={12}>
                <Col span={6}><Statistic title="Completed" value={l.completed} /></Col>
                <Col span={6}><Statistic title="Target / hr" value={l.targetPerHourVal} /></Col>
                <Col span={6}><Statistic title="Last hour" value={l.lastHourOut} /></Col>
                <Col span={6}><Statistic title="WIP on line" value={l.wip} /></Col>
              </Row>
              <div style={{ marginTop: 12 }}>
                <Space style={{ justifyContent: 'space-between', width: '100%', marginBottom: 2 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Today vs target ({l.targetPerDay} pcs)</span>
                  <span>{l.completed} / {l.targetPerDay}</span>
                </Space>
                <Progress
                  percent={l.targetPerDay ? Math.min(100, Math.round((l.completed / l.targetPerDay) * 100)) : 0}
                  size="small"
                  strokeColor={TRAFFIC_COLORS[l.light]}
                />
              </div>
              <Space style={{ marginTop: 8 }} wrap>
                <span style={{ color: 'var(--text-secondary)' }}>
                  Manpower {l.operatorsPresent}/{l.operatorsPlanned}
                </span>
                {l.absenteeismPct > 0 && (
                  <Tag color={l.absenteeismPct > 10 ? 'red' : 'orange'}>Absenteeism {l.absenteeismPct}%</Tag>
                )}
                <span style={{ color: 'var(--text-secondary)' }}>DHU {l.dhu}%</span>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
      <Card title="Alerts" size="small">
        {data.alerts.length === 0
          ? <EmptyState title="No alerts" description="All lines healthy" />
          : data.alerts.map((a, i) => <Alert key={i} type={a.type} showIcon title={a.text} style={{ marginBottom: 8 }} />)}
      </Card>
    </div>
  );
};

export default SewingDashboard;
