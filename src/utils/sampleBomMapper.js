/**
 * What the sample request form still works out for itself.
 *
 * Materialising a BOM into material lines used to live here; the server does it
 * now (`GET /sample-requests/bom-preview`, SampleBomMaterialiser), because the
 * section, width and colour it derives have to agree with what is stored on the
 * request. What is left are the two figures that move while the user is still
 * typing, so they cannot come from a response.
 */

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
