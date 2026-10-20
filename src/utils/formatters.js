import dayjs from 'dayjs';

const CURRENCY_SYMBOLS = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  INR: '₹',
};

export const getCurrencySymbol = (currency) => CURRENCY_SYMBOLS[currency] || currency || '';

export const formatCurrency = (amount, currency = 'INR') => {
  if (amount === null || amount === undefined || isNaN(amount)) return `${getCurrencySymbol(currency)} 0.00`;
  return `${getCurrencySymbol(currency)} ${Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const formatDate = (date, format = 'DD-MMM-YYYY') => {
  if (!date) return '—';
  const d = dayjs(date);
  return d.isValid() ? d.format(format) : '—';
};

export const formatNumber = (value, decimals = 0) => {
  if (value === null || value === undefined || isNaN(value)) return '0';
  return Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

/**
 * A number in en-IN grouping, the one function behind the app's money and amount formats.
 *
 * - `prefix`: text before the number ('₹', '₹ ' or nothing).
 * - `minDecimals` / `maxDecimals`: fraction digits. Left out, `maxDecimals` is toLocaleString's own default,
 *   the larger of `minDecimals` and 3.
 * - `empty`: when set, null or undefined gives this text and any other value is read with Number(), so NaN
 *   reads "NaN". When not set, any falsy value (null, undefined, '', NaN) counts as 0.
 *
 * The presets below are the formats screens already use; each matches the local copies it replaced
 * character for character.
 */
export const formatAmount = (value, { prefix = '', minDecimals = 0, maxDecimals, empty } = {}) => {
  if (empty !== undefined && value == null) return empty;
  const number = empty !== undefined ? Number(value) : Number(value || 0);
  return `${prefix}${number.toLocaleString('en-IN', { minimumFractionDigits: minDecimals, maximumFractionDigits: maxDecimals })}`;
};

// The presets take the value alone: a table passes them as `render`, which also hands over the row and index.

/** `₹1,23,456.50`: at least two decimals, `-` when there is no value. The HR screens' money. */
export const formatRupees = (value) => formatAmount(value, { prefix: '₹', minDecimals: 2, empty: '-' });

/** `1,23,456.50`: exactly two decimals; no value reads 0.00. */
export const formatMoney = (value) => formatAmount(value, { minDecimals: 2, maxDecimals: 2 });

/** `₹1,23,456.50`: exactly two decimals; no value reads ₹0.00. */
export const formatInr = (value) => formatAmount(value, { prefix: '₹', minDecimals: 2, maxDecimals: 2 });

/** `1,23,456`: up to three decimals, none added; no value reads 0. Piece counts and quantities. */
export const formatCount = (value) => formatAmount(value);

export const formatPercentage = (value, decimals = 1) => {
  if (value === null || value === undefined || isNaN(value)) return '0%';
  return `${Number(value).toFixed(decimals)}%`;
};

export const formatQuantity = (value, uom) => {
  if (value === null || value === undefined || isNaN(value)) return '—';
  const formatted = formatNumber(value, 2);
  return uom ? `${formatted} ${uom.toUpperCase()}` : formatted;
};

export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

export const getInitials = (name) => {
  if (!name || typeof name !== 'string') return '';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};
