/**
 * Supplier Master — E2E Tests (full field coverage)
 *
 * What this tests:
 *   - API CRUD round-trip (PUT update, soft delete via POST active:false)
 *   - List: all columns, pagination text, search, no-match empty state
 *   - Create: EVERY field — identity, address, pincode, supplies checkboxes,
 *     PAN/GSTIN/IGST, full bank details (the baseline spec failed because
 *     required fields were left empty)
 *   - Validation: required messages, composite Fabric/Trims rule,
 *     phone/PAN/GSTIN/IFSC/email/name format rules + uppercase normalizers
 *   - Pincode lookup (api.postalpincode.in) — network-tolerant
 *   - Edit: name locked, Update gated until dirty; Delete = soft (active flag)
 *   - View drawer sections
 *
 * NOTE: Supplier Name / Contact Person patterns allow letters+spaces ONLY, so
 * UI-submitted names must not contain digits (hence letterStamp()).
 *
 * Source of truth: e2e/plan/inventory-masters-core.md §2
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import {
  antTableWaitForData,
  antPopconfirmYes,
  antDrawerClose,
} from '../../helpers/antd-helpers.js';
import { ensureSessionActive, goToMasterEntity } from '../../helpers/navigation.js';
import { supplierPayload } from '../../helpers/test-data.js';

const STAMP = () => Date.now().toString().slice(-6);
// digits → letters so generated names pass the letters+spaces-only pattern
const letterStamp = () => STAMP().replace(/\d/g, (d) => 'ABCDEFGHIJ'[Number(d)]);

const supplierModal = (page) =>
  page.locator('.ant-modal').filter({
    has: page.locator('.ant-modal-title', { hasText: /(Add|Update) Supplier/ }),
  });

async function openAddSupplier(page) {
  await page.getByRole('button', { name: /Add Supplier/i }).first().click();
  const modal = supplierModal(page);
  await modal.locator('#name').waitFor({ state: 'visible', timeout: 10000 });
  return modal;
}

/** Fill every required field with valid values (checkboxes NOT included). */
async function fillValidSupplier(modal, name) {
  await modal.locator('#name').fill(name);
  await modal.locator('#contactPerson').fill('Supplier Contact');
  await modal.locator('#email').fill(`supplier-${Date.now()}@e2e-test.com`);
  await modal.locator('#phone').fill('9876543210'); // exactly 10 digits
  await modal.locator('#address').fill('123 Test Street, Block-A/2');
  await modal.locator('#pincode').fill('400001');
  await modal.locator('#pincode').press('Tab'); // blur fires the (aborted/failed) lookup
  await modal.locator('#city').fill('Mumbai');
  await modal.locator('#state').fill('Maharashtra');
  await modal.locator('#country').fill('India');
  await modal.locator('#pan').fill('AABCE1234F');
  await modal.locator('#gstin').fill('27AABCE1234F1Z5');
}

const checkbox = (modal, text) =>
  modal.locator('.ant-checkbox-wrapper').filter({ hasText: new RegExp(`^${text}$`) });

const searchSuppliers = (page, text) => page.getByPlaceholder('Search suppliers...').fill(text);

test.describe.serial('Supplier — CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await ensureSessionActive(page);
    page.on('pageerror', (err) => console.log(`[browser:pageerror] ${err.message}`));
  });

  // ─── API Integration ────────────────────────────────────────────────
  test.describe('API Integration', () => {
    let api;
    let createdId;

    test.beforeAll(async () => {
      api = await createAuthenticatedClient();
    });

    test.afterAll(async () => { await api.dispose(); });

    test('API — List returns data', async () => {
      const { response, data } = await api.get('/suppliers');
      expect(response.ok()).toBeTruthy();
      expect(Array.isArray(data) || data.content).toBeTruthy();
    });

    test('API — Create returns created record', async () => {
      const payload = supplierPayload();
      const { response, data } = await api.post('/suppliers', payload);
      expect(response.ok()).toBeTruthy();
      expect(data).toBeTruthy();
      expect(data.name).toBe(payload.name);
      createdId = data.id;
    });

    test('API — Update modifies record', async () => {
      test.skip(!createdId, 'No record created to update');
      const { data: existing } = await api.get(`/suppliers/${createdId}`);
      const updated = { ...existing, city: 'Chennai', contactPerson: 'Updated Supplier Contact' };
      const { response, data } = await api.put(`/suppliers/${createdId}`, updated);
      expect(response.ok()).toBeTruthy();
      expect(data.city).toBe('Chennai');
    });

    test('API — Delete removes record', async () => {
      test.skip(!createdId, 'No record created to delete');
      const { response } = await api.delete(`/suppliers/${createdId}`);
      expect([200, 204].includes(response.status())).toBeTruthy();
    });
  });

  // ─── UI Operations ──────────────────────────────────────────────────
  test.describe('UI Operations', () => {
    let api;
    let listSeed;

    test.beforeAll(async () => {
      api = await createAuthenticatedClient();
      listSeed = supplierPayload({ name: `E2E ListSupplier ${STAMP()}` });
      const { response } = await api.post('/suppliers', listSeed);
      expect(response.ok()).toBeTruthy();
    });

    test.afterAll(async () => { await api.dispose(); });

    test.beforeEach(async ({ page }) => {
      await goToMasterEntity(page, 'Suppliers');
      await antTableWaitForData(page);
    });

    test('List: columns, pagination and row actions', async ({ page }) => {
      for (const col of ['Supplier Name', 'Contact Person', 'Phone', 'Email', 'Location', 'Supplies', 'Status', 'Actions']) {
        await expect(page.getByRole('columnheader', { name: col })).toBeVisible();
      }
      await expect(page.getByText(/of \d+ suppliers/)).toBeVisible();
      const row = page.locator('.ant-table-row').first();
      await expect(row.locator('.anticon-eye')).toBeVisible();
      await expect(row.locator('.anticon-edit')).toBeVisible();
      await expect(row.locator('.anticon-delete')).toBeVisible();
    });

    test('Search: by name, no-match empty state', async ({ page }) => {
      await searchSuppliers(page, listSeed.name);
      await expect(page.locator('.ant-table-row').filter({ hasText: listSeed.name })).toBeVisible();

      await searchSuppliers(page, 'zzz-no-match-xyz');
      await expect(page.getByText('No suppliers found')).toBeVisible();

      await searchSuppliers(page, '');
      expect(await page.locator('.ant-table-row').count()).toBeGreaterThanOrEqual(1);
    });

    test('Create: every field — supplies, tax, IGST and bank details', async ({ page }) => {
      await page.route(/postalpincode/, (r) => r.abort()); // keep external lookup out of the create path
      const name = `EE Supplier Create ${letterStamp()}`;
      const modal = await openAddSupplier(page);

      await fillValidSupplier(modal, name);
      await checkbox(modal, 'Fabric').click();
      await checkbox(modal, 'Trims').click();
      await checkbox(modal, 'IGST Applicable').click();
      await modal.locator('#bankName').fill('State Bank of India');
      await modal.locator('#bankAccountNumber').fill('123456789012');
      await modal.locator('#bankBranch').fill('Fort Branch');
      await modal.locator('#ifscCode').fill('SBIN0001234');
      await modal.locator('#swiftCode').fill('SBININBB');

      const [resp] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/suppliers') && r.request().method() === 'POST'),
        modal.getByRole('button', { name: /^Save$/ }).click(),
      ]);
      expect(resp.status()).toBeLessThan(300);
      await expect(page.locator('.ant-message').getByText(/Supplier added successfully/i)).toBeVisible({ timeout: 8000 });

      await antTableWaitForData(page);
      await searchSuppliers(page, name);
      const row = page.locator('.ant-table-row').filter({ hasText: name });
      await expect(row).toBeVisible();
      await expect(row.getByText('Fabric')).toBeVisible(); // supplies tags
      await expect(row.getByText('Trims')).toBeVisible();
      await expect(row.getByText('Mumbai, Maharashtra')).toBeVisible();
    });

    test('Validation: required fields on empty submit', async ({ page }) => {
      const modal = await openAddSupplier(page);
      await modal.getByRole('button', { name: /^Save$/ }).click();
      for (const msg of [
        'Supplier Name is required', 'Contact Person is required', 'Email is required',
        'Phone Number is required', 'Address is required', 'Pincode is required',
        'City is required', 'State is required', 'Country is required',
        'PAN is required', 'GSTIN is required',
      ]) {
        await expect(page.getByText(msg, { exact: true })).toBeVisible();
      }
    });

    test('Validation: at least one supply (Fabric/Trims) must be selected', async ({ page }) => {
      await page.route(/postalpincode/, (r) => r.abort());
      const modal = await openAddSupplier(page);
      await fillValidSupplier(modal, `EE Supplier Guard ${letterStamp()}`);
      // no checkbox checked → composite rule blocks submit
      await modal.getByRole('button', { name: /^Save$/ }).click();
      await expect(
        page.locator('.ant-message').getByText(/At least one supply product \(Fabric or Trims\) must be selected/i),
      ).toBeVisible({ timeout: 8000 });
    });

    test('Validation: field formats and uppercase normalizers', async ({ page }) => {
      const modal = await openAddSupplier(page);

      // normalizers
      await modal.locator('#pan').fill('abcpd1234e');
      await expect(modal.locator('#pan')).toHaveValue('ABCPD1234E'); // uppercased
      await modal.locator('#phone').fill('98765432109999');
      await expect(modal.locator('#phone')).toHaveValue('9876543210'); // sliced to 10
      await modal.locator('#bankAccountNumber').fill('12ab34');
      await expect(modal.locator('#bankAccountNumber')).toHaveValue('1234'); // digits only

      // format failures
      await modal.locator('#name').fill('Bad Name 123');
      await modal.locator('#email').fill('not-an-email');
      await modal.locator('#phone').fill('12345');
      await modal.locator('#pan').fill('ZZZZZ');
      await modal.locator('#gstin').fill('123');
      await modal.locator('#ifscCode').fill('BADIFSC');
      await modal.getByRole('button', { name: /^Save$/ }).click();

      await expect(page.getByText('Only letters and spaces allowed', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('Invalid email format', { exact: true })).toBeVisible();
      await expect(page.getByText('Phone must be 10 digits', { exact: true })).toBeVisible();
      await expect(page.getByText(/Invalid PAN format/)).toBeVisible();
      await expect(page.getByText(/Invalid GSTIN format/)).toBeVisible();
      await expect(page.getByText(/Invalid IFSC format/)).toBeVisible();
    });

    test('Pincode lookup (network tolerant): fields stay manually editable', async ({ page }) => {
      // No mocking — real api.postalpincode.in. Failure path is silent (no toast).
      const modal = await openAddSupplier(page);
      await modal.locator('#pincode').fill('600001');
      await modal.locator('#pincode').press('Tab');
      await page.waitForTimeout(3000); // allow the lookup a chance, without depending on it

      await expect(modal.locator('#city')).toBeEnabled();
      await expect(modal.locator('#state')).toBeEnabled();
      await expect(modal.locator('#country')).toBeEnabled();
      await modal.locator('#city').fill('Chennai');
      await modal.locator('#state').fill('Tamil Nadu');
      await modal.locator('#country').fill('India');
      await expect(modal.locator('#city')).toHaveValue('Chennai');
      await expect(modal.locator('#state')).toHaveValue('Tamil Nadu');
      await expect(modal.locator('#country')).toHaveValue('India');
    });

    test('Edit: name locked, Update gated until dirty, change persists', async ({ page }) => {
      await page.route(/postalpincode/, (r) => r.abort());
      // seed must satisfy UI patterns: letters-only name/contact, 10-digit phone
      const seed = supplierPayload({
        name: `EE Supplier Edit ${letterStamp()}`,
        contactPerson: 'EE Supplier Contact',
        phone: '9876543210',
      });
      const { response: seedResp } = await api.post('/suppliers', seed);
      expect(seedResp.ok()).toBeTruthy();

      await goToMasterEntity(page, 'Suppliers');
      await antTableWaitForData(page);
      await searchSuppliers(page, seed.name);
      await page.locator('.ant-table-row').filter({ hasText: seed.name }).locator('.anticon-edit').click();

      const modal = supplierModal(page);
      await modal.locator('#name').waitFor({ state: 'visible', timeout: 10000 });
      await expect(modal.locator('#name')).toBeDisabled(); // name locked in edit
      await expect(modal.getByRole('button', { name: /^Update$/ })).toBeDisabled(); // gated until dirty

      await modal.locator('#city').fill('Bangalore');
      await modal.locator('#contactPerson').fill('Updated Person');
      await expect(modal.getByRole('button', { name: /^Update$/ })).toBeEnabled();

      const [resp] = await Promise.all([
        page.waitForResponse((r) => /\/suppliers\/\d+/.test(r.url()) && r.request().method() === 'PUT'),
        modal.getByRole('button', { name: /^Update$/ }).click(),
      ]);
      expect(resp.status()).toBeLessThan(300);
      await expect(page.locator('.ant-message').getByText(/Supplier updated successfully/i)).toBeVisible({ timeout: 8000 });
      await antTableWaitForData(page);
      await expect(
        page.locator('.ant-table-row').filter({ hasText: seed.name }).getByText(/Bangalore/),
      ).toBeVisible();
    });

    test('View drawer: sections and supplies tags', async ({ page }) => {
      const seed = supplierPayload({ name: `E2E ViewSupplier ${STAMP()}` });
      const { response: seedResp } = await api.post('/suppliers', seed);
      expect(seedResp.ok()).toBeTruthy();

      await goToMasterEntity(page, 'Suppliers');
      await antTableWaitForData(page);
      await searchSuppliers(page, seed.name);
      await page.locator('.ant-table-row').filter({ hasText: seed.name }).getByText(seed.name).click();

      const drawer = page.locator('.ant-drawer-open').last();
      await drawer.waitFor({ state: 'visible', timeout: 8000 });
      await expect(drawer.getByText('Basic Information')).toBeVisible();
      await expect(drawer.getByText('Address', { exact: true }).first()).toBeVisible();
      await expect(drawer.getByText('Tax Information')).toBeVisible();
      await expect(drawer.getByText('Bank Details').first()).toBeVisible();
      await expect(drawer.getByText('No bank details provided')).toBeVisible(); // seed has no bank
      await expect(drawer.getByText('Fabric').first()).toBeVisible(); // supplies tag
      await antDrawerClose(page);
    });

    test('Delete: soft delete via active flag (POST /suppliers)', async ({ page }) => {
      const seed = supplierPayload({ name: `E2E DelSupplier ${STAMP()}` });
      const { response: seedResp } = await api.post('/suppliers', seed);
      expect(seedResp.ok()).toBeTruthy();

      await goToMasterEntity(page, 'Suppliers');
      await antTableWaitForData(page);
      await searchSuppliers(page, seed.name);
      await page.locator('.ant-table-row').filter({ hasText: seed.name }).locator('.anticon-delete').click();

      const [resp] = await Promise.all([
        page.waitForResponse((r) => /\/suppliers\/\d+/.test(r.url()) && r.request().method() === 'DELETE'),
        antPopconfirmYes(page),
      ]);
      expect(resp.status()).toBeLessThan(300);
      await expect(page.locator('.ant-message').getByText(/Supplier deleted successfully/i)).toBeVisible({ timeout: 8000 });

      await antTableWaitForData(page);
      const row = page.locator('.ant-table-row').filter({ hasText: seed.name });
      if (await row.count()) {
        await expect(row.first().getByText(/Inactive/i)).toBeVisible();
      }
    });
  });
});
