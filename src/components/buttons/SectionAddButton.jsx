import { useState, useMemo } from 'react';
import { Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

const SectionAddButton = ({
  text,
  color,
  onClick,
  icon = <PlusOutlined />,
  block = true,
  className,
  style,
  ...restProps
}) => {
  const [hovered, setHovered] = useState(false);

  const buttonStyle = useMemo(() => {
    const base = {
      marginTop: 8,
      height: 40,
      fontSize: 13,
      fontWeight: 500,
      transition: 'all 0.25s ease',
    };
    if (color) {
      base.borderColor = color;
      base.color = color;
    }
    if (hovered && color) {
      // Use color-mix for cross-browser semi-transparent background
      base.backgroundColor = `color-mix(in srgb, ${color} 8%, transparent)`;
      base.borderColor = color;
      base.color = color;
    }
    return { ...base, ...style };
  }, [color, hovered, style]);

  return (
    <Button
      type="dashed"
      icon={icon}
      block={block}
      onClick={onClick}
      className={className}
      style={buttonStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      {...restProps}
    >
      {text}
    </Button>
  );
};

export default SectionAddButton;
