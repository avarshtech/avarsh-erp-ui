/**
 * API <-> screen shape for export shipments (/api/v1/export-docs/shipments).
 *
 * The API's record is already the shape the screens and the mock documents read (the
 * mock was built to it), so `fromApi` only adds what they derive: the order numbers,
 * the container count, and the people as names. `toApi` sends ids only: the server
 * builds the printed consignee and notify blocks from the buyer master.
 *
 * Ports: `portOfLoading` / `portOfDischarge` become what prints, the server's label
 * ("Chennai (INMAA1)"; a legacy shipment's name alone), the field every print binding,
 * template and reader already uses. The bare name stays as `portOfLoadingName`, for the
 * incoterm's named place ("FOB Chennai").
 *
 * Pure, with no axios or storage, so the unit spec imports it in Node.
 */

export const fromApi = (dto) => {
  if (!dto) return dto;
  const orders = dto.orders || [];
  const containerNos = dto.containerNos || [];
  return {
    ...dto,
    orders,
    containerNos,
    orderNos: orders.map((o) => o.orderNo).filter(Boolean),
    containerCount: containerNos.length,
    portOfLoadingName: dto.portOfLoading ?? null,
    portOfLoading: dto.portOfLoadingLabel ?? dto.portOfLoading ?? null,
    portOfDischargeName: dto.portOfDischarge ?? null,
    portOfDischarge: dto.portOfDischargeLabel ?? dto.portOfDischarge ?? null,
    createdBy: dto.createdByName ?? null,
    updatedBy: dto.updatedByName ?? null,
    closedBy: dto.closedByName ?? null,
  };
};

const textOrNull = (v) => {
  const t = typeof v === 'string' ? v.trim() : v;
  return t === '' || t == null ? null : t;
};

/** What the form saves, dates already 'YYYY-MM-DD', as the API takes it. */
export const toApi = (s) => ({
  buyerId: s.buyerId,
  notifyParty: s.notifyParty ? { kind: s.notifyParty.kind, locationId: s.notifyParty.locationId ?? null } : null,
  consigneeLocationId: s.consigneeLocationId ?? null,
  orderIds: s.orderIds || [],
  // The buyer POs each order sends, [{ orderId, pos: [{ buyerPoNo, destination }] }]; absent keeps the saved ones
  orderPos: Array.isArray(s.orderPos) ? s.orderPos : null,
  mode: s.mode,
  incoterm: s.incoterm,
  preCarriageBy: textOrNull(s.preCarriageBy),
  placeOfReceipt: textOrNull(s.placeOfReceipt),
  vesselFlightNo: textOrNull(s.vesselFlightNo),
  portOfLoadingId: s.portOfLoadingId ?? null,
  portOfDischargeId: s.portOfDischargeId ?? null,
  finalDestination: textOrNull(s.finalDestination),
  countryOfFinalDestination: textOrNull(s.countryOfFinalDestination),
  etd: s.etd,
  eta: s.eta || null,
  blAwbNo: textOrNull(s.blAwbNo),
  blAwbDate: s.blAwbDate || null,
  forwarder: textOrNull(s.forwarder),
  containerNos: s.containerNos || [],
  version: s.version ?? null,
  branchId: s.branchId ?? null,
});

/** The register's filters as query params; `ids` travels as one comma list, which Spring splits. */
export const toSearchParams = (p = {}) => ({
  ...(p.search ? { search: p.search } : {}),
  ...(p.status ? { status: p.status } : {}),
  ...(p.buyerId != null ? { buyerId: p.buyerId } : {}),
  ...(p.etdFrom ? { etdFrom: p.etdFrom } : {}),
  ...(p.etdTo ? { etdTo: p.etdTo } : {}),
  ...(p.ids?.length ? { ids: p.ids.join(',') } : {}),
  page: p.page ?? 0,
  size: p.size ?? 25,
});

/** A shipment as the pickers list it. */
export const optionOf = (s) => ({
  value: s.id,
  label: `${s.shipmentNo} — ${s.buyerName} — ETD ${s.etd}`,
  shipmentNo: s.shipmentNo,
  status: s.status,
  buyerCode: s.buyerCode ?? null,
  // What the packing-list template picker matches buyer templates on.
  buyerId: s.buyerId ?? null,
  buyerName: s.buyerName ?? null,
});
