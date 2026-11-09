/**
 * When a shipment closes, decided from the documents raised against it. Pure, so the
 * unit spec runs it in Node; expDocShipmentBridge applies the answer through the API.
 *
 * "The documents" are the packing lists and invoices the document store loaded from the
 * API (expDocStore); every user who can raise one reads them all.
 */
import { PL_STATUS, SHIPMENT_STATUS } from '../../utils/expDocConstants.js';

// Packing lists and invoices share these statuses; cancelled and superseded ones no longer count.
const LIVE = [PL_STATUS.DRAFT, PL_STATUS.FINAL, PL_STATUS.EXPORTED];

/** CLOSED once there is a live document and every live one is released; OPEN otherwise. */
export const shipmentStatusFor = (documents) => {
  const live = (documents || []).filter((d) => LIVE.includes(d.status));
  return live.length > 0 && live.every((d) => d.status === PL_STATUS.EXPORTED)
    ? SHIPMENT_STATUS.CLOSED
    : SHIPMENT_STATUS.OPEN;
};
