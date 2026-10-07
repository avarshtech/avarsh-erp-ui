/**
 * Working-day arithmetic for the job-work risk rules. Sundays are not working days; there is no
 * vendor holiday calendar (hr_holidays is our own factories' attendance calendar). Dates travel
 * as ISO strings (YYYY-MM-DD).
 */
import dayjs from 'dayjs';

const isSunday = (d) => d.day() === 0;

export const day = (value) => dayjs(value).startOf('day');
export const iso = (value) => dayjs(value).format('YYYY-MM-DD');

export const isBeforeDay = (a, b) => day(a).isBefore(day(b));
export const isAfterDay = (a, b) => day(a).isAfter(day(b));

/** The working day before `date` (Monday's is Saturday). */
export const previousWorkingDay = (date) => {
  let d = day(date).subtract(1, 'day');
  while (isSunday(d)) d = d.subtract(1, 'day');
  return iso(d);
};

/** `n` working days after `from` (n ≥ 0). */
export const addWorkingDays = (from, n) => {
  let d = day(from);
  let left = Math.max(0, Math.ceil(n));
  while (left > 0) {
    d = d.add(1, 'day');
    if (!isSunday(d)) left -= 1;
  }
  return iso(d);
};

/** `n` working days before `from` (n ≥ 0). */
export const subtractWorkingDays = (from, n) => {
  let d = day(from);
  let left = Math.max(0, Math.ceil(n));
  while (left > 0) {
    d = d.subtract(1, 'day');
    if (!isSunday(d)) left -= 1;
  }
  return iso(d);
};

/** Working days in (a, b]; 0 when b is not after a. */
export const workingDaysBetween = (a, b) => {
  let d = day(a);
  const end = day(b);
  let n = 0;
  while (d.isBefore(end)) {
    d = d.add(1, 'day');
    if (!isSunday(d)) n += 1;
  }
  return n;
};
