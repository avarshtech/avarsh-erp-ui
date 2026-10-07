import { elapsedShiftHours, shiftHourIndex } from './pace.js';
import { addDays, isoDay } from './util.js';

/** The moment a snapshot describes: the calendar day, the shift hour and how much of the shift is worked. */
export const makeClock = (now, rules) => {
  const today = isoDay(now);
  return {
    at: now.toISOString(),
    today,
    hourIndex: shiftHourIndex(now, rules),
    elapsedHours: elapsedShiftHours(now, rules),
    since7: addDays(today, -7),
    since14: addDays(today, -14),
    since30: addDays(today, -30),
  };
};
