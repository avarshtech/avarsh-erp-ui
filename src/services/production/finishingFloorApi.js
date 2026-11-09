/**
 * Finishing floor registers on the real API (/api/v1/finishing/…): receiving from sewing, the
 * hourly stations, spot wash, alterations, metal detection + needle log, shade segregation and the
 * floor dashboard. Function names match the mock they replaced so the screens did not change.
 * Statuses (receiving shortage/excess, alteration cycles and closing) are worked out on the server.
 */
import axiosInstance from '../core/axiosInstance';

const BASE = '/finishing';

const get = async (url, params) => {
  const { data } = await axiosInstance.get(`${BASE}${url}`, params ? { params } : undefined);
  return data;
};

/** POST for a new record, PUT /{id} once it has one. */
const save = async (url, payload) => {
  const { data } = payload?.id
    ? await axiosInstance.put(`${BASE}${url}/${payload.id}`, payload)
    : await axiosInstance.post(`${BASE}${url}`, payload);
  return data;
};

// Every active HR employee; the station is echoed back (Finishing has no enrolment of its own yet).
export const getEmployees = async (station) => (await get('/employees', station ? { station } : undefined)) || [];

export const listReceivings = async () => (await get('/receivings')) || [];
export const saveReceiving = async (payload) => {
  const { data } = await axiosInstance.post(`${BASE}/receivings`, payload);
  return data;
};

/** The saved sheet for the station and day, or a blank one (id null) to start from. */
export const getHourlySheet = ({ station, date }) => get('/hourly-sheets', { station, date });
export const saveHourlySheet = (payload) => save('/hourly-sheets', payload);

export const listSpotWash = async () => (await get('/spot-wash')) || [];
export const saveSpotWash = (payload) => save('/spot-wash', payload);

export const listAlterations = async () => (await get('/alterations')) || [];
export const saveAlteration = (payload) => save('/alterations', payload);
export const saveAlterationBatch = async ({ orderId, color, rows }) => {
  const { data } = await axiosInstance.post(`${BASE}/alterations/batch`, { orderId, color, rows });
  return data || [];
};

export const listMetalDetection = async () => (await get('/metal-detections')) || [];
export const saveMetalDetection = (payload) => save('/metal-detections', payload);
export const listNeedleLog = async () => (await get('/needle-logs')) || [];

export const listShadeGroups = async () => (await get('/shade-groups')) || [];
export const saveShadeGroup = async (payload) => {
  const { data } = await axiosInstance.post(`${BASE}/shade-groups`, payload);
  return data;
};

export const getFinishingDashboard = () => get('/dashboard');
