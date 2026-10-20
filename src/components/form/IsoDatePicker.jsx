import { memo, useMemo } from 'react';
import { DatePicker } from 'antd';
import dayjs from 'dayjs';
import { DATE_FORMAT } from '../../utils/uiConstants';

/**
 * A DatePicker bound to an ISO date ('YYYY-MM-DD') outside a Form: `value` in, `onChange(iso
 * | null)` out. The dayjs value stays the same instance while the date does — the picker
 * re-syncs on every new instance and would drop a date the user is still typing whenever
 * the screen re-renders.
 */
const IsoDatePicker = memo(function IsoDatePicker({ value, onChange, ...rest }) {
  const day = useMemo(() => (value ? dayjs(value) : null), [value]);
  return (
    <DatePicker
      format={DATE_FORMAT} style={{ width: '100%' }} {...rest}
      value={day} onChange={(d) => onChange(d ? d.format('YYYY-MM-DD') : null)}
    />
  );
});

export default IsoDatePicker;
