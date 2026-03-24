import React from 'react';
import { Badge } from 'antd';

const STATUS_MAP = {
  active: 'success',
  inactive: 'default',
  pending: 'warning',
};

const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

const StatusBadge = React.memo(function StatusBadge({
  status = 'active',
  text,
  className,
  style,
  ...restProps
}) {
  const badgeStatus = STATUS_MAP[status] || 'default';
  const displayText = text || capitalize(status);

  return (
    <Badge
      status={badgeStatus}
      text={displayText}
      className={className}
      style={style}
      {...restProps}
    />
  );
});

export default StatusBadge;
