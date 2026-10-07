import { dayDiff, dayOf, num, text } from '../util.js';

/** Days before ETD when a shipment's truck is at the dock being loaded. */
export const LOADING_WINDOW_DAYS = 3;

const phaseOf = (shipment, today) => {
  if (/CANCEL/i.test(shipment.status)) return 'cancelled';
  const toEtd = dayDiff(today, shipment.etd);
  if (toEtd == null) return 'planned';
  if (toEtd < 0) return 'departed';
  return toEtd <= LOADING_WINDOW_DAYS ? 'loading' : 'planned';
};

/** Export shipments (Export Documentation; a demo store while that module runs on mocks). */
export const adaptShipments = (page, today, demo) => {
  const list = (page?.content || []).map((raw) => {
    const shipment = {
      id: raw.id,
      no: text(raw.shipmentNo),
      buyer: text(raw.buyerName),
      mode: text(raw.mode),
      vessel: text(raw.vesselFlightNo),
      loadingPort: text(raw.portOfLoading),
      port: text(raw.portOfDischarge),
      country: text(raw.countryOfFinalDestination),
      etd: dayOf(raw.etd),
      eta: dayOf(raw.eta),
      status: text(raw.status),
      containers: num(raw.containerCount) || (raw.containerNos || []).length,
    };
    return { ...shipment, phase: phaseOf(shipment, today), destination: [shipment.port, shipment.country].filter(Boolean).join(', ') };
  });
  return { demo: Boolean(demo), shipments: list.filter((s) => s.no && s.phase !== 'cancelled') };
};
