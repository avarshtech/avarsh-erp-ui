import { memo, useMemo } from 'react';
import { Card, Empty, Skeleton, Tooltip, Typography } from 'antd';
import { num, pct, toneOf, TONE } from './strengthFormat';

const { Text } = Typography;

const PRESENT = '#52c41a';
const ABSENT = '#ff7875';
const OTHER = '#bfbfbf';

/**
 * One stacked bar per unit - present, absent, then off and not marked - worst
 * Absent % first, so the unit that needs a call this morning is at the top.
 */
const StrengthUnitBars = memo(function StrengthUnitBars({ units = [], loading }) {
  const rows = useMemo(
    () => [...units].sort((a, b) => (b.total.absentPct ?? -1) - (a.total.absentPct ?? -1)),
    [units],
  );

  return (
    <Card title="Units at a glance" style={{ height: '100%' }} styles={{ body: { paddingTop: 12 } }}>
      {loading && <Skeleton active paragraph={{ rows: 4 }} />}
      {!loading && rows.length === 0 && <Empty description="Nobody on the roll" />}
      {!loading && rows.map((unit) => {
        const c = unit.total;
        const share = (v) => (c.strength ? (Number(v) / c.strength) * 100 : 0);
        const other = c.off + c.notMarked;
        const tone = TONE[toneOf(c.absentPct)];
        return (
          <div key={unit.unitId} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text strong>{unit.unitName}</Text>
              <Text style={{ fontSize: 12 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>{num(c.present)} / {num(c.strength)} present · </Text>
                <span style={{ color: tone.color, fontWeight: tone.color ? 600 : 400 }}>{pct(c.absentPct)} absent</span>
              </Text>
            </div>
            <Tooltip
              title={`Present ${num(c.present)} · Absent ${num(c.absent)}${c.off ? ` · Off ${c.off}` : ''}${c.notMarked ? ` · Not marked ${c.notMarked}` : ''}`}
            >
              <div
                role="img"
                aria-label={`${unit.unitName}: ${num(c.present)} present, ${num(c.absent)} absent of ${c.strength}`}
                style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', background: 'var(--bg-tertiary)' }}
              >
                <div style={{ width: `${share(c.present)}%`, background: PRESENT }} />
                <div style={{ width: `${share(c.absent)}%`, background: ABSENT }} />
                <div style={{ width: `${share(other)}%`, background: OTHER }} />
              </div>
            </Tooltip>
          </div>
        );
      })}
      {!loading && rows.length > 0 && (
        <div style={{ display: 'flex', gap: 14, fontSize: 12, marginTop: 6 }}>
          {[['Present', PRESENT], ['Absent', ABSENT], ['Off / not marked', OTHER]].map(([label, colour]) => (
            <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: colour, display: 'inline-block' }} />
              <Text type="secondary" style={{ fontSize: 12 }}>{label}</Text>
            </span>
          ))}
        </div>
      )}
    </Card>
  );
});

export default StrengthUnitBars;
