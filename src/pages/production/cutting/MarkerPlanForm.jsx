import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Space, Spin, Alert, Button, DatePicker, InputNumber, Descriptions } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import { FormSelect } from '../../../components/form';
import { FACTORIES } from '../../../utils/cuttingConstants';
import { getMarkerPlan, saveMarkerPlan, relaxedCutPos, setSizeSetStatus, allowanceQty, sizeJumps } from '../../../services/production/cuttingService';
import CuttingStatusTag from './CuttingStatusTag';
import MarkerMatrix from './MarkerMatrix';
import SizeJumpAlert from './SizeJumpAlert';

const FieldLabel = ({ children }) => (
  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{children}</div>
);

const blankMarker = () => ({ markerNo: '', markerLength: null, markerHeight: null, efficiencyPct: null, layPlanDate: null, cutPlanDate: null, layTableNo: null, cadFile: '', ratio: {} });
const renumber = (markers) => markers.map((m, i) => ({ ...m, markerNo: `MK-${String(i + 1).padStart(3, '0')}` }));

/**
 * CR-CUT-2026-001 (rev) — single planning screen shaped like the CAD marker
 * sheet: header (buyer/style/widths/allowance) + marker rows in one matrix.
 * The imported CAD Excel populates the whole matrix.
 */
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
          fabricWidthRaw: null, cuttableWidth: null, allowancePct: 5,
          status: 'DRAFT', markers: renumber([blankMarker()]),
        });
      } catch { message.error('Failed to load marker plan'); }
    })();
  }, [id, isEdit, message]);

  const patch = useCallback((p) => setPlan((prev) => ({ ...prev, ...p })), []);
  const patchMarker = useCallback((idx, p) => setPlan((prev) => ({
    ...prev, markers: prev.markers.map((m, i) => (i === idx ? { ...m, ...p } : m)),
  })), []);
  const addMarker = useCallback(() => setPlan((prev) => ({ ...prev, markers: renumber([...prev.markers, blankMarker()]) })), []);
  const removeMarker = useCallback((idx) => setPlan((prev) => (
    { ...prev, markers: renumber(prev.markers.filter((_, i) => i !== idx)) }
  )), []);

  const po = useMemo(() => cutPos.find((p) => p.id === plan?.cutPoId), [cutPos, plan?.cutPoId]);

  /** Mock CAD Excel import — fills widths, allowance and marker rows like cutting_marker.png. */
  const importExcel = useCallback(() => {
    if (!po) return;
    const [s1, s2, s3, s4] = po.sizes;
    setPlan((prev) => ({
      ...prev,
      fabricWidthRaw: 59.5, cuttableWidth: 57, allowancePct: 5,
      markers: renumber([
        { ...blankMarker(), markerHeight: 100, markerLength: 6.2, efficiencyPct: 88, cadFile: `${po.styleNo}-M1.xlsx`, ratio: { [s1]: 1, [s2]: 2, [s3]: 2, [s4]: 1 } },
        { ...blankMarker(), markerHeight: 66, markerLength: 4.1, efficiencyPct: 86, cadFile: `${po.styleNo}-M2.xlsx`, ratio: { [s2]: 1, [s3]: 1 } },
        { ...blankMarker(), markerHeight: 40, markerLength: 2.8, efficiencyPct: 84, cadFile: `${po.styleNo}-M3.xlsx`, ratio: { [s1]: 1, [s4]: 1 } },
      ]),
    }));
    message.success('CAD marker Excel imported — widths, allowance and 3 marker rows populated');
  }, [po, message]);

  const jumps = useMemo(() => {
    if (!po || !plan) return [];
    const rows = po.sizes.map((size) => {
      const cutQty = plan.markers.reduce((s, m) => s + (m.markerHeight || 0) * (m.ratio?.[size] || 0), 0);
      const orderQty = allowanceQty(po.sizeQty[size], plan.allowancePct);
      return { size, cutQty, orderQty, balance: orderQty - cutQty };
    });
    return sizeJumps(po, rows);
  }, [po, plan]);

  const handleSave = async () => {
    if (!plan.cutPoId) return message.warning('Select a Cut PO (relaxation-complete)');
    if (!plan.markers.some((m) => m.markerHeight && Object.values(m.ratio || {}).some(Boolean))) {
      return message.warning('At least one marker row needs a height and a size ratio');
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
          <div>
            <FieldLabel>Fabric Width — Raw Edge (in)</FieldLabel>
            <InputNumber min={20} step={0.5} value={plan.fabricWidthRaw} style={{ width: 100 }} onChange={(v) => patch({ fabricWidthRaw: v })} />
          </div>
          <div>
            <FieldLabel>Cuttable Width (in)</FieldLabel>
            <InputNumber min={20} step={0.5} value={plan.cuttableWidth} style={{ width: 100 }} onChange={(v) => patch({ cuttableWidth: v })} />
          </div>
          <div>
            <FieldLabel>Cut Allowance %</FieldLabel>
            <InputNumber min={0} max={15} value={plan.allowancePct} style={{ width: 80 }} onChange={(v) => patch({ allowancePct: v })} />
          </div>
        </Space>
        {po && (
          <Descriptions size="small" column={{ xs: 1, md: 3 }}
            items={[
              { key: 'b', label: 'Buyer', children: po.buyer },
              { key: 's', label: 'Style #', children: po.styleNo },
              { key: 'd', label: 'Date', children: dayjs(plan.date).format('DD-MMM-YYYY') },
              { key: 'f', label: 'Fabric Details', children: `${po.fabricType} · ${po.color}` },
              { key: 'q', label: 'Plan Qty (order)', children: po.orderQty },
              { key: 'a', label: `Cut Qty (+${plan.allowancePct || 0}%)`, children: <strong>{allowanceQty(po.orderQty, plan.allowancePct)}</strong> },
            ]} />
        )}
      </Card>

      {po && po.sizeSetStatus !== 'APPROVED' && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }}
          title="Size-set / pilot cut not yet approved — bulk laying stays blocked"
          action={<Button size="small" type="primary" onClick={approveSizeSet}>Mark Size-Set Approved</Button>} />
      )}

      <MarkerMatrix po={po} plan={plan} onPatchMarker={patchMarker}
        onAddMarker={addMarker} onRemoveMarker={removeMarker} onImportExcel={importExcel} />
      <SizeJumpAlert jumps={jumps} />
    </div>
  );
};

export default MarkerPlanForm;
