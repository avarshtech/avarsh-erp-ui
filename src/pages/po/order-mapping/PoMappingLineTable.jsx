import { useMemo } from 'react';
import { Table, Progress, Typography, Space, Tag, Popconfirm, Button, Empty, Tooltip } from 'antd';
import { DeleteOutlined, WarningOutlined } from '@ant-design/icons';
import { formatNumber, formatDate } from '../../../utils/formatters';
import AllocationAdder from './AllocationAdder';

const { Text } = Typography;

const qty = (v, uom) => (
  <Text style={{ fontFamily: 'var(--font-mono, monospace)' }}>{formatNumber(v, 3)}{uom ? <Text type="secondary" style={{ fontSize: 11 }}> {uom}</Text> : null}</Text>
);

/**
 * One PO line per row; the expanded row lists its order allocations and, if anything is
 * open, the adder.
 *
 * Adding and removing are separate rights. A PO that has left the mappable set — referred
 * back, cancelled — can no longer be mapped, but its existing allocations must still be
 * removable or they would be stranded behind a foreign key with no screen able to clear them.
 */
const PoMappingLineTable = ({ lines, canAdd, canRemove, onAdd, onRemove }) => {
  const columns = useMemo(() => [
    {
      title: 'Item', key: 'item', width: 260,
      render: (_, l) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontFamily: 'var(--font-mono, monospace)' }}>{l.itemCode}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{l.description}</Text>
        </Space>
      ),
    },
    {
      // A PO line has no colour or size of its own — both come from the variant's
      // attributes, whose names are configured per item type, so the variant code is
      // what always identifies the line.
      title: 'Colour / Size', key: 'variant', width: 140,
      render: (_, l) => [l.color, l.size].filter(Boolean).join(' · ') || l.variantCode || <Text type="secondary">-</Text>,
    },
    { title: 'PO Qty', dataIndex: 'qty', key: 'qty', align: 'right', width: 130, render: (v, l) => qty(v, l.uom) },
    { title: 'Received', dataIndex: 'receivedQty', key: 'receivedQty', align: 'right', width: 130, render: (v, l) => qty(v, l.uom) },
    {
      title: 'Mapped', dataIndex: 'mappedQty', key: 'mappedQty', align: 'right', width: 140,
      render: (v, l) => (
        <Space size={4}>
          {qty(v, l.uom)}
          {l.overAllocatedQty > 0 && (
            <Tooltip title={`${formatNumber(l.overAllocatedQty, 3)} ${l.uom || ''} more is mapped than has been received`}>
              <WarningOutlined style={{ color: 'var(--ant-color-warning, #faad14)' }} />
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: 'Open', dataIndex: 'unmappedQty', key: 'unmappedQty', align: 'right', width: 130,
      render: (v, l) => (v > 0 ? <Text type="warning">{formatNumber(v, 3)} {l.uom}</Text> : <Tag color="success" style={{ marginRight: 0 }}>Fully mapped</Tag>),
    },
    {
      title: 'Progress', dataIndex: 'mappedPercent', key: 'mappedPercent', width: 140,
      render: (p) => <Progress percent={p} size="small" status={p === 100 ? 'success' : 'active'} />,
    },
  ], []);

  const allocationColumns = useMemo(() => [
    {
      title: 'Order', key: 'order', width: 320,
      render: (_, a) => (
        <Space direction="vertical" size={0}>
          <Space size={6}>
            <Text strong delete={a.orderClosed} style={{ color: a.orderClosed ? undefined : 'var(--primary-color)' }}>{a.orderNo}</Text>
            {a.orderClosed && <Tag color="volcano" style={{ marginRight: 0 }}>{a.orderStatus}</Tag>}
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>{a.buyerName} · {a.styleNo} · {a.garmentName}</Text>
        </Space>
      ),
    },
    {
      title: 'Qty', dataIndex: 'qty', key: 'qty', align: 'right', width: 130,
      render: (v, a) => qty(v, lines.find((l) => l.id === a.poLineItemId)?.uom),
    },
    { title: 'Remarks', dataIndex: 'remarks', key: 'remarks', ellipsis: true, render: (v) => v || <Text type="secondary">-</Text> },
    {
      title: 'Mapped By', key: 'by', width: 210,
      render: (_, a) => <Text type="secondary" style={{ fontSize: 12 }}>{a.mappedBy} · {formatDate(a.mappedOn, 'DD-MMM-YYYY HH:mm')}</Text>,
    },
    ...(canRemove ? [{
      key: 'actions', width: 60, align: 'center',
      render: (_, a) => (
        <Popconfirm title="Remove this mapping?" description="The quantity returns to free stock." onConfirm={() => onRemove(a.id)} okText="Remove" okButtonProps={{ danger: true }}>
          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    }] : []),
  ], [canRemove, onRemove, lines]);

  return (
    <Table
      size="small"
      rowKey="id"
      columns={columns}
      dataSource={lines}
      pagination={false}
      scroll={{ x: 1000 }}
      expandable={{
        defaultExpandAllRows: true,
        expandedRowRender: (l) => (
          <div style={{ padding: '4px 8px 4px 24px' }}>
            {l.allocations.length ? (
              <Table size="small" rowKey="id" columns={allocationColumns} dataSource={l.allocations} pagination={false} showHeader={l.allocations.length > 0} />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Not mapped to any order — this quantity is free stock" style={{ margin: '8px 0' }} />
            )}
            {canAdd && l.unmappedQty > 0 && <AllocationAdder line={l} onAdd={onAdd} />}
          </div>
        ),
      }}
    />
  );
};

export default PoMappingLineTable;
