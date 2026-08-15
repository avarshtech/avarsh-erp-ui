import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Table, Space } from 'antd';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { ActionButton } from '../../../components/buttons';
import EmptyState from '../../../components/EmptyState';
import RecordLink from '../../../components/RecordLink';
import { getTablePagination } from '../../../utils/paginationConfig';
import { listPlans, getOrders, targetPerHour } from '../../../services/production/sewingService';
import SewingStatusTag from './SewingStatusTag';

/** PRD 4.1 — sewing line allocation with SAM-based targets. */
const SewingPlanList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [plans, ords] = await Promise.all([listPlans(), getOrders()]);
      setRows(plans); setOrders(ords);
    } catch { message.error('Failed to load production plans'); } finally { setLoading(false); }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const orderOf = useCallback((id) => orders.find((o) => o.id === id), [orders]);

  const columns = useMemo(() => [
    { title: 'Plan #', dataIndex: 'planNo', width: 150, render: (v, r) => <RecordLink text={v} onClick={() => navigate(`/production/sewing/plan/${r.id}`)} /> },
    { title: 'Order', dataIndex: 'orderId', width: 140, render: (v) => orderOf(v)?.orderNo || '—' },
    { title: 'Style', dataIndex: 'orderId', key: 'style', width: 130, render: (v) => orderOf(v)?.styleNo || '—' },
    { title: 'Line', dataIndex: 'line', width: 90, align: 'center' },
    { title: 'Start', dataIndex: 'startDate', width: 110, render: (v) => dayjs(v).format('DD-MMM-YYYY') },
    { title: 'SAM (min)', dataIndex: 'sam', width: 90, align: 'right' },
    { title: 'Operators + Helpers', key: 'ops', width: 140, align: 'center', render: (_, r) => `${r.operators} + ${r.helpers}` },
    {
      title: 'Target / Hr · Day', key: 'target', width: 140, align: 'center',
      render: (_, r) => {
        const tph = targetPerHour(r.operators, r.sam, r.targetEfficiencyPct);
        return <strong>{tph} · {tph * r.workingHours}</strong>;
      },
    },
    { title: 'Eff. Target', dataIndex: 'targetEfficiencyPct', width: 100, align: 'center', render: (v) => `${v}%` },
    { title: 'Status', dataIndex: 'status', width: 120, render: (v) => <SewingStatusTag status={v} /> },
    {
      title: 'Actions', key: 'act', width: 90, fixed: 'right', align: 'center',
      render: (_, r) => <ActionButton action="edit" size="small" onClick={() => navigate(`/production/sewing/plan/${r.id}`)} />,
    },
  ], [orderOf, navigate]);

  return (
    <Card>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
        <span style={{ color: 'var(--text-secondary)' }}>Target/Hour = (Operators × 60) ÷ SAM × Target Efficiency % — recalculates live in the plan.</span>
        <ActionButton action="create" text="New Production Plan" onClick={() => navigate('/production/sewing/plan/new')} />
      </Space>
      <Table rowKey="id" size="small" columns={columns} dataSource={rows} loading={loading}
        scroll={{ x: 1200 }} pagination={getTablePagination({ pageSize: 10 }, 'plans')}
        locale={{ emptyText: <EmptyState title="No production plans" description="Plan a sewing line for a confirmed order" /> }} />
    </Card>
  );
};

export default SewingPlanList;
