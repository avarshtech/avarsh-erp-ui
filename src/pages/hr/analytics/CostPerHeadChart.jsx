import { useMemo } from 'react';
import { Typography, theme } from 'antd';
import { formatRupees } from './bridgeFormat';

const { Text } = Typography;

const W = 840;
const H = 250;
const PAD = { top: 18, right: 14, bottom: 32, left: 14 };

/**
 * Headcount as bars, cost per head as a line, on one set of periods.
 *
 * The whole question is which of the two moved, so they belong on one picture
 * where that is a shape rather than a comparison the reader has to do in their
 * head across two tables.
 *
 * Hand-drawn rather than pulled from a charting library: this is the only chart
 * in the module so far, and adding a dependency for it is a decision worth
 * making deliberately once several screens need one.
 */
const CostPerHeadChart = ({ points }) => {
  const { token } = theme.useToken();

  const geometry = useMemo(() => {
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const band = plotW / Math.max(points.length, 1);

    const heads = points.map((p) => p.headcount || 0);
    const rates = points.map((p) => Number(p.costPerHead) || 0);
    const headMax = Math.max(...heads, 1) * 1.15;
    // The line's axis is padded around its own range rather than anchored at
    // zero: a few percent of movement in cost per head is the signal here, and
    // a zero baseline would flatten it into a straight line.
    const rateMin = Math.min(...rates);
    const rateMax = Math.max(...rates);
    const spread = (rateMax - rateMin) || Math.max(rateMax, 1) * 0.1;
    const lo = rateMin - spread * 0.35;
    const hi = rateMax + spread * 0.35;

    return {
      band,
      barX: (i) => PAD.left + band * i + band * 0.28,
      barW: band * 0.44,
      barY: (v) => PAD.top + plotH - (v / headMax) * plotH,
      barH: (v) => (v / headMax) * plotH,
      lineX: (i) => PAD.left + band * i + band / 2,
      lineY: (v) => PAD.top + plotH - ((v - lo) / (hi - lo)) * plotH,
      rateLo: lo, rateHi: hi, plotH,
    };
  }, [points]);

  if (!points.length) return null;

  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${geometry.lineX(i)} ${geometry.lineY(Number(p.costPerHead) || 0)}`)
    .join(' ');

  const summary = `Headcount from ${points[0].headcount} to ${points[points.length - 1].headcount}, `
    + `cost per head from ${formatRupees(points[0].costPerHead)} to `
    + `${formatRupees(points[points.length - 1].costPerHead)}.`;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary}
        style={{ width: '100%', height: 'auto', display: 'block' }}>
        <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + geometry.plotH} y2={PAD.top + geometry.plotH}
          stroke={token.colorBorderSecondary} strokeWidth="1" />

        {points.map((p, i) => (
          <rect key={`bar-${p.label}`}
            x={geometry.barX(i)} y={geometry.barY(p.headcount || 0)}
            width={geometry.barW} height={geometry.barH(p.headcount || 0)}
            fill={token.colorFillSecondary} rx="2">
            <title>{`${p.label}: ${p.headcount} paid`}</title>
          </rect>
        ))}

        <path d={path} fill="none" stroke={token.colorPrimary} strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round" />

        {points.map((p, i) => (
          <circle key={`dot-${p.label}`}
            cx={geometry.lineX(i)} cy={geometry.lineY(Number(p.costPerHead) || 0)}
            r="3.5" fill={token.colorBgContainer} stroke={token.colorPrimary} strokeWidth="2">
            <title>{`${p.label}: ${formatRupees(p.costPerHead)} per head`}</title>
          </circle>
        ))}

        {points.map((p, i) => (
          <text key={`lbl-${p.label}`} x={geometry.lineX(i)} y={H - 12}
            textAnchor="middle" fontSize="11" fill={token.colorTextTertiary}>
            {points.length > 14 ? p.label.slice(0, 3) : p.label}
          </text>
        ))}
      </svg>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 4 }}>
        <Key colour={token.colorFillSecondary} label="Headcount paid" square />
        <Key colour={token.colorPrimary} label="Cost per head" />
        <Text type="secondary" style={{ fontSize: 12 }}>
          The cost per head axis is scaled to its own range, not from zero.
        </Text>
      </div>
    </div>
  );
};

const Key = ({ colour, label, square }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
    <span style={{
      width: square ? 10 : 14, height: square ? 10 : 3,
      borderRadius: square ? 2 : 2, background: colour,
    }} />
    <Text type="secondary" style={{ fontSize: 12 }}>{label}</Text>
  </span>
);

export default CostPerHeadChart;
