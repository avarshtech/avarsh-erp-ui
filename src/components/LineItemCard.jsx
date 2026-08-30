import { memo, Fragment } from 'react';

const LineItemCard = memo(({
  index,
  image,
  title,
  subtitle,
  description,
  tags,
  amount,
  status,
  pills,
  children,
  className,
  style,
  ...restProps
}) => (
  <div
    className={`view-line-item-card${className ? ` ${className}` : ''}`}
    style={{
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-md)',
      padding: '16px 20px',
      background: 'var(--card-bg)',
      cursor: 'default',
      ...style,
    }}
    {...restProps}
  >
    {/* Header row */}
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      {/* Index badge */}
      {index != null && (
        <div style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: 'var(--primary-light)',
          color: 'var(--primary-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: 12,
          flexShrink: 0,
        }}>
          {index}
        </div>
      )}

      {/* Image */}
      {image && <div style={{ flexShrink: 0 }}>{image}</div>}

      {/* Info column */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && (
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
            {title}
          </div>
        )}
        {subtitle && (
          <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)', marginBottom: 2 }}>
            {subtitle}
          </div>
        )}
        {description && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
            {description}
          </div>
        )}
        {tags?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {tags.map((tag, i) => (
              <Fragment key={i}>{tag}</Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Amount / Status column */}
      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        {amount && (
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--success-color)' }}>
            {amount}
          </div>
        )}
        {status && <div style={{ marginTop: 4 }}>{status}</div>}
      </div>
    </div>

    {/* Pills row */}
    {pills?.length > 0 && (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {pills.map((pill, i) => (
          <span
            key={pill.label ?? i}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              background: 'var(--primary-light)',
              color: 'var(--primary-color)',
              fontSize: 12,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span style={{ opacity: 0.7 }}>{pill.label}</span>
            <span style={{ fontWeight: 600 }}>{pill.value}</span>
          </span>
        ))}
      </div>
    )}

    {/* Children slot */}
    {children && <div style={{ marginTop: 12 }}>{children}</div>}
  </div>
));

LineItemCard.displayName = 'LineItemCard';

export default LineItemCard;
