import { Switch } from 'antd';

const FormSwitch = ({
  checkedLabel = 'Active',
  uncheckedLabel = 'Inactive',
  className,
  style,
  ...restProps
}) => {
  return (
    <Switch
      checkedChildren={checkedLabel}
      unCheckedChildren={uncheckedLabel}
      className={className}
      style={style}
      {...restProps}
    />
  );
};

export default FormSwitch;
