import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Space, Spin, Alert, Button, DatePicker, InputNumber, Descriptions } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import { FormSelect } from '../../../components/form';
import { allowancePerSize, plannedPerSize, sizeJumps, totalAllowanceQty } from '../../../utils/cuttingCalc';
import { getMarkerPlan, saveMarkerPlan, relaxedCutPos, setSizeSetStatus } from '../../../services/production/cuttingService';
import CuttingStatusTag from './CuttingStatusTag';
import MarkerMatrix from './MarkerMatrix';
import SizeJumpAlert from './SizeJumpAlert';

const FieldLabel = ({ children }) => (
  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{children}</div>
);

const blankMarker = () => ({
  markerLength: null, markerHeight: null, efficiencyPct: null,
  layPlanDate: null, cutPlanDate: null, cuttingTableId: null, cadFile: '', ratio: {},
});

/**
 * CR-CUT-2026-001 (rev) — single planning screen shaped like the CAD marker
 * sheet: header (buyer/style/widths/allowance) + marker rows in one matrix.
 * The imported CAD Excel populates the whole matrix.
 *
 * Marker numbers, cut quantities and size jumps are all assigned by the server
 * on save; the figures shown while editing are a live preview of the same rules.
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
          cuttingPoId: pos[0]?.id, planDate: dayjs().format('YYYY-MM-DD'),
          planStartDate: dayjs().format('YYYY-MM-DD'), planEndDate: dayjs().add(10, 'day').format('YYYY-MM-DD'),
          fabricWidthRaw: null, cuttableWidth: null, allowancePct: 5,
          status: 'DRAFT', markers: [blankMarker()],
        });
      } catch { message.error('Failed to load marker plan'); }
    })();
  }, [id, isEdit, message]);

  const patch = useCallback((p) => setPlan((prev) => ({ ...prev, ...p })), []);
  const patchMarker = useCallback((idx, p) => setPlan((prev) => ({
    ...prev, markers: prev.markers.map((m, i) => (i === idx ? { ...m, ...p } : m)),
  })), []);
  const addMarker = useCallback(() => setPlan((prev) => ({ ...prev, markers: [...prev.markers, blankMarker()] })), []);
  const removeMarker = useCallback((idx) => setPlan((prev) => (
    { ...prev, markers: prev.markers.filter((_, i) => i !== idx) }
  )), []);

  /**
   * An edited plan carries the Cut PO it was created against, which is not
   * necessarily still in the relaxation-complete dropdown list.
   */
  const po = useMemo(() => {
    if (!plan) return null;
    const match = cutPos.find((p) => p.id === plan.cuttingPoId);
    if (match) return match;
    if (!plan.sizes) return null;
    return {
      id: plan.cuttingPoId,
      cutPoNo: plan.cuttingPoNo,
      styleNo: plan.styleNo,
      buyer: plan.buyer,
      unitName: plan.unitName,
      sizes: plan.sizes,
      sizeQty: plan.orderQty,
      orderQty: plan.totalOrderQty,
      sizeSetStatus: plan.sizeSetStatus,
    };
  }, [cutPos, plan]);

  /** Mock CAD Excel import — fills widths, allowance and marker rows like cutting_marker.png. */
  const importExcel = useCallback(() => {
    if (!po) return;
    const [s1, s2, s3, s4] = po.sizes;
    setPlan((prev) => ({
      ...prev,
      fabricWidthRaw: 59.5, cuttableWidth: 57, allowancePct: 5,
      markers: [
        { ...blankMarker(), markerHeight: 100, markerLength: 6.2, efficiencyPct: 88, cadFile: `${po.styleNo}-M1.xlsx`, ratio: { [s1]: 1, [s2]: 2, [s3]: 2, [s4]: 1 } },
        { ...blankMarker(), markerHeight: 66, markerLength: 4.1, efficiencyPct: 86, cadFile: `${po.styleNo}-M2.xlsx`, ratio: { [s2]: 1, [s3]: 1 } },
        { ...blankMarker(), markerHeight: 40, markerLength: 2.8, efficiencyPct: 84, cadFile: `${po.styleNo}-M3.xlsx`, ratio: { [s1]: 1, [s4]: 1 } },
      ],
    }));
    message.success('CAD marker Excel imported — widths, allowance and 3 marker rows populated');
  }, [po, message]);

  const jumps = useMemo(() => {
    if (!po || !plan) return [];
    const allowance = allowancePerSize(po.sizes, po.sizeQty, plan.allowancePct);
    return sizeJumps(po.sizes, allowance, plannedPerSize(plan.markers, po.sizes));
  }, [po, plan]);

  const handleSave = async () => {
    if (!plan.cuttingPoId) return message.warning('Select a Cut PO (relaxation-complete)');
    if (!plan.markers.some((m) => m.markerHeight && Object.values(m.ratio || {}).some(Boolean))) {
      return message.warning('At least one marker row needs a height and a size ratio');
    }
    setSaving(true);
    try {
      const saved = await saveMarkerPlan({
        id: plan.id,
        version: plan.version,
        cuttingPoId: plan.cuttingPoId,
        planDate: plan.planDate,
        planStartDate: plan.planStartDate,
        planEndDate: plan.planEndDate,
        fabricWidthRaw: plan.fabricWidthRaw,
        cuttableWidth: plan.cuttableWidth,
        allowancePct: plan.allowancePct,
        status: plan.status,
        remarks: plan.remarks,
        markers: plan.markers,
      });
      message.success(`${saved.planNo} saved`);
      navigate('/production/cutting?tab=planning');
    } catch (e) {
      message.error(e?.response?.data?.message || 'Failed to save marker plan');
    } finally { setSaving(false); }
  };

  const approveSizeSet = async () => {
    try {
      await setSizeSetStatus(plan.cuttingPoId, 'APPROVED');
      setCutPos((prev) => prev.map((p) => (p.id === plan.cuttingPoId ? { ...p, sizeSetStatus: 'APPROVED' } : p)));
      setPlan((prev) => ({ ...prev, sizeSetStatus: 'APPROVED' }));
      message.success('Size-set cut approved — bulk laying unblocked');
    } catch { message.error('Failed to approve the size-set cut'); }
  };

  if (!plan) return <div style={{ textAlign: 'center', padding: 80 }}><Spin /></div>;

  const sizeSetStatus = po?.sizeSetStatus ?? plan.sizeSetStatus;

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
            <FieldLabel>Cut PO # (relaxation-complete only)</FieldLabel>
            <FormSelect value={plan.cuttingPoId} style={{ width: 240 }} disabled={isEdit} placeholder="Cut PO"
              options={cutPos.map((p) => ({ value: p.id, label: `${p.cutPoNo} · ${p.styleNo}` }))}
              onChange={(v) => patch({ cuttingPoId: v, markers: [blankMarker()] })} />
          </div>
          <div>
            <FieldLabel>Plan St. Dt</FieldLabel>
            <DatePicker format="DD-MMM-YYYY" allowClear={false} value={plan.planStartDate ? dayjs(plan.planStartDate) : null}
              onChange={(d) => patch({ planStartDate: d ? d.format('YYYY-MM-DD') : null })} />
          </div>
          <div>
            <FieldLabel>Plan End Dt</FieldLabel>
            <DatePicker format="DD-MMM-YYYY" allowClear={false} value={plan.planEndDate ? dayjs(plan.planEndDate) : null}
              onChange={(d) => patch({ planEndDate: d ? d.format('YYYY-MM-DD') : null })} />
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
              { key: 'u', label: 'Unit', children: po.unitName || '—' },
              { key: 'f', label: 'Fabric Details', children: `${po.fabricType || '—'} · ${po.color || '—'}` },
              { key: 'q', label: 'Plan Qty (order)', children: po.orderQty },
              { key: 'a', label: `Cut Qty (+${plan.allowancePct || 0}%)`, children: <strong>{totalAllowanceQty(po.sizes, po.sizeQty, plan.allowancePct)}</strong> },
            ]} />
        )}
      </Card>

      {po && sizeSetStatus !== 'APPROVED' && (
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
