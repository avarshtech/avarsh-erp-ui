import axiosInstance from '../core/axiosInstance';

/**
 * The stored rate the server will save the cost sheet with — {rate, date, source} — or null
 * when none is stored (404), so the sheet can ask for one instead of guessing.
 */
export const getStoredRate = async (from, to) => {
  if (!from || !to || from === to) return { rate: 1, date: null, source: 'SAME' };
  try {
    const { data } = await axiosInstance.get('/exchange-rates/today', { params: { from, to }, silent: true });
    return data?.rate ? data : null;
  } catch {
    return null;
  }
};

const LIVE_TTL_MS = 30 * 60 * 1000;
const liveCache = new Map(); // base currency → { at, promise }

/** Today's market rate from the live exchange API — {rate, date, source: 'LIVE'} — or null when unreachable. */
export const getLiveRate = async (from, to) => {
  if (!from || !to || from === to) return { rate: 1, date: null, source: 'SAME' };
  let hit = liveCache.get(from);
  if (!hit || Date.now() - hit.at > LIVE_TTL_MS) {
    const promise = fetch(`https://open.er-api.com/v6/latest/${from}`).then((r) => r.json()).catch(() => null);
    hit = { at: Date.now(), promise };
    liveCache.set(from, hit);
  }
  const data = await hit.promise;
  if (data?.result !== 'success' || !data.rates?.[to]) { liveCache.delete(from); return null; }
  return { rate: data.rates[to], date: new Date(data.time_last_update_unix * 1000).toISOString(), source: 'LIVE' };
};
