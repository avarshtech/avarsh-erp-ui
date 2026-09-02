import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Drawer, Button, Space, Table, InputNumber, Input } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { FormSelect } from '../../../components/form';
import useSewingMasters from '../../../hooks/useSewingMasters';
import { getActiveParts } from '../../../services/master/partsService';
import { saveReplacement } from '../../../services/production/sewingService';

const blankPart = () => ({ size: null, serialNo: '', partId: null, reason: null, pieces: null });

/** PRD 4.8 — raise a parts replacement request to cutting for rejected pieces. */
const PartsReplacementDrawer = ({ open, orders, onClose, onSaved }) => {
  const { message } = App.useApp();
  const { options, lineOptions } = useSewingMasters();
  const [partOptions, setPartOptions] = useState([]);
  const [orderId, setOrderId] = useState(null);
  const [lineId, setLineId] = useState(null);
  const [requestedBy, setRequestedBy] = useState('');
  const [parts, setParts] = useState([]);
  const [saving, setSaving] = useState(false);

  const reasonOptions = options('DAMAGE_REASON');

  // Panel names come from the shared parts master rather than a cutting-module
  // constant, so both floors name the same panel the same way.
  useEffect(() => {
    if (!open || partOptions.length) return;
    getActiveParts()
      .then((parts) => setPartOptions(parts.map((p) => ({ value: p.id, label: p.partName }))))
      .catch(() => message.error('Failed to load the parts master'));
  }, [open, partOptions.length, message]);

  const setPart = useCallback((idx, field, val) => {
    setParts((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: val } : p)));
  }, []);

  const order = useMemo(() => orders.find((o) => o.id === orderId), [orders, orderId]);

  const columns = useMemo(() => [
    {
      title: 'Size', dataIndex: 'size', width: 100,
      render: (v, _, idx) => (
        <FormSelect size="small" value={v} style={{ width: 84 }} placeholder="Size"
          options={(order?.sizes || []).map((s) => ({ value: s, label: s }))}
          onChange={(val) => setPart(idx, 'size', val)} />
      ),
    },
    {
      title: 'Serial / Bundle #', dataIndex: 'serialNo', width: 140,
      render: (v, _, idx) => <Input size="small" value={v} placeholder="B-3/S-21" onChange={(e) => setPart(idx, 'serialNo', e.target.value)} />,
    },
    {
      title: 'Part', dataIndex: 'partId', width: 150,
      render: (v, _, idx) => (
        <FormSelect size="small" value={v} style={{ width: 135 }} placeholder="Part" showSearch optionFilterProp="label"
          options={partOptions} onChange={(val) => setPart(idx, 'partId', val)} />
      ),
    },
    {
      title: 'Damage Reason', dataIndex: 'reason', width: 180,
      render: (v, _, idx) => (
        <FormSelect size="small" value={v} style={{ width: 165 }} placeholder="Reason"
          options={reasonOptions} onChange={(val) => setPart(idx, 'reason', val)} />
      ),
    },
    {
      title: 'Pieces', dataIndex: 'pieces', width: 90, align: 'center',
      render: (v, _, idx) => <InputNumber size="small" min={1} value={v} style={{ width: 70 }} onChange={(val) => setPart(idx, 'pieces', val)} />,
    },
    {
      title: '', key: 'del', width: 46, align: 'center',
      render: (_, __, idx) => (
        <Button size="small" type="text" danger icon={<DeleteOutlined />}
          onClick={() => setParts((prev) => prev.filter((_, i) => i !== idx))} />
      ),
    },
  ], [order, partOptions, reasonOptions, setPart]);

  const handleSave = async () => {
    if (!orderId) return message.warning('Select the order');
    const valid = parts.filter((p) => p.size && p.partId && p.reason && p.pieces > 0);
    if (!valid.length) return message.warning('Add at least one rejected part');
    setSaving(true);
    try {
      const saved = await saveReplacement({
        orderId,
        lineId,
        requestDate: dayjs().format('YYYY-MM-DD'),
        requestedBy: requestedBy || null,
        parts: valid,
      });
      message.success(`${saved.requestNo} sent to cutting — ${saved.totalPieces} pcs`);
      setParts([]); setOrderId(null); setLineId(null); setRequestedBy('');
      onSaved();
    } catch (e) {
      message.error(e?.response?.data?.message || 'Failed to save the request');
    } finally { setSaving(false); }
  };

  return (
    <Drawer
      title="Cutting Rejection — Parts Replacement Request"
      size={800}
      open={open}
      onClose={onClose}
      destroyOnHidden
      footer={(
        <Space style={{ float: 'right' }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" loading={saving} onClick={handleSave}>Send to Cutting</Button>
        </Space>
      )}
    >
      <Space size="middle" wrap style={{ marginBottom: 16 }}>
        <FormSelect value={orderId} style={{ width: 260 }} placeholder="Order"
          options={orders.map((o) => ({ value: o.id, label: `${o.orderNo} · ${o.styleNo}` }))}
          onChange={(v) => { setOrderId(v); setParts([]); }} />
        <FormSelect value={lineId} style={{ width: 140 }} placeholder="Line" allowClear
          options={lineOptions} onChange={(v) => setLineId(v ?? null)} />
        <Input style={{ width: 180 }} placeholder="Requested by" value={requestedBy}
          onChange={(e) => setRequestedBy(e.target.value)} />
        <Button icon={<PlusOutlined />} size="small" disabled={!orderId}
          onClick={() => setParts((prev) => [...prev, blankPart()])}>
          Add Rejected Part
        </Button>
      </Space>
      <Table rowKey={(r) => parts.indexOf(r)} size="small" columns={columns} dataSource={parts} pagination={false}
        locale={{ emptyText: 'Log each rejected piece with its bundle serial for traceability' }} />
    </Drawer>
  );
};

export default PartsReplacementDrawer;
