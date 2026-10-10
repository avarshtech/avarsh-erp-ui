/**
 * Live preview of a template with sample data (§10.3), from the export-docs mock store.
 */
import { loadDb } from './expDocMockStore';
import { delay, clone, todayStr } from './expDocMockCommon';
import { decorate as decorateShipment } from './expDocMockShipments';
import { entryStyle } from './expDocMockStickers';
import { DOC_TYPE } from '../../utils/expDocConstants';

/**
 * A sample document for previewing ANY template — sticker, packing list or invoice,
 * saved or still being reviewed — built from the SEEDED packing data rather than
 * invented values, so what the admin sees is a real document in their layout.
 *
 * Returns the pieces; the caller renders them, because document HTML is built
 * client-side by `expDocHtml` and this service must not import it.
 */
export const getTemplateSample = async (template) => {
  await delay(80);
  const db = loadDb();
  const t = clone(template);
  const entries = db.packingEntries || [];
  const entry = entries.find((e) => e.buyerCode && e.buyerCode === t.buyerCode)
    || entries.find((e) => t.buyerName && e.buyerName === t.buyerName)
    || entries[0] || null;
  // A real shipment of the template's buyer, when one is open; the preview prints dashes without.
  const shipment = (db.shipments || []).find((s) => (t.buyerId != null && s.buyerId === t.buyerId)
    || (entry && s.buyerName === entry.buyerName)) || null;

  if (!entry) return { docType: t.docType, template: t, empty: true };

  const rows = (entry.groups || []).map((g) => ({
    ...clone(g), sourceEntryId: entry.id, sourceEntryNo: entry.packingNo,
  }));
  const main = rows.filter((r) => r.sectionKey !== 'EXTRA');
  const extra = rows.filter((r) => r.sectionKey === 'EXTRA');

  const samplePl = {
    id: 0,
    plNo: 'PKL/SAMPLE/0001',
    plDate: todayStr(),
    status: 'DRAFT',
    buyerCode: entry.buyerCode,
    buyerName: entry.buyerName,
    shipmentNo: shipment?.shipmentNo || null,
    shipmentId: shipment?.id ?? null,
    sizes: entry.sizes || [],
    orderNos: [entry.orderNo].filter(Boolean),
    orderBreakdown: clone(entry.orderBreakdown || []),
    sections: [
      { key: 'MAIN', title: 'Main cartons', order: 0, rows: main },
      ...(extra.length ? [{ key: 'EXTRA', title: 'Extra cartons', order: 1, rows: extra }] : []),
    ],
    finalSnapshot: null,
    // The template under edit, not the one the document would use — that is what
    // makes this a preview of THIS draft.
    template: t,
    templateId: t.id,
    templateVersion: t.version,
  };

  return {
    docType: t.docType,
    template: t,
    pl: samplePl,
    // Decorated, so the preview prints the consignee, notify party and orders.
    shipment: shipment ? decorateShipment(shipment, db) : null,
    entry: { garmentName: entry.garmentName, compositionText: entry.compositionText, orderNo: entry.orderNo },
    // A sticker prints `style.*` and the season per carton, from the carton's own entry.
    ...(t.docType === DOC_TYPE.STICKER ? { styleByEntry: { [entry.id]: entryStyle(entry) } } : {}),
    empty: false,
  };
};
