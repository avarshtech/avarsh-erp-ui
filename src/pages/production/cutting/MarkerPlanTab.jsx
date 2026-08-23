import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Table, Space, Tag } from 'antd';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { ActionButton } from '../../../components/buttons';
import EmptyState from '../../../components/EmptyState';
import RecordLink from '../../../components/RecordLink';
import { getTablePagination } from '../../../utils/paginationConfig';
import { listMarkerPlans, getCutPos } from '../../../services/production/cuttingService';
import CuttingStatusTag from './CuttingStatusTag';

/**
 * CR-CUT-2026-001 — Marker Plan is THE planning screen: the marker defines
 * size ratios and cut quantities (Height × Ratio). Cut Order Plan merged in.
 */
const MarkerPlanTab = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [cutPos, setCutPos] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, pos] = await Promise.all([listMarkerPlans(), getCutPos()]);
      setPlans(p); setCutPos(pos);
    } catch { message.error('Failed to load marker plans'); } finally { setLoading(false); }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const columns = useMemo(() => [
    { title: 'Plan #', dataIndex: 'planNo', width: 140, render: (v, r) => <RecordLink text={v} onClick={() => navigate(`/production/cutting/marker-plan/${r.id}`)} /> },
    { title: 'Factory', dataIndex: 'factory', width: 140 },
    { title: 'Cut PO', dataIndex: 'cutPoId', width: 150, render: (v) => cutPos.find((p) => p.id === v)?.cutPoNo || '—' },
    { title: 'Style #', dataIndex: 'cutPoId', key: 'style', width: 130, render: (v) => cutPos.find((p) => p.id === v)?.styleNo || '—' },
    { title: 'Buyer', dataIndex: 'cutPoId', key: 'buyer', width: 200, ellipsis: true, render: (v) => cutPos.find((p) => p.id === v)?.buyer || '—' },
    {
      title: 'Plan Period', key: 'period', width: 190,
      render: (_, r) => `${dayjs(r.planStartDate).format('DD-MMM')} → ${dayjs(r.planEndDate).format('DD-MMM-YYYY')}`,
    },
    {
      title: 'Markers', key: 'markers', width: 160,
      render: (_, r) => r.markers.map((m) => <Tag key={m.markerNo}><code>{m.markerNo}</code></Tag>),
    },
    {
      title: 'Planned / Order', key: 'qty', width: 130, align: 'right',
      render: (_, r) => {
        const po = cutPos.find((p) => p.id === r.cutPoId);
        const planned = r.markers.reduce((s, m) => s + Object.values(m.ratio || {}).reduce((a, b) => a + (m.markerHeight || 0) * b, 0), 0);
        return <span>{planned} / {po?.orderQty ?? '—'}</span>;
      },
    },
    {
      title: 'Size-Set Cut', key: 'ss', width: 120, align: 'center',
      render: (_, r) => (cutPos.find((p) => p.id === r.cutPoId)?.sizeSetStatus === 'APPROVED'
        ? <Tag color="green">Approved</Tag> : <Tag color="orange">Pending</Tag>),
    },
    { title: 'Status', dataIndex: 'status', width: 120, render: (v) => <CuttingStatusTag status={v} /> },
    {
      title: 'Actions', key: 'act', width: 90, fixed: 'right', align: 'center',
      render: (_, r) => <ActionButton action="edit" size="small" onClick={() => navigate(`/production/cutting/marker-plan/${r.id}`)} />,
    },
  ], [cutPos, navigate]);

  return (
    <Card>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }} wrap>
        <span style={{ color: 'var(--text-secondary)' }}>
          One plan per Cut PO — markers define size ratios; cut qty = Marker Height × Ratio. Only relaxation-complete Cut POs can be planned.
        </span>
        <ActionButton action="create" text="New Marker Plan" onClick={() => navigate('/production/cutting/marker-plan/new')} />
      </Space>
      <Table rowKey="id" size="small" columns={columns} dataSource={plans} loading={loading}
        scroll={{ x: 1450 }} pagination={getTablePagination({ pageSize: 10 }, 'plans')}
        locale={{ emptyText: <EmptyState title="No marker plans" description="Plan markers for a relaxation-complete Cut PO" /> }} />
    </Card>
  );
};

export default MarkerPlanTab;
