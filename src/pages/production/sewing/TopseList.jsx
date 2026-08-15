import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Table, Space } from 'antd';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { ActionButton } from '../../../components/buttons';
import EmptyState from '../../../components/EmptyState';
import RecordLink from '../../../components/RecordLink';
import { getTablePagination } from '../../../utils/paginationConfig';
import { DHU_THRESHOLD_PCT } from '../../../utils/sewingConstants';
import { listTopse, getOrders } from '../../../services/production/sewingService';

const dhuOf = (r) => {
  const defects = r.defects.reduce((s, d) => s + d.count, 0);
  return r.totalInspected ? Math.round((defects / r.totalInspected) * 1000) / 10 : 0;
};

/** PRD 4.7 — end-of-line quality checking (TOPSE) with DHU per report. */
const TopseList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [reports, ords] = await Promise.all([listTopse(), getOrders()]);
      setRows(reports); setOrders(ords);
    } catch { message.error('Failed to load TOPSE reports'); } finally { setLoading(false); }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const columns = useMemo(() => [
    { title: 'Report #', dataIndex: 'reportNo', width: 190, render: (v, r) => <RecordLink text={v} onClick={() => navigate(`/production/sewing/topse/${r.id}`)} /> },
    { title: 'Order', dataIndex: 'orderId', width: 140, render: (v) => orders.find((o) => o.id === v)?.orderNo || '—' },
    { title: 'Line', dataIndex: 'line', width: 90, align: 'center' },
    { title: 'Date', dataIndex: 'date', width: 110, render: (v) => dayjs(v).format('DD-MMM-YYYY') },
    { title: 'Inspected', dataIndex: 'totalInspected', width: 90, align: 'right' },
    { title: 'Defects', key: 'def', width: 80, align: 'right', render: (_, r) => r.defects.reduce((s, d) => s + d.count, 0) },
    { title: 'Rework', dataIndex: 'totalRework', width: 80, align: 'right' },
    {
      title: 'DHU %', key: 'dhu', width: 90, align: 'center',
      render: (_, r) => {
        const dhu = dhuOf(r);
        return <strong style={{ color: dhu > DHU_THRESHOLD_PCT ? 'var(--error-color)' : 'var(--success-color)' }}>{dhu}%</strong>;
      },
    },
    {
      title: 'Pass Rate', key: 'pass', width: 90, align: 'center',
      render: (_, r) => `${r.totalInspected ? Math.round(((r.totalInspected - r.totalRework) / r.totalInspected) * 1000) / 10 : 0}%`,
    },
    {
      title: 'Actions', key: 'act', width: 90, fixed: 'right', align: 'center',
      render: (_, r) => <ActionButton action="edit" size="small" onClick={() => navigate(`/production/sewing/topse/${r.id}`)} />,
    },
  ], [orders, navigate]);

  return (
    <Card>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
        <span style={{ color: 'var(--text-secondary)' }}>DHU = defects ÷ inspected × 100. Above {DHU_THRESHOLD_PCT}% alerts the QA Manager automatically.</span>
        <ActionButton action="create" text="New End-Line Report" onClick={() => navigate('/production/sewing/topse/new')} />
      </Space>
      <Table rowKey="id" size="small" columns={columns} dataSource={rows} loading={loading}
        scroll={{ x: 1050 }} pagination={getTablePagination({ pageSize: 10 }, 'reports')}
        locale={{ emptyText: <EmptyState title="No end-line reports" description="Record hourly defect checks at the end of each line" /> }} />
    </Card>
  );
};

export default TopseList;
