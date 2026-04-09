import dayjs from 'dayjs';

/**
 * Indian financial year (Apr–Mar) → 'YY-YY' string.
 *  Example: 2026-04-08 → '26-27'   2025-12-15 → '25-26'
 */
export const getCurrentFinancialYear = (today = dayjs()) => {
  const d = dayjs(today);
  const year = d.year();
  const monthIdx = d.month(); // 0-based; March = 2
  const startYear = monthIdx >= 3 ? year : year - 1;
  const endYear = startYear + 1;
  return `${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`;
};

/**
 * Compute the next document number for the current FY.
 * Format: `${prefix}/${FY}/${counter}` where counter starts at 1001 each FY.
 *
 * @param {string} prefix - 'GRN' | 'QC'
 * @param {string[]} existingNumbers - all existing doc numbers in the system
 * @returns {string} new document number
 */
export const getNextDocNumber = (prefix, existingNumbers = []) => {
  const fy = getCurrentFinancialYear();
  const re = new RegExp(`^${prefix}/${fy}/(\\d+)$`);
  let max = 1000; // so first one becomes 1001
  for (const n of existingNumbers || []) {
    const m = re.exec(String(n).trim());
    if (m) {
      const v = parseInt(m[1], 10);
      if (!Number.isNaN(v) && v > max) max = v;
    }
  }
  return `${prefix}/${fy}/${max + 1}`;
};

/**
 * Tiny check used by validation: is the date in the inclusive PO range?
 */
export const isWithinPoRange = (date, poCreatedDate, poExpectedDeliveryDate) => {
  if (!date) return false;
  const d = dayjs(date);
  if (poCreatedDate && d.isBefore(dayjs(poCreatedDate).startOf('day'))) return false;
  if (poExpectedDeliveryDate && d.isAfter(dayjs(poExpectedDeliveryDate).endOf('day'))) return false;
  return true;
};
