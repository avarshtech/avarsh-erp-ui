/**
 * Keeps a shipment's OPEN / CLOSED in step with its documents while the shipment is the
 * API's and its packing lists and invoices are still this browser's mock.
 *
 * After a document is raised, released, cancelled, revised or deleted, the facade calls
 * syncShipmentStatus: the status is worked out from this browser's documents
 * (expDocShipmentRules) and the API is told to close or reopen the shipment. Both calls
 * are idempotent and silent. A document action never fails because of this: a refusal
 * (no update right, a branch the user cannot work in) leaves the shipment as it was,
 * and the next document action tries again.
 */
import { closeApiShipment, reopenApiShipment } from './shipmentApi';
import { mirrorPut } from './expDocShipmentMirror';
import { documentsOfShipment } from './expDocMockShipments';
import { shipmentStatusFor } from './expDocShipmentRules';
import { SHIPMENT_STATUS } from '../../utils/expDocConstants';

export const syncShipmentStatus = async (shipmentId) => {
  if (shipmentId == null) return;
  try {
    const target = shipmentStatusFor(documentsOfShipment(shipmentId));
    const saved = target === SHIPMENT_STATUS.CLOSED
      ? await closeApiShipment(shipmentId)
      : await reopenApiShipment(shipmentId);
    mirrorPut(saved);
  } catch {
    // The document action stands; the shipment keeps the status it had
  }
};

/**
 * A shipment with packing lists or invoices in this browser is not deleted: they would
 * be left naming a shipment that no longer exists. The server cannot see them.
 */
export const assertShipmentDeletable = (shipment) => {
  const docs = documentsOfShipment(shipment.id);
  if (docs.length) {
    throw new Error(`${shipment.shipmentNo} has ${docs.length} packing list(s) or invoice(s) and cannot be deleted.`);
  }
};
