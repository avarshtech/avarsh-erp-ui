import { memo, useMemo } from 'react';
import { Card, Tag, Table } from 'antd';
import StatusTag from '../../../components/StatusTag';
import { STOCK_STATUS_CONFIG } from '../../../utils/statusConfig';
import { STOCK_STATUS, getInventoryStatusLabel } from '../../../utils/inventoryConstants';
import { formatNumber } from '../../../utils/formatters';

const miniColumns = [
  {
    title: 'Roll #',
    dataIndex: 'rollNumber',
    key: 'rollNumber',
    width: 80,
  },
  {
    title: 'Weight',
    dataIndex: 'weight',
    key: 'weight',
    width: 80,
    align: 'right',
    render: (v) => formatNumber(v, 1),
  },
  {
    title: 'Width',
    dataIndex: 'width',
    key: 'width',
    width: 70,
    align: 'right',
  },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    render: (status) => (
      <StatusTag status={status} config={STOCK_STATUS_CONFIG} getLabel={getInventoryStatusLabel} size="small" />
    ),
  },
  {
    title: 'Age',
    dataIndex: 'ageDays',
    key: 'ageDays',
    width: 60,
    align: 'center',
    render: (d) => `${d}d`,
  },
];

const ShadeLotGroupCard = memo(function ShadeLotGroupCard({ shadeLot, rolls }) {
  const stats = useMemo(() => {
    const totalWeight = rolls.reduce((sum, r) => sum + (r.weight || 0), 0);
    const avgGsm = rolls.reduce((sum, r) => sum + (r.gsm || 0), 0) / (rolls.length || 1);
    const avgWidth = rolls.reduce((sum, r) => sum + (r.width || 0), 0) / (rolls.length || 1);
    return { totalWeight, avgGsm, avgWidth };
  }, [rolls]);

  const allInStock = rolls.every((r) => r.status === STOCK_STATUS.IN_STOCK);
  const accentColor = allInStock ? 'var(--success-color)' : 'var(--warning-color)';
  const fabricDesc = rolls[0]?.fabricDescription || 'Unknown Fabric';

  return (
    <Card
      size="small"
      style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', height: '100%' }}
      styles={{ body: { padding: 16 } }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accentColor }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Tag color="blue">{shadeLot}</Tag>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {fabricDesc}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
        <div><small style={{ color: 'var(--text-secondary)' }}>Rolls</small><div style={{ fontWeight: 600 }}>{rolls.length}</div></div>
        <div><small style={{ color: 'var(--text-secondary)' }}>Weight</small><div style={{ fontWeight: 600 }}>{formatNumber(stats.totalWeight, 1)} kg</div></div>
        <div><small style={{ color: 'var(--text-secondary)' }}>Avg GSM</small><div style={{ fontWeight: 600 }}>{formatNumber(stats.avgGsm, 0)}</div></div>
        <div><small style={{ color: 'var(--text-secondary)' }}>Avg Width</small><div style={{ fontWeight: 600 }}>{formatNumber(stats.avgWidth, 0)}"</div></div>
      </div>
      <Table
        rowKey="id"
        columns={miniColumns}
        dataSource={rolls}
        size="small"
        pagination={false}
        scroll={{ y: 200 }}
      />
    </Card>
  );
});

export default ShadeLotGroupCard;
