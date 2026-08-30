import { useEffect, useMemo, useState } from 'react';
import { App, Drawer, Space, InputNumber, Input, DatePicker, Table, Button, Tag } from 'antd';
import dayjs from 'dayjs';
import { ActionButton } from '../../../components/buttons';
import { FormSelect } from '../../../components/form';
import { saveReceiving, listGarmentIssues } from '../../../services/production/finishingService';

const FieldLabel = ({ children }) => (
  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{children}</div>
);

const diffTag = (line) => {
  if (line.receivedQty == null) return <span style={{ color: 'var(--text-secondary)' }}>—</span>;
  const diff = (line.receivedQty || 0) - (line.issuedQty || 0);
  if (diff < 0) return <Tag color="red">{diff} short</Tag>;
  if (diff > 0) return <Tag color="gold">+{diff} excess</Tag>;
  return <Tag color="green">0 ✓</Tag>;
};

/**
 * Rev — mirrors Sewing's "Garment Issue to Finishing": pick the Issue #, the
 * issued qty shows size-wise, received qty is entered manually and the
 * shortage/excess captures automatically (red / yellow / green).
 */
const ReceivingDrawer = ({ open, orders, onClose, onSaved }) => {
  const { message } = App.useApp();
  const [form, setForm] = useState(null);
  const [issues, setIssues] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({ orderId: orders[0]?.id, color: orders[0]?.color, issueNo: null, trimmingPoNo: '', checkingPoNo: '', date: dayjs().format('YYYY-MM-DD'), lines: [] });
    listGarmentIssues().then(setIssues).catch(() => message.error('Failed to load sewing garment issues'));
  }, [open, orders, message]);

  const orderIssues = useMemo(() => issues.filter((i) => i.orderId === form?.orderId), [issues, form?.orderId]);
  const patch = (p) => setForm((prev) => ({ ...prev, ...p }));

  const selectIssue = (issueNo) => {
    const issue = orderIssues.find((i) => i.issueNo === issueNo);
    patch({
      issueNo,
      lines: (issue?.lines || []).map((l) => ({ size: l.size, issuedQty: l.currentQty, receivedQty: null })),
    });
  };

  const columns = useMemo(() => [
    { title: 'Size', dataIndex: 'size', width: 80, align: 'center', render: (v) => <strong>{v}</strong> },
    { title: 'Qty Issued (from issue doc)', dataIndex: 'issuedQty', width: 170, align: 'right' },
    {
      title: 'Qty Received (manual)', dataIndex: 'receivedQty', width: 170, align: 'center',
      render: (v, _, idx) => (
        <InputNumber size="small" min={0} value={v} style={{ width: 100 }}
          onChange={(val) => setForm((prev) => ({ ...prev, lines: prev.lines.map((l, i) => (i === idx ? { ...l, receivedQty: val } : l)) }))} />
      ),
    },
    { title: 'Shortage / Excess', key: 'diff', width: 140, align: 'center', render: (_, r) => diffTag(r) },
  ], []);

  const handleSave = async () => {
    if (!form.issueNo) return message.warning('Select the sewing Issue # being received');
    if (form.lines.some((l) => l.receivedQty == null)) return message.warning('Enter received qty for every size');
    setSaving(true);
    try {
      const saved = await saveReceiving(form);
      message.success(`${saved.receivingNo} recorded — ${saved.status === 'SHORTAGE' ? 'shortage flagged' : saved.status === 'EXCESS' ? 'excess flagged' : 'quantities match'}`);
      onSaved();
    } catch { message.error('Failed to save receiving'); } finally { setSaving(false); }
  };

  if (!form) return null;

  return (
    <Drawer title="Receive from Sewing" open={open} onClose={onClose} size={640} destroyOnHidden
      footer={(
        <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
          <Button onClick={onClose}>Cancel</Button>
          <ActionButton action="save" text="Record Receiving" loading={saving} onClick={handleSave} />
        </Space>
      )}>
      <Space size="middle" wrap style={{ marginBottom: 16 }}>
        <div>
          <FieldLabel>Order</FieldLabel>
          <FormSelect value={form.orderId} style={{ width: 220 }}
            options={orders.map((o) => ({ value: o.id, label: `${o.orderNo} · ${o.styleNo}` }))}
            onChange={(v) => patch({ orderId: v, color: orders.find((o) => o.id === v)?.color, issueNo: null, lines: [] })} />
        </div>
        <div>
          <FieldLabel>Issue # (from Sewing)</FieldLabel>
          <FormSelect value={form.issueNo} style={{ width: 190 }} placeholder="Select issue"
            options={orderIssues.map((i) => ({ value: i.issueNo, label: i.issueNo }))} onChange={selectIssue} />
        </div>
        <div>
          <FieldLabel>Trimming PO #</FieldLabel>
          <Input value={form.trimmingPoNo} style={{ width: 150 }} placeholder="TPO/…" onChange={(e) => patch({ trimmingPoNo: e.target.value })} />
        </div>
        <div>
          <FieldLabel>Checking PO #</FieldLabel>
          <Input value={form.checkingPoNo} style={{ width: 150 }} placeholder="KPO/…" onChange={(e) => patch({ checkingPoNo: e.target.value })} />
        </div>
        <div>
          <FieldLabel>Date</FieldLabel>
          <DatePicker format="DD-MMM-YYYY" allowClear={false} value={dayjs(form.date)} onChange={(d) => patch({ date: d.format('YYYY-MM-DD') })} />
        </div>
      </Space>
      <Table rowKey="size" size="small" columns={columns} dataSource={form.lines} pagination={false}
        locale={{ emptyText: 'Select an Issue # — issued quantities load size-wise' }}
        footer={() => (
          <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
            Shortage shows red, excess yellow, exact receipt green — captured automatically per size.
          </span>
        )} />
    </Drawer>
  );
};

export default ReceivingDrawer;
