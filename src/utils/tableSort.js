/**
 * A column sorter whose ties fall back to the row id, so rows that share a value (two payroll runs of one
 * month, two leavers on one day) keep one order on every refresh instead of whatever order they arrived in.
 * With the column sorted descending, antd reverses the whole comparison, so tied rows read newest first,
 * the same order the API now returns them in.
 */
const compareIds = (x, y) => {
  const nx = Number(x);
  const ny = Number(y);
  if (Number.isFinite(nx) && Number.isFinite(ny)) return nx - ny;
  return String(x ?? '').localeCompare(String(y ?? ''));
};

export const thenById = (compare) => (a, b) => compare(a, b) || compareIds(a?.id, b?.id);
