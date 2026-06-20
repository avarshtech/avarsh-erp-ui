import { useMemo, useCallback } from 'react';
import { Table, InputNumber, Typography } from 'antd';
import { numericInputProps } from '../../utils/inputHelpers';

const { Text } = Typography;

const SizeColorMatrix = ({ items, onChange, editable = true, allowanceEditable = true }) => {
  const handleFieldChange = useCallback((index, field, value) => {
    const updated = [...items];
    const item = { ...updated[index] };
    item[field] = value;
    if (field === 'allowancePercent') {
      item.plannedQty = Math.ceil((item.orderQty || 0) * (1 + (value || 0) / 100));
    }
    updated[index] = item;
    onChange(updated);
  }, [items, onChange]);

  const columns = useMemo(() => [
    { title: 'Color', dataIndex: 'color', key: 'color', width: 120 },
    { title: 'Size', dataIndex: 'size', key: 'size', width: 80 },
    { title: 'Order Qty', dataIndex: 'orderQty', key: 'orderQty', width: 100, align: 'right',
      render: (q) => (q || 0).toLocaleString() },
    { title: 'Allowance %', dataIndex: 'allowancePercent', key: 'allowancePercent', width: 120, align: 'right',
      render: (val, _, index) => (editable && allowanceEditable)
        ? <InputNumber size="small" min={0} max={50} value={val} onChange={(v) => handleFieldChange(index, 'allowancePercent', v)} style={{ width: 80 }} {...numericInputProps} />
        : `${val || 0}%`,
    },
    { title: 'Planned Qty', dataIndex: 'plannedQty', key: 'plannedQty', width: 110, align: 'right',
      render: (q) => <Text strong>{(q || 0).toLocaleString()}</Text> },
    { title: 'Rate/Pc', dataIndex: 'ratePerPiece', key: 'ratePerPiece', width: 120, align: 'right',
      render: (val, _, index) => editable
        ? <InputNumber size="small" min={0} precision={2} value={val} onChange={(v) => handleFieldChange(index, 'ratePerPiece', v)} style={{ width: 100 }} {...numericInputProps} />
        : (val || 0).toFixed(2),
    },
    { title: 'Total Cost', key: 'totalCost', width: 120, align: 'right',
      render: (_, r) => <Text strong>{((r.plannedQty || 0) * (r.ratePerPiece || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text> },
  ], [handleFieldChange, editable, allowanceEditable]);

  const totals = useMemo(() => ({
    orderQty: items.reduce((s, i) => s + (i.orderQty || 0), 0),
    plannedQty: items.reduce((s, i) => s + (i.plannedQty || 0), 0),
    cost: items.reduce((s, i) => s + (i.plannedQty || 0) * (i.ratePerPiece || 0), 0),
  }), [items]);

  return (
    <Table
      rowKey={(r, i) => `${r.color}-${r.size}-${i}`}
      columns={columns}
      dataSource={items}
      pagination={false}
      size="small"
      scroll={{ x: 800 }}
      summary={() => (
        <Table.Summary fixed>
          <Table.Summary.Row>
            <Table.Summary.Cell index={0} colSpan={2}><Text strong>Totals</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={2} align="right"><Text strong>{totals.orderQty.toLocaleString()}</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={3} />
            <Table.Summary.Cell index={4} align="right"><Text strong>{totals.plannedQty.toLocaleString()}</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={5} />
            <Table.Summary.Cell index={6} align="right"><Text strong>{totals.cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text></Table.Summary.Cell>
          </Table.Summary.Row>
        </Table.Summary>
      )}
    />
  );
};

export default SizeColorMatrix;
