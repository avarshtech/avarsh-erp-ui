import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Space, Spin, Alert, Button, DatePicker, Tag, Descriptions, Table } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import { FormSelect } from '../../../components/form';
import { FACTORIES } from '../../../utils/cuttingConstants';
import { getMarkerPlan, saveMarkerPlan, relaxedCutPos, setSizeSetStatus } from '../../../services/production/cuttingService';
import CuttingStatusTag from './CuttingStatusTag';
import MarkerCard from './MarkerCard';

const FieldLabel = ({ children }) => (
  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{children}</div>
);

const blankMarker = () => ({ markerNo: '', fabricWidthRaw: null, cuttableWidth: null, markerLength: null, markerHeight: null, efficiencyPct: null, layPlanDate: null, cutPlanDate: null, layTableNo: null, cadFile: '', ratio: {} });
const renumber = (markers) => markers.map((m, i) => ({ ...m, markerNo: `MK-${String(i + 1).padStart(3, '0')}` }));

/** CR-CUT-2026-001 — single planning screen: Cut Order header + repeatable markers. */
const MarkerPlanForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [plan, setPlan] = useState(null);
  const [cutPos, setCutPos] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [record, pos] = await Promise.all([isEdit ? getMarkerPlan(id) : Promise.resolve(null), relaxedCutPos()]);
        setCutPos(pos);
        setPlan(record || {
          factory: FACTORIES[0], cutPoId: pos[0]?.id, date: dayjs().format('YYYY-MM-DD'),
          planStartDate: dayjs().format('YYYY-MM-DD'), planEndDate: dayjs().add(10, 'day').format('YYYY-MM-DD'),
          status: 'DRAFT', markers: renumber([blankMarker()]),
        });
      } catch { message.error('Failed to load marker plan'); }
    })();
  }, [id, isEdit, message]);

  const patch = useCallback((p) => setPlan((prev) => ({ ...prev, ...p })), []);
  const patchMarker = useCallback((idx, p) => setPlan((prev) => ({
    ...prev, markers: prev.markers.map((m, i) => (i === idx ? { ...m, ...p } : m)),
  })), []);
  const addMarkerAfter = useCallback((idx) => setPlan((prev) => {
    const markers = [...prev.markers];
    markers.splice(idx + 1, 0, blankMarker());
    return { ...prev, markers: renumber(markers) };
  }), []);
  const removeMarker = useCallback((idx) => setPlan((prev) => (
    { ...prev, markers: renumber(prev.markers.filter((_, i) => i !== idx)) }
  )), []);
  const importExcel = useCallback((idx) => {
    setPlan((prev) => ({
      ...prev,
      markers: prev.markers.map((m, i) => (i === idx ? {
        ...m, fabricWidthRaw: 59.5, cuttableWidth: 57, markerLength: 6.2, efficiencyPct: 88,
        cadFile: 'HM-TS-2601-M1.xlsx', ratio: Object.fromEntries((cutPos.find((p) => p.id === prev.cutPoId)?.sizes || []).map((s, si) => [s, si === 1 || si === 2 ? 2 : 1])),
      } : m)),
    }));
    message.success('Marker imported from CAD/Excel — widths, length, efficiency and size ratios loaded');
  }, [cutPos, message]);

  const po = useMemo(() => cutPos.find((p) => p.id === plan?.cutPoId), [cutPos, plan?.cutPoId]);

  const summary = useMemo(() => {
    if (!po || !plan) return null;
    const perSize = po.sizes.map((size) => {
      const planned = plan.markers.reduce((s, m) => s + (m.markerHeight || 0) * (m.ratio?.[size] || 0), 0);
      return { size, orderQty: po.sizeQty[size] || 0, planned, balance: (po.sizeQty[size] || 0) - planned };
    });
    const totalPlanned = perSize.reduce((s, r) => s + r.planned, 0);
    return { perSize, totalPlanned };
  }, [po, plan]);

  const handleSave = async () => {
    if (!plan.cutPoId) return message.warning('Select a Cut PO (relaxation-complete)');
    if (!plan.markers.some((m) => m.markerHeight && Object.values(m.ratio || {}).some(Boolean))) {
      return message.warning('At least one marker needs a height and a size ratio');
    }
    setSaving(true);
    try {
      const saved = await saveMarkerPlan({ ...plan, id: plan.id });
      message.success(`${saved.planNo} saved`);
      navigate('/production/cutting?tab=planning');
    } catch { message.error('Failed to save marker plan'); } finally { setSaving(false); }
  };

  const approveSizeSet = async () => {
    const updated = await setSizeSetStatus(plan.cutPoId, 'APPROVED');
    setCutPos((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    message.success('Size-set cut approved — bulk laying unblocked');
  };

  if (!plan) return <div style={{ textAlign: 'center', padding: 80 }}><Spin /></div>;

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={(
          <Space>
            <span>{plan.planNo || 'New Marker Plan'}</span>
            <CuttingStatusTag status={plan.status} />
          </Space>
        )}
        backPath="/production/cutting?tab=planning"
        style={{ position: 'sticky', top: 64, zIndex: 10 }}
      >
        <ActionButton action="save" text="Save Plan" loading={saving} onClick={handleSave} />
      </PageHeader>

      <Card title="Cut Order Plan Header" size="small" style={{ marginBottom: 16 }}>
        <Space size="large" wrap align="end" style={{ marginBottom: 12 }}>
          <div>
            <FieldLabel>Factory</FieldLabel>
            <FormSelect value={plan.factory} style={{ width: 170 }}
              options={FACTORIES.map((f) => ({ value: f, label: f }))} onChange={(v) => patch({ factory: v })} />
          </div>
          <div>
            <FieldLabel>Cut PO # (relaxation-complete only)</FieldLabel>
            <FormSelect value={plan.cutPoId} style={{ width: 240 }} disabled={isEdit} placeholder="Cut PO"
              options={cutPos.map((p) => ({ value: p.id, label: `${p.cutPoNo} · ${p.styleNo}` }))}
              onChange={(v) => patch({ cutPoId: v, markers: renumber([blankMarker()]) })} />
          </div>
          <div>
            <FieldLabel>Plan St. Dt</FieldLabel>
            <DatePicker format="DD-MMM-YYYY" allowClear={false} value={dayjs(plan.planStartDate)}
              onChange={(d) => patch({ planStartDate: d.format('YYYY-MM-DD') })} />
          </div>
          <div>
            <FieldLabel>Plan End Dt</FieldLabel>
            <DatePicker format="DD-MMM-YYYY" allowClear={false} value={dayjs(plan.planEndDate)}
              onChange={(d) => patch({ planEndDate: d.format('YYYY-MM-DD') })} />
          </div>
        </Space>
        {po && (
          <Descriptions size="small" column={{ xs: 1, md: 3 }}
            items={[
              { key: 'b', label: 'Buyer', children: po.buyer },
              { key: 's', label: 'Style #', children: po.styleNo },
              { key: 'd', label: 'Date', children: dayjs(plan.date).format('DD-MMM-YYYY') },
              { key: 'f', label: 'Fabric Details', children: `${po.fabricType} · ${po.width}" · ${po.consumption} ${po.consumptionUom}` },
              { key: 'q', label: 'Plan Qty (order)', children: po.orderQty },
              { key: 't', label: 'Total Cut Qty (markers)', children: <strong>{summary?.totalPlanned ?? 0}</strong> },
            ]} />
        )}
      </Card>

      {po && po.sizeSetStatus !== 'APPROVED' && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }}
          title="Size-set / pilot cut not yet approved — bulk laying stays blocked"
          action={<Button size="small" type="primary" onClick={approveSizeSet}>Mark Size-Set Approved</Button>} />
      )}

      {plan.markers.map((marker, idx) => (
        <MarkerCard key={marker.markerNo || idx} marker={marker} idx={idx} po={po} markers={plan.markers}
          onPatch={patchMarker} onAddAfter={addMarkerAfter} onImportExcel={importExcel} onRemove={removeMarker} />
      ))}
      <Button type="primary" ghost icon={<PlusOutlined />} block style={{ marginBottom: 16 }}
        onClick={() => addMarkerAfter(plan.markers.length - 1)}>
        Add Marker
      </Button>

      {summary && (
        <Card title="Plan Balance Summary (all markers)" size="small">
          <Table rowKey="size" size="small" pagination={false} dataSource={summary.perSize}
            columns={[
              { title: 'Size', dataIndex: 'size', width: 80, align: 'center', render: (v) => <strong>{v}</strong> },
              { title: 'Order Qty', dataIndex: 'orderQty', width: 110, align: 'right' },
              { title: 'Planned (all markers)', dataIndex: 'planned', width: 150, align: 'right' },
              {
                title: 'Balance', dataIndex: 'balance', width: 130, align: 'right',
                render: (v) => (v === 0 ? <Tag color="green">Covered</Tag>
                  : v > 0 ? <Tag color="orange">{v} to cut</Tag> : <Tag color="red">{-v} excess</Tag>),
              },
            ]} />
        </Card>
      )}
    </div>
  );
};

export default MarkerPlanForm;
