/**
 * Master-data lookups for the Export Documentation mock.
 *
 * The garment HS code list is seeded data. An invoice line's HS code comes from its
 * style, and the currency and payment terms from the orders (owner, 2026-11-17).
 * Ports and incoterms are fixed lists in utils/expDocConstants.js. The exchange rate
 * is the customs rate list (/export-docs/customs-rates).
 */
import { loadDb } from './expDocStore';
import { delay, clone } from './expDocMockCommon';
import { customsRateInForce } from './customsRateApi';

export const listHsCodes = async () => {
  await delay(60);
  return clone(loadDb().masters.hsCodes);
};

export const getExporterProfileExtra = () => clone(loadDb().masters.exporterProfileExtra);

export const getTenantConfig = () => clone(loadDb().masters.tenantConfig);

/**
 * The invoice's exchange rate for a date (owner, 2026-11-17): the CBIC customs export rate in force
 * on it, which values the shipping bill and, by CGST Rule 34, the GST value of exported goods. Not
 * Costing's daily market rate, and never a made-up one: no notification on or before the date gives
 * `rate: null`, and finalising then asks for a rate (V-check in expDocValidation). An INR invoice
 * needs no conversion.
 */
export const getFxRate = async (date, currency) => {
  if (String(currency || '').toUpperCase() === 'INR') {
    return { rate: 1, source: 'CUSTOMS', effectiveFrom: date, notificationNo: null };
  }
  const hit = currency ? await customsRateInForce(currency, date) : null;
  if (!hit) return { rate: null, source: null, effectiveFrom: null, notificationNo: null };
  return {
    rate: Number(hit.exportRate),
    source: 'CUSTOMS',
    effectiveFrom: hit.effectiveFrom,
    notificationNo: hit.notificationNo ?? null,
  };
};

/** The rate fields an invoice keeps from a lookup (fxDate is the day the notified rate took effect). */
export const fxFieldsOf = (fx) => ({
  fxRate: fx.rate || null,
  fxSource: fx.rate ? fx.source : null,
  fxDate: fx.rate ? fx.effectiveFrom : null,
  fxNotificationNo: fx.rate ? fx.notificationNo : null,
});
