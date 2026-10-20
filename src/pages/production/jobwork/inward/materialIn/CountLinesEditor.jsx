import { memo } from 'react';
import {
  InputNumber, Table, Tag, Typography,
} from 'antd';
import { fmtQty } from '../../jwFormat';

const { Text } = Typography;

/**
 * Counted lines of a Material In: trims (one row per material) or cut panel sets (one row per colour ×
 * size). `rows` = [{ key, label, uom, hint }]; `value` = { [key]: { challanQty, receivedQty, defectiveQty, declaredRate } }.
 */
const CountLinesEditor = memo(function CountLinesEditor({ rows, value, onChange, showRate = true }) {
  const patch = (key, p) => onChange({ ...value, [key]: { ...value[key], ...p } });
  const num = (k, r) => (
    <InputNumber name={`cnt-${k}-${r.key}`} size="small" min={0} controls={false} style={{ width: '100%' }} value={value[r.key]?.[k] ?? null}
      onChange={(v) => patch(r.key, { [k]: v ?? 0 })} />
  );
  const columns = [
    { title: 'Material', dataIndex: 'label', render: (v, r) => <><Text>{v}</Text>{r.hint && <><br /><Text type="secondary" style={{ fontSize: 11 }}>{r.hint}</Text></>}</> },
    { title: 'Their challan', key: 'c', width: 110, render: (_, r) => num('challanQty', r) },
    { title: 'Received', key: 'r', width: 110, render: (_, r) => num('receivedQty', r) },
    { title: 'Defective', key: 'd', width: 100, render: (_, r) => num('defectiveQty', r) },
    ...(showRate ? [{ title: 'Declared ₹', key: 'v', width: 100, render: (_, r) => num('declaredRate', r) }] : []),
    { title: 'Unit', dataIndex: 'uom', width: 60 },
    {
      title: '', key: 's', width: 110,
      render: (_, r) => {
        const v = value[r.key] || {};
        const short = (Number(v.challanQty) || 0) - (Number(v.receivedQty) || 0);
        return short > 0 && v.receivedQty != null ? <Tag color="orange">{fmtQty(short)} short</Tag> : null;
      },
    },
  ];
  return <Table rowKey="key" size="small" pagination={false} columns={columns} dataSource={rows} scroll={{ x: 760 }} />;
});

export default CountLinesEditor;
