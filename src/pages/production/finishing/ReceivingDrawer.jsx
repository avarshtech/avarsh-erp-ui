import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Drawer, Space, InputNumber, Input, DatePicker, Table, Button, Alert } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { ActionButton } from '../../../components/buttons';
import { FormSelect } from '../../../components/form';
import { DEFECT_LIBRARY, DEFECT_SOURCES, RECEIVING_SHORTAGE_PCT } from '../../../utils/finishingConstants';
import { saveReceiving } from '../../../services/production/finishingService';

const FieldLabel = ({ children }) => (
  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{children}</div>
);

const emptyForm = { orderId: null, color: null, size: null, date: dayjs().format('YYYY-MM-DD'), receivingQty: null, bundleNo: '', sewingLine: 'Line-A', partsReplacements: [] };

/** PRD Module 1 — receiving entry with parts-replacement log (BR 4.3). */
const ReceivingDrawer = ({ open, orders, onClose, onSaved }) => {
  const { message } = App.useApp();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setForm(emptyForm); }, [open]);

  const order = useMemo(() => orders.find((o) => o.id === form.orderId), [orders, form.orderId]);
  const orderQty = order && form.size ? order.sizeQty[form.size] || 0 : 0;
  const patch = (p) => setForm((prev) => ({ ...prev, ...p }));
  const setPart = useCallback((idx, field, val) => {
    setForm((prev) => ({ ...prev, partsReplacements: prev.partsReplacements.map((x, i) => (i === idx ? { ...x, [field]: val } : x)) }));
  }, []);

  const partColumns = useMemo(() => [
    {
      title: 'Part Name', dataIndex: 'partName', width: 160,
      render: (v, _, idx) => (
        <Input size="small" value={v} placeholder="e.g. Left sleeve"
          onChange={(e) => setPart(idx, 'partName', e.target.value)} />
      ),
    },
    {
      title: 'Defect Reason', dataIndex: 'defectReason', width: 220,
      render: (v, _, idx) => (
        <FormSelect size="small" value={v} style={{ width: 205 }} placeholder="Defect code"
          options={DEFECT_LIBRARY.map((d) => ({ value: d.code, label: `${d.code} — ${d.name}` }))}
          onChange={(val) => setPart(idx, 'defectReason', val)} />
      ),
    },
    {
      title: 'Source', dataIndex: 'source', width: 130,
      render: (v, _, idx) => (
        <FormSelect size="small" value={v} style={{ width: 115 }} placeholder="Source"
          options={DEFECT_SOURCES.map((s) => ({ value: s, label: s }))}
          onChange={(val) => setPart(idx, 'source', val)} />
      ),
    },
    {
      title: '', key: 'del', width: 46, align: 'center',
      render: (_, __, idx) => (
        <Button size="small" type="text" danger icon={<DeleteOutlined />}
          onClick={() => setForm((prev) => ({ ...prev, partsReplacements: prev.partsReplacements.filter((_, i) => i !== idx) }))} />
      ),
    },
  ], [setPart]);

  const handleSave = async () => {
    if (!form.orderId || !form.color || !form.size || !form.receivingQty) return message.warning('Order, color, size and quantity are required');
    if (form.receivingQty > orderQty) return message.warning(`Receiving qty cannot exceed the ${orderQty} pcs ordered for size ${form.size}`);
    setSaving(true);
    try {
      const saved = await saveReceiving({ ...form, orderQty });
      message.success(`${saved.receivingNo} recorded${saved.status === 'SHORTAGE' ? ' — cumulative below ' + RECEIVING_SHORTAGE_PCT + '%' : ''}`);
      onSaved();
    } catch { message.error('Failed to save receiving'); } finally { setSaving(false); }
  };

  return (
    <Drawer title="Receive from Sewing" open={open} onClose={onClose} size={720} destroyOnHidden
      footer={(
        <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
          <Button onClick={onClose}>Cancel</Button>
          <ActionButton action="save" text="Record Receiving" loading={saving} onClick={handleSave} />
        </Space>
      )}>
      <Space size="middle" wrap style={{ marginBottom: 16 }}>
        <div>
          <FieldLabel>Order</FieldLabel>
          <FormSelect value={form.orderId} style={{ width: 230 }} placeholder="Order"
            options={orders.map((o) => ({ value: o.id, label: `${o.orderNo} · ${o.styleNo}` }))}
            onChange={(v) => patch({ orderId: v, color: orders.find((o) => o.id === v)?.color, size: null })} />
        </div>
        <div>
          <FieldLabel>Color</FieldLabel>
          <Input value={form.color} style={{ width: 130 }} readOnly />
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
      </Space>
      <Space size="middle" wrap style={{ marginBottom: 16 }}>
        <div>
          <FieldLabel>Order Qty (size)</FieldLabel>
          <InputNumber value={orderQty} style={{ width: 110 }} readOnly />
        </div>
        <div>
          <FieldLabel>Receiving Qty</FieldLabel>
          <InputNumber min={1} value={form.receivingQty} style={{ width: 110 }} onChange={(v) => patch({ receivingQty: v })} />
        </div>
        <div>
          <FieldLabel>Bundle No / Barcode</FieldLabel>
          <Input value={form.bundleNo} style={{ width: 140 }} placeholder="Optional" onChange={(e) => patch({ bundleNo: e.target.value })} />
        </div>
        <div>
          <FieldLabel>Sewing Line</FieldLabel>
          <Input value={form.sewingLine} style={{ width: 100 }} onChange={(e) => patch({ sewingLine: e.target.value })} />
        </div>
      </Space>
      {form.receivingQty > orderQty && orderQty > 0 && (
        <Alert type="error" showIcon style={{ marginBottom: 16 }}
          title={`Receiving qty exceeds the ${orderQty} pcs ordered for size ${form.size}`} />
      )}
      <Table
        title={() => (
          <Space style={{ justifyContent: 'space-between', width: '100%' }}>
            <strong>Parts Replacement Log</strong>
            <Button icon={<PlusOutlined />} size="small"
              onClick={() => patch({ partsReplacements: [...form.partsReplacements, { partName: '', defectReason: null, source: 'SEWING' }] })}>
              Add Part
            </Button>
          </Space>
        )}
        rowKey={(r) => form.partsReplacements.indexOf(r)} size="small" columns={partColumns} dataSource={form.partsReplacements} pagination={false}
        locale={{ emptyText: 'Log any damaged parts sent back for replacement (name, defect code, source)' }} />
    </Drawer>
  );
};

export default ReceivingDrawer;
