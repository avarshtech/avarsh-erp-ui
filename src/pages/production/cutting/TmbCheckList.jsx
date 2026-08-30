import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Table, Space } from 'antd';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { ActionButton } from '../../../components/buttons';
import EmptyState from '../../../components/EmptyState';
import RecordLink from '../../../components/RecordLink';
import { getTablePagination } from '../../../utils/paginationConfig';
import { TMB_TOLERANCE_CM } from '../../../utils/cuttingConstants';
import { listTmbChecks, getCutPos } from '../../../services/production/cuttingService';
import CuttingStatusTag from './CuttingStatusTag';
import { tmbRowInTolerance } from './tmbUtils';

/** FR-04 — Top-Middle-Bottom quality checks per lay. */
const TmbCheckList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [cutPos, setCutPos] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [checks, pos] = await Promise.all([listTmbChecks(), getCutPos()]);
      setRows(checks); setCutPos(pos);
    } catch { message.error('Failed to load TMB checks'); } finally { setLoading(false); }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const poNo = useCallback((id) => cutPos.find((p) => p.id === id)?.cutPoNo || '—', [cutPos]);

  const columns = useMemo(() => [
    { title: 'Lay #', dataIndex: 'layNo', width: 90, align: 'center', render: (v, r) => <RecordLink text={`Lay ${v}`} onClick={() => navigate(`/production/cutting/tmb/${r.id}`)} /> },
    { title: 'Cut PO', dataIndex: 'cutPoId', width: 150, render: poNo },
    { title: 'Date', dataIndex: 'date', width: 110, render: (v) => dayjs(v).format('DD-MMM-YYYY') },
    { title: 'Parts Checked', key: 'parts', width: 110, align: 'center', render: (_, r) => r.rows.length },
    {
      title: 'Out of Tolerance', key: 'oot', width: 130, align: 'center',
      render: (_, r) => {
        const bad = r.rows.filter((row) => !tmbRowInTolerance(row)).length;
        return bad > 0 ? <span style={{ color: 'var(--error-color)', fontWeight: 600 }}>{bad} row(s)</span> : 'None';
      },
    },
    { title: 'QC Sign', dataIndex: 'qcSign', width: 130, render: (v) => v || '—' },
    { title: 'Status', dataIndex: 'status', width: 110, render: (v) => <CuttingStatusTag status={v} /> },
    {
      title: 'Actions', key: 'act', width: 90, fixed: 'right', align: 'center',
      render: (_, r) => <ActionButton action="edit" size="small" onClick={() => navigate(`/production/cutting/tmb/${r.id}`)} />,
    },
  ], [poNo, navigate]);

  return (
    <Card>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
        <span style={{ color: 'var(--text-secondary)' }}>
          Top / Middle / Bottom panel measurements must agree within ±{TMB_TOLERANCE_CM} cm. Bundling stays blocked until the lay's TMB check passes.
        </span>
        <ActionButton action="create" text="New TMB Check" onClick={() => navigate('/production/cutting/tmb/new')} />
      </Space>
      <Table rowKey="id" size="small" columns={columns} dataSource={rows} loading={loading}
        scroll={{ x: 950 }} pagination={getTablePagination({ pageSize: 10 }, 'checks')}
        locale={{ emptyText: <EmptyState title="No TMB checks" description="Record a check after cutting a lay" /> }} />
    </Card>
  );
};

export default TmbCheckList;
