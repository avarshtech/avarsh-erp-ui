/**
 * Buyer document templates REST client (/api/v1/export-docs/templates). Every row
 * comes back through the adapter, so screens see the same shape the mock gave them.
 */
import axiosInstance from '../core/axiosInstance';
import { fromApi, summaryFromApi, toApi } from './exportTemplateAdapter';

const BASE = '/export-docs/templates';

/** Screens read `e.message`; axiosInstance puts the backend's text on `errorMessage`. */
const call = (request) => request.then((res) => res.data).catch((e) => {
  e.message = e.errorMessage || e.message;
  throw e;
});

export const listApiTemplates = async (params = {}) =>
  (await call(axiosInstance.get(BASE, { params }))).map(summaryFromApi);

export const getApiTemplate = async (id) => fromApi(await call(axiosInstance.get(`${BASE}/${id}`)));

export const createApiTemplate = async (template) => fromApi(await call(axiosInstance.post(BASE, toApi(template))));

/** The reviewed drafts read from one uploaded document, saved together. */
export const createApiTemplateBatch = async (templates, source = {}) =>
  (await call(axiosInstance.post(`${BASE}/batch`, {
    templates: templates.map(toApi), sourceFileId: source.fileId, sourceFileName: source.fileName,
  }))).map(fromApi);

export const updateApiTemplate = async (id, template) =>
  fromApi(await call(axiosInstance.put(`${BASE}/${id}`, toApi(template))));

export const cloneApiTemplate = async (id, payload) =>
  fromApi(await call(axiosInstance.post(`${BASE}/${id}/clone`, payload)));

export const reviseApiTemplate = async (id) => fromApi(await call(axiosInstance.post(`${BASE}/${id}/revise`)));

export const publishApiTemplate = async (id, body = {}) =>
  fromApi(await call(axiosInstance.post(`${BASE}/${id}/publish`, body)));

export const retireApiTemplate = async (id, body = {}) =>
  fromApi(await call(axiosInstance.post(`${BASE}/${id}/retire`, body)));

export const deleteApiTemplate = (id) => call(axiosInstance.delete(`${BASE}/${id}`));
