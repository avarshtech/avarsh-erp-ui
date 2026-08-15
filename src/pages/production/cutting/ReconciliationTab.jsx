import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Table, Space, Row, Col, Progress, Alert, InputNumber, Checkbox, Spin, Tag } from 'antd';
import { InboxOutlined, ScissorOutlined, DeleteOutlined, RestOutlined } from '@ant-design/icons';
import StatCard from '../../../components/StatCard';
import { FormSelect } from '../../../components/form';
import { formatNumber } from '../../../utils/formatters';
import { THRESHOLDS } from '../../../utils/cuttingConstants';
import { getReconciliation, saveEndBit, getCutPos } from '../../../services/production/cuttingService';

/**
 * ENH-03 — fabric accountability: received vs used vs end-bits vs re-cut vs
 * waste, with a per-roll end-bit register (editable, with reuse flag — SME
 * practice: reusable end-bits go back for re-cutting / small parts).
 */
const ReconciliationTab = () => {
  const { message } = App.useApp();
  const [cutPos, setCutPos] = useState([]);
  const [cutPoId, setCutPoId] = useState(null);
  const [recon, setRecon] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCutPos().then((pos) => { setCutPos(pos); setCutPoId(pos[0]?.id ?? null); })
      .catch(() => message.error('Failed to load Cut POs'));
  }, [message]);

  const load = useCallback(async () => {
    if (!cutPoId) return;
    setLoading(true);
    try { setRecon(await getReconciliation(cutPoId)); }
    catch { message.error('Failed to load reconciliation'); } finally { setLoading(false); }
  }, [cutPoId, message]);

  useEffect(() => { load(); }, [load]);

  const handleEndBit = useCallback(async (rollNo, patch) => {
    const updated = await saveEndBit(cutPoId, rollNo, patch);
    setRecon(updated);
  }, [cutPoId]);

  const columns = useMemo(() => [
    { title: 'Roll #', dataIndex: 'rollNo', width: 90, render: (v) => <code>{v}</code> },
    { title: 'Received (kg)', dataIndex: 'received', width: 110, align: 'right', render: (v) => formatNumber(v, 3) },
    { title: 'Used in Lays (kg)', dataIndex: 'used', width: 130, align: 'right', render: (v) => formatNumber(v, 3) },
    {
      title: 'End-Bit (kg)', dataIndex: 'endBit', width: 130, align: 'center',
      render: (v, r) => (
        r.status === 'USED'
          ? <InputNumber size="small" min={0} step={0.05} value={v} style={{ width: 100 }} onChange={(val) => handleEndBit(r.rollNo, { weight: val || 0 })} />
          : '—'
      ),
    },
    {
      title: 'Reusable?', dataIndex: 'reusable', width: 90, align: 'center',
      render: (v, r) => (r.status === 'USED'
        ? <Checkbox checked={v} onChange={(e) => handleEndBit(r.rollNo, { reusable: e.target.checked })} />
        : null),
    },
    {
      title: 'Variance (kg)', dataIndex: 'variance', width: 110, align: 'right',
      render: (v, r) => (r.status === 'USED'
        ? <span style={{ color: Math.abs(v) > r.received * (THRESHOLDS.reconcileTolerancePct / 100) ? 'var(--error-color)' : 'var(--success-color)', fontWeight: 600 }}>{formatNumber(v, 3)}</span>
        : '—'),
    },
    {
      title: 'Status', dataIndex: 'status', width: 110, align: 'center',
      render: (v) => (v === 'USED' ? <Tag color="processing">Used</Tag> : <Tag>In Stock</Tag>),
    },
  ], [handleEndBit]);

  if (!recon || loading) {
    return (
      <Card>
        <Space style={{ marginBottom: 16 }}>
          <FormSelect value={cutPoId} style={{ width: 280 }} placeholder="Cut PO"
            options={cutPos.map((p) => ({ value: p.id, label: `${p.cutPoNo} · ${p.styleNo}` }))} onChange={setCutPoId} />
        </Space>
        <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>
      </Card>
    );
  }

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space size="large" wrap>
          <FormSelect value={cutPoId} style={{ width: 280 }}
            options={cutPos.map((p) => ({ value: p.id, label: `${p.cutPoNo} · ${p.styleNo}` }))} onChange={setCutPoId} />
          <div style={{ minWidth: 260 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Utilization {recon.utilizationPct}% {recon.utilizationPct < THRESHOLDS.utilizationWarn && '— below target'}
            </div>
            <Progress percent={recon.utilizationPct} status={recon.utilizationPct < THRESHOLDS.utilizationWarn ? 'exception' : 'normal'} />
          </div>
        </Space>
      </Card>

      {recon.utilizationPct < THRESHOLDS.utilizationWarn && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }}
          title={`Fabric utilization below ${THRESHOLDS.utilizationWarn}% — review end-bits and waste before closing this Cut PO`} />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={5}><StatCard title="Received (kg)" value={formatNumber(recon.received, 3)} color="var(--primary-color)" icon={<InboxOutlined />} /></Col>
        <Col xs={12} md={5}><StatCard title="Used in Lays (kg)" value={formatNumber(recon.used, 3)} color="var(--success-color)" icon={<ScissorOutlined />} /></Col>
        <Col xs={12} md={5}><StatCard title="End-Bits (kg)" value={formatNumber(recon.endBitTotal, 3)} color="var(--warning-color)" icon={<RestOutlined />} /></Col>
        <Col xs={12} md={4}><StatCard title="Re-Cut (kg)" value={formatNumber(recon.reCutKg, 3)} color="var(--warning-color)" icon={<ScissorOutlined />} /></Col>
        <Col xs={12} md={5}><StatCard title="Waste (kg)" value={formatNumber(recon.waste, 3)} color="var(--error-color)" icon={<DeleteOutlined />} /></Col>
      </Row>

      <Card title="Per-Roll Reconciliation & End-Bit Register"
        extra={<span style={{ color: 'var(--text-secondary)' }}>In-stock rolls ({formatNumber(recon.inStock, 3)} kg) are excluded from waste</span>}>
        <Table rowKey="rollNo" size="small" columns={columns} dataSource={recon.rows} pagination={false} scroll={{ x: 800 }}
          footer={() => (
            <Space size="large" wrap>
              <span>Used + End-Bits + Re-Cut + Waste + In-Stock = <strong>{formatNumber(recon.used + recon.endBitTotal + recon.reCutKg + recon.waste + recon.inStock, 3)} kg</strong></span>
              <span>Received = <strong>{formatNumber(recon.received, 3)} kg</strong></span>
              <span style={{ color: 'var(--text-secondary)' }}>(must match within ±{THRESHOLDS.reconcileTolerancePct}%)</span>
            </Space>
          )} />
      </Card>
    </div>
  );
};

export default ReconciliationTab;
