import { useEffect, useState } from 'react';
import { App, Drawer, Space, InputNumber, DatePicker, Button, Alert } from 'antd';
import dayjs from 'dayjs';
import { ActionButton } from '../../../components/buttons';
import { FormSelect } from '../../../components/form';
import { STAIN_TYPES } from '../../../utils/finishingConstants';
import { saveSpotWash } from '../../../services/production/finishingService';

const FieldLabel = ({ children }) => (
  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{children}</div>
);

const emptyForm = { orderId: null, stainType: null, employeeId: null, date: dayjs().format('YYYY-MM-DD'), pcsIn: null, pcsPass: null, pcsReject: null };

/** PRD Module 4 — spot wash batch entry with In = Pass + Reject rule. */
const SpotWashDrawer = ({ open, orders, employees, onClose, onSaved }) => {
  const { message } = App.useApp();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setForm(emptyForm); }, [open]);

  const patch = (p) => setForm((prev) => ({ ...prev, ...p }));
  const unbalanced = form.pcsIn != null && form.pcsIn !== (form.pcsPass || 0) + (form.pcsReject || 0);

  const handleSave = async () => {
    if (!form.orderId || !form.stainType || !form.employeeId || !form.pcsIn) return message.warning('Order, stain type, employee and pieces in are required');
    if (unbalanced) return message.warning('Pieces In must equal Pass + Reject');
    setSaving(true);
    try {
      await saveSpotWash({ ...form, pcsPass: form.pcsPass || 0, pcsReject: form.pcsReject || 0 });
      message.success('Spot wash batch logged');
      onSaved();
    } catch { message.error('Failed to save batch'); } finally { setSaving(false); }
  };

  return (
    <Drawer title="Log Spot Wash Batch" open={open} onClose={onClose} size={520} destroyOnHidden
      footer={(
        <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
          <Button onClick={onClose}>Cancel</Button>
          <ActionButton action="save" text="Save Batch" loading={saving} onClick={handleSave} />
        </Space>
      )}>
      <Space size="middle" wrap style={{ marginBottom: 16 }}>
        <div>
          <FieldLabel>Order</FieldLabel>
          <FormSelect value={form.orderId} style={{ width: 220 }} placeholder="Order"
            options={orders.map((o) => ({ value: o.id, label: `${o.orderNo} · ${o.styleNo}` }))} onChange={(v) => patch({ orderId: v })} />
        </div>
        <div>
          <FieldLabel>Date</FieldLabel>
          <DatePicker format="DD-MMM-YYYY" allowClear={false} value={dayjs(form.date)} onChange={(d) => patch({ date: d.format('YYYY-MM-DD') })} />
        </div>
        <div>
          <FieldLabel>Stain Type</FieldLabel>
          <FormSelect value={form.stainType} style={{ width: 130 }} placeholder="Stain"
            options={STAIN_TYPES.map((s) => ({ value: s, label: s }))} onChange={(v) => patch({ stainType: v })} />
        </div>
        <div>
          <FieldLabel>Employee</FieldLabel>
          <FormSelect value={form.employeeId} style={{ width: 180 }} placeholder="Employee"
            options={employees.map((e) => ({ value: e.id, label: `${e.name} (${e.code})` }))} onChange={(v) => patch({ employeeId: v })} />
        </div>
      </Space>
      <Space size="middle" wrap>
        <div>
          <FieldLabel>Pieces In</FieldLabel>
          <InputNumber min={1} value={form.pcsIn} style={{ width: 110 }} onChange={(v) => patch({ pcsIn: v })} />
        </div>
        <div>
          <FieldLabel>Out — Pass</FieldLabel>
          <InputNumber min={0} value={form.pcsPass} style={{ width: 110 }} onChange={(v) => patch({ pcsPass: v })} />
        </div>
        <div>
          <FieldLabel>Out — Reject</FieldLabel>
          <InputNumber min={0} value={form.pcsReject} style={{ width: 110 }} onChange={(v) => patch({ pcsReject: v })} />
        </div>
      </Space>
      {unbalanced && (
        <Alert type="warning" showIcon style={{ marginTop: 16 }}
          title="Pieces In must equal Pass + Reject before saving (PRD 7.3)" />
      )}
    </Drawer>
  );
};

export default SpotWashDrawer;
