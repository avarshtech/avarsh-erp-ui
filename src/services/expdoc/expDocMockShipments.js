/**
 * What the mock documents know about shipments. The shipment itself is the API's
 * (/export-docs/shipments, through expDocService); `db.shipments` here is the in-memory
 * mirror of it (expDocShipmentMirror). What stays is the document side: the counts a
 * shipment shows, the Carton Packing entries of its orders, and its document set (§18).
 */
import { loadDb } from './expDocMockStore';
import { delay, clone, fail } from './expDocMockCommon';

/** The Carton Packing entries of the shipment's orders this browser has read (expDocPackingMirror). */
export const entriesOfShipment = (db, shipment) => {
  const orders = new Set((shipment.orders || []).map((o) => o.orderId));
  return (db.packingEntries || []).filter((e) => orders.has(e.orderId));
};

/** One mirrored shipment's orders, or none. */
export const shipmentOrders = (shipmentId) =>
  (loadDb().shipments || []).find((s) => s.id === Number(shipmentId))?.orders || [];

/** The orders of every open shipment the mirror holds: what the dashboard's readiness counts. */
export const openShipmentOrderIds = () => [...new Set((loadDb().shipments || [])
  .filter((s) => s.status !== 'CLOSED').flatMap((s) => (s.orders || []).map((o) => o.orderId)))];

/** This browser's packing lists and invoices on one shipment, any status. */
export const documentsOfShipment = (shipmentId) => {
  const db = loadDb();
  const id = Number(shipmentId);
  return [...(db.packingLists || []), ...(db.invoices || [])].filter((d) => d.shipmentId === id);
};

/** The shipment one of this browser's packing lists ('packingLists') or invoices ('invoices') names. */
export const shipmentOfDocument = (table, id) =>
  (loadDb()[table] || []).find((d) => d.id === Number(id))?.shipmentId ?? null;

/** Every shipment this browser's packing lists and invoices were raised against. */
export const documentShipmentIds = () => {
  const db = loadDb();
  return [...new Set([...(db.packingLists || []), ...(db.invoices || [])]
    .map((d) => d.shipmentId)
    .filter((id) => id != null))];
};

/**
 * Derived, read-only decoration, never persisted. Exported because the invoice header
 * prints the consignee and notify blocks and must not re-derive them.
 *
 * The counts are this browser's documents: packing lists and invoices still live here.
 */
export const decorate = (shipment, db) => {
  const out = clone(shipment);
  out.consignee = shipment.consignee || null;
  out.notify = shipment.notify || null;
  out.orderNos = (shipment.orders || []).map((o) => o.orderNo).filter(Boolean);
  out.packingListCount = (db.packingLists || []).filter((p) => p.shipmentId === shipment.id).length;
  out.invoiceCount = (db.invoices || []).filter((i) => i.shipmentId === shipment.id).length;
  out.containerCount = (shipment.containerNos || []).length;
  return out;
};

/** An API shipment with this browser's document counts. */
export const withLocalDocuments = (shipment) => (shipment ? decorate(shipment, loadDb()) : shipment);

/** A page of them, reading the store once. */
export const withLocalDocumentsAll = (shipments) => {
  const db = loadDb();
  return shipments.map((s) => decorate(s, db));
};

/**
 * Every document belonging to one shipment (§18).
 *
 * The register answers "what exists for this consignment, and is it finished" —
 * which is the question asked when a set is about to be sent to a buyer or a
 * customs broker, and the one the shipment screen could not answer.
 *
 * Superseded and cancelled rows are included but marked, because "where did
 * revision 0 go" is exactly what someone chasing a discrepancy needs to see.
 */
export const getShipmentDocumentSet = async (shipmentId) => {
  await delay(80);
  const db = loadDb();
  const id = Number(shipmentId);
  const shipment = (db.shipments || []).find((s) => s.id === id);
  if (!shipment) fail('NOT_FOUND', `Shipment ${shipmentId} not found`);

  const live = (status) => !['CANCELLED', 'SUPERSEDED'].includes(status);
  const ready = (status) => ['FINAL', 'EXPORTED'].includes(status);

  const packingLists = (db.packingLists || [])
    .filter((p) => p.shipmentId === id)
    .sort((a, b) => String(a.plNo).localeCompare(String(b.plNo)) || (a.revision || 0) - (b.revision || 0))
    .map((p) => ({
      kind: 'PACKING_LIST',
      id: p.id,
      docNo: p.plNo,
      revision: p.revision || 0,
      status: p.status,
      buyerName: p.buyerName,
      date: p.plDate,
      exportedAt: p.exportedAt || null,
      isLive: live(p.status),
      isReady: ready(p.status),
      route: `/export-docs/packing-lists/edit/${p.id}`,
    }));

  const invoices = (db.invoices || [])
    .filter((i) => i.shipmentId === id)
    .sort((a, b) => String(a.invoiceNo || a.provisionalNo).localeCompare(String(b.invoiceNo || b.provisionalNo)))
    .map((i) => ({
      kind: 'EXPORT_INVOICE',
      id: i.id,
      docNo: i.invoiceNo || i.provisionalNo,
      revision: i.revision || 0,
      status: i.status,
      buyerName: i.buyerName,
      date: i.invoiceDate,
      exportedAt: i.exportedAt || null,
      isLive: live(i.status),
      isReady: ready(i.status),
      route: `/export-docs/invoices/edit/${i.id}`,
    }));

  const plIds = new Set(packingLists.map((p) => p.id));
  const stickerRuns = (db.stickerRuns || [])
    .filter((r) => plIds.has(r.plId))
    .map((r) => ({
      kind: 'STICKER_RUN',
      id: r.id,
      docNo: r.runNo,
      revision: 0,
      status: r.fromDraft ? 'DRAFT' : 'FINAL',
      date: r.generatedAt,
      cartonCount: r.cartonCount,
      plId: r.plId,
      isLive: true,
      // Stickers are printed, not finalised (§16) — they have no readiness of their own.
      isReady: !r.fromDraft,
      route: `/export-docs/stickers/${r.plId}`,
    }));

  const liveDocs = [...packingLists, ...invoices].filter((d) => d.isLive);
  return {
    shipment: decorate(shipment, db),
    packingLists,
    invoices,
    stickerRuns,
    counts: {
      packingLists: packingLists.filter((d) => d.isLive).length,
      invoices: invoices.filter((d) => d.isLive).length,
      stickerRuns: stickerRuns.length,
    },
    // What a "print the set" action would actually produce right now.
    readyToSend: liveDocs.filter((d) => d.isReady).length,
    notReady: liveDocs.filter((d) => !d.isReady).map((d) => ({ docNo: d.docNo, status: d.status })),
    complete: liveDocs.length > 0 && liveDocs.every((d) => d.isReady),
  };
};
