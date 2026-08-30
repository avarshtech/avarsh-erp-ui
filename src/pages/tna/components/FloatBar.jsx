import { memo } from 'react';
import { Tooltip } from 'antd';

/**
 * Float meter (§8.7) — the single most useful number the engine produces.
 * Green shrinking bar for positive slack, red block for zero, red overflow for
 * negative (over-committed). `max` sets the visual scale across sibling rows.
 */
const FloatBar = memo(function FloatBar({ floatDays, max = 30, width = 90 }) {
  const isNeg = floatDays < 0;
  const isZero = floatDays === 0;
  const pct = Math.min(100, (Math.abs(floatDays) / max) * 100);
  const color = isNeg || isZero ? 'var(--error-color)' : floatDays <= 3 ? 'var(--warning-color)' : 'var(--success-color)';
  return (
    <Tooltip title={`Float: latest allowable − planned = ${floatDays} day${Math.abs(floatDays) === 1 ? '' : 's'}. ${isNeg ? 'Over-committed — the plan is already past its latest allowable date.' : isZero ? 'Critical — any slip moves the ship date.' : 'Days this activity may slip before dispatch moves.'}`}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width, height: 6, borderRadius: 3, background: 'var(--bg-tertiary)', overflow: 'hidden', display: 'inline-block' }}>
          <span style={{ display: 'block', height: '100%', borderRadius: 3, background: color, width: `${isZero ? 100 : pct}%`, opacity: isZero ? 0.35 : 1 }} />
        </span>
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: isNeg || isZero ? 700 : 500, fontSize: 12, color: isNeg || isZero ? 'var(--error-color)' : 'var(--text-secondary)', minWidth: 28 }}>
          {floatDays}d
        </span>
      </span>
    </Tooltip>
  );
});

export default FloatBar;
