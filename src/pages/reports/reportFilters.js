import dayjs from 'dayjs';

/**
 * The filters a report run offers, and the shape the API reads them in.
 *
 * A report built in the Report Designer keeps its filters on its fields (isFilterable plus a
 * filterType), which is what the API's DynamicQueryBuilder.buildFieldFilter reads; a raw-SQL
 * definition keeps rows in rpt_filters (definition.filters). The run screen offers both (U305).
 */
export const reportFiltersOf = (definition) => {
  const legacy = definition?.filters || [];
  const taken = new Set(legacy.map((f) => f.filterCode));
  const fromFields = (definition?.fields || [])
    .filter((f) => f.isFilterable && f.filterType && !taken.has(f.fieldCode))
    .map((f) => ({ filterCode: f.fieldCode, displayName: f.displayName, filterType: f.filterType }));
  return [...legacy, ...fromFields];
};

const isEmpty = (v) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
const day = (v) => dayjs(v).format('YYYY-MM-DD');

/**
 * The screen's filter values in the shape the API reads (U306): a date range as <code>_start and
 * <code>_end, a number range as <code>_min and <code>_max, a date as YYYY-MM-DD (the local day, not a
 * UTC timestamp). Everything else goes as it is.
 */
export const toServerFilters = (values = {}, filters = []) => {
  const typeOf = Object.fromEntries(filters.map((f) => [f.filterCode, f.filterType]));
  const out = {};
  Object.entries(values).forEach(([code, value]) => {
    if (isEmpty(value)) return;
    switch (typeOf[code]) {
      case 'DATE_RANGE':
        if (Array.isArray(value)) {
          if (value[0]) out[`${code}_start`] = day(value[0]);
          if (value[1]) out[`${code}_end`] = day(value[1]);
        }
        break;
      case 'NUMBER_RANGE':
        if (value.min !== null && value.min !== undefined) out[`${code}_min`] = value.min;
        if (value.max !== null && value.max !== undefined) out[`${code}_max`] = value.max;
        break;
      case 'DATE':
        out[code] = day(value);
        break;
      default:
        out[code] = value;
    }
  });
  return out;
};
