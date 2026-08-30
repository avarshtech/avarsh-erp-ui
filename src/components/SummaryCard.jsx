import { memo } from 'react';

const SummaryCard = memo(({
  items = [],
  total,
  className,
  style,
  ...restProps
}) => (
  <div
    className={className}
    style={{
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-md)',
      background: 'var(--card-bg)',
      overflow: 'hidden',
      ...style,
    }}
    {...restProps}
  >
    {items.map((item, i) => (
      <div
        key={item.label || i}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 20px',
          borderBottom: i < items.length - 1 || total ? '1px solid var(--border-color)' : 'none',
        }}
      >
        <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          {item.label}
        </span>
        <span style={{ fontWeight: 600, fontSize: 14, color: item.color || 'var(--text-primary)' }}>
          {item.value}
        </span>
      </div>
    ))}

    {total && (
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 20px',
          ...(total.highlight
            ? {
                background: 'var(--primary-color)',
                color: '#fff',
              }
            : {}),
        }}
      >
        <span style={{
          fontWeight: 700,
          fontSize: total.highlight ? 16 : 14,
          color: total.highlight ? '#fff' : 'var(--text-primary)',
        }}>
          {total.label}
        </span>
        <span style={{
          fontWeight: 700,
          fontSize: total.highlight ? 16 : 14,
          color: total.highlight ? '#fff' : 'var(--text-primary)',
        }}>
          {total.value}
        </span>
      </div>
    )}
  </div>
));

SummaryCard.displayName = 'SummaryCard';

export default SummaryCard;
