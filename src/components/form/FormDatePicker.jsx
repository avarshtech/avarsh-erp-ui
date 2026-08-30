import { useMemo } from 'react';
import { DatePicker } from 'antd';
import dayjs from 'dayjs';
import { DATE_FORMAT } from '../../utils/uiConstants';

const { RangePicker } = DatePicker;

const getPresetRanges = () => [
  { label: 'Today', value: [dayjs(), dayjs()] },
  { label: 'This Week', value: [dayjs().startOf('week'), dayjs().endOf('week')] },
  { label: 'This Month', value: [dayjs().startOf('month'), dayjs().endOf('month')] },
  { label: 'Last 30 Days', value: [dayjs().subtract(30, 'day'), dayjs()] },
  { label: 'This Quarter', value: [dayjs().startOf('quarter'), dayjs().endOf('quarter')] },
];

const FormDatePicker = ({
  variant = 'default',
  presets: showPresets,
  className,
  style,
  ...restProps
}) => {
  const presetRanges = useMemo(() => (showPresets ? getPresetRanges() : undefined), [showPresets]);
  const mergedStyle = useMemo(() => ({ width: '100%', ...style }), [style]);

  if (variant === 'range') {
    return (
      <RangePicker
        format={DATE_FORMAT}
        className={className}
        style={mergedStyle}
        presets={presetRanges}
        {...restProps}
      />
    );
  }

  return (
    <DatePicker
      format={DATE_FORMAT}
      className={className}
      style={mergedStyle}
      {...restProps}
    />
  );
};

export default FormDatePicker;
