import { useEffect, useMemo, useState } from 'react';
import { App, Drawer, Form, Button, Space, InputNumber, Table, Progress, Alert, Input } from 'antd';
import { FormSelect } from '../../../components/form';
import { THRESHOLDS, CUTTING_TABLES } from '../../../utils/cuttingConstants';
import { saveMarker } from '../../../services/production/cuttingService';

/** ENH-01 — marker layout: sizes combined, ratio per size, plies auto-derived from order qty. */
const MarkerPlanDrawer = ({ open, record, cutPos, onClose, onSaved }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [ratio, setRatio] = useState({});
  const [saving, setSaving] = useState(false);
  const cutPoId = Form.useWatch('cutPoId', form);
  const efficiency = Form.useWatch('efficiencyPct', form);
  const po = useMemo(() => cutPos.find((p) => p.id === cutPoId), [cutPos, cutPoId]);

  useEffect(() => {
    if (!open) return;
    if (record) {
      form.setFieldsValue({ cutPoId: record.cutPoId, length: record.length, width: record.width, efficiencyPct: record.efficiencyPct, tableNo: record.tableNo, cadFile: record.cadFile });
      setRatio(record.ratio);
    } else { form.resetFields(); setRatio({}); }
  }, [open, record, form]);

  const rows = useMemo(() => (po ? po.sizes.map((size) => {
    const r = ratio[size] || 0;
    return {
      size, ratio: r, orderQty: po.sizeQty[size],
      plies: r > 0 ? Math.ceil(po.sizeQty[size] / r) : null, // BR-ENH-01-04
    };
  }) : []), [po, ratio]);

  const uncovered = rows.filter((r) => !r.ratio).map((r) => r.size);
  const piecesPerMarker = rows.reduce((s, r) => s + r.ratio, 0);

  const columns = useMemo(() => [
    { title: 'Size', dataIndex: 'size', width: 80, align: 'center' },
    { title: 'Order Qty', dataIndex: 'orderQty', width: 100, align: 'right' },
    {
      title: 'Ratio / Marker', dataIndex: 'ratio', width: 130, align: 'center',
      render: (v, r) => (
        <InputNumber size="small" min={0} max={10} value={v || null} style={{ width: 80 }}
          onChange={(val) => setRatio((prev) => ({ ...prev, [r.size]: val || 0 }))} />
      ),
    },
    { title: 'Plies Required', dataIndex: 'plies', width: 120, align: 'right', render: (v) => (v ?? '—') },
  ], []);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (!piecesPerMarker) return message.warning('Enter a size ratio for at least one size');
      setSaving(true);
      await saveMarker({ id: record?.id, ...values, sizes: po.sizes, ratio });
      message.success('Marker saved');
      onSaved();
    } catch (e) {
      if (e?.errorFields) return;
      message.error('Failed to save marker');
    } finally { setSaving(false); }
  };

  return (
    <Drawer
      title={record ? `Marker — ${record.markerNo}` : 'New Marker Plan'}
      size={620}
      open={open}
      onClose={onClose}
      destroyOnHidden
      footer={(
        <Space style={{ float: 'right' }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" loading={saving} onClick={handleSave}>Save Marker</Button>
        </Space>
      )}
    >
      <Form form={form} layout="vertical">
        <Form.Item name="cutPoId" label="Cut PO #" rules={[{ required: true, message: 'Select Cut PO' }]}>
          <FormSelect placeholder="Select Cut PO" disabled={Boolean(record)}
            options={cutPos.map((p) => ({ value: p.id, label: `${p.cutPoNo} · ${p.styleNo}` }))} />
        </Form.Item>
        <Space size="large" wrap>
          <Form.Item name="length" label="Marker Length (m)" rules={[{ required: true, message: 'Required' }]}>
            <InputNumber min={0.5} step={0.1} style={{ width: 130 }} />
          </Form.Item>
          <Form.Item name="width" label="Marker Width (cm)" rules={[{ required: true, message: 'Required' }]}>
            <InputNumber min={50} style={{ width: 130 }} />
          </Form.Item>
          <Form.Item name="efficiencyPct" label="Efficiency %" rules={[{ required: true, message: 'Required' }]}>
            <InputNumber min={40} max={99} style={{ width: 110 }} />
          </Form.Item>
          <Form.Item name="tableNo" label="Table">
            <FormSelect placeholder="Table" style={{ width: 120 }} options={CUTTING_TABLES.map((t) => ({ value: t, label: t }))} />
          </Form.Item>
        </Space>
        {typeof efficiency === 'number' && (
          <div style={{ marginBottom: 12, maxWidth: 320 }}>
            <Progress percent={efficiency} size="small" status={efficiency < THRESHOLDS.markerEfficiencyWarn ? 'exception' : 'normal'} />
            {efficiency < THRESHOLDS.markerEfficiencyWarn && (
              <Alert type="warning" showIcon style={{ marginTop: 8 }} title={`Below ${THRESHOLDS.markerEfficiencyWarn}% — review marker for fabric saving`} />
            )}
          </div>
        )}
        <Form.Item name="cadFile" label="CAD File Reference">
          <Input placeholder="e.g. HM-TS-2601-M1.cut" />
        </Form.Item>
        <Table rowKey="size" size="small" columns={columns} dataSource={rows} pagination={false}
          locale={{ emptyText: 'Select a Cut PO to define the size ratio' }}
          footer={() => (
            <Space size="large">
              <span>Pieces per marker: <strong>{piecesPerMarker}</strong></span>
              {uncovered.length > 0 && po && <span style={{ color: 'var(--warning-color)' }}>Sizes not covered: {uncovered.join(', ')}</span>}
            </Space>
          )} />
      </Form>
    </Drawer>
  );
};

export default MarkerPlanDrawer;
