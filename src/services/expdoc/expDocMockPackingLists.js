/**
 * Packing Lists — the module's central document.
 *
 * A packing list BINDS carton data; it never hosts carton editing (PRD §7). Rows are
 * snapshot copies of the packing entry's groups, tagged with where they came from,
 * so the document is stable while the entry keeps moving underneath it.
 *
 * Two tokens, deliberately separate:
 *   version      — optimistic lock and audit sequence, bumped on every mutation.
 *   contentHash  — the staleness signal. A save that changes nothing leaves it
 *                  alone, so a downstream invoice or sticker run is not falsely
 *                  invalidated. This is what keeps V-13/V-14 usable rather than noisy.
 */
import { loadDb, saveDb, nextPackingListNo } from './expDocMockStore';
import {
  delay, clone, fail, failConflict, pageOf, matchesText, pushAudit, nowStamp,
  todayStr, currentUserName, colourKey, fieldDiff, describeChanges,
} from './expDocMockCommon';
import { getBuyerCommercial } from './expDocMockMasters';
import { decorate as decorateShipment } from './expDocMockShipments';
import {
  assemble, blocksOf, breakdownFor, groupsByOrder,
} from './expDocPlAssemble';
import {
  takenBy, unitKeyOf, unitsOffered, unitsOfEntry, soloKeyOf,
} from './expDocPlBlocks';
import { readCoversBranch, packingReadOf, PACKING_READ } from './expDocPackingMirror';
import { applyPlan, markNotShipping } from './expDocPlPlan';
import { subtractRanges } from '../../utils/expDocPlanMatch';
import { raise, EXPDOC_NOTIFICATION as NOTIF } from './expDocMockNotifications';
import {
  PL_STATUS, PL_TRANSITIONS, SECTION_KEY, SECTION_TITLES, PHASE, DOC_TYPE,
} from '../../utils/expDocConstants';
import {
  sectionTotals, grandTotals, weightPerPiece, orderVsPacked, contentHashOfRows,
  formatRanges, packedQuantities,
} from '../../utils/expDocCalc';
import { validate, buildAcknowledgement, acknowledgementApplies } from '../../utils/expDocValidation';
import {
  NUMBERING, DEFAULT_NUMBERING, rangeLabelOf, distinctCartonsOf,
} from '../../utils/expDocPlNumbering';
import { systemTemplateFor } from '../../utils/expDocSystemTemplates';

const find = (db, id) => db.packingLists.find((p) => p.id === Number(id));
const allRows = (pl) => (pl.sections || []).flatMap((s) => s.rows || []);

const LIVE_STATUSES = [PL_STATUS.DRAFT, PL_STATUS.FINAL, PL_STATUS.EXPORTED];

// ─── Assembly ───────────────────────────────────────────────────────────────────
// Rows, printed numbers and the ordered breakdown come from expDocPlAssemble: a list is
// built from the entry x PO units it binds, numbered by the buyer's rule.

const shipmentOf = (db, pl) => (db.shipments || []).find((sh) => sh.id === pl.shipmentId) || null;

/** The unit a source ref names, as one key. */
const refKey = (r) => unitKeyOf(r.packingEntryId, r.poKey);

/** Rebuild from the bound units and record the ordered quantities of the shipment's POs. */
const reassemble = (pl, db) => {
  const shipment = shipmentOf(db, pl);
  assemble(pl, db, shipment);
  const breakdown = breakdownFor(pl, shipment);
  if (breakdown.length) pl.orderBreakdown = breakdown;
  return pl;
};

/** A bound unit as the list records it, with the entry version it was taken at. */
const sourceRefOf = (entry, key) => ({
  packingEntryId: entry.id,
  packingNo: entry.packingNo,
  packingEntryVersion: entry.version,
  orderId: entry.orderId,
  poKey: key ?? null,
  packingDate: entry.packingDate ?? null,
  branchId: entry.branchId ?? null,
});

// ─── Decoration ─────────────────────────────────────────────────────────────────

/** Quantities packed for the same style/colour/size on OTHER lists of this shipment. */
const packedElsewhere = (db, pl) => {
  const out = {};
  (db.packingLists || [])
    .filter((other) => other.shipmentId === pl.shipmentId
      && other.id !== pl.id
      && LIVE_STATUSES.includes(other.status))
    .forEach((other) => {
      Object.entries(packedQuantities(allRows(other), { matchColour: colourKey }))
        .forEach(([key, qty]) => { out[key] = (out[key] || 0) + qty; });
    });
  return out;
};

/**
 * The layout a packing list renders with: the snapshot of the template revision it
 * was made with (templates live in the API and are frozen once published, so the
 * snapshot IS that revision), else the built-in standard layout.
 */
const templateFor = (pl) => pl.templateSnapshot || systemTemplateFor(DOC_TYPE.PACKING_LIST);

/**
 * Staleness against the bound packing entries. Compares the stored entry VERSION,
 * and reports which entries moved so the banner can name them.
 */
const stalenessOf = (db, pl) => {
  const drifted = (pl.sourceRefs || [])
    .map((ref) => {
      const entry = (db.packingEntries || []).find((e) => e.id === ref.packingEntryId);
      // Gone only when a read that covered its branch did not return it; unread is not gone
      if (!entry) return readCoversBranch(ref.orderId, ref.branchId) ? { ...ref, missing: true } : null;
      if (Number(entry.version) !== Number(ref.packingEntryVersion)) {
        return { ...ref, from: ref.packingEntryVersion, to: entry.version };
      }
      return null;
    })
    .filter(Boolean);
  return { isStale: drifted.length > 0, drifted };
};

/**
 * The header fields a document owns (§12.1).
 *
 * Everything else on a packing list is either carton data (owned by the entry) or
 * shipment data (owned by the shipment). These are the document's own; the
 * container no. is an OVERRIDE of the shipment's — null means "take the shipment's".
 */
export const PL_EDITABLE_FIELDS = [
  'plDate', 'descriptionOfGoods', 'marksAndNos', 'containerNo', 'sealNo', 'remarks',
  // How the cartons are numbered (owner, 2026-10-09): the rule, and where a continuing series starts
  'numbering', 'firstCartonNo',
];

/** The fields that renumber the cartons when they change. */
const NUMBERING_FIELDS = ['numbering', 'firstCartonNo'];

/** Resolve a document field to its own value, else the shipment's. */
const inherited = (own, from) => (own === null || own === undefined || own === '' ? from ?? null : own);

export const decoratePl = (pl, db, options = {}) => {
  const out = clone(pl);
  const rows = allRows(out);
  const template = templateFor(out);
  const tolerancePercent = out.tolerancePercent
    ?? getBuyerCommercial({ buyerCode: out.buyerCode, buyerName: out.buyerName }).tolerancePercent
    ?? 0;

  out.sections = (out.sections || []).map((s) => ({ ...s, totals: sectionTotals(s.rows) }));
  out.totals = grandTotals(out.sections);
  out.weightPerPiece = weightPerPiece(out.totals);
  out.numbering = out.numbering || DEFAULT_NUMBERING;
  out.cartonRangeLabel = rangeLabelOf(rows, out.numbering);
  out.distinctCartons = distinctCartonsOf(rows);
  out.template = template ? clone(template) : null;
  out.tolerancePercent = tolerancePercent;

  // §12.1 header overrides resolved once, here, so the screen and the printed
  // document can never disagree about which value won.
  // Decorated, as the print receives it: V-12 below must see the same fields the
  // renderer binds (shipment.orderNos exists only on the decorated shipment).
  const shipmentRow = (db.shipments || []).find((sh) => sh.id === out.shipmentId) || null;
  const shipment = shipmentRow ? decorateShipment(shipmentRow, db) : null;
  out.resolved = {
    // The consignee is the shipment's buyer — a document has no consignee of its own.
    consignee: shipment?.consignee ?? null,
    containerNo: inherited(out.containerNo, (shipment?.containerNos || []).join(', ') || null),
    sealNo: out.sealNo || null,
  };
  // Whether the document overrode the container — the §11.3 "modified" marker needs to know.
  out.overridden = {
    containerNo: Boolean(out.containerNo),
  };
  // §17: every revision of this number, so the history panel can offer a comparison
  // between any two — not only between consecutive ones.
  out.revisions = revisionChain(db, out);
  // §11.1 blocks: per order and PO, its cartons and (on a draft) what Carton Packing offers
  out.blocks = blocksOf(out, db, shipmentRow);
  // Renumbering a list already printed from asks first (its cartons then need reprinting)
  out.stickerRunCount = (db.stickerRuns || []).filter((r) => r.plId === out.id).length;
  out.packingUnreadable = out.blocks.some((b) => b.unreadable);

  const staleness = stalenessOf(db, out);
  out.isStale = staleness.isStale;
  out.staleSources = staleness.drifted;

  out.orderVsPacked = orderVsPacked(out.orderBreakdown || [], rows, {
    tolerancePercent,
    matchColour: colourKey,
  });

  // Validation context, assembled once and reused for whichever phase is asked for.
  const ctx = {
    pl: out,
    // V-12 resolves document-scope bindings (pl.*, shipment.*) against the same
    // objects the renderer does, so it needs the shipment, not just the document.
    shipment,
    template,
    totals: out.totals,
    tolerancePercent,
    orderBreakdown: out.orderBreakdown || [],
    plsInShipment: (db.packingLists || []).filter((p) => p.shipmentId === out.shipmentId),
    packedElsewhere: packedElsewhere(db, out),
    matchColour: colourKey,
    blocks: out.blocks,
    // V-21: the shipment's POs that have cartons on any of its live packing lists
    coveredPos: coveredPos(db, out),
  };
  const phase = options.phase || PHASE.SAVE;
  out.validation = validate(ctx, { phase, acknowledgements: out.acknowledgements || [] });
  // The submit gate is a different phase from the live panel, so the screen can
  // disable Submit with a reason without waiting for the click to find out.
  out.submitCheck = validate(ctx, { phase: PHASE.SUBMIT, acknowledgements: out.acknowledgements || [] });

  // What the panel shows: the live findings AND anything that would block
  // submission, deduped. Showing only one of the two lets the panel read "clear"
  // while the Submit button sits disabled, with nothing on screen explaining why.
  const merged = [...out.validation.findings];
  out.submitCheck.findings.forEach((f) => {
    if (!merged.some((m) => m.code === f.code && m.targetKey === f.targetKey)) merged.push(f);
  });
  out.panelFindings = {
    findings: merged,
    errors: merged.filter((f) => f.severity === 'ERROR'),
    warnings: merged.filter((f) => f.severity === 'WARN'),
    infos: merged.filter((f) => f.severity === 'INFO'),
    blocking: out.submitCheck.blocking,
    canProceed: out.submitCheck.canProceed,
  };

  // Permission-shaped flags the screen reads instead of re-deriving the rules.
  out.editable = out.status === PL_STATUS.DRAFT;
  /*
   * Finalising is the one gate left, and it runs the full check: the same
   * validation that used to be split across submit and approve now has to pass in
   * a single step, because there is no second pair of eyes behind it.
   */
  out.canFinalise = out.status === PL_STATUS.DRAFT && out.submitCheck.canProceed && rows.length > 0;
  out.finaliseBlockers = out.submitCheck.blocking.map((b) => b.message);

  out.canRevise = out.status === PL_STATUS.FINAL || out.status === PL_STATUS.EXPORTED;
  // Always on a draft: new packing for its orders arrives without the list changing
  out.canRefresh = out.status === PL_STATUS.DRAFT;
  return out;
};

/** The order x PO keys with cartons on any live packing list of this shipment. */
const coveredPos = (db, pl) => new Set((db.packingLists || [])
  .filter((p) => p.shipmentId === pl.shipmentId && LIVE_STATUSES.includes(p.status))
  .flatMap((p) => allRows(p).map((r) => `${r.orderId}|${r.poKey ?? ''}`)));

// ─── Queries ────────────────────────────────────────────────────────────────────

export const searchPackingLists = async (params = {}) => {
  await delay();
  const db = loadDb();
  const rows = db.packingLists
    .filter((p) => {
      if (params.status && p.status !== params.status) return false;
      if (params.shipmentId && p.shipmentId !== Number(params.shipmentId)) return false;
      if (params.buyerCode && p.buyerCode !== params.buyerCode) return false;
      if (params.search) {
        const hit = matchesText(p.plNo, params.search)
          || matchesText(p.buyerName, params.search)
          || matchesText(p.shipmentNo, params.search)
          || (p.orderNos || []).some((o) => matchesText(o, params.search));
        if (!hit) return false;
      }
      return true;
    })
    .map((p) => decoratePl(p, db))
    .sort((a, b) => b.id - a.id);
  return pageOf(rows, params);
};

export const getPackingList = async (id, options = {}) => {
  await delay(80);
  const db = loadDb();
  const pl = find(db, id);
  if (!pl) fail('NOT_FOUND', `Packing list ${id} not found`);
  return decoratePl(pl, db, options);
};

// ─── Creation ───────────────────────────────────────────────────────────────────

/** The rule this buyer's latest packing list used, else the default. */
const buyersRule = (db, buyerId, buyerName) => {
  const latest = (db.packingLists || [])
    .filter((p) => (buyerId != null ? p.buyerId === buyerId : p.buyerName === buyerName) && p.numbering)
    .sort((a, b) => b.id - a.id)[0];
  return latest?.numbering || DEFAULT_NUMBERING;
};

/** Where a continuing series starts: after the highest number on the shipment's other live lists. */
const nextFirstCarton = (db, shipmentId) => 1 + Math.max(0, ...(db.packingLists || [])
  .filter((p) => p.shipmentId === shipmentId && LIVE_STATUSES.includes(p.status))
  .flatMap((p) => allRows(p).map((r) => Number(r.cartonTo) || 0)));

/**
 * Create a packing list for a shipment (§7.1). It may bind nothing yet: the buyer's list
 * can come before the packing. `units` are entry x PO pairs ({ packingEntryId, poKey });
 * `orderMeta` is what the facade read of each order (expDocOrderMeta).
 */
export const createPackingList = async (payload) => {
  await delay();
  const db = loadDb();

  const shipment = db.shipments.find((s) => s.id === Number(payload.shipmentId));
  // The shipment is the API's, mirrored: unreadable now (deleted, offline) is a refusal, not a list without one
  if (!shipment) fail('NOT_FOUND', 'The shipment could not be read. Reload and pick it again.');

  const template = payload.templateSnapshot || null;
  if (template && template.docType !== DOC_TYPE.PACKING_LIST) {
    fail('VALIDATION', 'That template is not a packing-list layout.');
  }

  const taken = takenBy(db, null);
  const refs = (payload.units || []).map((u) => {
    const entry = (db.packingEntries || []).find((e) => e.id === Number(u.packingEntryId));
    if (!entry) fail('NOT_FOUND', 'A packing entry could not be read. Reload and pick again.');
    const by = taken.get(unitKeyOf(entry.id, u.poKey));
    if (by) fail('CONFLICT', `${entry.packingNo} is already on ${by}.`);
    return sourceRefOf(entry, u.poKey);
  });

  const numbering = Object.values(NUMBERING).includes(payload.numbering)
    ? payload.numbering : buyersRule(db, shipment.buyerId, shipment.buyerName);
  const id = Math.max(0, ...db.packingLists.map((p) => p.id)) + 1;
  const record = {
    id,
    // Allocated at CREATE: packing lists are referenced while still drafts, and a
    // gap in an internal series is harmless. The invoice differs (BR-02).
    plNo: nextPackingListNo(db),
    revision: 0,
    supersedesPlId: null,
    supersededByPlId: null,
    status: PL_STATUS.DRAFT,
    plDate: payload.plDate || todayStr(),
    descriptionOfGoods: payload.descriptionOfGoods ?? null,
    marksAndNos: payload.marksAndNos ?? null,
    containerNo: null,
    sealNo: null,
    remarks: null,
    shipmentId: shipment.id,
    shipmentNo: shipment.shipmentNo ?? null,
    buyerId: payload.buyerId ?? shipment.buyerId ?? null,
    buyerCode: payload.buyerCode ?? shipment.buyerCode ?? null,
    buyerName: payload.buyerName ?? shipment.buyerName ?? null,
    orderIds: (shipment.orders || []).map((o) => o.orderId),
    orderNos: [],
    numbering,
    firstCartonNo: numbering === NUMBERING.CONTINUE
      ? Math.max(1, Number(payload.firstCartonNo) || nextFirstCarton(db, shipment.id)) : 1,
    blockOrder: (shipment.orders || []).map((o) => o.orderId),
    orderMeta: clone(payload.orderMeta || {}),
    excludedUnits: [],
    sizes: [],
    templateId: template?.id ?? null,
    templateVersion: template?.version ?? null,
    templateSnapshot: template,
    templateMatchedOn: template && !template.isSystem ? 'CHOSEN' : 'STANDARD',
    templateIsFallback: !template || Boolean(template.isSystem),
    templateOverride: null,
    sourceRefs: refs,
    sections: [],
    orderBreakdown: clone(payload.orderBreakdown || []),
    tolerancePercent: payload.tolerancePercent ?? null,
    acknowledgements: [],
    finalSnapshot: null,
    finalisedBy: null,
    reviseReason: null,
    cancelReason: null,
    version: 0,
    contentHash: null,
    createdAt: nowStamp(),
    createdBy: currentUserName(),
    updatedAt: nowStamp(),
    updatedBy: currentUserName(),
  };
  reassemble(record, db);
  record.contentHash = contentHashOfRows(allRows(record));

  db.packingLists.push(record);
  pushAudit(db, {
    entityType: 'PACKING_LIST',
    entityId: id,
    entityNo: record.plNo,
    action: 'Packing list created',
    details: `${refs.length ? `Bound ${[...new Set(refs.map((r) => r.packingNo))].join(', ')}` : 'Nothing packed yet'}`
      + ` · template ${template?.name || 'standard layout'}`,
  });
  saveDb(db);
  return decoratePl(record, db);
};

// ─── Mutation ───────────────────────────────────────────────────────────────────

const touch = (pl) => {
  pl.version = (pl.version || 0) + 1;
  pl.updatedAt = nowStamp();
  pl.updatedBy = currentUserName();
  const nextHash = contentHashOfRows(allRows(pl));
  const contentChanged = nextHash !== pl.contentHash;
  pl.contentHash = nextHash;
  return contentChanged;
};

export const updatePackingList = async (id, payload) => {
  await delay();
  const db = loadDb();
  const pl = find(db, id);
  if (!pl) fail('NOT_FOUND', `Packing list ${id} not found`);
  if (pl.status !== PL_STATUS.DRAFT) {
    fail('CONFLICT', `${pl.plNo} is ${pl.status.toLowerCase()} and can no longer be edited. Revise it to make changes.`);
  }
  if (payload.version != null && Number(payload.version) !== Number(pl.version)) {
    failConflict(pl.plNo, payload.version, pl.version);
  }
  // A whitelist, not a blacklist. Carton rows, the number, the status and the
  // final snapshot are not editable through this door at any severity, and an
  // unlisted key is dropped rather than written.
  const before = clone(pl);
  PL_EDITABLE_FIELDS.forEach((f) => {
    if (Object.prototype.hasOwnProperty.call(payload, f)) {
      const v = payload[f];
      pl[f] = v === '' ? null : v;
    }
  });
  if (!Object.values(NUMBERING).includes(pl.numbering)) pl.numbering = before.numbering || DEFAULT_NUMBERING;
  pl.firstCartonNo = Math.max(1, Number(pl.firstCartonNo) || 1);
  const changes = fieldDiff(before, pl, PL_EDITABLE_FIELDS);
  if (!changes.length) return decoratePl(pl, db);
  if (changes.some((c) => NUMBERING_FIELDS.includes(c.field))) reassemble(pl, db);
  touch(pl);
  pushAudit(db, {
    entityType: 'PACKING_LIST', entityId: pl.id, entityNo: pl.plNo,
    action: 'Packing list edited',
    details: describeChanges(changes),
    changes,
  });
  saveDb(db);
  return decoratePl(pl, db);
};

/**
 * Re-pull carton rows from the bound packing entries (PRD §7.1 "Refresh from
 * Packing"). Carton corrections are made in the entry screen; this is how they
 * reach a document that is still a draft.
 */
export const refreshFromPacking = async (id, options = {}) => {
  await delay();
  const db = loadDb();
  const pl = find(db, id);
  if (!pl) fail('NOT_FOUND', `Packing list ${id} not found`);
  if (pl.status !== PL_STATUS.DRAFT) {
    fail('CONFLICT', 'Only a draft packing list can be refreshed. Revise the document to pull newer carton data.');
  }
  // An entry deleted in Carton Packing drops off; one this browser could not read stays as it was
  const dropped = [];
  const groups = groupsByOrder(pl, shipmentOf(db, pl));
  pl.sourceRefs = (pl.sourceRefs || []).flatMap((ref) => {
    const entry = (db.packingEntries || []).find((e) => e.id === ref.packingEntryId);
    if (entry) {
      // The packer moved this PO's cartons to another PO: nothing of the unit is left here
      const orderGroups = groups.get(ref.orderId) || [];
      const { units } = unitsOfEntry(entry, orderGroups, soloKeyOf(orderGroups, pl.orderMeta?.[ref.orderId]));
      if (!(units.get(ref.poKey ?? null) || []).length) { dropped.push(`${ref.packingNo} (no cartons for that PO now)`); return []; }
      return [{ ...sourceRefOf(entry, ref.poKey) }];
    }
    if (readCoversBranch(ref.orderId, ref.branchId)) { dropped.push(`${ref.packingNo} (deleted in Carton Packing)`); return []; }
    return [ref];
  });
  if (options.orderMeta) {
    Object.entries(options.orderMeta).forEach(([orderId, meta]) => {
      // An order that cannot be read now keeps what was read before
      if (meta?.readable || !pl.orderMeta?.[orderId]) pl.orderMeta = { ...(pl.orderMeta || {}), [orderId]: meta };
    });
  }
  reassemble(pl, db);
  const changed = touch(pl);

  pushAudit(db, {
    entityType: 'PACKING_LIST', entityId: pl.id, entityNo: pl.plNo,
    action: changed ? 'Refreshed from packing — carton data changed' : 'Refreshed from packing — no change',
    details: [
      (pl.sourceRefs || []).map((r) => `${r.packingNo} v${r.packingEntryVersion}`).join(', '),
      dropped.length ? `dropped: ${dropped.join(', ')}` : '',
    ].filter(Boolean).join(' · '),
  });
  saveDb(db);
  return decoratePl(pl, db);
};

/** Guard shared by the block actions: a draft, at the version the screen holds. */
const draftFor = (db, id, version) => {
  const pl = find(db, id);
  if (!pl) fail('NOT_FOUND', `Packing list ${id} not found`);
  if (pl.status !== PL_STATUS.DRAFT) {
    fail('CONFLICT', `${pl.plNo} is ${pl.status.toLowerCase()}. Revise it to change its cartons.`);
  }
  if (version != null && Number(version) !== Number(pl.version)) failConflict(pl.plNo, version, pl.version);
  return pl;
};

/** Take entry x PO units onto a draft (§7.1 "Add"). Each must be packed, readable and on no other live list. */
export const bindPackingEntries = async (id, units = [], version) => {
  await delay(80);
  const db = loadDb();
  const pl = draftFor(db, id, version);
  const taken = takenBy(db, pl.id);
  const bound = new Set((pl.sourceRefs || []).map(refKey));
  const added = [];
  units.forEach((u) => {
    const entry = (db.packingEntries || []).find((e) => e.id === Number(u.packingEntryId));
    if (!entry) fail('NOT_FOUND', 'A packing entry could not be read. Check for new packing and try again.');
    const key = unitKeyOf(entry.id, u.poKey);
    if (taken.get(key)) fail('CONFLICT', `${entry.packingNo} is already on ${taken.get(key)}.`);
    if (bound.has(key)) return;
    bound.add(key);
    pl.sourceRefs.push(sourceRefOf(entry, u.poKey));
    added.push(entry.packingNo);
  });
  if (!added.length) return decoratePl(pl, db);
  pl.excludedUnits = (pl.excludedUnits || []).filter((x) => !bound.has(unitKeyOf(x.packingEntryId, x.poKey)));
  reassemble(pl, db);
  touch(pl);
  pushAudit(db, {
    entityType: 'PACKING_LIST', entityId: pl.id, entityNo: pl.plNo,
    action: 'Packing added', details: [...new Set(added)].join(', '),
  });
  saveDb(db);
  return decoratePl(pl, db);
};

/** Take one unit off a draft; it is not offered again until added back by hand. */
export const removePackingEntry = async (id, unit, version) => {
  await delay(80);
  const db = loadDb();
  const pl = draftFor(db, id, version);
  const key = unitKeyOf(unit.packingEntryId, unit.poKey);
  const ref = (pl.sourceRefs || []).find((r) => refKey(r) === key);
  if (!ref) return decoratePl(pl, db);
  pl.sourceRefs = pl.sourceRefs.filter((r) => refKey(r) !== key);
  pl.excludedUnits = [...(pl.excludedUnits || []).filter((x) => unitKeyOf(x.packingEntryId, x.poKey) !== key),
    { packingEntryId: ref.packingEntryId, poKey: ref.poKey ?? null }];
  reassemble(pl, db);
  touch(pl);
  pushAudit(db, {
    entityType: 'PACKING_LIST', entityId: pl.id, entityNo: pl.plNo,
    action: 'Packing removed', details: `${ref.packingNo}${ref.poKey ? ` · PO ${ref.poKey.split('\u0000')[0]}` : ''}`,
  });
  saveDb(db);
  return decoratePl(pl, db);
};

/** Move an order's block up (-1) or down (+1): under "continue", the carton numbers follow. */
export const moveBlock = async (id, orderId, delta, version) => {
  await delay(60);
  const db = loadDb();
  const pl = draftFor(db, id, version);
  reassemble(pl, db);
  const order = [...pl.blockOrder];
  const at = order.indexOf(orderId);
  const to = at + Math.sign(delta);
  if (at < 0 || to < 0 || to >= order.length) return decoratePl(pl, db);
  [order[at], order[to]] = [order[to], order[at]];
  pl.blockOrder = order;
  reassemble(pl, db);
  touch(pl);
  pushAudit(db, { entityType: 'PACKING_LIST', entityId: pl.id, entityNo: pl.plNo, action: 'Order blocks reordered' });
  saveDb(db);
  return decoratePl(pl, db);
};

/** Drop an order the shipment no longer carries: its cartons come off the list. */
export const dropBlock = async (id, orderId, version) => {
  await delay(60);
  const db = loadDb();
  const pl = draftFor(db, id, version);
  const shipment = shipmentOf(db, pl);
  // Never on a guess: an unreadable shipment would make every order look dropped
  if (!shipment) fail('NOT_FOUND', 'The shipment could not be read. Reload and try again.');
  const onShipment = (shipment.orders || []).some((o) => o.orderId === orderId);
  const groups = groupsByOrder(pl, shipment).get(orderId) || [];
  const gone = (r) => r.orderId === orderId && (!onShipment || groups.some((g) => g.orphan && g.key === (r.poKey ?? null)));
  const removed = (pl.sourceRefs || []).filter(gone);
  pl.sourceRefs = (pl.sourceRefs || []).filter((r) => !gone(r));
  // The buyer's plan for what no longer ships goes with it
  const plan = pl.plans?.[orderId];
  const droppedPlan = (plan?.rows || []).filter((r) => gone({ orderId, poKey: r.poKey }));
  if (droppedPlan.length) pl.plans = { ...pl.plans, [orderId]: { ...plan, rows: plan.rows.filter((r) => !droppedPlan.includes(r)) } };
  if (!onShipment) pl.blockOrder = (pl.blockOrder || []).filter((x) => x !== orderId);
  reassemble(pl, db);
  touch(pl);
  pushAudit(db, {
    entityType: 'PACKING_LIST', entityId: pl.id, entityNo: pl.plNo,
    action: 'Cartons no longer on the shipment dropped',
    details: [...new Set(removed.map((r) => r.packingNo)), ...(droppedPlan.length ? [`${droppedPlan.length} planned range(s)`] : [])].join(', '),
  });
  saveDb(db);
  return decoratePl(pl, db);
};

/** Record a reason against a warning so an authorised user may proceed (BR-03). */
export const acknowledgeWarning = async (id, findingRef, reason) => {
  await delay(80);
  const db = loadDb();
  const pl = find(db, id);
  if (!pl) fail('NOT_FOUND', `Packing list ${id} not found`);
  if (!reason || reason.trim().length < 10) {
    fail('VALIDATION', 'Give a reason of at least 10 characters — it is kept in the audit trail.');
  }
  /*
   * Accepts either the finding object or just its targetKey. The key form is the
   * safer one and the one the screens use: the values that justify an override are
   * re-derived here rather than taken from the caller, so a stale copy on the client
   * cannot acknowledge a warning that has since changed.
   */
  const item = typeof findingRef === 'string'
    ? (decoratePl(pl, db).panelFindings.findings || []).find((f) => f.targetKey === findingRef)
    : findingRef;
  if (!item) fail('NOT_FOUND', 'That warning is no longer raised on this document.');

  const ack = buildAcknowledgement(item, reason.trim(), currentUserName(), nowStamp());
  pl.acknowledgements = (pl.acknowledgements || []).filter((a) => !acknowledgementApplies(a, item));
  pl.acknowledgements.push(ack);
  pl.version = (pl.version || 0) + 1;
  pushAudit(db, {
    entityType: 'PACKING_LIST', entityId: pl.id, entityNo: pl.plNo,
    action: `Warning ${item.code} acknowledged`,
    details: item.message, reason: reason.trim(),
  });
  saveDb(db);
  return decoratePl(pl, db);
};

// ─── Lifecycle ──────────────────────────────────────────────────────────────────

/**
 * Release the document's files (§16 Final -> Released, §20 "export" event).
 *
 * Printing alone was never recorded, so the register could not report an export date
 * and the Released status — defined, allowed and treated as issued everywhere —
 * was unreachable. This is the act that sets it.
 */
export const markPackingListExported = async (id, options = {}) => {
  await delay();
  const db = loadDb();
  const pl = find(db, id);
  if (!pl) fail('NOT_FOUND', `Packing list ${id} not found`);
  if (!(PL_TRANSITIONS[pl.status] || []).includes(PL_STATUS.EXPORTED)) {
    fail('CONFLICT', `A ${pl.status.toLowerCase()} packing list cannot be released.`);
  }
  pl.status = PL_STATUS.EXPORTED;
  pl.exportedAt = nowStamp();
  pl.exportedBy = currentUserName();
  pl.version = (pl.version || 0) + 1;
  pushAudit(db, {
    entityType: 'PACKING_LIST', entityId: pl.id, entityNo: pl.plNo,
    action: 'Documents released (Exported)',
    details: options.detail || 'Printed and released to the buyer / forwarder.',
  });
  raise(db, {
    type: NOTIF.DOC_RELEASED,
    title: `${pl.plNo} released`,
    body: `Released by ${pl.exportedBy} for ${pl.buyerName || 'the buyer'}.`,
    actionUrl: `/export-docs/packing-lists/edit/${pl.id}`,
    entityType: 'PACKING_LIST', entityId: pl.id, entityNo: pl.plNo,
  });
  // §11.1: the shipment reflects its documents; the facade closes it (expDocShipmentBridge).
  saveDb(db);
  return decoratePl(pl, db);
};

/**
 * Change the template ONE draft packing list renders with (§10.2).
 *
 * Two cases, told apart by the snapshot the caller hands in:
 *  - a NEWER REVISION of the template it already uses (v1 to v2): the buyer changed
 *    their layout and this draft follows. Logged, no reason needed.
 *  - a DIFFERENT template: the user's choice at creation is being replaced, which is
 *    permissioned (`override`) and needs a reason, because it is the one way a
 *    document stops matching what was picked for it.
 * A final or exported packing list is frozen; revise it first, then change the draft.
 */
export const changePlTemplate = async (id, snapshot, { reason } = {}) => {
  await delay();
  const db = loadDb();
  const pl = find(db, id);
  if (!pl) fail('NOT_FOUND', `Packing list ${id} not found`);
  if (pl.status !== PL_STATUS.DRAFT) {
    fail('CONFLICT', 'Only a draft packing list can change its template. Revise a final one first.');
  }
  if (!snapshot) fail('NOT_FOUND', 'That template was not found.');
  if (snapshot.docType !== DOC_TYPE.PACKING_LIST) fail('VALIDATION', 'That template is not a packing-list layout.');

  const current = pl.templateSnapshot;
  const upgrade = Boolean(current && !current.isSystem && current.templateCode === snapshot.templateCode
    && Number(snapshot.version) > Number(current.version || 0));
  const trimmed = String(reason || '').trim();
  if (!upgrade && trimmed.length < 10) {
    fail('VALIDATION', 'Give a reason of at least 10 characters — it is logged against the document.');
  }

  const from = current ? `${current.templateCode} v${current.version}` : 'the standard layout';
  pl.templateOverride = upgrade
    ? (pl.templateOverride && { ...pl.templateOverride, templateVersion: snapshot.version })
    : {
      templateId: snapshot.id,
      templateVersion: snapshot.version,
      replacedTemplateId: pl.templateId,
      reason: trimmed,
      user: currentUserName(),
      at: nowStamp(),
    };
  pl.templateId = snapshot.id;
  pl.templateVersion = snapshot.version;
  pl.templateSnapshot = snapshot;
  if (!upgrade) pl.templateMatchedOn = 'CHANGED';
  pl.templateIsFallback = Boolean(snapshot.isSystem);
  pl.version = (pl.version || 0) + 1;
  pushAudit(db, {
    entityType: 'PACKING_LIST', entityId: pl.id, entityNo: pl.plNo,
    action: upgrade ? 'Template revision updated' : 'Template changed',
    details: `${from} to ${snapshot.templateCode} v${snapshot.version}`,
    reason: upgrade ? null : trimmed,
  });
  saveDb(db);
  return decoratePl(pl, db);
};

export const changeStatus = async (id, target, reason) => {
  await delay();
  const db = loadDb();
  const pl = find(db, id);
  if (!pl) fail('NOT_FOUND', `Packing list ${id} not found`);

  const allowed = PL_TRANSITIONS[pl.status] || [];
  if (!allowed.includes(target)) {
    fail('CONFLICT', `${pl.plNo} cannot move from ${pl.status} to ${target}.`);
  }

  const decorated = decoratePl(pl, db, { phase: PHASE.SUBMIT });
  const user = currentUserName();

  if (target === PL_STATUS.FINAL) {
    if (!allRows(pl).length) fail('CONFLICT', 'There are no cartons on this packing list.');
    /*
     * Both phases run here.
     *
     * They used to be two gates with a reviewer between them. With one step there
     * is no later checkpoint to catch what the save-phase check let through, so the
     * stricter phase's rules have to hold before the document freezes.
     */
    if (!decorated.submitCheck.canProceed) {
      fail('CONFLICT', `Cannot finalise — ${decorated.submitCheck.blocking.length} issue(s) still open: ${decorated.submitCheck.blocking.map((b) => b.message).join(' ')}`);
    }
    const finalCheck = validate(
      {
        pl: decorated,
        template: decorated.template,
        totals: decorated.totals,
        tolerancePercent: decorated.tolerancePercent,
        orderBreakdown: pl.orderBreakdown || [],
        plsInShipment: (db.packingLists || []).filter((p) => p.shipmentId === pl.shipmentId),
        packedElsewhere: packedElsewhere(db, pl),
        matchColour: colourKey,
      },
      { phase: PHASE.APPROVE, acknowledgements: pl.acknowledgements || [] },
    );
    if (!finalCheck.canProceed) {
      fail('CONFLICT', `Cannot finalise — ${finalCheck.blocking.length} issue(s) still open.`);
    }
    pl.finalisedBy = user;
    // BR-08: finalising snapshots data + template version. Every export renders
    // from this, so a re-print a year later reproduces the original document.
    pl.finalSnapshot = {
      at: nowStamp(),
      by: user,
      templateId: pl.templateId,
      templateVersion: pl.templateVersion,
      contentHash: pl.contentHash,
      payload: clone({
        sections: pl.sections,
        sizes: pl.sizes,
        orderBreakdown: pl.orderBreakdown,
        totals: decorated.totals,
        // BR-08: the header is snapshotted too. `resolved` in particular, because
        // it carries the shipment's consignee, which a later shipment edit can
        // change — reprinting a final document must not silently pick up the new address.
        plDate: pl.plDate,
        descriptionOfGoods: pl.descriptionOfGoods,
        marksAndNos: pl.marksAndNos,
        remarks: pl.remarks,
        resolved: decorated.resolved,
        // How the cartons are numbered and grouped, frozen with them (BR-08)
        numbering: pl.numbering,
        firstCartonNo: pl.firstCartonNo,
        blockOrder: pl.blockOrder,
        cartonRangeLabel: decorated.cartonRangeLabel,
      }),
    };
  }

  if (target === PL_STATUS.CANCELLED && (!reason || !reason.trim())) {
    fail('VALIDATION', 'Cancelling a packing list needs a reason.');
  }
  if (target === PL_STATUS.CANCELLED) pl.cancelReason = reason.trim();

  pl.status = target;
  pl.version = (pl.version || 0) + 1;
  pl.updatedAt = nowStamp();
  pl.updatedBy = user;

  pushAudit(db, {
    entityType: 'PACKING_LIST', entityId: pl.id, entityNo: pl.plNo,
    action: `Status changed to ${target}`, reason: reason ? reason.trim() : null,
  });

  // §23. Raised inside the same mutation as the change it describes, so a
  // notification can never outlive a transition that failed.
  const NOTE = {
    [PL_STATUS.FINAL]: {
      type: NOTIF.PL_FINALISED,
      title: `${pl.plNo} is final`,
      body: `${user} finalised ${decorated.totals.cartons} carton(s) for ${pl.buyerName || 'this buyer'}${
        decorated.panelFindings.warnings.filter((w) => w.acknowledged).length
          ? ` with ${decorated.panelFindings.warnings.filter((w) => w.acknowledged).length} acknowledged warning(s)`
          : ''}. Stickers and the export invoice can now be raised from it.`,
    },
    [PL_STATUS.CANCELLED]: {
      type: NOTIF.PL_CANCELLED,
      title: `${pl.plNo} cancelled`,
      body: reason ? reason.trim() : 'Cancelled.',
    },
  }[target];
  if (NOTE) {
    raise(db, {
      ...NOTE,
      actionUrl: `/export-docs/packing-lists/edit/${pl.id}`,
      entityType: 'PACKING_LIST', entityId: pl.id, entityNo: pl.plNo,
    });
  }

  saveDb(db);
  return decoratePl(pl, db);
};

/**
 * Post-finalise correction (PRD §17). Never edits in place: creates a NEW draft row
 * carrying the same plNo with revision + 1, and supersedes the old one, so the buyer
 * keeps referencing one number across revisions.
 */
export const revisePackingList = async (id, reason) => {
  await delay();
  const db = loadDb();
  const pl = find(db, id);
  if (!pl) fail('NOT_FOUND', `Packing list ${id} not found`);
  if (![PL_STATUS.FINAL, PL_STATUS.EXPORTED].includes(pl.status)) {
    fail('CONFLICT', 'Only a final or released packing list can be revised.');
  }
  if (!reason || reason.trim().length < 10) {
    fail('VALIDATION', 'A revision needs a reason of at least 10 characters.');
  }

  const newId = Math.max(0, ...db.packingLists.map((p) => p.id)) + 1;
  const revision = {
    ...clone(pl),
    id: newId,
    revision: (pl.revision || 0) + 1,
    status: PL_STATUS.DRAFT,
    supersedesPlId: pl.id,
    supersededByPlId: null,
    finalSnapshot: null,
    finalisedBy: null,
    reviseReason: reason.trim(),
    // A revision starts with a clean slate: the previous reasons were given against
    // the previous version's numbers.
    acknowledgements: [],
    version: 0,
    createdAt: nowStamp(),
    createdBy: currentUserName(),
    updatedAt: nowStamp(),
    updatedBy: currentUserName(),
  };

  pl.status = PL_STATUS.SUPERSEDED;
  pl.supersededByPlId = newId;
  pl.version = (pl.version || 0) + 1;

  db.packingLists.push(revision);
  pushAudit(db, {
    entityType: 'PACKING_LIST', entityId: newId, entityNo: revision.plNo,
    action: `Revision ${revision.revision} created`,
    details: `Supersedes revision ${pl.revision || 0}`, reason: reason.trim(),
  });
  raise(db, {
    type: NOTIF.PL_REVISED,
    title: `${revision.plNo} revised to R${revision.revision}`,
    body: reason.trim(),
    actionUrl: `/export-docs/packing-lists/edit/${newId}`,
    entityType: 'PACKING_LIST', entityId: newId, entityNo: revision.plNo,
  });
  saveDb(db);
  return decoratePl(revision, db);
};

export const deletePackingList = async (id) => {
  await delay();
  const db = loadDb();
  const pl = find(db, id);
  if (!pl) fail('NOT_FOUND', `Packing list ${id} not found`);
  if (pl.status !== PL_STATUS.DRAFT) {
    fail('CONFLICT', `${pl.plNo} is ${pl.status.toLowerCase()} and cannot be deleted. Cancel it instead.`);
  }
  db.packingLists = db.packingLists.filter((p) => p.id !== pl.id);
  pushAudit(db, {
    entityType: 'PACKING_LIST', entityId: pl.id, entityNo: pl.plNo, action: 'Packing list deleted',
  });
  saveDb(db);
  return { success: true };
};

/**
 * What a new packing list of this shipment could take, order by order and PO by PO:
 * the Carton Packing entries of the shipment's orders, each split by PO, with the reason
 * when one cannot be taken. `orderMeta` tells an order's POs when the shipment ticked none.
 */
export const listBindableForShipment = async (shipmentId, orderMeta = {}) => {
  await delay(80);
  const db = loadDb();
  const shipment = (db.shipments || []).find((s) => s.id === Number(shipmentId));
  if (!shipment) return { orders: [], unreadable: false };
  const probe = { id: null, shipmentId: shipment.id, blockOrder: [], sourceRefs: [], orderMeta };
  const groups = groupsByOrder(probe, shipment);
  const taken = takenBy(db, null);
  const orders = (shipment.orders || []).map((o) => {
    const offered = unitsOffered(db, o.orderId, groups.get(o.orderId) || [], { taken, meta: orderMeta[o.orderId] });
    return {
      orderId: o.orderId,
      orderNo: o.orderNo,
      styleNo: o.styleNo,
      unreadable: packingReadOf(o.orderId) === PACKING_READ.UNREADABLE,
      pos: (groups.get(o.orderId) || []).map((g) => ({ ...g, units: offered.byGroup.get(g.key) || [] })),
      unplaced: offered.unplaced,
    };
  });
  return { orders, unreadable: orders.some((o) => o.unreadable) };
};

/**
 * Save the buyer's plan for one order of a draft (owner, 2026-10-09): ranges in the buyer's
 * numbers, each for a PO the shipment carries. The cartons renumber to the plan.
 */
export const savePlPlan = async (id, orderId, rows, version) => {
  await delay(80);
  const db = loadDb();
  const pl = draftFor(db, id, version);
  const shipment = shipmentOf(db, pl);
  // A plan names only POs the shipment carries — not one it no longer has
  const groups = (groupsByOrder(pl, shipment).get(Number(orderId)) || []).filter((g) => !g.orphan);
  try {
    applyPlan(pl, Number(orderId), rows || [], groups, pl.orderMeta?.[orderId]);
  } catch (e) {
    fail('VALIDATION', e.message);
  }
  reassemble(pl, db);
  touch(pl);
  pushAudit(db, {
    entityType: 'PACKING_LIST', entityId: pl.id, entityNo: pl.plNo,
    action: "Buyer's plan saved", details: `${(rows || []).length} planned range(s) for order ${orderId}`,
  });
  saveDb(db);
  return decoratePl(pl, db);
};

/** Mark a planned range Not shipping with a reason (a short shipment), or `reason` null to ship it again. */
export const markPlanNotShipping = async (id, orderId, planRowId, reason, version) => {
  await delay(60);
  const db = loadDb();
  const pl = draftFor(db, id, version);
  let row;
  try {
    row = markNotShipping(pl, Number(orderId), planRowId, reason);
  } catch (e) {
    fail('VALIDATION', e.message);
  }
  // Numbers of a range not shipping are no longer free for cartons packed before the plan
  reassemble(pl, db);
  touch(pl);
  pushAudit(db, {
    entityType: 'PACKING_LIST', entityId: pl.id, entityNo: pl.plNo,
    action: reason ? 'Planned cartons marked not shipping' : 'Planned cartons shipping again',
    details: `${row.cartonFrom}–${row.cartonTo}`, reason: reason || null,
  });
  saveDb(db);
  return decoratePl(pl, db);
};

/**
 * The draft packing lists in this browser whose buyer's plan still has cartons of this
 * order to pack, for Carton Packing's "Pack as per packing list".
 */
export const openPlansForOrder = async (orderId) => {
  await delay(60);
  const db = loadDb();
  return (db.packingLists || [])
    .filter((p) => p.status === PL_STATUS.DRAFT && (p.plans?.[orderId]?.rows || []).length)
    .map((p) => {
      const block = (decoratePl(p, db).blocks || []).find((b) => b.orderId === Number(orderId));
      const rows = (block?.pos || []).filter((po) => po.onShipment).flatMap((po) => {
        // Packed as per this plan but not added to the list yet: those cartons exist, so are not offered again.
        // Packing of the PO on another list (another shipment, numbered from 1 again) says nothing of this plan.
        const held = (po.offers || []).filter((o) => o.inPlan && !o.onList).flatMap((o) => o.ownRanges);
        return (po.plan?.rows || []).map((r) => ({ plan: r.plan, toPack: subtractRanges(r.toPack, held) }));
      }).filter((r) => r.toPack.length);
      return { plId: p.id, plNo: p.plNo, shipmentNo: p.shipmentNo, rows };
    })
    .filter((p) => p.rows.length);
};

/** The orders a packing list reads cartons for: its shipment's, and those of the units it binds. */
export const ordersOfList = (id) => {
  const db = loadDb();
  const pl = find(db, id);
  if (!pl) return [];
  const shipment = shipmentOf(db, pl);
  return [...new Set([...(shipment?.orders || []).map((o) => o.orderId), ...(pl.sourceRefs || []).map((r) => r.orderId)])];
};

/** The orders of every packing list in this browser: the register flags lists behind their cartons. */
export const ordersOfAllLists = () => [...new Set((loadDb().packingLists || []).flatMap((p) => (p.sourceRefs || []).map((r) => r.orderId)))];

/**
 * The live packing lists in this browser that hold each of these Carton Packing entries,
 * for the Carton Packing screens: entry id -> [{ plId, plNo, status, buyerPoNo }].
 */
export const listsOfEntries = (entryIds = []) => {
  const wanted = new Set(entryIds.map(Number));
  const out = {};
  (loadDb().packingLists || []).filter((p) => LIVE_STATUSES.includes(p.status)).forEach((p) => {
    (p.sourceRefs || []).filter((r) => wanted.has(r.packingEntryId)).forEach((r) => {
      out[r.packingEntryId] = [...(out[r.packingEntryId] || []), {
        plId: p.id, plNo: p.plNo, status: p.status, buyerPoNo: r.poKey ? r.poKey.split('\u0000')[0] : null,
      }];
    });
  });
  return out;
};

// ─── Version compare (§16, §17) ─────────────────────────────────────────────────

/** Header fields worth diffing between two revisions of the same document. */
const COMPARE_HEADER = [
  'plDate', 'descriptionOfGoods', 'marksAndNos', 'remarks',
  'containerNo', 'sealNo', 'templateId', 'templateVersion',
  'shipmentNo', 'numbering', 'firstCartonNo',
];

/** Carton-row fields that change what the document says. */
const COMPARE_ROW = [
  'cartonFrom', 'cartonTo', 'packingType', 'styleNo', 'colorName', 'buyerPoNo',
  'destination', 'danNo', 'netWeightKg', 'grossWeightKg',
  'lengthCm', 'breadthCm', 'heightCm', 'sizeQty', 'ratio', 'assortmentsPerCarton',
  'pcsPerMpb', 'mpbPerCarton', 'mixedRows', 'remarks',
];

/**
 * A row's identity across revisions: its stable id (entry, PO, section and the entry's
 * own carton numbers), so a revision that renumbered the printed cartons reads as an
 * edit rather than as a delete plus an add.
 */
const rowKey = (row) => (row.id != null
  ? `ID:${row.id}`
  : `POS:${row.sectionKey || ''}|${row.cartonFrom}-${row.cartonTo}`);

/** How a row reads in a diff: what it is, and which cartons it covers. */
const rowLabel = (row) => [
  formatRanges([{ from: row.cartonFrom, to: row.cartonTo }]),
  row.styleNo,
  row.colorName,
].filter(Boolean).join(' · ');

/** Every revision of one packing list number, oldest first. */
export const revisionChain = (db, pl) => (db.packingLists || [])
  .filter((p) => p.plNo === pl.plNo)
  .sort((a, b) => (a.revision || 0) - (b.revision || 0))
  .map((p) => ({
    id: p.id,
    revision: p.revision || 0,
    status: p.status,
    version: p.version,
    contentHash: p.contentHash,
    createdAt: p.createdAt,
    finalisedAt: p.finalSnapshot?.at || null,
    reviseReason: p.reviseReason || null,
    isCurrent: p.id === pl.id,
  }));

/**
 * Diff two packing lists — any two, not just consecutive revisions (§17).
 *
 * Rows, never cartons: a revision of a 40,000-carton shipment is still a few dozen
 * rows, and expanding both sides to compare carton by carton would be the one place
 * in this module that scales with shipment size.
 */
export const comparePackingLists = async (idA, idB) => {
  await delay(80);
  const db = loadDb();
  const a = find(db, idA);
  const b = find(db, idB);
  if (!a || !b) fail('NOT_FOUND', 'One of the documents was not found.');

  const decA = decoratePl(a, db);
  const decB = decoratePl(b, db);

  const header = COMPARE_HEADER
    .filter((f) => JSON.stringify(a[f] ?? null) !== JSON.stringify(b[f] ?? null))
    .map((f) => ({ field: f, from: a[f] ?? null, to: b[f] ?? null }));

  const rowsA = new Map(allRows(a).map((r) => [rowKey(r), r]));
  const rowsB = new Map(allRows(b).map((r) => [rowKey(r), r]));
  const keys = [...new Set([...rowsA.keys(), ...rowsB.keys()])];

  const added = [];
  const removed = [];
  const changed = [];
  keys.forEach((k) => {
    const ra = rowsA.get(k);
    const rb = rowsB.get(k);
    if (!ra) { added.push({ key: k, row: clone(rb), label: rowLabel(rb) }); return; }
    if (!rb) { removed.push({ key: k, row: clone(ra), label: rowLabel(ra) }); return; }
    const fields = COMPARE_ROW
      .filter((f) => JSON.stringify(ra[f] ?? null) !== JSON.stringify(rb[f] ?? null))
      .map((f) => ({ field: f, from: ra[f] ?? null, to: rb[f] ?? null }));
    if (fields.length) changed.push({ key: k, label: rowLabel(rb), fields });
  });

  const totalKeys = ['cartons', 'pieces', 'netWeightKg', 'grossWeightKg', 'cbm'];
  const totals = totalKeys
    .map((k) => ({ field: k, from: decA.totals?.[k] ?? 0, to: decB.totals?.[k] ?? 0 }))
    .filter((t) => Number(t.from) !== Number(t.to))
    .map((t) => ({ ...t, delta: Number((Number(t.to) - Number(t.from)).toFixed(3)) }));

  const side = (p, d) => ({
    id: p.id, plNo: p.plNo, revision: p.revision || 0, status: p.status,
    version: p.version, cartons: d.totals?.cartons ?? 0, pieces: d.totals?.pieces ?? 0,
    finalisedAt: p.finalSnapshot?.at || null,
  });

  return {
    a: side(a, decA),
    b: side(b, decB),
    header,
    rows: { added, removed, changed },
    totals,
    identical: !header.length && !added.length && !removed.length && !changed.length && !totals.length,
    // A diff of two documents that never shared a number is legitimate but worth
    // saying out loud — it is a comparison, not a revision history.
    sameDocument: a.plNo === b.plNo,
  };
};
