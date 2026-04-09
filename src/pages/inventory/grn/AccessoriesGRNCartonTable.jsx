import { useMemo } from 'react';
import { Table, Input, InputNumber, Typography, Empty } from 'antd';

const { Text } = Typography;

const ReadOnlyText = ({ value }) => <Text style={{ fontSize: 13 }}>{value ?? '—'}</Text>;

const AccessoriesGRNCartonTable = ({ cartons = [], onCartonChange, readOnly = false }) => {
  const columns = useMemo(
    () => [
      { title: '#', key: 'idx', align: 'center', width: 50, render: (_, __, i) => i + 1 },
      {
        title: 'Carton #',
        dataIndex: 'cartonNumber',
        align: 'center',
        width: 130,
        render: (val, _, i) => (
          <Input
            size="small"
            value={val}
            placeholder="e.g. C001"
            disabled={readOnly}
            status={!val ? 'warning' : ''}
            onChange={(e) => onCartonChange?.(i, 'cartonNumber', e.target.value)}
          />
        ),
      },
      { title: 'Item Code', dataIndex: 'itemCode', align: 'center', width: 150, render: (v) => <ReadOnlyText value={v} /> },
      { title: 'Description', dataIndex: 'itemDescription', align: 'center', ellipsis: true, render: (v) => <ReadOnlyText value={v} /> },
      { title: 'Color', dataIndex: 'color', align: 'center', width: 100, render: (v) => <ReadOnlyText value={v} /> },
      { title: 'Size', dataIndex: 'size', align: 'center', width: 80, render: (v) => <ReadOnlyText value={v} /> },
      {
        title: 'Quantity',
        dataIndex: 'quantity',
        align: 'center',
        width: 170,
        render: (val, _, i) => (
          <InputNumber
            size="small"
            min={0}
            value={val}
            placeholder="Qty"
            controls={false}
            addonAfter={cartons[i]?.uom || ''}
            style={{ width: '100%' }}
            disabled={readOnly}
            status={!val ? 'warning' : ''}
            onChange={(v) => onCartonChange?.(i, 'quantity', v)}
          />
        ),
      },
    ],
    [onCartonChange, readOnly, cartons],
  );

  return (
    <Table
      rowKey={(c, i) => `${c.poLineItemId}-${i}`}
      columns={columns}
      dataSource={cartons}
      pagination={false}
      scroll={{ x: 820 }}
      size="small"
      locale={{ emptyText: <Empty description="Select PO line items above to populate cartons." /> }}
    />
  );
};

export default AccessoriesGRNCartonTable;
