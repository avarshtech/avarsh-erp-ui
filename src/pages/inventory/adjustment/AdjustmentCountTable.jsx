import { memo, useMemo } from 'react';
import { Table, InputNumber, Input, Select, Typography, Tooltip } from 'antd';
import { numericInputProps } from '../../../utils/inputHelpers';
import { formatNumber } from '../../../utils/formatters';

const { Text } = Typography;

const varianceColor = (pct) => {
  const abs = Math.abs(pct || 0);
  if (abs > 10) return 'var(--error-color)';
  if (abs > 5) return 'var(--warning-color)';
  return 'var(--success-color)';
};

const computeVariance = (physical, inStock) => {
  const p = physical ?? 0;
  const s = inStock ?? 0;
  const variance = p - s;
  const variancePct = s === 0 ? (p ? 100 : 0) : (variance / s) * 100;
  return { variance, variancePct };
};

const AdjustmentCountTable = memo(function AdjustmentCountTable({ items = [], onItemChange, readOnly = false }) {
  const hasRollData = useMemo(
    () => items.some((i) => i.rollNumber || (i.availableRolls && i.availableRolls.length > 0)),
    [items],
  );

  const columns = useMemo(() => [
    { title: 'Item Code', dataIndex: 'itemCode', key: 'itemCode', width: 150, align: 'center' },
    {
      title: 'Item Name', dataIndex: 'itemName', key: 'itemName', width: 220, align: 'center', ellipsis: true,
      render: (v) => <Tooltip title={v}>{v}</Tooltip>,
    },
    { title: 'Variant', dataIndex: 'variantLabel', key: 'variantLabel', width: 160, align: 'center', ellipsis: true },
    ...(hasRollData ? [{
      title: 'Roll #', dataIndex: 'rollNumber', key: 'rollNumber', width: 140, align: 'center',
      render: (val, record, index) => {
        const rolls = record.availableRolls || [];
        if (readOnly || rolls.length <= 1) return val || '—';
        return (
          <Select
            size="small"
            style={{ width: '100%' }}
            value={val}
            options={rolls.map((r) => ({ value: r.rollNumber, label: r.rollNumber }))}
            onChange={(rollNumber) => {
              const picked = rolls.find((r) => r.rollNumber === rollNumber);
              onItemChange?.(index, { rollNumber, inStockQty: picked?.qty ?? 0 });
            }}
          />
        );
      },
    }] : []),
    {
      title: 'In-Stock Qty', key: 'inStockQty', width: 140, align: 'center',
      render: (_, r) => <Text>{formatNumber(r.inStockQty, 2)} <Text type="secondary">{r.uom}</Text></Text>,
    },
    {
      title: 'Physical Qty', dataIndex: 'physicalQty', key: 'physicalQty', width: 180, align: 'center',
      render: (val, record, index) => readOnly
        ? <Text>{formatNumber(val, 2)} <Text type="secondary">{record.uom}</Text></Text>
        : (
          <InputNumber
            value={val}
            min={0}
            controls={false}
            style={{ width: '100%' }}
            addonAfter={record.uom}
            {...numericInputProps}
            onChange={(v) => onItemChange?.(index, { physicalQty: v })}
          />
        ),
    },
    {
      title: 'Variance', key: 'variance', width: 110, align: 'center',
      render: (_, r) => {
        const { variance } = computeVariance(r.physicalQty, r.inStockQty);
        return (
          <Text strong style={{ color: variance < 0 ? 'var(--error-color)' : variance > 0 ? 'var(--success-color)' : undefined }}>
            {variance >= 0 ? '+' : ''}{formatNumber(variance, 2)}
          </Text>
        );
      },
    },
    {
      title: 'Variance %', key: 'variancePct', width: 110, align: 'center',
      render: (_, r) => {
        const { variancePct } = computeVariance(r.physicalQty, r.inStockQty);
        return <Text strong style={{ color: varianceColor(variancePct) }}>{formatNumber(variancePct, 1)}%</Text>;
      },
    },
    {
      title: 'Remarks', dataIndex: 'remarks', key: 'remarks', width: 200, align: 'center',
      render: (val, _, index) => readOnly
        ? (val || '—')
        : <Input value={val} placeholder="Remarks" onChange={(e) => onItemChange?.(index, { remarks: e.target.value })} />,
    },
  ], [readOnly, onItemChange, hasRollData]);

  return (
    <Table
      rowKey={(r) => `${r.itemCode}-${r.variantLabel}-${r.rollNumber ?? 'norol'}`}
      columns={columns}
      dataSource={items}
      pagination={false}
      size="small"
      scroll={{ x: 1300 }}
      rowClassName={(r) => {
        const { variancePct } = computeVariance(r.physicalQty, r.inStockQty);
        return Math.abs(variancePct) > 10 ? 'row-variance-high' : '';
      }}
    />
  );
});

export default AdjustmentCountTable;
