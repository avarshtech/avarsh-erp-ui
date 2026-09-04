import { useEffect, useState } from 'react';
import { App, Drawer, Space, Input, InputNumber, DatePicker, Button, Checkbox, Alert } from 'antd';
import dayjs from 'dayjs';
import { ActionButton } from '../../../components/buttons';
import { FormSelect } from '../../../components/form';
import { SHADE_BANDS } from '../../../utils/finishingConstants';
import useModuleSelection from '../../../hooks/useModuleSelection';
import { saveShadeGroup } from '../../../services/production/finishingService';

const FieldLabel = ({ children }) => (
  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{children}</div>
);

/**
 * Records one band of a fabric lot after the light-box check. The band is the
 * whole point of the record, so the light box is asked about explicitly — a
 * band called by eye under shop lighting is the reason cartons get rejected
 * at the buyer end.
 */
const ShadeGroupDrawer = ({ open, orders, employees, onClose, onSaved }) => {
  const { message } = App.useApp();
  const { selectOrder, defaultOrderId } = useModuleSelection('finishing');
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const orderId = defaultOrderId(orders);
    setForm({
      orderId,
      color: orders.find((o) => o.id === orderId)?.color,
      date: dayjs().format('YYYY-MM-DD'),
      fabricLot: '',
      shadeBand: null,
      qty: null,
      lightBox: true,
      inspectorId: null,
    });
  }, [open, orders, defaultOrderId]);

  const patch = (p) => setForm((prev) => ({ ...prev, ...p }));

  const handleSave = async () => {
    if (!form.orderId || !form.fabricLot || !form.shadeBand || !form.qty) {
      return message.warning('Order, fabric lot, shade band and quantity are required');
    }
    if (!form.inspectorId) return message.warning('Record who called the shade band');
    setSaving(true);
    try {
      await saveShadeGroup(form);
      message.success(`Lot ${form.fabricLot} segregated into band ${form.shadeBand}`);
      onSaved();
    } catch { message.error('Failed to save the shade group'); } finally { setSaving(false); }
  };

  if (!form) return null;

  return (
    <Drawer title="Add Shade Group" open={open} onClose={onClose} width={620} destroyOnHidden
      footer={(
        <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
          <Button onClick={onClose}>Cancel</Button>
          <ActionButton action="save" text="Save Shade Group" loading={saving} onClick={handleSave} />
        </Space>
      )}>
      <Space size="middle" wrap style={{ marginBottom: 16 }}>
        <div>
          <FieldLabel>Order</FieldLabel>
          <FormSelect value={form.orderId} style={{ width: 240 }}
            options={orders.map((o) => ({ value: o.id, label: `${o.orderNo} · ${o.styleNo}` }))}
            onChange={(v) => {
              const o = orders.find((x) => x.id === v);
              selectOrder(o);
              patch({ orderId: v, color: o?.color });
            }} />
        </div>
        <div>
          <FieldLabel>Date</FieldLabel>
          <DatePicker format="DD-MMM-YYYY" allowClear={false} value={dayjs(form.date)}
            onChange={(d) => patch({ date: d.format('YYYY-MM-DD') })} />
        </div>
        <div>
          <FieldLabel>Colour</FieldLabel>
          <Input value={form.color} style={{ width: 150 }} onChange={(e) => patch({ color: e.target.value })} />
        </div>
      </Space>

      <Space size="middle" wrap style={{ marginBottom: 16 }}>
        <div>
          <FieldLabel>Fabric Lot</FieldLabel>
          <Input value={form.fabricLot} style={{ width: 170 }} placeholder="FL-2601-A"
            onChange={(e) => patch({ fabricLot: e.target.value })} />
        </div>
        <div>
          <FieldLabel>Shade Band</FieldLabel>
          <FormSelect value={form.shadeBand} style={{ width: 190 }} placeholder="Band"
            options={SHADE_BANDS.map((b) => ({ value: b.band, label: `${b.band} — ${b.label}` }))}
            onChange={(v) => patch({ shadeBand: v })} />
        </div>
        <div>
          <FieldLabel>Qty in Band</FieldLabel>
          <InputNumber min={1} value={form.qty} style={{ width: 120 }} onChange={(v) => patch({ qty: v })} />
        </div>
        <div>
          <FieldLabel>Inspector</FieldLabel>
          <FormSelect value={form.inspectorId} style={{ width: 190 }} placeholder="Inspector"
            options={employees.map((e) => ({ value: e.id, label: `${e.name} (${e.code})` }))}
            onChange={(v) => patch({ inspectorId: v })} />
        </div>
      </Space>

      <Checkbox checked={form.lightBox} onChange={(e) => patch({ lightBox: e.target.checked })}>
        Band called under the D65 light box
      </Checkbox>

      {!form.lightBox && (
        <Alert type="warning" showIcon style={{ marginTop: 16 }}
          title="Band called without the D65 light box"
          description="Shop lighting shifts perceived shade. The record saves, but flag this lot for a re-check before packing." />
      )}
    </Drawer>
  );
};

export default ShadeGroupDrawer;
