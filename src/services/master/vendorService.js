import axiosInstance from '../core/axiosInstance';

/**
 * The Vendor master: job workers and outside processing units (API /vendors). Named list/get/…Vendor
 * so it never clashes with productionLookupService.getVendors (the production POs' own lookup).
 */
const ENDPOINT = '/vendors';

/** The master list: active vendors, or every vendor with includeInactive. No PAN or bank details. */
export const listVendors = (includeInactive = false) => axiosInstance.get(ENDPOINT, { params: { includeInactive } });

/** One vendor, with its PAN and bank details. */
export const getVendor = (id) => axiosInstance.get(`${ENDPOINT}/${id}`);

export const createVendor = (data) => axiosInstance.post(ENDPOINT, data);

/** Must send the vendor's version: a stale one is a 409, a missing one a 400. */
export const updateVendor = (id, data) => axiosInstance.put(`${ENDPOINT}/${id}`, data);

/** Deactivates the vendor; never refused, and documents that name it keep it. */
export const deactivateVendor = (id) => axiosInstance.delete(`${ENDPOINT}/${id}`);

/**
 * What a picker reads (the costing sheet's manufacturing rows, the Cut Panel and Garment Process POs):
 * no PAN or bank details, and each vendor's processes with their categories.
 * @param {{ includeInactive?: boolean }} [params]
 */
export const getVendorOptions = (params) =>
  axiosInstance.get(`${ENDPOINT}/options`, params ? { params } : undefined);

/** Every active process, of any category: what a vendor may be tagged with. */
export const getVendorProcessOptions = () => axiosInstance.get(`${ENDPOINT}/process-options`);
