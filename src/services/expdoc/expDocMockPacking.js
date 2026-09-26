/**
 * Carton packing entries, as the Export Documentation mock sees them.
 *
 * The Packing screens (Production › Packing) now run on the real API through
 * services/production/packingService.js. Export Docs is still a mock, so its
 * packing lists, invoices and reports keep binding the entries seeded into the
 * mock store (expDocMockData.js) until the export-docs backend exists — entries
 * created on the live Packing screen are not visible here.
 *
 * Rows are RANGES (cartonFrom..cartonTo). One row can stand for 300 cartons, which
 * is what keeps an unbounded carton count cheap in both store and memory.
 */
import { loadDb } from './expDocMockStore';
import { delay } from './expDocMockCommon';
import { PACKING_ENTRY_STATUS } from '../../utils/expDocConstants';
import { decorateEntry } from '../../utils/packingEntryIssues';

// The packing-list mock imports decorateEntry from here.
export { entryIssues, decorateEntry } from '../../utils/packingEntryIssues';

/** Entries a packing list may bind for a shipment (PRD §7.1). */
export const listBindablePackingEntries = async (shipmentId) => {
  await delay(80);
  const db = loadDb();
  return db.packingEntries
    .filter((e) => !shipmentId || e.shipmentId === Number(shipmentId))
    .map((e) => {
      const dec = decorateEntry(e);
      return {
        id: e.id,
        packingNo: e.packingNo,
        orderNo: e.orderNo,
        styleNo: e.styleNo,
        status: e.status,
        cartons: dec.totals.cartons,
        pieces: dec.totals.pieces,
        errorCount: dec.errorCount,
        // An incomplete entry CAN be bound, with a warning (PRD §7.1); only a
        // structural error blocks it.
        bindable: dec.errorCount === 0,
        bindWarning:
          e.status !== PACKING_ENTRY_STATUS.COMPLETED
            ? 'Packing entry is not marked complete.'
            : null,
        blockedReason:
          dec.errorCount > 0
            ? `${dec.errorCount} structural error(s) must be fixed first.`
            : null,
      };
    });
};
