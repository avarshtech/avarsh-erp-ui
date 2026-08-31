import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Table, Space, Tooltip } from 'antd';
import dayjs from 'dayjs';
import { ActionButton } from '../../../components/buttons';
import EmptyState from '../../../components/EmptyState';
import { getTablePagination } from '../../../utils/paginationConfig';
import { listRelaxations, listReceipts, generateRelaxationReport } from '../../../services/production/cuttingService';
import CuttingStatusTag from './CuttingStatusTag';
import FabricRelaxationDrawer from './FabricRelaxationDrawer';

const fmtDuration = (mins) => `${Math.floor(mins / 60)}h ${String(Math.round(mins % 60)).padStart(2, '0')}m`;

/** FR-02 — mandatory rest period per fabric type before laying (Knit 24h / Woven 12h / Denim 48h). */
const FabricRelaxationList = () => {
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState({ open: false, record: null });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [relax, rec] = await Promise.all([listRelaxations(), listReceipts()]);
      // Duration computed once at load (live "so far" for in-progress rows).
      const at = dayjs();
      setRows(relax.map((r) => ({
        ...r,
        durationMins: r.startTime ? (r.endTime ? dayjs(r.endTime) : at).diff(dayjs(r.startTime), 'minute') : 0,
      })));
      setReceipts(rec);
    } catch { message.error('Failed to load relaxations'); } finally { setLoading(false); }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const receiptNo = useCallback((id) => receipts.find((r) => r.id === id)?.receiptNo || '—', [receipts]);

  const handleReport = useCallback(async (record) => {
    await generateRelaxationReport(record.id);
    message.success(`Relaxation report generated for ${record.relaxNo}`);
    load();
  }, [message, load]);

  const columns = useMemo(() => [
    { title: 'Relaxation #', dataIndex: 'relaxationNo', width: 170, render: (v) => <code>{v}</code> },
    { title: 'Fabric Receipt', dataIndex: 'receiptId', width: 170, render: receiptNo },
    { title: 'Fabric Type', dataIndex: 'fabricType', width: 130 },
    { title: 'Start', dataIndex: 'startTime', width: 140, render: (v) => (v ? dayjs(v).format('DD-MMM HH:mm') : '—') },
    { title: 'End', dataIndex: 'endTime', width: 140, render: (v) => (v ? dayjs(v).format('DD-MMM HH:mm') : '—') },
    {
      title: 'Duration', dataIndex: 'durationMins', width: 120, align: 'center',
      render: (v, r) => <strong>{fmtDuration(v)}{r.endTime ? '' : ' …'}</strong>,
    },
    { title: 'Shrink % (post)', dataIndex: 'shrinkagePostPct', width: 120, align: 'center', render: (v) => (v ?? '—') },
    { title: 'Status', dataIndex: 'status', width: 150, render: (v) => <CuttingStatusTag status={v} /> },
    {
      title: 'Actions', key: 'actions', width: 130, fixed: 'right', align: 'center',
      render: (_, r) => (
        <Space size={4}>
          {r.status === 'IN_PROGRESS' && (
            <ActionButton action="edit" size="small" onClick={() => setDrawer({ open: true, record: r })} />
          )}
          {r.status === 'COMPLETED' && (
            <Tooltip title="Generate Relaxation Report (required before Lay Audit)">
              <ActionButton action="print" size="small" onClick={() => handleReport(r)} />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ], [receiptNo, handleReport]);

  return (
    <Card>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
        <span style={{ color: 'var(--text-secondary)' }}>Rolls cannot be selected for laying until relaxation is completed and its report generated.</span>
        <ActionButton action="create" text="Start Relaxation" onClick={() => setDrawer({ open: true, record: null })} />
      </Space>
      <Table
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={rows}
        loading={loading}
        scroll={{ x: 1150 }}
        pagination={getTablePagination({ pageSize: 10 }, 'relaxations')}
        locale={{ emptyText: <EmptyState title="No relaxation records" description="Start relaxation once fabric is received" /> }}
      />
      <FabricRelaxationDrawer
        open={drawer.open}
        record={drawer.record}
        receipts={receipts}
        onClose={() => setDrawer({ open: false, record: null })}
        onSaved={() => { setDrawer({ open: false, record: null }); load(); }}
      />
    </Card>
  );
};

export default FabricRelaxationList;
