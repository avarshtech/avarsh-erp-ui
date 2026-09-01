import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Table, Space, Tag } from 'antd';
import dayjs from 'dayjs';
import { ActionButton } from '../../../components/buttons';
import EmptyState from '../../../components/EmptyState';
import { getTablePagination } from '../../../utils/paginationConfig';
import useSewingMasters from '../../../hooks/useSewingMasters';
import { listCutReceipts } from '../../../services/production/sewingService';
import SewingStatusTag from './SewingStatusTag';
import CutPartsReceiptDrawer from './CutPartsReceiptDrawer';

/** PRD 4.2 — bundles handed over from cutting to a sewing line, with discrepancy detection. */
const CutPartsReceiptList = () => {
  const { message } = App.useApp();
  const { threshold } = useSewingMasters();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listCutReceipts());
    } catch { message.error('Failed to load cut parts receipts'); } finally { setLoading(false); }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const columns = useMemo(() => [
    { title: 'Receipt #', dataIndex: 'receiptNo', width: 170, render: (v) => <code>{v}</code> },
    { title: 'Bundle Issue (Cutting)', dataIndex: 'bundleIssueNo', width: 180, render: (v) => <code>{v}</code> },
    { title: 'Order', dataIndex: 'orderNo', width: 140, render: (v) => v || '—' },
    { title: 'Line', dataIndex: 'line', width: 90, align: 'center' },
    { title: 'Date', dataIndex: 'receiptDate', width: 110, render: (v) => dayjs(v).format('DD-MMM-YYYY') },
    {
      title: 'Bundles', dataIndex: 'bundles', width: 240,
      render: (bundles) => (bundles || []).map((b) => (
        <Tag key={b.bundleNo} color={b.quality === 'OK' ? undefined : b.quality === 'SHORTAGE' ? 'orange' : 'red'}>
          {b.bundleNo} {b.size}×{b.receivedQty}
        </Tag>
      )),
    },
    { title: 'Received / Expected', key: 'total', width: 150, align: 'center', render: (_, r) => <strong>{r.receivedQty} / {r.expectedQty}</strong> },
    { title: 'Gap %', dataIndex: 'discrepancyPct', width: 90, align: 'right', render: (v) => (Number(v) > 0 ? <span style={{ color: 'var(--error-color)' }}>{v}%</span> : '—') },
    { title: 'Received By', dataIndex: 'receivedBy', width: 190, ellipsis: true },
    { title: 'Status', dataIndex: 'status', width: 140, render: (v) => <SewingStatusTag status={v} /> },
  ], []);

  return (
    <Card>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
        <span style={{ color: 'var(--text-secondary)' }}>
          Receipts start from a Cutting Bundle Issue note; a &gt;{threshold('RECEIPT_DISCREPANCY_PCT', 2)}% quantity difference auto-flags a discrepancy.
        </span>
        <ActionButton action="create" text="Receive Bundles" onClick={() => setDrawerOpen(true)} />
      </Space>
      <Table rowKey="id" size="small" columns={columns} dataSource={rows} loading={loading}
        scroll={{ x: 1200 }} pagination={getTablePagination({ pageSize: 10 }, 'receipts')}
        locale={{ emptyText: <EmptyState title="No cut parts received" description="Receive bundles issued from the cutting room" /> }} />
      <CutPartsReceiptDrawer open={drawerOpen}
        onClose={() => setDrawerOpen(false)} onSaved={() => { setDrawerOpen(false); load(); }} />
    </Card>
  );
};

export default CutPartsReceiptList;
