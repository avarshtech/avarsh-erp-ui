import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, InputNumber, Space, Table } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { FormSelect } from '../../../components/form';
import { getActiveParts } from '../../../services/master/partsService';
import { getActiveProcesses } from '../../../services/master/processService';

/**
 * An outsourced Cut PO's panel issue — free text, as before the Cut Panel PO (D4): any Cut Panel process, the
 * panels and sizes typed in. Controlled: `value` = { processId, lines }, `onChange(next)`.
 */
const PanelIssueFreeText = ({ po, value, onChange }) => {
  const [parts, setParts] = useState([]);
  const [processes, setProcesses] = useState([]);
  const nextKey = useRef(0);

  useEffect(() => {
    getActiveParts().then(setParts).catch(() => setParts([]));
    // Only the 'Cut Panel' category — the process master also holds Garment processes
    // (washing, dyeing on sewn garments) that never apply to cut panels.
    getActiveProcesses('Cut Panel').then(setProcesses).catch(() => setProcesses([]));
  }, []);
  const partOptions = useMemo(() => parts.map((p) => ({ value: p.partName, label: p.partName })), [parts]);
  const processOptions = useMemo(() => processes.map((p) => ({ value: p.id, label: p.processName })), [processes]);

  const { lines } = value;
  const setLines = useCallback((fn) => onChange({ ...value, lines: fn(value.lines) }), [value, onChange]);
  const setLine = useCallback((idx, field, val) => setLines((prev) => prev.map((l, i) => {
    if (i !== idx) return l;
    const next = { ...l, [field]: val };
    if (field === 'size') next.orderQty = po.sizeQty?.[val] || 0;
    return next;
  })), [po, setLines]);

  const columns = [
    {
      title: 'Panel', dataIndex: 'panel', width: 130,
      render: (v, _, idx) => (
        <FormSelect size="small" value={v} style={{ width: 115 }} placeholder="Panel" options={partOptions} onChange={(val) => setLine(idx, 'panel', val)} />
      ),
    },
    {
      title: 'Size', dataIndex: 'size', width: 100,
      render: (v, _, idx) => (
        <FormSelect size="small" value={v} style={{ width: 84 }} placeholder="Size"
          options={(po.sizes || []).map((s) => ({ value: s, label: s }))} onChange={(val) => setLine(idx, 'size', val)} />
      ),
    },
    { title: 'Ord Qty', dataIndex: 'orderQty', width: 90, align: 'right', render: (v) => v ?? '—' },
    {
      title: 'Issue Qty', dataIndex: 'issueQty', width: 110, align: 'center',
      render: (v, r, idx) => (
        <InputNumber size="small" min={0} max={r.orderQty || undefined} value={v} style={{ width: 90 }}
          status={v > (r.orderQty || Infinity) ? 'error' : undefined} onChange={(val) => setLine(idx, 'issueQty', val)} />
      ),
    },
    {
      title: '', key: 'del', width: 46, align: 'center',
      render: (_, __, idx) => (
        <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label="Remove line"
          onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))} />
      ),
    },
  ];

  return (
    <>
      <Space size="middle" wrap style={{ marginBottom: 16 }}>
        <FormSelect value={value.processId} style={{ width: 190 }} placeholder="Process" options={processOptions}
          onChange={(processId) => onChange({ ...value, processId })} />
        <Button icon={<PlusOutlined />} size="small"
          onClick={() => { nextKey.current += 1; const key = `p${nextKey.current}`; setLines((prev) => [...prev, { key, panel: null, size: null, orderQty: null, issueQty: null }]); }}>
          Add Panel
        </Button>
      </Space>
      <Table rowKey="key" size="small" columns={columns} dataSource={lines} pagination={false}
        locale={{ emptyText: 'Issued panels are excluded from bundling until they return and pass the panel check' }} />
    </>
  );
};

export default PanelIssueFreeText;
