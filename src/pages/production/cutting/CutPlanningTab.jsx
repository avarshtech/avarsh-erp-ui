import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Segmented, Table, Space, Progress, Tag } from 'antd';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { ActionButton } from '../../../components/buttons';
import EmptyState from '../../../components/EmptyState';
import RecordLink from '../../../components/RecordLink';
import { getTablePagination } from '../../../utils/paginationConfig';
import { THRESHOLDS } from '../../../utils/cuttingConstants';
import { listCops, listMarkers, getCutPos } from '../../../services/production/cuttingService';
import CuttingStatusTag from './CuttingStatusTag';
import MarkerPlanDrawer from './MarkerPlanDrawer';

/** ENH-01 + ENH-02 — Cut Order Plans (master planning) and Marker Plans. */
const CutPlanningTab = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [view, setView] = useState('Cut Order Plans');
  const [cops, setCops] = useState([]);
  const [markers, setMarkers] = useState([]);
  const [cutPos, setCutPos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [markerDrawer, setMarkerDrawer] = useState({ open: false, record: null });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, m, p] = await Promise.all([listCops(), listMarkers(), getCutPos()]);
      setCops(c); setMarkers(m); setCutPos(p);
    } catch { message.error('Failed to load cut plans'); } finally { setLoading(false); }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const poNo = useCallback((id) => cutPos.find((p) => p.id === id)?.cutPoNo || '—', [cutPos]);

  const copColumns = useMemo(() => [
    { title: 'COP #', dataIndex: 'copNo', width: 170, render: (v, r) => <RecordLink text={v} onClick={() => navigate(`/production/cutting/cop/${r.id}`)} /> },
    { title: 'Order #', dataIndex: 'orderNo', width: 140 },
    { title: 'Style #', dataIndex: 'styleNo', width: 130 },
    { title: 'Buyer', dataIndex: 'buyer', width: 200, ellipsis: true },
    { title: 'Delivery', dataIndex: 'deliveryDate', width: 110, render: (v) => dayjs(v).format('DD-MMM-YYYY') },
    {
      title: 'Size-Set Cut', dataIndex: 'sizeSetStatus', width: 130, align: 'center',
      render: (v) => (v === 'APPROVED' ? <Tag color="green">Approved</Tag> : <Tag color="orange">Pending</Tag>),
    },
    { title: 'Status', dataIndex: 'status', width: 130, render: (v) => <CuttingStatusTag status={v} /> },
    {
      title: 'Actions', key: 'act', width: 90, fixed: 'right', align: 'center',
      render: (_, r) => <ActionButton action="edit" size="small" onClick={() => navigate(`/production/cutting/cop/${r.id}`)} />,
    },
  ], [navigate]);

  const markerColumns = useMemo(() => [
    { title: 'Marker #', dataIndex: 'markerNo', width: 180, render: (v) => <code>{v}</code> },
    { title: 'Cut PO', dataIndex: 'cutPoId', width: 150, render: poNo },
    { title: 'Length (m)', dataIndex: 'length', width: 100, align: 'right' },
    { title: 'Width (cm)', dataIndex: 'width', width: 100, align: 'right' },
    {
      title: 'Efficiency', dataIndex: 'efficiencyPct', width: 180,
      render: (v) => (
        <Progress percent={v} size="small" status={v < THRESHOLDS.markerEfficiencyWarn ? 'exception' : 'normal'}
          format={(p) => `${p}%${p < THRESHOLDS.markerEfficiencyWarn ? ' ⚠' : ''}`} />
      ),
    },
    {
      title: 'Size Ratio', key: 'ratio', width: 200,
      render: (_, r) => r.sizes.map((s) => `${s}:${r.ratio[s]}`).join('  '),
    },
    { title: 'Table', dataIndex: 'tableNo', width: 90, align: 'center' },
    { title: 'Status', dataIndex: 'status', width: 110, render: (v) => <CuttingStatusTag status={v} /> },
    {
      title: 'Actions', key: 'act', width: 90, fixed: 'right', align: 'center',
      render: (_, r) => <ActionButton action="edit" size="small" onClick={() => setMarkerDrawer({ open: true, record: r })} />,
    },
  ], [poNo]);

  return (
    <Card>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
        <Segmented options={['Cut Order Plans', 'Marker Plans']} value={view} onChange={setView} />
        {view === 'Cut Order Plans'
          ? <ActionButton action="create" text="New Cut Order Plan" onClick={() => navigate('/production/cutting/cop/new')} />
          : <ActionButton action="create" text="New Marker" onClick={() => setMarkerDrawer({ open: true, record: null })} />}
      </Space>
      {view === 'Cut Order Plans' ? (
        <Table rowKey="id" size="small" columns={copColumns} dataSource={cops} loading={loading}
          scroll={{ x: 1150 }} pagination={getTablePagination({ pageSize: 10 }, 'plans')}
          locale={{ emptyText: <EmptyState title="No cut order plans" description="Plan cutting for a confirmed order" /> }} />
      ) : (
        <Table rowKey="id" size="small" columns={markerColumns} dataSource={markers} loading={loading}
          scroll={{ x: 1150 }} pagination={getTablePagination({ pageSize: 10 }, 'markers')}
          locale={{ emptyText: <EmptyState title="No markers" description="Create a marker layout for a Cut PO" /> }} />
      )}
      <MarkerPlanDrawer
        open={markerDrawer.open}
        record={markerDrawer.record}
        cutPos={cutPos}
        onClose={() => setMarkerDrawer({ open: false, record: null })}
        onSaved={() => { setMarkerDrawer({ open: false, record: null }); load(); }}
      />
    </Card>
  );
};

export default CutPlanningTab;
