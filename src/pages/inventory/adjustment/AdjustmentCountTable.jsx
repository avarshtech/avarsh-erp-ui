import { memo, useMemo } from 'react';
import { Table, InputNumber, Input, Typography } from 'antd';
import { numericInputProps } from '../../../utils/inputHelpers';
import { formatNumber } from '../../../utils/formatters';

const { Text } = Typography;

const getVarianceColor = (pct) => {
  const abs = Math.abs(pct || 0);
  if (abs > 10) return 'var(--error-color)';
  if (abs > 5) return 'var(--warning-color)';
  return 'var(--success-color)';
};

const AdjustmentCountTable = memo(function AdjustmentCountTable({ items = [], onItemChange, readOnly = false }) {
  const columns = useMemo(() => [
    { title: 'Item / Roll ID', dataIndex: 'itemId', key: 'itemId', width: 100 },
    { title: 'Description', dataIndex: 'description', key: 'description', width: 240, ellipsis: true },
    { title: 'UOM', dataIndex: 'uom', key: 'uom', width: 80, align: 'center' },
    { title: 'System Qty', dataIndex: 'systemQty', key: 'systemQty', width: 110, align: 'right', render: (v) => formatNumber(v, 2) },
    {
      title: 'Physical Count', dataIndex: 'physicalCount', key: 'physicalCount', width: 130, align: 'right',
      render: (val, record, index) => readOnly
        ? formatNumber(val, 2)
        : <InputNumber value={val} min={0} style={{ width: '100%' }} {...numericInputProps} onChange={(v) => onItemChange?.(index, 'physicalCount', v)} />,
    },
    {
      title: 'Variance', key: 'variance', width: 110, align: 'right',
      render: (_, record) => {
        const v = (record.physicalCount ?? 0) - (record.systemQty ?? 0);
        return <Text strong style={{ color: v < 0 ? 'var(--error-color)' : v > 0 ? 'var(--success-color)' : undefined }}>{formatNumber(v, 2)}</Text>;
      },
    },
    {
      title: 'Variance %', key: 'variancePct', width: 110, align: 'right',
      render: (_, record) => {
        const sys = record.systemQty || 0;
        const pct = sys === 0 ? (record.physicalCount ? 100 : 0) : (((record.physicalCount ?? 0) - sys) / sys) * 100;
        return <Text strong style={{ color: getVarianceColor(pct) }}>{formatNumber(pct, 1)}%</Text>;
      },
    },
    {
      title: 'Remarks', dataIndex: 'remarks', key: 'remarks', width: 180,
      render: (val, _, index) => readOnly
        ? (val || '\u2014')
        : <Input value={val} placeholder="Remarks" onChange={(e) => onItemChange?.(index, 'remarks', e.target.value)} />,
    },
  ], [readOnly, onItemChange]);

  const summary = useMemo(() => {
    const totalSystem = items.reduce((s, i) => s + (i.systemQty || 0), 0);
    const totalPhysical = items.reduce((s, i) => s + (i.physicalCount ?? 0), 0);
    const netVariance = totalPhysical - totalSystem;
    const avgPct = items.length ? items.reduce((s, i) => {
      const sys = i.systemQty || 0;
      return s + (sys === 0 ? (i.physicalCount ? 100 : 0) : (((i.physicalCount ?? 0) - sys) / sys) * 100);
    }, 0) / items.length : 0;
    return { totalSystem, totalPhysical, netVariance, avgPct };
  }, [items]);

  return (
    <Table
      rowKey="itemId"
      columns={columns}
      dataSource={items}
      pagination={false}
      size="small"
      scroll={{ x: 960 }}
      rowClassName={(record) => {
        const sys = record.systemQty || 0;
        const pct = sys === 0 ? (record.physicalCount ? 100 : 0) : Math.abs(((record.physicalCount ?? 0) - sys) / sys) * 100;
        return pct > 10 ? 'row-variance-high' : '';
      }}
      summary={() => (
        <Table.Summary fixed>
          <Table.Summary.Row style={{ background: 'var(--bg-secondary, #fafafa)', fontWeight: 600 }}>
            <Table.Summary.Cell index={0} colSpan={3}>Totals</Table.Summary.Cell>
            <Table.Summary.Cell index={3} align="right">{formatNumber(summary.totalSystem, 2)}</Table.Summary.Cell>
            <Table.Summary.Cell index={4} align="right">{formatNumber(summary.totalPhysical, 2)}</Table.Summary.Cell>
            <Table.Summary.Cell index={5} align="right"><Text style={{ color: summary.netVariance < 0 ? 'var(--error-color)' : 'var(--success-color)' }}>{formatNumber(summary.netVariance, 2)}</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={6} align="right"><Text style={{ color: getVarianceColor(summary.avgPct) }}>{formatNumber(summary.avgPct, 1)}%</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={7} />
          </Table.Summary.Row>
        </Table.Summary>
      )}
    />
  );
});

export default AdjustmentCountTable;
