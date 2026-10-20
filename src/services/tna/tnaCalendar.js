/**
 * Working-calendar arithmetic for Time & Action (CR-TNA-001 §9.3, FR-3.4/3.5, BR-04/05).
 *
 * Dates are ISO strings ('YYYY-MM-DD'); internally they are UTC day numbers, so the
 * analytics replay of many orders stays fast. Working-day (WD) durations step over
 * working days only and land on one; calendar-day (CD) durations count every day.
 * Neither rolls a non-working start forward: §17.2 schedules A07 one working day
 * after A04 lands on the 26-Aug holiday, i.e. 27-Aug.
 */
const DAY_MS = 86400000;

export const toDay = (iso) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
};
export const fromDay = (n) => new Date(n * DAY_MS).toISOString().slice(0, 10);

/** weeklyOff: weekday numbers, 0 = Sunday; holidays: ISO dates. */
export const makeCalendar = ({ weeklyOff = [0], holidays = [] } = {}) => ({
  weeklyOff: new Set(weeklyOff),
  holidays: new Set(holidays.map(toDay)),
});

// 1970-01-01 (day 0) was a Thursday (weekday 4).
const workingDay = (cal, n) => !cal.weeklyOff.has((n + 4) % 7) && !cal.holidays.has(n);

export const isWorking = (cal, iso) => workingDay(cal, toDay(iso));

const stepWorking = (cal, iso, count, dir) => {
  let n = toDay(iso);
  for (let left = count; left > 0;) {
    n += dir;
    if (workingDay(cal, n)) left -= 1;
  }
  return fromDay(n);
};

export const addWD = (cal, iso, count) => stepWorking(cal, iso, count, 1);
export const subWD = (cal, iso, count) => stepWorking(cal, iso, count, -1);
export const addCD = (iso, count) => fromDay(toDay(iso) + count);
export const subCD = (iso, count) => fromDay(toDay(iso) - count);

/** Signed working days from a to b: the working days in (a, b], negative when b < a. */
export const wdDiff = (cal, a, b) => {
  const from = toDay(a);
  const to = toDay(b);
  const [lo, hi, sign] = from <= to ? [from, to, 1] : [to, from, -1];
  let count = 0;
  for (let n = lo + 1; n <= hi; n += 1) if (workingDay(cal, n)) count += 1;
  return sign * count;
};

/** Signed calendar days from a to b — order-level measures are calendar facts (§11.2). */
export const cdDiff = (a, b) => toDay(b) - toDay(a);

export const maxDate = (dates) => dates.reduce((m, d) => (d > m ? d : m));
export const minDate = (dates) => dates.reduce((m, d) => (d < m ? d : m));
