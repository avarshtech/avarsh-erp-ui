import axiosInstance from '../core/axiosInstance';

/**
 * Verification runs: walking the floor and checking the machines are there.
 *
 * A run records what was found and never corrects the register itself. Every
 * difference it reports is something a person then decides about.
 */

const BASE = '/asset-verifications';

const query = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') search.append(k, v);
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
};

export const getRuns = async (params = {}) =>
  (await axiosInstance.get(`${BASE}${query(params)}`)).data;

export const getRun = async (id) => (await axiosInstance.get(`${BASE}/${id}`)).data;

export const startRun = async (payload) => (await axiosInstance.post(BASE, payload)).data;

/** One scan. The asset is named by the code printed on its label. */
export const scanAsset = async (id, payload) =>
  (await axiosInstance.post(`${BASE}/${id}/scan`, payload)).data;

export const closeRun = async (id, version, remarks) =>
  (await axiosInstance.post(`${BASE}/${id}/close${query({ version, remarks })}`)).data;

export const reopenRun = async (id, version) =>
  (await axiosInstance.post(`${BASE}/${id}/reopen${query({ version })}`)).data;
