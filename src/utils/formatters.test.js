// Golden tests: the shared display formatters as they behave today (2026-10-12). en-IN grouping
// comes from Node's full ICU, which every supported Node ships.
//   npx vitest run src/utils/formatters.test.js
import { describe, test, expect } from 'vitest';
import {
  formatAmount, formatCount, formatCurrency, formatDate, formatFileSize, formatInr, formatMoney, formatNumber,
  formatPercentage, formatQuantity, formatRupees, getCurrencySymbol, getInitials,
} from './formatters';
import { fmtMoney } from '../pages/production/jobwork/jwFormat';

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

// Each preset replaced local copies on the screens. The copies are kept here as they were, and every preset
// must give their text for every value, called alone and the way a table calls `render` (value, row, index).
describe('the presets give the text of the local copies they replaced', () => {
  const VALUES = [null, undefined, 0, -0, 1, -1, 1.5, 0.125, 1.005, 2.675, 0.0049, 99.999, 1234.5678, -98765.4321,
    100000, 10000000, 123456789.123456, 1e21, '1500', '12.345', '-7.5', '', ' ', NaN, Infinity, 'abc', true, false];
  const ROW = { id: 1, name: 'row', empty: 'x', prefix: 'y' };

  const COPIES = [
    ['formatRupees: HR lists and views (formatCurrency), SalaryRecordDrawer (money)', formatRupees,
      (val) => (val != null ? `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-')],
    ['SalarySlipView formatCurrency: a missing figure prints ₹0.00',
      (val) => formatAmount(val, { prefix: '₹', minDecimals: 2, empty: '₹0.00' }),
      (val) => (val != null ? `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹0.00')],
    ['formatMoney: Cut Panel and Garment Process PO lines (money)', formatMoney,
      (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })],
    ['formatInr: job-work PO lists (money), JobWorkPoHero and JobWorkValueSummary (inr)', formatInr,
      (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
    ['formatCount: job-work issue-from-PO grids (n)', formatCount,
      (v) => Number(v || 0).toLocaleString('en-IN')],
    ['jwFormat fmtMoney: the Job Work screens', fmtMoney,
      (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`],
  ];

  test.each(COPIES)('%s', (_, preset, copy) => {
    for (const value of VALUES) {
      expect(preset(value), String(value)).toBe(copy(value));
      expect(preset(value, ROW, 0), `${String(value)} as render`).toBe(copy(value, ROW, 0));
    }
  });
});
