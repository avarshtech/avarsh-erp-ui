import { useMemo } from 'react';
import { Table, InputNumber, Typography } from 'antd';
import { numericInputProps } from '../../../utils/inputHelpers';
import { formatNumber } from '../../../utils/formatters';

const { Text } = Typography;

const AccessoriesGRNItemTable = ({ items = [], onItemChange }) => {
  const columns = useMemo(
    () => [
      { title: '#', width: 45, key: 'index', render: (_, __, i) => i + 1 },
      { title: 'Item Code', dataIndex: 'itemCode', key: 'itemCode', width: 140 },
      { title: 'Description', dataIndex: 'description', key: 'description', width: 200, ellipsis: true },
      { title: 'Color', dataIndex: 'color', key: 'color', width: 90 },
      { title: 'Size', dataIndex: 'size', key: 'size', width: 80 },
      { title: 'PO Qty', dataIndex: 'poQty', key: 'poQty', width: 90, align: 'center', render: (v) => formatNumber(v) },
      { title: 'Already Recd', dataIndex: 'alreadyReceived', key: 'alreadyReceived', width: 100, align: 'center', render: (v) => formatNumber(v) },
      { title: 'Balance', dataIndex: 'balance', key: 'balance', width: 90, align: 'center', render: (v) => <Text style={{ color: 'var(--primary-color)' }}>{formatNumber(v)}</Text> },
      {
        title: 'Receiving Qty', dataIndex: 'receivingQty', key: 'receivingQty', width: 120,
        render: (val, record, i) => (
          <InputNumber value={val} onChange={(v) => onItemChange(i, 'receivingQty', v)} style={{ width: '100%' }} min={0} max={record.balance} {...numericInputProps} />
        ),
      },
      { title: 'UOM', dataIndex: 'uom', key: 'uom', width: 70 },
      { title: 'Rate', dataIndex: 'rate', key: 'rate', width: 80, align: 'right', render: (v) => formatNumber(v, 2) },
      {
        title: 'Amount', key: 'amount', width: 110, align: 'right',
        render: (_, record) => {
          const amt = (record.receivingQty || 0) * (record.rate || 0);
          return <Text strong style={{ color: 'var(--success-color)' }}>{formatNumber(amt, 2)}</Text>;
        },
      },
    ],
    [onItemChange],
  );

  const totals = useMemo(() => {
    const totalRecQty = items.reduce((sum, item) => sum + (item.receivingQty || 0), 0);
    const totalAmount = items.reduce((sum, item) => sum + (item.receivingQty || 0) * (item.rate || 0), 0);
    return { totalRecQty, totalAmount };
  }, [items]);

  return (
    <Table
      rowKey="id"
      columns={columns}
      dataSource={items}
      pagination={false}
      scroll={{ x: 1200 }}
      size="small"
      summary={() => (
        <Table.Summary fixed>
          <Table.Summary.Row style={{ background: 'var(--bg-secondary)' }}>
            <Table.Summary.Cell index={0} colSpan={8}><Text strong>Totals</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={1} align="center"><Text strong>{formatNumber(totals.totalRecQty)}</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={2} colSpan={2} />
            <Table.Summary.Cell index={3} align="right"><Text strong style={{ color: 'var(--success-color)' }}>{formatNumber(totals.totalAmount, 2)}</Text></Table.Summary.Cell>
          </Table.Summary.Row>
        </Table.Summary>
      )}
    />
  );
};

export default AccessoriesGRNItemTable;
