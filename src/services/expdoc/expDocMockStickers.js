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
 *
 * The template a run prints with lives in the API. expDocService resolves it and hands
 * its layout in (`options.layout`, the choices as `options.layoutOptions`), so this
 * mock never calls the API; a run records the revision it printed with, not a copy.
 */
import { loadDb, saveDb, nextStickerRunNo } from './expDocMockStore';
import {
  delay, clone, fail, pageOf, pushAudit, nowStamp, currentUserName,
} from './expDocMockCommon';
import { decoratePl } from './expDocMockPackingLists';
import { PL_STATUS, PHASE, STICKER_LINE_KIND } from '../../utils/expDocConstants';
import {
  expandCartonRange, expandCartonNos, toRanges, countCartons, mergeRanges,
  intersectRanges, formatRanges, cartonHash, readPath,
} from '../../utils/expDocCalc';
import { validate } from '../../utils/expDocValidation';

const allRows = (pl) => (pl.sections || []).flatMap((s) => s.rows || []);

/** Total cartons across the whole shipment — what "n of N" counts (PRD §9.1). */
const shipmentCartonTotal = (db, pl) => {
  const ranges = (db.packingLists || [])
    .filter((p) => p.shipmentId === pl.shipmentId
      && [PL_STATUS.DRAFT, PL_STATUS.FINAL, PL_STATUS.EXPORTED].includes(p.status))
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

const isBlank = (v) => v === null || v === undefined || v === '' || v === 0 || (Array.isArray(v) && !v.length);

/** Whether a layout prints the per-size EANs as barcodes. */
const printsEans = (layout) => (layout?.stickerLayout?.faces || []).some((f) => (f.lines || [])
  .some((l) => l.kind === STICKER_LINE_KIND.BARCODE && l.binding === 'carton.eanBySize'));

/**
 * Cartons that cannot be printed because a field the layout prints is empty.
 *
 * V-08 is a warning while drafting and a hard ERROR here: a label with a blank
 * weight is worse than no label. The offending cartons are named, per PRD §9.3.
 * A mandatory binding is read by its full path from the carton's print context
 * (`contextOf`), so `style.compositionText` is the style's, not a missing carton
 * field. With barcodes switched on, a carton holding a size with no EAN is blocked.
 */
export const blockedCartons = (cartons, layout, { contextOf = (carton) => ({ carton }), printBarcodes = false } = {}) => {
  const required = layout?.stickerLayout?.mandatoryFields || [];
  const needsEans = Boolean(printBarcodes) && printsEans(layout);
  if (!required.length && !needsEans) return [];
  const out = [];
  cartons.forEach((carton) => {
    const ctx = contextOf(carton);
    const missing = required.filter((path) => isBlank(readPath(ctx, path))).map((m) => String(m).split('.').pop());
    if (needsEans && (carton.sizes || []).some((size) => !carton.eanBySize?.[size])) missing.push('EAN');
    if (missing.length) out.push({ cartonNo: carton.cartonNo, missing });
  });
  return out;
};

/**
 * The hash of everything a layout PRINTS from one row.
 *
 * Built from the row's first carton so the existing `cartonHash` picker can be
 * reused, with the carton's own identity excluded — a carton number never changes,
 * and including it would force a different hash per carton and defeat the point.
 * The paths are read from that carton's print context, as they print (`printScope`).
 */
const rowPrintHash = (row, bindings, totalCartonsInShipment, print) => {
  const one = withSeason(
    expandCartonRange([row], row.cartonFrom, row.cartonFrom, { totalCartonsInShipment }), print.styles,
  )[0];
  // A row with no expandable carton has nothing printed from it to compare.
  if (!one) return `row:${row.id}`;
  const stable = (bindings || []).filter((b) => !['carton.cartonNo', 'carton.ordinal', 'carton.total'].includes(b));
  return cartonHash(one, stable, print.contextOf(one));
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

/**
 * What expDocService needs to choose this packing list's sticker template from the
 * API: the buyer, and the template family (code) its latest run printed with — a
 * reprint keeps its layout. The code, not the id: a new version issues a new id.
 */
export const stickerTemplateRequest = (plId) => {
  const db = loadDb();
  const raw = db.packingLists.find((p) => p.id === Number(plId));
  if (!raw) fail('NOT_FOUND', `Packing list ${plId} not found`);
  const latestRun = [...runsForDocument(db, raw)].sort((a, b) => b.id - a.id)[0];
  return { buyerName: raw.buyerName, latestTemplateCode: latestRun?.templateCode ?? null };
};

/** Why a run has no layout: several to choose from, or none could be loaded at all. */
const noLayoutReason = (layoutOptions) => ((layoutOptions || []).length > 1
  ? 'Pick the sticker layout to print with.'
  : 'No sticker layout could be loaded for this buyer.');

/** The style a sticker prints for one packing entry (`style.*`), and its cartons' season. */
export const entryStyle = (entry) => ({
  styleNo: entry?.styleNo ?? null,
  garmentName: entry?.garmentName ?? null,
  compositionText: entry?.compositionText ?? null,
  season: entry?.season ?? null,
});

/** `entryStyle` per source packing entry of this packing list's rows. */
const styleByEntryOf = (db, pl) => {
  const ids = new Set(allRows(pl).map((r) => r.sourceEntryId));
  return Object.fromEntries((db.packingEntries || [])
    .filter((e) => ids.has(e.id))
    .map((e) => [e.id, entryStyle(e)]));
};

/** Cartons as they print: each with the season of its own packing entry. */
const withSeason = (cartons, styles) =>
  cartons.map((c) => ({ ...c, season: styles[c.sourceEntryId]?.season ?? null }));

/**
 * What a packing list's sticker bindings resolve against, by their full path: the
 * carton, its own entry's style, the packing list, the shipment, the buyer and the
 * exporter — the namespaces the workspace prints with. The exporter is the mock's
 * profile; the organisation master's own fields (name, country) are the screens' to read.
 */
const printScope = (db, raw, pl) => {
  const styles = styleByEntryOf(db, raw);
  const base = {
    pl,
    shipment: (db.shipments || []).find((s) => s.id === raw.shipmentId) || {},
    buyer: { name: raw.buyerName },
    exporter: db.masters?.exporterProfileExtra || {},
  };
  return { styles, contextOf: (carton) => ({ ...base, carton, style: styles[carton.sourceEntryId] || {} }) };
};

/**
 * The data a layout prints, for V-14 — not fixed text, not a per-run answer. A carton
 * number printed "{n} OF {N}" also prints the shipment's total, so it is compared as
 * `carton.nOfN`, exactly as the n-of-N binding it replaces was.
 */
const printedPaths = (layout) => [...new Set((layout?.stickerLayout?.faces || [])
  .flatMap((f) => f.lines || [])
  .map((l) => (l.binding === 'carton.cartonNo' && String(l.pattern || '').includes('{N}') ? 'carton.nOfN' : l.binding))
  .filter((b) => b && !/^(fixed|ask):/.test(String(b))))];

/** Everything a preview or a generate needs, assembled once. */
export const getStickerContext = async (plId, options = {}) => {
  await delay(80);
  const db = loadDb();
  const raw = db.packingLists.find((p) => p.id === Number(plId));
  if (!raw) fail('NOT_FOUND', `Packing list ${plId} not found`);
  const pl = decoratePl(raw, db);
  const layout = options.layout || null;
  const shipment = (db.shipments || []).find((s) => s.id === raw.shipmentId) || null;
  const totalCartonsInShipment = shipmentCartonTotal(db, raw);
  const styleByEntry = styleByEntryOf(db, raw);

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
    layoutOptions: clone(options.layoutOptions || []),
    // `style.*` per packing entry; a carton prints its own entry's (`carton.sourceEntryId`).
    styleByEntry,
    shipment: shipment ? clone(shipment) : null,
    totalCartonsInShipment,
    selectedCount,
    selectedRanges: ranges,
    selectedLabel: formatRanges(ranges),
    cartons: withSeason(slice, styleByEntry),
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
  const styles = styleByEntryOf(db, raw);
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
      cartons: withSeason(
        expandCartonNos(allRows(raw), nos.slice(page * size, (page + 1) * size), { totalCartonsInShipment }), styles,
      ),
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
    cartons: withSeason(expandCartonNos(allRows(raw), cartonNos, { totalCartonsInShipment }), styles),
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
  const layout = options.layout || null;
  const totalCartonsInShipment = shipmentCartonTotal(db, raw);
  const scope = options.scope || { mode: 'ALL' };
  const print = printScope(db, raw, pl);
  const cartons = withSeason(expandScope(raw, scope, { totalCartonsInShipment }), print.styles);

  const blocked = blockedCartons(cartons, layout, { contextOf: print.contextOf, printBarcodes: options.printBarcodes });

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
  const layoutBindings = printedPaths(layout);
  /*
   * V-14, compared per ROW and reported as ranges.
   *
   * The printed fields all come from the row, so one hash per row answers the same
   * question as one per carton — and it does so in O(rows) rather than expanding
   * every printed carton of a shipment whose carton count has no ceiling.
   *
   * Only runs of the layout family (template code) being printed now are compared: a
   * run printed with another of the buyer's layouts hashed other fields, and comparing
   * across them would call every carton "changed".
   */
  const runs = layout
    ? runsForDocument(db, raw).filter((run) => run.templateCode === layout.templateCode)
    : [];
  const reprintRanges = [];
  runs.forEach((run) => {
    Object.entries(run.rowHashes || {}).forEach(([rowId, previous]) => {
      const row = allRows(raw).find((r) => String(r.id) === String(rowId));
      if (!row || previous === rowPrintHash(row, layoutBindings, totalCartonsInShipment, print)) return;
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
      ? noLayoutReason(options.layoutOptions)
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
  const layout = options.layout || null;
  if (!layout) fail('CONFLICT', noLayoutReason(options.layoutOptions));

  const totalCartonsInShipment = shipmentCartonTotal(db, raw);
  const scope = options.scope || { mode: 'ALL' };
  const print = printScope(db, raw, decoratePl(raw, db));
  const cartons = withSeason(expandScope(raw, scope, { totalCartonsInShipment }), print.styles);
  if (!cartons.length) fail('CONFLICT', 'The selected range contains no cartons.');

  const blocked = blockedCartons(cartons, layout, { contextOf: print.contextOf, printBarcodes: options.printBarcodes });
  if (blocked.length) {
    fail('CONFLICT', `Cannot generate — ${blocked.length} carton(s) are missing a printed field: ${
      blocked.slice(0, 8).map((b) => `${b.cartonNo} (${b.missing.join(', ')})`).join('; ')}${
      blocked.length > 8 ? ' …' : ''}`);
  }
  if (raw.status === PL_STATUS.DRAFT && !options.overrideReason) {
    fail('CONFLICT', 'This packing list is still a draft. Printing from a draft needs the override right and a reason.');
  }

  const layoutBindings = printedPaths(layout);
  // One entry per ROW. A per-carton map is O(cartons) in localStorage — the exact
  // storage shape this module refuses everywhere else, and enough to blow the
  // ~5 MB quota on a large shipment, taking the whole mock store with it.
  const rowHashes = {};
  // A built carton exposes `sourceRowId`, not the row object.
  [...new Set(cartons.map((c) => c.sourceRowId).filter((id) => id !== undefined))].forEach((rowId) => {
    const row = allRows(raw).find((r) => r.id === rowId);
    if (row) rowHashes[rowId] = rowPrintHash(row, layoutBindings, totalCartonsInShipment, print);
  });

  const id = Math.max(0, ...(db.stickerRuns || []).map((r) => r.id)) + 1;
  const run = {
    id,
    runNo: nextStickerRunNo(db),
    plId: raw.id,
    plNo: raw.plNo,
    plVersion: raw.version,
    plContentHash: raw.contentHash,
    // The revision printed with, by id and family — never a copy of its layout (the
    // quota above): a published revision does not change, so its id is its layout.
    templateId: layout.id,
    templateCode: layout.templateCode,
    templateVersion: layout.version,
    paper: options.paper || layout.stickerLayout?.paperDefault,
    faceKeys: options.faceKeys || (layout.stickerLayout?.faces || []).map((f) => f.key),
    // The template's once-per-run questions (`ask:` lines), as answered for this run.
    askValues: clone(options.askValues || {}),
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
