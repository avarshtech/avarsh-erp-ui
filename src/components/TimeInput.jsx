import { useState } from 'react';
import { ClockCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import MaskedInput from './MaskedInput';

/**
 * A time you type: HH:MM, 24 hours, four digits and no more.
 *
 * Drop-in for antd's TimePicker - it takes and emits a dayjs value, so a
 * Form.Item swaps one for the other with nothing else changed.
 *
 * The colon is part of the template rather than something typed, so it is on
 * screen from the start, greys until the hour is complete, and then the caret
 * is already past it. Four digit slots is also four digits' worth of room:
 * "12344" has nowhere to go instead of being quietly trimmed afterwards.
 *
 * 24 hours only. There is no am/pm here to get wrong, which is half of why
 * 9am-to-6am used to pass for a working day.
 */

const toDigits = (value) =>
  (value && dayjs.isDayjs(value) && value.isValid() ? value.format('HHmm') : '');

/** 9 -> 09:00, 93 -> 09:30, 930 -> 09:30. Out of range is no time at all. */
const toDayjs = (digits) => {
  if (!digits) return null;
  const hours = Number(digits.slice(0, 2).padEnd(2, '0'));
  // One digit of minutes is tens, as on a clock: "93" is half past nine.
  const minutes = Number(digits.slice(2).padEnd(2, '0'));
  if (hours > 23 || minutes > 59) return null;
  return dayjs().hour(hours).minute(minutes).second(0).millisecond(0);
};

const TimeInput = ({ value, onChange, disabled, status, style, ...rest }) => {
  const [digits, setDigits] = useState(() => toDigits(value));

  // Resync when the value itself changes - loading a record, or a form reset.
  // Adjusted during render rather than in an effect, so the field never paints
  // the old time and then corrects it. Typing does not round-trip through here,
  // so the caret is left where the user put it.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setDigits(toDigits(value));
  }

  const commit = () => {
    const parsed = toDayjs(digits);
    // An unparseable entry clears rather than lingering as half a time that
    // looks saved. Whatever it becomes, the field redraws from the result.
    setDigits(toDigits(parsed));
    const before = value && dayjs.isDayjs(value) ? value.format('HH:mm') : null;
    const after = parsed ? parsed.format('HH:mm') : null;
    if (before !== after) onChange?.(parsed);
  };

  return (
    <MaskedInput
      {...rest}
      template="##:##"
      placeholder="HH:MM"
      digits={digits}
      onDigits={setDigits}
      onCommit={commit}
      disabled={disabled}
      status={status}
      style={style}
      prefix={<ClockCircleOutlined style={{ opacity: 0.45 }} />}
    />
  );
};

export default TimeInput;
