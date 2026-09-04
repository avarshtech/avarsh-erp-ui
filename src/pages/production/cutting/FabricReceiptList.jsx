import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Table, Space, Tooltip } from 'antd';
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
  const [drawer, setDrawer] = useState({ open: false, mode: 'create', record: null });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [receipts, pos] = await Promise.all([listReceipts(), getCutPos()]);
      setRows(receipts); setCutPos(pos);
    } catch { message.error('Failed to load fabric receipts'); } finally { setLoading(false); }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const columns = useMemo(() => [
    { title: 'Receipt #', dataIndex: 'receiptNo', width: 170, render: (v) => <code>{v}</code> },
    { title: 'Date', dataIndex: 'receiptDate', width: 110, render: (v) => dayjs(v).format('DD-MMM-YYYY') },
    { title: 'Cut PO', dataIndex: 'cuttingPoNo', width: 150, render: (v) => <code>{v}</code> },
    { title: 'Fabric Issue #', dataIndex: 'materialIssueNo', width: 150, render: (v) => (v ? <code>{v}</code> : '—') },
    {
      title: 'Rolls (received / issued)', key: 'rolls', width: 170, align: 'center',
      render: (_, r) => `${r.receivedRollCount} / ${r.rolls.length}`,
    },
    {
      title: 'Received Weight', key: 'wt', width: 140, align: 'right',
      render: (_, r) => `${formatNumber(r.receivedQty, 3)} ${r.rolls[0]?.uom || ''}`,
    },
    { title: 'Status', dataIndex: 'status', width: 160, render: (v) => <CuttingStatusTag status={v} /> },
    {
      title: 'Actions', key: 'actions', width: 110, fixed: 'right', align: 'center',
      render: (_, r) => (
        <Space size={4}>
          <ActionButton action="view" size="small" onClick={() => setDrawer({ open: true, mode: 'view', record: r })} />
          <Tooltip title="Correct which rolls arrived">
            <ActionButton action="edit" size="small" onClick={() => setDrawer({ open: true, mode: 'edit', record: r })} />
          </Tooltip>
        </Space>
      ),
    },
  ], []);

  return (
    <Card>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
        <span style={{ color: 'var(--text-secondary)' }}>Rolls issued from stores must be confirmed here before relaxation can start.</span>
        <ActionButton action="create" text="New Fabric Receipt" onClick={() => setDrawer({ open: true, mode: 'create', record: null })} />
      </Space>
      <Table
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={rows}
        loading={loading}
        scroll={{ x: 1110 }}
        pagination={getTablePagination({ pageSize: 10 }, 'receipts')}
        locale={{ emptyText: <EmptyState title="No fabric receipts" description="Confirm rolls received from stores to begin" /> }}
      />
      <FabricReceiptDrawer
        open={drawer.open}
        mode={drawer.mode}
        record={drawer.record}
        cutPos={cutPos}
        onClose={() => setDrawer({ open: false, mode: 'create', record: null })}
        onSaved={() => { setDrawer({ open: false, mode: 'create', record: null }); load(); }}
      />
    </Card>
  );
};

export default FabricReceiptList;
