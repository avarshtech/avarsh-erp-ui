import { useMemo, useCallback } from 'react';
import { InputNumber } from 'antd';
import { numericInputProps, getZeroClearHandlers } from '../../utils/inputHelpers';
import { getCurrencySymbol } from '../../utils/formatters';

const FormInputNumber = ({
  variant = 'default',
  currency,
  uom,
  className,
  style,
  value,
  onChange,
  onFocus: onFocusProp,
  onBlur: onBlurProp,
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

  const zeroClear = useMemo(
    () => getZeroClearHandlers(value, onChange),
    [value, onChange],
  );

  const handleFocus = useCallback((e) => {
    zeroClear.onFocus();
    onFocusProp?.(e);
  }, [zeroClear, onFocusProp]);

  const handleBlur = useCallback((e) => {
    zeroClear.onBlur();
    onBlurProp?.(e);
  }, [zeroClear, onBlurProp]);

  return (
    <InputNumber
      controls={false}
      min={0}
      {...numericInputProps}
      className={className}
      style={mergedStyle}
      {...variantProps}
      value={value}
      onChange={onChange}
      {...restProps}
      onFocus={handleFocus}
      onBlur={handleBlur}
    />
  );
};

export default FormInputNumber;
