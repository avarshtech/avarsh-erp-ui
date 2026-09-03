import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Table, Space, Tag } from 'antd';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { ActionButton } from '../../../components/buttons';
import EmptyState from '../../../components/EmptyState';
import RecordLink from '../../../components/RecordLink';
import { getTablePagination } from '../../../utils/paginationConfig';
import useSewingMasters from '../../../hooks/useSewingMasters';
import { TOPSE_TRAFFIC_META } from '../../../utils/sewingConstants';
import { listTopse } from '../../../services/production/sewingService';

/** PRD 4.7 — end-of-line quality checking (TOPSE) with DHU per report. */
const TopseList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { threshold } = useSewingMasters();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listTopse());
    } catch { message.error('Failed to load TOPSE reports'); } finally { setLoading(false); }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const columns = useMemo(() => [
    {
      title: 'Report #', dataIndex: 'reportNo', width: 190,
      render: (v, r) => <RecordLink text={v} onClick={() => navigate(`/production/sewing/topse/${r.id}`)} />,
    },
    { title: 'Order', dataIndex: 'orderNo', width: 140, render: (v) => v || '—' },
    { title: 'Style', dataIndex: 'styleNo', width: 130, ellipsis: true, render: (v) => v || '—' },
    { title: 'Line', dataIndex: 'line', width: 100, align: 'center' },
    { title: 'Date', dataIndex: 'reportDate', width: 110, render: (v) => dayjs(v).format('DD-MMM-YYYY') },
    { title: 'Inspected', dataIndex: 'totalInspected', width: 95, align: 'right' },
    { title: 'Defects', dataIndex: 'totalDefects', width: 85, align: 'right' },
    { title: 'Rework', dataIndex: 'totalRework', width: 85, align: 'right' },
    { title: 'DHU %', dataIndex: 'dhuPct', width: 90, align: 'center', render: (v) => <strong>{v}%</strong> },
    {
      title: 'Traffic Light', dataIndex: 'trafficLight', width: 115, align: 'center',
      render: (v) => {
        const meta = TOPSE_TRAFFIC_META[v] || TOPSE_TRAFFIC_META.RED;
        return <Tag color={meta.color} style={{ fontWeight: 700 }}>{meta.label}</Tag>;
      },
    },
    { title: 'Pass Rate', dataIndex: 'passRatePct', width: 95, align: 'center', render: (v) => `${v}%` },
    {
      title: 'Top Defect', key: 'top', width: 190, ellipsis: true,
      render: (_, r) => (r.pareto?.length
        ? <span>{r.pareto[0].defectType} <Tag>{r.pareto[0].count}</Tag></span>
        : '—'),
    },
    {
      title: 'Actions', key: 'act', width: 90, fixed: 'right', align: 'center',
      render: (_, r) => <ActionButton action="edit" size="small" onClick={() => navigate(`/production/sewing/topse/${r.id}`)} />,
    },
  ], [navigate]);

  return (
    <Card>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
        <span style={{ color: 'var(--text-secondary)' }}>
          DHU counts faults per hundred pieces inspected — GREEN ≤ {threshold('TOPSE_GREEN_MAX_DHU', 3)}%,
          RED above {threshold('TOPSE_YELLOW_MAX_DHU', 5)}%.
        </span>
        <ActionButton action="create" text="New End-Line Check" onClick={() => navigate('/production/sewing/topse/new')} />
      </Space>
      <Table rowKey="id" size="small" columns={columns} dataSource={rows} loading={loading}
        scroll={{ x: 1500 }} pagination={getTablePagination({ pageSize: 10 }, 'reports')}
        locale={{ emptyText: <EmptyState title="No end-line reports" description="Record hour-wise defects at the end of the line" /> }} />
    </Card>
  );
};

export default TopseList;
