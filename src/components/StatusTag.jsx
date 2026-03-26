import { memo } from 'react';
import { Tag } from 'antd';

const StatusTag = memo(function StatusTag({
  status,
  config,
  getLabel,
  size = 'default',
  className,
  style,
  ...restProps
}) {
  if (!status) return null;

  const statusEntry = config?.[status] || { color: 'default' };
  const { color, icon: IconComponent } = statusEntry;
  const label = getLabel ? getLabel(status) : status;

  const sizeStyle =
    size === 'small' ? { fontSize: 11, padding: '2px 10px' } : {};

  return (
    <Tag
      color={color}
      icon={IconComponent ? <IconComponent /> : undefined}
      style={{
        borderRadius: 'var(--radius-full)',
        ...sizeStyle,
        ...style,
      }}
      className={className}
      {...restProps}
    >
      {label}
    </Tag>
  );
});

export default StatusTag;
