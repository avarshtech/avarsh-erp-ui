// Golden tests: the cost sheet's totals, whole garment and per size, as they compute today
// (2026-10-12). The server's CostingCalculator stays authoritative on save; this is what the
// sheet shows while it is edited.
//   npx vitest run src/pages/costing/sheet/model/costCalculator.test.js
import { describe, test, expect } from 'vitest';
import { computeTotals, rowSizes } from './costCalculator';

const sheet = (commercial = {}) => ({
  sections: {
    // The second fabric is used on L only; the second process on S and M only
    fabric: [{ netCost: 200, sizes: '' }, { netCost: 50, sizes: 'L' }],
    localTrim: [{ price: 30, sizes: '' }],
    importedTrim: [{ priceUsd: 0.5, sizes: '' }],
    manufacturing: [{ cost: 60, sizes: '' }, { cost: 10, sizes: 'S, M' }],
    overhead: [{ cost: 20, sizes: '' }],
  },
  commercial: {
    agentCommissionPct: 5, profitPct: 10, targetPrice: '', perSizeOverrides: {}, syncPercentages: true, ...commercial,
  },
});
const INR_QUOTED_IN_USD = { currency: 'INR', quoteCurrency: 'USD', costingType: 'FOB', actualRate: 84, sizes: ['S', 'M', 'L'] };

describe('the whole garment', () => {
  test('making = fabric + accessories (imported at the rate) + manufacturing + markup; overheads on top', () => {
    const t = computeTotals(sheet(), INR_QUOTED_IN_USD, 83.8);
    expect(t).toMatchObject({
      fabric: 250, local: 30, importedUsd: 0.5, accessories: 72, manufacturing: 70, markup: 20, making: 412,
      agentPct: 5, profitPct: 10, usdToCostingRate: 84, costingToQuoteRate: 84,
    });
    expect(t.charges).toBeCloseTo(61.8, 10);
    expect(t.total).toBeCloseTo(473.8, 10);
    // Quoted in USD: the final price is the total over the rate, and is its own USD figure
    expect(t.final).toBeCloseTo(473.8 / 84, 10);
    expect(t.usd).toBe(t.final);
  });

  test('CMT leaves the fabric out of the making price (the buyer supplies it) but still reports it', () => {
    const t = computeTotals(sheet(), { ...INR_QUOTED_IN_USD, costingType: 'CMT' }, 83.8);
    expect(t.fabric).toBe(250);
    expect(t.making).toBe(162);
  });

  test('a target price sets the profit %, rounded to two places, so the total lands near the target', () => {
    const t = computeTotals(sheet({ targetPrice: 550 }), INR_QUOTED_IN_USD, 83.8);
    // (550 - 412 - 5% of 412) / 412 = 28.495...% -> 28.5
    expect(t.profitPct).toBe(28.5);
    expect(t.total).toBeCloseTo(550.02, 10);
  });

  test('quoting in the costing currency: no conversion, and the USD figure uses the stored USD rate', () => {
    const t = computeTotals(sheet(), { currency: 'INR', quoteCurrency: 'INR', costingType: 'FOB', actualRate: 84 }, 83.8);
    expect(t.costingToQuoteRate).toBe(1);
    expect(t.final).toBeCloseTo(473.8, 10);
    expect(t.usd).toBeCloseTo(473.8 / 83.8, 10);
    expect(computeTotals(sheet(), { currency: 'INR', quoteCurrency: 'INR', actualRate: 84 }, 0).usd).toBe(0);
  });

  test('a USD sheet takes imported items one for one; a missing rate counts as 1', () => {
    const t = computeTotals(sheet(), { currency: 'USD', quoteCurrency: 'USD', costingType: 'FOB' }, 83.8);
    expect(t.usdToCostingRate).toBe(1);
    expect(t.accessories).toBe(30.5);
    expect(t.final).toBe(t.total);
  });
});

describe('per size', () => {
  test('a row with no sizes counts in every size; the sizes run in the sheet\'s order', () => {
    const t = computeTotals(sheet(), INR_QUOTED_IN_USD, 83.8);
    expect(t.sizeKeys).toEqual(['S', 'M', 'L']);
    expect(t.perSize.map((s) => [s.size, s.fabric, s.manufacturing, s.making])).toEqual([
      ['S', 200, 70, 362], ['M', 200, 70, 362], ['L', 250, 60, 402],
    ]);
    expect(t.perSize[2].total).toBeCloseTo(402 * 1.15, 10);
    expect(t.perSize[2]).toMatchObject({ agentPct: 5, profitPct: 10, targetPrice: '' });
  });

  test('synced percentages ignore the size overrides; unsynced, an override wins and the rest inherit', () => {
    const overrides = { L: { profitPct: 15, targetPrice: 600 } };
    const synced = computeTotals(sheet({ perSizeOverrides: overrides }), INR_QUOTED_IN_USD, 83.8);
    expect(synced.perSize[2]).toMatchObject({ profitPct: 10, targetPrice: 600 });
    const own = computeTotals(sheet({ perSizeOverrides: overrides, syncPercentages: false }), INR_QUOTED_IN_USD, 83.8);
    expect(own.perSize[2]).toMatchObject({ agentPct: 5, profitPct: 15, targetPrice: 600 });
    expect(own.perSize[2].total).toBeCloseTo(402 * 1.2, 10);
    expect(own.perSize[0].profitPct).toBe(10);
  });

  test('no per-size view until rows name at least two sizes; sizes off the sheet\'s list go last', () => {
    const one = sheet();
    one.sections.fabric = [{ netCost: 200, sizes: 'M' }];
    one.sections.manufacturing = [{ cost: 60, sizes: '' }];
    expect(computeTotals(one, INR_QUOTED_IN_USD, 83.8).perSize).toEqual([]);
    one.sections.overhead = [{ cost: 20, sizes: 'XXL,S' }];
    expect(computeTotals(one, INR_QUOTED_IN_USD, 83.8).sizeKeys).toEqual(['S', 'M', 'XXL']);
  });

  test('rowSizes splits on commas and drops blanks', () => {
    expect(rowSizes({ sizes: ' S, M ,,L ' })).toEqual(['S', 'M', 'L']);
    expect(rowSizes({})).toEqual([]);
  });
});
