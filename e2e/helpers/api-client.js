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
import process from 'process';

const API_BASE = process.env.E2E_API_URL || 'http://localhost:8088/api/v1';

export class ApiClient {
  constructor(requestContext, ownsContext = false) {
    this.request = requestContext;
    this.token = null;
    this._ownsContext = ownsContext;
  }

  async login(username, password) {
    const user = username || process.env.E2E_USERNAME || 'superadmin';
    const pass = password || process.env.E2E_PASSWORD || 'admin123';

    const response = await this.request.post(`${API_BASE}/auth/login`, {
      data: { username: user, password: pass },
    });

    if (!response.ok()) {
      throw new Error(`Login failed: ${response.status()} ${await response.text()}`);
    }

    const data = await response.json();
    this.token = data.token;
    return data;
  }

  headers() {
    if (!this.token) throw new Error('Not authenticated. Call login() first.');
    return { Authorization: `Bearer ${this.token}` };
  }

  async get(path, params) {
    const url = params
      ? `${API_BASE}${path}?${new URLSearchParams(params)}`
      : `${API_BASE}${path}`;
    const response = await this.request.get(url, { headers: this.headers() });
    return { response, data: response.ok() ? await response.json() : null, status: response.status() };
  }

  async post(path, data) {
    const response = await this.request.post(`${API_BASE}${path}`, {
      headers: this.headers(),
      data,
    });
    return { response, data: response.ok() ? await response.json() : null, status: response.status() };
  }

  async put(path, data) {
    const response = await this.request.put(`${API_BASE}${path}`, {
      headers: this.headers(),
      data,
    });
    return { response, data: response.ok() ? await response.json() : null, status: response.status() };
  }

  async patch(path, data) {
    const response = await this.request.patch(`${API_BASE}${path}`, {
      headers: this.headers(),
      data,
    });
    return { response, data: response.ok() ? await response.json() : null, status: response.status() };
  }

  async delete(path) {
    const response = await this.request.delete(`${API_BASE}${path}`, {
      headers: this.headers(),
    });
    return { response, status: response.status() };
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
