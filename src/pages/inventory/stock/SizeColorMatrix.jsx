import { memo, useMemo } from 'react';
import { formatNumber } from '../../../utils/formatters';

const getCellColor = (qty, maxQty) => {
  if (!qty || qty === 0) return 'var(--bg-secondary)';
  const ratio = qty / maxQty;
  if (ratio > 0.5) return 'var(--success-bg, rgba(82, 196, 26, 0.1))';
  if (ratio >= 0.1) return 'var(--warning-bg, rgba(250, 173, 20, 0.1))';
  return 'var(--error-bg, rgba(255, 77, 79, 0.1))';
};

const cellStyle = {
  padding: '4px 8px',
  textAlign: 'center',
  fontSize: 12,
  border: '1px solid var(--border-color)',
  minWidth: 55,
};

const headerStyle = {
  ...cellStyle,
  fontWeight: 600,
  background: 'var(--bg-secondary)',
  color: 'var(--text-secondary)',
};

const SizeColorMatrix = memo(function SizeColorMatrix({ sizeColorMatrix }) {
  if (!sizeColorMatrix) return <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>No matrix data</span>;

  const { sizes = [], colors = [], quantities = {} } = sizeColorMatrix;

  const { maxQty, colorTotals, sizeTotals, grandTotal } = useMemo(() => {
    let max = 0;
    const cTotals = {};
    const sTotals = {};
    let total = 0;

    colors.forEach((color) => {
      cTotals[color] = 0;
      sizes.forEach((size) => {
        const qty = quantities[`${color}-${size}`] || 0;
        if (qty > max) max = qty;
        cTotals[color] += qty;
        sTotals[size] = (sTotals[size] || 0) + qty;
        total += qty;
      });
    });

    return { maxQty: max, colorTotals: cTotals, sizeTotals: sTotals, grandTotal: total };
  }, [sizes, colors, quantities]);

  return (
    <div style={{ overflowX: 'auto', padding: '8px 0' }}>
      <table style={{ borderCollapse: 'collapse', width: 'auto' }}>
        <thead>
          <tr>
            <th style={headerStyle}>Color / Size</th>
            {sizes.map((size) => (
              <th key={size} style={headerStyle}>{size}</th>
            ))}
            <th style={headerStyle}>Total</th>
          </tr>
        </thead>
        <tbody>
          {colors.map((color) => (
            <tr key={color}>
              <td style={{ ...cellStyle, fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' }}>{color}</td>
              {sizes.map((size) => {
                const qty = quantities[`${color}-${size}`] || 0;
                return (
                  <td key={size} style={{ ...cellStyle, background: getCellColor(qty, maxQty), fontWeight: qty > 0 ? 600 : 400, color: qty === 0 ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>
                    {formatNumber(qty)}
                  </td>
                );
              })}
              <td style={{ ...cellStyle, fontWeight: 600, background: 'var(--bg-secondary)' }}>{formatNumber(colorTotals[color])}</td>
            </tr>
          ))}
          <tr>
            <td style={{ ...cellStyle, fontWeight: 600, background: 'var(--bg-secondary)' }}>Total</td>
            {sizes.map((size) => (
              <td key={size} style={{ ...cellStyle, fontWeight: 600, background: 'var(--bg-secondary)' }}>{formatNumber(sizeTotals[size] || 0)}</td>
            ))}
            <td style={{ ...cellStyle, fontWeight: 700, background: 'var(--primary-bg, rgba(22, 119, 255, 0.1))' }}>{formatNumber(grandTotal)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
});

export default SizeColorMatrix;
