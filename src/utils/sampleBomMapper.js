import { defaultMandatory } from './sampleFabricRules';

/**
 * Maps REAL BOM lines into SR material lines (PRD v3 §8.2 D).
 * The BOM has no dedicated fabricType/classification/width columns — they are
 * derived the same way the BOM screens derive them:
 *  - fabric vs trim: categoryName contains "fabric" (BOMView.jsx:37 test)
 *  - width: variants.W | variants.Width (BOMForm convention)
 *  - colour/design: variants.Colour|Color|Design, else the variant name
 * Spec fields stay locked to these BOM values on the SR — only Colour/Design
 * and the per-line mandatory flag are SR-editable.
 */

const isFabricLine = (line) => (line?.categoryName || '').toLowerCase().includes('fabric');

const widthOf = (line) =>
  line?.variants?.W ?? line?.variants?.Width ?? line?.variants?.width ?? null;

const colourOf = (line) =>
  line?.variants?.Colour ?? line?.variants?.Color ?? line?.variants?.Design
  ?? line?.variantName ?? '';

export const buildMaterialsFromBom = (bom) => (bom?.lines || []).map((line, idx) => {
  const fabric = isFabricLine(line);
  const mapped = {
    lineNo: idx + 1,
    bomLineId: line.id ?? null,
    section: fabric ? 'FABRIC' : 'TRIM',
    fabricType: line.categoryName || (fabric ? 'Fabric' : 'Trim'),
    classification: line.subCategoryName || '',
    description: [line.itemName, line.itemCode ? `(${line.itemCode})` : ''].filter(Boolean).join(' '),
    width: widthOf(line),
    consumption: line.consumptionPerGarment ?? null,
    consumptionMode: line.consumptionMode || 'SIMPLE',
    consumptionMatrix: line.consumptionMatrix || null,
    uom: line.uom || '',
    colourDesign: colourOf(line),
    originalColourDesign: colourOf(line),
    mandatory: false,
  };
  // Buyer-specified trims (threads, labels) default to mandatory — locked to
  // spec even when substitution is allowed (per-line override, OQ2).
  mapped.mandatory = !fabric && defaultMandatory(mapped);
  return mapped;
});

/**
 * Stock verdict for one material line. Availability is the server's live
 * rollup; the requirement moves with the sample qty and sizes the user is still
 * typing, so this is derived per render and never frozen onto the line.
 * The detail view reads the server's own `stockStatus` instead — there the
 * quantities are settled.
 */
export const stockStatusFor = (available, required = 0) => {
  const have = Number(available) || 0;
  if (have <= 0) return 'OUT_OF_STOCK';
  if (required && have < Number(required)) return 'SHORTFALL';
  return 'IN_STOCK';
};

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Sample Qty Required = Consumption × Sample Qty × No. of Sizes (PRD §8.2 D).
 * SIZE_WISE / VARIANT_PER_SIZE lines sum the per-size matrix consumption over
 * the selected sizes (MAX across matrix colours — conservative, since the
 * sample colour may not match a bulk matrix colour), × sampleQty per size.
 */
export const computeSampleQtyRequired = (line, sampleQty = 0, sizes = []) => {
  const qty = Number(sampleQty) || 0;
  if (!qty || !sizes.length) return 0;
  const mode = line?.consumptionMode || 'SIMPLE';
  const base = Number(line?.consumption) || 0;
  if (mode === 'SIMPLE' || !line?.consumptionMatrix) {
    return round2(base * qty * sizes.length);
  }
  const colours = Object.keys(line.consumptionMatrix || {});
  let total = 0;
  sizes.forEach((size) => {
    const perSize = Math.max(0, ...colours.map((c) => Number(line.consumptionMatrix?.[c]?.[size]) || 0));
    total += (perSize || base) * qty;
  });
  return round2(total);
};
