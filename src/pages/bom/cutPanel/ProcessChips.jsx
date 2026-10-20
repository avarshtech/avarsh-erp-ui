import { memo, useState } from 'react';
import { Button, Tag, Tooltip } from 'antd';
import { HolderOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';

/**
 * Selected processes as sequence chips (PRD §8.2.2, AC-05): drag a chip to reorder, or
 * use the arrow buttons (keyboard-accessible). The chip order IS the process sequence.
 * `items`: [{ id, label }] in sequence order.
 */
const ProcessChips = memo(function ProcessChips({ items, onReorder, onRemove, disabled }) {
  const [dragIndex, setDragIndex] = useState(null);

  const move = (from, to) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onReorder(next.map((i) => i.id));
  };

  if (!items.length) return null;
  return (
    <div role="list" aria-label="Process sequence" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
      {items.map((item, idx) => (
        <div
          key={item.id}
          role="listitem"
          draggable={!disabled}
          onDragStart={() => setDragIndex(idx)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => { if (dragIndex !== null) move(dragIndex, idx); setDragIndex(null); }}
          onDragEnd={() => setDragIndex(null)}
          style={{ opacity: dragIndex === idx ? 0.5 : 1, cursor: disabled ? 'default' : 'grab' }}
        >
          <Tag
            color="blue"
            closable={!disabled}
            onClose={(e) => { e.preventDefault(); onRemove(item.id); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 6px', margin: 0 }}
          >
            <HolderOutlined aria-hidden />
            <strong>{idx + 1}</strong>
            <span>{item.label}</span>
            <Tooltip title="Earlier">
              <Button type="text" size="small" icon={<LeftOutlined />} aria-label={`Move ${item.label} earlier`}
                disabled={disabled || idx === 0} onClick={() => move(idx, idx - 1)} style={{ height: 18, width: 18, minWidth: 18 }} />
            </Tooltip>
            <Tooltip title="Later">
              <Button type="text" size="small" icon={<RightOutlined />} aria-label={`Move ${item.label} later`}
                disabled={disabled || idx === items.length - 1} onClick={() => move(idx, idx + 1)} style={{ height: 18, width: 18, minWidth: 18 }} />
            </Tooltip>
          </Tag>
        </div>
      ))}
    </div>
  );
});

export default ProcessChips;
