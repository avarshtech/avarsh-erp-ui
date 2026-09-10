import { useMemo } from 'react';
import { Empty, Typography, theme } from 'antd';
import { formatRupees } from './bridgeFormat';

const { Text } = Typography;

/**
 * The drivers of a payroll movement, as bars either side of a zero line.
 *
 * Colour is about the total, not about the people: amber raised it, green
 * reduced it. Leavers reducing payroll cost is a fact about the cost line and
 * nothing else, so the legend says exactly that rather than leaving the reader
 * to infer a judgement from the colour.
 */
const BridgeDriverBars = ({ drivers, onSelect }) => {
  const { token } = theme.useToken();

  const scale = useMemo(() => {
    const widest = Math.max(...drivers.map((d) => Math.abs(Number(d.amount) || 0)), 0);
    return widest > 0 ? widest : 1;
  }, [drivers]);

  if (!drivers.length) {
    return <Empty description="Nothing moved between these two periods" />;
  }

  return (
    <div>
      {drivers.map((d) => {
        const amount = Number(d.amount) || 0;
        const raised = amount > 0;
        const colour = raised ? token.colorWarning : token.colorSuccess;
        const width = `${(Math.abs(amount) / scale) * 50}%`;

        return (
          <div
            key={d.code}
            role="button"
            tabIndex={0}
            aria-label={`${d.label}, ${formatRupees(amount)}. Show the employees behind this.`}
            onClick={() => onSelect(d)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(d); }
            }}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(140px, 190px) 1fr minmax(110px, auto)',
              alignItems: 'center',
              gap: 16,
              padding: '9px 10px',
              borderRadius: token.borderRadius,
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = token.colorFillQuaternary; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <span>
              <Text>{d.label}</Text>
              {d.headcount > 0 && (
                <Text type="secondary" style={{ marginLeft: 6, fontSize: 12 }}>
                  ({d.headcount})
                </Text>
              )}
            </span>

            <span style={{ position: 'relative', height: 18 }}>
              <span style={{
                position: 'absolute', left: '50%', top: -3, bottom: -3,
                width: 1, background: token.colorBorderSecondary,
              }} />
              <span style={{
                position: 'absolute', top: 2, height: 14, width,
                background: colour, borderRadius: 2,
                ...(raised ? { left: '50%' } : { right: '50%' }),
              }} />
            </span>

            <Text strong style={{ color: colour, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {raised ? '+' : '−'}{formatRupees(Math.abs(amount))}
            </Text>
          </div>
        );
      })}

      <div style={{ display: 'flex', gap: 20, padding: '12px 10px 0', flexWrap: 'wrap' }}>
        <Legend colour={token.colorWarning} label="Increased the total" />
        <Legend colour={token.colorSuccess} label="Reduced the total" />
        <Text type="secondary" style={{ fontSize: 12 }}>Select a row to see the employees behind it.</Text>
      </div>
    </div>
  );
};

const Legend = ({ colour, label }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
    <span style={{ width: 10, height: 10, borderRadius: 2, background: colour }} />
    <Text type="secondary" style={{ fontSize: 12 }}>{label}</Text>
  </span>
);

export default BridgeDriverBars;
