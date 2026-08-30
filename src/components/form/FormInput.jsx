import { Input } from 'antd';
import { SearchOutlined, LockOutlined } from '@ant-design/icons';

const FormInput = ({ variant = 'default', className, style, ...restProps }) => {
  const variantProps = {};

  if (variant === 'search') {
    variantProps.prefix = <SearchOutlined />;
    variantProps.allowClear = true;
  } else if (variant === 'disabled-auto') {
    variantProps.disabled = true;
    variantProps.style = { backgroundColor: 'var(--bg-tertiary)', ...style };
  }

  const mergedStyle = variant === 'disabled-auto' ? variantProps.style : style;

  return (
    <Input
      className={className}
      style={mergedStyle}
      {...variantProps}
      {...restProps}
    />
  );
};

export const FormTextArea = ({ className, style, ...restProps }) => {
  return <Input.TextArea className={className} style={style} {...restProps} />;
};

export const FormPassword = ({ className, style, ...restProps }) => {
  return (
    <Input.Password
      prefix={<LockOutlined />}
      className={className}
      style={style}
      {...restProps}
    />
  );
};

export default FormInput;
