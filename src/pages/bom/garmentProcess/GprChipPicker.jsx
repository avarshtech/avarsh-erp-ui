import { memo } from 'react';
import { Button, Space, Tag, Typography } from 'antd';

const { Text } = Typography;

/**
 * Colour or size chips with Select all / Clear all (PRD §9). `items`: [{ value, label, extra }]
 * in the order's sequence; `selected`: selected values.
 */
const GprChipPicker = memo(function GprChipPicker({ label, items, selected, onChange, disabled }) {
  const set = new Set(selected);
  const toggle = (value, checked) => onChange(items.map((i) => i.value).filter((v) => (v === value ? checked : set.has(v))));
  return (
    <div style={{ marginBottom: 10 }}>
      <Space size={8} style={{ marginBottom: 4 }}>
        <Text strong>{label}</Text>
        {!disabled && (
          <>
            <Button type="link" size="small" style={{ padding: 0 }} onClick={() => onChange(items.map((i) => i.value))}>Select all</Button>
            <Button type="link" size="small" style={{ padding: 0 }} onClick={() => onChange([])}>Clear all</Button>
          </>
        )}
      </Space>
      <div role="group" aria-label={label} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {items.map((i) => {
          const checked = set.has(i.value);
          // CheckableTag renders a bare <span>: give it checkbox semantics and keyboard toggling.
          return (
            <Tag.CheckableTag
              key={i.value}
              checked={checked}
              role="checkbox"
              aria-checked={checked}
              aria-disabled={disabled || undefined}
              tabIndex={disabled ? -1 : 0}
              onChange={(next) => { if (!disabled) toggle(i.value, next); }}
              onKeyDown={(e) => { if (!disabled && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); toggle(i.value, !checked); } }}
              style={{ border: '1px solid var(--border-color, #d9d9d9)', padding: '2px 8px', cursor: disabled ? 'default' : 'pointer' }}
            >
              {i.label}{i.extra ? <span style={{ opacity: 0.75, marginLeft: 6 }}>{i.extra}</span> : null}
            </Tag.CheckableTag>
          );
        })}
      </div>
    </div>
  );
});

export default GprChipPicker;
