import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Table, Space } from 'antd';
import dayjs from 'dayjs';
import { ActionButton } from '../../../components/buttons';
import EmptyState from '../../../components/EmptyState';
import { getTablePagination } from '../../../utils/paginationConfig';
import { formatNumber } from '../../../utils/formatters';
import { listReceipts, getCutPos } from '../../../services/production/cuttingService';
import CuttingStatusTag from './CuttingStatusTag';
import FabricReceiptDrawer from './FabricReceiptDrawer';

/** FR-01 — confirm which issued rolls physically arrived at the cutting floor. */
const FabricReceiptList = () => {
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [cutPos, setCutPos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [receipts, pos] = await Promise.all([listReceipts(), getCutPos()]);
      setRows(receipts); setCutPos(pos);
    } catch { message.error('Failed to load fabric receipts'); } finally { setLoading(false); }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const poNo = useCallback((id) => cutPos.find((p) => p.id === id)?.cutPoNo || '—', [cutPos]);

  const columns = useMemo(() => [
    { title: 'Receipt #', dataIndex: 'receiptNo', width: 170, render: (v) => <code>{v}</code> },
    { title: 'Date', dataIndex: 'date', width: 110, render: (v) => dayjs(v).format('DD-MMM-YYYY') },
    { title: 'Cut PO', dataIndex: 'cutPoId', width: 150, render: poNo },
    { title: 'Fabric Issue #', dataIndex: 'fabricIssueNo', width: 150, render: (v) => <code>{v}</code> },
    {
      title: 'Rolls (received / issued)', key: 'rolls', width: 170, align: 'center',
      render: (_, r) => `${r.rolls.filter((x) => x.received).length} / ${r.rolls.length}`,
    },
    {
      title: 'Received Weight', key: 'wt', width: 140, align: 'right',
      render: (_, r) => `${formatNumber(r.rolls.filter((x) => x.received).reduce((s, x) => s + x.weight, 0), 3)} kg`,
    },
    { title: 'Status', dataIndex: 'status', width: 160, render: (v) => <CuttingStatusTag status={v} /> },
  ], [poNo]);

  return (
    <Card>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
        <span style={{ color: 'var(--text-secondary)' }}>Rolls issued from stores must be confirmed here before relaxation can start.</span>
        <ActionButton action="create" text="New Fabric Receipt" onClick={() => setDrawerOpen(true)} />
      </Space>
      <Table
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={rows}
        loading={loading}
        scroll={{ x: 1000 }}
        pagination={getTablePagination({ pageSize: 10 }, 'receipts')}
        locale={{ emptyText: <EmptyState title="No fabric receipts" description="Confirm rolls received from stores to begin" /> }}
      />
      <FabricReceiptDrawer
        open={drawerOpen}
        cutPos={cutPos}
        onClose={() => setDrawerOpen(false)}
        onSaved={() => { setDrawerOpen(false); load(); }}
      />
    </Card>
  );
};

export default FabricReceiptList;
