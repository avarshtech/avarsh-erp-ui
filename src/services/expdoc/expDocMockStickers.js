/**
 * Carton stickers — the module's highest-value automation (PRD §9).
 *
 * Today one workbook per shipment holds hundreds of hand-edited label blocks. Here
 * a sticker run is a projection of packing-list data: nothing is typed per carton,
 * and no field exists on a label that the packing list does not already carry.
 *
 * Print history is stored as RANGES, never one row per carton. A shipment's carton
 * count follows the buyer's order quantity, so a per-carton map would grow without
 * bound and would be the first thing to blow the browser's storage budget. Per-carton
 * history ("who printed carton 57, when, how many times") is derived on read by
 * intersecting ranges — PRD §20 asks for the answer, not for that storage shape.
 */
import { loadDb, saveDb, nextStickerRunNo } from './expDocMockStore';
import {
  delay, clone, fail, pageOf, pushAudit, nowStamp, currentUserName,
} from './expDocMockCommon';
import { decoratePl } from './expDocMockPackingLists';
import { DOC_TYPE, PL_STATUS, PHASE } from '../../utils/expDocConstants';
import {
  expandCartonRange, expandCartonNos, toRanges, countCartons, mergeRanges,
  intersectRanges, formatRanges, cartonHash,
} from '../../utils/expDocCalc';
import { resolveTemplate } from '../../utils/expDocTemplateSchema';
import { validate } from '../../utils/expDocValidation';

const allRows = (pl) => (pl.sections || []).flatMap((s) => s.rows || []);

/** The sticker template for a packing list's buyer — resolved, never chosen. */
export const stickerLayoutFor = (db, pl) => {
  const { template } = resolveTemplate(db.templates, {
    buyerCode: pl.buyerCode,
    subClientCode: pl.subClientCode,
    docType: DOC_TYPE.STICKER,
    onDate: pl.plDate,
  });
  return template || null;
};

/** Total cartons across the whole shipment — what "n of N" counts (PRD §9.1). */
const shipmentCartonTotal = (db, pl) => {
  const ranges = (db.packingLists || [])
    .filter((p) => p.shipmentId === pl.shipmentId
      && [PL_STATUS.DRAFT, PL_STATUS.SUBMITTED, PL_STATUS.APPROVED, PL_STATUS.EXPORTED].includes(p.status))
    .flatMap((p) => toRanges(allRows(p)));
  return countCartons(ranges) || countCartons(toRanges(allRows(pl)));
};

/** Carton numbers a scope selects, without materialising the cartons themselves. */
const scopeRanges = (pl, scope = {}) => {
  const rows = toRanges(allRows(pl));
  if (scope.mode === 'RANGE') {
    return intersectRanges(rows, [{ from: Number(scope.from), to: Number(scope.to) }]);
  }
  if (scope.mode === 'SELECTION') {
    return mergeRanges((scope.cartonNos || []).map((n) => ({ from: Number(n), to: Number(n) })));
  }
  return mergeRanges(rows);
};

const expandScope = (pl, scope, ctx) => {
  if (scope?.mode === 'SELECTION') return expandCartonNos(allRows(pl), scope.cartonNos || [], ctx);
  const ranges = scopeRanges(pl, scope);
  return ranges.flatMap((r) => expandCartonRange(allRows(pl), r.from, r.to, ctx));
};

/**
 * Cartons that cannot be printed because a field the layout prints is empty.
 *
 * V-08 is a warning while drafting and a hard ERROR here: a label with a blank
 * weight is worse than no label. The offending cartons are named, per PRD §9.3.
 */
export const blockedCartons = (cartons, layout) => {
  const required = layout?.stickerLayout?.mandatoryFields || [];
  if (!required.length) return [];
  const out = [];
  cartons.forEach((carton) => {
    const missing = required.filter((path) => {
      const leaf = String(path).split('.').pop();
      const v = carton[leaf];
      return v === null || v === undefined || v === '' || v === 0;
    });
    if (missing.length) out.push({ cartonNo: carton.cartonNo, missing: missing.map((m) => m.split('.').pop()) });
  });
  return out;
};

/** Everything a preview or a generate needs, assembled once. */
/**
 * The hash of everything a layout PRINTS from one row.
 *
 * Built from the row's first carton so the existing `cartonHash` picker can be
 * reused, with the carton's own identity excluded — a carton number never changes,
 * and including it would force a different hash per carton and defeat the point.
 */
const rowPrintHash = (row, bindings, totalCartonsInShipment) => {
  const one = expandCartonRange([row], row.cartonFrom, row.cartonFrom, { totalCartonsInShipment })[0];
  // A row with no expandable carton has nothing printed from it to compare.
  if (!one) return `row:${row.id}`;
  const stable = (bindings || []).filter((b) => !['carton.cartonNo', 'carton.ordinal', 'carton.total'].includes(b));
  return cartonHash(one, stable);
};

/**
 * Every sticker run raised against this document NUMBER, not just this row.
 *
 * A revision (§17) is a new row carrying the same plNo, and it inherits the rows —
 * and therefore the row ids — of the version it supersedes. Filtering runs by row id
 * alone lost the print history at the exact moment it matters most: after a revision,
 * V-14 could never fire, so an operator reprinting a corrected shipment had no way to
 * tell which cartons had already been printed.
 */
const runsForDocument = (db, pl) => {
  const chain = new Set(
    (db.packingLists || []).filter((p) => p.plNo === pl.plNo).map((p) => p.id),
  );
  return (db.stickerRuns || []).filter((r) => chain.has(r.plId));
};

export const getStickerContext = async (plId, options = {}) => {
  await delay(80);
  const db = loadDb();
  const raw = db.packingLists.find((p) => p.id === Number(plId));
  if (!raw) fail('NOT_FOUND', `Packing list ${plId} not found`);
  const pl = decoratePl(raw, db);
  const layout = stickerLayoutFor(db, raw);
  const shipment = (db.shipments || []).find((s) => s.id === raw.shipmentId) || null;
  const totalCartonsInShipment = shipmentCartonTotal(db, raw);

  const scope = options.scope || { mode: 'ALL' };
  const ranges = scopeRanges(raw, scope);
  const selectedCount = countCartons(ranges);

  // Only the requested slice is materialised; a preview asks for one page.
  const slice = options.page != null && options.pageSize
    ? expandScope(raw, scope, { totalCartonsInShipment }).slice(
      options.page * options.pageSize, (options.page + 1) * options.pageSize,
    )
    : [];

  const runs = runsForDocument(db, raw);
  const printed = mergeRanges(runs.flatMap((r) => r.prints || []));

  return {
    pl,
    layout: layout ? clone(layout) : null,
    shipment: shipment ? clone(shipment) : null,
    totalCartonsInShipment,
    selectedCount,
    selectedRanges: ranges,
    selectedLabel: formatRanges(ranges),
    cartons: slice,
    printedRanges: printed,
    printedLabel: formatRanges(printed),
    runs: clone(runs),
  };
};

/** Expand a slice of cartons for the preview. Cost is the slice, not the shipment. */
export const previewCartons = async (plId, options = {}) => {
  await delay(60);
  const db = loadDb();
  const raw = db.packingLists.find((p) => p.id === Number(plId));
  if (!raw) fail('NOT_FOUND', `Packing list ${plId} not found`);
  const totalCartonsInShipment = shipmentCartonTotal(db, raw);
  const scope = options.scope || { mode: 'ALL' };
  const size = options.pageSize || 4;
  const page = options.page || 0;

  /*
   * Only the requested page is materialised.
   *
   * Expanding the whole scope and slicing it would rebuild every carton of the
   * shipment on each page turn — the exact O(cartons) cost this module is built to
   * avoid, and it would grow with a carton count that has no ceiling. Instead the
   * ranges are walked to the page's ordinal window and only those numbers expanded.
   */
  if (scope.mode === 'SELECTION') {
    const nos = scope.cartonNos || [];
    return {
      cartons: expandCartonNos(allRows(raw), nos.slice(page * size, (page + 1) * size), { totalCartonsInShipment }),
      total: nos.length,
    };
  }

  const ranges = mergeRanges(scopeRanges(raw, scope));
  const total = countCartons(ranges);
  const startOrdinal = page * size;
  const cartonNos = [];
  let seen = 0;
  for (const r of ranges) {
    const len = r.to - r.from + 1;
    if (seen + len > startOrdinal) {
      const startAt = Math.max(r.from, r.from + (startOrdinal - seen));
      for (let n = startAt; n <= r.to && cartonNos.length < size; n += 1) cartonNos.push(n);
      if (cartonNos.length >= size) break;
    }
    seen += len;
  }
  return {
    cartons: expandCartonNos(allRows(raw), cartonNos, { totalCartonsInShipment }),
    total,
  };
};

/**
 * Pre-flight for a generate: what would block it, and what has already been printed.
 * Returned before the click so the button can explain itself.
 */
export const checkStickerGeneration = async (plId, options = {}) => {
  await delay(80);
  const db = loadDb();
  const raw = db.packingLists.find((p) => p.id === Number(plId));
  if (!raw) fail('NOT_FOUND', `Packing list ${plId} not found`);
  const pl = decoratePl(raw, db);
  const layout = stickerLayoutFor(db, raw);
  const totalCartonsInShipment = shipmentCartonTotal(db, raw);
  const scope = options.scope || { mode: 'ALL' };
  const cartons = expandScope(raw, scope, { totalCartonsInShipment });

  const blocked = blockedCartons(cartons, layout);

  // V-03 gaps and V-08 missing fields, at STICKER severity.
  const findings = validate({
    pl,
    template: pl.template,
    totals: pl.totals,
    tolerancePercent: pl.tolerancePercent,
    orderBreakdown: raw.orderBreakdown || [],
    plsInShipment: (db.packingLists || []).filter((p) => p.shipmentId === raw.shipmentId),
    packedElsewhere: {},
  }, { phase: PHASE.STICKER, acknowledgements: raw.acknowledgements || [] });

  // V-14: cartons already printed whose bound fields have since changed.
  const layoutBindings = (layout?.stickerLayout?.faces || [])
    .flatMap((f) => (f.lines || []).map((l) => l.binding))
    .filter((b) => String(b).startsWith('carton.'));
  /*
   * V-14, compared per ROW and reported as ranges.
   *
   * The printed fields all come from the row, so one hash per row answers the same
   * question as one per carton — and it does so in O(rows) rather than expanding
   * every printed carton of a shipment whose carton count has no ceiling.
   */
  const runs = runsForDocument(db, raw);
  const reprintRanges = [];
  runs.forEach((run) => {
    Object.entries(run.rowHashes || {}).forEach(([rowId, previous]) => {
      const row = allRows(raw).find((r) => String(r.id) === String(rowId));
      if (!row || previous === rowPrintHash(row, layoutBindings, totalCartonsInShipment)) return;
      // Only the cartons of that row that were actually printed need reprinting.
      reprintRanges.push(
        ...intersectRanges([{ from: row.cartonFrom, to: row.cartonTo }], run.prints || []),
      );
    });
  });

  const isDraft = raw.status === PL_STATUS.DRAFT;
  return {
    layout: layout ? clone(layout) : null,
    cartonCount: cartons.length,
    blocked,
    findings: findings.findings,
    errors: findings.errors,
    reprintNeeded: mergeRanges(reprintRanges),
    isDraft,
    // A draft PL can still be printed, but only with the override right, and the
    // output carries a DRAFT watermark (PRD §9.1 / §16).
    requiresOverride: isDraft,
    /*
     * The STICKER-phase validation is consulted, not merely computed.
     *
     * `blockedCartons` reads the layout's own `mandatoryFields` list, which a layout
     * authored in the builder does not have — so on its own it never blocks anything.
     * V-08 at STICKER severity is the rule that actually knows a printed weight is
     * missing, and it was being calculated and then thrown away.
     */
    canGenerate: cartons.length > 0
      && blocked.length === 0
      && findings.errors.length === 0
      && Boolean(layout),
    blockedReason: !layout
      ? 'No sticker layout is configured for this buyer.'
      : (!cartons.length ? 'The selected range contains no cartons.'
        : (blocked.length
          ? `${blocked.length} carton(s) are missing a field this layout prints.`
          : (findings.errors.length ? findings.errors[0].message : null))),
  };
};

/** Record a generated run. The HTML itself is built client-side from this scope. */
export const generateStickerRun = async (plId, options = {}) => {
  await delay();
  const db = loadDb();
  const raw = db.packingLists.find((p) => p.id === Number(plId));
  if (!raw) fail('NOT_FOUND', `Packing list ${plId} not found`);
  const layout = stickerLayoutFor(db, raw);
  if (!layout) fail('CONFLICT', 'No sticker layout is configured for this buyer.');

  const totalCartonsInShipment = shipmentCartonTotal(db, raw);
  const scope = options.scope || { mode: 'ALL' };
  const cartons = expandScope(raw, scope, { totalCartonsInShipment });
  if (!cartons.length) fail('CONFLICT', 'The selected range contains no cartons.');

  const blocked = blockedCartons(cartons, layout);
  if (blocked.length) {
    fail('CONFLICT', `Cannot generate — ${blocked.length} carton(s) are missing a printed field: ${
      blocked.slice(0, 8).map((b) => `${b.cartonNo} (${b.missing.join(', ')})`).join('; ')}${
      blocked.length > 8 ? ' …' : ''}`);
  }
  if (raw.status === PL_STATUS.DRAFT && !options.overrideReason) {
    fail('CONFLICT', 'This packing list is still a draft. Printing from a draft needs the override right and a reason.');
  }

  const layoutBindings = (layout.stickerLayout?.faces || [])
    .flatMap((f) => (f.lines || []).map((l) => l.binding))
    .filter((b) => String(b).startsWith('carton.'));
  // One entry per ROW. A per-carton map is O(cartons) in localStorage — the exact
  // storage shape this module refuses everywhere else, and enough to blow the
  // ~5 MB quota on a large shipment, taking the whole mock store with it.
  const rowHashes = {};
  // A built carton exposes `sourceRowId`, not the row object.
  [...new Set(cartons.map((c) => c.sourceRowId).filter((id) => id !== undefined))].forEach((rowId) => {
    const row = allRows(raw).find((r) => r.id === rowId);
    if (row) rowHashes[rowId] = rowPrintHash(row, layoutBindings, totalCartonsInShipment);
  });

  const id = Math.max(0, ...(db.stickerRuns || []).map((r) => r.id)) + 1;
  const run = {
    id,
    runNo: nextStickerRunNo(db),
    plId: raw.id,
    plNo: raw.plNo,
    plVersion: raw.version,
    plContentHash: raw.contentHash,
    templateId: layout.id,
    templateVersion: layout.version,
    layoutId: layout.stickerLayout?.layoutId,
    paper: options.paper || layout.stickerLayout?.paperDefault,
    faceKeys: options.faceKeys || (layout.stickerLayout?.faces || []).map((f) => f.key),
    scope: clone(scope),
    cartonCount: cartons.length,
    labelCount: cartons.length * ((options.faceKeys || layout.stickerLayout?.faces || []).length || 1),
    fromDraft: raw.status === PL_STATUS.DRAFT,
    overrideReason: options.overrideReason || null,
    isReprint: Boolean(options.isReprint),
    reprintReason: options.reprintReason || null,
    // Ranges, not one row per carton.
    prints: mergeRanges(cartons.map((c) => ({ from: c.cartonNo, to: c.cartonNo }))).map((r) => ({
      ...r, at: nowStamp(), by: currentUserName(),
    })),
    rowHashes,
    generatedAt: nowStamp(),
    generatedBy: currentUserName(),
  };

  db.stickerRuns = db.stickerRuns || [];
  db.stickerRuns.push(run);
  pushAudit(db, {
    entityType: 'STICKER_RUN',
    entityId: id,
    entityNo: run.runNo,
    action: options.isReprint ? 'Stickers reprinted' : 'Stickers generated',
    details: `${raw.plNo} · cartons ${formatRanges(run.prints)} · ${run.labelCount} label(s) · ${run.paper}`,
    reason: options.reprintReason || options.overrideReason || null,
  });
  saveDb(db);
  return clone(run);
};

export const searchStickerRuns = async (params = {}) => {
  await delay();
  const db = loadDb();
  const rows = (db.stickerRuns || [])
    .filter((r) => (!params.plId || r.plId === Number(params.plId)))
    .map((r) => ({ ...clone(r), cartonLabel: formatRanges(r.prints || []) }))
    .sort((a, b) => b.id - a.id);
  return pageOf(rows, params);
};

/**
 * Per-carton print history (PRD §20), derived by intersecting the stored ranges —
 * the answer the audit needs, without the storage shape that would not scale.
 */
export const cartonPrintHistory = async (plId, cartonNo) => {
  await delay(60);
  const db = loadDb();
  const n = Number(cartonNo);
  const events = [];
  (db.stickerRuns || [])
    .filter((r) => r.plId === Number(plId))
    .forEach((run) => {
      (run.prints || []).forEach((pr) => {
        if (n < pr.from || n > pr.to) return;
        events.push({
          runNo: run.runNo,
          at: pr.at,
          by: pr.by,
          plVersion: run.plVersion,
          templateVersion: run.templateVersion,
          paper: run.paper,
          isReprint: run.isReprint,
          reason: run.reprintReason || run.overrideReason || null,
        });
      });
    });
  return { cartonNo: n, timesPrinted: events.length, events };
};
