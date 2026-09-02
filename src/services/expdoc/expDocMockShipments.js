/**
 * Shipment records — an entity this module invents.
 *
 * No shipment/booking/consignment table, entity, page or service exists anywhere
 * in either repo, yet V-01 is shipment-scoped ("duplicate carton number across all
 * packing lists of the shipment") and the whole invoice transport block reads from
 * one. Kept deliberately thin so a real Shipment module can replace it: every
 * consumer goes through expDocService.getShipment().
 */
import { loadDb, saveDb, nextShipmentNo } from './expDocMockStore';
import {
  delay, clone, fail, failConflict, pageOf, matchesText, pushAudit, nowStamp, currentUserName,
} from './expDocMockCommon';
import { getBuyerCommercial } from './expDocMockMasters';

const find = (db, id) => db.shipments.find((s) => s.id === Number(id));

/**
 * A party as a printable address block: name, then address lines, then city /
 * postcode / country. Documents bind `shipment.consignee.block`, so the shape has
 * to be resolved here rather than in every renderer.
 */
export const partyBlock = (party) => {
  if (!party) return null;
  const tail = [party.postalCode, party.city].filter(Boolean).join(' ');
  return {
    ...party,
    block: [party.name, ...(party.addressLines || []), tail, party.country]
      .filter(Boolean)
      .join('\n'),
  };
};

/** Derived, read-only decoration — never persisted. */
/**
 * Adds the resolved consignee and notify address blocks. Exported because the
 * invoice header prints them and must not re-derive them — `getStickerContext`
 * deliberately does not decorate, and copying that would give the invoice a
 * shipment with no consignee.
 */
export const decorate = (shipment, db) => {
  const out = clone(shipment);
  // The shipment stores profile ids; documents need the resolved party.
  const commercial = getBuyerCommercial({ buyerCode: shipment.buyerCode, buyerName: shipment.buyerName });
  out.consignee = partyBlock(
    (commercial.consigneeProfiles || []).find((c) => c.id === shipment.consigneeProfileId),
  );
  out.notify = partyBlock(
    (commercial.notifyProfiles || []).find((n) => n.id === shipment.notifyProfileId),
  );
  const entries = (db.packingEntries || []).filter((e) => e.shipmentId === shipment.id);
  const lists = (db.packingLists || []).filter((p) => p.shipmentId === shipment.id);
  out.packingEntryCount = entries.length;
  out.packingListCount = lists.length;
  out.containerCount = (shipment.containerNos || []).length;
  return out;
};

export const searchShipments = async (params = {}) => {
  await delay();
  const db = loadDb();
  const rows = db.shipments
    .filter((s) => {
      if (params.status && s.status !== params.status) return false;
      if (params.buyerCode && s.buyerCode !== params.buyerCode) return false;
      if (params.etdFrom && s.etd < params.etdFrom) return false;
      if (params.etdTo && s.etd > params.etdTo) return false;
      if (params.search) {
        const hit = matchesText(s.shipmentNo, params.search)
          || matchesText(s.buyerName, params.search)
          || matchesText(s.vesselFlightNo, params.search)
          || matchesText(s.portOfDischarge, params.search)
          || (s.containerNos || []).some((c) => matchesText(c, params.search));
        if (!hit) return false;
      }
      return true;
    })
    .map((s) => decorate(s, db))
    .sort((a, b) => b.id - a.id);
  return pageOf(rows, params);
};

export const getShipment = async (id) => {
  await delay(80);
  const db = loadDb();
  const s = find(db, id);
  if (!s) fail('NOT_FOUND', `Shipment ${id} not found`);
  return decorate(s, db);
};

/** Lightweight options for pickers — no pagination, no decoration. */
export const listShipmentOptions = async (buyerCode) => {
  await delay(60);
  const db = loadDb();
  return db.shipments
    .filter((s) => s.status === 'OPEN' && (!buyerCode || s.buyerCode === buyerCode))
    .map((s) => ({
      value: s.id,
      label: `${s.shipmentNo} — ${s.buyerName} — ETD ${s.etd}`,
      shipmentNo: s.shipmentNo,
      buyerCode: s.buyerCode,
    }));
};

export const createShipment = async (payload) => {
  await delay();
  const db = loadDb();
  const id = Math.max(0, ...db.shipments.map((s) => s.id)) + 1;
  const record = {
    id,
    shipmentNo: nextShipmentNo(db),
    status: 'OPEN',
    containerNos: [],
    ...clone(payload),
    version: 0,
    createdAt: nowStamp(),
    createdBy: currentUserName(),
  };
  db.shipments.push(record);
  pushAudit(db, {
    entityType: 'SHIPMENT', entityId: id, entityNo: record.shipmentNo, action: 'Shipment created',
  });
  saveDb(db);
  return decorate(record, db);
};

export const updateShipment = async (id, payload) => {
  await delay();
  const db = loadDb();
  const s = find(db, id);
  if (!s) fail('NOT_FOUND', `Shipment ${id} not found`);
  // Optimistic locking in the shape axiosInstance already routes to ConflictDialog.
  if (payload.version != null && Number(payload.version) !== Number(s.version)) {
    failConflict(s.shipmentNo, payload.version, s.version);
  }
  const before = clone(s);
  const { version: _v, id: _id, shipmentNo: _no, ...rest } = payload;
  Object.assign(s, clone(rest), { version: (s.version || 0) + 1 });
  pushAudit(db, {
    entityType: 'SHIPMENT', entityId: s.id, entityNo: s.shipmentNo,
    action: 'Shipment updated', before, after: clone(s),
  });
  saveDb(db);
  return decorate(s, db);
};

/**
 * §11.1 write-back: a shipment closes when every live document on it is released.
 *
 * Called from the document side after a release, so the shipment reflects its
 * documents rather than needing a person to remember. A shipment with no documents
 * is left OPEN — nothing has been shipped.
 */
export const syncShipmentStatus = (db, shipmentId) => {
  const s = find(db, shipmentId);
  if (!s) return null;
  const live = ['DRAFT', 'SUBMITTED', 'APPROVED', 'EXPORTED'];
  const pls = (db.packingLists || []).filter((p) => p.shipmentId === s.id && live.includes(p.status));
  const invoices = (db.invoices || []).filter((i) => i.shipmentId === s.id && live.includes(i.status));
  const docs = [...pls, ...invoices];
  const closed = docs.length > 0 && docs.every((d) => d.status === 'EXPORTED');
  const next = closed ? 'CLOSED' : 'OPEN';
  if (s.status === next) return s;
  s.status = next;
  s.closedAt = closed ? nowStamp() : null;
  s.version = (s.version || 0) + 1;
  pushAudit(db, {
    entityType: 'SHIPMENT', entityId: s.id, entityNo: s.shipmentNo,
    action: closed ? 'Shipment closed' : 'Shipment reopened',
    details: closed
      ? `All ${docs.length} document(s) released.`
      : 'A document on this shipment is no longer released.',
  });
  return s;
};

export const deleteShipment = async (id) => {
  await delay();
  const db = loadDb();
  const s = find(db, id);
  if (!s) fail('NOT_FOUND', `Shipment ${id} not found`);
  const usedByEntry = (db.packingEntries || []).some((e) => e.shipmentId === s.id);
  const usedByList = (db.packingLists || []).some((p) => p.shipmentId === s.id);
  if (usedByEntry || usedByList) {
    fail('CONFLICT', `${s.shipmentNo} is referenced by packing data and cannot be deleted.`);
  }
  db.shipments = db.shipments.filter((x) => x.id !== s.id);
  pushAudit(db, {
    entityType: 'SHIPMENT', entityId: s.id, entityNo: s.shipmentNo, action: 'Shipment deleted',
  });
  saveDb(db);
  return { success: true };
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
  const ready = (status) => ['APPROVED', 'EXPORTED'].includes(status);

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
      status: r.fromDraft ? 'DRAFT' : 'APPROVED',
      date: r.generatedAt,
      cartonCount: r.cartonCount,
      plId: r.plId,
      isLive: true,
      // Stickers are printed, not approved (§16) — they have no readiness of their own.
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
