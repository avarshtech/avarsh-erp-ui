/**
 * The currency a report's money cell is in (U307):
 * - a column that names its currency (final_price_usd) keeps it;
 * - a source with no currency field at all (POs, inventory, production) is rupees, as it always showed;
 * - a source with a currency field shows each row's own currency when that field is in the run;
 * - with the field left out of the run the currency is unknown: null, and the cell shows the plain number.
 */
/*
 * The report sources whose rows carry a currency, from the API catalog (SalesDataSources.ORDERS,
 * StyleDataSources.COST_SHEETS). The catalog endpoint is open to report designers only, so a report
 * viewer cannot ask it; a report built without its currency column is still one of these sources.
 */
const SOURCES_WITH_CURRENCY = new Set(['orders', 'cost_sheets']);

/** Whether a report's rows can be in more than one currency: its source has a currency field. */
export const sourceHasCurrency = (definition) => SOURCES_WITH_CURRENCY.has(definition?.dataSourceKey)
  || (definition?.fields || []).some((f) => f.fieldCode === 'currency');

export const cellCurrency =(fieldCode, record, { sourceHasCurrency = false, currencyInRun = false } = {}) => {
  if (/_usd$/i.test(fieldCode || '')) return 'USD';
  if (!sourceHasCurrency) return 'INR';
  const code = currencyInRun ? record?.currency : null;
  return typeof code === 'string' && code.trim() ? code.trim().toUpperCase() : null;
};
