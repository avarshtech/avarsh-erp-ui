import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Table, Space } from 'antd';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { ActionButton } from '../../../components/buttons';
import EmptyState from '../../../components/EmptyState';
import RecordLink from '../../../components/RecordLink';
import { getTablePagination } from '../../../utils/paginationConfig';
import useCuttingMasters from '../../../hooks/useCuttingMasters';
import { listTmbChecks } from '../../../services/production/cuttingService';
import CuttingStatusTag from './CuttingStatusTag';

/** FR-04 — Top-Middle-Bottom quality checks per lay. */
const TmbCheckList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const { threshold } = useCuttingMasters();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listTmbChecks());
    } catch { message.error('Failed to load TMB checks'); } finally { setLoading(false); }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const columns = useMemo(() => [
    {
      title: 'Lay #', dataIndex: 'layRef', width: 100, align: 'center',
      render: (v, r) => <RecordLink text={v} onClick={() => navigate(`/production/cutting/tmb/${r.id}`)} />,
    },
    { title: 'Cut PO', dataIndex: 'cuttingPoNo', width: 150 },
    { title: 'Date', dataIndex: 'checkDate', width: 110, render: (v) => dayjs(v).format('DD-MMM-YYYY') },
    { title: 'Parts Checked', key: 'parts', width: 110, align: 'center', render: (_, r) => r.rows.length },
    {
      title: 'Out of Tolerance', dataIndex: 'failedRowCount', width: 150, align: 'center',
      render: (v, r) => (v > 0
        ? <span style={{ color: 'var(--error-color)', fontWeight: 600 }}>{v} row(s) &gt; {r.toleranceCm} cm</span>
        : 'None'),
    },
    { title: 'QC Sign', dataIndex: 'qcSign', width: 130, render: (v) => v || '—' },
    { title: 'Status', dataIndex: 'status', width: 110, render: (v) => <CuttingStatusTag status={v} /> },
    {
      title: 'Actions', key: 'act', width: 90, fixed: 'right', align: 'center',
      render: (_, r) => <ActionButton action="edit" size="small" onClick={() => navigate(`/production/cutting/tmb/${r.id}`)} />,
    },
  ], [navigate]);

  return (
    <Card>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
        <span style={{ color: 'var(--text-secondary)' }}>
          Top / Middle / Bottom panel measurements must agree within ±{threshold('TMB_TOLERANCE_CM', 0.5)} cm. Bundling stays blocked until the lay's TMB check passes.
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
