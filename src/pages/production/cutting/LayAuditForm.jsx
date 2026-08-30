import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Space, Spin, Alert, Input, InputNumber, DatePicker, Descriptions } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import { FormSelect } from '../../../components/form';
import useCuttingMasters from '../../../hooks/useCuttingMasters';
import { getLayAudit, saveLayAudit, getCutPos, getRolls, listMarkersForPo, nextLayNo } from '../../../services/production/cuttingService';
import LayAuditRollGrid from './LayAuditRollGrid';

const FieldLabel = ({ children }) => (
  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{children}</div>
);

/** FR-03 — full-page lay/spread record with per-roll weight and variance math. */
const LayAuditForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [lay, setLay] = useState(null);
  const [cutPos, setCutPos] = useState([]);
  const [availableRolls, setAvailableRolls] = useState([]);
  const [markers, setMarkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { fabricTypeByName } = useCuttingMasters();

  useEffect(() => {
    setLoading(true);
    Promise.all([isEdit ? getLayAudit(id) : Promise.resolve(null), getCutPos()])
      .then(([record, pos]) => {
        setCutPos(pos);
        setLay(record || {
          cuttingPoId: pos[0]?.id, markerId: null, layNo: null, layDate: dayjs().format('YYYY-MM-DD'),
          layLength: null, plies: null, width: null, startTime: null, endTime: null, rolls: [],
        });
      })
      .catch(() => message.error('Failed to load lay audit'))
      .finally(() => setLoading(false));
  }, [id, isEdit, message]);

  useEffect(() => {
    if (!lay?.cuttingPoId) return;
    getRolls(lay.cuttingPoId).then(setAvailableRolls).catch(() => {});
    listMarkersForPo(lay.cuttingPoId).then(setMarkers).catch(() => {});
  }, [lay?.cuttingPoId]);

  const po = useMemo(() => cutPos.find((p) => p.id === lay?.cuttingPoId), [cutPos, lay]);
  const marker = useMemo(() => markers.find((m) => m.id === lay?.markerId), [markers, lay?.markerId]);

  /** CR Change 3 — marker selected: Lay # auto per marker; length/plies/width pre-fill. */
  const handleMarkerSelect = useCallback(async (markerId) => {
    const m = markers.find((x) => x.id === markerId);
    const seq = await nextLayNo(markerId);
    setLay((prev) => ({
      ...prev, markerId, layNo: prev.id && prev.markerId === markerId ? prev.layNo : seq,
      layLength: m?.markerLength ?? prev.layLength,
      plies: m?.markerHeight ?? prev.plies,
      width: m?.cuttableWidth ?? prev.width,
    }));
  }, [markers]);
  const shadeLots = useMemo(() => new Set(
    (lay?.rolls || []).map((r) => availableRolls.find((a) => a.rollNo === r.rollNo)?.shadeLot).filter(Boolean),
  ), [lay?.rolls, availableRolls]);

  const patch = useCallback((p) => setLay((prev) => ({ ...prev, ...p })), []);

  const handleSave = async () => {
    if (!lay.markerId) return message.warning('Marker # is mandatory — lays are planned per marker');
    if (!lay.rolls.length) return message.warning('Add at least one roll to the lay');
    setSaving(true);
    try {
      const saved = await saveLayAudit({ ...lay, id: lay.id });
      message.success(`${saved.layRef} saved`);
      navigate('/production/cutting?tab=lay-audit');
    } catch (e) {
      message.error(e?.response?.data?.message || 'Failed to save lay audit');
    } finally { setSaving(false); }
  };

  if (loading || !lay) return <div style={{ textAlign: 'center', padding: 80 }}><Spin /></div>;

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={isEdit ? `Lay Audit — ${marker?.markerNo || ''} · Lay ${lay.layNo}` : 'New Lay Audit'}
        backPath="/production/cutting?tab=lay-audit"
        style={{ position: 'sticky', top: 64, zIndex: 10 }}
      >
        <ActionButton action="save" text="Save Lay" loading={saving} onClick={handleSave} />
      </PageHeader>

      <Card style={{ marginBottom: 16 }}>
        <Space size="large" wrap align="end">
          <div>
            <FieldLabel>Cut PO #</FieldLabel>
            <FormSelect value={lay.cuttingPoId} style={{ width: 240 }} disabled={isEdit}
              options={cutPos.map((p) => ({ value: p.id, label: `${p.cutPoNo} · ${p.styleNo}` }))}
              onChange={(v) => patch({ cuttingPoId: v, markerId: null, layNo: null, rolls: [] })} />
          </div>
          <div>
            <FieldLabel>Marker # (mandatory)</FieldLabel>
            <FormSelect value={lay.markerId} style={{ width: 190 }} placeholder="Select marker" disabled={isEdit}
              status={!lay.markerId ? 'warning' : undefined}
              options={markers.map((m) => ({ value: m.id, label: `${m.markerNo} · ${m.planNo}` }))}
              onChange={handleMarkerSelect} />
          </div>
          <div>
            <FieldLabel>Date</FieldLabel>
            <DatePicker format="DD-MMM-YYYY" allowClear={false} value={dayjs(lay.layDate)} onChange={(d) => patch({ layDate: d.format('YYYY-MM-DD') })} />
          </div>
          <div>
            <FieldLabel>Lay # (auto per marker)</FieldLabel>
            <Input readOnly value={lay.layNo ? `LAY-${String(lay.layNo).padStart(3, '0')}` : '—'} style={{ width: 110 }} />
          </div>
          <div>
            <FieldLabel>Lay Length (m) — from marker</FieldLabel>
            <InputNumber min={0} step={0.1} value={lay.layLength} onChange={(v) => patch({ layLength: v })} />
          </div>
          <div>
            <FieldLabel>Height — from marker</FieldLabel>
            <InputNumber min={0} value={lay.plies} onChange={(v) => patch({ plies: v })} />
          </div>
          <div>
            <FieldLabel>Lay Width (in) — marker tab width</FieldLabel>
            <InputNumber readOnly value={lay.width} style={{ width: 110 }} />
          </div>
          <div>
            <FieldLabel>Lay Start</FieldLabel>
            <DatePicker showTime={{ format: 'HH:mm' }} format="DD-MMM HH:mm"
              value={lay.startTime ? dayjs(lay.startTime) : null} onChange={(d) => patch({ startTime: d ? d.format('YYYY-MM-DD HH:mm') : null })} />
          </div>
          <div>
            <FieldLabel>Lay End</FieldLabel>
            <DatePicker showTime={{ format: 'HH:mm' }} format="DD-MMM HH:mm"
              value={lay.endTime ? dayjs(lay.endTime) : null} onChange={(d) => patch({ endTime: d ? d.format('YYYY-MM-DD HH:mm') : null })} />
          </div>
        </Space>
        {po && (
          <Descriptions size="small" column={{ xs: 1, md: 4 }} style={{ marginTop: 16 }}
            items={[
              { key: 'o', label: 'Order #', children: po.orderNo },
              { key: 's', label: 'Style #', children: po.styleNo },
              { key: 'c', label: 'Color', children: po.color },
              { key: 'ss', label: 'Size-Set', children: po.sizeSetStatus === 'APPROVED' ? 'Approved' : 'Pending' },
            ]} />
        )}
      </Card>

      <Alert type="info" showIcon style={{ marginBottom: 16 }}
        title="Lays are planned based on the selected Marker #"
        description={marker
          ? `${marker.markerNo} (${marker.planNo}): length ${marker.markerLength} m · height ${marker.markerHeight} · cuttable width ${marker.cuttableWidth}" — lay fields pre-fill from the marker and stay editable except width.`
          : 'Select the marker this lay executes; Lay #, length, plies and width auto-populate from it.'} />

      {po?.sizeSetStatus !== 'APPROVED' && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }}
          title="Size-set cut is not approved for this Cut PO — bulk laying should wait for pilot-cut sign-off (see Planning tab)." />
      )}
      {shadeLots.size > 1 && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }}
          title={`Mixed shade lots in one lay (${[...shadeLots].join(', ')})`}
          description="Rolls from different shade lots in the same lay can cause part-to-part shade variation in a garment. Split into separate lays unless shades are band-matched." />
      )}

      <LayAuditRollGrid lay={lay} availableRolls={availableRolls} onChange={setLay}
        uom={fabricTypeByName(po?.fabricType)?.stockUom || 'kg'} />
    </div>
  );
};

export default LayAuditForm;
