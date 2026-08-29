import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Table, Space, Tag, Segmented } from 'antd';
import { CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons';
import dayjs from 'dayjs';
import { ActionButton } from '../../../components/buttons';
import EmptyState from '../../../components/EmptyState';
import { getTablePagination } from '../../../utils/paginationConfig';
import { listTrimCards, getOrders } from '../../../services/production/sewingService';
import SewingStatusTag from './SewingStatusTag';
import TrimVerificationDrawer from './TrimVerificationDrawer';

/** CR-SEW-005 — work-order-driven trim verification with physical-check enforcement. */
const TrimVerificationList = () => {
  const { message } = App.useApp();
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

  const visible = useMemo(() => (filter === 'All' ? rows
    : rows.filter((r) => (filter === 'Verified' ? r.physicallyVerified : !r.physicallyVerified))), [rows, filter]);

  const columns = useMemo(() => [
    { title: 'Card #', dataIndex: 'cardNo', width: 170, render: (v) => <code>{v}</code> },
    { title: 'Order', dataIndex: 'orderId', width: 140, render: (v) => orders.find((o) => o.id === v)?.orderNo || '—' },
    { title: 'Check Type', dataIndex: 'checkType', width: 110, render: (v) => <Tag>{v.replace('_', ' ')}</Tag> },
    { title: 'Date', dataIndex: 'date', width: 110, render: (v) => dayjs(v).format('DD-MMM-YYYY') },
    {
      title: 'Items (Correct / Incorrect)', key: 'items', width: 170, align: 'center',
      render: (_, r) => {
        const correct = (r.items || []).filter((i) => i.status === 'CORRECT').length;
        const incorrect = (r.items || []).filter((i) => i.status === 'INCORRECT').length;
        return (
          <Space size={4}>
            <Tag color="green">{correct} correct</Tag>
            {incorrect ? <Tag color="red">{incorrect} incorrect</Tag> : null}
          </Space>
        );
      },
    },
    {
      title: 'Physically Verified', key: 'pv', width: 140, align: 'center',
      render: (_, r) => (r.physicallyVerified
        ? <Space size={4}><CheckCircleFilled style={{ color: 'var(--success-color)' }} /><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.verifiedAt}</span></Space>
        : <CloseCircleFilled style={{ color: 'var(--error-color)' }} />),
    },
    { title: 'Verified By', dataIndex: 'verifiedBy', width: 140, ellipsis: true },
    { title: 'Status', dataIndex: 'status', width: 110, render: (v) => <SewingStatusTag status={v} /> },
    {
      title: 'Actions', key: 'act', width: 90, fixed: 'right', align: 'center',
      render: (_, r) => <ActionButton action="edit" size="small" onClick={() => setDrawer({ open: true, record: r })} />,
    },
  ], [orders]);

  return (
    <Card>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }} wrap>
        <Space wrap>
          <span style={{ color: 'var(--text-secondary)' }}>Items load from the work order's BOM — verify each as Correct / Incorrect after a physical check.</span>
          <Segmented options={['All', 'Verified', 'Pending']} value={filter} onChange={setFilter} size="small" />
        </Space>
        <ActionButton action="create" text="New Verification Card" onClick={() => setDrawer({ open: true, record: null })} />
      </Space>
      <Table rowKey="id" size="small" columns={columns} dataSource={visible} loading={loading}
        scroll={{ x: 1150 }} pagination={getTablePagination({ pageSize: 10 }, 'cards')}
        locale={{ emptyText: <EmptyState title="No verification cards" description="Verify order trims against the BOM before line loading" /> }} />
      <TrimVerificationDrawer open={drawer.open} record={drawer.record} orders={orders}
        onClose={() => setDrawer({ open: false, record: null })} onSaved={() => { setDrawer({ open: false, record: null }); load(); }} />
    </Card>
  );
};

export default TrimVerificationList;
