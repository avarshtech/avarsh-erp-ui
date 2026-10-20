import { Tooltip, Typography } from 'antd';
import { formatCurrency } from '../../../../utils/costingConstants';

/** One bar showing what the making price is made of. */
export default function CostComposition({ totals, currency, isCmt }) {
  if (!(totals.making > 0)) return null;
  const parts = [
    { label: 'Fabric', value: isCmt ? 0 : totals.fabric, color: '#3b82f6' },
    { label: 'Trims', value: totals.accessories, color: '#8b5cf6' },
    { label: 'Mfg', value: totals.manufacturing, color: '#f59e0b' },
    { label: 'Overhead', value: totals.markup, color: '#ef4444' },
  ].filter((p) => p.value > 0);

  return (
    <div style={{ margin: '12px 0' }}>
      <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Cost composition</Typography.Text>
      <div style={{ display: 'flex', height: 18, borderRadius: 6, overflow: 'hidden', fontSize: 10, fontWeight: 600, color: '#fff' }}>
        {parts.map((p) => {
          const pct = (p.value / totals.making) * 100;
          return (
            <Tooltip key={p.label} title={`${p.label}: ${formatCurrency(p.value, currency)} (${pct.toFixed(1)}%)`}>
              <div style={{ width: `${pct}%`, background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {pct > 18 ? `${p.label} ${pct.toFixed(0)}%` : ''}
              </div>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
