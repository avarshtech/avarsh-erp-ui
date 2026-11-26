/** The message a General PO without an order is refused with, on the screen. */
export const GENERAL_PO_ORDERS_REQUIRED = 'Pick the order(s) this General PO is for';

/** The references a General PO saves: the keys every PO reference carries ({orderId, orderNo, styleName, ...}), with no BOM. */
export const generalOrderReferences = (refs) => (refs || []).map((ref) => ({
  orderId: ref.orderId,
  orderNo: ref.orderNo,
  bomId: null,
  styleId: ref.styleId ?? null,
  styleName: ref.styleName ?? null,
  season: ref.season ?? null,
}));
