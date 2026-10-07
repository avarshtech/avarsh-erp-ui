import { memo } from 'react';
import {
  Button, InputNumber, Table, Typography,
} from 'antd';
import { fmtQty, sizeKey as cellKey } from '../../jwFormat';

const { Text } = Typography;

/**
 * Pieces to send per colour × size, each capped at what is available (packed and not yet returned,
 * or rejects found and not yet returned). `value` = { "colour|size": qty }.
 */
const ReturnGarmentsGrid = memo(function ReturnGarmentsGrid({ sizes, colours, available, value, onChange, name }) {
  const rows = colours.map(({ colour }) => ({ colour }));
  const columns = [
    { title: 'Colour', dataIndex: 'colour', width: 110, render: (c) => <Text strong>{c}</Text> },
    ...sizes.map((size) => ({
      title: size, key: size, width: 100,
      render: (_, r) => {
        const can = available?.[r.colour]?.[size] || 0;
        return (
          <>
            <InputNumber name={`${name}-${r.colour}-${size}`} size="small" min={0} max={can} precision={0} controls={false} disabled={!can}
              style={{ width: '100%' }} value={value[cellKey(r.colour, size)] ?? null} onChange={(v) => onChange({ ...value, [cellKey(r.colour, size)]: v || 0 })} />
            <Text type="secondary" style={{ fontSize: 11 }}>of {fmtQty(can)}</Text>
          </>
        );
      },
    })),
    { title: 'Total', key: 't', width: 80, align: 'right', render: (_, r) => fmtQty(sizes.reduce((a, s) => a + (value[cellKey(r.colour, s)] || 0), 0)) },
  ];
  const fillAll = () => onChange(Object.fromEntries(colours.flatMap(({ colour }) => sizes.map((s) => [cellKey(colour, s), available?.[colour]?.[s] || 0]))));
  return (
    <Table rowKey="colour" size="small" pagination={false} columns={columns} dataSource={rows} scroll={{ x: 200 + sizes.length * 100 }}
      footer={() => <Button size="small" onClick={fillAll}>Send all that is available</Button>} />
  );
});

export default ReturnGarmentsGrid;
