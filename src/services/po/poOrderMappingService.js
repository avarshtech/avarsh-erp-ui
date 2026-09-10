/**
 * PO–Order Mapping API client — the ONLY file the screens import.
 *
 * A General supplier PO is raised before the customer confirms. This links it, line by
 * line and quantity by quantity, to the orders it ended up serving.
 *
 * Every write returns the whole PO reassembled by the server, and the drawer adopts it
 * wholesale, so the response is always the complete detail rather than a patch.
 */
import axiosInstance from '../core/axiosInstance';

/**
 * One-shot cleanup of the pre-cutover demo data.
 *
 * Every mapping screen ran off `avarsh.poOrderMapping.mockStore.v1` in localStorage until
 * this module replaced the mock. Nothing reads that key now, and it is dead weight in the
 * browser of anyone who used the mock build.
 */
try {
  localStorage.removeItem('avarsh.poOrderMapping.mockStore.v1');
} catch {
  // Private-mode / storage-disabled browsers: nothing to clean up anyway.
}

/** axiosInstance owns the /api/v1 prefix. */
const BASE = '/purchase-orders/order-mapping';

/**
 * The workspace reads `number` and `size` straight off the response. The purchase-order
 * module answers with the house envelope (`pageNumber`/`pageSize`), while other modules use
 * the Spring shape, so accept either rather than betting on one.
 */
const toPage = (data) => ({
  content: data?.content || [],
  totalElements: data?.totalElements ?? 0,
  totalPages: data?.totalPages ?? 0,
  size: data?.pageSize ?? data?.size ?? 10,
  number: data?.pageNumber ?? data?.number ?? 0,
});

// ── Reads ───────────────────────────────────────────────────────────────────

export const searchMappablePos = async (params = {}) =>
  toPage((await axiosInstance.get(BASE, { params })).data);

export const getPoMapping = async (poId) => (await axiosInstance.get(`${BASE}/${poId}`)).data;

/**
 * The orders whose BOM actually consumes the variant this PO line is buying.
 *
 * The unfiltered list offers every confirmed bulk order, which for a fabric line is most
 * of the factory. An empty array is a real answer — a General PO is often raised before
 * the order's BOM exists — so the caller must explain it rather than render a blank.
 */
export const listMappableOrdersForLine = async (poLineItemId) =>
  (await axiosInstance.get(`${BASE}/lines/${poLineItemId}/orders`)).data;

export const listMappingSuppliers = async () => (await axiosInstance.get(`${BASE}/suppliers`)).data;

// ── Writes ──────────────────────────────────────────────────────────────────

/** `poId` addresses the PO in the path; only the allocation itself is a body. */
export const addAllocation = async ({ poId, ...body }) =>
  (await axiosInstance.post(`${BASE}/${poId}/allocations`, body)).data;

export const removeAllocation = async ({ poId, allocationId }) =>
  (await axiosInstance.delete(`${BASE}/${poId}/allocations/${allocationId}`)).data;

export const setStockOnly = async ({ poId, ...body }) =>
  (await axiosInstance.put(`${BASE}/${poId}/stock-only`, body)).data;
