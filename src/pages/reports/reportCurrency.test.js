// Which currency a report's money cell is shown in (U307).
//   npx vitest run src/pages/reports/reportCurrency.test.js
import { describe, test, expect } from 'vitest';
import { cellCurrency } from './reportCurrency';

describe('cellCurrency', () => {
  test('a row shows its own currency when the report has a currency column', () => {
    expect(cellCurrency('total_order_value', { currency: 'USD' }, true)).toBe('USD');
    expect(cellCurrency('total_order_value', { currency: 'INR' }, true)).toBe('INR');
    expect(cellCurrency('final_price', { currency: ' eur ' }, true)).toBe('EUR');
  });

  test('a row with no currency value, or a report with no currency column, has none', () => {
    expect(cellCurrency('total_order_value', { currency: null }, true)).toBeNull();
    expect(cellCurrency('total_order_value', { currency: '' }, true)).toBeNull();
    expect(cellCurrency('grand_total', { currency: 'INR' }, false)).toBeNull();
    expect(cellCurrency('grand_total', {}, false)).toBeNull();
  });

  test('a column that names its currency keeps it, whatever the row says', () => {
    expect(cellCurrency('final_price_usd', { currency: 'INR' }, true)).toBe('USD');
    expect(cellCurrency('final_price_usd', {}, false)).toBe('USD');
  });
});
