import { memo } from 'react';
import { Tag, Tooltip } from 'antd';
import { HEALTH } from '../../../utils/tnaConstants';

/** Order health (§11.6) — driven by forecast against commitment, not by counting late activities. */
const HealthTag = memo(function HealthTag({ health, suffix }) {
  const h = HEALTH[health];
  if (!h) return null;
  return (
    <Tooltip title={h.meaning}>
      <Tag color={h.color} style={{ borderRadius: 'var(--radius-full)', marginInlineEnd: 0 }}>
        {h.label}{suffix ? ` ${suffix}` : ''}
      </Tag>
    </Tooltip>
  );
});

export default HealthTag;
