import { memo, useMemo } from 'react';
import { Table, InputNumber, Tag, Typography, Space } from 'antd';
import { numericInputProps } from '../../../utils/inputHelpers';
import { formatNumber } from '../../../utils/formatters';

const { Text } = Typography;

const TrimsQCAQLTable = memo(function TrimsQCAQLTable({
  items = [],
  onItemChange,
  aqlLevel = '2.5',
  sampleSize = 0,
}) {
  const columns = useMemo(
    () => [
      { title: 'Item Code', dataIndex: 'itemCode', key: 'itemCode', width: 160 },
      { title: 'Description', dataIndex: 'description', key: 'description', width: 240, ellipsis: true },
      {
        title: 'Sample Qty', dataIndex: 'sampleQty', key: 'sampleQty', width: 110, align: 'center',
        render: (val, _, idx) => (
          <InputNumber size="small" style={{ width: 80 }} value={val} min={0} onChange={(v) => onItemChange?.(idx, 'sampleQty', v)} {...numericInputProps} />
        ),
      },
      {
        title: 'Defects Found', dataIndex: 'defectsFound', key: 'defectsFound', width: 120, align: 'center',
        render: (val, _, idx) => (
          <InputNumber size="small" style={{ width: 80 }} value={val} min={0} onChange={(v) => onItemChange?.(idx, 'defectsFound', v)} {...numericInputProps} />
        ),
      },
      {
        title: 'Major', dataIndex: 'majorDefects', key: 'majorDefects', width: 90, align: 'center',
        render: (val, _, idx) => (
          <InputNumber size="small" style={{ width: 70 }} value={val || 0} min={0} onChange={(v) => onItemChange?.(idx, 'majorDefects', v)} {...numericInputProps} />
        ),
      },
      {
        title: 'Minor', dataIndex: 'minorDefects', key: 'minorDefects', width: 90, align: 'center',
        render: (val, _, idx) => (
          <InputNumber size="small" style={{ width: 70 }} value={val || 0} min={0} onChange={(v) => onItemChange?.(idx, 'minorDefects', v)} {...numericInputProps} />
        ),
      },
      {
        title: 'Result', dataIndex: 'result', key: 'result', width: 120, align: 'center',
        render: (val) => {
          if (!val || val === 'Pending') return <Tag>Pending</Tag>;
          const color = val === 'Pass' ? 'green' : val === 'Conditional Pass' ? 'orange' : 'red';
          return <Tag color={color}>{val}</Tag>;
        },
      },
    ],
    [onItemChange],
  );

  const summary = useMemo(() => {
    const totalDefects = items.reduce((s, i) => s + (i.defectsFound || 0), 0);
    const totalMajor = items.reduce((s, i) => s + (i.majorDefects || 0), 0);
    const totalMinor = items.reduce((s, i) => s + (i.minorDefects || 0), 0);
    return { totalDefects, totalMajor, totalMinor };
  }, [items]);

  return (
    <>
      <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--bg-secondary, #fafafa)', borderRadius: 'var(--radius-md, 6px)' }}>
        <Space size={24}>
          <Text type="secondary" style={{ fontSize: 13 }}>AQL Level: <Text strong>{aqlLevel}</Text></Text>
          <Text type="secondary" style={{ fontSize: 13 }}>Sample Size: <Text strong>{formatNumber(sampleSize)}</Text></Text>
        </Space>
      </div>
      <Table rowKey="itemCode" columns={columns} dataSource={items} pagination={false} scroll={{ x: 900 }} size="small" />
      <div style={{ marginTop: 12, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <Space size={8}>
          <Text type="secondary">Total Defects:</Text>
          <Text strong>{summary.totalDefects}</Text>
        </Space>
        <Space size={8}>
          <Text type="secondary">Major:</Text>
          <Text strong style={{ color: summary.totalMajor > 0 ? 'var(--error-color)' : undefined }}>{summary.totalMajor}</Text>
        </Space>
        <Space size={8}>
          <Text type="secondary">Minor:</Text>
          <Text strong style={{ color: summary.totalMinor > 0 ? 'var(--warning-color)' : undefined }}>{summary.totalMinor}</Text>
        </Space>
      </div>
    </>
  );
});

export default TrimsQCAQLTable;
