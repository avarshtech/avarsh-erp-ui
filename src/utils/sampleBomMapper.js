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
 *
 * SIZE_WISE / VARIANT_PER_SIZE lines sum the per-size matrix consumption over
 * the selected sizes, × sampleQty per size. Which consumption depends on
 * whether the request names a colourway: the matrix is keyed by the ORDER's own
 * colour names, which is the list the request's colour is chosen from, so a
 * named colour is a direct lookup. A request that names none — a proto, a fit
 * sample — or one naming a shade the bulk matrix does not carry keeps the older
 * hedge of the MAX across colours, which is then the only figure guaranteed to
 * be enough.
 *
 * This is a port of SampleQtyCalculator.java and has to agree with it digit for
 * digit: the form shows this figure live while the user types and the server
 * stores its own on save. Change one and change the other in the same commit —
 * there is no JS test runner in this repo to catch a drift.
 */
export const computeSampleQtyRequired = (line, sampleQty = 0, sizes = [], colourName = null) => {
  const qty = Number(sampleQty) || 0;
  if (!qty || !sizes.length) return 0;
  const mode = line?.consumptionMode || 'SIMPLE';
  const base = Number(line?.consumption) || 0;
  if (mode === 'SIMPLE' || !line?.consumptionMatrix) {
    return round2(base * qty * sizes.length);
  }
  const matrix = line.consumptionMatrix || {};
  const trimmed = colourName == null ? '' : String(colourName).trim();
  const named = trimmed ? matrix[trimmed] : null;
  const colours = Object.keys(matrix);
  let total = 0;
  sizes.forEach((size) => {
    // A size the named colour does not cover reads 0 here and falls through to
    // the base below, exactly as an uncovered size does on the hedge path.
    const perSize = named
      ? (Number(named[size]) || 0)
      : Math.max(0, ...colours.map((c) => Number(matrix?.[c]?.[size]) || 0));
    total += (perSize || base) * qty;
  });
  return round2(total);
};
