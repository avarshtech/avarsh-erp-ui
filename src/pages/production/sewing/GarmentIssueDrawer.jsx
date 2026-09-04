import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Drawer, Button, Space, Table, InputNumber, Alert, Input } from 'antd';
import dayjs from 'dayjs';
import { FormSelect } from '../../../components/form';
import useModuleSelection from '../../../hooks/useModuleSelection';
import { saveGarmentIssue, getIssueOpeningLines } from '../../../services/production/sewingService';

/** PRD 4.4 — size-wise issue with Order / Prev Issued / Current / Total / Balance columns. */
const GarmentIssueDrawer = ({ open, orders, onClose, onSaved }) => {
  const { message } = App.useApp();
  const { selectOrder, defaultOrderId } = useModuleSelection('sewing');
  const [orderId, setOrderId] = useState(null);
  const [lines, setLines] = useState([]);
  const [issuedBy, setIssuedBy] = useState('');
  const [receivedBy, setReceivedBy] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setOrderId(defaultOrderId(orders)); }, [open, orders, defaultOrderId]);

  useEffect(() => {
    if (!open || !orderId) { setLines([]); return; }
    getIssueOpeningLines(orderId)
      .then(setLines)
      .catch(() => message.error('Failed to load the size-wise balances'));
  }, [open, orderId, message]);

  const setQty = useCallback((idx, val) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, currentQty: val } : l)));
  }, []);

  const overIssued = useMemo(() => lines.filter((l) => l.orderQty - l.prevIssued - (l.currentQty || 0) < 0), [lines]);

  const columns = useMemo(() => [
    { title: 'Size', dataIndex: 'size', width: 80, align: 'center' },
    { title: 'Order Qty', dataIndex: 'orderQty', width: 100, align: 'right' },
    { title: 'Prev Issued', dataIndex: 'prevIssued', width: 100, align: 'right' },
    {
      title: 'Current Issue', dataIndex: 'currentQty', width: 120, align: 'center',
      render: (v, _, idx) => <InputNumber size="small" min={0} value={v} style={{ width: 95 }} onChange={(val) => setQty(idx, val)} />,
    },
    { title: 'Total Issued', key: 'total', width: 100, align: 'right', render: (_, r) => <strong>{r.prevIssued + (r.currentQty || 0)}</strong> },
    {
      title: 'Balance', key: 'bal', width: 100, align: 'right',
      render: (_, r) => {
        const bal = r.orderQty - r.prevIssued - (r.currentQty || 0);
        return <strong style={{ color: bal < 0 ? 'var(--error-color)' : bal === 0 ? 'var(--success-color)' : undefined }}>{bal}</strong>;
      },
    },
  ], [setQty]);

  const total = lines.reduce((s, l) => s + (l.currentQty || 0), 0);

  const handleSave = async () => {
    if (!orderId) return message.warning('Select the order');
    const entered = lines.filter((l) => (l.currentQty || 0) > 0);
    if (!entered.length) return message.warning('Enter a quantity for at least one size');
    setSaving(true);
    try {
      const saved = await saveGarmentIssue({
        orderId,
        issueDate: dayjs().format('YYYY-MM-DD'),
        issuedBy: issuedBy || null,
        receivedBy: receivedBy || null,
        lines: entered.map((l) => ({ size: l.size, currentQty: l.currentQty })),
      });
      message.success(`${saved.issueNo}: ${saved.totalQty} pcs issued${
        saved.overIssuedSizes?.length ? ' (over-issue — PM approval required)' : ''}`);
      setLines([]); setOrderId(null);
      onSaved();
    } catch (e) {
      message.error(e?.response?.data?.message || 'Failed to save issue');
    } finally { setSaving(false); }
  };

  return (
    <Drawer
      title="Garment Issue to Finishing"
      size={640}
      open={open}
      onClose={onClose}
      destroyOnHidden
      footer={(
        <Space style={{ float: 'right' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Issuing: <strong>{total}</strong> pcs</span>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" loading={saving} onClick={handleSave}>Issue</Button>
        </Space>
      )}
    >
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Order</div>
        <Space size="middle" wrap>
          <FormSelect value={orderId} style={{ width: 320 }} placeholder="Select order"
            options={orders.map((o) => ({ value: o.id, label: `${o.orderNo} · ${o.styleNo} · ${o.color || ''}` }))}
            onChange={(v) => { selectOrder(orders.find((o) => o.id === v)); setOrderId(v); }} />
          <Input style={{ width: 170 }} placeholder="Issued by" value={issuedBy}
            onChange={(e) => setIssuedBy(e.target.value)} />
          <Input style={{ width: 170 }} placeholder="Received by" value={receivedBy}
            onChange={(e) => setReceivedBy(e.target.value)} />
        </Space>
      </div>
      {overIssued.length > 0 && (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }}
          title={`Over-issuance on size(s) ${overIssued.map((l) => l.size).join(', ')} — requires Production Manager approval`} />
      )}
      <Table rowKey="size" size="small" columns={columns} dataSource={lines} pagination={false}
        locale={{ emptyText: 'Select an order to load its size-wise balances' }} />
    </Drawer>
  );
};

export default GarmentIssueDrawer;
