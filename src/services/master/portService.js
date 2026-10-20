import axiosInstance from '../core/axiosInstance';

const ENDPOINT = '/ports';

/**
 * The port catalogue (UN/LOCODE, /api/v1/ports): read-only, refreshed by the server. `kinds` is any of
 * SEA, AIR, ICD; `country` an ISO code. The server puts a port whose code is the search first, matches
 * former names too ("Madras"), and returns at most 50.
 */
export const searchPorts = ({ search, kinds, country, size = 30 } = {}) =>
  axiosInstance.get(ENDPOINT, {
    params: {
      ...(search ? { search } : {}),
      ...(kinds?.length ? { kinds: kinds.join(',') } : {}),
      ...(country ? { country } : {}),
      size,
    },
  }).then((res) => res.data);
