import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Drawer, Space, InputNumber, Input, DatePicker, Table, Button, Tag, Alert } from 'antd';
import dayjs from 'dayjs';
import { ActionButton } from '../../../components/buttons';
import { FormSelect } from '../../../components/form';
import useModuleSelection from '../../../hooks/useModuleSelection';
import {
  saveReceiving, listGarmentIssues, recordGarmentIssueReceipt,
} from '../../../services/production/finishingService';

const FieldLabel = ({ children }) => (
  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{children}</div>
);

const diffTag = (line) => {
  if (line.receivedQty == null) return <span style={{ color: 'var(--text-secondary)' }}>—</span>;
  const short = (line.remainingQty || 0) - (line.receivedQty || 0);
  if (short > 0) return <Tag color="red">{short} short</Tag>;
  return <Tag color="green">0 ✓</Tag>;
};

/**
 * Receiving from sewing. The issue says what was sent; this records what
 * arrived and writes it back onto the sewing note, so both floors read the
 * same number.
 *
 * A note received in parts shows what earlier entries already took, so the
 * second lorry is booked against the remainder rather than the whole note; a
 * note that is fully in is not offered again at all.
 */
const ReceivingDrawer = ({ open, orders, onClose, onSaved }) => {
  const { message } = App.useApp();
  const { selectOrder, defaultOrderId } = useModuleSelection('finishing');
  const [form, setForm] = useState(null);
  const [issues, setIssues] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const orderId = defaultOrderId(orders);
    setForm({
      orderId,
      color: orders.find((o) => o.id === orderId)?.color,
      issueId: null,
      issueNo: null,
      trimmingPoNo: '',
      checkingPoNo: '',
      date: dayjs().format('YYYY-MM-DD'),
      lines: [],
    });
    listGarmentIssues()
      .then(setIssues)
      .catch(() => message.error('Failed to load sewing garment issues'));
  }, [open, orders, defaultOrderId, message]);

  /**
   * Only notes with something still to come. A fully received note is left off
   * the list entirely — that is the duplicate guard, ahead of the server's.
   */
  const orderIssues = useMemo(
    () => issues.filter((i) => i.orderId === form?.orderId
      && i.status !== 'CANCELLED'
      && !i.fullyReceived),
    [issues, form?.orderId],
  );

  const alreadyReceived = useMemo(
    () => issues.filter((i) => i.orderId === form?.orderId && i.fullyReceived).length,
    [issues, form?.orderId],
  );

  const patch = useCallback((p) => setForm((prev) => ({ ...prev, ...p })), []);

  const selectIssue = useCallback((issueId) => {
    const issue = orderIssues.find((i) => i.id === issueId);
    patch({
      issueId,
      issueNo: issue?.issueNo ?? null,
      // Remaining, not the whole note: an issue split across two lorries must
      // not offer the full quantity a second time.
      lines: (issue?.lines || []).map((l) => ({
        size: l.size,
        issuedQty: l.currentQty,
        priorReceived: l.receivedQty ?? 0,
        remainingQty: l.remainingQty ?? l.currentQty,
        receivedQty: l.remainingQty ?? l.currentQty,
      })),
    });
  }, [orderIssues, patch]);

  const setLine = useCallback((idx, receivedQty) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((l, i) => (i === idx ? { ...l, receivedQty } : l)),
    }));
  }, []);

  const columns = useMemo(() => [
    { title: 'Size', dataIndex: 'size', width: 70, align: 'center', render: (v) => <strong>{v}</strong> },
    { title: 'Issued', dataIndex: 'issuedQty', width: 90, align: 'right' },
    {
      title: 'Already Received', dataIndex: 'priorReceived', width: 145, align: 'right',
      render: (v) => (v ? <Tag color="blue">{v}</Tag> : '—'),
    },
    { title: 'Remaining', dataIndex: 'remainingQty', width: 100, align: 'right', render: (v) => <strong>{v}</strong> },
    {
      title: 'Receiving Now', dataIndex: 'receivedQty', width: 140, align: 'center',
      render: (v, r, idx) => (
        <InputNumber size="small" min={0} max={r.remainingQty} value={v} style={{ width: 100 }}
          onChange={(val) => setLine(idx, val)} />
      ),
    },
    { title: 'Shortage', key: 'diff', width: 110, align: 'center', render: (_, r) => diffTag(r) },
  ], [setLine]);

  const handleSave = async () => {
    if (!form.issueId) return message.warning('Select the sewing Issue # being received');
    if (form.lines.some((l) => l.receivedQty == null)) return message.warning('Enter received qty for every size');
    if (!form.lines.some((l) => (l.receivedQty || 0) > 0)) return message.warning('Nothing is being received');

    setSaving(true);
    try {
      // Sewing first: it owns the issue, and its guards are the authority on
      // whether this receipt is allowed at all.
      const issue = await recordGarmentIssueReceipt(form.issueId, form.lines.map((l) => ({
        size: l.size,
        receivedQty: (l.priorReceived || 0) + (l.receivedQty || 0),
      })));

      const saved = await saveReceiving({
        ...form,
        lines: form.lines.map(({ size, issuedQty, receivedQty }) => ({ size, issuedQty, receivedQty })),
      });
      message.success(`${saved.receivingNo} recorded — sewing shows ${issue.totalReceived} of ${issue.totalQty} received`);
      onSaved();
    } catch (e) {
      message.error(e?.response?.data?.message || 'Failed to save receiving');
    } finally { setSaving(false); }
  };

  if (!form) return null;

  return (
    <Drawer title="Receive from Sewing" open={open} onClose={onClose} width={900} destroyOnHidden
      footer={(
        <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
          <Button onClick={onClose}>Cancel</Button>
          <ActionButton action="save" text="Record Receiving" loading={saving} onClick={handleSave} />
        </Space>
      )}>
      <Space size="middle" wrap style={{ marginBottom: 16 }}>
        <div>
          <FieldLabel>Order</FieldLabel>
          <FormSelect value={form.orderId} style={{ width: 240 }}
            options={orders.map((o) => ({ value: o.id, label: `${o.orderNo} · ${o.styleNo}` }))}
            onChange={(v) => {
              const order = orders.find((o) => o.id === v);
              selectOrder(order);
              patch({ orderId: v, color: order?.color, issueId: null, issueNo: null, lines: [] });
            }} />
        </div>
        <div>
          <FieldLabel>Issue # (from Sewing)</FieldLabel>
          <FormSelect value={form.issueId} style={{ width: 250 }} placeholder="Select issue"
            options={orderIssues.map((i) => ({
              value: i.id,
              label: `${i.issueNo} · ${i.remainingQty} of ${i.totalQty} to come`,
            }))}
            onChange={selectIssue} />
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

      {orderIssues.length === 0 && (
        <Alert type="info" showIcon style={{ marginBottom: 12 }}
          title="Nothing left to receive on this order"
          description={alreadyReceived
            ? `All ${alreadyReceived} garment issue(s) for this order are fully received. Sewing has to send another note before finishing can take more in.`
            : 'Sewing has not issued any garments against this order yet.'} />
      )}

      <Table rowKey="size" size="small" columns={columns} dataSource={form.lines} pagination={false}
        locale={{ emptyText: 'Select an Issue # — the outstanding quantities load size-wise' }}
        footer={() => (
          <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
            Receiving is capped at what is still outstanding, and posts straight back onto the sewing issue.
          </span>
        )} />
    </Drawer>
  );
};

export default ReceivingDrawer;
