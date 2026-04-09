import { useMemo } from 'react';
import { Table, InputNumber, Typography, Empty } from 'antd';
import { numericInputProps } from '../../../utils/inputHelpers';
import { formatNumber } from '../../../utils/formatters';

const { Text } = Typography;

const ReadOnlyText = ({ value }) => <Text style={{ fontSize: 13 }}>{value ?? '—'}</Text>;

const AccessoriesGRNItemTable = ({ items = [], onItemChange, readOnly = false }) => {
  const columns = useMemo(
    () => [
      { title: '#', key: 'idx', align: 'center', width: 50, render: (_, __, i) => i + 1 },
      { title: 'Item Code', dataIndex: 'itemCode', align: 'center', width: 150, render: (v) => <ReadOnlyText value={v} /> },
      { title: 'Description', dataIndex: 'description', align: 'center', ellipsis: true, render: (v) => <ReadOnlyText value={v} /> },
      { title: 'Color', dataIndex: 'color', align: 'center', width: 100, render: (v) => <ReadOnlyText value={v} /> },
      { title: 'Size', dataIndex: 'size', align: 'center', width: 80, render: (v) => <ReadOnlyText value={v} /> },
      { title: 'PO Qty', dataIndex: 'poQty', align: 'center', width: 100, render: (v) => <ReadOnlyText value={formatNumber(v)} /> },
      { title: 'Received Qty', dataIndex: 'alreadyReceived', align: 'center', width: 120, render: (v) => <ReadOnlyText value={formatNumber(v)} /> },
      { title: 'Balance', dataIndex: 'balance', align: 'center', width: 100, render: (v) => <Text strong style={{ color: 'var(--primary-color)' }}>{formatNumber(v)}</Text> },
      {
        title: 'Receiving Qty',
        dataIndex: 'receivingQty',
        align: 'center',
        width: 130,
        render: (val, _, i) => (
          <InputNumber
            size="small"
            min={0}
            max={items[i]?.balance}
            value={val}
            placeholder="Qty"
            style={{ width: '100%' }}
            disabled={readOnly}
            status={!val ? 'warning' : ''}
            onChange={(v) => onItemChange?.(i, 'receivingQty', v)}
            {...numericInputProps}
          />
        ),
      },
      { title: 'UOM', dataIndex: 'uom', align: 'center', width: 80, render: (v) => <ReadOnlyText value={v} /> },
      { title: 'Rate', dataIndex: 'rate', align: 'center', width: 100, render: (v) => <ReadOnlyText value={formatNumber(v, 2)} /> },
      {
        title: 'Amount',
        key: 'amount',
        align: 'center',
        width: 110,
        render: (_, r) => <ReadOnlyText value={formatNumber((Number(r.receivingQty) || 0) * (Number(r.rate) || 0), 2)} />,
      },
    ],
    [onItemChange, readOnly, items],
  );

  return (
    <Table
      rowKey={(r, i) => `${r.poLineItemId}-${i}`}
      columns={columns}
      dataSource={items}
      pagination={false}
      scroll={{ x: 1280 }}
      size="small"
      locale={{ emptyText: <Empty description="Select PO line items above to populate items." /> }}
    />
  );
};

export default AccessoriesGRNItemTable;
