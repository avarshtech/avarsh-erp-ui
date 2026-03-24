import React from 'react';
import { Empty, Button } from 'antd';

const EmptyState = React.memo(function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  showAction = true,
  className,
  style,
  ...restProps
}) {
  return (
    <Empty
      image={icon || Empty.PRESENTED_IMAGE_SIMPLE}
      description={
        <div>
          {title && (
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: 4,
              }}
            >
              {title}
            </div>
          )}
          {description && (
            <div style={{ color: 'var(--text-secondary)' }}>{description}</div>
          )}
        </div>
      }
      className={className}
      style={style}
      {...restProps}
    >
      {showAction && onAction && actionLabel && (
        <Button type="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </Empty>
  );
});

export default EmptyState;
