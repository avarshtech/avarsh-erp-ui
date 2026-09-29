import {
  calcAutoProfit,
  calcFinalPrice,
  calcTotalMakingPrice,
  calcTotalOverheadCharges,
} from '../../../../utils/costingConstants';

/**
 * The sheet's totals — whole-garment and per size — in one place. It mirrors the server's
 * CostingCalculator (which stays authoritative on save): CMT excludes buyer-supplied fabric
 * from the making price, per size as well as overall, and a target price derives the profit %.
 */
const sum = (rows, field) => rows.reduce((s, r) => s + (Number(r[field]) || 0), 0);
const round2 = (n) => Math.round(n * 100) / 100;
export const rowSizes = (row) => (row.sizes || '').split(',').map((s) => s.trim()).filter(Boolean);
const inSize = (row, size) => { const list = rowSizes(row); return list.length === 0 || list.includes(size); };
// Sizes in the order the sheet lists them (XS, S, M, L…); any a row names outside that list go last.
const bySheetOrder = (sheetSizes = []) => (a, b) => {
  const rank = (s) => { const i = sheetSizes.indexOf(s); return i < 0 ? sheetSizes.length : i; };
  return rank(a) - rank(b) || a.localeCompare(b);
};

export function computeTotals({ sections, commercial }, header, usdToInrRate) {
  const { currency, quoteCurrency, costingType } = header;
  const actualRate = Number(header.actualRate) || 1;
  // No conversion when the sheet is already in USD / already in the quote currency.
  const usdToCostingRate = currency === 'USD' ? 1 : actualRate;
  const costingToQuoteRate = currency === quoteCurrency ? 1 : actualRate;
  const isCmt = costingType === 'CMT';

  const breakdown = (pick) => {
    const fabric = sum(pick('fabric'), 'netCost');
    const local = sum(pick('localTrim'), 'price');
    const importedUsd = sum(pick('importedTrim'), 'priceUsd');
    const accessories = local + importedUsd * usdToCostingRate;
    const manufacturing = sum(pick('manufacturing'), 'cost');
    const markup = sum(pick('overhead'), 'cost');
    const making = calcTotalMakingPrice(isCmt ? 0 : fabric, accessories, manufacturing, markup);
    return { fabric, local, importedUsd, accessories, manufacturing, markup, making };
  };
  // USD equivalent exactly as CostingCalculator saves it: the final price when quoting in USD,
  // otherwise the costing-currency total over the stored USD→INR rate.
  const quote = (making, agentPct, profitPct) => {
    const charges = calcTotalOverheadCharges(agentPct, profitPct, making);
    const total = making + charges;
    const final = calcFinalPrice(total, costingToQuoteRate);
    const usd = quoteCurrency === 'USD' ? final : usdToInrRate > 0 ? total / usdToInrRate : 0;
    return { charges, total, final, usd };
  };

  const whole = breakdown((key) => sections[key]);
  const agentPct = Number(commercial.agentCommissionPct) || 0;
  const target = Number(commercial.targetPrice) || 0;
  const profitPct = target > 0 && whole.making > 0
    ? round2(calcAutoProfit(target, whole.making, agentPct))
    : Number(commercial.profitPct) || 0;
  const price = quote(whole.making, agentPct, profitPct);

  const allRows = Object.values(sections).flat();
  const sizeKeys = [...new Set(allRows.flatMap(rowSizes))].sort(bySheetOrder(header.sizes));
  const perSize = sizeKeys.length <= 1 ? [] : sizeKeys.map((size) => {
    const part = breakdown((key) => sections[key].filter((r) => inSize(r, size)));
    const override = commercial.perSizeOverrides[size] || {};
    const agent = commercial.syncPercentages ? agentPct : override.agentCommissionPct ?? agentPct;
    const profit = commercial.syncPercentages ? profitPct : override.profitPct ?? profitPct;
    return { size, ...part, agentPct: agent, profitPct: profit, targetPrice: override.targetPrice ?? '', ...quote(part.making, agent, profit) };
  });

  return { ...whole, agentPct, profitPct, ...price, usdToCostingRate, costingToQuoteRate, sizeKeys, perSize };
}
