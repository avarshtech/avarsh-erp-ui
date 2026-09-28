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
  const [drawer, setDrawer] = useState({ open: false, record: null, readOnly: false });

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
  const receiptFabric = useCallback((id) => {
    const rec = receipts.find((r) => r.id === id);
    return rec?.fabricName || rec?.fabricType || '—';
  }, [receipts]);

  const handleReport = useCallback(async (record) => {
    try {
      await generateRelaxationReport(record.id);
      message.success(`Relaxation report generated for ${record.relaxationNo}`);
      load();
    } catch (e) {
      message.error(e?.response?.data?.message || 'Failed to generate the relaxation report');
    }
  }, [message, load]);

  const columns = useMemo(() => [
    { title: 'Relaxation #', dataIndex: 'relaxationNo', width: 170, render: (v) => <code>{v}</code> },
    { title: 'Fabric Receipt', dataIndex: 'receiptId', width: 170, render: receiptNo },
    { title: 'Fabric', key: 'fabric', width: 180, ellipsis: true, render: (_, r) => receiptFabric(r.receiptId) },
    { title: 'Fabric Type', dataIndex: 'fabricType', width: 130, render: (v) => v || '—' },
    { title: 'Start', dataIndex: 'startTime', width: 140, render: (v) => (v ? dayjs(v).format('DD-MMM HH:mm') : '—') },
    { title: 'End', dataIndex: 'endTime', width: 140, render: (v) => (v ? dayjs(v).format('DD-MMM HH:mm') : '—') },
    {
      title: 'Duration', dataIndex: 'durationMins', width: 120, align: 'center',
      render: (v, r) => <strong>{fmtDuration(v)}{r.endTime ? '' : ' …'}</strong>,
    },
    { title: 'Shrink % (post)', dataIndex: 'shrinkagePostPct', width: 120, align: 'center', render: (v) => (v ?? '—') },
    { title: 'Status', dataIndex: 'status', width: 150, render: (v) => <CuttingStatusTag status={v} /> },
    {
      title: 'Actions', key: 'actions', width: 160, fixed: 'right', align: 'center',
      render: (_, r) => (
        <Space size={4}>
          <ActionButton action="view" size="small"
            onClick={() => setDrawer({ open: true, record: r, readOnly: true })} />
          {/* editable until its report is generated: that is what the lay audit is signed against */}
          {['IN_PROGRESS', 'COMPLETED'].includes(r.status) && (
            <ActionButton action="edit" size="small"
              onClick={() => setDrawer({ open: true, record: r, readOnly: false })} />
          )}
          {r.status === 'COMPLETED' && (
            <Tooltip title="Generate Relaxation Report (required before Lay Audit)">
              <ActionButton action="print" size="small" onClick={() => handleReport(r)} />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ], [receiptNo, receiptFabric, handleReport]);

  return (
    <Card>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
        <span style={{ color: 'var(--text-secondary)' }}>Rolls cannot be selected for laying until relaxation is completed and its report generated.</span>
        <ActionButton action="create" text="Start Relaxation"
          onClick={() => setDrawer({ open: true, record: null, readOnly: false })} />
      </Space>
      <Table
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={rows}
        loading={loading}
        scroll={{ x: 1360 }}
        pagination={getTablePagination({ pageSize: 10 }, 'relaxations')}
        locale={{ emptyText: <EmptyState title="No relaxation records" description="Start relaxation once fabric is received" /> }}
      />
      <FabricRelaxationDrawer
        open={drawer.open}
        record={drawer.record}
        readOnly={drawer.readOnly}
        receipts={receipts}
        onClose={() => setDrawer({ open: false, record: null, readOnly: false })}
        onSaved={() => { setDrawer({ open: false, record: null, readOnly: false }); load(); }}
      />
    </Card>
  );
};

export default FabricRelaxationList;
