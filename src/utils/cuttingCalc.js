/**
 * Live-preview arithmetic for the marker planning grid, mirroring
 * MarkerPlanCalculator on the server. The saved plan always carries the
 * server's own figures — these exist only so the matrix updates as the planner
 * types, before anything is posted. Keep the two in step.
 */

/** Order quantity plus the plan's cut allowance. */
export const allowanceQty = (orderQty, pct) => Math.round((orderQty || 0) * (1 + (pct || 0) / 100));

/** The allowance of every size. */
export const allowancePerSize = (sizes, sizeQty, pct) => Object.fromEntries(
  (sizes || []).map((size) => [size, allowanceQty(sizeQty?.[size], pct)]),
);

/**
 * Total quantity to cut. Summed from the per-size allowances rather than taken
 * from the order total, because each size is rounded on its own — the floor
 * cuts whole garments per size, and the two routes differ by a piece or two.
 */
export const totalAllowanceQty = (sizes, sizeQty, pct) => Object.values(
  allowancePerSize(sizes, sizeQty, pct),
).reduce((a, b) => a + b, 0);

/** Garments of every size in one ply of a marker. */
export const piecesPerMarker = (marker, sizes) => (sizes || []).reduce(
  (sum, size) => sum + (marker?.ratio?.[size] || 0), 0,
);

/** What a marker cuts in total: plies × garments per ply. */
export const markerQty = (marker, sizes) => (marker?.markerHeight || 0) * piecesPerMarker(marker, sizes);

/** What the markers cut of each size, summed across the plan. */
export const plannedPerSize = (markers, sizes) => Object.fromEntries(
  (sizes || []).map((size) => [size, (markers || []).reduce(
    (sum, m) => sum + (m.markerHeight || 0) * (m.ratio?.[size] || 0), 0,
  )]),
);

/**
 * Sizes cut beyond their allowance. The excess moves to the next smaller size;
 * at the smallest size there is nowhere to send it, so it is reported as
 * wastage with no jump target.
 */
export const sizeJumps = (sizes, allowancePerSize, plannedPerSizeMap) => (sizes || []).reduce((jumps, size, i) => {
  const cutQty = plannedPerSizeMap[size] || 0;
  const orderQty = allowancePerSize[size] || 0;
  if (cutQty > orderQty) {
    jumps.push({ size, cutQty, orderQty, excess: cutQty - orderQty, jumpTo: i > 0 ? sizes[i - 1] : null });
  }
  return jumps;
}, []);
