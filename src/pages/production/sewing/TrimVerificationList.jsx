import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Table, Space, Tag } from 'antd';
import dayjs from 'dayjs';
import { ActionButton } from '../../../components/buttons';
import EmptyState from '../../../components/EmptyState';
import { getTablePagination } from '../../../utils/paginationConfig';
import { listTrimCards, getOrders } from '../../../services/production/sewingService';
import SewingStatusTag from './SewingStatusTag';
import TrimVerificationDrawer from './TrimVerificationDrawer';

/** PRD 4.5 — pre-production gate: materials + approvals checklist before sewing starts. */
const TrimVerificationList = () => {
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState({ open: false, record: null });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cards, ords] = await Promise.all([listTrimCards(), getOrders()]);
      setRows(cards); setOrders(ords);
    } catch { message.error('Failed to load verification cards'); } finally { setLoading(false); }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const columns = useMemo(() => [
    { title: 'Card #', dataIndex: 'cardNo', width: 170, render: (v) => <code>{v}</code> },
    { title: 'Order', dataIndex: 'orderId', width: 140, render: (v) => orders.find((o) => o.id === v)?.orderNo || '—' },
    { title: 'Check Type', dataIndex: 'checkType', width: 110, render: (v) => <Tag>{v.replace('_', ' ')}</Tag> },
    { title: 'Date', dataIndex: 'date', width: 110, render: (v) => dayjs(v).format('DD-MMM-YYYY') },
    {
      title: 'Missing Items', key: 'missing', width: 200,
      render: (_, r) => {
        const missing = Object.entries({ ...r.materials, ...r.approvals }).filter(([, s]) => s === 'MISSING').map(([k]) => k);
        return missing.length ? missing.map((m) => <Tag key={m} color="red">{m}</Tag>) : <Tag color="green">None</Tag>;
      },
    },
    {
      title: 'Open Issues', key: 'issues', width: 100, align: 'center',
      render: (_, r) => {
        const open = (r.issues || []).filter((i) => i.status === 'OPEN').length;
        return open ? <strong style={{ color: 'var(--error-color)' }}>{open}</strong> : 0;
      },
    },
    { title: 'Verified By', dataIndex: 'verifiedBy', width: 140, ellipsis: true },
    { title: 'Gate Status', dataIndex: 'status', width: 130, render: (v) => <SewingStatusTag status={v} /> },
    {
      title: 'Actions', key: 'act', width: 90, fixed: 'right', align: 'center',
      render: (_, r) => <ActionButton action="edit" size="small" onClick={() => setDrawer({ open: true, record: r })} />,
    },
  ], [orders]);

  return (
    <Card>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
        <span style={{ color: 'var(--text-secondary)' }}>Production start is gated on ALL CLEAR — every material and approval accounted for.</span>
        <ActionButton action="create" text="New Verification Card" onClick={() => setDrawer({ open: true, record: null })} />
      </Space>
      <Table rowKey="id" size="small" columns={columns} dataSource={rows} loading={loading}
        scroll={{ x: 1100 }} pagination={getTablePagination({ pageSize: 10 }, 'cards')}
        locale={{ emptyText: <EmptyState title="No verification cards" description="Verify materials and approvals before line loading" /> }} />
      <TrimVerificationDrawer open={drawer.open} record={drawer.record} orders={orders}
        onClose={() => setDrawer({ open: false, record: null })} onSaved={() => { setDrawer({ open: false, record: null }); load(); }} />
    </Card>
  );
};

export default TrimVerificationList;
