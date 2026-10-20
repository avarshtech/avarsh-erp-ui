import { memo } from 'react';
import { Tag, Tooltip } from 'antd';
import { signedDays } from '../../../utils/tnaConstants';

/**
 * A signed day count. tone="delay": positive is late (red), negative early (green).
 * tone="movement": a commitment change — its own colour, never read as a delay (FR-7.6).
 * null renders as an em dash, never as zero (§11.1).
 */
const DeltaTag = memo(function DeltaTag({ value, unit = 'CD', tone = 'delay', tip }) {
  if (value == null) {
    return (
      <Tooltip title={tip || 'Not computable yet'}>
        <span style={{ color: 'var(--text-muted)' }}>—</span>
      </Tooltip>
    );
  }
  let color = 'default';
  if (tone === 'movement') color = value ? 'blue' : 'default';
  else if (value > 0) color = 'red';
  else if (value < 0) color = 'green';
  const tag = (
    <Tag color={color} style={{ fontVariantNumeric: 'tabular-nums', marginInlineEnd: 0, borderRadius: 'var(--radius-full)' }}>
      {signedDays(value, unit)}
    </Tag>
  );
  return tip ? <Tooltip title={tip}>{tag}</Tooltip> : tag;
});

export default DeltaTag;
