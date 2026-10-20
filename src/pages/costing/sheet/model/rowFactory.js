import { calcFabricNetCost, calcTrimPrice } from '../../../../utils/costingConstants';
import { conversionApplies } from '../../../../utils/uomConversions';
import { SECTION_CONFIG } from './sectionConfig';

// Row keys come from a counter, never Date.now(): two rows added in the same millisecond
// (a template apply, a duplicate) would otherwise collide and React would swap their state.
let seq = 0;
export const nextKey = (prefix) => `${prefix}_${++seq}`;

const UOM_BLANK = {
  consumption: '', uom: '', uomId: null, primaryUom: '', primaryUomId: null,
  secondaryUomId: null, uomConversionFactor: null,
};

const BLANK = {
  fabric: {
    ...UOM_BLANK, itemId: null, variantId: null, variantCode: '', fabricType: '', classification: 'Woven',
    description: '', fabricPrice: '', fabricWidthStd: '', fabricWidthVendor: '', vendorId: null,
    vendorName: '', allowancePct: 0, wastagePct: 0, netCost: 0, sizes: '',
  },
  localTrim: { ...UOM_BLANK, itemId: null, variantId: null, item: '', code: '', size: '', cost: '', price: 0, sizes: '' },
  importedTrim: { ...UOM_BLANK, itemId: null, variantId: null, item: '', code: '', size: '', costUsd: '', priceUsd: 0, sizes: '' },
  manufacturing: { processId: null, process: '', vendorId: null, vendorName: '', cost: '', comments: '', sizes: '' },
  overhead: { overheadId: null, description: '', cost: '', comments: '', sizes: '' },
};

/** Recompute the row's derived amount — the one place the per-row formulas are applied. */
export const recalcRow = (sectionKey, row) => {
  switch (sectionKey) {
    case 'fabric':
      return { ...row, netCost: calcFabricNetCost(row.consumption, row.fabricPrice, row.allowancePct, row.wastagePct, row.uomConversionFactor) };
    case 'localTrim':
      return { ...row, price: calcTrimPrice(row.consumption, row.cost, row.uomConversionFactor) };
    case 'importedTrim':
      return { ...row, priceUsd: calcTrimPrice(row.consumption, row.costUsd, row.uomConversionFactor) };
    default:
      return row;
  }
};

export const blankRow = (sectionKey, fields = {}) =>
  recalcRow(sectionKey, { ...BLANK[sectionKey], ...fields, key: nextKey(SECTION_CONFIG[sectionKey].prefix) });

/**
 * The UOM fields a row inherits from its variant. Consumption is captured in the SECONDARY
 * unit while the rate is per PRIMARY unit, so the row carries both and the factor between
 * them — stored only when a conversion genuinely applies, so null means "pass through".
 */
export const variantUomFields = (variant) => {
  const factorApplies = conversionApplies(variant?.uomId, variant?.secondaryUomId, variant?.uomConversionFactor);
  return {
    uom: variant?.secondaryUomSymbol || variant?.uomSymbol || '',
    uomId: variant?.secondaryUomId ?? variant?.uomId ?? null,
    primaryUom: variant?.uomSymbol || '',
    primaryUomId: variant?.uomId ?? null,
    secondaryUomId: variant?.secondaryUomId ?? null,
    uomConversionFactor: factorApplies ? Number(variant.uomConversionFactor) : null,
  };
};

/** Fields a picked variant writes onto a fabric or trim row. */
export const variantPatch = (sectionKey, variant, row = {}) => {
  const name = variant?.variantName || variant?.variantCode || '';
  const common = { variantId: variant?.id ?? null, itemId: variant?.itemId ?? null, ...variantUomFields(variant) };
  if (sectionKey !== 'fabric') return { ...common, item: name, code: variant?.variantCode || '' };
  const sub = (variant?.subCategoryName || '').toLowerCase();
  return {
    ...common,
    variantCode: variant?.variantCode || '',
    fabricType: name,
    description: variant?.description || row.description || '',
    ...(sub.includes('knit') ? { classification: 'Knits' } : sub.includes('woven') ? { classification: 'Woven' } : {}),
  };
};

/** A process or overhead pick; its default cost fills an empty cost cell. */
export const masterRecordPatch = (sectionKey, option, row = {}) => {
  const defaultCost = Number(option?.defaultCost) || 0;
  const cost = defaultCost > 0 && !row.cost ? { cost: defaultCost } : {};
  return sectionKey === 'manufacturing'
    ? { processId: option?.value ?? null, process: option?.label || '', ...cost }
    : { overheadId: option?.value ?? null, description: option?.label || '', ...cost };
};

/**
 * Rows from a saved sheet or a template. The saved UOM snapshot is kept as-is (never re-read
 * from the variant) so a saved sheet stays priced exactly as it was saved.
 */
export const hydrateRows = (sectionKey, rows) =>
  (rows || []).map((r) => {
    const { key: _ignored, ...rest } = r;
    const uom = BLANK[sectionKey].uom === undefined ? {} : {
      uom: r.uom || r.uomSymbol || r.uomName || '',
      primaryUom: r.primaryUom || r.primaryUomSymbol || '',
      uomConversionFactor: r.uomConversionFactor ?? null,
    };
    return recalcRow(sectionKey, { ...BLANK[sectionKey], ...rest, ...uom, key: nextKey(SECTION_CONFIG[sectionKey].prefix) });
  });
