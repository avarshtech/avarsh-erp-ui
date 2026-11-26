import axiosInstance from '../core/axiosInstance';

/**
 * One year's Labour Welfare Fund for a unit: every contributor, both shares, and the
 * totals the board's form asks for.
 *
 * Read-only. Nothing is recalculated here or on the server - the figures come off the
 * salary records payroll wrote, so the screen and the payslips cannot disagree.
 */
export const getLwfReturn = async (unitId, year) =>
  // silent: the screen renders its own reason, where the reader can act on it and
  // where it stays put. A toast on top of that would be the same failure said twice.
  (await axiosInstance.get('/hr/lwf-return', { params: { unitId, year }, silent: true })).data;

export default { getLwfReturn };
