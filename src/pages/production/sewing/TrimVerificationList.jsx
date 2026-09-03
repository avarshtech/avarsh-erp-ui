import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Table, Space, Tag, Segmented } from 'antd';
import { CheckCircleFilled } from '@ant-design/icons';
import dayjs from 'dayjs';
import { ActionButton } from '../../../components/buttons';
import EmptyState from '../../../components/EmptyState';
import { getTablePagination } from '../../../utils/paginationConfig';
import useSewingMasters from '../../../hooks/useSewingMasters';
import { listTrimCards, getOrders } from '../../../services/production/sewingService';
import SewingStatusTag from './SewingStatusTag';
import TrimVerificationDrawer from './TrimVerificationDrawer';

const FILTERS = ['All', 'Verified', 'Issues found'];

/** CR-SEW-005 — BOM-driven trim verification with physical-check enforcement. */
const TrimVerificationList = () => {
  const { message } = App.useApp();
  const { labelOf } = useSewingMasters();
  const [rows, setRows] = useState([]);
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('All');
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

  // A card cannot be filed unverified, so what separates them is what they
  // found — not whether the physical check happened.
  const visible = useMemo(() => (filter === 'All' ? rows
    : rows.filter((r) => (filter === 'Verified' ? r.outcome === 'VERIFIED' : r.outcome !== 'VERIFIED'))), [rows, filter]);

  const columns = useMemo(() => [
    { title: 'Card #', dataIndex: 'cardNo', width: 170, render: (v) => <code>{v}</code> },
    { title: 'Order', dataIndex: 'orderNo', width: 140, render: (v) => v || '—' },
    { title: 'Style', dataIndex: 'styleNo', width: 130, ellipsis: true, render: (v) => v || '—' },
    { title: 'Check Type', dataIndex: 'checkType', width: 130, render: (v) => <Tag>{labelOf('CHECK_TYPE', v)}</Tag> },
    { title: 'Date', dataIndex: 'cardDate', width: 110, render: (v) => dayjs(v).format('DD-MMM-YYYY') },
    {
      title: 'Items (Correct / Incorrect)', key: 'items', width: 180, align: 'center',
      render: (_, r) => (
        <Space size={4}>
          <Tag color="green">{r.correctItems} correct</Tag>
          {r.incorrectItems ? <Tag color="red">{r.incorrectItems} incorrect</Tag> : null}
        </Space>
      ),
    },
    {
      title: 'Physically Verified', dataIndex: 'verifiedAt', width: 165, align: 'center',
      render: (v) => (
        <Space size={4}>
          <CheckCircleFilled style={{ color: 'var(--success-color)' }} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{dayjs(v).format('DD-MMM HH:mm')}</span>
        </Space>
      ),
    },
    { title: 'Verified By', dataIndex: 'verifiedBy', width: 140, ellipsis: true },
    { title: 'Outcome', dataIndex: 'outcome', width: 140, render: (v) => <SewingStatusTag status={v} /> },
    {
      title: 'Actions', key: 'act', width: 90, fixed: 'right', align: 'center',
      render: (_, r) => <ActionButton action="edit" size="small" onClick={() => setDrawer({ open: true, record: r })} />,
    },
  ], [labelOf]);

  return (
    <Card>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }} wrap>
        <Space wrap>
          <span style={{ color: 'var(--text-secondary)' }}>Items load from the order&apos;s BOM — verify each as Correct / Incorrect after a physical check.</span>
          <Segmented options={FILTERS} value={filter} onChange={setFilter} size="small" />
        </Space>
        <ActionButton action="create" text="New Verification Card" onClick={() => setDrawer({ open: true, record: null })} />
      </Space>
      <Table rowKey="id" size="small" columns={columns} dataSource={visible} loading={loading}
        scroll={{ x: 1300 }} pagination={getTablePagination({ pageSize: 10 }, 'cards')}
        locale={{ emptyText: <EmptyState title="No verification cards" description="Verify order trims against the BOM before line loading" /> }} />
      <TrimVerificationDrawer open={drawer.open} record={drawer.record} orders={orders}
        onClose={() => setDrawer({ open: false, record: null })} onSaved={() => { setDrawer({ open: false, record: null }); load(); }} />
    </Card>
  );
};

export default TrimVerificationList;
