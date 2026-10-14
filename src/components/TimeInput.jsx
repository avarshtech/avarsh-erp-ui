import { useEffect, useState } from 'react';
import { Input } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

/**
 * A time field you type into. Drop-in for antd's TimePicker: it takes and emits
 * a dayjs value, so a Form.Item swaps one for the other with no other change.
 *
 * TimePicker in antd 6.2 has no way to switch off its confirm step, so entering
 * a time means opening a popup, scrolling two columns and clicking OK - four
 * actions for something a person can type in four keystrokes. For a clerk
 * filling a day of attendance that is the slowest part of the screen.
 *
 * Always 24 hours. There is no am/pm here to get wrong, which is the other half
 * of why 9am-to-6am used to sail through.
 */

/** 9 -> 09:00, 930 -> 09:30, 9.3 -> 09:30, 0930 -> 09:30, 9:5 -> 09:05. */
const parseTyped = (raw) => {
  const digits = String(raw ?? '').replace(/[^0-9]/g, '');
  if (!digits) return null;

  let hours;
  let minutes;
  if (digits.length <= 2) {
    // "9" and "09" are both nine o'clock; nobody types a bare minute.
    hours = Number(digits);
    minutes = 0;
  } else if (digits.length === 3) {
    hours = Number(digits.slice(0, 1));
    minutes = Number(digits.slice(1));
  } else {
    hours = Number(digits.slice(0, 2));
    minutes = Number(digits.slice(2, 4));
  }

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours > 23 || minutes > 59) return null;
  return dayjs().hour(hours).minute(minutes).second(0).millisecond(0);
};

const format = (value) => (value && dayjs.isDayjs(value) && value.isValid() ? value.format('HH:mm') : '');

const TimeInput = ({ value, onChange, placeholder = 'HH:MM', disabled, allowClear = true, style, ...rest }) => {
  const [text, setText] = useState(() => format(value));

  // The form may set the value from outside - loading a record, or a reset.
  // Editing is not interrupted because this only runs when the value itself changes.
  useEffect(() => { setText(format(value)); }, [value]);

  /** Typing is free-form; it only becomes a value when the field is left. */
  const commit = () => {
    const parsed = parseTyped(text);
    setText(format(parsed));
    const same = parsed && value && dayjs.isDayjs(value) && parsed.format('HH:mm') === value.format('HH:mm');
    if (!same) onChange?.(parsed);
  };

  return (
    <Input
      {...rest}
      value={text}
      disabled={disabled}
      placeholder={placeholder}
      maxLength={5}
      inputMode="numeric"
      allowClear={allowClear}
      prefix={<ClockCircleOutlined style={{ opacity: 0.45 }} />}
      style={{ width: '100%', ...style }}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onPressEnter={commit}
    />
  );
};

export default TimeInput;
