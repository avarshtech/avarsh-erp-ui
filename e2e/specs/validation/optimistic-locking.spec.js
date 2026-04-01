import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { antSelect, antFormFill, antFormSelect, antTableWaitForData, antModalConfirm, antPopconfirmYes, antDatePickerToday } from '../../helpers/antd-helpers.js';
import { navigateWithAuth, ensureSessionActive, goToListPage } from '../../helpers/navigation.js';

let api;

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
});

test.describe('Optimistic Locking — API Tests', () => {
  test.beforeAll(async () => {
    api = await createAuthenticatedClient();
  });

  test('Buyer — stale version update returns 409', async () => {
    // Get buyer
    const { data: buyer } = await api.get('/buyers/1');
    expect(buyer).toHaveProperty('version');

    // Update buyer (increments version on server)
    await api.post('/buyers', { ...buyer, contactPerson: 'Updated by E2E' });

    // Try updating with stale version (old version number)
    const res = await api.post('/buyers', { ...buyer, contactPerson: 'Stale update' });
    expect(res.status).toBe(409);
    expect(res.data.error).toBe('OPTIMISTIC_LOCK_CONFLICT');
  });

  test('Supplier — stale version update returns 409', async () => {
    const { data: supplier } = await api.get('/suppliers/1');
    expect(supplier).toHaveProperty('version');

    await api.post('/suppliers', { ...supplier, contactPerson: 'Updated by E2E' });

    const res = await api.post('/suppliers', { ...supplier, contactPerson: 'Stale update' });
    expect(res.status).toBe(409);
    expect(res.data.error).toBe('OPTIMISTIC_LOCK_CONFLICT');
  });

  test('Category — stale version update returns 409', async () => {
    const { data: category } = await api.get('/categories/1');
    expect(category).toHaveProperty('version');

    await api.post('/categories', { ...category, name: `${category.name} updated` });

    const res = await api.post('/categories', { ...category, name: `${category.name} stale` });
    expect(res.status).toBe(409);
    expect(res.data.error).toBe('OPTIMISTIC_LOCK_CONFLICT');
  });

  test('Item — stale version update returns 409', async () => {
    const { data: item } = await api.get('/items/1');
    expect(item).toHaveProperty('version');

    await api.post('/items', { ...item, description: 'Updated by E2E' });

    const res = await api.post('/items', { ...item, description: 'Stale update' });
    expect(res.status).toBe(409);
    expect(res.data.error).toBe('OPTIMISTIC_LOCK_CONFLICT');
  });

  test('CostSheet — stale version update returns 409', async () => {
    // Get first cost sheet from search
    const searchRes = await api.get('/cost-sheets/search?page=0&size=1');
    const costSheets = searchRes.data.content;
    if (costSheets.length === 0) {
      test.skip();
      return;
    }

    const { data: cs } = await api.get(`/cost-sheets/${costSheets[0].id}`);
    expect(cs).toHaveProperty('version');

    // Only test if DRAFT (can be edited)
    if (cs.status !== 'DRAFT') {
      test.skip();
      return;
    }

    await api.post('/cost-sheets', { ...cs, profitPct: cs.profitPct + 0.1 });

    const res = await api.post('/cost-sheets', { ...cs, profitPct: cs.profitPct + 0.2 });
    expect(res.status).toBe(409);
    expect(res.data.error).toBe('OPTIMISTIC_LOCK_CONFLICT');
  });

  test('Order — stale version update returns 409', async () => {
    const searchRes = await api.get('/orders/search?page=0&size=1');
    const orders = searchRes.data.content;
    if (orders.length === 0) {
      test.skip();
      return;
    }

    const { data: order } = await api.get(`/orders/${orders[0].id}`);
    expect(order).toHaveProperty('version');

    if (order.status !== 'DRAFT') {
      test.skip();
      return;
    }

    await api.put(`/orders/${order.id}`, { ...order, remarks: 'Updated by E2E' });

    const res = await api.put(`/orders/${order.id}`, { ...order, remarks: 'Stale update' });
    expect(res.status).toBe(409);
    expect(res.data.error).toBe('OPTIMISTIC_LOCK_CONFLICT');
  });

  test('PurchaseOrder — stale version update returns 409', async () => {
    const searchRes = await api.get('/purchase-orders/search?page=0&size=1');
    const pos = searchRes.data.content;
    if (pos.length === 0) {
      test.skip();
      return;
    }

    const { data: po } = await api.get(`/purchase-orders/${pos[0].id}`);
    expect(po).toHaveProperty('version');

    if (po.status !== 'DRAFT') {
      test.skip();
      return;
    }

    await api.put(`/purchase-orders/${po.id}`, { ...po, remarks: 'Updated by E2E' });

    const res = await api.put(`/purchase-orders/${po.id}`, { ...po, remarks: 'Stale update' });
    expect(res.status).toBe(409);
    expect(res.data.error).toBe('OPTIMISTIC_LOCK_CONFLICT');
  });
});
