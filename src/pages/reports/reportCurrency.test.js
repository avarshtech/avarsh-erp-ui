// Which currency a report's money cell is shown in (U307).
//   npx vitest run src/pages/reports/reportCurrency.test.js
import { describe, test, expect } from 'vitest';
import { cellCurrency, sourceHasCurrency } from './reportCurrency';

describe('sourceHasCurrency', () => {
  test('orders and cost sheets carry a currency, even when the report left the column out', () => {
    expect(sourceHasCurrency({ dataSourceKey: 'orders', fields: [] })).toBe(true);
    expect(sourceHasCurrency({ dataSourceKey: 'cost_sheets' })).toBe(true);
    expect(sourceHasCurrency({ dataSourceKey: null, fields: [{ fieldCode: 'currency' }] })).toBe(true);
  });

  test('purchase orders, inventory and production do not', () => {
    expect(sourceHasCurrency({ dataSourceKey: 'purchase_orders', fields: [{ fieldCode: 'grand_total' }] })).toBe(false);
    expect(sourceHasCurrency(null)).toBe(false);
  });
});

const inRun = { sourceHasCurrency: true, currencyInRun: true };
const leftOut = { sourceHasCurrency: true, currencyInRun: false };
const rupeeOnly = { sourceHasCurrency: false };

describe('cellCurrency', () => {
  test('a source with no currency field is rupees, as before', () => {
    expect(cellCurrency('grand_total', {}, rupeeOnly)).toBe('INR');
    expect(cellCurrency('unit_cost', { currency: 'USD' }, rupeeOnly)).toBe('INR');
    expect(cellCurrency('grand_total', {})).toBe('INR');
  });

  test('with the currency field in the run, each row shows its own currency', () => {
    expect(cellCurrency('total_order_value', { currency: 'USD' }, inRun)).toBe('USD');
    expect(cellCurrency('total_order_value', { currency: 'INR' }, inRun)).toBe('INR');
    expect(cellCurrency('final_price', { currency: ' eur ' }, inRun)).toBe('EUR');
    expect(cellCurrency('total_order_value', { currency: null }, inRun)).toBeNull();
    expect(cellCurrency('total_order_value', { currency: '' }, inRun)).toBeNull();
  });

  test('with the currency field left out of the run, the currency is unknown', () => {
    expect(cellCurrency('total_order_value', { currency: 'INR' }, leftOut)).toBeNull();
    expect(cellCurrency('total_order_value', {}, leftOut)).toBeNull();
  });

  test('a column that names its currency keeps it, whatever the row or source says', () => {
    expect(cellCurrency('final_price_usd', { currency: 'INR' }, inRun)).toBe('USD');
    expect(cellCurrency('final_price_usd', {}, leftOut)).toBe('USD');
    expect(cellCurrency('final_price_usd', {}, rupeeOnly)).toBe('USD');
  });
});
