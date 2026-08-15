import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Table, Space, Tag, Row, Col, Statistic, Alert } from 'antd';
import dayjs from 'dayjs';
import { ActionButton } from '../../../components/buttons';
import EmptyState from '../../../components/EmptyState';
import { getTablePagination } from '../../../utils/paginationConfig';
import { DEFECT_LIBRARY, ALTERATION_ALERT_PCT, REALTER_CYCLE_ALERT } from '../../../utils/finishingConstants';
import { listAlterations, listCheckings, getOrders, getEmployees } from '../../../services/production/finishingService';
import FinishingStatusTag from './FinishingStatusTag';
import AlterationDrawer from './AlterationDrawer';

/** PRD Module 8 — alteration register with defect source analytics + re-check loop. */
const AlterationList = () => {
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [checkings, setCheckings] = useState([]);
  const [orders, setOrders] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState({ open: false, record: null });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [alts, checks, ords, emps] = await Promise.all([listAlterations(), listCheckings(), getOrders(), getEmployees()]);
      setRows(alts); setCheckings(checks); setOrders(ords); setEmployees(emps);
    } catch { message.error('Failed to load alterations'); } finally { setLoading(false); }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const today = dayjs().format('YYYY-MM-DD');
    const alteredToday = rows.filter((r) => r.date === today).reduce((s, r) => s + r.alterPcs, 0);
    const checkedToday = checkings.filter((c) => c.date === today).reduce((s, c) => s + c.passQty + c.alterQty + c.rejectQty, 0);
    const rate = checkedToday ? Math.round((alteredToday / checkedToday) * 1000) / 10 : 0;
    const bySource = {};
    rows.forEach((r) => { bySource[r.source] = (bySource[r.source] || 0) + r.alterPcs; });
    const max = Math.max(1, ...Object.values(bySource));
    const cycleAlerts = rows.filter((r) => r.cycles >= REALTER_CYCLE_ALERT && r.status !== 'CLOSED');
    return { alteredToday, checkedToday, rate, bySource, max, cycleAlerts };
  }, [rows, checkings]);

  const columns = useMemo(() => [
    { title: 'Alteration #', dataIndex: 'alterNo', width: 160, render: (v) => <code>{v}</code> },
    { title: 'Order', dataIndex: 'orderId', width: 130, render: (v) => orders.find((o) => o.id === v)?.orderNo || '—' },
    { title: 'Size', dataIndex: 'size', width: 60, align: 'center' },
    { title: 'Date', dataIndex: 'date', width: 105, render: (v) => dayjs(v).format('DD-MMM') },
    { title: 'Pcs', dataIndex: 'alterPcs', width: 60, align: 'right' },
    {
      title: 'Defect', dataIndex: 'defectCode', width: 220, ellipsis: true,
      render: (v) => { const d = DEFECT_LIBRARY.find((x) => x.code === v); return d ? `${d.code} — ${d.name}` : v; },
    },
    { title: 'Source', dataIndex: 'source', width: 100, render: (v) => <Tag color={v === 'SEWING' ? 'orange' : v === 'FABRIC' ? 'purple' : v === 'TRIM' ? 'cyan' : 'blue'}>{v}</Tag> },
    { title: 'Done By', dataIndex: 'doneById', width: 140, render: (v) => employees.find((e) => e.id === v)?.name || '—' },
    { title: 'Re-Check', dataIndex: 'recheckResult', width: 120, render: (v) => <FinishingStatusTag status={v === 'PENDING' ? 'PENDING_RECHECK' : v} /> },
    {
      title: 'Cycles', dataIndex: 'cycles', width: 80, align: 'center',
      render: (v) => <strong style={{ color: v >= REALTER_CYCLE_ALERT ? 'var(--error-color)' : undefined }}>{v}</strong>,
    },
    { title: 'Status', dataIndex: 'status', width: 110, render: (v) => <FinishingStatusTag status={v} /> },
    {
      title: '', key: 'act', width: 70, align: 'center',
      render: (_, r) => <ActionButton action="edit" size="small" onClick={() => setDrawer({ open: true, record: r })} />,
    },
  ], [orders, employees]);

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={8} md={4}><Card size="small"><Statistic title="Altered today" value={stats.alteredToday} /></Card></Col>
        <Col xs={8} md={5}>
          <Card size="small">
            <Statistic title={`Alteration rate (alert > ${ALTERATION_ALERT_PCT}%)`} value={stats.rate} suffix="%"
              styles={{ content: { color: stats.rate > ALTERATION_ALERT_PCT ? 'var(--error-color)' : 'var(--success-color)' } }} />
          </Card>
        </Col>
        <Col xs={24} md={10}>
          <Card size="small">
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Defect source Pareto (feeds sewing line feedback)</div>
            {Object.entries(stats.bySource).sort((a, b) => b[1] - a[1]).map(([src, qty]) => (
              <div key={src} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ width: 80, fontSize: 12 }}>{src}</span>
                <div style={{ flex: 1, background: 'var(--bg-secondary)', borderRadius: 4, height: 10, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.round((qty / stats.max) * 100)}%`, height: '100%', background: 'var(--warning-color)', borderRadius: 4 }} />
                </div>
                <strong style={{ width: 30, textAlign: 'right' }}>{qty}</strong>
              </div>
            ))}
          </Card>
        </Col>
      </Row>
      {stats.cycleAlerts.map((a) => (
        <Alert key={a.id} type="warning" showIcon style={{ marginBottom: 8 }}
          title={`${a.alterNo}: ${a.cycles} re-alter cycles — supervisor review required (PRD 11.3)`} />
      ))}
      <Card>
        <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }} wrap>
          <span style={{ color: 'var(--text-secondary)' }}>
            Altered pieces must pass re-check before rejoining the flow. Checking sheets auto-create records here when Alter Qty &gt; 0.
          </span>
          <ActionButton action="create" text="Log Alteration" onClick={() => setDrawer({ open: true, record: null })} />
        </Space>
        <Table rowKey="id" size="small" columns={columns} dataSource={rows} loading={loading}
          scroll={{ x: 1350 }} pagination={getTablePagination({ pageSize: 10 }, 'alterations')}
          locale={{ emptyText: <EmptyState title="No alterations" description="Defective garments route here from every checking stage" /> }} />
        <AlterationDrawer open={drawer.open} record={drawer.record} orders={orders} employees={employees}
          onClose={() => setDrawer({ open: false, record: null })} onSaved={() => { setDrawer({ open: false, record: null }); load(); }} />
      </Card>
    </div>
  );
};

export default AlterationList;
