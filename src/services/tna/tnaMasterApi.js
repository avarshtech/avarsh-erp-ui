/**
 * Time & Action masters — /api/v1/tna/masters: buyer templates (versioned; a plan keeps the version
 * that generated it), the working calendar (holidays come from HR) and the alert thresholds.
 * Weekly off days travel as java.time.DayOfWeek names and are 0–6 (Sunday = 0) on screen.
 */
import axiosInstance from '../core/axiosInstance';

const BASE = '/tna/masters';
const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const toNumbers = (names = []) => names.map((n) => DAYS.indexOf(n)).filter((n) => n >= 0);
const toNames = (numbers = []) => numbers.map((n) => DAYS[n]).filter(Boolean);

export const listTemplates = async () => (await axiosInstance.get(`${BASE}/templates`)).data || [];
export const getTemplate = async (id) => (await axiosInstance.get(`${BASE}/templates/${id}`)).data;
/** { name, buyerId, garmentType, copyFromId, remarks } — a draft for a buyer (none = the default template). */
export const createTemplateDraft = async (payload) => (await axiosInstance.post(`${BASE}/templates`, payload)).data;
export const saveTemplateActivity = async (id, activity) => (await axiosInstance.put(`${BASE}/templates/${id}/activities`, activity)).data;
export const activateTemplate = async (id, { effectiveFrom } = {}) => (
  await axiosInstance.post(`${BASE}/templates/${id}/activate`, { effectiveFrom })
).data;

export const getCalendar = async () => {
  const { data } = await axiosInstance.get(`${BASE}/calendar`);
  return { ...data, weeklyOff: toNumbers(data?.weeklyOff), holidays: data?.holidays || [] };
};

const fromApi = (s) => ({ ...s, weeklyOff: toNumbers(s?.weeklyOff) });
export const getSettings = async () => fromApi((await axiosInstance.get(`${BASE}/settings`)).data);
/** Saves a partial change on top of the stored settings (the thresholds form does not carry the weekly off). */
export const saveSettings = async (patch) => {
  const current = await getSettings();
  const next = { ...current, ...patch };
  return fromApi((await axiosInstance.put(`${BASE}/settings`, { ...next, weeklyOff: toNames(next.weeklyOff) })).data);
};

/** Re-syncs every order from its sources now — what the nightly job does. */
export const resyncAll = async () => (await axiosInstance.post(`${BASE}/resync`)).data;
