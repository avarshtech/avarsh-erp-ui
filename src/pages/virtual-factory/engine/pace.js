import { clamp, num } from './util.js';

/** Hours of the shift worked by `now` (0 before the start, the full shift after it ends). */
export const elapsedShiftHours = (now, rules) => {
  const hours = now.getHours() + now.getMinutes() / 60;
  return clamp(hours - rules.shift.startHour, 0, rules.shift.hours);
};

/** The shift hour now running, 1-based, for the hourly sheet's hr1…hr8 columns. */
export const shiftHourIndex = (now, rules) => clamp(Math.floor(elapsedShiftHours(now, rules)) + 1, 1, 8);

/** What a line should have sewn by now at its target rate. */
export const expectedSoFar = (line, elapsedHours) => num(line.targetPerHour) * elapsedHours;

/** How far behind its target pace a line is, as a percentage (0 when on or ahead of pace). */
export const behindPct = (line, elapsedHours) => {
  const expected = expectedSoFar(line, elapsedHours);
  return expected > 0 ? Math.max(0, ((expected - num(line.output)) / expected) * 100) : 0;
};

/** Pieces a day a line is really making, from today's output so far. */
export const actualDailyRate = (line, elapsedHours, rules) =>
  (elapsedHours >= 1 ? (num(line.output) / elapsedHours) * rules.shift.hours : num(line.targetPerDay));
