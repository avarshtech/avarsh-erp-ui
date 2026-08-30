import { useState, useEffect, useMemo } from 'react';
import {
  App, Drawer, Form, Select, DatePicker, Input, InputNumber, Table, Checkbox,
  Space, Button, Alert, Typography, Tag,
} from 'antd';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import { getSuppliers } from '../../../services/master/supplierService';
import { createSamplePo } from '../../../services/sr/srService';
import { computeSampleQtyRequired } from '../../../utils/sampleBomMapper';

const { Text } = Typography;

/**
 * Raise Purchase Order drawer (PRD v3 §8.2 D + §11.2). Creates a SAMPLE-flagged
 * PO linked to the SR. Shortfall lines are pre-ticked with their shortfall qty;
 * any line may be added since stock status is indicative. Raising a PO never
 * blocks SR submission — the line shows PO Pending until goods are received.
 * Mock phase: the PO is a record in the SR store; real phase creates a
 * PO-module record (po_type = SAMPLE) that follows the normal GRN flow.
 */
const RaisePoDrawer = ({ open, sr, focusLine, onClose, onCreated }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [suppliers, setSuppliers] = useState([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [selected, setSelected] = useState({});
  const [lineEdits, setLineEdits] = useState({});
  const [saving, setSaving] = useState(false);

  const lines = useMemo(
    () => (sr?.materials || []).filter((l) => !l.poRef),
    [sr],
  );

  useEffect(() => {
    if (!open) return;
    setSuppliersLoading(true);
    getSuppliers()
      .then((res) => setSuppliers(Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : [])))
      .catch(() => setSuppliers([]))
      .finally(() => setSuppliersLoading(false));
    const init = {};
    const edits = {};
    lines.forEach((l) => {
      const required = l.sampleQtyRequired
        || computeSampleQtyRequired(l, sr?.sampleQty, sr?.sizes || []);
      const shortfall = l.stockStatus && l.stockStatus !== 'IN_STOCK';
      const focus = focusLine && focusLine.lineNo === l.lineNo;
      init[l.lineNo] = focus || (!focusLine && shortfall);
      const shortQty = shortfall ? Math.max(0, required - (l.stockAvailable || 0)) : required;
      edits[l.lineNo] = { orderQty: Math.ceil(shortQty) || undefined, rate: undefined };
    });
    setSelected(init);
    setLineEdits(edits);
    form.resetFields();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sr?.id, focusLine?.lineNo]);

  const totalValue = useMemo(() => lines.reduce((sum, l) => {
    if (!selected[l.lineNo]) return sum;
    const e = lineEdits[l.lineNo] || {};
    return sum + (Number(e.orderQty) || 0) * (Number(e.rate) || 0);
  }, 0), [lines, selected, lineEdits]);

  const submit = async (saveAsDraft) => {
    try {
      const values = await form.validateFields();
      const chosen = lines.filter((l) => selected[l.lineNo]);
      if (!chosen.length) { message.warning('Select at least one material line'); return; }
      const supplier = suppliers.find((s) => s.id === values.supplierId);
      setSaving(true);
      const po = await createSamplePo(sr.id, {
        supplierId: values.supplierId,
        supplierName: supplier?.name || supplier?.supplierName || '',
        requiredBy: values.requiredBy.format('YYYY-MM-DD'),
        chargeTo: values.chargeTo,
        saveAsDraft,
        lines: chosen.map((l) => ({
          lineNo: l.lineNo,
          description: l.description,
          classification: l.classification,
          uom: l.uom,
          orderQty: lineEdits[l.lineNo]?.orderQty,
          rate: lineEdits[l.lineNo]?.rate,
        })),
      });
      message.success(saveAsDraft ? 'Sample PO saved as draft' : `Sample PO ${po.poNo} created & linked to ${sr.srNo}`);
      onCreated?.();
      onClose();
    } catch (e) {
      if (e?.errorFields) return; // form validation display
      message.error(e.message || 'Failed to create sample PO');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: '', key: 'pick', width: 40,
      render: (_, l) => (
        <Checkbox
          checked={Boolean(selected[l.lineNo])}
          onChange={(e) => setSelected((s) => ({ ...s, [l.lineNo]: e.target.checked }))}
        />
      ),
    },
    { title: 'Material', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: 'Classification', dataIndex: 'classification', key: 'classification', width: 120 },
    {
      title: 'Stock', key: 'stock', width: 90,
      render: (_, l) => (l.stockStatus === 'IN_STOCK'
        ? <Tag color="green">In Stock</Tag>
        : <Tag color="red">{l.stockStatus === 'OUT_OF_STOCK' ? 'Out of Stock' : 'Shortfall'}</Tag>),
    },
    {
      title: 'Order Qty', key: 'orderQty', width: 100,
      render: (_, l) => (
        <InputNumber
          size="small" min={0} style={{ width: '100%' }}
          value={lineEdits[l.lineNo]?.orderQty}
          disabled={!selected[l.lineNo]}
          onChange={(v) => setLineEdits((s) => ({ ...s, [l.lineNo]: { ...s[l.lineNo], orderQty: v } }))}
        />
      ),
    },
    { title: 'UOM', dataIndex: 'uom', key: 'uom', width: 60, align: 'center' },
    {
      title: 'Rate', key: 'rate', width: 90,
      render: (_, l) => (
        <InputNumber
          size="small" min={0} style={{ width: '100%' }}
          value={lineEdits[l.lineNo]?.rate}
          disabled={!selected[l.lineNo]}
          onChange={(v) => setLineEdits((s) => ({ ...s, [l.lineNo]: { ...s[l.lineNo], rate: v } }))}
        />
      ),
    },
    {
      title: 'Value', key: 'value', width: 90, align: 'right',
      render: (_, l) => {
        const e = lineEdits[l.lineNo] || {};
        const v = (Number(e.orderQty) || 0) * (Number(e.rate) || 0);
        return selected[l.lineNo] && v ? <Text strong>{v.toFixed(2)}</Text> : '—';
      },
    },
  ];

  return (
    <Drawer
      title={`Raise Purchase Order — from ${sr?.srNo || ''}`}
      open={open}
      onClose={onClose}
      width={860}
      destroyOnHidden
      extra={<Tag color="purple">Sample PO</Tag>}
    >
      <Alert
        type="info" showIcon style={{ marginBottom: 16 }}
        message="Creates a Sample-flagged PO linked to this SR. It follows the usual goods-received flow; raising it does not block SR submission."
      />
      <Form form={form} layout="vertical" initialValues={{ chargeTo: 'ORDER' }}>
        <Space size={16} wrap style={{ width: '100%' }}>
          <Form.Item
            name="supplierId" label="Supplier" rules={[{ required: true, message: 'Select supplier' }]}
            style={{ minWidth: 260 }}
            extra={<Link to="/master">+ Add supplier (Master Data)</Link>}
          >
            <Select
              showSearch optionFilterProp="label" placeholder="Select supplier"
              loading={suppliersLoading}
              options={suppliers.map((s) => ({ value: s.id, label: s.name || s.supplierName }))}
            />
          </Form.Item>
          <Form.Item label="PO Type">
            <Input value="Sample PO" disabled style={{ width: 140, backgroundColor: 'var(--bg-tertiary)' }} />
          </Form.Item>
          <Form.Item
            name="requiredBy" label="Required By"
            rules={[
              { required: true, message: 'Enter required-by date' },
              () => ({
                validator: (_, v) => {
                  if (v && sr?.inHandDate && v.isAfter(dayjs(sr.inHandDate), 'day')) {
                    return Promise.reject(new Error(`Must be on or before the Sample In-Hand Date (${sr.inHandDate})`));
                  }
                  return Promise.resolve();
                },
              }),
            ]}
          >
            <DatePicker style={{ width: 160 }} />
          </Form.Item>
          <Form.Item name="chargeTo" label="Charge To">
            <Select
              style={{ width: 200 }}
              options={[
                { value: 'ORDER', label: `Order ${sr?.orderNo || ''}` },
                { value: 'SAMPLING_OVERHEAD', label: 'Sampling overhead' },
              ]}
            />
          </Form.Item>
        </Space>
      </Form>

      <Table
        rowKey="lineNo"
        size="small"
        columns={columns}
        dataSource={lines}
        pagination={false}
        footer={() => (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary">Shortfall lines are pre-ticked. In-stock lines can be added — useful when a special quality must be bought fresh.</Text>
            <Text strong>Total: {totalValue.toFixed(2)}</Text>
          </div>
        )}
      />

      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={() => submit(true)} loading={saving}>Save PO as Draft</Button>
        <Button type="primary" onClick={() => submit(false)} loading={saving}>Create PO &amp; Link to SR</Button>
      </div>
    </Drawer>
  );
};

export default RaisePoDrawer;
