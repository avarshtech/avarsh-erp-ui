/**
 * Export Documentation dashboard aggregates (future GET /export-docs/dashboard).
 *
 * The two questions the PRD's §11.1 return arrow asks — "which shipments are ready
 * to document?" and "what is waiting on me?" — computed live from the mock store
 * rather than stored, because both answers change with every carton edit.
 *
 * Range-shaped like everything else in the module: shipment readiness counts
 * DOCUMENTS, never cartons, so a 40,000-carton shipment costs the same as a 40.
 */
import { loadDb } from './expDocMockStore';
import { delay, todayStr } from './expDocMockCommon';
import { PL_STATUS, INVOICE_STATUS } from '../../utils/expDocConstants';

const daysBetween = (from, to) => Math.round(
  (new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / 86400000,
);

/** Documents still open, and whose desk they are on. */
const pendingRows = (db) => {
  const pls = (db.packingLists || [])
    .filter((p) => p.status === PL_STATUS.DRAFT)
    .map((p) => ({
      id: p.id,
      kind: 'PACKING_LIST',
      docNo: p.plNo,
      buyerName: p.buyerName,
      shipmentNo: p.shipmentNo,
      status: p.status,
      waitingOn: p.createdBy || 'Documentation',
      updatedAt: p.updatedAt,
      route: `/export-docs/packing-lists/edit/${p.id}`,
    }));
  const invoices = (db.invoices || [])
    .filter((i) => i.status === INVOICE_STATUS.DRAFT)
    .map((i) => ({
      id: i.id,
      kind: 'EXPORT_INVOICE',
      docNo: i.invoiceNo || i.provisionalNo,
      buyerName: i.buyerName,
      shipmentNo: i.shipmentNo,
      status: i.status,
      waitingOn: i.createdBy || 'Documentation',
      updatedAt: i.updatedAt,
      route: `/export-docs/invoices/edit/${i.id}`,
    }));
  return [...pls, ...invoices].sort((a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt)));
};

/**
 * Shipment readiness: how close each open shipment is to having its documents done,
 * ordered by how soon it sails. This is the tile a documentation manager opens the
 * dashboard for.
 */
const readinessRows = (db) => {
  const today = todayStr();
  return (db.shipments || [])
    .filter((s) => s.status !== 'CLOSED')
    .map((s) => {
      const entries = (db.packingEntries || []).filter((e) => e.shipmentId === s.id);
      const pls = (db.packingLists || []).filter(
        (p) => p.shipmentId === s.id && ![PL_STATUS.CANCELLED, PL_STATUS.SUPERSEDED].includes(p.status),
      );
      const invoices = (db.invoices || []).filter(
        (i) => i.shipmentId === s.id && ![INVOICE_STATUS.CANCELLED, INVOICE_STATUS.SUPERSEDED].includes(i.status),
      );
      const done = (rows) => rows.filter((r) => [PL_STATUS.FINAL, PL_STATUS.EXPORTED].includes(r.status)).length;

      // Four things have to be true for a shipment to be documented, so readiness is
      // four quarters rather than a ratio of one of them.
      const steps = [
        entries.length > 0,
        pls.length > 0,
        pls.length > 0 && done(pls) === pls.length,
        invoices.length > 0 && done(invoices) === invoices.length,
      ];
      const days = s.etd ? daysBetween(today, s.etd) : null;
      return {
        id: s.id,
        shipmentNo: s.shipmentNo,
        buyerName: s.buyerName,
        etd: s.etd,
        daysToEtd: days,
        packingEntries: entries.length,
        packingLists: pls.length,
        packingListsFinal: done(pls),
        invoices: invoices.length,
        invoicesFinal: done(invoices),
        readinessPercent: Math.round((steps.filter(Boolean).length / steps.length) * 100),
        // Late is not the same as merely close: a shipment that sails in two days
        // with documents still in draft is the one worth a colour.
        atRisk: days != null && days <= 3 && steps.filter(Boolean).length < steps.length,
        route: `/export-docs/shipments/edit/${s.id}`,
      };
    })
    .sort((a, b) => {
      if (a.daysToEtd == null) return 1;
      if (b.daysToEtd == null) return -1;
      return a.daysToEtd - b.daysToEtd;
    });
};

export const getExpDocDashboard = async () => {
  await delay(120);
  const db = loadDb();
  const pending = pendingRows(db);
  const readiness = readinessRows(db);
  const today = todayStr();

  return {
    quickStats: {
      // Documents nobody has finalised — the number a manager acts on.
      inDraft: pending.filter((p) => p.status === 'DRAFT').length,
      shipmentsAtRisk: readiness.filter((r) => r.atRisk).length,
      releasedToday: [
        ...(db.packingLists || []),
        ...(db.invoices || []),
      ].filter((d) => String(d.exportedAt || '').startsWith(today)).length,
    },
    pending: pending.slice(0, 12),
    pendingTotal: pending.length,
    readiness: readiness.slice(0, 12),
    readinessTotal: readiness.length,
  };
};
