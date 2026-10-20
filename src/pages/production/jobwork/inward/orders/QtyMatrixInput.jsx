import { memo } from 'react';
import {
  Button, Input, InputNumber, Table, Typography,
} from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { fmtQty } from '../../jwFormat';

const { Text } = Typography;

/** Colours × sizes of a job order: type the colour, then its pieces per size. */
const QtyMatrixInput = memo(function QtyMatrixInput({ sizes, colours, onChange }) {
  const patch = (i, p) => onChange(colours.map((c, j) => (j === i ? { ...c, ...p } : c)));
  const total = (c) => sizes.reduce((a, s) => a + (Number(c.qty?.[s]) || 0), 0);
  const columns = [
    {
      title: 'Colour', key: 'colour', width: 160,
      render: (_, c, i) => <Input name={`jo-colour-${i}`} size="small" value={c.colour} placeholder="e.g. Navy" onChange={(e) => patch(i, { colour: e.target.value })} />,
    },
    ...sizes.map((s) => ({
      title: s, key: s, width: 90,
      render: (_, c, i) => (
        <InputNumber name={`jo-qty-${i}-${s}`} size="small" min={0} precision={0} controls={false} style={{ width: '100%' }}
          value={c.qty?.[s] ?? null} onChange={(v) => patch(i, { qty: { ...c.qty, [s]: v || 0 } })} />
      ),
    })),
    { title: 'Total', key: 't', width: 90, align: 'right', render: (_, c) => <Text strong>{fmtQty(total(c))}</Text> },
    {
      title: '', key: 'x', width: 44,
      render: (_, c, i) => <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label="Remove colour" disabled={colours.length === 1} onClick={() => onChange(colours.filter((_, j) => j !== i))} />,
    },
  ];
  return (
    <Table
      rowKey="key"
      size="small"
      pagination={false}
      columns={columns}
      dataSource={colours}
      scroll={{ x: 300 + sizes.length * 90 }}
      footer={() => (
        <Button size="small" icon={<PlusOutlined />} onClick={() => onChange([...colours, { key: `c${Date.now()}`, colour: '', qty: {} }])}>Add colour</Button>
      )}
      summary={() => (
        <Table.Summary.Row>
          <Table.Summary.Cell index={0}><Text strong>Order</Text></Table.Summary.Cell>
          {sizes.map((s, i) => <Table.Summary.Cell key={s} index={i + 1}>{fmtQty(colours.reduce((a, c) => a + (Number(c.qty?.[s]) || 0), 0))}</Table.Summary.Cell>)}
          <Table.Summary.Cell index={sizes.length + 1} align="right"><Text strong>{fmtQty(colours.reduce((a, c) => a + total(c), 0))}</Text></Table.Summary.Cell>
          <Table.Summary.Cell index={sizes.length + 2} />
        </Table.Summary.Row>
      )}
    />
  );
});

export default QtyMatrixInput;
