import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Table, Space, Tag } from 'antd';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { ActionButton } from '../../../components/buttons';
import EmptyState from '../../../components/EmptyState';
import RecordLink from '../../../components/RecordLink';
import { getTablePagination } from '../../../utils/paginationConfig';
import { listMarkerPlans } from '../../../services/production/cuttingService';
import CuttingStatusTag from './CuttingStatusTag';

/**
 * CR-CUT-2026-001 — Marker Plan is THE planning screen: the marker defines
 * size ratios and cut quantities (Height × Ratio). Cut Order Plan merged in.
 */
const MarkerPlanTab = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPlans(await listMarkerPlans());
    } catch { message.error('Failed to load marker plans'); } finally { setLoading(false); }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const columns = useMemo(() => [
    { title: 'Plan #', dataIndex: 'planNo', width: 150, render: (v, r) => <RecordLink text={v} onClick={() => navigate(`/production/cutting/marker-plan/${r.id}`)} /> },
    { title: 'Unit', dataIndex: 'unitName', width: 150, ellipsis: true, render: (v) => v || '—' },
    { title: 'Cut PO', dataIndex: 'cuttingPoNo', width: 150 },
    { title: 'Style #', dataIndex: 'styleNo', width: 130, render: (v) => v || '—' },
    { title: 'Buyer', dataIndex: 'buyer', width: 200, ellipsis: true, render: (v) => v || '—' },
    {
      title: 'Plan Period', key: 'period', width: 190,
      render: (_, r) => (r.planStartDate
        ? `${dayjs(r.planStartDate).format('DD-MMM')} → ${dayjs(r.planEndDate).format('DD-MMM-YYYY')}`
        : '—'),
    },
    {
      title: 'Markers', key: 'markers', width: 170,
      render: (_, r) => (r.markers || []).map((m) => <Tag key={m.markerNo}><code>{m.markerNo}</code></Tag>),
    },
    {
      title: 'Planned / Order', key: 'qty', width: 140, align: 'right',
      render: (_, r) => `${r.totalPlannedQty ?? 0} / ${r.totalOrderQty ?? '—'}`,
    },
    {
      title: 'Size Jumps', key: 'jumps', width: 110, align: 'center',
      render: (_, r) => (r.sizeJumps?.length
        ? <Tag color="warning">{r.sizeJumps.length} over</Tag>
        : <Tag color="green">None</Tag>),
    },
    {
      title: 'Size-Set Cut', dataIndex: 'sizeSetStatus', width: 120, align: 'center',
      render: (v) => (v === 'APPROVED' ? <Tag color="green">Approved</Tag> : <Tag color="orange">Pending</Tag>),
    },
    { title: 'Status', dataIndex: 'status', width: 120, render: (v) => <CuttingStatusTag status={v} /> },
    {
      title: 'Actions', key: 'act', width: 90, fixed: 'right', align: 'center',
      render: (_, r) => <ActionButton action="edit" size="small" onClick={() => navigate(`/production/cutting/marker-plan/${r.id}`)} />,
    },
  ], [navigate]);

  return (
    <Card>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }} wrap>
        <span style={{ color: 'var(--text-secondary)' }}>
          One plan per Cut PO — markers define size ratios; cut qty = Marker Height × Ratio. Only relaxation-complete Cut POs can be planned.
        </span>
        <ActionButton action="create" text="New Marker Plan" onClick={() => navigate('/production/cutting/marker-plan/new')} />
      </Space>
      <Table rowKey="id" size="small" columns={columns} dataSource={plans} loading={loading}
        scroll={{ x: 1600 }} pagination={getTablePagination({ pageSize: 10 }, 'plans')}
        locale={{ emptyText: <EmptyState title="No marker plans" description="Plan markers for a relaxation-complete Cut PO" /> }} />
    </Card>
  );
};

export default MarkerPlanTab;
