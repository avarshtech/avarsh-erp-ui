import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Table, Space, Tag, Tooltip } from 'antd';
import dayjs from 'dayjs';
import { ActionButton } from '../../../components/buttons';
import EmptyState from '../../../components/EmptyState';
import { getTablePagination } from '../../../utils/paginationConfig';
import { RECEIVING_SHORTAGE_PCT } from '../../../utils/finishingConstants';
import { listReceivings, getOrders } from '../../../services/production/finishingService';
import FinishingStatusTag from './FinishingStatusTag';
import ReceivingDrawer from './ReceivingDrawer';

/** PRD Module 1 — garments received from sewing with qty/size-color verification. */
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
    { title: 'Order', dataIndex: 'orderId', width: 140, render: (v) => orders.find((o) => o.id === v)?.orderNo || '—' },
    { title: 'Color', dataIndex: 'color', width: 110 },
    { title: 'Size', dataIndex: 'size', width: 70, align: 'center' },
    { title: 'Date', dataIndex: 'date', width: 110, render: (v) => dayjs(v).format('DD-MMM-YYYY') },
    { title: 'From', dataIndex: 'sewingLine', width: 90, align: 'center' },
    { title: 'Bundle', dataIndex: 'bundleNo', width: 80, align: 'center', render: (v) => v || '—' },
    { title: 'Received', dataIndex: 'receivingQty', width: 90, align: 'right' },
    {
      title: 'Cumulative / Order', key: 'cum', width: 150, align: 'right',
      render: (_, r) => {
        const pct = r.orderQty ? Math.round((r.cumulativeQty / r.orderQty) * 100) : 0;
        return (
          <Tooltip title={`${pct}% of order qty received for this size`}>
            <span style={{ color: pct < RECEIVING_SHORTAGE_PCT && r.status === 'SHORTAGE' ? 'var(--error-color)' : undefined }}>
              {r.cumulativeQty} / {r.orderQty} ({pct}%)
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: 'Parts Repl.', key: 'parts', width: 100, align: 'center',
      render: (_, r) => (r.partsReplacements?.length ? <Tag color="orange">{r.partsReplacements.length}</Tag> : '—'),
    },
    { title: 'Status', dataIndex: 'status', width: 120, render: (v) => <FinishingStatusTag status={v} /> },
  ], [orders]);

  return (
    <Card>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }} wrap>
        <span style={{ color: 'var(--text-secondary)' }}>
          Entry point of finishing — every piece from sewing is verified here; below {RECEIVING_SHORTAGE_PCT}% cumulative receipt flags a shortage.
        </span>
        <ActionButton action="create" text="Receive from Sewing" onClick={() => setDrawerOpen(true)} />
      </Space>
      <Table rowKey="id" size="small" columns={columns} dataSource={rows} loading={loading}
        rowClassName={(r) => (r.status === 'SHORTAGE' ? 'row-shortage' : '')}
        scroll={{ x: 1200 }} pagination={getTablePagination({ pageSize: 10 }, 'receivings')}
        locale={{ emptyText: <EmptyState title="No receivings yet" description="Record garments arriving from the sewing floor" /> }} />
      <ReceivingDrawer open={drawerOpen} orders={orders}
        onClose={() => setDrawerOpen(false)} onSaved={() => { setDrawerOpen(false); load(); }} />
    </Card>
  );
};

export default ReceivingList;
