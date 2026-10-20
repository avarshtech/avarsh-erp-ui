import { sameUom } from '../../../../utils/uomConversions';
import { recalcRow } from './rowFactory';

const RATE_FIELD = { fabric: 'fabricPrice', localTrim: 'cost', importedTrim: 'costUsd' };

/**
 * The fresh rate for a row, or null to keep the one it has. A purchase-order price is what was
 * actually paid, so it wins — but only in rupees and per the row's purchase unit (PO prices are
 * INR, per the PO line's unit). Otherwise the newest costing's rate, when it is in the row's
 * rate currency. Nothing is converted, so nothing is guessed.
 */
function freshRate(price, rateCurrency, row) {
  if (!price) return null;
  const uomMatches = !row.primaryUom || !price.poUomSymbol || sameUom(price.poUomSymbol, row.primaryUom);
  if (rateCurrency === 'INR' && price.poPrice != null && uomMatches) return Number(price.poPrice);
  if (price.costingPrice != null && price.costingCurrency === rateCurrency) return Number(price.costingPrice);
  return null;
}

/**
 * Rows from a template or a copied costing, re-priced from the last PO / costing prices of their
 * variants. Returns the updated sections and how many rates changed.
 */
export function applyLastPrices(sections, lastPrices, costingCurrency) {
  const byVariant = new Map((lastPrices || []).map((p) => [p.variantId, p]));
  let updated = 0;
  const next = { ...sections };
  Object.entries(RATE_FIELD).forEach(([key, field]) => {
    const rateCurrency = key === 'importedTrim' ? 'USD' : costingCurrency;
    next[key] = (sections[key] || []).map((row) => {
      const rate = freshRate(byVariant.get(row.variantId), rateCurrency, row);
      if (rate == null || rate === Number(row[field])) return row;
      updated += 1;
      return recalcRow(key, { ...row, [field]: rate });
    });
  });
  return { sections: next, updated };
}

export const variantIdsOf = (sections) =>
  Object.keys(RATE_FIELD).flatMap((k) => (sections[k] || []).map((r) => r.variantId)).filter(Boolean);
