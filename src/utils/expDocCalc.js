/**
 * Export Documentation — pure calculation core (PRD BR-05 / BR-06).
 *
 * No I/O, no React. Shared by the mock service (which persists) and the screens
 * (which recompute live), so the two can never disagree — the same contract
 * billPassingCalc.js states at the top of its file.
 *
 * Two rules shape everything here:
 *
 *  1. Pieces per carton and total pieces are ALWAYS recomputed, never read from a
 *     stored field. The packing module may hold stale copies; this module is the
 *     authority (PRD §7.3).
 *
 *  2. Carton counts are UNBOUNDED — they follow the buyer's order quantity, so no
 *     ceiling may be assumed. Totals are therefore computed arithmetically from the
 *     ranges, never by materialising cartons: "sum over expanded cartons" is a
 *     semantic rule about per-carton weights, and arithmetically
 *         sum over cartons(w) === sum over rows(w_row * cartonCount_row)
 *     so the workspace stays O(rows) whether a shipment holds 40 cartons or 40,000.
 *     Only the sticker renderer materialises cartons, and only for one scope.
 */

import { PACKING_TYPE, DEFAULT_TENANT_CONFIG } from './expDocConstants';

// ─── Rounding ───────────────────────────────────────────────────────────────────
// The EPSILON correction matches billPassingCalc.js so the two modules round
// identically on the same input.
export const round = (n, dp = 2) => {
  const p = 10 ** dp;
  return Math.round(((Number(n) || 0) + Number.EPSILON) * p) / p;
};

export const round2 = (n) => round(n, 2);
export const round3 = (n) => round(n, 3);
export const round5 = (n) => round(n, 5);

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const int = (v) => Math.trunc(num(v));

// Weights accumulate as integer milli-kg and dimensions as integer millimetres, so
// a thousand additions cannot drift. Converted back exactly once, at the edge.
export const toMilliKg = (kg) => Math.round(num(kg) * 1000);
export const fromMilliKg = (mkg) => mkg / 1000;
export const toMm = (cm) => Math.round(num(cm) * 10);

// ─── Per-row derivation (BR-06) ─────────────────────────────────────────────────

/** Cartons covered by a row's from–to range. Inclusive; never negative. */
export const cartonCount = (row) => {
  const from = int(row?.cartonFrom);
  const to = int(row?.cartonTo);
  if (!from || !to || to < from) return 0;
  return to - from + 1;
};

const sumMap = (map) => Object.values(map || {}).reduce((s, v) => s + num(v), 0);

/** Pieces in one assortment = sum of the size ratio. Stored value wins if present. */
export const piecesPerAssortment = (row) =>
  row?.piecesPerAssortment != null ? int(row.piecesPerAssortment) : sumMap(row?.ratio);

/** Pieces in one master polybag. Stored value wins; otherwise sum the pack ratio. */
export const piecesPerMpb = (row) =>
  row?.pcsPerMpb != null ? int(row.pcsPerMpb) : sumMap(row?.ratio);

/**
 * Pieces per carton, per packing type (BR-06). Never read row.piecesPerCarton.
 *   SOLID / EXTRA  sum(sizeQty)
 *   MIXED          sum over colour rows of sum(sizeQty)
 *   RATIO          piecesPerAssortment x assortmentsPerCarton
 *   MPB            piecesPerMpb x mpbPerCarton
 */
export const piecesPerCarton = (row) => {
  switch (row?.packingType) {
    case PACKING_TYPE.RATIO:
      return piecesPerAssortment(row) * int(row.assortmentsPerCarton);
    case PACKING_TYPE.MPB:
      return piecesPerMpb(row) * int(row.mpbPerCarton);
    case PACKING_TYPE.MIXED:
      return (row.mixedRows || []).reduce((s, r) => s + sumMap(r?.sizeQty), 0);
    case PACKING_TYPE.SOLID:
    case PACKING_TYPE.EXTRA:
    default:
      return sumMap(row?.sizeQty);
  }
};

/** Total pieces contributed by a row = pieces/carton x carton count. */
export const totalPieces = (row) => piecesPerCarton(row) * cartonCount(row);

/**
 * Quantity per size in ONE carton, normalising all four quantity shapes to a single
 * {size: qty} map so the grid and the printed columns share one code path.
 * Returns {} when a shape carries no size breakdown (e.g. MPB without a pack ratio).
 */
export const sizeQtyPerCarton = (row) => {
  const out = {};
  if (!row) return out;
  switch (row.packingType) {
    case PACKING_TYPE.RATIO: {
      const packs = int(row.assortmentsPerCarton);
      Object.entries(row.ratio || {}).forEach(([size, r]) => {
        if (num(r)) out[size] = num(r) * packs;
      });
      return out;
    }
    case PACKING_TYPE.MPB: {
      const packs = int(row.mpbPerCarton);
      Object.entries(row.ratio || {}).forEach(([size, r]) => {
        if (num(r)) out[size] = num(r) * packs;
      });
      return out;
    }
    case PACKING_TYPE.MIXED: {
      (row.mixedRows || []).forEach((mr) => {
        Object.entries(mr?.sizeQty || {}).forEach(([size, q]) => {
          if (num(q)) out[size] = (out[size] || 0) + num(q);
        });
      });
      return out;
    }
    default: {
      Object.entries(row.sizeQty || {}).forEach(([size, q]) => {
        if (num(q)) out[size] = num(q);
      });
      return out;
    }
  }
};

/** Quantity per size across the whole row (one carton's breakdown x carton count). */
export const totalSizeQty = (row) => {
  const per = sizeQtyPerCarton(row);
  const count = cartonCount(row);
  const out = {};
  Object.entries(per).forEach(([size, q]) => {
    out[size] = q * count;
  });
  return out;
};

// ─── Volume (BR-05) ─────────────────────────────────────────────────────────────

/**
 * Cubic millimetres for one carton — an exact integer, so totals never drift.
 * Dimensions are captured in cm, commonly with one decimal.
 */
export const cartonVolumeMm3 = (row) => toMm(row?.lengthCm) * toMm(row?.breadthCm) * toMm(row?.heightCm);

/**
 * CBM for one carton = L x B x H / divisor, with L/B/H in cm (default divisor
 * 1,000,000). Derived from the integer mm3 volume: 1 cm3 === 1000 mm3.
 */
export const cbmPerCarton = (row, cfg = DEFAULT_TENANT_CONFIG) => {
  const divisor = cfg?.cbmDivisor || DEFAULT_TENANT_CONFIG.cbmDivisor;
  const dp = cfg?.cbmDecimals ?? DEFAULT_TENANT_CONFIG.cbmDecimals;
  return round(cartonVolumeMm3(row) / 1000 / divisor, dp);
};

/** "60 × 40 × 35" for display and for the sticker measurement line. Blank if unset. */
export const dimensionsLabel = (row) => {
  const parts = [row?.lengthCm, row?.breadthCm, row?.heightCm];
  if (parts.some((p) => !num(p))) return '';
  return parts.map((p) => round(p, 1)).join(' × ');
};

export const hasWeights = (row) => num(row?.netWeightKg) > 0 && num(row?.grossWeightKg) > 0;
export const hasDimensions = (row) =>
  num(row?.lengthCm) > 0 && num(row?.breadthCm) > 0 && num(row?.heightCm) > 0;

// ─── Totals ─────────────────────────────────────────────────────────────────────
// Accumulators stay in integer space (milli-kg, mm3) and convert once at the end.

const emptyAccumulator = () => ({
  cartons: 0,
  pieces: 0,
  netMilliKg: 0,
  grossMilliKg: 0,
  volumeMm3: 0,
  sizeQty: {},
});

const addRowToAccumulator = (acc, row) => {
  const count = cartonCount(row);
  acc.cartons += count;
  acc.pieces += piecesPerCarton(row) * count;
  acc.netMilliKg += toMilliKg(row?.netWeightKg) * count;
  acc.grossMilliKg += toMilliKg(row?.grossWeightKg) * count;
  acc.volumeMm3 += cartonVolumeMm3(row) * count;
  Object.entries(totalSizeQty(row)).forEach(([size, q]) => {
    acc.sizeQty[size] = (acc.sizeQty[size] || 0) + q;
  });
  return acc;
};

const finaliseAccumulator = (acc, cfg = DEFAULT_TENANT_CONFIG) => {
  const divisor = cfg?.cbmDivisor || DEFAULT_TENANT_CONFIG.cbmDivisor;
  const wdp = cfg?.weightDecimals ?? DEFAULT_TENANT_CONFIG.weightDecimals;
  const cdp = cfg?.cbmDecimals ?? DEFAULT_TENANT_CONFIG.cbmDecimals;
  return {
    cartons: acc.cartons,
    pieces: acc.pieces,
    netWeightKg: round(fromMilliKg(acc.netMilliKg), wdp),
    grossWeightKg: round(fromMilliKg(acc.grossMilliKg), wdp),
    cbm: round(acc.volumeMm3 / 1000 / divisor, cdp),
    sizeQty: acc.sizeQty,
  };
};

/** Totals for a single row, in the same shape as section and grand totals. */
export const rowTotals = (row, cfg) => finaliseAccumulator(addRowToAccumulator(emptyAccumulator(), row), cfg);

/** Totals across a set of rows (one packing-list section). */
export const sectionTotals = (rows, cfg) =>
  finaliseAccumulator((rows || []).reduce(addRowToAccumulator, emptyAccumulator()), cfg);

/**
 * Grand totals across every section, including EXTRA (PRD §7.4 / §24.4).
 * Sections are re-accumulated from their rows rather than summed from their
 * already-rounded totals, so rounding is applied exactly once.
 */
export const grandTotals = (sections, cfg) => {
  const acc = (sections || []).reduce(
    (a, s) => (s?.rows || []).reduce(addRowToAccumulator, a),
    emptyAccumulator(),
  );
  return finaliseAccumulator(acc, cfg);
};

/**
 * Weight per piece (PRD §7.4). Displayed at 5 decimals for buyers that ask for it
 * — the DM instruction — so the default precision here is deliberately high.
 */
export const weightPerPiece = (totals, cfg = DEFAULT_TENANT_CONFIG) => {
  const dp = cfg?.weightPerPieceDecimals ?? DEFAULT_TENANT_CONFIG.weightPerPieceDecimals;
  const pieces = num(totals?.pieces);
  if (!pieces) return { netPerPiece: 0, grossPerPiece: 0 };
  return {
    netPerPiece: round(num(totals.netWeightKg) / pieces, dp),
    grossPerPiece: round(num(totals.grossWeightKg) / pieces, dp),
  };
};

// ─── Order vs packed (PRD §7.4) ─────────────────────────────────────────────────

/**
 * Compare ordered against packed per style / colour / size.
 *
 * `orderBreakdown` is [{styleNo, colorName, size, orderQty}] built from the order's
 * colour rows in size-preset order. Ordered quantity always comes from the order and
 * never from packed data (PRD §7.4), so a size that was packed but never ordered
 * still appears — with orderQty 0 — rather than being silently dropped.
 *
 * `matchColour` lets the caller pass a Pantone-aware normaliser so
 * "Classic Blue 19-4052" and "19-4052" reconcile (see OrderView's colour key logic).
 */
/**
 * Quantities packed per style / colour / size, keyed for comparison. Deliberately
 * separate from orderVsPacked: cumulative over-packing (V-15) has to total what was
 * packed across a shipment whether or not any order breakdown is available.
 */
export const packedQuantities = (rows, options = {}) => {
  const { matchColour = (c) => String(c ?? '').trim().toLowerCase() } = options;
  const out = {};
  (rows || []).forEach((row) => {
    const count = cartonCount(row);
    if (!count) return;
    const add = (styleNo, colorName, size, qty) => {
      const k = `${String(styleNo ?? '').trim().toLowerCase()}||${matchColour(colorName)}||${String(size ?? '').trim()}`;
      out[k] = (out[k] || 0) + qty;
    };
    if (row.packingType === PACKING_TYPE.MIXED) {
      (row.mixedRows || []).forEach((mr) => {
        Object.entries(mr?.sizeQty || {}).forEach(([size, q]) => {
          if (num(q)) add(row.styleNo, mr.colorName, size, num(q) * count);
        });
      });
      return;
    }
    Object.entries(sizeQtyPerCarton(row)).forEach(([size, q]) => {
      add(row.styleNo, row.colorName, size, q * count);
    });
  });
  return out;
};

export const orderVsPacked = (orderBreakdown, rows, options = {}) => {
  const { tolerancePercent = 0, matchColour = (c) => String(c ?? '').trim().toLowerCase() } = options;

  const key = (styleNo, colour, size) =>
    `${String(styleNo ?? '').trim().toLowerCase()}||${matchColour(colour)}||${String(size ?? '').trim()}`;

  const packed = new Map();
  const addPacked = (styleNo, colorName, size, qty) => {
    const k = key(styleNo, colorName, size);
    const prev = packed.get(k);
    // Keep the labels as they were entered — the key is lowercased for matching,
    // but it must never become what the user sees.
    packed.set(k, {
      styleNo: prev?.styleNo ?? styleNo,
      colorName: prev?.colorName ?? colorName,
      size: prev?.size ?? size,
      qty: (prev?.qty || 0) + qty,
    });
  };

  (rows || []).forEach((row) => {
    const count = cartonCount(row);
    if (!count) return;
    if (row.packingType === PACKING_TYPE.MIXED) {
      (row.mixedRows || []).forEach((mr) => {
        Object.entries(mr?.sizeQty || {}).forEach(([size, q]) => {
          if (!num(q)) return;
          addPacked(row.styleNo, mr.colorName, size, num(q) * count);
        });
      });
      return;
    }
    Object.entries(sizeQtyPerCarton(row)).forEach(([size, q]) => {
      addPacked(row.styleNo, row.colorName, size, q * count);
    });
  });

  // No ordered breakdown means the order could not be read — which is NOT the same
  // as "nothing was ordered". Reporting every packed line as unordered would turn a
  // missing lookup into a page of false variances, so there is simply nothing to
  // compare and the panel says so.
  if (!(orderBreakdown || []).length) return [];

  const out = [];
  const seen = new Set();

  orderBreakdown.forEach((line) => {
    const k = key(line.styleNo, line.colorName, line.size);
    seen.add(k);
    out.push(buildVarianceRow(line, packed.get(k)?.qty || 0, tolerancePercent));
  });

  // Packed combinations genuinely absent from a known order — surfaced, never
  // hidden (V-09), and labelled with the values as entered.
  packed.forEach((entry, k) => {
    if (seen.has(k)) return;
    out.push(
      buildVarianceRow(
        { styleNo: entry.styleNo, colorName: entry.colorName, size: entry.size, orderQty: 0 },
        entry.qty,
        tolerancePercent,
      ),
    );
  });

  return out;
};

const buildVarianceRow = (line, shippedQty, tolerancePercent) => {
  const orderQty = int(line.orderQty);
  const variance = shippedQty - orderQty;
  const variancePercent = orderQty ? round((variance / orderQty) * 100, 2) : 0;
  let status = 'MATCH';
  if (variance < 0) status = 'SHORT';
  else if (variance > 0) status = 'EXCESS';
  const withinTolerance =
    variance === 0 || (orderQty > 0 && Math.abs(variancePercent) <= num(tolerancePercent));
  return {
    styleNo: line.styleNo,
    colorName: line.colorName,
    size: line.size,
    orderQty,
    shippedQty,
    variance,
    variancePercent,
    status,
    withinTolerance,
  };
};

// ─── Carton ranges ──────────────────────────────────────────────────────────────
// Every carton-number question is answered over INTERVALS, never over an expanded
// set. A Set or index map of individual carton numbers would be O(cartons) memory
// and is exactly what unbounded shipments cannot afford.

/** Row ranges as sortable intervals, skipping rows with no usable range. */
export const toRanges = (rows) =>
  (rows || [])
    .map((row) => ({ from: int(row?.cartonFrom), to: int(row?.cartonTo), rowId: row?.id, row }))
    .filter((r) => r.from > 0 && r.to >= r.from)
    .sort((a, b) => a.from - b.from || a.to - b.to);

/** Total cartons covered by a set of intervals (overlaps counted once). */
export const countCartons = (ranges) =>
  mergeRanges(ranges).reduce((s, r) => s + (r.to - r.from + 1), 0);

/** Overlapping interval pairs — V-01 and V-02 both read this. O(n log n). */
export const findRangeOverlaps = (ranges) => {
  const sorted = [...(ranges || [])].sort((a, b) => a.from - b.from || a.to - b.to);
  const hits = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (cur.from <= prev.to) {
      hits.push({ a: prev, b: cur, from: cur.from, to: Math.min(prev.to, cur.to) });
    }
  }
  return hits;
};

/** Missing carton numbers between the lowest and highest, as intervals (V-03). */
export const findRangeGaps = (ranges) => {
  const merged = mergeRanges(ranges);
  const gaps = [];
  for (let i = 1; i < merged.length; i += 1) {
    const prevTo = merged[i - 1].to;
    const curFrom = merged[i].from;
    if (curFrom > prevTo + 1) gaps.push({ from: prevTo + 1, to: curFrom - 1 });
  }
  return gaps;
};

/** Union of overlapping/adjacent intervals. */
export const mergeRanges = (ranges) => {
  const sorted = [...(ranges || [])]
    .filter((r) => Number.isFinite(r?.from) && Number.isFinite(r?.to) && r.to >= r.from)
    .sort((a, b) => a.from - b.from || a.to - b.to);
  const out = [];
  sorted.forEach((r) => {
    const last = out[out.length - 1];
    if (last && r.from <= last.to + 1) last.to = Math.max(last.to, r.to);
    else out.push({ from: r.from, to: r.to });
  });
  return out;
};

/** Intersection of two interval sets — used to derive per-carton print history. */
export const intersectRanges = (a, b) => {
  const left = mergeRanges(a);
  const right = mergeRanges(b);
  const out = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    const from = Math.max(left[i].from, right[j].from);
    const to = Math.min(left[i].to, right[j].to);
    if (from <= to) out.push({ from, to });
    if (left[i].to < right[j].to) i += 1;
    else j += 1;
  }
  return out;
};

export const rangesContain = (ranges, cartonNo) =>
  mergeRanges(ranges).some((r) => cartonNo >= r.from && cartonNo <= r.to);

/** "1–47, 52, 60–63" — compact range text for marks & nos and reprint lists. */
export const formatRanges = (ranges) =>
  mergeRanges(ranges)
    .map((r) => (r.from === r.to ? `${r.from}` : `${r.from}–${r.to}`))
    .join(', ');

// ─── Carton expansion ───────────────────────────────────────────────────────────
// The ONLY place individual cartons are materialised, and only for one scope.

const buildCarton = (row, cartonNo, ordinal, total, cfg) => ({
  cartonNo,
  ordinal,
  total,
  nOfN: `${cartonNo} of ${total}`,
  sourceRowId: row.id,
  sectionKey: row.sectionKey,
  packingType: row.packingType,
  packingCode: row.packingCode ?? null,
  endCustomer: row.endCustomer ?? null,
  danNo: row.danNo ?? null,
  buyerPoNo: row.buyerPoNo ?? null,
  destination: row.destination ?? null,
  styleNo: row.styleNo ?? null,
  colorName: row.colorName ?? null,
  mixedRows: row.mixedRows ?? null,
  sizeQty: sizeQtyPerCarton(row),
  ratio: row.ratio ?? null,
  assortmentsPerCarton: row.assortmentsPerCarton ?? null,
  // The master-polybag structure a Prenatal layout prints, alongside the ratio one.
  pcsPerMpb: row.pcsPerMpb ?? null,
  mpbPerCarton: row.mpbPerCarton ?? null,
  piecesPerAssortment: piecesPerAssortment(row),
  pieces: piecesPerCarton(row),
  netWeightKg: num(row.netWeightKg),
  grossWeightKg: num(row.grossWeightKg),
  lengthCm: num(row.lengthCm),
  breadthCm: num(row.breadthCm),
  heightCm: num(row.heightCm),
  dimensions: dimensionsLabel(row),
  cbm: cbmPerCarton(row, cfg),
  articleNos: row.articleNos ?? null,
  eanBySize: row.eanBySize ?? null,
});

/**
 * Lazily yield every carton in `rows`. A generator so a caller can take the first
 * page of a very large shipment without building the rest.
 *
 * `total` is the shipment-wide carton count when supplied, because the buyer's
 * "n of N" counts the whole shipment and not just this packing list (PRD §9.1).
 */
export function* expandCartons(rows, ctx = {}) {
  const cfg = ctx.cfg || DEFAULT_TENANT_CONFIG;
  const ranges = toRanges(rows);
  const total = ctx.totalCartonsInShipment || countCartons(ranges);
  let ordinal = 0;
  for (const r of ranges) {
    for (let n = r.from; n <= r.to; n += 1) {
      ordinal += 1;
      yield buildCarton(r.row, n, ordinal, total, cfg);
    }
  }
}

/** Materialise only the cartons in [from, to]. Cost is proportional to the slice. */
export const expandCartonRange = (rows, from, to, ctx = {}) => {
  const cfg = ctx.cfg || DEFAULT_TENANT_CONFIG;
  const ranges = toRanges(rows);
  const total = ctx.totalCartonsInShipment || countCartons(ranges);
  const lo = int(from);
  const hi = int(to);
  const out = [];
  let ordinal = 0;
  for (const r of ranges) {
    for (let n = r.from; n <= r.to; n += 1) {
      ordinal += 1;
      if (n >= lo && n <= hi) out.push(buildCarton(r.row, n, ordinal, total, cfg));
    }
    if (r.from > hi) break;
  }
  return out;
};

/** Materialise a specific set of carton numbers (range reprint, PRD §9.3). */
export const expandCartonNos = (rows, cartonNos, ctx = {}) => {
  const wanted = new Set((cartonNos || []).map((n) => int(n)));
  if (!wanted.size) return [];
  const cfg = ctx.cfg || DEFAULT_TENANT_CONFIG;
  const ranges = toRanges(rows);
  const total = ctx.totalCartonsInShipment || countCartons(ranges);
  const out = [];
  let ordinal = 0;
  for (const r of ranges) {
    for (let n = r.from; n <= r.to; n += 1) {
      ordinal += 1;
      if (wanted.has(n)) out.push(buildCarton(r.row, n, ordinal, total, cfg));
    }
  }
  return out;
};

// ─── Hashing ────────────────────────────────────────────────────────────────────

/**
 * Canonical JSON: object keys sorted at every level, so two structurally equal
 * documents always hash the same regardless of key insertion order.
 */
export const canonical = (value) =>
  JSON.stringify(value, (_k, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.keys(v)
          .sort()
          .reduce((o, k) => {
            o[k] = v[k];
            return o;
          }, {})
      : v,
  );

/** FNV-1a, 32-bit. Short, stable, and good enough to detect content drift. */
export const fnv1a = (str) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < String(str).length; i += 1) {
    h ^= String(str).charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
};

/**
 * Content hash of a packing list's rows — the STALENESS token, deliberately
 * separate from `version`. A save that changes nothing leaves this unchanged, so a
 * downstream invoice or sticker run is not falsely invalidated (V-13 / V-14).
 * Derived fields are stripped: they are recomputed, not authored.
 */
export const contentHashOfRows = (rows) =>
  fnv1a(
    canonical(
      (rows || []).map((r) => ({
        cartonFrom: int(r.cartonFrom),
        cartonTo: int(r.cartonTo),
        packingType: r.packingType,
        packingCode: r.packingCode ?? null,
        endCustomer: r.endCustomer ?? null,
        danNo: r.danNo ?? null,
        buyerPoNo: r.buyerPoNo ?? null,
        styleNo: r.styleNo ?? null,
        colorName: r.colorName ?? null,
        sizeQty: r.sizeQty ?? null,
        mixedRows: r.mixedRows ?? null,
        ratio: r.ratio ?? null,
        assortmentsPerCarton: r.assortmentsPerCarton ?? null,
        pcsPerMpb: r.pcsPerMpb ?? null,
        mpbPerCarton: r.mpbPerCarton ?? null,
        netWeightKg: num(r.netWeightKg),
        grossWeightKg: num(r.grossWeightKg),
        lengthCm: num(r.lengthCm),
        breadthCm: num(r.breadthCm),
        heightCm: num(r.heightCm),
      })),
    ),
  );

/**
 * Hash of one carton across ONLY the fields a sticker layout binds.
 *
 * This is what makes the reprint list trustworthy: editing a field the sticker
 * never prints must not demand a reprint (PRD §24.17). `bindings` are the dotted
 * paths from the template's sticker layout, resolved against the expanded carton.
 */
export const cartonHash = (carton, bindings) => {
  const picked = {};
  (bindings || []).forEach((path) => {
    const leaf = String(path).split('.').pop();
    if (leaf in (carton || {})) picked[leaf] = carton[leaf];
  });
  return fnv1a(canonical(picked));
};
