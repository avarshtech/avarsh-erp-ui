import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { antSelect, antFormFill, antFormSelect, antTableWaitForData, antModalConfirm, antPopconfirmYes, antDatePickerToday } from '../../helpers/antd-helpers.js';
import { navigateWithAuth, ensureSessionActive, goToListPage } from '../../helpers/navigation.js';

let api;
let createdFlowId;

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
});

test.describe('Approval Flows — API Tests', () => {
  test.beforeAll(async () => {
    api = await createAuthenticatedClient();
  });

  test.afterAll(async () => { await api.dispose(); });

  test('Get all approval flows', async () => {
    const res = await api.get('/approval-flows');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBeTruthy();
  });

  test('Create approval flow with levels', async () => {
    const timestamp = Date.now();
    const payload = {
      name: `E2E Approval Flow ${timestamp}`,
      entityType: 'PURCHASE_ORDER',
      levels: [
        {
          level: 1,
          approverRoleId: 1,
          description: 'Manager approval',
        },
        {
          level: 2,
          approverRoleId: 2,
          description: 'Director approval',
        },
      ],
    };

    const res = await api.post('/approval-flows', payload);
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('id');
    createdFlowId = res.data.id;
    expect(res.data.name).toBe(payload.name);
  });

  test('Update approval flow', async () => {
    expect(createdFlowId).toBeDefined();
    const { data: existing } = await api.get(`/approval-flows/${createdFlowId}`);

    const res = await api.put(`/approval-flows/${createdFlowId}`, {
      ...existing,
      name: `${existing.name} (Updated)`,
    });
    expect(res.status).toBe(200);
    expect(res.data.name).toContain('Updated');
  });

  test('Toggle active status', async () => {
    expect(createdFlowId).toBeDefined();

    const res = await api.patch(`/approval-flows/${createdFlowId}/toggle`);
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('active');
  });

  test('Delete approval flow', async () => {
    expect(createdFlowId).toBeDefined();

    const res = await api.delete(`/approval-flows/${createdFlowId}`);
    expect(res.status).toBe(200);
    createdFlowId = null;
  });

  test.afterAll(async () => {
    if (createdFlowId) {
      await api.delete(`/approval-flows/${createdFlowId}`);
    }
  });
});

test.describe('Approval Flows — UI Tests', () => {
  test('List page at /admin/approval-flows loads', async ({ page }) => {
    await goToListPage(page, '/admin/approval-flows');

    // The page should load and show either a table or a list of flows
    const content = page.locator('.ant-table, .ant-list, .ant-card').first();
    await expect(content).toBeVisible();
  });
});
