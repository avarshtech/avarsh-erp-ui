/**
 * Carton packing entry — issues and read-only decoration.
 *
 * Pure: no I/O. Shared by the live packing service (production/packingService.js)
 * and the Export Documentation mock, which still binds its own seeded entries, so
 * the two apply one set of rules.
 */
import { PACKING_ENTRY_STATUS, PACKING_TYPE } from './expDocConstants';
import {
  cartonCount, piecesPerCarton, totalPieces, sectionTotals, cbmPerCarton,
  toRanges, findRangeOverlaps, findRangeGaps, countCartons, formatRanges,
  hasWeights, hasDimensions,
} from './expDocCalc';

/**
 * Entry-level issues, computed on read so the register and the form agree.
 * These are the rules that need only the rows themselves — V-02 (range overlap),
 * V-03 (gaps), V-06 (structural nonsense) and V-07 (gross below net), plus an
 * advisory V-08. The document-level catalogue needs packing-list context and
 * lives in expDocValidation.js.
 */
export const entryIssues = (entry) => {
  const issues = [];
  const groups = entry?.groups || [];

  groups.forEach((row) => {
    const label = `Cartons ${row.cartonFrom ?? '?'}-${row.cartonTo ?? '?'}`;

    // V-06 — structural impossibilities.
    if (!row.cartonFrom || !row.cartonTo) {
      issues.push({ code: 'V-06', severity: 'ERROR', rowId: row.id, message: `${label}: carton range is incomplete.` });
    } else if (Number(row.cartonTo) < Number(row.cartonFrom)) {
      issues.push({ code: 'V-06', severity: 'ERROR', rowId: row.id, message: `${label}: the "to" carton is before the "from" carton.` });
    }
    if (cartonCount(row) > 0 && piecesPerCarton(row) <= 0) {
      issues.push({ code: 'V-06', severity: 'ERROR', rowId: row.id, message: `${label}: pieces per carton works out to zero.` });
    }
    if (row.packingType === PACKING_TYPE.RATIO && !Number(row.assortmentsPerCarton)) {
      issues.push({ code: 'V-06', severity: 'ERROR', rowId: row.id, message: `${label}: ratio cartons need assortments per carton.` });
    }
    if (row.packingType === PACKING_TYPE.MPB && !Number(row.mpbPerCarton)) {
      issues.push({ code: 'V-06', severity: 'ERROR', rowId: row.id, message: `${label}: master-polybag cartons need MPB per carton.` });
    }

    // V-07 — gross must cover net.
    if (hasWeights(row) && Number(row.grossWeightKg) < Number(row.netWeightKg)) {
      issues.push({ code: 'V-07', severity: 'WARN', rowId: row.id, message: `${label}: gross weight is below net weight.` });
    }

    // Advisory here; becomes a hard error at sticker generation for layouts that
    // print these fields (V-08).
    if (!hasWeights(row)) {
      issues.push({ code: 'V-08', severity: 'WARN', rowId: row.id, message: `${label}: weights are missing.` });
    }
    if (!hasDimensions(row)) {
      issues.push({ code: 'V-08', severity: 'WARN', rowId: row.id, message: `${label}: dimensions are missing.` });
    }
  });

  // V-02 — overlapping ranges within this entry. Interval comparison, never a Set
  // of carton numbers, so a 900-carton entry costs the same as a 9-carton one.
  const ranges = toRanges(groups);
  findRangeOverlaps(ranges).forEach((hit) => {
    issues.push({
      code: 'V-02',
      severity: 'ERROR',
      rowId: hit.b.rowId,
      relatedRowId: hit.a.rowId,
      message: `Cartons ${formatRanges([{ from: hit.from, to: hit.to }])} appear in more than one row.`,
    });
  });

  // V-03 — gaps are legitimate when cartons are dropped, so warn and list them.
  const gaps = findRangeGaps(ranges);
  if (gaps.length) {
    issues.push({
      code: 'V-03',
      severity: 'WARN',
      rowId: null,
      message: `Missing carton numbers: ${formatRanges(gaps)}.`,
    });
  }

  return issues;
};

/** Derived, read-only decoration — never persisted (BR-06: always recomputed). */
export const decorateEntry = (entry) => {
  const out = { ...entry };
  const groups = out.groups || [];
  const totals = sectionTotals(groups);
  const issues = entryIssues(out);

  out.groups = groups.map((row) => ({
    ...row,
    cartonCount: cartonCount(row),
    piecesPerCarton: piecesPerCarton(row),
    totalPieces: totalPieces(row),
    cbm: cbmPerCarton(row),
  }));
  out.totals = totals;
  out.cartonRangeLabel = formatRanges(toRanges(groups));
  out.distinctCartons = countCartons(toRanges(groups));
  out.issues = issues;
  out.errorCount = issues.filter((i) => i.severity === 'ERROR').length;
  out.warningCount = issues.filter((i) => i.severity === 'WARN').length;
  // Permission-shaped flags the screen reads instead of re-deriving the rules.
  out.editable = out.status === PACKING_ENTRY_STATUS.OPEN;
  out.canComplete =
    out.status === PACKING_ENTRY_STATUS.OPEN && out.errorCount === 0 && groups.length > 0;
  return out;
};
