/**
 * Carton Packing Entry — the producer of the PRD §7.3 carton dataset.
 *
 * The PRD puts carton capture in a separate Packing-module PRD, but nothing in
 * this module can be demonstrated without it, so a thin entry lives here behind
 * its own route and RBAC key. Keep it thin: no shop-floor helpers, no scan-to-pack.
 *
 * Rows are RANGES (cartonFrom..cartonTo). One row can stand for 300 cartons, which
 * is what keeps an unbounded carton count cheap in both store and memory.
 */
import { loadDb, saveDb, nextPackingNo } from './expDocMockStore';
import {
  delay, clone, fail, failConflict, pageOf, matchesText, pushAudit, nowStamp, currentUserName,
} from './expDocMockCommon';
import { PACKING_ENTRY_STATUS, PACKING_TYPE } from '../../utils/expDocConstants';
import {
  cartonCount, piecesPerCarton, totalPieces, sectionTotals, cbmPerCarton,
  toRanges, findRangeOverlaps, findRangeGaps, countCartons, formatRanges,
  hasWeights, hasDimensions,
} from '../../utils/expDocCalc';

const find = (db, id) => db.packingEntries.find((e) => e.id === Number(id));

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
  const out = clone(entry);
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

export const searchPackingEntries = async (params = {}) => {
  await delay();
  const db = loadDb();
  const rows = db.packingEntries
    .filter((e) => {
      if (params.status && e.status !== params.status) return false;
      if (params.shipmentId && e.shipmentId !== Number(params.shipmentId)) return false;
      if (params.buyerCode && e.buyerCode !== params.buyerCode) return false;
      if (params.search) {
        const hit = matchesText(e.packingNo, params.search)
          || matchesText(e.orderNo, params.search)
          || matchesText(e.styleNo, params.search)
          || matchesText(e.buyerName, params.search);
        if (!hit) return false;
      }
      return true;
    })
    .map(decorateEntry)
    .sort((a, b) => b.id - a.id);
  return pageOf(rows, params);
};

export const getPackingEntry = async (id) => {
  await delay(80);
  const e = find(loadDb(), id);
  if (!e) fail('NOT_FOUND', `Packing entry ${id} not found`);
  return decorateEntry(e);
};

/** Entries a packing list may bind for a shipment (PRD §7.1). */
export const listBindablePackingEntries = async (shipmentId) => {
  await delay(80);
  const db = loadDb();
  return db.packingEntries
    .filter((e) => !shipmentId || e.shipmentId === Number(shipmentId))
    .map((e) => {
      const dec = decorateEntry(e);
      return {
        id: e.id,
        packingNo: e.packingNo,
        orderNo: e.orderNo,
        styleNo: e.styleNo,
        status: e.status,
        cartons: dec.totals.cartons,
        pieces: dec.totals.pieces,
        errorCount: dec.errorCount,
        // An incomplete entry CAN be bound, with a warning (PRD §7.1); only a
        // structural error blocks it.
        bindable: dec.errorCount === 0,
        bindWarning:
          e.status !== PACKING_ENTRY_STATUS.COMPLETED
            ? 'Packing entry is not marked complete.'
            : null,
        blockedReason:
          dec.errorCount > 0
            ? `${dec.errorCount} structural error(s) must be fixed first.`
            : null,
      };
    });
};

/** Derived fields are recomputed on read, so they must never be written back. */
const stripDerived = (row) => {
  const { cartonCount: _c, piecesPerCarton: _p, totalPieces: _t, cbm: _cbm, ...rest } = row || {};
  return rest;
};

export const createPackingEntry = async (payload) => {
  await delay();
  const db = loadDb();
  const id = Math.max(0, ...db.packingEntries.map((e) => e.id)) + 1;
  const record = {
    id,
    packingNo: nextPackingNo(db),
    status: PACKING_ENTRY_STATUS.OPEN,
    groups: [],
    ...clone(payload),
    version: 0,
    lastUpdated: nowStamp(),
    updatedBy: currentUserName(),
    createdAt: nowStamp(),
    createdBy: currentUserName(),
  };
  record.groups = (record.groups || []).map(stripDerived);
  db.packingEntries.push(record);
  pushAudit(db, {
    entityType: 'PACKING_ENTRY',
    entityId: id,
    entityNo: record.packingNo,
    action: 'Packing entry created',
    details: `${record.groups.length} carton group(s)`,
  });
  saveDb(db);
  return decorateEntry(record);
};

export const updatePackingEntry = async (id, payload) => {
  await delay();
  const db = loadDb();
  const e = find(db, id);
  if (!e) fail('NOT_FOUND', `Packing entry ${id} not found`);
  if (e.status !== PACKING_ENTRY_STATUS.OPEN) {
    fail('CONFLICT', `${e.packingNo} is completed. Reopen it before editing.`);
  }
  // Optimistic locking in the shape axiosInstance already routes to ConflictDialog.
  if (payload.version != null && Number(payload.version) !== Number(e.version)) {
    failConflict(e.packingNo, payload.version, e.version);
  }
  const before = clone(e);
  const { version: _v, id: _id, packingNo: _no, status: _st, ...rest } = payload;
  const next = clone(rest);
  if (next.groups) next.groups = next.groups.map(stripDerived);
  Object.assign(e, next, {
    version: (e.version || 0) + 1,
    lastUpdated: nowStamp(),
    updatedBy: currentUserName(),
  });
  pushAudit(db, {
    entityType: 'PACKING_ENTRY',
    entityId: e.id,
    entityNo: e.packingNo,
    action: 'Packing entry updated',
    before,
    after: clone(e),
  });
  saveDb(db);
  return decorateEntry(e);
};

export const setPackingEntryStatus = async (id, status, reason) => {
  await delay();
  const db = loadDb();
  const e = find(db, id);
  if (!e) fail('NOT_FOUND', `Packing entry ${id} not found`);

  if (status === PACKING_ENTRY_STATUS.COMPLETED) {
    const dec = decorateEntry(e);
    if (!dec.groups.length) fail('CONFLICT', 'Add at least one carton group before completing.');
    if (dec.errorCount > 0) {
      fail('CONFLICT', `${dec.errorCount} structural error(s) must be fixed before completing.`);
    }
  } else if (status === PACKING_ENTRY_STATUS.OPEN) {
    // Reopening after documents were built from it is precisely what makes them
    // stale, so record it even though the documents detect it themselves.
    const bound = (db.packingLists || []).filter((p) =>
      (p.sourceRefs || []).some((r) => r.packingEntryId === e.id));
    if (bound.length) {
      pushAudit(db, {
        entityType: 'PACKING_ENTRY',
        entityId: e.id,
        entityNo: e.packingNo,
        action: 'Reopened while bound to a packing list',
        details: bound.map((p) => p.plNo).join(', '),
      });
    }
  }

  e.status = status;
  e.version = (e.version || 0) + 1;
  e.lastUpdated = nowStamp();
  e.updatedBy = currentUserName();
  pushAudit(db, {
    entityType: 'PACKING_ENTRY',
    entityId: e.id,
    entityNo: e.packingNo,
    action: `Marked ${status === PACKING_ENTRY_STATUS.COMPLETED ? 'complete' : 'open'}`,
    reason: reason || null,
  });
  saveDb(db);
  return decorateEntry(e);
};

export const deletePackingEntry = async (id) => {
  await delay();
  const db = loadDb();
  const e = find(db, id);
  if (!e) fail('NOT_FOUND', `Packing entry ${id} not found`);
  const bound = (db.packingLists || []).filter((p) =>
    (p.sourceRefs || []).some((r) => r.packingEntryId === e.id));
  if (bound.length) {
    fail(
      'CONFLICT',
      `${e.packingNo} is bound to ${bound.map((p) => p.plNo).join(', ')} and cannot be deleted.`,
    );
  }
  db.packingEntries = db.packingEntries.filter((x) => x.id !== e.id);
  pushAudit(db, {
    entityType: 'PACKING_ENTRY',
    entityId: e.id,
    entityNo: e.packingNo,
    action: 'Packing entry deleted',
  });
  saveDb(db);
  return { success: true };
};
