import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Table, Space, Tag } from 'antd';
import dayjs from 'dayjs';
import { ActionButton } from '../../../components/buttons';
import EmptyState from '../../../components/EmptyState';
import { getTablePagination } from '../../../utils/paginationConfig';
import { SHADE_BANDS } from '../../../utils/finishingConstants';
import { listShadeGroups, getOrders, getEmployees } from '../../../services/production/finishingService';
import FinishingStatusTag from './FinishingStatusTag';
import ShadeGroupDrawer from './ShadeGroupDrawer';

const bandTag = (band) => {
  const cfg = SHADE_BANDS.find((b) => b.band === band);
  return (
    <Tag style={{ background: cfg?.color, color: band === 'A' ? '#003a8c' : '#fff', border: 'none', fontWeight: 700 }}>
      {band} — {cfg?.label}
    </Tag>
  );
};

/** PRD Module 10 — D65 light-box shade banding per fabric lot; same band per carton. */
const ShadeSegregationTab = () => {
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [orders, setOrders] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [groups, ords, emps] = await Promise.all([listShadeGroups(), getOrders(), getEmployees()]);
      setRows(groups); setOrders(ords); setEmployees(emps);
    } catch { message.error('Failed to load shade groups'); } finally { setLoading(false); }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const columns = useMemo(() => [
    { title: 'Date', dataIndex: 'date', width: 105, render: (v) => dayjs(v).format('DD-MMM') },
    { title: 'Order', dataIndex: 'orderId', width: 140, render: (v) => orders.find((o) => o.id === v)?.orderNo || '—' },
    { title: 'Color', dataIndex: 'color', width: 110 },
    { title: 'Fabric Lot', dataIndex: 'fabricLot', width: 120, render: (v) => <code>{v}</code> },
    { title: 'Shade Band', dataIndex: 'shadeBand', width: 150, render: bandTag },
    { title: 'Qty in Band', dataIndex: 'qty', width: 100, align: 'right' },
    {
      title: 'D65 Light Box', dataIndex: 'lightBox', width: 110, align: 'center',
      render: (v) => (v ? <Tag color="green">Used</Tag> : <Tag color="red">Not used</Tag>),
    },
    { title: 'Inspector', dataIndex: 'inspectorId', width: 150, render: (v) => employees.find((e) => e.id === v)?.name || '—' },
    { title: 'Status', dataIndex: 'status', width: 120, render: (v) => <FinishingStatusTag status={v} /> },
  ], [orders, employees]);

  return (
    <Card>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }} wrap>
        <span style={{ color: 'var(--text-secondary)' }}>
          Shade bands per fabric lot via D65 light box. A carton may only hold one band — packing is blocked until segregation completes.
        </span>
        <Space wrap>
          {SHADE_BANDS.map((b) => <span key={b.band}>{bandTag(b.band)}</span>)}
          <ActionButton action="create" text="Add Shade Group" onClick={() => setDrawerOpen(true)} />
        </Space>
      </Space>
      <Table rowKey="id" size="small" columns={columns} dataSource={rows} loading={loading}
        scroll={{ x: 1100 }} pagination={getTablePagination({ pageSize: 10 }, 'shade groups')}
        locale={{ emptyText: <EmptyState title="No shade groups" description="Segregate dyed lots before packing" /> }} />
      <ShadeGroupDrawer open={drawerOpen} orders={orders} employees={employees}
        onClose={() => setDrawerOpen(false)} onSaved={() => { setDrawerOpen(false); load(); }} />
    </Card>
  );
};

export default ShadeSegregationTab;
