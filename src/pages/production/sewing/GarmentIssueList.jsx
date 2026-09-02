import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Table, Space, Tag } from 'antd';
import dayjs from 'dayjs';
import { ActionButton } from '../../../components/buttons';
import EmptyState from '../../../components/EmptyState';
import { getTablePagination } from '../../../utils/paginationConfig';
import { listGarmentIssues, getOrders } from '../../../services/production/sewingService';
import SewingStatusTag from './SewingStatusTag';
import GarmentIssueDrawer from './GarmentIssueDrawer';

/** PRD 4.4 — size-wise issuance to the floor with running balances. */
const GarmentIssueList = () => {
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [issues, ords] = await Promise.all([listGarmentIssues(), getOrders()]);
      setRows(issues); setOrders(ords);
    } catch { message.error('Failed to load garment issues'); } finally { setLoading(false); }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const columns = useMemo(() => [
    { title: 'Issue #', dataIndex: 'issueNo', width: 170, render: (v) => <code>{v}</code> },
    { title: 'Order', dataIndex: 'orderNo', width: 140, render: (v) => v || '—' },
    { title: 'Date', dataIndex: 'issueDate', width: 110, render: (v) => dayjs(v).format('DD-MMM-YYYY') },
    {
      // The server reports which sizes went past the order quantity; those are the
      // ones a Production Manager has to answer for, so they read red here.
      title: 'Sizes Issued', key: 'lines', width: 260,
      render: (_, r) => (r.lines || []).map((l) => (
        <Tag key={l.size} color={r.overIssuedSizes?.includes(l.size) ? 'red' : undefined}>
          {l.size} × {l.currentQty}
        </Tag>
      )),
    },
    { title: 'Total Pcs', dataIndex: 'totalQty', width: 90, align: 'center', render: (v) => <strong>{v}</strong> },
    { title: 'Issued By', dataIndex: 'issuedBy', width: 170, ellipsis: true },
    { title: 'Received By', dataIndex: 'receivedBy', width: 130 },
    { title: 'Status', dataIndex: 'status', width: 140, render: (v) => <SewingStatusTag status={v} /> },
  ], []);

  return (
    <Card>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
        <span style={{ color: 'var(--text-secondary)' }}>Over-issuance beyond order quantity needs Production Manager approval; zero balance notifies the merchandiser.</span>
        <ActionButton action="create" text="New Garment Issue" onClick={() => setDrawerOpen(true)} />
      </Space>
      <Table rowKey="id" size="small" columns={columns} dataSource={rows} loading={loading}
        scroll={{ x: 1150 }} pagination={getTablePagination({ pageSize: 10 }, 'issues')}
        locale={{ emptyText: <EmptyState title="No garment issues" description="Issue finished garments size-wise to the finishing floor" /> }} />
      <GarmentIssueDrawer open={drawerOpen} orders={orders}
        onClose={() => setDrawerOpen(false)} onSaved={() => { setDrawerOpen(false); load(); }} />
    </Card>
  );
};

export default GarmentIssueList;
