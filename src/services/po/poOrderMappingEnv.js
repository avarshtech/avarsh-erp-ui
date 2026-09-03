/**
 * PO–Order Mapping data-source flag (mock phase).
 * Flip to false ONLY once the real /api/v1/purchase-orders/order-mapping backend
 * exists — poOrderMappingService.js throws a named error for every call until a
 * real delegate is wired in, rather than silently returning undefined.
 */
export const USE_MOCK_PO_ORDER_MAPPING_DATA = true;
