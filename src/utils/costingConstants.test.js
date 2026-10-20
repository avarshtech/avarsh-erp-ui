// Golden tests: the costing formula helpers as they behave today (2026-10-12).
//   npx vitest run src/utils/costingConstants.test.js
import { describe, test, expect } from 'vitest';
import {
  COSTING_STATUS, DELETABLE_STATUSES, EDITABLE_STATUSES, STATUS_TRANSITIONS, calcAutoProfit,
  calcFabricNetCost, calcFinalPrice, calcFinalPriceUsd, calcKnitsGramsPerPart, calcKnitsTotalGrams,
  calcTotalMakingPrice, calcTotalOverheadCharges, calcTrimPrice, formatCurrency, getStatusLabel,
} from './costingConstants';

describe('status flow', () => {
  test('Draft -> Final -> Approved, with revise and reject from Final, and Rejected back to Draft', () => {
    expect(STATUS_TRANSITIONS).toEqual({
      Draft: ['Final'],
      Final: ['Approved', 'Draft', 'Rejected'],
      Approved: [],
      Rejected: ['Draft'],
    });
    expect(EDITABLE_STATUSES).toEqual([COSTING_STATUS.DRAFT, COSTING_STATUS.REJECTED]);
    expect(DELETABLE_STATUSES).toEqual([COSTING_STATUS.DRAFT, COSTING_STATUS.REJECTED]);
    expect(getStatusLabel('Final')).toBe('Final');
    expect(getStatusLabel('ON_HOLD')).toBe('ON_HOLD');
    expect(getStatusLabel(undefined)).toBe('');
  });
});

describe('row formulas', () => {
  test('fabric: consumption restated in the purchase UOM, times the price, allowance and wastage compounded', () => {
    // 59.33 GMS of a fabric bought at 600/kg (1 kg = 1000 g), +5% allowance, +2% wastage
    expect(calcFabricNetCost(59.33, 600, 5, 2, 1000)).toBeCloseTo(0.05933 * 600 * 1.05 * 1.02, 10);
    expect(calcFabricNetCost(1.2, 250, 10, 5)).toBeCloseTo(346.5, 10);
    // Compounded, not added: 10% and 10% is x1.21
    expect(calcFabricNetCost(1, 100, 10, 10)).toBeCloseTo(121, 10);
  });

  test('fabric: no factor, or a factor that is not positive, passes the quantity through', () => {
    expect(calcFabricNetCost(2, 50, 0, 0, null)).toBe(100);
    expect(calcFabricNetCost(2, 50, 0, 0, 0)).toBe(100);
    expect(calcFabricNetCost(2, 50, 0, 0, -3)).toBe(100);
    expect(calcFabricNetCost('', '', null, undefined)).toBe(0);
  });

  test('trim: consumption in the purchase UOM times the cost', () => {
    // 150 m of thread bought by the 5000 m cone at 120 a cone
    expect(calcTrimPrice(150, 120, 5000)).toBeCloseTo(3.6, 10);
    expect(calcTrimPrice(4, 2.5)).toBe(10);
    expect(calcTrimPrice(null, 2.5)).toBe(0);
  });

  test('knits: grams per part is L x W x parts x GSM / 10000, zero when any is missing', () => {
    expect(calcKnitsGramsPerPart(70, 50, 2, 180)).toBe(126);
    expect(calcKnitsGramsPerPart('70', '50', '1', '160')).toBe(56);
    expect(calcKnitsGramsPerPart(70, 0, 2, 180)).toBe(0);
    expect(calcKnitsGramsPerPart(70, 50, 2, null)).toBe(0);
    expect(calcKnitsTotalGrams([{ gramsPerPart: 126 }, { gramsPerPart: '56' }, { gramsPerPart: null }])).toBe(182);
  });
});

describe('sheet totals', () => {
  test('making price is fabric + trims + manufacturing + markup', () => {
    expect(calcTotalMakingPrice(100, 20.5, '30', null)).toBe(150.5);
  });

  test('overheads are agent % + profit % of the making price', () => {
    expect(calcTotalOverheadCharges(5, 10, 200)).toBeCloseTo(30, 10);
    expect(calcTotalOverheadCharges(null, undefined, 200)).toBe(0);
  });

  test('final price is the total over the exchange rate; a zero or missing rate divides by 1', () => {
    expect(calcFinalPrice(8380, 83.8)).toBeCloseTo(100, 10);
    // `Number(rate) || 1` turns 0 into 1 before the `rate === 0` guard, so that guard never fires
    expect(calcFinalPrice(500, 0)).toBe(500);
    expect(calcFinalPrice(500, null)).toBe(500);
  });

  test('a target price gives back the profit %, after the agent commission', () => {
    // 200 to make, 5% commission (10): 250 leaves 40, which is 20% of 200
    expect(calcAutoProfit(250, 200, 5)).toBeCloseTo(20, 10);
    expect(calcAutoProfit(180, 200, 5)).toBeCloseTo(-15, 10);
    expect(calcAutoProfit(250, 0, 5)).toBe(0);
  });

  test('the USD equivalent: as is when quoting in USD, else through INR at the stored rate', () => {
    expect(calcFinalPriceUsd(12.5, 'USD', 84)).toBe(12.5);
    expect(calcFinalPriceUsd(10, 'EUR', 90, 83.8)).toBeCloseTo(900 / 83.8, 10);
    // The default USD->INR rate is 83.80
    expect(calcFinalPriceUsd(100, 'INR', 1)).toBeCloseTo(100 / 83.8, 10);
    // A zero rate divides by 1, as in calcFinalPrice
    expect(calcFinalPriceUsd(100, 'INR', 1, 0)).toBe(100);
  });

  test('formatCurrency: symbol, Indian grouping, two decimals; nothing is zero', () => {
    expect(formatCurrency(123456.789)).toBe('₹ 1,23,456.79');
    expect(formatCurrency(12.5, 'USD')).toBe('$ 12.50');
    expect(formatCurrency(null, 'EUR')).toBe('€ 0.00');
    expect(formatCurrency('abc')).toBe('₹ 0.00');
  });
});
