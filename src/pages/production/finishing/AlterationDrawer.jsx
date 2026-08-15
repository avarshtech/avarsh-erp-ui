import { useEffect, useMemo, useState } from 'react';
import { App, Drawer, Space, InputNumber, Input, DatePicker, Button, Alert, Tag } from 'antd';
import dayjs from 'dayjs';
import { ActionButton } from '../../../components/buttons';
import { FormSelect } from '../../../components/form';
import { DEFECT_LIBRARY, DEFECT_SOURCES, DEFECT_SEVERITIES, RECHECK_RESULTS, REALTER_CYCLE_ALERT } from '../../../utils/finishingConstants';
import { saveAlteration } from '../../../services/production/finishingService';

const FieldLabel = ({ children }) => (
  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{children}</div>
);

const emptyForm = { orderId: null, color: null, size: null, date: dayjs().format('YYYY-MM-DD'), alterPcs: null, defectCode: null, source: null, doneById: null, recheckResult: 'PENDING', remarks: '' };

/** PRD Module 8 — alteration entry: defect code + source mandatory, re-check loop. */
const AlterationDrawer = ({ open, record, orders, employees, onClose, onSaved }) => {
  const { message } = App.useApp();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setForm(record ? { ...record } : emptyForm); }, [open, record]);

  const patch = (p) => setForm((prev) => ({ ...prev, ...p }));
  const order = useMemo(() => orders.find((o) => o.id === form.orderId), [orders, form.orderId]);
  const severity = DEFECT_LIBRARY.find((d) => d.code === form.defectCode)?.severity;

  const handleSave = async () => {
    if (!form.orderId || !form.alterPcs || !form.defectCode || !form.source) return message.warning('Order, pieces, defect code and source are mandatory');
    setSaving(true);
    try {
      await saveAlteration(form);
      message.success(record ? 'Alteration updated' : 'Alteration logged');
      onSaved();
    } catch { message.error('Failed to save alteration'); } finally { setSaving(false); }
  };

  return (
    <Drawer title={record ? `Alteration — ${record.alterNo}` : 'Log Alteration'} open={open} onClose={onClose} size={620} destroyOnHidden
      footer={(
        <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
          <Button onClick={onClose}>Cancel</Button>
          <ActionButton action="save" text="Save" loading={saving} onClick={handleSave} />
        </Space>
      )}>
      <Space size="middle" wrap style={{ marginBottom: 16 }}>
        <div>
          <FieldLabel>Order</FieldLabel>
          <FormSelect value={form.orderId} style={{ width: 220 }} placeholder="Order" disabled={Boolean(record)}
            options={orders.map((o) => ({ value: o.id, label: `${o.orderNo} · ${o.styleNo}` }))}
            onChange={(v) => patch({ orderId: v, color: orders.find((o) => o.id === v)?.color, size: null })} />
        </div>
        <div>
          <FieldLabel>Size</FieldLabel>
          <FormSelect value={form.size} style={{ width: 90 }} placeholder="Size"
            options={(order?.sizes || []).map((s) => ({ value: s, label: s }))} onChange={(v) => patch({ size: v })} />
        </div>
        <div>
          <FieldLabel>Date</FieldLabel>
          <DatePicker format="DD-MMM-YYYY" allowClear={false} value={dayjs(form.date)} onChange={(d) => patch({ date: d.format('YYYY-MM-DD') })} />
        </div>
        <div>
          <FieldLabel>Alter Pcs</FieldLabel>
          <InputNumber min={1} value={form.alterPcs} style={{ width: 90 }} onChange={(v) => patch({ alterPcs: v })} />
        </div>
      </Space>
      <Space size="middle" wrap style={{ marginBottom: 16 }}>
        <div>
          <FieldLabel>Defect Type Code {severity && <Tag color={DEFECT_SEVERITIES[severity].color}>{DEFECT_SEVERITIES[severity].label}</Tag>}</FieldLabel>
          <FormSelect value={form.defectCode} style={{ width: 320 }} placeholder="From defect library" showSearch
            options={DEFECT_LIBRARY.map((d) => ({ value: d.code, label: `${d.code} — ${d.name}` }))} onChange={(v) => patch({ defectCode: v })} />
        </div>
        <div>
          <FieldLabel>Defect Source</FieldLabel>
          <FormSelect value={form.source} style={{ width: 140 }} placeholder="Source"
            options={DEFECT_SOURCES.map((s) => ({ value: s, label: s }))} onChange={(v) => patch({ source: v })} />
        </div>
      </Space>
      <Space size="middle" wrap style={{ marginBottom: 16 }}>
        <div>
          <FieldLabel>Alteration Done By</FieldLabel>
          <FormSelect value={form.doneById} style={{ width: 200 }} placeholder="Employee"
            options={employees.map((e) => ({ value: e.id, label: `${e.name} (${e.code})` }))} onChange={(v) => patch({ doneById: v })} />
        </div>
        <div>
          <FieldLabel>Re-Check Result</FieldLabel>
          <FormSelect value={form.recheckResult} style={{ width: 150 }}
            options={[{ value: 'PENDING', label: 'Pending' }, ...RECHECK_RESULTS.map((r) => ({ value: r, label: r.replace('_', '-') }))]}
            onChange={(v) => patch({ recheckResult: v })} />
        </div>
      </Space>
      {form.recheckResult === 'RE_ALTER' && (form.cycles || 1) + 1 >= REALTER_CYCLE_ALERT && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }}
          title={`This piece will reach ${(form.cycles || 1) + 1} alteration cycles — supervisor alert triggers at ${REALTER_CYCLE_ALERT}`} />
      )}
      <FieldLabel>Reason / Remarks</FieldLabel>
      <Input.TextArea rows={2} value={form.remarks} onChange={(e) => patch({ remarks: e.target.value })}
        placeholder="Additional notes (defect code is still mandatory)" />
    </Drawer>
  );
};

export default AlterationDrawer;
