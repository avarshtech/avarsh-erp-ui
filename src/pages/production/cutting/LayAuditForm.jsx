import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Space, Spin, Alert, InputNumber, DatePicker, Descriptions } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import { FormSelect } from '../../../components/form';
import { getLayAudit, saveLayAudit, listLayAudits, getCutPos, getRolls } from '../../../services/production/cuttingService';
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
  const [existingLayNos, setExistingLayNos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([isEdit ? getLayAudit(id) : Promise.resolve(null), getCutPos(), listLayAudits()])
      .then(([record, pos, lays]) => {
        setCutPos(pos);
        const base = record || {
          cutPoId: pos[0]?.id, layNo: null, date: dayjs().format('YYYY-MM-DD'),
          layLength: null, layHeight: null, width: null, startTime: null, endTime: null, rolls: [],
        };
        setLay(base);
        setExistingLayNos(lays.filter((l) => l.cutPoId === base.cutPoId && l.id !== record?.id).map((l) => l.layNo));
      })
      .catch(() => message.error('Failed to load lay audit'))
      .finally(() => setLoading(false));
  }, [id, isEdit, message]);

  useEffect(() => {
    if (!lay?.cutPoId) return;
    getRolls(lay.cutPoId).then(setAvailableRolls).catch(() => {});
  }, [lay?.cutPoId]);

  const po = useMemo(() => cutPos.find((p) => p.id === lay?.cutPoId), [cutPos, lay]);
  const layNoTaken = lay?.layNo != null && existingLayNos.includes(lay.layNo);
  const shadeLots = useMemo(() => new Set(
    (lay?.rolls || []).map((r) => availableRolls.find((a) => a.rollNo === r.rollNo)?.shadeLot).filter(Boolean),
  ), [lay?.rolls, availableRolls]);

  const patch = useCallback((p) => setLay((prev) => ({ ...prev, ...p })), []);

  const handleSave = async () => {
    if (!lay.layNo) return message.warning('Enter the Lay #');
    if (layNoTaken) return message.error(`Lay ${lay.layNo} already exists for this Cut PO`);
    if (!lay.rolls.length) return message.warning('Add at least one roll to the lay');
    setSaving(true);
    try {
      await saveLayAudit({ ...lay, id: lay.id });
      message.success(`Lay ${lay.layNo} saved`);
      navigate('/production/cutting?tab=lay-audit');
    } catch { message.error('Failed to save lay audit'); } finally { setSaving(false); }
  };

  if (loading || !lay) return <div style={{ textAlign: 'center', padding: 80 }}><Spin /></div>;

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={isEdit ? `Lay Audit — Lay ${lay.layNo}` : 'New Lay Audit'}
        backPath="/production/cutting?tab=lay-audit"
        style={{ position: 'sticky', top: 64, zIndex: 10 }}
      >
        <ActionButton action="save" text="Save Lay" loading={saving} onClick={handleSave} />
      </PageHeader>

      <Card style={{ marginBottom: 16 }}>
        <Space size="large" wrap align="end">
          <div>
            <FieldLabel>Cut PO #</FieldLabel>
            <FormSelect value={lay.cutPoId} style={{ width: 240 }} disabled={isEdit}
              options={cutPos.map((p) => ({ value: p.id, label: `${p.cutPoNo} · ${p.styleNo}` }))}
              onChange={(v) => patch({ cutPoId: v, rolls: [] })} />
          </div>
          <div>
            <FieldLabel>Date</FieldLabel>
            <DatePicker format="DD-MMM-YYYY" allowClear={false} value={dayjs(lay.date)} onChange={(d) => patch({ date: d.format('YYYY-MM-DD') })} />
          </div>
          <div>
            <FieldLabel>Lay #</FieldLabel>
            <InputNumber min={1} value={lay.layNo} status={layNoTaken ? 'error' : undefined} onChange={(v) => patch({ layNo: v })} />
          </div>
          <div>
            <FieldLabel>Lay Length (m)</FieldLabel>
            <InputNumber min={0} step={0.1} value={lay.layLength} onChange={(v) => patch({ layLength: v })} />
          </div>
          <div>
            <FieldLabel>Lay Height (m)</FieldLabel>
            <InputNumber min={0} step={0.01} value={lay.layHeight} onChange={(v) => patch({ layHeight: v })} />
          </div>
          <div>
            <FieldLabel>End-to-End Width (m)</FieldLabel>
            <InputNumber min={0} step={0.01} value={lay.width} onChange={(v) => patch({ width: v })} />
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

      {po?.sizeSetStatus !== 'APPROVED' && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }}
          title="Size-set cut is not approved for this Cut PO — bulk laying should wait for pilot-cut sign-off (see Planning tab)." />
      )}
      {shadeLots.size > 1 && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }}
          title={`Mixed shade lots in one lay (${[...shadeLots].join(', ')})`}
          description="Rolls from different shade lots in the same lay can cause part-to-part shade variation in a garment. Split into separate lays unless shades are band-matched." />
      )}

      <LayAuditRollGrid lay={lay} availableRolls={availableRolls} onChange={setLay} />
    </div>
  );
};

export default LayAuditForm;
