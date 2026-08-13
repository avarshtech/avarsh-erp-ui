/**
 * Garment-industry UOM conversions.
 *
 * An item is purchased in its PRIMARY UOM and consumed in its SECONDARY UOM —
 * thread is bought in Cones but consumed in Meters, buttons are bought in Gross
 * but consumed in Pieces. The conversion factor answers "how many secondary UOM
 * make one primary UOM", and is stored per item because it genuinely varies:
 * one supplier's cone holds 5000m, another's holds 4000m.
 */

/**
 * Standard conversions that are fixed by definition, keyed by `primary>secondary`
 * symbol as seeded in mst_units_of_measure. Used only to pre-fill the field —
 * the user can always override.
 *
 * Deliberately absent: cone>m, roll>m, bdl>pcs, set>pcs, bag>kg. These vary by
 * item and supplier, so a preset would be a guess dressed up as a fact.
 */
export const UOM_CONVERSION_PRESETS = {
  'm>cm': 100,
  'm>mm': 1000,
  'yd>in': 36,
  'yd>m': 0.9144,
  'kg>g': 1000,
  'lb>g': 453.592,
  'grs>pcs': 144,
  'grs>dz': 12,
  'dz>pcs': 12,
  'pr>pcs': 2,
  'L>ml': 1000,
  'sqm>sqft': 10.7639,
};

/** Standard factor for a UOM pair, or null when the pair has no fixed conversion. */
export const getPresetFactor = (primarySymbol, secondarySymbol) => {
  if (!primarySymbol || !secondarySymbol) return null;
  const key = `${primarySymbol}>${secondarySymbol}`;
  return UOM_CONVERSION_PRESETS[key] ?? null;
};

/**
 * Whether a conversion is actually in play. False when there is no secondary UOM
 * (common for trims) or it matches the primary — both mean quantities pass
 * through untouched, which is a valid setup rather than an error.
 */
export const conversionApplies = (primaryUomId, secondaryUomId, factor) => {
  if (secondaryUomId == null || primaryUomId == null) return false;
  if (String(secondaryUomId) === String(primaryUomId)) return false;
  return Number(factor) > 0;
};

/** Convert a quantity from the secondary (consumption) UOM into the primary (purchase) UOM. */
export const convertToPrimary = (qtySecondary, factor) => {
  const qty = Number(qtySecondary);
  const f = Number(factor);
  if (!Number.isFinite(qty)) return null;
  if (!(f > 0)) return qty;
  return qty / f;
};

/** Full-word sentence for confirmation UI: "1 Gross = 144 Pieces". */
export const formatConversionLabel = (primaryName, secondaryName, factor) => {
  if (!primaryName || !secondaryName || !(Number(factor) > 0)) return '';
  const f = Number(factor).toLocaleString(undefined, { maximumFractionDigits: 6 });
  return `1 ${primaryName} = ${f} ${secondaryName}`;
};

/** Compact symbol form for dense table cells: "1 grs = 144 pcs". */
export const formatConversionShort = (primarySymbol, secondarySymbol, factor) =>
  formatConversionLabel(primarySymbol, secondarySymbol, factor);
