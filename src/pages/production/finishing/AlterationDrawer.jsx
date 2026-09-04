import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Drawer, Space, InputNumber, Table, Button, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined, SendOutlined } from '@ant-design/icons';
import { FormSelect } from '../../../components/form';
import { FACTORIES } from '../../../utils/cuttingConstants';
import { DEFECT_LIBRARY, DEFECT_SOURCES, DEFECT_SEVERITIES } from '../../../utils/finishingConstants';
import useModuleSelection from '../../../hooks/useModuleSelection';
import { saveAlterationBatch } from '../../../services/production/finishingService';

const FieldLabel = ({ children }) => (
  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{children}</div>
);

const blankRow = () => ({ size: null, qtyChecked: null, alterPcs: null, defectCode: null, source: null });

/**
 * Select the Order # and the unit the batch is going to, log the defect table
 * (Size / Qty Checked / No. of Alter Pcs / Defect Code / Source) and issue.
 *
 * One batch goes to one unit, so the unit belongs in the header rather than
 * repeated down every row where it can silently disagree with itself.
 */
const AlterationDrawer = ({ open, orders, onClose, onSaved }) => {
  const { message } = App.useApp();
  const { selectOrder, defaultOrderId } = useModuleSelection('finishing');
  const [orderId, setOrderId] = useState(null);
  const [productionUnit, setProductionUnit] = useState(FACTORIES[0]);
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOrderId(defaultOrderId(orders));
    setProductionUnit(FACTORIES[0]);
    setRows([blankRow()]);
  }, [open, orders, defaultOrderId]);

  const order = useMemo(() => orders.find((o) => o.id === orderId), [orders, orderId]);
  const setRow = useCallback((idx, patch) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }, []);

  const columns = useMemo(() => [
    {
      title: 'Size', dataIndex: 'size', width: 90,
      render: (v, _, idx) => (
        <FormSelect size="small" value={v} style={{ width: 75 }} placeholder="Size"
          options={(order?.sizes || []).map((s) => ({ value: s, label: s }))} onChange={(val) => setRow(idx, { size: val })} />
      ),
    },
    {
      title: 'Qty Checked', dataIndex: 'qtyChecked', width: 105, align: 'center',
      render: (v, _, idx) => <InputNumber size="small" min={0} value={v} style={{ width: 85 }} onChange={(val) => setRow(idx, { qtyChecked: val })} />,
    },
    {
      title: 'No. of Alter Pcs', dataIndex: 'alterPcs', width: 115, align: 'center',
      render: (v, r, idx) => <InputNumber size="small" min={0} max={r.qtyChecked || undefined} value={v} style={{ width: 90 }} onChange={(val) => setRow(idx, { alterPcs: val })} />,
    },
    {
      title: 'Defect Type Code', dataIndex: 'defectCode', width: 250,
      render: (v, _, idx) => (
        <Space size={4}>
          <FormSelect size="small" value={v} style={{ width: 200 }} placeholder="From library" showSearch
            options={DEFECT_LIBRARY.map((d) => ({ value: d.code, label: `${d.code} — ${d.name}` }))} onChange={(val) => setRow(idx, { defectCode: val })} />
          {v && <Tag color={DEFECT_SEVERITIES[DEFECT_LIBRARY.find((d) => d.code === v)?.severity]?.color} style={{ marginInline: 0 }}>{DEFECT_LIBRARY.find((d) => d.code === v)?.severity?.[0]}</Tag>}
        </Space>
      ),
    },
    {
      title: 'Defect Source', dataIndex: 'source', width: 120,
      render: (v, _, idx) => (
        <FormSelect size="small" value={v} style={{ width: 105 }} placeholder="Source"
          options={DEFECT_SOURCES.map((s) => ({ value: s, label: s }))} onChange={(val) => setRow(idx, { source: val })} />
      ),
    },
    {
      title: '', key: 'del', width: 46, align: 'center',
      render: (_, __, idx) => (
        <Button size="small" type="text" danger icon={<DeleteOutlined />}
          onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))} />
      ),
    },
  ], [order, setRow]);

  const handleIssue = async () => {
    const valid = rows.filter((r) => r.size && r.alterPcs && r.defectCode && r.source);
    if (!valid.length) return message.warning('Each row needs size, alter pcs, defect code and source');
    if (valid.length < rows.length) return message.warning('Complete or remove the incomplete rows');
    setSaving(true);
    try {
      await saveAlterationBatch({
        orderId, color: order?.color, rows: valid.map((r) => ({ ...r, productionUnit })),
      });
      message.success(`${valid.reduce((s, r) => s + r.alterPcs, 0)} pcs issued to ${productionUnit} for alteration`);
      onSaved();
    } catch { message.error('Failed to issue alterations'); } finally { setSaving(false); }
  };

  return (
    <Drawer title="Log Alterations — Issue to Production" open={open} onClose={onClose} width={980} destroyOnHidden
      footer={(
        <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" icon={<SendOutlined />} loading={saving} onClick={handleIssue}>Issue to Production</Button>
        </Space>
      )}>
      <Space size="middle" wrap style={{ marginBottom: 16 }}>
        <div>
          <FieldLabel>Order #</FieldLabel>
          <FormSelect value={orderId} style={{ width: 240 }}
            options={orders.map((o) => ({ value: o.id, label: `${o.orderNo} · ${o.styleNo}` }))}
            onChange={(v) => {
              const o = orders.find((x) => x.id === v);
              selectOrder(o);
              setOrderId(v);
              setRows([blankRow()]);
            }} />
        </div>
        <div>
          <FieldLabel>Issue to Unit</FieldLabel>
          <FormSelect value={productionUnit} style={{ width: 200 }}
            options={FACTORIES.map((f) => ({ value: f, label: f }))} onChange={setProductionUnit} />
        </div>
        {order && <Tag style={{ alignSelf: 'end' }}>{order.buyer} · {order.color}</Tag>}
      </Space>
      <Table
        title={() => (
          <Space style={{ justifyContent: 'space-between', width: '100%' }}>
            <strong>Defect Log</strong>
            <Button icon={<PlusOutlined />} size="small" onClick={() => setRows((prev) => [...prev, blankRow()])}>Add Row</Button>
          </Space>
        )}
        rowKey={(r) => rows.indexOf(r)} size="small" columns={columns} dataSource={rows} pagination={false} scroll={{ x: 760 }}
        locale={{ emptyText: 'Add defect rows for this order' }} />
    </Drawer>
  );
};

export default AlterationDrawer;
