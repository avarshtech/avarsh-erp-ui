import { memo } from 'react';
import { Popover } from 'antd';

const InfoPopover = memo(function InfoPopover({
  title,
  content,
  trigger = 'hover',
  placement,
  children,
  className,
  style,
  ...restProps
}) {
  return (
    <Popover
      title={title}
      content={content}
      trigger={trigger}
      placement={placement}
      className={className}
      style={style}
      {...restProps}
    >
      {children}
    </Popover>
  );
});

export default InfoPopover;
