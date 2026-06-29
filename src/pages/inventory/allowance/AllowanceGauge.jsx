import { memo, useMemo } from 'react';

// Semicircle arc gauge showing how far the actual over-supply % has pushed past
// the master allowance %. Purely SVG — no chart library.
//   - Background arc: muted.
//   - Progress arc: filled from 0° to (overPct / scaleMax). Amber by default,
//     red when severity === 'high' (overPct >= allowedPct * 2).
//   - Threshold tick: small green pip at (allowedPct / scaleMax).
//   - Center label: ↑ overPct% (big) + allowed allowedPct% (muted).
const AllowanceGauge = memo(function AllowanceGauge({ overPct, allowedPct, severity = 'medium', size = 148 }) {
  const scaleMax = Math.max((allowedPct || 1) * 3, overPct * 1.15, 1);

  const arcGeom = useMemo(() => {
    const r = size / 2 - 10;
    const cx = size / 2;
    const cy = size / 2 + 4;
    const toPoint = (pct) => {
      const ratio = Math.max(0, Math.min(1, pct / scaleMax));
      const angle = Math.PI * (1 - ratio); // 180° → 0°
      return { x: cx + r * Math.cos(angle), y: cy - r * Math.sin(angle) };
    };
    const describeArc = (startPct, endPct) => {
      const s = toPoint(startPct);
      const e = toPoint(endPct);
      const largeArc = 0;
      const sweep = 1;
      return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} ${sweep} ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
    };
    return { r, cx, cy, toPoint, describeArc };
  }, [size, scaleMax]);

  const progressColor = severity === 'high' ? 'var(--error-color, #ff4d4f)' : 'var(--warning-color, #faad14)';
  const tick = arcGeom.toPoint(allowedPct);
  const tickInner = (() => {
    const ratio = Math.max(0, Math.min(1, allowedPct / scaleMax));
    const angle = Math.PI * (1 - ratio);
    const rInner = arcGeom.r - 10;
    return { x: arcGeom.cx + rInner * Math.cos(angle), y: arcGeom.cy - rInner * Math.sin(angle) };
  })();

  return (
    <svg width={size} height={size * 0.72} viewBox={`0 0 ${size} ${size * 0.72}`} role="img" aria-label={`Over allowance ${overPct.toFixed(1)} percent, allowed ${allowedPct.toFixed(1)} percent`}>
      <path d={arcGeom.describeArc(0, scaleMax)} fill="none" stroke="var(--border-color, #e5e7eb)" strokeWidth={12} strokeLinecap="round" />
      <path d={arcGeom.describeArc(0, Math.min(overPct, scaleMax))} fill="none" stroke={progressColor} strokeWidth={12} strokeLinecap="round" />
      <line x1={tick.x} y1={tick.y} x2={tickInner.x} y2={tickInner.y} stroke="var(--success-color, #52c41a)" strokeWidth={3} strokeLinecap="round" />
      <text x={arcGeom.cx} y={arcGeom.cy - 14} textAnchor="middle" fontSize={22} fontWeight={700} fill={progressColor}>
        {`+${overPct.toFixed(1)}%`}
      </text>
      <text x={arcGeom.cx} y={arcGeom.cy + 4} textAnchor="middle" fontSize={10} fill="var(--text-secondary, #6b7280)" letterSpacing={0.4}>
        OVER ALLOWANCE
      </text>
      <text x={arcGeom.cx} y={arcGeom.cy + 18} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--success-color, #52c41a)">
        {`allowed ${allowedPct.toFixed(1)}%`}
      </text>
    </svg>
  );
});

export default AllowanceGauge;
