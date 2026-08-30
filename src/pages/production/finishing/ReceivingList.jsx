import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Table, Space, Tag } from 'antd';
import dayjs from 'dayjs';
import { ActionButton } from '../../../components/buttons';
import EmptyState from '../../../components/EmptyState';
import { getTablePagination } from '../../../utils/paginationConfig';
import { listReceivings, getOrders } from '../../../services/production/finishingService';
import FinishingStatusTag from './FinishingStatusTag';
import ReceivingDrawer from './ReceivingDrawer';

/** Module 1 (rev) — garments received against a sewing Garment Issue, size-wise. */
const ReceivingList = () => {
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [receivings, ords] = await Promise.all([listReceivings(), getOrders()]);
      setRows(receivings); setOrders(ords);
    } catch { message.error('Failed to load receivings'); } finally { setLoading(false); }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const columns = useMemo(() => [
    { title: 'Receiving #', dataIndex: 'receivingNo', width: 170, render: (v) => <code>{v}</code> },
    { title: 'Issue # (Sewing)', dataIndex: 'issueNo', width: 160, render: (v) => <code>{v}</code> },
    { title: 'Order', dataIndex: 'orderId', width: 140, render: (v) => orders.find((o) => o.id === v)?.orderNo || '—' },
    { title: 'Trimming PO', dataIndex: 'trimmingPoNo', width: 140, render: (v) => v || '—' },
    { title: 'Checking PO', dataIndex: 'checkingPoNo', width: 140, render: (v) => v || '—' },
    { title: 'Date', dataIndex: 'date', width: 110, render: (v) => dayjs(v).format('DD-MMM-YYYY') },
    {
      title: 'Size-wise (Issued → Received)', key: 'lines', width: 260,
      render: (_, r) => (r.lines || []).map((l) => {
        const diff = (l.receivedQty || 0) - (l.issuedQty || 0);
        return (
          <Tag key={l.size} color={diff < 0 ? 'red' : diff > 0 ? 'gold' : 'green'}>
            {l.size}: {l.issuedQty}→{l.receivedQty}
          </Tag>
        );
      }),
    },
    {
      title: 'Received', key: 'total', width: 90, align: 'right',
      render: (_, r) => <strong>{(r.lines || []).reduce((s, l) => s + (l.receivedQty || 0), 0)}</strong>,
    },
    { title: 'Status', dataIndex: 'status', width: 110, render: (v) => <FinishingStatusTag status={v} /> },
  ], [orders]);

  return (
    <Card>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }} wrap>
        <span style={{ color: 'var(--text-secondary)' }}>
          Receiving mirrors Sewing's Garment Issue to Finishing — pick the Issue #, receive size-wise; shortage red, excess yellow, exact green.
        </span>
        <ActionButton action="create" text="Receive from Sewing" onClick={() => setDrawerOpen(true)} />
      </Space>
      <Table rowKey="id" size="small" columns={columns} dataSource={rows} loading={loading}
        rowClassName={(r) => (r.status === 'SHORTAGE' ? 'row-shortage' : '')}
        scroll={{ x: 1300 }} pagination={getTablePagination({ pageSize: 10 }, 'receivings')}
        locale={{ emptyText: <EmptyState title="No receivings yet" description="Receive garments against a sewing issue document" /> }} />
      <ReceivingDrawer open={drawerOpen} orders={orders}
        onClose={() => setDrawerOpen(false)} onSaved={() => { setDrawerOpen(false); load(); }} />
    </Card>
  );
};

export default ReceivingList;
