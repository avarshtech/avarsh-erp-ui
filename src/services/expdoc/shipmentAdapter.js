/**
 * API <-> screen shape for export shipments (/api/v1/export-docs/shipments).
 *
 * The API's record is already the shape the screens and the mock documents read (the
 * mock was built to it), so `fromApi` only adds what they derive: the order numbers,
 * the container count, and the people as names. `toApi` sends ids only: the server
 * builds the printed consignee and notify blocks from the buyer master.
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
  mode: s.mode,
  incoterm: s.incoterm,
  preCarriageBy: textOrNull(s.preCarriageBy),
  placeOfReceipt: textOrNull(s.placeOfReceipt),
  vesselFlightNo: textOrNull(s.vesselFlightNo),
  portOfLoading: s.portOfLoading,
  portOfDischarge: s.portOfDischarge,
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
