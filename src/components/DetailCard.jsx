import { memo } from 'react';
import { Row, Col } from 'antd';

const Field = memo(({
  label,
  value,
  icon,
  span = 8,
  className,
  style,
  ...restProps
}) => (
  <Col span={span} className={className} style={style} {...restProps}>
    <div style={{
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      color: 'var(--text-muted)',
      fontWeight: 500,
      marginBottom: 4,
    }}>
      {label}
    </div>
    <div style={{
      fontSize: 14,
      fontWeight: 600,
      color: 'var(--text-primary)',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    }}>
      {icon && <span style={{ display: 'flex', fontSize: 13 }}>{icon}</span>}
      {value != null && value !== '' ? value : '\u2014'}
    </div>
  </Col>
));

Field.displayName = 'DetailCard.Field';

/**
 * A titled section card — primary icon + title (+ `count` pill), `extra` on the right — whose body is a grid of
 * `DetailCard.Field`s, or, with `bare`, any content (a table, a form) without the grid.
 */
const DetailCard = memo(({
  title,
  icon,
  count,
  extra,
  bare = false,
  gutter = [24, 14],
  className,
  style,
  children,
  ...restProps
}) => (
  <div
    className={className}
    style={{
      background: 'var(--card-bg)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border-color)',
      ...style,
    }}
    {...restProps}
  >
    {title && (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
        padding: '14px 20px',
        borderBottom: '1px solid var(--border-color)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14 }}>
          {icon && <span style={{ display: 'flex', color: 'var(--primary-color)' }}>{icon}</span>}
          <span>{title}</span>
          {count != null && (
            <span style={{
              fontSize: 12, fontWeight: 600, lineHeight: '18px', padding: '0 8px', borderRadius: 999,
              color: 'var(--primary-color)', background: 'color-mix(in srgb, var(--primary-color) 12%, transparent)',
            }}>
              {count}
            </span>
          )}
        </div>
        {extra && <div>{extra}</div>}
      </div>
    )}
    <div style={{ padding: '16px 20px' }}>
      {bare ? children : (
        <Row gutter={gutter}>
          {children}
        </Row>
      )}
    </div>
  </div>
));

DetailCard.displayName = 'DetailCard';
DetailCard.Field = Field;

export default DetailCard;
