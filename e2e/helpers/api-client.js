/**
 * Authenticated API Client for E2E Tests
 *
 * Wraps Playwright's `request` API with JWT token management.
 * Used by both API-level tests and UI tests that need to seed/verify data.
 *
 * Usage:
 *   const api = await createAuthenticatedClient();
 *   const buyers = await api.get('/buyers');
 *   const created = await api.post('/buyers', { name: 'Test Buyer' });
 *   // When done (in afterAll):
 *   await api.dispose();
 */

import { request as playwrightRequest } from '@playwright/test';
import { E2E_API_URL, E2E_PASSWORD, E2E_USERNAME } from '../config/env.js';

const API_BASE = E2E_API_URL;

export class ApiClient {
  constructor(requestContext, ownsContext = false) {
    this.request = requestContext;
    this.token = null;
    this._ownsContext = ownsContext;
  }

  async login(username, password) {
    const user = username || E2E_USERNAME;
    const pass = password || E2E_PASSWORD;

    const response = await this.request.post(`${API_BASE}/auth/login`, {
      data: { username: user, password: pass },
    });

    if (!response.ok()) {
      throw new Error(`Login failed: ${response.status()} ${await response.text()}`);
    }

    const data = await response.json();
    this.token = data.token;
    this._credentials = { user, pass };
    return data;
  }

  /**
   * Run a request; when the access token has expired (a worker can outlive its hour-long
   * token in long runs), sign in again with the same credentials and retry once.
   */
  async #send(makeRequest) {
    let response = await makeRequest();
    if (response.status() === 401 && this._credentials) {
      let body = '';
      try { body = await response.text(); } catch { /* no body */ }
      if (/EXPIRED/i.test(body)) {
        await this.login(this._credentials.user, this._credentials.pass);
        response = await makeRequest();
      }
    }
    return response;
  }

  /**
   * `extra` merges per-request headers onto the auth header — the branch suites
   * send `X-Branch-Id` this way, which is how the server picks a working branch.
   */
  headers(extra) {
    if (!this.token) throw new Error('Not authenticated. Call login() first.');
    return { Authorization: `Bearer ${this.token}`, ...(extra || {}) };
  }

  /**
   * Parse the body whether or not the response is 2xx: error bodies carry the
   * error/message contract (REFERENCE_CONSTRAINT, OPTIMISTIC_LOCK_CONFLICT, …) that
   * the validation suites assert on. Discarding them made every such assertion a
   * TypeError instead of a meaningful failure.
   */
  async #result(response) {
    let data = null;
    try { data = await response.json(); } catch { /* non-JSON response */ }
    return { response, data, status: response.status() };
  }

  async get(path, params, extraHeaders) {
    const url = params
      ? `${API_BASE}${path}?${new URLSearchParams(params)}`
      : `${API_BASE}${path}`;
    const response = await this.#send(() => this.request.get(url, { headers: this.headers(extraHeaders) }));
    return this.#result(response);
  }

  async post(path, data, extraHeaders) {
    const response = await this.#send(() => this.request.post(`${API_BASE}${path}`, {
      headers: this.headers(extraHeaders),
      data,
    }));
    return this.#result(response);
  }

  async put(path, data, extraHeaders) {
    const response = await this.#send(() => this.request.put(`${API_BASE}${path}`, {
      headers: this.headers(extraHeaders),
      data,
    }));
    return this.#result(response);
  }

  async patch(path, data, extraHeaders) {
    const response = await this.#send(() => this.request.patch(`${API_BASE}${path}`, {
      headers: this.headers(extraHeaders),
      data,
    }));
    return this.#result(response);
  }

  async delete(path, extraHeaders) {
    const response = await this.#send(() => this.request.delete(`${API_BASE}${path}`, {
      headers: this.headers(extraHeaders),
    }));
    return this.#result(response);
  }

  /**
   * Dispose the underlying request context if we created it ourselves.
   * Call this in test.afterAll when using createAuthenticatedClient().
   */
  async dispose() {
    if (this._ownsContext && this.request) {
      await this.request.dispose();
    }
  }
}

/**
 * Create and authenticate an API client.
 * Creates its own APIRequestContext (safe for beforeAll/test reuse).
 * Remember to call api.dispose() in afterAll.
 */
export async function createAuthenticatedClient(username, password) {
  const context = await playwrightRequest.newContext();
  const api = new ApiClient(context, true);
  await api.login(username, password);
  return api;
}
