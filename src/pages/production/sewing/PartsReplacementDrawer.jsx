import { useCallback, useState } from 'react';
import { App, Drawer, Button, Space, Table, InputNumber, Input } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { FormSelect } from '../../../components/form';
import { DAMAGE_REASONS } from '../../../utils/sewingConstants';
import { PANEL_NAMES } from '../../../utils/cuttingConstants';
import { saveReplacement } from '../../../services/production/sewingService';

/** PRD 4.8 — raise a parts replacement request to cutting for rejected pieces. */
const PartsReplacementDrawer = ({ open, orders, onClose, onSaved }) => {
  const { message } = App.useApp();
  const [orderId, setOrderId] = useState(null);
  const [parts, setParts] = useState([]);
  const [saving, setSaving] = useState(false);

  const setPart = useCallback((idx, field, val) => {
    setParts((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: val } : p)));
  }, []);

  const order = orders.find((o) => o.id === orderId);

  const columns = [
    {
      title: 'Size', dataIndex: 'size', width: 90,
      render: (v, _, idx) => (
        <FormSelect size="small" value={v} style={{ width: 74 }} placeholder="Size"
          options={(order?.sizes || []).map((s) => ({ value: s, label: s }))} onChange={(val) => setPart(idx, 'size', val)} />
      ),
    },
    {
      title: 'Serial / Bundle #', dataIndex: 'serialNo', width: 140,
      render: (v, _, idx) => <Input size="small" value={v} placeholder="B-3/S-21" onChange={(e) => setPart(idx, 'serialNo', e.target.value)} />,
    },
    {
      title: 'Part', dataIndex: 'part', width: 130,
      render: (v, _, idx) => (
        <FormSelect size="small" value={v} style={{ width: 115 }} placeholder="Part"
          options={PANEL_NAMES.map((p) => ({ value: p, label: p }))} onChange={(val) => setPart(idx, 'part', val)} />
      ),
    },
    {
      title: 'Damage Reason', dataIndex: 'reason', width: 170,
      render: (v, _, idx) => (
        <FormSelect size="small" value={v} style={{ width: 155 }} placeholder="Reason"
          options={DAMAGE_REASONS.map((r) => ({ value: r, label: r.replace('_', ' ') }))} onChange={(val) => setPart(idx, 'reason', val)} />
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
  ];

  const handleSave = async () => {
    if (!orderId) return message.warning('Select the order');
    const valid = parts.filter((p) => p.size && p.part && p.reason && p.pieces > 0);
    if (!valid.length) return message.warning('Add at least one rejected part');
    setSaving(true);
    try {
      const saved = await saveReplacement({
        orderId, date: dayjs().format('YYYY-MM-DD'), requestedBy: 'Line Supervisor',
        parts: valid.map((p) => ({ ...p, replStatus: 'PENDING', replDate: null })),
      });
      message.success(`${saved.requestNo} sent to cutting for replacement`);
      setParts([]); setOrderId(null);
      onSaved();
    } catch { message.error('Failed to save request'); } finally { setSaving(false); }
  };

  return (
    <Drawer
      title="Cutting Rejection — Parts Replacement Request"
      size={720}
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
        <FormSelect value={orderId} style={{ width: 280 }} placeholder="Order"
          options={orders.map((o) => ({ value: o.id, label: `${o.orderNo} · ${o.styleNo}` }))} onChange={setOrderId} />
        <Button icon={<PlusOutlined />} size="small" disabled={!orderId}
          onClick={() => setParts((prev) => [...prev, { size: null, serialNo: '', part: null, reason: null, pieces: null }])}>
          Add Rejected Part
        </Button>
      </Space>
      <Table rowKey={(r) => parts.indexOf(r)} size="small" columns={columns} dataSource={parts} pagination={false}
        locale={{ emptyText: 'Log each rejected piece with its bundle serial for traceability' }} />
    </Drawer>
  );
};

export default PartsReplacementDrawer;
