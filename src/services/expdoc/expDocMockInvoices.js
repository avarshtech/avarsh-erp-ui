/**
 * Export invoice — mock service (PRD §8, §16, §17).
 *
 * The invoice is a projection of one or more APPROVED packing lists. It stores its
 * own header, lines, charges and tax block, but never its own quantities of record:
 * `plTotals` is always recomputed from the bound packing lists, so BR-01's promise
 * — that the three documents can never disagree — holds by construction rather than
 * by discipline.
 *
 * Three things the packing list cannot supply are resolved here, once, at line
 * generation: the order's FOB rate, the style's HS code, and the garment name and
 * composition. All three live upstream of the carton data, and all three may be
 * absent — in which case the line carries null and V-12 reports it, rather than the
 * document printing a confident blank.
 */
import { loadDb, saveDb, nextInvoiceNo } from './expDocMockStore';
import {
  delay, clone, fail, failConflict, pageOf, matchesText, pushAudit, nowStamp,
  todayStr, currentUserName, colourKey, fieldDiff, describeChanges,
} from './expDocMockCommon';
import { getBuyerCommercial, getHsDefault, getFxRate, getExporterProfileExtra } from './expDocMockMasters';
import { decoratePl } from './expDocMockPackingLists';
import { decorate as decorateShipment, syncShipmentStatus } from './expDocMockShipments';
import { raise, EXPDOC_NOTIFICATION as NOTIF } from './expDocMockNotifications';
import { getCurrentUser } from '../../utils/permissions';
import {
  INVOICE_STATUS, INVOICE_TRANSITIONS, PL_STATUS, PHASE, DOC_TYPE,
  DEFAULT_TENANT_CONFIG, LINE_GRAIN,
} from '../../utils/expDocConstants';
import {
  buildInvoiceLines, makeRateResolver, invoiceTotals, igstBlock, aggregatePlTotals,
  recalcLine,
} from '../../utils/expDocInvoiceCalc';
import { validate, buildAcknowledgement, acknowledgementApplies } from '../../utils/expDocValidation';
import { resolveTemplate } from '../../utils/expDocTemplateSchema';

const LIVE_INVOICE_STATUSES = [
  INVOICE_STATUS.DRAFT, INVOICE_STATUS.SUBMITTED,
  INVOICE_STATUS.APPROVED, INVOICE_STATUS.EXPORTED,
];

/** Packing lists an invoice may be raised from (§8.1: approved, or already shipped). */
const INVOICEABLE_PL_STATUSES = [PL_STATUS.APPROVED, PL_STATUS.EXPORTED];

const allRows = (pl) => (pl?.sections || []).flatMap((s) => s.rows || []);

// ─── Source resolution ──────────────────────────────────────────────────────────

/**
 * Rows for line generation, stamped with the order they came from.
 *
 * A packing-list row records which packing ENTRY produced it but not which order —
 * and the order is what separates line 1 of two orders in the per-order-line grain,
 * and what the description and rate resolve against. The join is
 * `row.sourceEntryId -> packingEntries[].orderNo`, done once here so no caller has
 * to know it.
 */
const rowsWithOrder = (db, pls) => {
  const entryById = new Map((db.packingEntries || []).map((e) => [e.id, e]));
  return pls.flatMap((pl) => allRows(pl).map((row) => {
    const entry = entryById.get(row.sourceEntryId);
    return {
      ...row,
      orderNo: entry?.orderNo ?? null,
      // Carried so the line builder can name the garment without re-joining.
      __garmentName: entry?.garmentName ?? null,
      __composition: entry?.compositionText ?? null,
      __category: entry?.garmentCategory ?? null,
      __plId: pl.id,
      __plNo: pl.plNo,
    };
  }));
};

/** Ordered breakdown across every bound packing list, for the rate resolver. */
const mergedBreakdown = (pls) => {
  const out = new Map();
  pls.forEach((pl) => (pl.orderBreakdown || []).forEach((line) => {
    const key = `${String(line.styleNo ?? '').toLowerCase()}|${colourKey(line.colorName)}|${String(line.size ?? '').trim()}`;
    if (!out.has(key)) out.set(key, clone(line));
  }));
  return [...out.values()];
};

/** Sizes in the order the packing lists declare them, for size-range labels. */
const mergedSizes = (pls) => [...new Set(pls.flatMap((pl) => pl.sizes || []))];

/**
 * Generate lines from the bound packing lists.
 *
 * Kept separate from create/update because §8.3 lets the grain change and V-13 asks
 * for a regenerate — both of which are exactly this, run again.
 */
const generateLines = (db, pls, template) => {
  const rows = rowsWithOrder(db, pls);
  const breakdown = mergedBreakdown(pls);
  const rate = makeRateResolver(breakdown, { matchColour: colourKey });

  // One lookup per group rather than per atom; the members all share a source.
  const firstMember = (group) => (group.members || [])[0] || {};
  const rowById = new Map(rows.map((r) => [r.id, r]));
  const sourceRow = (group) => rowById.get(firstMember(group).rowId) || {};

  const lines = buildInvoiceLines(rows, {
    grain: template?.invoiceLineGrain || { mode: LINE_GRAIN.PER_STYLE_SIZE_RANGE },
    sizes: mergedSizes(pls),
    matchColour: colourKey,
    rateFor: rate.rateOnly,
    garmentNameFor: (g) => sourceRow(g).__garmentName ?? null,
    compositionFor: (g) => sourceRow(g).__composition ?? null,
    hsCodeFor: (g) => getHsDefault(sourceRow(g).__category)?.code ?? null,
  });

  // The order's own price is kept alongside the (editable) invoice rate so V-11 has
  // something to compare against after a user overrides it.
  return lines.map((line, i) => {
    // The atoms carry their own style and colour, so a mixed carton's colour rows
    // are priced correctly instead of being reported as never priced.
    const detail = rate({ members: line.sourceAtoms });
    return {
      ...line,
      id: i + 1,
      seq: i + 1,
      orderRate: detail?.rate ?? null,
      rateIsBlended: detail?.blended ?? false,
      unpricedQty: detail?.unpricedQty ?? 0,
    };
  });
};

/**
 * Annexe sheets (§8.3, Appendix A.5).
 *
 * An annexe is the SAME data at a different line grain — VGT's "BUYER" sheet is the
 * invoice per size — so it is generated by running the line builder again with the
 * annexe's grain, never by re-entering anything. Computed here rather than in the
 * renderer because the renderer has no packing-list rows to group.
 */
const generateAnnexes = (db, pls, template) =>
  (template?.annexeSheets || []).map((sheet) => ({
    key: sheet.key,
    title: sheet.title || sheet.key,
    grainMode: sheet.grain?.mode || null,
    lines: generateLines(db, pls, {
      ...template,
      invoiceLineGrain: { ...(template.invoiceLineGrain || {}), ...(sheet.grain || {}), groupBy: undefined },
    }),
  }));

// ─── Decoration ─────────────────────────────────────────────────────────────────

const boundPls = (db, inv) => (inv.packingListRefs || [])
  .map((ref) => (db.packingLists || []).find((p) => p.id === ref.plId))
  .filter(Boolean)
  .map((pl) => decoratePl(pl, db));

/**
 * Everything a screen needs, derived rather than stored: totals, tax, validation and
 * the action gates. Recomputing beats persisting because the packing list underneath
 * can change at any time and a stored total would quietly go stale.
 */
/**
 * The figures a Finance signature covers (§16).
 *
 * Everything the money depends on and nothing that does not: a corrected buyer
 * address must not invalidate a signature, and a changed rate must.
 */
const financeFigures = (out) => ({
  currency: out.currency || null,
  fxRate: Number(out.fxRate) || null,
  linesTotal: Number(out.totals?.linesTotal) || 0,
  netTotal: Number(out.totals?.netTotal) || 0,
  igstValue: Number(out.igst?.igstValue) || 0,
  charges: (out.lines || []).length,
  rates: (out.lines || []).map((l) => `${l.seq}:${Number(l.rate) || 0}:${Number(l.quantity) || 0}`).join('|'),
});

const sameFigures = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Whether the signed-in user holds one of the tenant's Finance roles. */
const isFinanceUser = (cfg) => {
  const role = getCurrentUser()?.role;
  if (!role) return false;
  return (cfg.financeRoles || []).some((r) => String(r).toLowerCase() === String(role).toLowerCase());
};

export const decorateInvoice = (inv, db, options = {}) => {
  const out = clone(inv);
  const pls = boundPls(db, inv);
  const cfg = { ...DEFAULT_TENANT_CONFIG, ...(db.masters?.tenantConfig || {}) };

  out.packingLists = pls.map((pl) => ({
    id: pl.id, plNo: pl.plNo, status: pl.status, totals: pl.totals,
    cartonRangeLabel: pl.cartonRangeLabel, contentHash: pl.contentHash, version: pl.version,
  }));
  out.plTotals = aggregatePlTotals(pls.map((pl) => pl.totals));
  out.marksAndNos = pls.map((pl) => pl.cartonRangeLabel).filter(Boolean).join(', ');

  // The invoice stores its shipment's transport fields on itself, but V-12 resolves
  // a mandatory `shipment.*` header binding against the live record.
  const shipmentRow = (db.shipments || []).find((sh) => sh.id === pls[0]?.shipmentId) || null;
  const shipment = shipmentRow ? decorateShipment(shipmentRow, db) : null;

  const template = (db.templates || []).find((t) => t.id === out.templateId) || null;
  /*
   * The decorated template carries the EFFECTIVE grain, not the buyer default.
   *
   * A grain override changed the lines but nothing read `grainOverride` back, so the
   * wizard's selector snapped to the template's grain while the lines were at
   * another, and the printed columns followed the template rather than the document.
   * Resolving it once here keeps every reader in step.
   */
  out.template = template ? clone(template) : null;
  if (out.template && out.grainOverride?.mode) {
    out.template.invoiceLineGrain = {
      ...(out.template.invoiceLineGrain || {}),
      ...out.grainOverride,
      // `reason`, `by` and `at` are audit fields, not grain configuration.
      reason: undefined,
      by: undefined,
      at: undefined,
    };
  }

  out.lines = (out.lines || []).map(recalcLine);
  out.annexes = (out.annexes || []).map((a) => ({ ...a, lines: (a.lines || []).map(recalcLine) }));
  out.totals = invoiceTotals(out.lines, out.charges || {});
  // Resolve the template BEFORE this: an IGST block that reads a template not yet
  // assigned would compute tax on a document whose layout switched it off.
  out.igst = template?.igst?.enabled === false
    ? null
    : igstBlock(out.totals.netTotal, out.fxRate, out.igstRatePct);

  const commercial = getBuyerCommercial({ buyerCode: out.buyerCode, buyerName: out.buyerName });
  out.tolerancePercent = Number(commercial.tolerancePercent) || 0;
  out.allowMultiInvoicePerPl = Boolean(commercial.allowMultiInvoicePerPl);

  // V-13 compares the hash the invoice was built on with the packing list's now.
  out.staleRefs = (out.packingListRefs || []).filter((ref) => {
    const live = pls.find((p) => p.id === ref.plId);
    return live && ref.plContentHash && live.contentHash !== ref.plContentHash;
  });
  out.isStale = out.staleRefs.length > 0;

  const ctx = {
    invoice: out,
    plTotals: out.plTotals,
    // V-12 resolves a mandatory header field against the namespace it binds, so the
    // shipment has to be in scope here as well as on the packing list.
    shipment,
    template,
    rateDeviationPercent: cfg.rateDeviationPercent,
    allowMultiInvoicePerPl: out.allowMultiInvoicePerPl,
    livePls: pls,
    invoicesForPls: (db.invoices || []).filter((o) => o.id !== out.id),
  };
  const acknowledgements = out.acknowledgements || [];
  const phase = options.phase || PHASE.INVOICE_SAVE;

  out.validation = validate(ctx, { phase, acknowledgements });
  out.submitCheck = validate(ctx, { phase: PHASE.INVOICE_APPROVE, acknowledgements });

  /*
   * The panel shows the union of the live findings and anything that would block
   * approval — showing only one lets the panel read "clear" while the button sits
   * disabled with nothing on screen explaining why.
   *
   * Shaped exactly like the packing list's `panelFindings` so one validation panel
   * component renders both documents.
   */
  const merged = new Map();
  [...out.validation.findings, ...out.submitCheck.findings]
    .forEach((f) => { if (!merged.has(`${f.code}|${f.targetKey}`)) merged.set(`${f.code}|${f.targetKey}`, f); });
  const all = [...merged.values()];
  out.panelFindings = {
    findings: all,
    errors: all.filter((f) => f.severity === 'ERROR'),
    warnings: all.filter((f) => f.severity === 'WARN'),
    infos: all.filter((f) => f.severity === 'INFO'),
    blocking: out.submitCheck.blocking,
    canProceed: out.submitCheck.canProceed,
  };

  const user = currentUserName();
  out.editable = inv.status === INVOICE_STATUS.DRAFT;
  out.isOwnDocument = inv.createdBy === user;

  out.canSubmit = out.editable && out.submitCheck.errors.length === 0;
  out.submitBlockers = out.submitCheck.errors.map((e) => e.message);

  /*
   * §16 / BR-11: the optional Finance sign-off on the financial block.
   *
   * The signature records the FIGURES it was given, and stops applying when they
   * move — the same rule an acknowledgement follows (§14). Without that, re-rating
   * a line after Finance signed would carry their signature onto numbers they never
   * saw, which is worse than having no second approval at all.
   */
  out.financeRequired = cfg.financeApprovalRequired === true;
  out.financeFigures = financeFigures(out);
  out.financeSignOffValid = Boolean(inv.financeSignOff)
    && sameFigures(inv.financeSignOff.figures, out.financeFigures);
  out.financeSignOffStale = Boolean(inv.financeSignOff) && !out.financeSignOffValid;
  out.isFinanceUser = isFinanceUser(cfg);
  out.canSignOffFinancials = out.financeRequired
    && inv.status === INVOICE_STATUS.SUBMITTED
    && !out.financeSignOffValid
    && out.isFinanceUser
    // The person who raised the figures cannot be the second pair of eyes on them.
    && !(cfg.fourEyesEnabled && out.isOwnDocument);

  // BR-11 four-eyes: advisory here, and the API must re-enforce it.
  const fourEyesBlocks = cfg.fourEyesEnabled && out.isOwnDocument;
  const financeBlocks = out.financeRequired && !out.financeSignOffValid;
  out.canApprove = inv.status === INVOICE_STATUS.SUBMITTED
    && out.submitCheck.canProceed && !fourEyesBlocks && !financeBlocks;
  out.approveBlockedReason = inv.status !== INVOICE_STATUS.SUBMITTED
    ? null
    : (fourEyesBlocks
      ? 'You created this invoice. A second person must approve it.'
      : (financeBlocks
        ? (out.financeSignOffStale
          ? 'The financial block changed after Finance signed it off. It needs signing again.'
          : 'Finance has not signed off the financial block yet.')
        : (out.submitCheck.blocking.length
          ? `${out.submitCheck.blocking.length} issue(s) must be resolved or acknowledged first.`
          : null)));

  /*
   * The submitter takes their own submission back (§16) — not the reviewer's
   * send-back. Closed once Finance has signed, because by then somebody has acted
   * on it and withdrawing that signature is its own recorded decision.
   */
  out.canRecall = inv.status === INVOICE_STATUS.SUBMITTED
    && (inv.submittedBy || inv.createdBy) === user
    && !out.financeSignOffValid;

  out.canRevise = [INVOICE_STATUS.APPROVED, INVOICE_STATUS.EXPORTED].includes(inv.status)
    && !inv.supersededByInvoiceId;
  out.canRegenerate = out.editable && pls.length > 0;
  return out;
};

// ─── Reads ──────────────────────────────────────────────────────────────────────

export const searchInvoices = async (params = {}) => {
  await delay();
  const db = loadDb();
  const rows = (db.invoices || [])
    .filter((i) => (!params.status || i.status === params.status))
    .filter((i) => (!params.buyerCode || i.buyerCode === params.buyerCode))
    .filter((i) => matchesText(i.invoiceNo, params.search)
      || matchesText(i.provisionalNo, params.search)
      || matchesText(i.buyerName, params.search)
      || matchesText(i.shipmentNo, params.search)
      || matchesText(i.reference, params.search))
    .map((i) => {
      const d = decorateInvoice(i, db);
      return {
        ...clone(i),
        totals: d.totals,
        plTotals: d.plTotals,
        isStale: d.isStale,
        plNos: d.packingLists.map((p) => p.plNo).join(', '),
      };
    })
    .sort((a, b) => b.id - a.id);
  return pageOf(rows, params);
};

export const getInvoice = async (id, options = {}) => {
  await delay(80);
  const db = loadDb();
  const row = (db.invoices || []).find((i) => i.id === Number(id));
  if (!row) fail('NOT_FOUND', `Invoice ${id} not found`);
  // V-13 is an "on open" rule, so opening is when it must be evaluated.
  return decorateInvoice(row, db, { phase: options.phase || PHASE.INVOICE_OPEN });
};

/**
 * Packing lists that may still be invoiced, each carrying the reason it cannot be
 * — the greyed-row-with-a-reason idiom the packing-list create modal already uses.
 */
export const listInvoiceablePls = async (params = {}) => {
  await delay();
  const db = loadDb();
  const rows = (db.packingLists || [])
    .filter((pl) => (!params.shipmentId || pl.shipmentId === Number(params.shipmentId)))
    .filter((pl) => (!params.buyerCode || pl.buyerCode === params.buyerCode))
    .map((pl) => {
      const commercial = getBuyerCommercial(pl);
      const existing = (db.invoices || []).filter((inv) => LIVE_INVOICE_STATUSES.includes(inv.status)
        && (inv.packingListRefs || []).some((r) => r.plId === pl.id));
      const decorated = decoratePl(pl, db);
      let reason = null;
      if (!INVOICEABLE_PL_STATUSES.includes(pl.status)) {
        reason = `Only an approved packing list can be invoiced (this one is ${pl.status.toLowerCase()}).`;
      } else if (existing.length && !commercial.allowMultiInvoicePerPl) {
        reason = `Already on ${existing.map((e) => e.invoiceNo || 'a draft invoice').join(', ')}.`;
      }
      return {
        id: pl.id,
        plNo: pl.plNo,
        status: pl.status,
        buyerCode: pl.buyerCode,
        buyerName: pl.buyerName,
        subClientCode: pl.subClientCode,
        shipmentId: pl.shipmentId,
        shipmentNo: pl.shipmentNo,
        totals: decorated.totals,
        cartonRangeLabel: decorated.cartonRangeLabel,
        contentHash: decorated.contentHash,
        eligible: !reason,
        reason,
      };
    })
    .sort((a, b) => b.id - a.id);
  return pageOf(rows, params);
};

// ─── Writes ─────────────────────────────────────────────────────────────────────

export const createInvoice = async (payload = {}) => {
  await delay();
  const db = loadDb();
  const ids = (payload.plIds || []).map(Number);
  if (!ids.length) fail('VALIDATION', 'Select at least one packing list.');

  const pls = ids.map((id) => {
    const pl = (db.packingLists || []).find((p) => p.id === id);
    if (!pl) fail('NOT_FOUND', `Packing list ${id} not found`);
    if (!INVOICEABLE_PL_STATUSES.includes(pl.status)) {
      fail('CONFLICT', `${pl.plNo} is ${pl.status.toLowerCase()} — only an approved packing list can be invoiced.`);
    }
    return decoratePl(pl, db);
  });

  // §8.1 allows several packing lists, but only of one shipment and one buyer —
  // otherwise the header's transport and consignee blocks would have to disagree.
  const shipmentIds = [...new Set(pls.map((p) => p.shipmentId))];
  if (shipmentIds.length > 1) fail('CONFLICT', 'All packing lists on one invoice must belong to the same shipment.');
  const buyerCodes = [...new Set(pls.map((p) => p.buyerCode))];
  if (buyerCodes.length > 1) fail('CONFLICT', 'All packing lists on one invoice must belong to the same buyer.');

  const first = pls[0];
  const commercial = getBuyerCommercial(first);
  const shipmentRaw = (db.shipments || []).find((s) => s.id === first.shipmentId) || null;
  const shipment = shipmentRaw ? decorateShipment(shipmentRaw, db) : null;

  const { template, matchedOn, isFallback } = resolveTemplate(db.templates || [], {
    buyerCode: first.buyerCode,
    subClientCode: first.subClientCode,
    docType: DOC_TYPE.INVOICE,
    onDate: todayStr(),
  });

  const fx = await getFxRate(todayStr(), commercial.currency || 'USD', 'INR');
  const extra = getExporterProfileExtra();

  const id = Math.max(0, ...(db.invoices || []).map((i) => i.id)) + 1;
  const record = {
    id,
    // BR-02: no number until approval, so the approved series stays gapless.
    invoiceNo: null,
    provisionalNo: `DRAFT-${String(id).padStart(4, '0')}`,
    revision: 0,
    supersedesInvoiceId: null,
    supersededByInvoiceId: null,
    status: INVOICE_STATUS.DRAFT,
    invoiceDate: payload.invoiceDate || todayStr(),

    buyerCode: first.buyerCode,
    buyerName: first.buyerName,
    subClientCode: first.subClientCode ?? null,
    shipmentId: first.shipmentId,
    shipmentNo: first.shipmentNo,

    packingListRefs: pls.map((pl) => ({
      plId: pl.id,
      plNo: pl.plNo,
      // contentHash, not version — an edit that changed nothing must not make the
      // invoice look stale (the split the packing list already draws).
      plContentHash: pl.contentHash,
      plVersion: pl.version,
    })),

    templateId: template?.id ?? null,
    templateVersion: template?.version ?? null,
    templateMatchedOn: matchedOn,
    templateIsFallback: isFallback,
    templateOverride: null,

    // Header (§8.2). Every value has a source; none is typed at create.
    exporterRef: extra?.iecNumber ? `IEC ${extra.iecNumber}` : null,
    buyerOrderNo: [...new Set(pls.flatMap((p) => p.orderNos || []))].join(', ') || null,
    buyerOrderDate: null,
    consignee: shipment?.consignee ?? null,
    notify: shipment?.notify ?? null,
    incoterm: shipment?.incoterm || commercial.incoterm || null,
    incotermPlace: shipment?.portOfLoading || null,
    paymentTerms: commercial.paymentTerms || null,
    countryOfOrigin: 'INDIA',
    countryOfFinalDestination: shipment?.countryOfFinalDestination ?? null,

    currency: commercial.currency || 'USD',
    fxRate: fx.rate || null,
    fxSource: fx.rate ? (fx.live ? 'MASTER_LIVE' : 'MASTER') : null,
    fxDate: fx.date || todayStr(),
    fxOverrideReason: null,
    igstRatePct: template?.igst?.defaultRatePct ?? 5,

    charges: {
      discount: {
        enabled: template?.charges?.discount?.enabled ?? true,
        mode: 'PERCENT',
        // Prénatal's standing 3% is a buyer term, not something a user should recall.
        value: Number(commercial.discountPercent) || 0,
      },
      freight: { enabled: template?.charges?.freight?.enabled ?? true, value: 0 },
      insurance: { enabled: template?.charges?.insurance?.enabled ?? true, value: 0 },
      other: { enabled: template?.charges?.other?.enabled ?? true, value: 0 },
    },
    totalsOverride: {},

    lines: generateLines(db, pls, template),
    annexes: generateAnnexes(db, pls, template),
    acknowledgements: [],
    approvalSnapshot: null,

    version: 0,
    createdAt: nowStamp(),
    createdBy: currentUserName(),
    updatedAt: nowStamp(),
    updatedBy: currentUserName(),
  };

  db.invoices = db.invoices || [];
  db.invoices.push(record);
  pushAudit(db, {
    entityType: 'EXPORT_INVOICE',
    entityId: id,
    entityNo: record.provisionalNo,
    action: 'Invoice created',
    details: `From ${pls.map((p) => p.plNo).join(', ')} · ${record.lines.length} line(s)`,
  });
  saveDb(db);
  return decorateInvoice(record, db, { phase: PHASE.INVOICE_CREATE });
};

const EDITABLE_FIELDS = [
  'invoiceDate', 'consignee', 'notify', 'incoterm', 'incotermPlace', 'paymentTerms',
  'buyerOrderNo', 'buyerOrderDate', 'countryOfFinalDestination', 'currency',
  'igstRatePct', 'charges', 'totalsOverride', 'reference', 'lines',
];

export const updateInvoice = async (id, payload = {}) => {
  await delay();
  const db = loadDb();
  const row = (db.invoices || []).find((i) => i.id === Number(id));
  if (!row) fail('NOT_FOUND', `Invoice ${id} not found`);
  if (row.status !== INVOICE_STATUS.DRAFT) fail('CONFLICT', 'Only a draft invoice can be edited.');
  if (payload.version !== undefined && payload.version !== row.version) failConflict('Invoice', row.invoiceNo || row.provisionalNo);

  const before = clone(row);
  EDITABLE_FIELDS.forEach((k) => {
    if (payload[k] !== undefined) row[k] = clone(payload[k]);
  });

  /*
   * §20: every edit is audited with its field-level before/after, and the master-data
   * overrides the PRD singles out — rate, HS code, addresses — are named individually.
   * Only the FX override was logged before, so exactly those overrides went unrecorded.
   */
  const changes = fieldDiff(before, row, EDITABLE_FIELDS, (k, a, b) => {
    if (k !== 'lines') return null;
    const byId = new Map((a || []).map((l) => [l.id, l]));
    const moved = (b || []).filter((l) => {
      const p0 = byId.get(l.id);
      return p0 && (Number(p0.rate) !== Number(l.rate) || p0.hsCode !== l.hsCode);
    });
    if (!moved.length) return `${(b || []).length} line(s) regenerated`;
    return moved.map((l) => {
      const p0 = byId.get(l.id);
      const bits = [];
      if (Number(p0.rate) !== Number(l.rate)) bits.push(`rate ${p0.rate} to ${l.rate}`);
      if (p0.hsCode !== l.hsCode) bits.push(`HS ${p0.hsCode || '—'} to ${l.hsCode || '—'}`);
      return `line ${l.seq}: ${bits.join(', ')}`;
    }).join('; ');
  });
  if (changes.length) {
    pushAudit(db, {
      entityType: 'EXPORT_INVOICE',
      entityId: row.id,
      entityNo: row.invoiceNo || row.provisionalNo,
      action: 'Invoice edited',
      details: describeChanges(changes),
      changes,
    });
  }

  // An FX override is auditable (BR-07), so it is handled apart from the plain fields.
  if (payload.fxRate !== undefined && Number(payload.fxRate) !== Number(row.fxRate)) {
    row.fxRate = Number(payload.fxRate) || null;
    row.fxSource = 'MANUAL';
    row.fxOverrideReason = payload.fxOverrideReason || null;
    pushAudit(db, {
      entityType: 'EXPORT_INVOICE',
      entityId: row.id,
      entityNo: row.invoiceNo || row.provisionalNo,
      action: 'Exchange rate overridden',
      details: `Rate set to ${row.fxRate}`,
      reason: row.fxOverrideReason,
    });
  }

  row.lines = (row.lines || []).map(recalcLine);
  row.version += 1;
  row.updatedAt = nowStamp();
  row.updatedBy = currentUserName();
  saveDb(db);
  return decorateInvoice(row, db);
};

/** V-13's remedy: rebuild the lines from the packing lists as they stand now. */
export const regenerateLines = async (id, options = {}) => {
  await delay();
  const db = loadDb();
  const row = (db.invoices || []).find((i) => i.id === Number(id));
  if (!row) fail('NOT_FOUND', `Invoice ${id} not found`);
  if (row.status !== INVOICE_STATUS.DRAFT) fail('CONFLICT', 'Only a draft invoice can be regenerated.');

  const pls = boundPls(db, row);
  const template = (db.templates || []).find((t) => t.id === row.templateId) || null;
  /*
   * Changing the grain is a template-override-level act (§8.3); the caller gates it.
   *
   * A groupBy belongs to the mode that declared it, so switching mode must drop it
   * unless the caller states a new one — otherwise the old mode's grouping silently
   * wins and "per size" quietly stays per style.
   */
  let effective = template;
  if (options.grain) {
    const base = template?.invoiceLineGrain || {};
    const modeChanged = options.grain.mode && options.grain.mode !== base.mode;
    const inherited = modeChanged && !options.grain.groupBy
      ? { ...base, groupBy: undefined }
      : base;
    effective = { ...template, invoiceLineGrain: { ...inherited, ...options.grain } };
  }

  const previous = row.lines || [];
  row.lines = generateLines(db, pls, effective);
  row.annexes = generateAnnexes(db, pls, effective);

  // A rate the user deliberately overrode is worth more than a regenerated default,
  // so it is carried across when the same line comes back.
  if (options.keepRateOverrides !== false) {
    const byKey = new Map(previous.filter((l) => l.rate !== l.orderRate).map((l) => [l.key, l]));
    row.lines = row.lines.map((l) => (byKey.has(l.key)
      ? recalcLine({ ...l, rate: byKey.get(l.key).rate, rateOverridden: true })
      : l));
  }

  if (options.grain) {
    row.grainOverride = { ...options.grain, reason: options.reason || null, by: currentUserName(), at: nowStamp() };
  }
  row.packingListRefs = pls.map((pl) => ({
    plId: pl.id, plNo: pl.plNo, plContentHash: pl.contentHash, plVersion: pl.version,
  }));
  row.version += 1;
  row.updatedAt = nowStamp();
  row.updatedBy = currentUserName();
  pushAudit(db, {
    entityType: 'EXPORT_INVOICE',
    entityId: row.id,
    entityNo: row.invoiceNo || row.provisionalNo,
    action: options.grain ? 'Line grain changed' : 'Lines regenerated from packing list',
    details: `${row.lines.length} line(s)`,
    reason: options.reason || null,
  });
  saveDb(db);
  return decorateInvoice(row, db);
};

export const acknowledgeInvoiceWarning = async (id, targetKey, reason) => {
  await delay(120);
  const db = loadDb();
  const row = (db.invoices || []).find((i) => i.id === Number(id));
  if (!row) fail('NOT_FOUND', `Invoice ${id} not found`);
  if (!reason || String(reason).trim().length < 10) fail('VALIDATION', 'A reason of at least 10 characters is required.');

  const decorated = decorateInvoice(row, db, { phase: PHASE.INVOICE_APPROVE });
  const item = decorated.panelFindings.findings.find((f) => f.targetKey === targetKey);
  if (!item) fail('NOT_FOUND', 'That warning is no longer raised.');

  const ack = buildAcknowledgement(item, String(reason).trim(), currentUserName(), nowStamp());
  row.acknowledgements = (row.acknowledgements || []).filter((a) => !acknowledgementApplies(a, item));
  row.acknowledgements.push(ack);
  row.version += 1;
  row.updatedAt = nowStamp();
  pushAudit(db, {
    entityType: 'EXPORT_INVOICE',
    entityId: row.id,
    entityNo: row.invoiceNo || row.provisionalNo,
    action: `Warning acknowledged (${item.code})`,
    details: item.message,
    reason: ack.reason,
  });
  saveDb(db);
  return decorateInvoice(row, db);
};

/** Release the invoice's files (§16 Approved -> Exported, §20 "export" event). */
export const markInvoiceExported = async (id, options = {}) => {
  await delay();
  const db = loadDb();
  const row = (db.invoices || []).find((i) => i.id === Number(id));
  if (!row) fail('NOT_FOUND', `Invoice ${id} not found`);
  if (!(INVOICE_TRANSITIONS[row.status] || []).includes(INVOICE_STATUS.EXPORTED)) {
    fail('CONFLICT', `A ${row.status.toLowerCase()} invoice cannot be released.`);
  }
  row.status = INVOICE_STATUS.EXPORTED;
  row.exportedAt = nowStamp();
  row.exportedBy = currentUserName();
  row.version += 1;
  pushAudit(db, {
    entityType: 'EXPORT_INVOICE', entityId: row.id, entityNo: row.invoiceNo,
    action: 'Documents released (Exported)',
    details: options.detail || 'Printed and released to the buyer / customs broker.',
  });
  raise(db, {
    type: NOTIF.DOC_RELEASED,
    title: `${row.invoiceNo} released`,
    body: `Released by ${row.exportedBy} for ${row.buyerName || 'the buyer'}.`,
    actionUrl: `/export-docs/invoices/edit/${row.id}`,
    entityType: 'EXPORT_INVOICE', entityId: row.id, entityNo: row.invoiceNo,
  });
  syncShipmentStatus(db, row.shipmentId);
  saveDb(db);
  return decorateInvoice(row, db);
};

export const changeInvoiceStatus = async (id, next, options = {}) => {
  await delay();
  const db = loadDb();
  const row = (db.invoices || []).find((i) => i.id === Number(id));
  if (!row) fail('NOT_FOUND', `Invoice ${id} not found`);
  if (!(INVOICE_TRANSITIONS[row.status] || []).includes(next)) {
    fail('CONFLICT', `An invoice cannot move from ${row.status} to ${next}.`);
  }

  const decorated = decorateInvoice(row, db, { phase: PHASE.INVOICE_APPROVE });
  const cfg = { ...DEFAULT_TENANT_CONFIG, ...(db.masters?.tenantConfig || {}) };

  if (next === INVOICE_STATUS.SUBMITTED && decorated.submitCheck.errors.length) {
    fail('CONFLICT', decorated.submitCheck.errors[0].message);
  }

  if (next === INVOICE_STATUS.APPROVED) {
    if (decorated.submitCheck.blocking.length) fail('CONFLICT', decorated.submitCheck.blocking[0].message);
    // BR-11. Deliberately NOT bypassable through an option: a flag the caller can
    // set is not a control. The API phase must re-enforce this server-side, since
    // everything here runs in the browser.
    if (cfg.fourEyesEnabled && row.createdBy === currentUserName()) {
      fail('CONFLICT', 'You created this invoice. A second person must approve it.');
    }
    // §16: the optional second approval. Enforced here rather than only surfaced,
    // because a gate the service does not hold is a label, not a control.
    if (cfg.financeApprovalRequired === true && !decorated.financeSignOffValid) {
      fail('CONFLICT', decorated.financeSignOffStale
        ? 'The financial block changed after Finance signed it off. It must be signed again before approval.'
        : 'Finance has not signed off the financial block. It cannot be approved yet.');
    }
    /*
     * BR-02 / §24: the series of the APPROVAL date applies, which is why the number
     * is allocated here and not at create — a March draft approved in April belongs
     * to the new financial year.
     *
     * A REVISION already carries its number with an -R suffix (§17), and allocating
     * again would both discard that number and burn one from a series documented as
     * gapless. So a number is taken only when there is not one already.
     */
    if (!row.invoiceNo) row.invoiceNo = nextInvoiceNo(db);
    // §8.1 makes the date editable before approval, so a date the user set is kept;
    // approval only fills one in when nobody did.
    row.invoiceDate = options.invoiceDate || row.invoiceDate || todayStr();
    // BR-08: the document is frozen, and every later print renders from this.
    row.approvalSnapshot = {
      at: nowStamp(),
      by: currentUserName(),
      templateId: row.templateId,
      templateVersion: row.templateVersion,
      payload: clone({
        lines: decorated.lines,
        annexes: decorated.annexes,
        totals: decorated.totals,
        igst: decorated.igst,
        plTotals: decorated.plTotals,
        marksAndNos: decorated.marksAndNos,
        consignee: row.consignee,
        notify: row.notify,
        charges: row.charges,
        fxRate: row.fxRate,
        currency: row.currency,
      }),
    };
  }

  if (next === INVOICE_STATUS.CANCELLED) {
    if (!options.reason) fail('VALIDATION', 'Cancelling an invoice needs a reason.');
    row.cancelReason = options.reason;
    // §8.1: a cancelled invoice keeps its number. Nothing reuses it.
  }

  if (next === INVOICE_STATUS.SUBMITTED) {
    row.submittedBy = currentUserName();
    row.submittedAt = nowStamp();
  }

  const from = row.status;
  row.status = next;
  row.version += 1;
  row.updatedAt = nowStamp();
  row.updatedBy = currentUserName();
  pushAudit(db, {
    entityType: 'EXPORT_INVOICE',
    entityId: row.id,
    entityNo: row.invoiceNo || row.provisionalNo,
    action: `Status ${from} to ${next}`,
    details: next === INVOICE_STATUS.APPROVED ? `Number allocated: ${row.invoiceNo}` : null,
    reason: options.reason || null,
  });

  // §23: the invoice's own events. Submission goes to Finance, because the
  // financial block is what they are being asked to look at.
  const NOTE = {
    [INVOICE_STATUS.SUBMITTED]: {
      type: NOTIF.INVOICE_SUBMITTED,
      title: `${row.provisionalNo || row.invoiceNo} is waiting for approval`,
      body: `${currentUserName()} submitted ${decorated.currency} ${Number(decorated.totals?.netTotal || 0).toFixed(2)} for ${row.buyerName || 'this buyer'}.`,
    },
    [INVOICE_STATUS.APPROVED]: {
      type: NOTIF.INVOICE_APPROVED,
      title: `${row.invoiceNo} approved`,
      body: `Number allocated on approval. ${row.buyerName || ''}`.trim(),
    },
    [INVOICE_STATUS.DRAFT]: {
      type: NOTIF.INVOICE_SENT_BACK,
      title: `${row.provisionalNo || row.invoiceNo} was sent back`,
      body: options.reason || 'Returned to draft for changes.',
    },
  }[next];
  if (NOTE) {
    raise(db, {
      ...NOTE,
      actionUrl: `/export-docs/invoices/edit/${row.id}`,
      entityType: 'EXPORT_INVOICE', entityId: row.id, entityNo: row.invoiceNo || row.provisionalNo,
    });
  }

  saveDb(db);
  return decorateInvoice(row, db);
};

/**
 * §17: revise an approved invoice.
 *
 * The default keeps the number and adds an R-suffix, so the approved series stays
 * gapless (BR-02) and the buyer keeps referencing the number they already have. The
 * old row becomes SUPERSEDED and stays viewable.
 */
export const reviseInvoice = async (id, reason) => {
  await delay();
  const db = loadDb();
  const row = (db.invoices || []).find((i) => i.id === Number(id));
  if (!row) fail('NOT_FOUND', `Invoice ${id} not found`);
  if (![INVOICE_STATUS.APPROVED, INVOICE_STATUS.EXPORTED].includes(row.status)) {
    fail('CONFLICT', 'Only an approved invoice can be revised.');
  }
  if (!reason || String(reason).trim().length < 10) fail('VALIDATION', 'A revision reason of at least 10 characters is required.');

  const cfg = { ...DEFAULT_TENANT_CONFIG, ...(db.masters?.tenantConfig || {}) };
  const revision = (row.revision || 0) + 1;
  const newId = Math.max(0, ...db.invoices.map((i) => i.id)) + 1;

  const base = clone(row);
  const next = {
    ...base,
    id: newId,
    revision,
    // SUFFIX keeps the buyer-facing number; the alternative the PRD allows is a
    // cancel-and-reissue, which would burn a number from the gapless series.
    invoiceNo: cfg.invoiceRevisionMode === 'SUFFIX'
      ? `${String(row.invoiceNo).replace(/-R\d+$/, '')}-R${revision}`
      : null,
    status: INVOICE_STATUS.DRAFT,
    supersedesInvoiceId: row.id,
    supersededByInvoiceId: null,
    approvalSnapshot: null,
    reviseReason: String(reason).trim(),
    version: 0,
    createdAt: nowStamp(),
    createdBy: currentUserName(),
    updatedAt: nowStamp(),
    updatedBy: currentUserName(),
  };

  row.status = INVOICE_STATUS.SUPERSEDED;
  row.supersededByInvoiceId = newId;
  row.version += 1;
  db.invoices.push(next);
  pushAudit(db, {
    entityType: 'EXPORT_INVOICE',
    entityId: newId,
    entityNo: next.invoiceNo || next.provisionalNo,
    action: `Revision ${revision} created`,
    details: `Supersedes ${row.invoiceNo}`,
    reason: next.reviseReason,
  });
  saveDb(db);
  return decorateInvoice(next, db);
};

export const deleteInvoice = async (id) => {
  await delay();
  const db = loadDb();
  const row = (db.invoices || []).find((i) => i.id === Number(id));
  if (!row) fail('NOT_FOUND', `Invoice ${id} not found`);
  if (row.status !== INVOICE_STATUS.DRAFT) fail('CONFLICT', 'Only a draft invoice can be deleted.');
  db.invoices = db.invoices.filter((i) => i.id !== row.id);
  pushAudit(db, {
    entityType: 'EXPORT_INVOICE',
    entityId: row.id,
    entityNo: row.provisionalNo,
    action: 'Draft invoice deleted',
  });
  saveDb(db);
  return { id: row.id };
};

/**
 * Finance signs off the financial block (§16 / BR-11).
 *
 * Not a status of its own: a second signature ON the figures, stored with the
 * figures it saw. Re-rating a line afterwards leaves the signature stale rather
 * than silently valid, and approval is refused until it is signed again.
 */
export const signOffInvoiceFinancials = async (id, options = {}) => {
  await delay();
  const db = loadDb();
  const row = (db.invoices || []).find((i) => i.id === Number(id));
  if (!row) fail('NOT_FOUND', `Invoice ${id} not found`);
  const cfg = { ...DEFAULT_TENANT_CONFIG, ...(db.masters?.tenantConfig || {}) };
  if (cfg.financeApprovalRequired !== true) {
    fail('CONFLICT', 'Finance sign-off is not enabled for this tenant.');
  }
  if (row.status !== INVOICE_STATUS.SUBMITTED) {
    fail('CONFLICT', 'Only a submitted invoice can have its financial block signed off.');
  }
  if (options.version != null && Number(options.version) !== Number(row.version)) {
    failConflict(row.invoiceNo || row.provisionalNo, options.version, row.version);
  }
  if (!isFinanceUser(cfg)) {
    fail('CONFLICT', `Signing off the financial block needs one of these roles: ${(cfg.financeRoles || []).join(', ')}.`);
  }
  const user = currentUserName();
  if (cfg.fourEyesEnabled && row.createdBy === user) {
    fail('CONFLICT', 'You raised these figures. A second person must sign them off.');
  }

  const decorated = decorateInvoice(row, db);
  row.financeSignOff = {
    by: user,
    at: nowStamp(),
    note: options.note ? String(options.note).trim() : null,
    figures: decorated.financeFigures,
  };
  row.version += 1;
  pushAudit(db, {
    entityType: 'EXPORT_INVOICE', entityId: row.id, entityNo: row.invoiceNo || row.provisionalNo,
    action: 'Financial block signed off by Finance',
    details: `${decorated.currency} ${Number(decorated.totals?.netTotal || 0).toFixed(2)} at FX ${decorated.fxRate}`,
    reason: row.financeSignOff.note,
  });
  saveDb(db);
  return decorateInvoice(row, db);
};

/** Withdraw a sign-off — the signer changed their mind before approval. */
export const withdrawFinanceSignOff = async (id, reason) => {
  await delay();
  const db = loadDb();
  const row = (db.invoices || []).find((i) => i.id === Number(id));
  if (!row) fail('NOT_FOUND', `Invoice ${id} not found`);
  if (!row.financeSignOff) fail('CONFLICT', 'This invoice has no Finance sign-off.');
  if (row.status !== INVOICE_STATUS.SUBMITTED) {
    fail('CONFLICT', 'A sign-off can only be withdrawn while the invoice is awaiting approval.');
  }
  if (!reason || String(reason).trim().length < 10) {
    fail('VALIDATION', 'Withdrawing a sign-off needs a reason of at least 10 characters.');
  }
  const was = row.financeSignOff;
  row.financeSignOff = null;
  row.version += 1;
  pushAudit(db, {
    entityType: 'EXPORT_INVOICE', entityId: row.id, entityNo: row.invoiceNo || row.provisionalNo,
    action: 'Finance sign-off withdrawn',
    details: `Signed by ${was.by} on ${was.at}`,
    reason: String(reason).trim(),
  });
  saveDb(db);
  return decorateInvoice(row, db);
};

/** The submitter takes their own invoice back before anyone has acted on it (§16). */
export const recallInvoice = async (id, reason) => {
  await delay();
  const db = loadDb();
  const row = (db.invoices || []).find((i) => i.id === Number(id));
  if (!row) fail('NOT_FOUND', `Invoice ${id} not found`);
  if (row.status !== INVOICE_STATUS.SUBMITTED) {
    fail('CONFLICT', 'Only an invoice awaiting approval can be recalled.');
  }
  const user = currentUserName();
  if ((row.submittedBy || row.createdBy) !== user) {
    fail('CONFLICT', `Only ${row.submittedBy || row.createdBy} can recall this submission. An approver can send it back instead.`);
  }
  if (decorateInvoice(row, db).financeSignOffValid) {
    fail('CONFLICT', 'Finance has already signed off these figures. Ask them to withdraw the sign-off first.');
  }
  row.status = INVOICE_STATUS.DRAFT;
  row.submittedBy = null;
  row.submittedAt = null;
  row.version += 1;
  row.updatedAt = nowStamp();
  row.updatedBy = user;
  pushAudit(db, {
    entityType: 'EXPORT_INVOICE', entityId: row.id, entityNo: row.invoiceNo || row.provisionalNo,
    action: 'Submission recalled by its author',
    reason: reason ? String(reason).trim() : null,
  });
  saveDb(db);
  return decorateInvoice(row, db);
};
