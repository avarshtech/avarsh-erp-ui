import { addDays, dayOf } from '../util.js';

/** Longest stretch counted, a little over the simulation's one-year horizon. */
const MAX_DAYS = 400;

const isSunday = (day) => new Date(`${day}T00:00:00Z`).getUTCDay() === 0;
const nextWorkingDay = (day, sundayOff) => {
  let d = day;
  while (sundayOff && isSunday(d)) d = addDays(d, 1);
  return d;
};

/** The calendar date of working day `index` (0 = start), skipping Sundays when the factory rests. */
export const workingDayDate = (startDay, index, sundayOff) => {
  let day = nextWorkingDay(startDay, sundayOff);
  for (let left = index; left > 0; left -= 1) day = nextWorkingDay(addDays(day, 1), sundayOff);
  return day;
};

/** Working days from `fromDay` until `toDay` (0 when it is not later): the inverse of workingDayDate. */
export const workingDaysUntil = (fromDay, toDay, sundayOff) => {
  if (!dayOf(fromDay) || !dayOf(toDay)) return 0;
  const end = nextWorkingDay(dayOf(toDay), sundayOff);
  let day = nextWorkingDay(dayOf(fromDay), sundayOff);
  let days = 0;
  while (day < end && days < MAX_DAYS) {
    day = nextWorkingDay(addDays(day, 1), sundayOff);
    days += 1;
  }
  return days;
};
