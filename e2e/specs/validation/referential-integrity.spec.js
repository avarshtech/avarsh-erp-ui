import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { antSelect, antFormFill, antFormSelect, antTableWaitForData, antModalConfirm, antPopconfirmYes, antDatePickerToday } from '../../helpers/antd-helpers.js';
import { navigateWithAuth, ensureSessionActive, goToListPage } from '../../helpers/navigation.js';

let api;

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
});

test.describe('Referential Integrity — API Tests', () => {
  test.beforeAll(async () => {
    api = await createAuthenticatedClient();
  });

  test.afterAll(async () => { await api.dispose(); });

  test('Category with SubCategories — DELETE returns 409', async () => {
    // Category ID 1 should have subcategories in seeded data
    const res = await api.delete('/categories/1');
    expect(res.status).toBe(409);
    expect(res.data.error).toBe('REFERENCE_CONSTRAINT');
  });

  test('SubCategory with ItemTypes — DELETE returns 409', async () => {
    // SubCategory ID 1 should have item types in seeded data
    const res = await api.delete('/sub-categories/1');
    expect(res.status).toBe(409);
    expect(res.data.error).toBe('REFERENCE_CONSTRAINT');
  });

  test('Buyer with Styles — DELETE returns 409', async () => {
    // Buyer ID 1 should have styles in seeded data
    const res = await api.delete('/buyers/1');
    expect(res.status).toBe(409);
    expect(res.data.error).toBe('REFERENCE_CONSTRAINT');
  });

  test('Supplier with POs — DELETE returns 409', async () => {
    // Supplier ID 1 should have purchase orders in seeded data
    const res = await api.delete('/suppliers/1');
    expect(res.status).toBe(409);
    expect(res.data.error).toBe('REFERENCE_CONSTRAINT');
  });

  test('Item with PO line items — DELETE returns 409', async () => {
    // Item ID 1 should be referenced in PO line items
    const res = await api.delete('/items/1');
    expect(res.status).toBe(409);
    expect(res.data.error).toBe('REFERENCE_CONSTRAINT');
  });

  test('Style with CostSheets — DELETE returns 409', async () => {
    // Style ID 1 should have cost sheets
    const res = await api.delete('/styles/1');
    expect(res.status).toBe(409);
    expect(res.data.error).toBe('REFERENCE_CONSTRAINT');
  });

  test('Process referenced in CostSheet manufacturing — DELETE returns 409', async () => {
    // Process ID 1 should be used in cost sheet manufacturing rows
    const res = await api.delete('/processes/1');
    expect(res.status).toBe(409);
    expect(res.data.error).toBe('REFERENCE_CONSTRAINT');
  });

  test('Overhead referenced in CostSheet overheads — DELETE returns 409', async () => {
    // Overhead ID 1 should be used in cost sheet overhead rows
    const res = await api.delete('/overheads/1');
    expect(res.status).toBe(409);
    expect(res.data.error).toBe('REFERENCE_CONSTRAINT');
  });

  test('Role assigned to users — DELETE returns 409', async () => {
    // Role ID 1 should be assigned to users
    const res = await api.delete('/roles/1');
    expect(res.status).toBe(409);
    expect(res.data.error).toBe('REFERENCE_CONSTRAINT');
  });

  test('UOM used by items — DELETE returns 409', async () => {
    // UOM ID 1 should be referenced by items
    const res = await api.delete('/unit-of-measures/1');
    expect(res.status).toBe(409);
    expect(res.data.error).toBe('REFERENCE_CONSTRAINT');
  });
});
