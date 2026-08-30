import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Table, Space, Tag, Row, Col, Statistic } from 'antd';
import dayjs from 'dayjs';
import { ActionButton } from '../../../components/buttons';
import EmptyState from '../../../components/EmptyState';
import { getTablePagination } from '../../../utils/paginationConfig';
import { listSpotWash, getOrders, getEmployees } from '../../../services/production/finishingService';
import SpotWashDrawer from './SpotWashDrawer';

/** PRD Module 4 — batch in/pass/reject model (not hourly), stain analytics. */
const SpotWashTab = () => {
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [orders, setOrders] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sw, ords, emps] = await Promise.all([listSpotWash(), getOrders(), getEmployees('SPOT_WASH')]);
      setRows(sw); setOrders(ords); setEmployees(emps);
    } catch { message.error('Failed to load spot wash records'); } finally { setLoading(false); }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const totals = useMemo(() => {
    const t = rows.reduce((acc, r) => ({ in: acc.in + r.pcsIn, pass: acc.pass + r.pcsPass, reject: acc.reject + r.pcsReject }), { in: 0, pass: 0, reject: 0 });
    const byStain = {};
    rows.forEach((r) => { byStain[r.stainType] = (byStain[r.stainType] || 0) + r.pcsIn; });
    return { ...t, byStain };
  }, [rows]);

  const columns = useMemo(() => [
    { title: 'Date', dataIndex: 'date', width: 110, render: (v) => dayjs(v).format('DD-MMM-YYYY') },
    { title: 'Order', dataIndex: 'orderId', width: 140, render: (v) => orders.find((o) => o.id === v)?.orderNo || '—' },
    { title: 'Stain Type', dataIndex: 'stainType', width: 110, render: (v) => <Tag>{v}</Tag> },
    { title: 'Employee', dataIndex: 'employeeId', width: 160, render: (v) => employees.find((e) => e.id === v)?.name || '—' },
    { title: 'Pcs In', dataIndex: 'pcsIn', width: 80, align: 'right' },
    { title: 'Pass', dataIndex: 'pcsPass', width: 80, align: 'right', render: (v) => <span style={{ color: 'var(--success-color)' }}>{v}</span> },
    { title: 'Reject', dataIndex: 'pcsReject', width: 80, align: 'right', render: (v) => (v ? <span style={{ color: 'var(--error-color)' }}>{v}</span> : 0) },
    {
      title: 'Balanced', key: 'bal', width: 100, align: 'center',
      render: (_, r) => (r.pcsIn === r.pcsPass + r.pcsReject
        ? <Tag color="green">In = Out</Tag> : <Tag color="red">Mismatch</Tag>),
    },
  ], [orders, employees]);

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={8} md={4}><Card size="small"><Statistic title="Pieces In" value={totals.in} /></Card></Col>
        <Col xs={8} md={4}><Card size="small"><Statistic title="Cleaned (Pass)" value={totals.pass} styles={{ content: { color: 'var(--success-color)' } }} /></Card></Col>
        <Col xs={8} md={4}><Card size="small"><Statistic title="Rejects" value={totals.reject} styles={{ content: { color: totals.reject ? 'var(--error-color)' : undefined } }} /></Card></Col>
        <Col xs={24} md={12}>
          <Card size="small">
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Stain mix (feeds sewing/machine maintenance feedback)</div>
            <Space wrap>
              {Object.entries(totals.byStain).map(([stain, qty]) => <Tag key={stain}>{stain}: {qty}</Tag>)}
            </Space>
          </Card>
        </Col>
      </Row>
      <Card>
        <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }} wrap>
          <span style={{ color: 'var(--text-secondary)' }}>
            Batch model: Pieces In must equal Pass + Reject at day end. Rejects route to alteration or seconds.
          </span>
          <ActionButton action="create" text="Log Spot Wash Batch" onClick={() => setDrawerOpen(true)} />
        </Space>
        <Table rowKey="id" size="small" columns={columns} dataSource={rows} loading={loading}
          scroll={{ x: 900 }} pagination={getTablePagination({ pageSize: 10 }, 'batches')}
          locale={{ emptyText: <EmptyState title="No spot wash batches" description="Only stained garments route through this station" /> }} />
        <SpotWashDrawer open={drawerOpen} orders={orders} employees={employees}
          onClose={() => setDrawerOpen(false)} onSaved={() => { setDrawerOpen(false); load(); }} />
      </Card>
    </div>
  );
};

export default SpotWashTab;
