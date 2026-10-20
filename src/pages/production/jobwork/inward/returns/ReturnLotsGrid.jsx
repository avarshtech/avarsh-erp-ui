import { memo } from 'react';
import {
  Button, InputNumber, Table, Typography,
} from 'antd';
import { fmtQty } from '../../jwFormat';

const { Text } = Typography;

/** Their leftover material going back, lot by lot; each line quotes the challan it came on. */
const ReturnLotsGrid = memo(function ReturnLotsGrid({ lots, value, onChange }) {
  const columns = [
    { title: 'Lot', dataIndex: 'lotNo', render: (v, l) => <><Text strong style={{ fontSize: 12 }}>{v}</Text> · {l.itemName}{l.size ? ` — ${l.size}` : ''}</> },
    { title: 'Their challan', dataIndex: 'theirDcNo', width: 150 },
    { title: 'In store', key: 's', width: 120, align: 'right', render: (_, l) => `${fmtQty(l.inStore)} ${l.uom}` },
    {
      title: 'Send back', key: 'q', width: 130,
      render: (_, l) => <InputNumber name={`retlot-${l.id}`} size="small" min={0} max={l.inStore} style={{ width: '100%' }} value={value[l.id] ?? null} onChange={(v) => onChange({ ...value, [l.id]: v || 0 })} />,
    },
  ];
  return (
    <Table rowKey="id" size="small" pagination={false} columns={columns} dataSource={lots} locale={{ emptyText: 'Nothing of theirs is in store.' }}
      footer={lots.length ? () => <Button size="small" onClick={() => onChange(Object.fromEntries(lots.map((l) => [l.id, l.inStore])))}>Send all back</Button> : undefined} />
  );
});

export default ReturnLotsGrid;
