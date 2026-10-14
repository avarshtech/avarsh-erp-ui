// The 401 refresh queue in the axios interceptor (2026-10-14). Calls answered 401 while a refresh is
// running wait for it, every waiting call is settled whichever way the refresh ends, and a failed
// refresh releases the lock: the session hang the test-release gate fixed must not come back.
// The server is a fake axios adapter; the refresh call (raw axios.post) is spied; the browser
// globals the interceptor and the session store read are stubbed.
//   npx vitest run src/services/core/axiosInstance.test.js
import { afterEach, beforeEach, describe, test, expect, vi } from 'vitest';
import axios, { AxiosError } from 'axios';

vi.mock('../../components/GlobalMessageEmitter', () => ({ emitMessage: vi.fn() }));
vi.mock('../../components/ConflictDialog', () => ({ emitConflict: vi.fn() }));

const memoryStorage = () => {
  const items = new Map();
  return {
    getItem: (k) => (items.has(k) ? items.get(k) : null),
    setItem: (k, v) => { items.set(k, String(v)); },
    removeItem: (k) => { items.delete(k); },
  };
};

const later = (ms, fn) => new Promise((resolve, reject) => {
  setTimeout(() => { try { resolve(fn()); } catch (e) { reject(e); } }, ms);
});

let api;
let session;
let served;

/** The API: 200 for the token 'fresh', 401 for anything else. */
const fakeServer = (config) => {
  const auth = config.headers?.Authorization;
  served.push(`${config.url} ${auth || '-'}`);
  const status = auth === 'Bearer fresh' ? 200 : 401;
  const response = { data: status === 200 ? { ok: config.url } : {}, status, statusText: String(status), headers: {}, config, request: {} };
  return status === 200
    ? Promise.resolve(response)
    : Promise.reject(new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_REQUEST', config, {}, response));
};

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('navigator', { onLine: true });
  vi.stubGlobal('window', { location: { pathname: '/orders/list' }, dispatchEvent: vi.fn(), atob: globalThis.atob });
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('sessionStorage', memoryStorage());
  ({ default: api } = await import('./axiosInstance'));
  session = await import('../auth/sessionStore');
  api.defaults.adapter = fakeServer;
  served = [];
  session.setAccessToken('stale');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('a 401 refreshes the token once and retries', () => {
  test('two calls refused together wait for one refresh, then both go through with the new token', async () => {
    const refresh = vi.spyOn(axios, 'post').mockImplementation(() => later(20, () => ({ data: { token: 'fresh' } })));
    const [orders, boms] = await Promise.all([api.get('/orders'), api.get('/boms')]);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh.mock.calls[0][0]).toMatch(/\/auth\/refresh$/);
    expect(orders.data).toEqual({ ok: '/orders' });
    expect(boms.data).toEqual({ ok: '/boms' });
    expect(session.getAccessToken()).toBe('fresh');
    expect(served.filter((s) => s.endsWith('Bearer fresh')).sort()).toEqual(['/boms Bearer fresh', '/orders Bearer fresh']);
  });

  test('a 401 from the login call itself is not refreshed', async () => {
    const refresh = vi.spyOn(axios, 'post');
    await expect(api.get('/auth/login')).rejects.toMatchObject({ response: { status: 401 } });
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('a failed refresh settles every waiting call and releases the lock', () => {
  test.each([
    ['the refresh call fails', () => later(20, () => { throw new Error('refresh refused'); })],
    ['the refresh answers without a token', () => later(20, () => ({ data: {} }))],
  ])('%s', async (_, refreshResult) => {
    const refresh = vi.spyOn(axios, 'post').mockImplementation(refreshResult);
    const results = await Promise.allSettled([api.get('/orders'), api.get('/boms')]);

    expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected']);
    expect(results.map((r) => r.reason.errorMessage)).toEqual(['Session expired. Please login again.', 'Session expired. Please login again.']);
    expect(session.getAccessToken()).toBeNull();

    // After signing in again, the next 401 starts a new refresh instead of queuing forever
    session.setAccessToken('stale');
    refresh.mockImplementation(() => later(5, () => ({ data: { token: 'fresh' } })));
    await expect(api.get('/orders')).resolves.toMatchObject({ data: { ok: '/orders' } });
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
