/** Shared formatting for the self-service screens. */
export const rupees = (value) => {
  if (value == null) return '-';
  return `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

export const rupeesExact = (value) => {
  if (value == null) return '-';
  return `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const signedRupees = (value) => {
  if (value == null) return '-';
  const n = Number(value);
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${rupeesExact(Math.abs(n))}`;
};

/** Trims the trailing zeros a decimal day count picks up. */
export const days = (value) => (value == null ? '-' : String(Number(value)));
