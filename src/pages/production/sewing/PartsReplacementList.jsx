import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Table, Space, Tag, Button } from 'antd';
import dayjs from 'dayjs';
import { ActionButton } from '../../../components/buttons';
import EmptyState from '../../../components/EmptyState';
import { getTablePagination } from '../../../utils/paginationConfig';
import useSewingMasters from '../../../hooks/useSewingMasters';
import { listReplacements, getOrders, setReplacementPartStatus } from '../../../services/production/sewingService';
import SewingStatusTag from './SewingStatusTag';
import PartsReplacementDrawer from './PartsReplacementDrawer';

const PART_COLOR = { DELIVERED: 'green', CUT: 'blue', PENDING: 'orange' };
/** What the cutting room does next to a part in each state. */
const NEXT_STEP = { PENDING: { status: 'CUT', label: 'Mark cut' }, CUT: { status: 'DELIVERED', label: 'Mark delivered' } };

/** PRD 4.8 — rejected cut parts found during sewing, replacement workflow with cutting. */
const PartsReplacementList = () => {
  const { message } = App.useApp();
  const { labelOf } = useSewingMasters();
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

  const advance = useCallback(async (requestId, part) => {
    const next = NEXT_STEP[part.status];
    if (!next) return;
    try {
      const saved = await setReplacementPartStatus(requestId, part.id, next.status);
      setRows((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
      message.success(`${part.part} ${part.size} marked ${next.status.toLowerCase()}`);
    } catch (e) {
      message.error(e?.response?.data?.message || 'Failed to update the part');
    }
  }, [message]);

  const columns = useMemo(() => [
    { title: 'Request #', dataIndex: 'requestNo', width: 180, render: (v) => <code>{v}</code> },
    { title: 'Order', dataIndex: 'orderNo', width: 140, render: (v) => v || '—' },
    { title: 'Line', dataIndex: 'line', width: 100, align: 'center', render: (v) => v || '—' },
    { title: 'Date', dataIndex: 'requestDate', width: 110, render: (v) => dayjs(v).format('DD-MMM-YYYY') },
    {
      title: 'Rejected Parts', dataIndex: 'parts', width: 330,
      render: (parts) => parts.map((p) => (
        <Tag key={p.id} color={PART_COLOR[p.status]}>
          {p.part} {p.size} × {p.pieces} ({labelOf('DAMAGE_REASON', p.reason).toLowerCase()})
        </Tag>
      )),
    },
    {
      title: 'Pieces (pending / total)', key: 'pcs', width: 165, align: 'center',
      render: (_, r) => <strong>{r.pendingPieces} / {r.totalPieces}</strong>,
    },
    { title: 'Requested By', dataIndex: 'requestedBy', width: 150, ellipsis: true, render: (v) => v || '—' },
    { title: 'Status', dataIndex: 'status', width: 160, render: (v) => <SewingStatusTag status={v} /> },
  ], [labelOf]);

  // Cutting works part by part, so the actions sit on an expanded row rather
  // than on the request: half a request can be cut while the rest is not.
  const expandedRowRender = useCallback((record) => (
    <Space direction="vertical" size={4} style={{ width: '100%' }}>
      {record.parts.map((p) => (
        <Space key={p.id} size="middle" wrap>
          <Tag color={PART_COLOR[p.status]} style={{ minWidth: 92, textAlign: 'center' }}>{p.status}</Tag>
          <span><strong>{p.part}</strong> · size {p.size} · {p.pieces} pcs</span>
          <span style={{ color: 'var(--text-secondary)' }}>bundle {p.serialNo || '—'}</span>
          <span style={{ color: 'var(--text-secondary)' }}>{labelOf('DAMAGE_REASON', p.reason)}</span>
          {p.replacedDate && <span style={{ color: 'var(--success-color)' }}>delivered {dayjs(p.replacedDate).format('DD-MMM')}</span>}
          {NEXT_STEP[p.status] && (
            <Button size="small" onClick={() => advance(record.id, p)}>{NEXT_STEP[p.status].label}</Button>
          )}
        </Space>
      ))}
    </Space>
  ), [advance, labelOf]);

  return (
    <Card>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
        <span style={{ color: 'var(--text-secondary)' }}>Replacements must go back into the original bundle serial; expand a request to advance each part as cutting re-cuts and delivers it.</span>
        <ActionButton action="create" text="New Replacement Request" onClick={() => setDrawerOpen(true)} />
      </Space>
      <Table rowKey="id" size="small" columns={columns} dataSource={rows} loading={loading}
        expandable={{ expandedRowRender }}
        scroll={{ x: 1250 }} pagination={getTablePagination({ pageSize: 10 }, 'requests')}
        locale={{ emptyText: <EmptyState title="No replacement requests" description="Report rejected cut parts to the cutting room" /> }} />
      <PartsReplacementDrawer open={drawerOpen} orders={orders}
        onClose={() => setDrawerOpen(false)} onSaved={() => { setDrawerOpen(false); load(); }} />
    </Card>
  );
};

export default PartsReplacementList;
