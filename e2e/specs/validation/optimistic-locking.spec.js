import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { ensureSessionActive } from '../../helpers/navigation.js';
import { costSheetPayload, stylePayload } from '../../helpers/test-data.js';
import { seedApprovedCosting, loadOrderRefs, buildOrderPayload } from '../../helpers/order-seed.js';
import { loadPoRefs, buildGeneralPo } from '../../helpers/po-seed.js';

let api;

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
});

test.describe('Optimistic Locking — API Tests', () => {
  test.beforeAll(async () => {
    api = await createAuthenticatedClient();
  });

  test.afterAll(async () => { await api.dispose(); });

  test('Buyer — stale version update returns 409', async () => {
    // Get buyer
    const { data: buyer } = await api.get('/buyers/1');
    expect(buyer).toHaveProperty('version');

    // Update buyer (increments version on server). The value must be unique per run:
    // a repeated identical value is a no-op save that does NOT bump the version, which
    // silently turns the "stale" write below into a current one.
    await api.post('/buyers', { ...buyer, contactPerson: `Updated by E2E ${Date.now()}` });

    // Try updating with stale version (old version number)
    const res = await api.post('/buyers', { ...buyer, contactPerson: 'Stale update' });
    expect(res.status).toBe(409);
    expect(res.data.error).toBe('OPTIMISTIC_LOCK_CONFLICT');
  });

  test('Supplier — stale version update returns 409', async () => {
    const { data: supplier } = await api.get('/suppliers/1');
    expect(supplier).toHaveProperty('version');

    await api.post('/suppliers', { ...supplier, contactPerson: `Updated by E2E ${Date.now()}` });

    const res = await api.post('/suppliers', { ...supplier, contactPerson: 'Stale update' });
    expect(res.status).toBe(409);
    expect(res.data.error).toBe('OPTIMISTIC_LOCK_CONFLICT');
  });

  test('Category — stale version update returns 409', async () => {
    // A category of its own: renaming the seed's "Fabric" broke every later project that picks it by name
    const { data: category } = await api.post('/categories', { name: `E2E Lock Category ${Date.now() % 100000}` });
    expect(category).toHaveProperty('version');

    try {
      const first = await api.put(`/categories/${category.id}`, { ...category, name: `${category.name} renamed` });
      expect(first.status).toBeLessThan(300);

      const res = await api.put(`/categories/${category.id}`, { ...category, name: `${category.name} stale` });
      expect(res.status).toBe(409);
      expect(res.data.error).toBe('OPTIMISTIC_LOCK_CONFLICT');
    } finally {
      await api.delete(`/categories/${category.id}`);
    }
  });

  test('Category — a create sent with an existing id makes a new category and leaves that one alone', async () => {
    const { data: fabric } = await api.get('/categories/1');
    const res = await api.post('/categories', { ...fabric, name: `E2E Copied Category ${Date.now() % 100000}` });
    try {
      expect(res.status).toBeLessThan(300);
      expect(res.data.id).not.toBe(fabric.id);
      expect((await api.get('/categories/1')).data.name).toBe(fabric.name);
    } finally {
      if (res.data?.id && res.data.id !== fabric.id) await api.delete(`/categories/${res.data.id}`);
    }
  });

  test('Item — stale version update returns 409', async () => {
    const { data: item } = await api.get('/items/1');
    expect(item).toHaveProperty('version');

    // Items update via PUT /items/{id} — POST is create-only and trips the duplicate
    // classifier-triple guard instead of ever reaching the version check.
    await api.put(`/items/${item.id}`, { ...item, description: `Updated by E2E ${Date.now()}` });

    const res = await api.put(`/items/${item.id}`, { ...item, description: 'Stale update' });
    expect(res.status).toBe(409);
    expect(res.data.error).toBe('OPTIMISTIC_LOCK_CONFLICT');
  });

  // The three documents below are seeded as fresh drafts: picking "the newest record" and skipping
  // unless it was 'DRAFT' meant these never ran (cost sheets and POs say 'Draft').
  test('CostSheet — stale version update returns 409', async () => {
    const { data: buyers } = await api.get('/buyers');
    const buyerId = (buyers.content || buyers)[0].id;
    const { data: style } = await api.post('/styles', stylePayload(buyerId));
    const { data: created } = await api.post('/cost-sheets', costSheetPayload(buyerId, style.id));
    const { data: cs } = await api.get(`/cost-sheets/${created.id}`);
    expect(cs.status).toBe('Draft');
    expect(cs).toHaveProperty('version');

    const first = await api.post('/cost-sheets', { ...cs, profitPct: Number(cs.profitPct) + 0.1 });
    expect(first.status).toBeLessThan(300);

    const res = await api.post('/cost-sheets', { ...cs, profitPct: Number(cs.profitPct) + 0.2 });
    expect(res.status).toBe(409);
    expect(res.data.error).toBe('OPTIMISTIC_LOCK_CONFLICT');
  });

  test('Order — stale version update returns 409', async () => {
    const costing = await seedApprovedCosting(api);
    const refs = await loadOrderRefs(api, costing.buyerId);
    const { data: created } = await api.post('/orders', buildOrderPayload(costing, refs));
    const { data: order } = await api.get(`/orders/${created.id}`);
    expect(order.status).toBe('DRAFT');
    expect(order).toHaveProperty('version');

    const first = await api.put(`/orders/${order.id}`, { ...order, remarks: `Updated by E2E ${Date.now()}` });
    expect(first.status).toBeLessThan(300);

    const res = await api.put(`/orders/${order.id}`, { ...order, remarks: 'Stale update' });
    expect(res.status).toBe(409);
    expect(res.data.error).toBe('OPTIMISTIC_LOCK_CONFLICT');
  });

  test('PurchaseOrder — stale version update returns 409', async () => {
    const refs = await loadPoRefs(api);
    const { data: created } = await api.post('/purchase-orders', buildGeneralPo(refs.localSupplier, refs.item, refs.terms));
    const { data: po } = await api.get(`/purchase-orders/${created.id}`);
    expect(po.status).toBe('Draft');
    expect(po).toHaveProperty('version');

    const first = await api.put(`/purchase-orders/${po.id}`, { ...po, remarks: `Updated by E2E ${Date.now()}` });
    expect(first.status).toBeLessThan(300);

    const res = await api.put(`/purchase-orders/${po.id}`, { ...po, remarks: 'Stale update' });
    expect(res.status).toBe(409);
    expect(res.data.error).toBe('OPTIMISTIC_LOCK_CONFLICT');
  });
});
