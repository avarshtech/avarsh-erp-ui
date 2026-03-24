import React from 'react';
import { Row, Col } from 'antd';

const Field = React.memo(({
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

const DetailCard = React.memo(({
  title,
  icon,
  extra,
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
        padding: '14px 20px',
        borderBottom: '1px solid var(--border-color)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14 }}>
          {icon && <span style={{ display: 'flex', color: 'var(--primary-color)' }}>{icon}</span>}
          <span>{title}</span>
        </div>
        {extra && <div>{extra}</div>}
      </div>
    )}
    <div style={{ padding: '16px 20px' }}>
      <Row gutter={gutter}>
        {children}
      </Row>
    </div>
  </div>
));

DetailCard.displayName = 'DetailCard';
DetailCard.Field = Field;

export default DetailCard;
