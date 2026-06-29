import { useMemo } from 'react';
import { Table, Input, InputNumber, Button, Space, Typography } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import ItemPicker from './ItemPicker';

const { Text } = Typography;

/**
 * Inline-editable table for fabric opening-stock rolls.
 *
 * Each row captures:
 *   item (picker) → rollNumber, width, gsm, shadeLot, quantity, uomSymbol, unitCost, styleRef, remarks
 *
 * Unlike the GRN roll table, there's no PO line grouping — opening stock is
 * flat. Parent form owns the rows[] state; this component just renders +
 * forwards edits via onChange(index, patch).
 */
const OpeningStockFabricRollTable = ({ rows = [], onChange, onAdd, onRemove, readOnly = false }) => {
  const totals = useMemo(() => {
    let qty = 0;
    let value = 0;
    rows.forEach((r) => {
      const q = Number(r.quantity) || 0;
      const c = Number(r.unitCost) || 0;
      qty += q;
      value += q * c;
    });
    return { qty, value, count: rows.length };
  }, [rows]);

  const patch = (idx, changes) => onChange?.(idx, changes);

  const columns = useMemo(() => [
    { title: '#', key: 'idx', width: 40, render: (_, __, i) => i + 1 },
    {
      title: 'Item', dataIndex: 'itemCode', width: 240,
      render: (_, row, i) => readOnly ? (
        <Text>{row.itemCode}</Text>
      ) : (
        <ItemPicker
          value={row.itemId}
          onChange={(id, item) => patch(i, {
            itemId: id,
            itemCode: item?.itemCode,
            fabricDescription: item?.itemName,
            uomId: item?.uom?.id,
            uomSymbol: item?.uom?.symbol,
          })}
        />
      ),
    },
    {
      title: 'Roll #', dataIndex: 'rollNumber', width: 120,
      render: (_, row, i) => readOnly ? row.rollNumber : (
        <Input size="small" value={row.rollNumber}
               onChange={(e) => patch(i, { rollNumber: e.target.value })} />
      ),
    },
    {
      title: 'Width', dataIndex: 'width', width: 80,
      render: (_, row, i) => readOnly ? row.width : (
        <InputNumber size="small" value={row.width} min={0} style={{ width: '100%' }}
                     onChange={(v) => patch(i, { width: v })} />
      ),
    },
    {
      title: 'GSM', dataIndex: 'gsm', width: 80,
      render: (_, row, i) => readOnly ? row.gsm : (
        <InputNumber size="small" value={row.gsm} min={0} style={{ width: '100%' }}
                     onChange={(v) => patch(i, { gsm: v })} />
      ),
    },
    {
      title: 'Shade Lot', dataIndex: 'shadeLot', width: 100,
      render: (_, row, i) => readOnly ? row.shadeLot : (
        <Input size="small" value={row.shadeLot}
               onChange={(e) => patch(i, { shadeLot: e.target.value })} />
      ),
    },
    {
      title: 'Qty', dataIndex: 'quantity', width: 100,
      render: (_, row, i) => readOnly ? row.quantity : (
        <InputNumber size="small" value={row.quantity} min={0.001} precision={3} style={{ width: '100%' }}
                     onChange={(v) => patch(i, { quantity: v })} />
      ),
    },
    {
      title: 'UOM', dataIndex: 'uomSymbol', width: 70,
      render: (_, row) => <Text type="secondary">{row.uomSymbol || '—'}</Text>,
    },
    {
      title: 'Unit Cost', dataIndex: 'unitCost', width: 110,
      render: (_, row, i) => readOnly ? row.unitCost : (
        <InputNumber size="small" value={row.unitCost} min={0} precision={2} style={{ width: '100%' }}
                     onChange={(v) => patch(i, { unitCost: v })} />
      ),
    },
    {
      title: 'Style Ref', dataIndex: 'styleRef', width: 100,
      render: (_, row, i) => readOnly ? row.styleRef : (
        <Input size="small" value={row.styleRef}
               onChange={(e) => patch(i, { styleRef: e.target.value })} />
      ),
    },
    !readOnly && {
      title: '', key: 'actions', width: 50,
      render: (_, __, i) => (
        <Button type="text" danger size="small" icon={<DeleteOutlined />}
                onClick={() => onRemove?.(i)} />
      ),
    },
  ].filter(Boolean), [readOnly, onRemove]);

  return (
    <div>
      <Table
        size="small"
        rowKey={(_, i) => `row-${i}`}
        dataSource={rows}
        columns={columns}
        pagination={false}
        scroll={{ x: 1100 }}
        locale={{ emptyText: 'No rolls added yet. Click "Add Roll" or upload a CSV.' }}
      />
      <Space style={{ marginTop: 12, justifyContent: 'space-between', width: '100%' }}>
        {!readOnly && (
          <Button icon={<PlusOutlined />} onClick={onAdd} size="small">Add Roll</Button>
        )}
        <Space>
          <Text type="secondary">Rows: <strong>{totals.count}</strong></Text>
          <Text type="secondary">Total Qty: <strong>{totals.qty.toFixed(3)}</strong></Text>
          <Text type="secondary">Total Value: <strong>₹{totals.value.toFixed(2)}</strong></Text>
        </Space>
      </Space>
    </div>
  );
};

export default OpeningStockFabricRollTable;
