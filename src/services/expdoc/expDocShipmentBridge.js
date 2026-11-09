/**
 * Keeps a shipment's OPEN / CLOSED in step with its documents. The shipment and the
 * documents are both the API's, but the document rules run in the browser (expDocStore).
 *
 * After a document is raised, released, cancelled, revised or deleted and saved, the facade
 * calls syncShipmentStatus: the status is worked out from the documents
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
 * A shipment with packing lists or invoices is not deleted: they would be left naming a
 * shipment that no longer exists. A fast check on the documents loaded; the API refuses too.
 */
export const assertShipmentDeletable = (shipment) => {
  const docs = documentsOfShipment(shipment.id);
  if (docs.length) {
    throw new Error(`${shipment.shipmentNo} has ${docs.length} packing list(s) or invoice(s) and cannot be deleted.`);
  }
};
