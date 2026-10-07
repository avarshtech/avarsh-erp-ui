/**
 * The vendor daily sheet: GET/POST /api/v1/job-work/sheets and DELETE /progress/{id}
 * (mock-only for now).
 */
import * as mock from './trackerMockSheet';

export const getVendorSheet = async (params) => mock.getVendorSheet(params);
export const saveVendorSheet = async (payload) => mock.saveVendorSheet(payload);
export const deleteProgress = async (entryId, params) => mock.deleteProgress(entryId, params);
