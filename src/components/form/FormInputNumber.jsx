import { useMemo } from 'react';
import { InputNumber } from 'antd';
import { numericInputProps } from '../../utils/inputHelpers';
import { getCurrencySymbol } from '../../utils/formatters';

const FormInputNumber = ({
  variant = 'default',
  currency,
  uom,
  className,
  style,
  ...restProps
}) => {
  const mergedStyle = useMemo(() => ({ width: '100%', ...style }), [style]);

  const variantProps = useMemo(() => {
    const props = {};

    if (variant === 'currency') {
      props.prefix = getCurrencySymbol(currency);
      props.step = 0.01;
    } else if (variant === 'percentage') {
      props.addonAfter = '%';
      props.max = 100;
      props.step = 0.5;
    } else if (variant === 'quantity') {
      props.addonAfter = uom?.toUpperCase();
      props.step = 0.01;
    }

    return props;
  }, [variant, currency, uom]);

  return (
    <InputNumber
      controls={false}
      min={0}
      {...numericInputProps}
      className={className}
      style={mergedStyle}
      {...variantProps}
      {...restProps}
    />
  );
};

export default FormInputNumber;
