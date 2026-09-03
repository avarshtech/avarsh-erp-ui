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
import { decorateEntry } from './expDocMockPacking';
import { decorate as decorateShipment, partyBlock, syncShipmentStatus } from './expDocMockShipments';
import { raise, EXPDOC_NOTIFICATION as NOTIF } from './expDocMockNotifications';
import {
  PL_STATUS, PL_TRANSITIONS, SECTION_KEY, SECTION_TITLES, PHASE, DOC_TYPE,
} from '../../utils/expDocConstants';
import {
  sectionTotals, grandTotals, weightPerPiece, orderVsPacked, contentHashOfRows,
  toRanges, countCartons, formatRanges, packedQuantities,
} from '../../utils/expDocCalc';
import { validate, buildAcknowledgement, acknowledgementApplies } from '../../utils/expDocValidation';
import { resolveTemplate } from '../../utils/expDocTemplateSchema';

const find = (db, id) => db.packingLists.find((p) => p.id === Number(id));
const allRows = (pl) => (pl.sections || []).flatMap((s) => s.rows || []);

const LIVE_STATUSES = [PL_STATUS.DRAFT, PL_STATUS.SUBMITTED, PL_STATUS.APPROVED, PL_STATUS.EXPORTED];

// ─── Scaffolding ────────────────────────────────────────────────────────────────

/**
 * Build the document's sections from the bound packing entries.
 *
 * Carton rows arrive from the packing module already split; this module renders
 * whatever ranges it receives and never merges or splits them (PRD §24.10).
 */
const scaffoldSections = (entries) => {
  const buckets = { [SECTION_KEY.MAIN]: [], [SECTION_KEY.EXTRA]: [] };
  entries.forEach((entry) => {
    (entry.groups || []).forEach((group) => {
      const key = group.sectionKey || SECTION_KEY.MAIN;
      buckets[key] = buckets[key] || [];
      buckets[key].push({
        ...clone(group),
        sourceEntryId: entry.id,
        sourceEntryNo: entry.packingNo,
        sourceGroupId: group.id,
      });
    });
  });
  return Object.entries(buckets)
    .filter(([, rows]) => rows.length)
    .map(([key, rows], index) => ({
      key,
      title: SECTION_TITLES[key] || key,
      order: index,
      rows: rows.sort((a, b) => (a.cartonFrom || 0) - (b.cartonFrom || 0)),
    }));
};

/**
 * The ordered breakdown, snapshotted onto the document so it stays stable.
 *
 * Preferred source is the packing entry: that is where a real order was bound, so
 * it holds the quantities as they were when the cartons were recorded. An explicit
 * payload wins if the caller has fresher data.
 */
const buildOrderBreakdown = (payload, entries) => {
  if ((payload.orderBreakdown || []).length) return clone(payload.orderBreakdown);

  /*
   * Two entries bound to the SAME order describe the same ordered quantity twice, so
   * their lines must collapse. Two entries bound to DIFFERENT orders describe two
   * genuinely separate quantities that happen to share a style/colour/size, so
   * theirs must add up. The order number is what separates the two cases — keying
   * without it either double-counts a multi-entry order or silently loses one
   * order's quantity from the variance panel.
   *
   * The colour is normalised the same way `orderVsPacked` normalises it, or a
   * Pantone-suffixed name would survive as a second line that can never match
   * anything packed.
   */
  const byKey = new Map();
  entries.forEach((entry) => {
    (entry.orderBreakdown || []).forEach((line) => {
      const orderKey = String(entry.orderNo ?? entry.id ?? '');
      const dedupe = `${orderKey}|${String(line.styleNo ?? '').trim().toLowerCase()}|${colourKey(line.colorName)}|${String(line.size ?? '').trim()}`;
      if (byKey.has(dedupe)) return; // same order, same line — already counted
      byKey.set(dedupe, { ...clone(line), sourceOrderNo: entry.orderNo ?? null });
    });
  });

  // Now fold across orders, so one style/colour/size ordered on two POs reads as one
  // line with the combined quantity — which is what the variance panel compares.
  const merged = new Map();
  [...byKey.values()].forEach((line) => {
    const key = `${String(line.styleNo ?? '').trim().toLowerCase()}|${colourKey(line.colorName)}|${String(line.size ?? '').trim()}`;
    const hit = merged.get(key);
    if (!hit) { merged.set(key, line); return; }
    hit.orderQty = (Number(hit.orderQty) || 0) + (Number(line.orderQty) || 0);
    // A blended rate here would be wrong: the invoice resolves rates per size from
    // the order, so the first non-null price is kept only as a display hint.
    if (hit.orderRate === null || hit.orderRate === undefined) hit.orderRate = line.orderRate ?? null;
  });
  return [...merged.values()];
};

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

const templateFor = (db, pl) => {
  if (pl.templateId) {
    const exact = (db.templates || []).find(
      (t) => t.id === pl.templateId && t.version === pl.templateVersion,
    );
    // Documents render the version they were built on — templates are immutable
    // once active, so an exact match is the normal case.
    if (exact) return exact;
  }
  return resolveTemplate(db.templates, {
    buyerCode: pl.buyerCode,
    subClientCode: pl.subClientCode,
    docType: DOC_TYPE.PACKING_LIST,
    onDate: pl.plDate,
  }).template;
};

/**
 * Staleness against the bound packing entries. Compares the stored entry VERSION,
 * and reports which entries moved so the banner can name them.
 */
const stalenessOf = (db, pl) => {
  const drifted = (pl.sourceRefs || [])
    .map((ref) => {
      const entry = (db.packingEntries || []).find((e) => e.id === ref.packingEntryId);
      if (!entry) return { ...ref, missing: true };
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
 * shipment data (owned by the shipment). These are the document's own, and each is
 * an OVERRIDE where an inherited value exists — null means "take the shipment's".
 */
export const PL_EDITABLE_FIELDS = [
  'plDate', 'descriptionOfGoods', 'marksAndNos', 'consigneeProfileId',
  'deliveryCentre', 'containerNo', 'sealNo', 'remarks',
];

/** Resolve a document field to its own value, else the shipment's. */
const inherited = (own, from) => (own === null || own === undefined || own === '' ? from ?? null : own);

export const decoratePl = (pl, db, options = {}) => {
  const out = clone(pl);
  const rows = allRows(out);
  const template = templateFor(db, out);
  const tolerancePercent = out.tolerancePercent
    ?? getBuyerCommercial({ buyerCode: out.buyerCode, buyerName: out.buyerName }).tolerancePercent
    ?? 0;

  out.sections = (out.sections || []).map((s) => ({ ...s, totals: sectionTotals(s.rows) }));
  out.totals = grandTotals(out.sections);
  out.weightPerPiece = weightPerPiece(out.totals);
  out.cartonRangeLabel = formatRanges(toRanges(rows));
  out.distinctCartons = countCartons(toRanges(rows));
  out.template = template ? clone(template) : null;
  out.tolerancePercent = tolerancePercent;

  // §12.1 header overrides resolved once, here, so the screen and the printed
  // document can never disagree about which value won.
  const shipment = (db.shipments || []).find((sh) => sh.id === out.shipmentId) || null;
  const commercial = getBuyerCommercial({ buyerCode: out.buyerCode, buyerName: out.buyerName });
  const ownConsignee = (commercial.consigneeProfiles || []).find((c) => c.id === out.consigneeProfileId);
  out.resolved = {
    consignee: ownConsignee ? partyBlock(ownConsignee) : (shipment ? decorateShipment(shipment, db).consignee : null),
    deliveryCentre: inherited(out.deliveryCentre, shipment?.deliveryCentre),
    containerNo: inherited(out.containerNo, (shipment?.containerNos || []).join(', ') || null),
    sealNo: inherited(out.sealNo, shipment?.sealNo),
  };
  // Which of them the document overrode — the §11.3 "modified" marker needs to know.
  out.overridden = {
    consignee: Boolean(out.consigneeProfileId),
    deliveryCentre: Boolean(out.deliveryCentre),
    containerNo: Boolean(out.containerNo),
    sealNo: Boolean(out.sealNo),
  };
  out.consigneeOptions = (commercial.consigneeProfiles || []).map((c) => ({ id: c.id, name: c.name }));
  // §17: every revision of this number, so the history panel can offer a comparison
  // between any two — not only between consecutive ones.
  out.revisions = revisionChain(db, out);

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

  const user = currentUserName();
  const fourEyes = db.masters?.tenantConfig?.fourEyesEnabled !== false;

  // Permission-shaped flags the screen reads instead of re-deriving the rules.
  out.editable = out.status === PL_STATUS.DRAFT;
  out.canSubmit = out.status === PL_STATUS.DRAFT && out.submitCheck.canProceed && rows.length > 0;
  out.submitBlockers = out.submitCheck.blocking.map((b) => b.message);
  out.isOwnDocument = fourEyes && (out.submittedBy || out.createdBy) === user;
  /*
   * Approval is gated on the SAME check submission was, not only on four-eyes.
   *
   * An acknowledgement stops applying when the value that justified it changes, so a
   * document can arrive at approval with a warning open again. Enabling Approve then
   * offered an action the service would refuse — and the warning could no longer be
   * acknowledged, because that needs a draft.
   */
  out.canApprove = out.status === PL_STATUS.SUBMITTED
    && !out.isOwnDocument
    && out.submitCheck.canProceed;
  out.approveBlockedReason = out.status !== PL_STATUS.SUBMITTED
    ? null
    : (out.isOwnDocument
      ? 'You submitted this packing list. Four-eyes review requires a different approver.'
      : (out.submitCheck.blocking.length
        ? `${out.submitCheck.blocking.length} issue(s) reopened since submission. Send it back to draft to resolve them.`
        : null));
  /*
   * A maker may take back their own submission while it is still untouched (§16).
   *
   * This is NOT the reviewer's send-back: nobody has rejected anything, and the
   * maker should not have to find an approver to undo a misclick. Distinguishing
   * them keeps the audit trail honest about who changed their mind.
   */
  out.canRecall = out.status === PL_STATUS.SUBMITTED && (out.submittedBy || out.createdBy) === user;

  out.canRevise = out.status === PL_STATUS.APPROVED || out.status === PL_STATUS.EXPORTED;
  out.canRefresh = out.status === PL_STATUS.DRAFT && out.isStale;
  return out;
};

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

export const createPackingList = async (payload) => {
  await delay();
  const db = loadDb();

  const entries = (payload.packingEntryIds || [])
    .map((eid) => db.packingEntries.find((e) => e.id === Number(eid)))
    .filter(Boolean);
  if (!entries.length) fail('VALIDATION', 'Select at least one packing entry to bind.');

  const shipment = db.shipments.find((s) => s.id === Number(payload.shipmentId));

  /*
   * The buyer and sub-client are settled BEFORE the template is resolved, and the
   * same values are then stored on the document.
   *
   * Resolving with only what the caller passed while storing the shipment's or the
   * entry's meant a JOMO/AMG list resolved as plain JOMO — no sub-client — and fell
   * all the way through to the generic layout, quietly breaking §10.2's promise that
   * a JOMO order for AMG picks the AMG template automatically. The packing entry is
   * the most authoritative source: it is what is actually being packed.
   */
  const buyerCode = payload.buyerCode ?? shipment?.buyerCode ?? entries[0]?.buyerCode ?? null;
  const subClientCode = payload.subClientCode
    ?? shipment?.subClientCode
    ?? entries[0]?.subClientCode
    ?? null;

  const resolution = resolveTemplate(db.templates, {
    buyerCode,
    subClientCode,
    docType: DOC_TYPE.PACKING_LIST,
    onDate: payload.plDate || todayStr(),
  });
  const sections = scaffoldSections(entries);
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
    consigneeProfileId: null,
    deliveryCentre: null,
    containerNo: null,
    sealNo: null,
    remarks: null,
    shipmentId: shipment?.id ?? null,
    shipmentNo: shipment?.shipmentNo ?? null,
    buyerCode,
    buyerName: payload.buyerName ?? shipment?.buyerName ?? entries[0]?.buyerName ?? null,
    subClientCode,
    orderIds: payload.orderIds || [],
    orderNos: [...new Set(entries.map((e) => e.orderNo).filter(Boolean))],
    // Frozen from the entries, so a later size-preset edit cannot reorder columns.
    sizes: [...new Set(entries.flatMap((e) => e.sizes || []))],
    templateId: resolution.template?.id ?? null,
    templateVersion: resolution.template?.version ?? null,
    templateMatchedOn: resolution.matchedOn,
    templateIsFallback: resolution.isFallback,
    templateOverride: null,
    sourceRefs: entries.map((e) => ({
      packingEntryId: e.id,
      packingNo: e.packingNo,
      packingEntryVersion: e.version,
    })),
    sections,
    orderBreakdown: buildOrderBreakdown(payload, entries),
    tolerancePercent: payload.tolerancePercent ?? null,
    acknowledgements: [],
    approvalSnapshot: null,
    submittedBy: null,
    approvedBy: null,
    reviseReason: null,
    cancelReason: null,
    version: 0,
    contentHash: contentHashOfRows(sections.flatMap((s) => s.rows)),
    createdAt: nowStamp(),
    createdBy: currentUserName(),
    updatedAt: nowStamp(),
    updatedBy: currentUserName(),
  };

  db.packingLists.push(record);
  pushAudit(db, {
    entityType: 'PACKING_LIST',
    entityId: id,
    entityNo: record.plNo,
    action: 'Packing list created',
    details: `Bound ${entries.map((e) => e.packingNo).join(', ')} · template ${resolution.template?.name || 'none'}`,
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
  // approval snapshot are not editable through this door at any severity, and an
  // unlisted key is dropped rather than written.
  const before = clone(pl);
  PL_EDITABLE_FIELDS.forEach((f) => {
    if (Object.prototype.hasOwnProperty.call(payload, f)) {
      const v = payload[f];
      pl[f] = v === '' ? null : v;
    }
  });
  const changes = fieldDiff(before, pl, PL_EDITABLE_FIELDS);
  if (!changes.length) return decoratePl(pl, db);
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
 * reach an unapproved document.
 */
export const refreshFromPacking = async (id) => {
  await delay();
  const db = loadDb();
  const pl = find(db, id);
  if (!pl) fail('NOT_FOUND', `Packing list ${id} not found`);
  if (pl.status !== PL_STATUS.DRAFT) {
    fail('CONFLICT', 'Only a draft packing list can be refreshed. Revise the document to pull newer carton data.');
  }
  const entries = (pl.sourceRefs || [])
    .map((ref) => db.packingEntries.find((e) => e.id === ref.packingEntryId))
    .filter(Boolean);
  if (!entries.length) fail('CONFLICT', 'The bound packing entries no longer exist.');

  pl.sections = scaffoldSections(entries);
  pl.sizes = [...new Set(entries.flatMap((e) => e.sizes || []))];
  pl.sourceRefs = entries.map((e) => ({
    packingEntryId: e.id, packingNo: e.packingNo, packingEntryVersion: e.version,
  }));
  // Re-pull the ordered breakdown as well: a refresh means "match the source again".
  pl.orderBreakdown = buildOrderBreakdown({}, entries);
  const changed = touch(pl);

  pushAudit(db, {
    entityType: 'PACKING_LIST', entityId: pl.id, entityNo: pl.plNo,
    action: changed ? 'Refreshed from packing — carton data changed' : 'Refreshed from packing — no change',
    details: entries.map((e) => `${e.packingNo} v${e.version}`).join(', '),
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
    fail('VALIDATION', 'Give a reason of at least 10 characters — it is shown to the approver and kept in the audit trail.');
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
 * Release the document's files (§16 Approved -> Exported, §20 "export" event).
 *
 * Printing alone was never recorded, so the register could not report an export date
 * and the Exported status — defined, allowed and treated as approved everywhere —
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
  // §11.1: the shipment reflects its documents.
  syncShipmentStatus(db, pl.shipmentId);
  saveDb(db);
  return decoratePl(pl, db);
};

/**
 * Force a specific template version on ONE document (§10.2).
 *
 * The buyer default is untouched — this changes what this document renders with, and
 * nothing else. Permissioned (`override`) and logged with a mandatory reason, because
 * it is the one way a document can stop matching what its buyer's register says.
 */
export const overridePlTemplate = async (id, templateId, reason) => {
  await delay();
  const db = loadDb();
  const pl = find(db, id);
  if (!pl) fail('NOT_FOUND', `Packing list ${id} not found`);
  if (pl.status !== PL_STATUS.DRAFT) fail('CONFLICT', 'Only a draft document can have its template overridden.');
  if (!reason || String(reason).trim().length < 10) {
    fail('VALIDATION', 'Give a reason of at least 10 characters — it is logged against the document.');
  }
  const tpl = (db.templates || []).find((t) => t.id === Number(templateId));
  if (!tpl) fail('NOT_FOUND', `Template ${templateId} not found`);
  if (tpl.docType !== DOC_TYPE.PACKING_LIST) fail('VALIDATION', 'That template is not a packing-list layout.');

  const from = `${pl.templateId ? `#${pl.templateId}` : 'none'} v${pl.templateVersion ?? '-'}`;
  pl.templateOverride = {
    templateId: tpl.id,
    templateVersion: tpl.version,
    replacedTemplateId: pl.templateId,
    reason: String(reason).trim(),
    user: currentUserName(),
    at: nowStamp(),
  };
  pl.templateId = tpl.id;
  pl.templateVersion = tpl.version;
  pl.templateMatchedOn = 'OVERRIDE';
  pl.templateIsFallback = false;
  pl.version = (pl.version || 0) + 1;
  pushAudit(db, {
    entityType: 'PACKING_LIST', entityId: pl.id, entityNo: pl.plNo,
    action: 'Template overridden',
    details: `${from} to ${tpl.templateCode} v${tpl.version}`,
    reason: pl.templateOverride.reason,
  });
  saveDb(db);
  return decoratePl(pl, db);
};

/** Drop the override and go back to whatever the buyer's active template resolves to. */
export const clearPlTemplateOverride = async (id) => {
  await delay();
  const db = loadDb();
  const pl = find(db, id);
  if (!pl) fail('NOT_FOUND', `Packing list ${id} not found`);
  if (!pl.templateOverride) fail('CONFLICT', 'This document has no template override.');
  const resolution = resolveTemplate(db.templates, {
    buyerCode: pl.buyerCode,
    subClientCode: pl.subClientCode,
    docType: DOC_TYPE.PACKING_LIST,
    onDate: pl.plDate,
  });
  pl.templateOverride = null;
  pl.templateId = resolution.template?.id ?? null;
  pl.templateVersion = resolution.template?.version ?? null;
  pl.templateMatchedOn = resolution.matchedOn;
  pl.templateIsFallback = resolution.isFallback;
  pl.version = (pl.version || 0) + 1;
  pushAudit(db, {
    entityType: 'PACKING_LIST', entityId: pl.id, entityNo: pl.plNo,
    action: 'Template override removed',
    details: `Back to ${resolution.template?.templateCode || 'no template'}`,
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

  if (target === PL_STATUS.SUBMITTED) {
    if (!allRows(pl).length) fail('CONFLICT', 'There are no cartons on this packing list.');
    if (!decorated.submitCheck.canProceed) {
      fail('CONFLICT', `Cannot submit — ${decorated.submitCheck.blocking.length} issue(s) still open: ${decorated.submitCheck.blocking.map((b) => b.message).join(' ')}`);
    }
    pl.submittedBy = user;
  }

  if (target === PL_STATUS.APPROVED) {
    // BR-11 four-eyes. Advisory client-side; the API must re-enforce it.
    if (db.masters?.tenantConfig?.fourEyesEnabled !== false && (pl.submittedBy || pl.createdBy) === user) {
      fail('CONFLICT', 'The creator of a document cannot be its sole approver. Four-eyes review is enabled for this tenant.');
    }
    const approveCheck = validate(
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
    if (!approveCheck.canProceed) {
      fail('CONFLICT', `Cannot approve — ${approveCheck.blocking.length} issue(s) still open.`);
    }
    pl.approvedBy = user;
    // BR-08: approval snapshots data + template version. Every export renders from
    // this, so a re-print a year later reproduces the original document.
    pl.approvalSnapshot = {
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
        // it resolves a consignee profile that master data can change afterwards —
        // reprinting an approved document must not silently pick up the new address.
        plDate: pl.plDate,
        descriptionOfGoods: pl.descriptionOfGoods,
        marksAndNos: pl.marksAndNos,
        remarks: pl.remarks,
        resolved: decorated.resolved,
      }),
    };
  }

  if (target === PL_STATUS.CANCELLED && (!reason || !reason.trim())) {
    fail('VALIDATION', 'Cancelling a packing list needs a reason.');
  }
  if (target === PL_STATUS.CANCELLED) pl.cancelReason = reason.trim();
  if (target === PL_STATUS.DRAFT) pl.submittedBy = null;

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
    [PL_STATUS.SUBMITTED]: {
      type: NOTIF.PL_SUBMITTED,
      title: `${pl.plNo} is waiting for approval`,
      body: `${user} submitted ${decorated.totals.cartons} carton(s) for ${pl.buyerName || 'this buyer'}${
        decorated.panelFindings.warnings.filter((w) => w.acknowledged).length
          ? ` with ${decorated.panelFindings.warnings.filter((w) => w.acknowledged).length} acknowledged warning(s)`
          : ''}.`,
    },
    [PL_STATUS.APPROVED]: {
      type: NOTIF.PL_APPROVED,
      title: `${pl.plNo} approved`,
      body: `Approved by ${user}. Stickers and the export invoice can now be raised from it.`,
    },
    [PL_STATUS.DRAFT]: {
      type: NOTIF.PL_SENT_BACK,
      title: `${pl.plNo} was sent back`,
      body: reason ? reason.trim() : 'Returned to draft for changes.',
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
 * Post-approval correction (PRD §17). Never edits in place: creates a NEW draft row
 * carrying the same plNo with revision + 1, and supersedes the old one, so the buyer
 * keeps referencing one number across revisions.
 */
export const revisePackingList = async (id, reason) => {
  await delay();
  const db = loadDb();
  const pl = find(db, id);
  if (!pl) fail('NOT_FOUND', `Packing list ${id} not found`);
  if (![PL_STATUS.APPROVED, PL_STATUS.EXPORTED].includes(pl.status)) {
    fail('CONFLICT', 'Only an approved or exported packing list can be revised.');
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
    approvalSnapshot: null,
    submittedBy: null,
    approvedBy: null,
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

/** Packing entries a new packing list may bind, with the reason when it may not. */
export const listBindableForShipment = async (shipmentId) => {
  await delay(80);
  const db = loadDb();
  const takenBy = new Map();
  (db.packingLists || [])
    .filter((p) => LIVE_STATUSES.includes(p.status))
    .forEach((p) => (p.sourceRefs || []).forEach((r) => takenBy.set(r.packingEntryId, p.plNo)));

  return (db.packingEntries || [])
    .filter((e) => !shipmentId || e.shipmentId === Number(shipmentId))
    .map((e) => {
      const dec = decorateEntry(e);
      const taken = takenBy.get(e.id);
      return {
        id: e.id,
        packingNo: e.packingNo,
        orderNo: e.orderNo,
        styleNo: e.styleNo,
        status: e.status,
        cartons: dec.totals.cartons,
        pieces: dec.totals.pieces,
        sizes: e.sizes || [],
        hasOrderBreakdown: (e.orderBreakdown || []).length > 0,
        bindable: dec.errorCount === 0 && !taken,
        // Not-yet-complete entries CAN be bound, with a warning (PRD §7.1).
        bindWarning: e.status !== 'COMPLETED' ? 'Packing entry is not marked complete.' : null,
        blockedReason: taken
          ? `Already bound to ${taken}.`
          : (dec.errorCount > 0 ? `${dec.errorCount} structural error(s) must be fixed first.` : null),
      };
    });
};

// ─── Version compare (§16, §17) ─────────────────────────────────────────────────

/** Header fields worth diffing between two revisions of the same document. */
const COMPARE_HEADER = [
  'plDate', 'descriptionOfGoods', 'marksAndNos', 'remarks', 'deliveryCentre',
  'containerNo', 'sealNo', 'consigneeProfileId', 'templateId', 'templateVersion',
  'subClientCode', 'shipmentNo',
];

/** Carton-row fields that change what the document says. */
const COMPARE_ROW = [
  'cartonFrom', 'cartonTo', 'packingType', 'styleNo', 'colorName', 'buyerPoNo',
  'destination', 'danNo', 'endCustomer', 'netWeightKg', 'grossWeightKg',
  'lengthCm', 'breadthCm', 'heightCm', 'sizeQty', 'ratio', 'assortmentsPerCarton',
  'pcsPerMpb', 'mpbPerCarton', 'mixedRows', 'remarks',
];

/**
 * A row's identity across revisions.
 *
 * `sourceRowId` is the packing-entry group the row was copied from, so it survives a
 * revision that changed the carton numbers — which is exactly the change a reader
 * most wants to see as an edit rather than as a delete plus an add.
 */
const rowKey = (row) => (row.sourceRowId != null
  ? `SRC:${row.sourceRowId}`
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
    approvedAt: p.approvalSnapshot?.at || null,
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
    approvedAt: p.approvalSnapshot?.at || null,
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

/**
 * The submitter takes their own document back (§16).
 *
 * Deliberately separate from the reviewer's send-back: the audit entry says who
 * changed their mind, and it needs no approver.
 */
export const recallPackingList = async (id, reason) => {
  await delay();
  const db = loadDb();
  const pl = find(db, id);
  if (!pl) fail('NOT_FOUND', `Packing list ${id} not found`);
  if (pl.status !== PL_STATUS.SUBMITTED) {
    fail('CONFLICT', 'Only a document awaiting approval can be recalled.');
  }
  const user = currentUserName();
  if ((pl.submittedBy || pl.createdBy) !== user) {
    fail('CONFLICT', `Only ${pl.submittedBy || pl.createdBy} can recall this submission. An approver can send it back instead.`);
  }
  pl.status = PL_STATUS.DRAFT;
  pl.submittedBy = null;
  pl.version = (pl.version || 0) + 1;
  pl.updatedAt = nowStamp();
  pl.updatedBy = user;
  pushAudit(db, {
    entityType: 'PACKING_LIST', entityId: pl.id, entityNo: pl.plNo,
    action: 'Submission recalled by its author',
    reason: reason ? String(reason).trim() : null,
  });
  saveDb(db);
  return decoratePl(pl, db);
};
