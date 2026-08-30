import { useCallback } from 'react';
import { Select } from 'antd';

const defaultFilterOption = (input, option) =>
  (option?.label ?? '').toLowerCase().includes(input.toLowerCase());

const FormSelect = ({ variant = 'searchable', className, style, ...restProps }) => {
  const filterFn = useCallback(defaultFilterOption, []);

  const variantProps = {};

  if (variant === 'searchable' || variant === 'default') {
    variantProps.showSearch = true;
    variantProps.optionFilterProp = 'label';
    variantProps.allowClear = true;
    variantProps.filterOption = filterFn;
  }

  if (variant === 'multi') {
    variantProps.showSearch = true;
    variantProps.optionFilterProp = 'label';
    variantProps.allowClear = true;
    variantProps.filterOption = filterFn;
    variantProps.mode = 'multiple';
    variantProps.maxTagCount = 'responsive';
  }

  if (variant === 'tags') {
    variantProps.showSearch = true;
    variantProps.optionFilterProp = 'label';
    variantProps.allowClear = true;
    variantProps.filterOption = filterFn;
    variantProps.mode = 'tags';
  }

  return (
    <Select
      className={className}
      style={style}
      {...variantProps}
      {...restProps}
    />
  );
};

export default FormSelect;
