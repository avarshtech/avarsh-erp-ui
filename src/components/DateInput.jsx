import { useState } from 'react';
import { Button, Calendar, Popover } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import MaskedInput from './MaskedInput';

dayjs.extend(customParseFormat);

/**
 * A date you type: DD/MM/YYYY, with the calendar still a click away.
 *
 * Drop-in for antd's DatePicker on a plain day field - same dayjs value in and
 * out. The slashes belong to the template exactly as the colon does in
 * TimeInput, so they appear as you go and there are eight digit slots and no
 * ninth.
 *
 * The calendar is kept because picking "the second Tuesday" is a thing people
 * do and counting it out on a keyboard is not. Typing is simply the faster path
 * for a date someone already knows, which is most of them - a date of birth is
 * never found by paging back through forty years of months.
 *
 * Not for a date-and-time field or a month picker; those keep DatePicker.
 */

const toDigits = (value) =>
  (value && dayjs.isDayjs(value) && value.isValid() ? value.format('DDMMYYYY') : '');

/** Strict parsing: 31/02/2026 is not a date, and must not quietly become 03/03. */
const toDayjs = (digits) => {
  if (digits.length < 8) return null;
  const parsed = dayjs(digits, 'DDMMYYYY', true);
  return parsed.isValid() ? parsed.startOf('day') : null;
};

const DateInput = ({
  value, defaultValue, onChange, disabled, status, style, disabledDate, allowClear = true, ...rest
}) => {
  // Uncontrolled use (a dialog that reads the date off its own onChange) seeds
  // from defaultValue once and is never synced again, as DatePicker behaves.
  const [digits, setDigits] = useState(() => toDigits(value ?? defaultValue));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [uncontrolled, setUncontrolled] = useState(() => (value === undefined ? defaultValue ?? null : null));
  const current = value === undefined ? uncontrolled : value;

  // Resync when the value itself changes - loading a record, or a form reset.
  // Adjusted during render rather than in an effect: an effect would paint the
  // old digits first and then correct them, and typing never round-trips
  // through here, so the caret is left where the user put it.
  const [lastValue, setLastValue] = useState(value);
  if (value !== undefined && value !== lastValue) {
    setLastValue(value);
    setDigits(toDigits(value));
  }

  const emit = (next) => {
    const before = current && dayjs.isDayjs(current) ? current.format('YYYY-MM-DD') : null;
    const after = next ? next.format('YYYY-MM-DD') : null;
    if (before === after) return;
    if (value === undefined) setUncontrolled(next);
    onChange?.(next);
  };

  const commit = () => {
    const parsed = toDayjs(digits);
    // A date the calendar would refuse is refused here too, or typing would be
    // a way around the rule the picker enforces.
    const allowed = parsed && disabledDate?.(parsed) ? null : parsed;
    setDigits(toDigits(allowed));
    emit(allowed);
  };

  const pickFromCalendar = (picked) => {
    setDigits(toDigits(picked));
    emit(picked ? picked.startOf('day') : null);
    setCalendarOpen(false);
  };

  return (
    <MaskedInput
      {...rest}
      template="##/##/####"
      placeholder="DD/MM/YYYY"
      digits={digits}
      onDigits={setDigits}
      onCommit={commit}
      disabled={disabled}
      status={status}
      style={style}
      allowClear={allowClear}
      suffix={(
        <Popover
          open={calendarOpen}
          onOpenChange={(open) => !disabled && setCalendarOpen(open)}
          trigger="click"
          placement="bottomRight"
          styles={{ body: { padding: 8 } }}
          content={(
            // The compact Calendar card rather than a DatePicker forced open:
            // it is a supported component in its own right, so it does not
            // depend on the picker's popup behaving while its input is hidden.
            <div className="date-input-calendar" style={{ width: 304 }}>
              <Calendar
                fullscreen={false}
                value={current ?? dayjs()}
                disabledDate={disabledDate}
                onSelect={(picked, info) => {
                  // Clicking a month or year header also fires onSelect; only a
                  // date click should close the popover and set the value.
                  if (info?.source && info.source !== 'date') return;
                  pickFromCalendar(picked);
                }}
              />
            </div>
          )}
        >
          <Button
            type="text"
            size="small"
            disabled={disabled}
            aria-label="Open calendar"
            icon={<CalendarOutlined style={{ opacity: 0.45 }} />}
            onClick={(e) => e.stopPropagation()}
          />
        </Popover>
      )}
    />
  );
};

export default DateInput;
