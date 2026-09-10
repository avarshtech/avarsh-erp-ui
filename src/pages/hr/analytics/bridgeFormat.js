/**
 * Money formatting for the analytics screens.
 *
 * Bridge figures run to lakhs and crores, where two decimals are noise that
 * makes columns harder to compare. Drill-down figures are one employee's pay,
 * where the paise matter because someone may be reconciling against a payslip.
 */
export const formatRupees = (value) => {
  if (value == null) return '-';
  return `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

export const formatRupeesExact = (value) => {
  if (value == null) return '-';
  return `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatSigned = (value) => {
  if (value == null) return '-';
  const n = Number(value);
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatRupeesExact(Math.abs(n))}`;
};

/** "Sep 2026" from the month/year pair the API uses. */
export const periodLabel = (month, year) => {
  if (!month || !year) return '-';
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[month - 1]} ${year}`;
};
