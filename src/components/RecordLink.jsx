import React from 'react';
import { Typography } from 'antd';

const { Text } = Typography;

const RecordLink = React.memo(function RecordLink({
  text,
  onClick,
  className,
  style,
  ...restProps
}) {
  return (
    <Text
      className={`record-link${className ? ` ${className}` : ''}`}
      style={{
        fontWeight: 600,
        color: 'var(--primary-color)',
        cursor: 'pointer',
        ...style,
      }}
      onClick={onClick}
      {...restProps}
    >
      {text}
    </Text>
  );
});

export default RecordLink;
