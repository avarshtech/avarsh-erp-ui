import { memo } from 'react';
import { Tooltip } from 'antd';

/**
 * Deviation display (§12.1) — null while the activity is open, NEVER zero
 * (limitation L3). Positive = late, shown red with an explicit "+".
 */
const DeviationCell = memo(function DeviationCell({ deviationDays, vsLabel = 'baseline' }) {
  if (deviationDays == null) {
    return (
      <Tooltip title={`Deviation vs ${vsLabel} is computed only once an actual date exists`}>
        <span style={{ color: 'var(--text-muted)' }}>—</span>
      </Tooltip>
    );
  }
  const late = deviationDays > 0;
  return (
    <Tooltip title={`Actual − ${vsLabel} date. Positive means late.`}>
      <span style={{
        fontVariantNumeric: 'tabular-nums', fontWeight: 600,
        color: late ? 'var(--error-color)' : 'var(--success-color)',
      }}
      >
        {late ? `+${deviationDays}d` : deviationDays === 0 ? 'On time' : `${deviationDays}d`}
      </span>
    </Tooltip>
  );
});

export default DeviationCell;
