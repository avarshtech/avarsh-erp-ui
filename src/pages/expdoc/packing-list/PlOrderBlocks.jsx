import { useState } from 'react';
import {
  Alert, Button, Collapse, Space, Typography,
} from 'antd';
import PlPoGroup from './PlPoGroup';
import { BlockLabel, BlockActions } from './PlOrderBlockHeader';
import { unplacedText } from './plUnitRows';

const { Text } = Typography;

/** A block needs nothing more: on the shipment, every PO packed, nothing new to add. */
const isComplete = (b) => b.onShipment && !b.unreadable && !b.unplaced.length
  && b.pos.every((p) => p.onShipment && p.rows.length && !p.offers.length
    && !(p.plan?.rows || []).some((r) => r.toPack.length || r.differs.length));

/** Above this many orders, complete blocks start folded so the ones needing work stand out. */
const FOLD_ABOVE = 5;

/**
 * The cartons of a packing list, one block per order of its shipment and one group per
 * buyer PO inside (owner, 2026-10-09). Every block starts open — a list is opened to read
 * its cartons — unless the shipment carries many orders, when the complete ones fold to
 * their header line. Every action goes through the workspace's `run`.
 */
const PlOrderBlocks = ({
  pl, issuesByRow, editable, busy, onAdd, onRemove, onMove, onDrop, onEditPlan, onNotShipping,
}) => {
  const blocks = pl.blocks || [];
  const [open, setOpen] = useState(() => blocks
    .filter((b) => blocks.length <= FOLD_ABOVE || !isComplete(b)).map((b) => String(b.orderId)));

  if (!blocks.length) return <Text type="secondary">This shipment carries no orders.</Text>;

  const items = blocks.map((block, i) => ({
    key: String(block.orderId),
    label: <BlockLabel block={block} />,
    extra: editable ? (
      <BlockActions block={block} first={i === 0} last={i === blocks.length - 1} busy={busy} onMove={onMove} onDrop={onDrop} />
    ) : null,
    children: (
      <>
        {block.unreadable && (
          <Alert type="warning" showIcon style={{ marginBottom: 12 }} title="Packed cartons cannot be read"
            description="You need Carton Packing view access to see this order's packing. What the list already holds is kept." />
        )}
        {unplacedText([block]) && (
          <Alert type="warning" showIcon style={{ marginBottom: 12 }} title="Cartons without a buyer PO" description={unplacedText([block])} />
        )}
        {editable && block.onShipment && (
          <Button size="small" style={{ marginBottom: 12 }} onClick={() => onEditPlan(block)}>
            {block.planRows.length ? "Edit buyer's plan" : "Enter buyer's plan"}
          </Button>
        )}
        {block.pos.map((po) => (
          <PlPoGroup key={po.key ?? 'whole'} po={po} pl={pl} issuesByRow={issuesByRow} editable={editable}
            busy={busy} onAdd={onAdd} onRemove={onRemove}
            onNotShipping={(plan, mark) => onNotShipping(block, plan, mark)} />
        ))}
      </>
    ),
  }));

  return (
    <Space orientation="vertical" size={8} style={{ width: '100%' }}>
      <Space size={4}>
        <Button size="small" type="link" onClick={() => setOpen(blocks.map((b) => String(b.orderId)))}>Expand all</Button>
        <Button size="small" type="link" onClick={() => setOpen([])}>Collapse all</Button>
      </Space>
      <Collapse activeKey={open} onChange={setOpen} items={items} />
    </Space>
  );
};

export default PlOrderBlocks;
