import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Table, Space, Tag } from 'antd';
import dayjs from 'dayjs';
import { ActionButton } from '../../../components/buttons';
import EmptyState from '../../../components/EmptyState';
import { getTablePagination } from '../../../utils/paginationConfig';
import { listReplacements, getOrders } from '../../../services/production/sewingService';
import SewingStatusTag from './SewingStatusTag';
import PartsReplacementDrawer from './PartsReplacementDrawer';

/** PRD 4.8 — rejected cut parts found during sewing, replacement workflow with cutting. */
const PartsReplacementList = () => {
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [reqs, ords] = await Promise.all([listReplacements(), getOrders()]);
      setRows(reqs); setOrders(ords);
    } catch { message.error('Failed to load replacement requests'); } finally { setLoading(false); }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const columns = useMemo(() => [
    { title: 'Request #', dataIndex: 'requestNo', width: 180, render: (v) => <code>{v}</code> },
    { title: 'Order', dataIndex: 'orderId', width: 140, render: (v) => orders.find((o) => o.id === v)?.orderNo || '—' },
    { title: 'Date', dataIndex: 'date', width: 110, render: (v) => dayjs(v).format('DD-MMM-YYYY') },
    {
      title: 'Rejected Parts', dataIndex: 'parts', width: 300,
      render: (parts) => parts.map((p, i) => (
        <Tag key={i} color={p.replStatus === 'DELIVERED' ? 'green' : p.replStatus === 'CUT' ? 'blue' : 'orange'}>
          {p.part} {p.size} × {p.pieces} ({p.reason.replace('_', ' ').toLowerCase()})
        </Tag>
      )),
    },
    { title: 'Pieces', key: 'pcs', width: 80, align: 'center', render: (_, r) => <strong>{r.parts.reduce((s, p) => s + p.pieces, 0)}</strong> },
    { title: 'Requested By', dataIndex: 'requestedBy', width: 160, ellipsis: true },
    { title: 'Status', dataIndex: 'status', width: 150, render: (v) => <SewingStatusTag status={v} /> },
  ], [orders]);

  return (
    <Card>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
        <span style={{ color: 'var(--text-secondary)' }}>Requests flow to the cutting room's Re-Cut Register; replacements must match original bundle serials.</span>
        <ActionButton action="create" text="New Replacement Request" onClick={() => setDrawerOpen(true)} />
      </Space>
      <Table rowKey="id" size="small" columns={columns} dataSource={rows} loading={loading}
        scroll={{ x: 1150 }} pagination={getTablePagination({ pageSize: 10 }, 'requests')}
        locale={{ emptyText: <EmptyState title="No replacement requests" description="Report rejected cut parts to the cutting room" /> }} />
      <PartsReplacementDrawer open={drawerOpen} orders={orders}
        onClose={() => setDrawerOpen(false)} onSaved={() => { setDrawerOpen(false); load(); }} />
    </Card>
  );
};

export default PartsReplacementList;
