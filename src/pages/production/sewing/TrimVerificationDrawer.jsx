import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Drawer, Space, Table, Radio, Input, Button, Alert, DatePicker, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { ActionButton } from '../../../components/buttons';
import { FormSelect } from '../../../components/form';
import { CHECK_TYPES, BOM_ITEM_CATEGORIES } from '../../../utils/sewingConstants';
import { getBomItems, saveTrimCard } from '../../../services/production/sewingService';

const FieldLabel = ({ children }) => (
  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{children}</div>
);

/**
 * CR-SEW-005 — items auto-populate from the work order's BOM; binary
 * Correct/Incorrect per item; save requires explicit physical confirmation.
 */
const TrimVerificationDrawer = ({ open, record, orders, onClose, onSaved }) => {
  const { message, modal } = App.useApp();
  const [card, setCard] = useState(null);
  const [bomItems, setBomItems] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCard(record ? { ...record } : {
      orderId: orders[0]?.id, checkType: 'PILOT_RUN', date: dayjs().format('YYYY-MM-DD'),
      verifiedBy: '', items: null,
    });
  }, [open, record, orders]);

  useEffect(() => {
    if (!open || !card?.orderId) return;
    getBomItems(card.orderId).then((items) => {
      setBomItems(items);
      setCard((prev) => (prev.items ? prev : {
        ...prev, items: items.map((b) => ({ bomItemId: b.id, status: null, remarks: '' })),
      }));
    }).catch(() => message.error('Failed to load BOM items'));
  }, [open, card?.orderId, message]);

  const setItem = useCallback((idx, patch) => {
    setCard((prev) => ({ ...prev, items: prev.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));
  }, []);

  const summary = useMemo(() => {
    const items = card?.items || [];
    const correct = items.filter((i) => i.status === 'CORRECT').length;
    const incorrect = items.filter((i) => i.status === 'INCORRECT').length;
    return { total: items.length, correct, incorrect, pending: items.length - correct - incorrect };
  }, [card?.items]);

  const rows = useMemo(() => (card?.items || []).map((it, idx) => ({
    ...it, idx, bom: bomItems.find((b) => b.id === it.bomItemId) || it.manual || {},
  })), [card?.items, bomItems]);

  const columns = useMemo(() => [
    { title: 'Category', key: 'cat', width: 140, render: (_, r) => <Tag>{r.bom.category || '—'}</Tag> },
    {
      title: 'Item (from BOM)', key: 'name', width: 220,
      render: (_, r) => (r.bom.id ? <strong>{r.bom.name}</strong> : (
        <Input size="small" placeholder="Manual item name" value={r.manual?.name}
          onChange={(e) => setItem(r.idx, { manual: { ...r.manual, name: e.target.value, category: r.manual?.category || 'Trims & Accessories' } })} />
      )),
    },
    { title: 'Specification', key: 'spec', width: 200, ellipsis: true, render: (_, r) => r.bom.spec || '—' },
    { title: 'Qty', key: 'qty', width: 90, render: (_, r) => r.bom.qty || '—' },
    { title: 'Supplier', key: 'sup', width: 120, ellipsis: true, render: (_, r) => r.bom.supplier || '—' },
    {
      title: 'Verification', key: 'status', width: 190, align: 'center',
      render: (_, r) => (
        <Radio.Group size="small" value={r.status} buttonStyle="solid"
          onChange={(e) => setItem(r.idx, { status: e.target.value })}>
          <Radio.Button value="CORRECT">Correct</Radio.Button>
          <Radio.Button value="INCORRECT">Incorrect</Radio.Button>
        </Radio.Group>
      ),
    },
    {
      title: 'Remarks', key: 'remarks', width: 220,
      render: (_, r) => (
        <Input size="small" value={r.remarks} disabled={r.status !== 'INCORRECT'}
          placeholder={r.status === 'INCORRECT' ? 'What is wrong?' : '—'}
          onChange={(e) => setItem(r.idx, { remarks: e.target.value })} />
      ),
    },
  ], [setItem]);

  const handleSave = () => {
    if (summary.pending > 0) return message.warning(`${summary.pending} item(s) still unverified — mark each Correct or Incorrect`);
    if ((card.items || []).some((it) => it.status === 'INCORRECT' && !it.remarks)) return message.warning('Add remarks for every Incorrect item');
    modal.confirm({
      title: 'Physically verified against trim card?',
      content: 'Confirm only after physically checking every trim on the floor. "No" returns to the form without saving.',
      okText: 'Yes', cancelText: 'No',
      onOk: async () => {
        setSaving(true);
        try {
          await saveTrimCard({ ...card, physicallyVerified: true });
          message.success('Verification card saved — VERIFIED');
          onSaved();
        } catch { message.error('Failed to save verification card'); } finally { setSaving(false); }
      },
    });
  };

  if (!card) return null;

  return (
    <Drawer title={record ? `Trim Verification — ${record.cardNo}` : 'New Trim Verification Card'} open={open}
      onClose={onClose} size={1100} destroyOnHidden
      footer={(
        <Space style={{ justifyContent: 'space-between', width: '100%' }}>
          <Space size={6}>
            <Tag>Total {summary.total}</Tag>
            <Tag color="green">Correct {summary.correct}</Tag>
            <Tag color="red">Incorrect {summary.incorrect}</Tag>
            <Tag color="orange">Pending {summary.pending}</Tag>
          </Space>
          <Space>
            <Button onClick={onClose}>Cancel</Button>
            <ActionButton action="save" text="Save Card" loading={saving} onClick={handleSave} />
          </Space>
        </Space>
      )}>
      <Space size="middle" wrap style={{ marginBottom: 12 }}>
        <div>
          <FieldLabel>Work Order</FieldLabel>
          <FormSelect value={card.orderId} style={{ width: 230 }} disabled={Boolean(record)}
            options={orders.map((o) => ({ value: o.id, label: `${o.orderNo} · ${o.styleNo}` }))}
            onChange={(v) => setCard((prev) => ({ ...prev, orderId: v, items: null }))} />
        </div>
        <div>
          <FieldLabel>Check Type</FieldLabel>
          <FormSelect value={card.checkType} style={{ width: 130 }}
            options={CHECK_TYPES.map((t) => ({ value: t, label: t.replace('_', ' ') }))}
            onChange={(v) => setCard((prev) => ({ ...prev, checkType: v }))} />
        </div>
        <div>
          <FieldLabel>Date</FieldLabel>
          <DatePicker format="DD-MMM-YYYY" allowClear={false} value={dayjs(card.date)}
            onChange={(d) => setCard((prev) => ({ ...prev, date: d.format('YYYY-MM-DD') }))} />
        </div>
        <div>
          <FieldLabel>Verified By</FieldLabel>
          <Input value={card.verifiedBy} style={{ width: 180 }} placeholder="QC name"
            onChange={(e) => setCard((prev) => ({ ...prev, verifiedBy: e.target.value }))} />
        </div>
      </Space>

      {bomItems.length > 0 && bomItems.length < 3 && (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }}
          title={`Only ${bomItems.length} BOM item(s) found for this order — the BOM may be incomplete. Add missing items manually below.`} />
      )}

      {BOM_ITEM_CATEGORIES.map((cat) => {
        const catRows = rows.filter((r) => (r.bom.category || 'Trims & Accessories') === cat);
        if (!catRows.length) return null;
        return (
          <div key={cat} style={{ marginBottom: 14 }}>
            <strong style={{ display: 'block', marginBottom: 6 }}>{cat}</strong>
            <Table rowKey={(r) => r.idx} size="small" columns={columns} dataSource={catRows}
              pagination={false} scroll={{ x: 1050 }} showHeader={cat === BOM_ITEM_CATEGORIES.find((c) => rows.some((r) => (r.bom.category || 'Trims & Accessories') === c))} />
          </div>
        );
      })}
      <Button icon={<PlusOutlined />} size="small"
        onClick={() => setCard((prev) => ({ ...prev, items: [...(prev.items || []), { bomItemId: null, status: null, remarks: '', manual: { name: '', category: 'Trims & Accessories' } }] }))}>
        Add Item Manually (BOM fallback)
      </Button>
    </Drawer>
  );
};

export default TrimVerificationDrawer;
