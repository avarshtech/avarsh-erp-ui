import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Table, Space } from 'antd';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { ActionButton } from '../../../components/buttons';
import EmptyState from '../../../components/EmptyState';
import RecordLink from '../../../components/RecordLink';
import { getTablePagination } from '../../../utils/paginationConfig';
import { formatNumber } from '../../../utils/formatters';
import { listLayAudits, getCutPos, listMarkerPlans } from '../../../services/production/cuttingService';
import CuttingStatusTag from './CuttingStatusTag';

/** FR-03 — spreading records: rolls used, plies, weight per lay and variance. */
const LayAuditList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [cutPos, setCutPos] = useState([]);
  const [markerNames, setMarkerNames] = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [lays, pos, plans] = await Promise.all([listLayAudits(), getCutPos(), listMarkerPlans()]);
      setRows(lays); setCutPos(pos);
      setMarkerNames(Object.fromEntries(plans.flatMap((p) => p.markers.map((m) => [m.id, m.markerNo]))));
    } catch { message.error('Failed to load lay audits'); } finally { setLoading(false); }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const poNo = useCallback((id) => cutPos.find((p) => p.id === id)?.cutPoNo || '—', [cutPos]);

  const columns = useMemo(() => [
    { title: 'Marker #', dataIndex: 'markerId', width: 110, align: 'center', render: (v, r) => <RecordLink text={markerNames[v] || `Lay ${r.layNo}`} onClick={() => navigate(`/production/cutting/lay-audit/${r.id}`)} /> },
    { title: 'Cut PO', dataIndex: 'cutPoId', width: 150, render: poNo },
    { title: 'Date', dataIndex: 'date', width: 110, render: (v) => dayjs(v).format('DD-MMM-YYYY') },
    { title: 'Length (m)', dataIndex: 'layLength', width: 100, align: 'right' },
    { title: 'Rolls', key: 'rolls', width: 70, align: 'center', render: (_, r) => r.rolls.length },
    {
      title: 'Total Lays', key: 'lays', width: 90, align: 'center',
      render: (_, r) => r.rolls.reduce((s, x) => s + (x.numLays || 0), 0),
    },
    {
      title: 'Weight Used (kg)', key: 'used', width: 130, align: 'right',
      render: (_, r) => formatNumber(r.rolls.reduce((s, x) => s + (x.total || 0), 0), 3),
    },
    {
      title: 'Short / Excess (kg)', key: 'var', width: 140, align: 'right',
      render: (_, r) => {
        const v = r.rolls.reduce((s, x) => s + (x.variance || 0), 0);
        return <span style={{ color: v > 0 ? 'var(--error-color)' : 'var(--success-color)', fontWeight: 600 }}>{formatNumber(v, 3)}</span>;
      },
    },
    { title: 'Status', dataIndex: 'status', width: 110, render: (v) => <CuttingStatusTag status={v} /> },
    {
      title: 'Actions', key: 'act', width: 90, fixed: 'right', align: 'center',
      render: (_, r) => <ActionButton action="edit" size="small" onClick={() => navigate(`/production/cutting/lay-audit/${r.id}`)} />,
    },
  ], [poNo, markerNames, navigate]);

  return (
    <Card>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
        <span style={{ color: 'var(--text-secondary)' }}>Positive variance = fabric shortage (red), negative = excess left on roll (green).</span>
        <ActionButton action="create" text="New Lay Audit" onClick={() => navigate('/production/cutting/lay-audit/new')} />
      </Space>
      <Table rowKey="id" size="small" columns={columns} dataSource={rows} loading={loading}
        scroll={{ x: 1050 }} pagination={getTablePagination({ pageSize: 10 }, 'lays')}
        locale={{ emptyText: <EmptyState title="No lay audits" description="Record the first spread once fabric is relaxed" /> }} />
    </Card>
  );
};

export default LayAuditList;
