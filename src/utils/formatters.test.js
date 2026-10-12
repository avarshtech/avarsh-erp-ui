// Golden tests: the shared display formatters as they behave today (2026-10-12). en-IN grouping
// comes from Node's full ICU, which every supported Node ships.
//   npx vitest run src/utils/formatters.test.js
import { describe, test, expect } from 'vitest';
import {
  formatCurrency, formatDate, formatFileSize, formatNumber, formatPercentage, formatQuantity,
  getCurrencySymbol, getInitials,
} from './formatters';

describe('currency', () => {
  test('a known code has its symbol; an unknown code is shown as itself', () => {
    expect(getCurrencySymbol('INR')).toBe('₹');
    expect(getCurrencySymbol('USD')).toBe('$');
    expect(getCurrencySymbol('EUR')).toBe('€');
    expect(getCurrencySymbol('GBP')).toBe('£');
    expect(getCurrencySymbol('JPY')).toBe('JPY');
    expect(getCurrencySymbol(undefined)).toBe('');
  });

  test('rupees by default, Indian grouping, always two decimals', () => {
    expect(formatCurrency(1234567.891)).toBe('₹ 12,34,567.89');
    expect(formatCurrency(1234.5, 'USD')).toBe('$ 1,234.50');
    expect(formatCurrency(-50)).toBe('₹ -50.00');
    expect(formatCurrency('2500')).toBe('₹ 2,500.00');
  });

  test('nothing, or something that is not a number, shows as zero', () => {
    expect(formatCurrency(null)).toBe('₹ 0.00');
    expect(formatCurrency(undefined, 'EUR')).toBe('€ 0.00');
    expect(formatCurrency('abc')).toBe('₹ 0.00');
    expect(formatCurrency('')).toBe('₹ 0.00');
  });
});

describe('formatDate', () => {
  test('DD-MMM-YYYY by default, or the format asked for', () => {
    expect(formatDate('2026-10-12')).toBe('12-Oct-2026');
    expect(formatDate('2026-10-12', 'DD/MM/YYYY')).toBe('12/10/2026');
    expect(formatDate(new Date(2026, 0, 5))).toBe('05-Jan-2026');
  });

  test('no date, or one that does not parse, shows a dash', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('')).toBe('—');
    expect(formatDate('not a date')).toBe('—');
  });
});

describe('numbers', () => {
  test('formatNumber: Indian grouping, no decimals unless asked, halves round away from zero', () => {
    expect(formatNumber(1234567.891)).toBe('12,34,568');
    expect(formatNumber(1234567.891, 2)).toBe('12,34,567.89');
    expect(formatNumber('1500')).toBe('1,500');
    expect(formatNumber(2.5)).toBe('3');
    expect(formatNumber(null)).toBe('0');
    expect(formatNumber('abc')).toBe('0');
  });

  test('formatPercentage: one decimal unless asked', () => {
    expect(formatPercentage(45)).toBe('45.0%');
    expect(formatPercentage(33.333, 2)).toBe('33.33%');
    expect(formatPercentage(null)).toBe('0%');
    expect(formatPercentage('x')).toBe('0%');
  });

  test('formatQuantity: two decimals and the unit in capitals; nothing is a dash', () => {
    expect(formatQuantity(1234.5, 'kg')).toBe('1,234.50 KG');
    expect(formatQuantity(10)).toBe('10.00');
    expect(formatQuantity(null, 'm')).toBe('—');
  });
});

describe('formatFileSize', () => {
  test('bytes as such, then KB, MB and GB with one decimal', () => {
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatFileSize(2 * 1024 ** 3)).toBe('2.0 GB');
  });

  test('nothing is 0 B; past GB there is no unit (uploads stop at a few MB, so it never shows)', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(null)).toBe('0 B');
    expect(formatFileSize(1024 ** 4)).toBe('1.0 undefined');
  });
});

describe('getInitials', () => {
  test('first and last word, or the first two letters of a single word, in capitals', () => {
    expect(getInitials('Ranjith Kumar')).toBe('RK');
    expect(getInitials('Anna Maria Lopez')).toBe('AL');
    expect(getInitials('  ranjith  ')).toBe('RA');
  });

  test('nothing to take initials from is blank', () => {
    expect(getInitials('')).toBe('');
    expect(getInitials('   ')).toBe('');
    expect(getInitials(null)).toBe('');
    expect(getInitials(42)).toBe('');
  });
});
