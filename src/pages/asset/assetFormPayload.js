import dayjs from 'dayjs';

const DATE_FIELDS = ['purchaseDate', 'warrantyStart', 'warrantyEnd', 'amcStart', 'amcEnd'];

/** AntD DatePicker works in dayjs; the API wants plain yyyy-mm-dd. */
const toApiDate = (value) => (value ? dayjs(value).format('YYYY-MM-DD') : null);

/**
 * The saved asset as the form wants it back.
 *
 * `specData` arrives as a JSON string because the column is JSON; a DATE field
 * inside it has to become a dayjs value too, or its picker renders empty.
 */
export const toFormValues = (asset, fieldDefs) => {
  const spec = (() => {
    try { return JSON.parse(asset.specData || '{}'); } catch { return {}; }
  })();
  const specValues = {};
  (fieldDefs ?? []).forEach((def) => {
    const value = spec[def.key];
    if (value === undefined || value === null || value === '') return;
    specValues[def.key] = def.type === 'DATE' ? dayjs(value) : value;
  });

  const values = { ...asset, specData: specValues };
  DATE_FIELDS.forEach((field) => { values[field] = asset[field] ? dayjs(asset[field]) : undefined; });
  return values;
};

/**
 * The form's values as the API wants them.
 *
 * Every spec value is sent as a string: the server coerces it against the
 * category's declared type and reports a bad one by that field's label, which
 * is a better message than Jackson's.
 */
export const toPayload = (values, version) => {
  const specData = {};
  Object.entries(values.specData ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    specData[key] = dayjs.isDayjs(value) ? value.format('YYYY-MM-DD') : String(value);
  });

  const payload = { ...values, specData, version };
  DATE_FIELDS.forEach((field) => { payload[field] = toApiDate(values[field]); });
  if (!payload.amcAvailable) {
    payload.amcVendorId = null;
    payload.amcVendorText = null;
    payload.amcStart = null;
    payload.amcEnd = null;
  }
  return payload;
};
