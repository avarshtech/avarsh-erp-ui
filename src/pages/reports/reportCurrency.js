/**
 * The currency a report's money cell is in (U307): a column that names its currency
 * (final_price_usd), else the row's own currency column when the report shows one. Null when
 * nothing says, and the cell then shows the plain number rather than a symbol it may not be in.
 */
export const cellCurrency = (fieldCode, record, hasCurrencyColumn) => {
  if (/_usd$/i.test(fieldCode || '')) return 'USD';
  const code = hasCurrencyColumn ? record?.currency : null;
  return typeof code === 'string' && code.trim() ? code.trim().toUpperCase() : null;
};
