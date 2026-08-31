import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Table, Space, Row, Col, Progress, Alert, InputNumber, Checkbox, Spin, Tag, Button, Tooltip } from 'antd';
import { InboxOutlined, ScissorOutlined, DeleteOutlined, RestOutlined, RollbackOutlined } from '@ant-design/icons';
import StatCard from '../../../components/StatCard';
import { FormSelect } from '../../../components/form';
import { formatNumber } from '../../../utils/formatters';
import useCuttingMasters from '../../../hooks/useCuttingMasters';
import { getReconciliation, saveEndBit, returnToInventory, getCutPos } from '../../../services/production/cuttingService';

/**
 * ENH-03 — fabric accountability: received vs used vs end-bits vs re-cut vs
 * waste, with a per-roll end-bit register (editable, with reuse flag — SME
 * practice: reusable end-bits go back for re-cutting / small parts).
 */
const ReconciliationTab = () => {
  const { message, modal } = App.useApp();
  const [cutPos, setCutPos] = useState([]);
  const [cutPoId, setCutPoId] = useState(null);
  const [recon, setRecon] = useState(null);
  const { threshold } = useCuttingMasters();
  const reconcileTolerancePct = threshold('RECONCILE_TOLERANCE_PCT', 0.5);
  const [selectedRolls, setSelectedRolls] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCutPos().then((pos) => { setCutPos(pos); setCutPoId(pos[0]?.id ?? null); })
      .catch(() => message.error('Failed to load Cut POs'));
  }, [message]);

  const load = useCallback(async () => {
    if (!cutPoId) return;
    setLoading(true);
    setSelectedRolls([]);
    try { setRecon(await getReconciliation(cutPoId)); }
    catch { message.error('Failed to load reconciliation'); } finally { setLoading(false); }
  }, [cutPoId, message]);

  useEffect(() => { load(); }, [load]);

  const handleEndBit = useCallback(async (rollNo, patch) => {
    const updated = await saveEndBit(cutPoId, rollNo, patch);
    setRecon(updated);
  }, [cutPoId]);

  const returnableQty = useCallback((row) => (row.status === 'IN_STOCK' ? row.received : row.endBit), []);
  const isReturnable = useCallback((row) => !row.returned && returnableQty(row) > 0, [returnableQty]);

  /** Return one or many rolls / end-bits to fabric inventory under a single FRT note. */
  const handleReturn = useCallback((rows) => {
    const list = Array.isArray(rows) ? rows : [rows];
    const totalKg = list.reduce((s, r) => s + returnableQty(r), 0);
    const breakdown = list.map((r) => `${r.rollNo} (${r.status === 'IN_STOCK' ? 'full roll' : 'end-bit'} · ${returnableQty(r).toFixed(3)} kg)`).join(', ');
    modal.confirm({
      title: `Return ${list.length} item${list.length > 1 ? 's' : ''} to fabric inventory?`,
      content: `${breakdown} — total ${totalKg.toFixed(3)} kg will be stocked back under one Fabric Return Note.`,
      okText: 'Return to Inventory', cancelText: 'Cancel',
      onOk: async () => {
        const updated = await returnToInventory(cutPoId, list.map((r) => r.rollNo));
        setRecon(updated);
        setSelectedRolls([]);
        const ret = updated.rows.find((r) => r.rollNo === list[0].rollNo)?.returned;
        message.success(`${ret?.returnNo}: ${list.length} item${list.length > 1 ? 's' : ''} · ${totalKg.toFixed(3)} kg returned to fabric inventory`);
      },
    });
  }, [cutPoId, modal, message, returnableQty]);

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
        ? <span style={{ color: Math.abs(v) > r.received * (reconcileTolerancePct / 100) ? 'var(--error-color)' : 'var(--success-color)', fontWeight: 600 }}>{formatNumber(v, 3)}</span>
        : '—'),
    },
    {
      title: 'Status', dataIndex: 'status', width: 110, align: 'center',
      render: (v) => (v === 'USED' ? <Tag color="processing">Used</Tag> : <Tag>In Stock</Tag>),
    },
    {
      title: 'Return to Fabric Inventory', key: 'return', width: 210, align: 'center',
      render: (_, r) => {
        if (r.returned) {
          return (
            <Tooltip title={`Returned on ${r.returned.date} (${r.returned.type === 'ROLL' ? 'full roll' : 'end-bit'})`}>
              <Tag color="green"><code>{r.returned.returnNo}</code> · {formatNumber(r.returned.qty, 3)} kg</Tag>
            </Tooltip>
          );
        }
        if (r.status === 'IN_STOCK') {
          return (
            <Button size="small" icon={<RollbackOutlined />} onClick={() => handleReturn(r)}>
              Return Roll ({formatNumber(r.received, 3)} kg)
            </Button>
          );
        }
        if (r.endBit > 0) {
          return (
            <Tooltip title={r.reusable ? 'Reusable end-bit — stock back for re-cutting / small parts' : 'Tip: mark Reusable if this end-bit can be re-cut'}>
              <Button size="small" icon={<RollbackOutlined />} onClick={() => handleReturn(r)}>
                Return End-Bit ({formatNumber(r.endBit, 3)} kg)
              </Button>
            </Tooltip>
          );
        }
        return <span style={{ color: 'var(--text-secondary)' }}>—</span>;
      },
    },
  ], [handleEndBit, handleReturn, reconcileTolerancePct]);

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
              Utilization {recon.utilizationPct}% {recon.utilizationPct < recon.utilizationWarnPct && '— below target'}
            </div>
            <Progress percent={Number(recon.utilizationPct)} status={recon.utilizationPct < recon.utilizationWarnPct ? 'exception' : 'normal'} />
          </div>
        </Space>
      </Card>

      {recon.utilizationPct < recon.utilizationWarnPct && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }}
          title={`Fabric utilization below ${recon.utilizationWarnPct}% — review end-bits and waste before closing this Cut PO`} />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={5}><StatCard title="Received (kg)" value={formatNumber(recon.received, 3)} color="var(--primary-color)" icon={<InboxOutlined />} /></Col>
        <Col xs={12} md={5}><StatCard title="Used in Lays (kg)" value={formatNumber(recon.used, 3)} color="var(--success-color)" icon={<ScissorOutlined />} /></Col>
        <Col xs={12} md={5}><StatCard title="End-Bits (kg)" value={formatNumber(recon.endBitTotal, 3)} color="var(--warning-color)" icon={<RestOutlined />} /></Col>
        <Col xs={12} md={4}><StatCard title="Re-Cut (kg)" value={formatNumber(recon.reCutKg, 3)} color="var(--warning-color)" icon={<ScissorOutlined />} /></Col>
        <Col xs={12} md={5}><StatCard title="Waste (kg)" value={formatNumber(recon.waste, 3)} color="var(--error-color)" icon={<DeleteOutlined />} /></Col>
        <Col xs={12} md={5}><StatCard title="Returned to Inventory (kg)" value={formatNumber(recon.returnedTotal, 3)} color="var(--success-color)" icon={<RollbackOutlined />} /></Col>
      </Row>

      <Card title="Per-Roll Reconciliation & End-Bit Register"
        extra={(
          <Space wrap>
            <span style={{ color: 'var(--text-secondary)' }}>In-stock rolls ({formatNumber(recon.inStock, 3)} kg) are excluded from waste</span>
            <Button type="primary" size="small" icon={<RollbackOutlined />} disabled={!selectedRolls.length}
              onClick={() => handleReturn(recon.rows.filter((r) => selectedRolls.includes(r.rollNo)))}>
              Return Selected{selectedRolls.length ? ` (${selectedRolls.length} · ${formatNumber(recon.rows.filter((r) => selectedRolls.includes(r.rollNo)).reduce((s, r) => s + returnableQty(r), 0), 3)} kg)` : ''}
            </Button>
          </Space>
        )}>
        <Table rowKey="rollNo" size="small" columns={columns} dataSource={recon.rows} pagination={false} scroll={{ x: 1100 }}
          rowSelection={{
            selectedRowKeys: selectedRolls,
            onChange: setSelectedRolls,
            getCheckboxProps: (r) => ({ disabled: !isReturnable(r) }),
          }}
          footer={() => (
            <Space size="large" wrap>
              <span>Used + End-Bits + Re-Cut + Waste + In-Stock = <strong>{formatNumber(recon.used + recon.endBitTotal + recon.reCutKg + recon.waste + recon.inStock, 3)} kg</strong></span>
              <span>Received = <strong>{formatNumber(recon.received, 3)} kg</strong></span>
              <span style={{ color: 'var(--text-secondary)' }}>(must match within ±{reconcileTolerancePct}%)</span>
            </Space>
          )} />
      </Card>
    </div>
  );
};

export default ReconciliationTab;
