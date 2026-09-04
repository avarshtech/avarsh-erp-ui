import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Drawer, Space, Table, Radio, Input, Button, Alert, DatePicker, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { ActionButton } from '../../../components/buttons';
import { FormSelect } from '../../../components/form';
import useSewingMasters from '../../../hooks/useSewingMasters';
import useModuleSelection from '../../../hooks/useModuleSelection';
import { getBomItems, saveTrimCard } from '../../../services/production/sewingService';

const FieldLabel = ({ children }) => (
  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{children}</div>
);

const blankItem = () => ({ bomLineId: null, name: '', category: 'Trims & Accessories', status: null, remarks: '' });

/**
 * CR-SEW-005 — items come from the order's BOM; binary Correct/Incorrect per
 * item; the card cannot be filed until the QC confirms a physical check. The
 * server enforces all three, so a card in the database always means something.
 */
const TrimVerificationDrawer = ({ open, record, orders, onClose, onSaved }) => {
  const { message, modal } = App.useApp();
  const { options } = useSewingMasters();
  const { selectOrder, defaultOrderId } = useModuleSelection('sewing');
  const [card, setCard] = useState(null);
  const [bomLoading, setBomLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const checkTypeOptions = options('CHECK_TYPE');

  useEffect(() => {
    if (!open) return;
    setCard(record ? { ...record } : {
      orderId: defaultOrderId(orders),
      checkType: null,
      cardDate: dayjs().format('YYYY-MM-DD'),
      verifiedBy: '',
      items: null,
    });
  }, [open, record, orders, defaultOrderId]);

  // Default the check type once the master has loaded, rather than assuming a code.
  useEffect(() => {
    if (!card || card.checkType || !checkTypeOptions.length) return;
    setCard((prev) => ({ ...prev, checkType: checkTypeOptions[0].value }));
  }, [card, checkTypeOptions]);

  useEffect(() => {
    if (!open || !card?.orderId || card.items) return;
    setBomLoading(true);
    getBomItems(card.orderId)
      .then((items) => setCard((prev) => ({
        ...prev,
        items: items.map((b) => ({ ...b, status: null, remarks: '' })),
      })))
      .catch(() => message.error('Failed to load the BOM for this order'))
      .finally(() => setBomLoading(false));
  }, [open, card?.orderId, card?.items, message]);

  const setItem = useCallback((idx, patch) => {
    setCard((prev) => ({ ...prev, items: prev.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));
  }, []);

  const items = useMemo(() => card?.items || [], [card?.items]);

  const summary = useMemo(() => {
    const correct = items.filter((i) => i.status === 'CORRECT').length;
    const incorrect = items.filter((i) => i.status === 'INCORRECT').length;
    return { total: items.length, correct, incorrect, pending: items.length - correct - incorrect };
  }, [items]);

  const categories = useMemo(
    () => [...new Set(items.map((i) => i.category || 'Trims & Accessories'))],
    [items],
  );

  const columns = useMemo(() => [
    { title: 'Category', dataIndex: 'category', width: 150, render: (v) => <Tag>{v || '—'}</Tag> },
    {
      title: 'Item (from BOM)', dataIndex: 'name', width: 220,
      render: (v, r) => (r.bomLineId
        ? <strong>{v}</strong>
        : (
          <Input size="small" placeholder="Manual item name" value={v}
            onChange={(e) => setItem(r.idx, { name: e.target.value })} />
        )),
    },
    { title: 'Specification', dataIndex: 'specification', width: 210, ellipsis: true, render: (v) => v || '—' },
    { title: 'Qty', dataIndex: 'qty', width: 110, render: (v) => v || '—' },
    {
      title: 'Verification', dataIndex: 'status', width: 190, align: 'center',
      render: (v, r) => (
        <Radio.Group size="small" value={v} buttonStyle="solid"
          onChange={(e) => setItem(r.idx, { status: e.target.value })}>
          <Radio.Button value="CORRECT">Correct</Radio.Button>
          <Radio.Button value="INCORRECT">Incorrect</Radio.Button>
        </Radio.Group>
      ),
    },
    {
      title: 'Remarks', dataIndex: 'remarks', width: 220,
      render: (v, r) => (
        <Input size="small" value={v} disabled={r.status !== 'INCORRECT'}
          placeholder={r.status === 'INCORRECT' ? 'What is wrong?' : '—'}
          onChange={(e) => setItem(r.idx, { remarks: e.target.value })} />
      ),
    },
  ], [setItem]);

  const handleSave = () => {
    if (!summary.total) return message.warning('Add at least one item to verify');
    if (summary.pending > 0) return message.warning(`${summary.pending} item(s) still unverified — mark each Correct or Incorrect`);
    if (items.some((it) => it.status === 'INCORRECT' && !it.remarks)) return message.warning('Add remarks for every Incorrect item');
    modal.confirm({
      title: 'Physically verified against trim card?',
      content: 'Confirm only after physically checking every trim on the floor. "No" returns to the form without saving.',
      okText: 'Yes',
      cancelText: 'No',
      onOk: async () => {
        setSaving(true);
        try {
          const saved = await saveTrimCard({ ...card, physicallyVerified: true });
          message.success(saved.incorrectItems
            ? `${saved.cardNo} saved — ${saved.incorrectItems} item(s) incorrect`
            : `${saved.cardNo} saved — all items verified`);
          onSaved();
        } catch (e) {
          message.error(e?.response?.data?.message || 'Failed to save the verification card');
        } finally { setSaving(false); }
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
          <FieldLabel>Order</FieldLabel>
          <FormSelect value={card.orderId} style={{ width: 240 }} disabled={Boolean(record)}
            options={orders.map((o) => ({ value: o.id, label: `${o.orderNo} · ${o.styleNo}` }))}
            onChange={(v) => {
              selectOrder(orders.find((o) => o.id === v));
              setCard((prev) => ({ ...prev, orderId: v, items: null }));
            }} />
        </div>
        <div>
          <FieldLabel>Check Type</FieldLabel>
          <FormSelect value={card.checkType} style={{ width: 150 }} options={checkTypeOptions}
            onChange={(v) => setCard((prev) => ({ ...prev, checkType: v }))} />
        </div>
        <div>
          <FieldLabel>Date</FieldLabel>
          <DatePicker format="DD-MMM-YYYY" allowClear={false} value={dayjs(card.cardDate)}
            onChange={(d) => setCard((prev) => ({ ...prev, cardDate: d.format('YYYY-MM-DD') }))} />
        </div>
        <div>
          <FieldLabel>Verified By</FieldLabel>
          <Input value={card.verifiedBy} style={{ width: 180 }} placeholder="QC name"
            onChange={(e) => setCard((prev) => ({ ...prev, verifiedBy: e.target.value }))} />
        </div>
      </Space>

      {!bomLoading && summary.total === 0 && (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }}
          title="No BOM lines found for this order"
          description="Nothing was specified for this style, or the BOM has not been raised yet. Add the trims manually below." />
      )}

      {categories.map((cat, catIndex) => {
        const catRows = items
          .map((it, idx) => ({ ...it, idx }))
          .filter((r) => (r.category || 'Trims & Accessories') === cat);
        return (
          <div key={cat} style={{ marginBottom: 14 }}>
            <strong style={{ display: 'block', marginBottom: 6 }}>{cat}</strong>
            <Table rowKey="idx" size="small" columns={columns} dataSource={catRows} loading={bomLoading}
              pagination={false} scroll={{ x: 1050 }} showHeader={catIndex === 0} />
          </div>
        );
      })}

      <Button icon={<PlusOutlined />} size="small"
        onClick={() => setCard((prev) => ({ ...prev, items: [...(prev.items || []), blankItem()] }))}>
        Add Item Manually (BOM fallback)
      </Button>
    </Drawer>
  );
};

export default TrimVerificationDrawer;
