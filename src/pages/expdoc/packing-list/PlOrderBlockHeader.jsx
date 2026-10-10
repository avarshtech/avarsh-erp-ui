import { Button, Space, Tag, Tooltip, Typography } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined } from '@ant-design/icons';

const { Text } = Typography;

/** "Plan 80 · packed 40" will join this in the buyer's-plan increment; for now what is packed and offered. */
const chipOf = (block) => {
  const offered = block.pos.reduce((n, p) => n + p.offers.length, 0);
  const parts = [`${block.totals.cartons} ctn packed`];
  if (offered) parts.push(`${offered} new entr${offered === 1 ? 'y' : 'ies'} to add`);
  return parts.join(' · ');
};

const stop = (fn) => (e) => { e.stopPropagation(); fn(); };

/** An order block's header line, and on a draft its Move up / Move down and Drop. */
export const BlockLabel = ({ block }) => (
  <Space size={8} wrap>
    <Text strong>{[block.orderNo, block.styleNo, block.garmentName].filter(Boolean).join(' · ')}</Text>
    <Tag color={block.totals.cartons ? 'blue' : undefined}>{chipOf(block)}</Tag>
    {!block.onShipment && <Tag color="error">No longer on the shipment</Tag>}
    {block.unreadable && <Tag color="warning">Packing cannot be read</Tag>}
  </Space>
);

export const BlockActions = ({
  block, first, last, busy, onMove, onDrop,
}) => {
  const orphaned = !block.onShipment || block.pos.some((p) => !p.onShipment && (p.rows.length || p.plan?.rows?.length));
  return (
    <Space size={2}>
      <Tooltip title="Move up — under “continue”, carton numbers follow the block order">
        <Button size="small" type="text" icon={<ArrowUpOutlined />} aria-label="Move block up" disabled={first}
          loading={busy} onClick={stop(() => onMove(block.orderId, -1))} />
      </Tooltip>
      <Tooltip title="Move down">
        <Button size="small" type="text" icon={<ArrowDownOutlined />} aria-label="Move block down" disabled={last}
          loading={busy} onClick={stop(() => onMove(block.orderId, 1))} />
      </Tooltip>
      {orphaned && (
        <Tooltip title="Take the cartons of what the shipment no longer carries off this list">
          <Button size="small" danger icon={<DeleteOutlined />} loading={busy} onClick={stop(() => onDrop(block.orderId))}>
            Drop
          </Button>
        </Tooltip>
      )}
    </Space>
  );
};
