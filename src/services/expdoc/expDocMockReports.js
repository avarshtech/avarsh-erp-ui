/**
 * Export Documentation reports and audit trail (PRD §20, §22).
 *
 * Every report reads the same records the screens read, so a report can never state
 * a figure the document itself does not — which is the point of BR-01 carried one
 * step further.
 *
 * The carton master list is the one report that is genuinely per-carton, and carton
 * counts have no ceiling. It expands ONLY the requested page rather than materialising
 * a shipment and slicing it, so the cost of page 900 is the same as page 1.
 */
import { loadDb } from './expDocMockStore';
import { delay, clone, pageOf, matchesText, colourKey } from './expDocMockCommon';
import { PL_STATUS, DOC_TYPE, TEMPLATE_STATUS } from '../../utils/expDocConstants';
import {
  cartonCount, toRanges, countCartons, formatRanges, expandCartonNos, mergeRanges,
  intersectRanges, sizeQtyPerCarton, round,
} from '../../utils/expDocCalc';
import { decoratePl } from './expDocMockPackingLists';
import { decorateInvoice } from './expDocMockInvoices';
import { resolveTemplate } from '../../utils/expDocTemplateSchema';

const LIVE_PL = [PL_STATUS.DRAFT, PL_STATUS.SUBMITTED, PL_STATUS.APPROVED, PL_STATUS.EXPORTED];
const SHIPPED_PL = [PL_STATUS.APPROVED, PL_STATUS.EXPORTED];
const allRows = (pl) => (pl?.sections || []).flatMap((s) => s.rows || []);

const num = (v) => Number(v) || 0;

// ─── 1. Packing status (§22) ────────────────────────────────────────────────────

/**
 * Ordered vs packed vs shipped per style / colour / size, across every packing list.
 *
 * "Packed" counts every live document; "shipped" only those approved or beyond —
 * the distinction matters because a draft can still change, and reporting a draft as
 * shipped is how a short-ship goes unnoticed until the buyer counts the cartons.
 */
export const packingStatusReport = async (params = {}) => {
  await delay();
  const db = loadDb();
  const rows = new Map();

  const key = (styleNo, colour, size) =>
    `${String(styleNo ?? '').toLowerCase()}||${colourKey(colour)}||${String(size ?? '').trim()}`;

  const touch = (orderNo, styleNo, colorName, size) => {
    const k = `${orderNo}||${key(styleNo, colorName, size)}`;
    if (!rows.has(k)) {
      rows.set(k, {
        id: k, orderNo, styleNo, colorName, size, orderQty: 0, packedQty: 0, shippedQty: 0,
      });
    }
    return rows.get(k);
  };

  // Ordered comes from the packing entry's snapshot of the order (PRD §7.4: never
  // from packed data).
  (db.packingEntries || []).forEach((entry) => {
    (entry.orderBreakdown || []).forEach((l) => {
      touch(entry.orderNo, l.styleNo, l.colorName, l.size).orderQty += num(l.orderQty);
    });
  });

  const entryById = new Map((db.packingEntries || []).map((e) => [e.id, e]));
  (db.packingLists || [])
    .filter((pl) => LIVE_PL.includes(pl.status))
    .forEach((pl) => {
      const shipped = SHIPPED_PL.includes(pl.status);
      allRows(pl).forEach((row) => {
        const orderNo = entryById.get(row.sourceEntryId)?.orderNo ?? null;
        const count = cartonCount(row);
        const add = (colour, size, perCarton) => {
          const r = touch(orderNo, row.styleNo, colour, size);
          r.packedQty += num(perCarton) * count;
          if (shipped) r.shippedQty += num(perCarton) * count;
        };
        if (row.mixedRows?.length) {
          row.mixedRows.forEach((mr) => Object.entries(mr.sizeQty || {})
            .forEach(([size, q]) => add(mr.colorName, size, q)));
          return;
        }
        Object.entries(sizeQtyPerCarton(row)).forEach(([size, q]) => add(row.colorName, size, q));
      });
    });

  const out = [...rows.values()]
    .map((r) => ({
      ...r,
      balance: r.orderQty - r.shippedQty,
      completionPct: r.orderQty ? round((r.shippedQty / r.orderQty) * 100, 1) : null,
    }))
    .filter((r) => matchesText(r.orderNo, params.search)
      || matchesText(r.styleNo, params.search)
      || matchesText(r.colorName, params.search))
    .filter((r) => (!params.orderNo || r.orderNo === params.orderNo))
    .sort((a, b) => String(a.orderNo).localeCompare(String(b.orderNo))
      || String(a.styleNo).localeCompare(String(b.styleNo))
      || String(a.colorName).localeCompare(String(b.colorName)));

  return pageOf(out, params);
};

// ─── 2. Shipment document register (§22) ────────────────────────────────────────

export const shipmentRegisterReport = async (params = {}) => {
  await delay();
  const db = loadDb();
  const shipmentById = new Map((db.shipments || []).map((s) => [s.id, s]));
  const out = [];

  (db.packingLists || []).forEach((pl) => out.push({
    id: `PL-${pl.id}`,
    shipmentNo: pl.shipmentNo,
    shipmentId: pl.shipmentId,
    buyerName: pl.buyerName,
    docType: DOC_TYPE.PACKING_LIST,
    docNo: pl.plNo,
    revision: pl.revision || 0,
    status: pl.status,
    templateVersion: pl.templateVersion,
    createdBy: pl.createdBy,
    updatedAt: pl.updatedAt,
    approvedAt: pl.approvalSnapshot?.at || null,
    approvedBy: pl.approvalSnapshot?.by || null,
    exportedAt: pl.exportedAt || null,
    exportedBy: pl.exportedBy || null,
  }));

  (db.invoices || []).forEach((inv) => out.push({
    id: `INV-${inv.id}`,
    shipmentNo: inv.shipmentNo,
    shipmentId: inv.shipmentId,
    buyerName: inv.buyerName,
    docType: DOC_TYPE.INVOICE,
    docNo: inv.invoiceNo || inv.provisionalNo,
    revision: inv.revision || 0,
    status: inv.status,
    templateVersion: inv.templateVersion,
    createdBy: inv.createdBy,
    updatedAt: inv.updatedAt,
    approvedAt: inv.approvalSnapshot?.at || null,
    approvedBy: inv.approvalSnapshot?.by || null,
    exportedAt: inv.exportedAt || null,
    exportedBy: inv.exportedBy || null,
  }));

  const plById = new Map((db.packingLists || []).map((p) => [p.id, p]));
  (db.stickerRuns || []).forEach((run) => {
    const pl = plById.get(run.plId);
    out.push({
      id: `STK-${run.id}`,
      shipmentNo: pl?.shipmentNo ?? null,
      shipmentId: pl?.shipmentId ?? null,
      buyerName: pl?.buyerName ?? null,
      docType: DOC_TYPE.STICKER,
      docNo: run.runNo,
      revision: 0,
      status: run.isReprint ? 'REPRINT' : 'PRINTED',
      templateVersion: run.templateVersion,
      createdBy: run.generatedBy,
      updatedAt: run.generatedAt,
      approvedAt: null,
      approvedBy: null,
      // A sticker run IS its own release: generating it is the export event.
      exportedAt: run.generatedAt,
      exportedBy: run.generatedBy,
      detail: `${formatRanges(run.prints || [])} · ${run.labelCount} label(s)`,
    });
  });

  const rows = out
    .filter((r) => (!params.shipmentId || r.shipmentId === Number(params.shipmentId)))
    .filter((r) => (!params.docType || r.docType === params.docType))
    .filter((r) => matchesText(r.docNo, params.search)
      || matchesText(r.shipmentNo, params.search)
      || matchesText(r.buyerName, params.search))
    .map((r) => ({ ...r, mode: shipmentById.get(r.shipmentId)?.mode ?? null }))
    .sort((a, b) => String(b.shipmentNo).localeCompare(String(a.shipmentNo))
      || String(a.docType).localeCompare(String(b.docType))
      || String(a.docNo).localeCompare(String(b.docNo)));

  return pageOf(rows, params);
};

// ─── 3. Invoice register, FY (§22) ──────────────────────────────────────────────

/**
 * The approved series, in number order, with any gap called out.
 *
 * A gap is what a GST reconciliation actually looks for, so it is computed here
 * rather than left for a human to spot in a list of four hundred numbers.
 */
export const invoiceRegisterReport = async (params = {}) => {
  await delay();
  const db = loadDb();
  const numbered = (db.invoices || [])
    .filter((i) => i.invoiceNo)
    .map((i) => {
      const d = decorateInvoice(i, db);
      const parts = String(i.invoiceNo).split('/');
      const seq = Number(String(parts[parts.length - 1]).replace(/-R\d+$/, ''));
      return {
        id: i.id,
        invoiceNo: i.invoiceNo,
        seq: Number.isFinite(seq) ? seq : null,
        fy: parts.length >= 2 ? parts[parts.length - 2] : null,
        invoiceDate: i.invoiceDate,
        buyerName: i.buyerName,
        currency: i.currency,
        value: d.totals?.netTotal ?? null,
        fxRate: i.fxRate,
        fxSource: i.fxSource,
        inrValue: d.igst?.taxableInr ?? null,
        igstValue: d.igst?.igstValue ?? null,
        status: i.status,
        revision: i.revision || 0,
      };
    })
    .filter((r) => (!params.fy || r.fy === params.fy))
    .filter((r) => matchesText(r.invoiceNo, params.search) || matchesText(r.buyerName, params.search))
    .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));

  // Gaps are reported per financial year, because the series restarts each year.
  const byFy = new Map();
  numbered.forEach((r) => {
    if (!r.fy || r.seq === null) return;
    byFy.set(r.fy, [...(byFy.get(r.fy) || []), r.seq]);
  });
  const gaps = [];
  byFy.forEach((seqs, fy) => {
    const sorted = [...new Set(seqs)].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i] !== sorted[i - 1] + 1) {
        gaps.push({ fy, after: sorted[i - 1], before: sorted[i], missing: sorted[i] - sorted[i - 1] - 1 });
      }
    }
  });

  const page = pageOf(numbered, params);
  return { ...page, gaps, seriesIsGapless: gaps.length === 0 };
};

// ─── 4. Excess / shortage (§22) ─────────────────────────────────────────────────

export const varianceReport = async (params = {}) => {
  await delay();
  const db = loadDb();
  const out = [];

  (db.packingLists || [])
    .filter((pl) => LIVE_PL.includes(pl.status))
    .forEach((raw) => {
      const pl = decoratePl(raw, db);
      (pl.orderVsPacked || [])
        .filter((v) => v.status !== 'MATCH')
        .forEach((v) => {
          /*
           * The acknowledgement that justified this exact variance, matched on the
           * finding's TARGET, not on its values — V-05 stores only the quantities,
           * so matching on style/colour/size would never find anything. The target id
           * is the same string the rule built, and the suffix match covers both V-05
           * (outside tolerance) and V-09 (not on the order) without guessing which
           * rule raised it.
           */
          const targetId = `LINE:${v.styleNo}|${v.colorName}|${v.size}`;
          const ack = (raw.acknowledgements || []).find(
            (a) => String(a.targetKey || '').endsWith(targetId),
          );
          out.push({
            id: `${pl.id}-${v.styleNo}-${v.colorName}-${v.size}`,
            plNo: pl.plNo,
            plStatus: pl.status,
            shipmentNo: pl.shipmentNo,
            buyerName: pl.buyerName,
            styleNo: v.styleNo,
            colorName: v.colorName,
            size: v.size,
            orderQty: v.orderQty,
            shippedQty: v.shippedQty,
            variance: v.variance,
            variancePercent: v.variancePercent,
            status: v.status,
            withinTolerance: v.withinTolerance,
            tolerancePercent: pl.tolerancePercent,
            reason: ack?.reason || null,
            acknowledgedBy: ack?.user || null,
          });
        });
    });

  const rows = out
    .filter((r) => (!params.status || r.status === params.status))
    .filter((r) => (params.outsideToleranceOnly ? !r.withinTolerance : true))
    .filter((r) => matchesText(r.plNo, params.search)
      || matchesText(r.styleNo, params.search)
      || matchesText(r.buyerName, params.search))
    .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));

  return pageOf(rows, params);
};

// ─── 5. Carton master list (§22) ────────────────────────────────────────────────

/**
 * Every carton of a shipment, one row each.
 *
 * The only report whose row count follows the carton count, which has no ceiling —
 * so only the requested PAGE is expanded. `expandCartonRange` walks the ranges to the
 * requested window; page 900 costs what page 1 costs.
 */
export const cartonMasterReport = async (params = {}) => {
  await delay();
  const db = loadDb();
  const shipmentId = Number(params.shipmentId);
  if (!shipmentId) return { ...pageOf([], params), shipmentNo: null };

  const pls = (db.packingLists || [])
    .filter((pl) => pl.shipmentId === shipmentId && LIVE_PL.includes(pl.status));
  if (!pls.length) return { ...pageOf([], params), shipmentNo: null };

  const rows = pls.flatMap((pl) => allRows(pl).map((r) => ({ ...r, __plNo: pl.plNo, __plId: pl.id })));
  // A built carton carries `sourceRowId`, not the row itself, so the packing list a
  // carton belongs to is looked up rather than read off the carton.
  const plNoByRowId = new Map(rows.map((r) => [r.id, r.__plNo]));
  const ranges = mergeRanges(toRanges(rows));
  const total = countCartons(ranges);

  const size = Number(params.size ?? 25);
  const page = Number(params.page ?? 0);
  const startOrdinal = page * size;

  /*
   * Walk the merged ranges to collect exactly this page's carton NUMBERS, skipping
   * the ranges that fall entirely before it. Numbers rather than a from–to window,
   * because the ranges can have gaps: a page may legitimately span 47–48 and 60–81,
   * and a window would either expand the gap or return short.
   *
   * Cost is O(ranges + pageSize) — page 900 costs what page 1 costs.
   */
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
  const cartons = expandCartonNos(rows, cartonNos, { totalCartonsInShipment: total });

  // Print counts come from the stored ranges, intersected — never a per-carton map.
  const runs = (db.stickerRuns || []).filter((run) => pls.some((pl) => pl.id === run.plId));
  const content = cartons.map((c) => {
    const printed = runs.reduce((n, run) => n
      + (intersectRanges(run.prints || [], [{ from: c.cartonNo, to: c.cartonNo }]).length ? 1 : 0), 0);
    return {
      id: `${shipmentId}-${c.cartonNo}`,
      cartonNo: c.cartonNo,
      ofTotal: c.total,
      plNo: plNoByRowId.get(c.sourceRowId) ?? null,
      styleNo: c.styleNo,
      colorName: c.colorName,
      packingType: c.packingType,
      pieces: c.piecesPerCarton,
      netWeightKg: c.netWeightKg,
      grossWeightKg: c.grossWeightKg,
      dimensions: c.dimensions,
      cbm: c.cbm,
      printCount: printed,
    };
  });

  return {
    content,
    totalElements: total,
    totalPages: Math.max(1, Math.ceil(total / size)),
    size,
    number: page,
    shipmentNo: pls[0].shipmentNo,
    cartonRangeLabel: formatRanges(ranges),
  };
};

// ─── 6. Template usage and coverage (§22) ───────────────────────────────────────

export const templateCoverageReport = async (params = {}) => {
  await delay();
  const db = loadDb();
  const out = [];

  /*
   * Every buyer the system knows about, from EITHER source: a buyer can have
   * templates without a commercial profile, and reading only the profiles is how a
   * buyer's coverage gap stays invisible in the very report meant to surface it.
   */
  const byCode = new Map();
  (db.masters?.buyerCommercial || []).forEach((b) => byCode.set(b.buyerCode, b));
  (db.templates || []).forEach((t) => {
    if (t.buyerCode && !byCode.has(t.buyerCode)) {
      byCode.set(t.buyerCode, { buyerCode: t.buyerCode, buyerName: t.buyerCode });
    }
  });
  const buyers = [...byCode.values()];

  buyers.forEach((b) => {
    Object.values(DOC_TYPE).forEach((docType) => {
      const { template, matchedOn, isFallback } = resolveTemplate(db.templates || [], {
        buyerCode: b.buyerCode, docType,
      });
      out.push({
        id: `${b.buyerCode}-${docType}`,
        buyerCode: b.buyerCode,
        buyerName: b.buyerName,
        docType,
        templateCode: template?.templateCode ?? null,
        version: template?.version ?? null,
        matchedOn,
        usingGeneric: isFallback,
        covered: Boolean(template) && !isFallback,
      });
    });
  });

  // Documents whose template was overridden away from the resolved default (§10.2).
  const overrides = [
    ...(db.packingLists || []).filter((d) => d.templateOverride).map((d) => ({
      docNo: d.plNo, docType: DOC_TYPE.PACKING_LIST, ...d.templateOverride,
    })),
    ...(db.invoices || []).filter((d) => d.templateOverride).map((d) => ({
      docNo: d.invoiceNo || d.provisionalNo, docType: DOC_TYPE.INVOICE, ...d.templateOverride,
    })),
  ];

  const rows = out
    .filter((r) => (params.gapsOnly ? !r.covered : true))
    .filter((r) => matchesText(r.buyerName, params.search) || matchesText(r.templateCode, params.search))
    .sort((a, b) => Number(a.covered) - Number(b.covered)
      || String(a.buyerCode).localeCompare(String(b.buyerCode)));

  const activeCount = (db.templates || []).filter((t) => t.status === TEMPLATE_STATUS.ACTIVE).length;
  return { ...pageOf(rows, params), overrides, activeTemplates: activeCount };
};

// ─── 7. Productivity (§22) ──────────────────────────────────────────────────────

/** Hours between two "YYYY-MM-DD HH:mm" stamps; null when either is missing. */
const hoursBetween = (a, b) => {
  if (!a || !b) return null;
  const parse = (s) => {
    const m = String(s).match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    if (!m) return null;
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  };
  const from = parse(a);
  const to = parse(b);
  if (from === null || to === null || to < from) return null;
  return round((to - from) / 3600000, 2);
};

export const productivityReport = async (params = {}) => {
  await delay();
  const db = loadDb();
  const byUser = new Map();
  const touch = (user) => {
    const u = user || 'Unknown';
    if (!byUser.has(u)) {
      byUser.set(u, {
        id: u, user: u, packingLists: 0, invoices: 0, stickerRuns: 0,
        approvals: 0, acknowledgements: 0, __hours: [],
      });
    }
    return byUser.get(u);
  };

  (db.packingLists || []).forEach((pl) => {
    const r = touch(pl.createdBy);
    r.packingLists += 1;
    r.acknowledgements += (pl.acknowledgements || []).length;
    const h = hoursBetween(pl.createdAt, pl.approvalSnapshot?.at);
    if (h !== null) r.__hours.push(h);
    if (pl.approvalSnapshot?.by) touch(pl.approvalSnapshot.by).approvals += 1;
  });
  (db.invoices || []).forEach((inv) => {
    const r = touch(inv.createdBy);
    r.invoices += 1;
    r.acknowledgements += (inv.acknowledgements || []).length;
    const h = hoursBetween(inv.createdAt, inv.approvalSnapshot?.at);
    if (h !== null) r.__hours.push(h);
    if (inv.approvalSnapshot?.by) touch(inv.approvalSnapshot.by).approvals += 1;
  });
  (db.stickerRuns || []).forEach((run) => { touch(run.generatedBy).stickerRuns += 1; });

  const rows = [...byUser.values()]
    .map((r) => {
      const docs = r.packingLists + r.invoices;
      return {
        ...r,
        documents: docs,
        // Null rather than 0: "no approved document yet" is not "approved instantly".
        avgHoursToApproval: r.__hours.length
          ? round(r.__hours.reduce((s, h) => s + h, 0) / r.__hours.length, 2)
          : null,
        overrideRate: docs ? round(r.acknowledgements / docs, 2) : null,
        __hours: undefined,
      };
    })
    .filter((r) => matchesText(r.user, params.search))
    .sort((a, b) => b.documents - a.documents);

  return pageOf(rows, params);
};

// ─── Audit trail (§20) ──────────────────────────────────────────────────────────

export const searchAudit = async (params = {}) => {
  await delay();
  const db = loadDb();
  const rows = (db.audit || [])
    .filter((a) => (!params.entityType || a.entityType === params.entityType))
    .filter((a) => (!params.entityId || String(a.entityId) === String(params.entityId)))
    .filter((a) => (!params.user || a.user === params.user))
    .filter((a) => (!params.dateFrom || String(a.at) >= params.dateFrom))
    .filter((a) => (!params.dateTo || String(a.at) <= `${params.dateTo} 23:59`))
    // A reason is what an override recorded, so "overrides only" is a real filter.
    .filter((a) => (params.withReasonOnly ? Boolean(a.reason) : true))
    // §20's field-level record, findable on its own.
    .filter((a) => (params.withChangesOnly ? (a.changes || []).length > 0 : true))
    .filter((a) => matchesText(a.entityNo, params.search)
      || matchesText(a.action, params.search)
      || matchesText(a.details, params.search)
      || matchesText(a.reason, params.search)
      || matchesText(a.user, params.search))
    .map(clone)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)) || String(b.id).localeCompare(String(a.id)));

  const users = [...new Set((db.audit || []).map((a) => a.user).filter(Boolean))].sort();
  const entityTypes = [...new Set((db.audit || []).map((a) => a.entityType).filter(Boolean))].sort();
  return { ...pageOf(rows, params), users, entityTypes };
};

export const REPORT_KEYS = {
  PACKING_STATUS: 'PACKING_STATUS',
  SHIPMENT_REGISTER: 'SHIPMENT_REGISTER',
  INVOICE_REGISTER: 'INVOICE_REGISTER',
  VARIANCE: 'VARIANCE',
  CARTON_MASTER: 'CARTON_MASTER',
  TEMPLATE_COVERAGE: 'TEMPLATE_COVERAGE',
  PRODUCTIVITY: 'PRODUCTIVITY',
};
