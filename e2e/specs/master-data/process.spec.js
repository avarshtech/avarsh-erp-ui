/**
 * Process Master — API round-trip (no GET-by-id endpoint exists: the update is built from the create
 * response). The screen is covered by process-ui.spec.js.
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { ensureSessionActive } from '../../helpers/navigation.js';
import { processPayload } from '../../helpers/test-data.js';


test.describe.serial('Process — CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await ensureSessionActive(page);
    page.on('pageerror', (err) => console.log(`[browser:pageerror] ${err.message}`));
  });

  // ─── API Integration ────────────────────────────────────────────────
  test.describe('API Integration', () => {
    let api;
    let created;

    test.beforeAll(async () => {
      api = await createAuthenticatedClient();
    });

    test.afterAll(async () => { await api.dispose(); });

    test('API — List returns data', async () => {
      const { response, data } = await api.get('/processes');
      expect(response.ok()).toBeTruthy();
      expect(Array.isArray(data) || data.content).toBeTruthy();
    });

    test('API — Create returns created record', async () => {
      const payload = processPayload();
      const { response, data } = await api.post('/processes', payload);
      expect(response.ok()).toBeTruthy();
      expect(data).toBeTruthy();
      expect(data.processName).toBe(payload.processName);
      created = data;
    });

    test('API — Update modifies record', async () => {
      test.skip(!created?.id, 'No record created to update');
      // No GET /processes/{id} endpoint — build the PUT body from the create response.
      const { response, data } = await api.put(`/processes/${created.id}`, {
        ...created,
        description: 'Updated by E2E',
        defaultCost: 25.0,
        version: created.version ?? 0,
      });
      expect(response.ok()).toBeTruthy();
      expect(data.description).toBe('Updated by E2E');
    });

    test('API — Delete removes record', async () => {
      test.skip(!created?.id, 'No record created to delete');
      const { response } = await api.delete(`/processes/${created.id}`);
      expect([200, 204].includes(response.status())).toBeTruthy();
    });
  });


  // The screen itself (category-driven Type) is covered by process-ui.spec.js.
});
