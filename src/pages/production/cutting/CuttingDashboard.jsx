import { useEffect, useState } from 'react';
import { App, Card, Row, Col, Table, Progress, Alert, Space, Tag, Spin } from 'antd';
import { ScissorOutlined, PercentageOutlined, RedoOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import StatCard from '../../../components/StatCard';
import EmptyState from '../../../components/EmptyState';
import { statusLabel, CUTTING_STATUS_COLORS } from '../../../utils/cuttingConstants';
import { getDashboard, getReconciliation, getCutPos } from '../../../services/production/cuttingService';

/** ENH-04 — cutting room overview: KPIs, order progress, relaxation queue, alerts. */
const CuttingDashboard = ({ onNavigateTab }) => {
  const { message } = App.useApp();
  const [data, setData] = useState(null);
  const [utilizationPct, setUtilizationPct] = useState(null);

  useEffect(() => {
    Promise.all([getDashboard(), getCutPos()])
      .then(async ([dash, pos]) => {
        setData(dash);
        const recon = pos[0] ? await getReconciliation(pos[0].id) : null;
        setUtilizationPct(recon?.utilizationPct ?? null);
      })
      .catch(() => message.error('Failed to load cutting dashboard'));
  }, [message]);

  if (!data) return <div style={{ textAlign: 'center', padding: 80 }}><Spin /></div>;

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><StatCard title="Today's Output (pcs)" value={data.todayOutput} color="var(--primary-color)" icon={<ScissorOutlined />} /></Col>
        <Col xs={12} md={6}><StatCard title="Fabric Utilization" value={utilizationPct != null ? `${utilizationPct}%` : '—'} color="var(--success-color)" icon={<PercentageOutlined />} /></Col>
        <Col xs={12} md={6}><StatCard title="Re-Cut Rate" value={`${data.reCutPct}%`} color={data.reCutPct > 2 ? 'var(--error-color)' : 'var(--warning-color)'} icon={<RedoOutlined />} /></Col>
        <Col xs={12} md={6}><StatCard title="TMB First-Pass Rate" value={`${data.tmbPassPct}%`} color="var(--success-color)" icon={<SafetyCertificateOutlined />} /></Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={14}>
          <Card title="Cutting Progress by Cut PO" size="small" styles={{ body: { paddingTop: 12 } }}>
            {data.progress.map((p) => (
              <div key={p.cutPoNo} style={{ marginBottom: 14 }}>
                <Space style={{ justifyContent: 'space-between', width: '100%', marginBottom: 2 }}>
                  <span><strong>{p.cutPoNo}</strong> · {p.styleNo} · {p.color}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{p.cut} / {p.orderQty} pcs</span>
                </Space>
                <Progress percent={p.pct} size="small" status={p.pct >= 100 ? 'success' : 'active'} />
              </div>
            ))}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="Bundle Status" size="small" styles={{ body: { paddingTop: 12 } }}>
            {Object.keys(data.bundleStatus).length === 0
              ? <EmptyState title="No bundles yet" description="Bundles appear after cutting + TMB" />
              : Object.entries(data.bundleStatus).map(([status, count]) => (
                <Space key={status} style={{ justifyContent: 'space-between', width: '100%', marginBottom: 10 }}>
                  <Tag color={CUTTING_STATUS_COLORS[status]}>{statusLabel(status)}</Tag>
                  <div style={{ flex: 1, margin: '0 12px', minWidth: 120 }}>
                    <div style={{
                      height: 8, borderRadius: 4, background: 'var(--bg-secondary)', overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%', borderRadius: 4, background: 'var(--primary-color)',
                        width: `${Math.round((count / Math.max(1, Object.values(data.bundleStatus).reduce((s, v) => s + v, 0))) * 100)}%`,
                      }} />
                    </div>
                  </div>
                  <strong>{count}</strong>
                </Space>
              ))}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Fabric in Relaxation" size="small"
            extra={<a onClick={() => onNavigateTab?.('fabric-in')}>Fabric In →</a>}>
            <Table
              rowKey="id" size="small" pagination={false}
              dataSource={data.pendingRelaxations}
              columns={[
                { title: 'Relaxation #', dataIndex: 'relaxNo', width: 160, render: (v) => <code>{v}</code> },
                { title: 'Fabric', dataIndex: 'fabricType', width: 130 },
                { title: 'Min Hours', dataIndex: 'minHrs', width: 90, align: 'center' },
                { title: 'Ready At', dataIndex: 'readyAt', width: 130 },
                {
                  title: 'Remaining', dataIndex: 'remainingHrs', width: 110, align: 'center',
                  render: (v) => (v <= 0 ? <Tag color="green">Ready</Tag> : <Tag color="blue">{v} h</Tag>),
                },
              ]}
              locale={{ emptyText: <EmptyState title="Nothing relaxing right now" description="All received fabric is ready for laying" /> }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Alerts" size="small">
            {data.alerts.length === 0
              ? <EmptyState title="No alerts" description="Cutting room is running clean" />
              : data.alerts.map((a, i) => (
                <Alert key={i} type={a.type} showIcon title={a.text} style={{ marginBottom: 8 }} />
              ))}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default CuttingDashboard;
