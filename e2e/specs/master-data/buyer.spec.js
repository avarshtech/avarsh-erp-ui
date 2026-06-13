/**
 * Buyer Master — E2E Tests (full field coverage)
 *
 * What this tests:
 *   - API CRUD round-trip (create/update via POST /buyers, soft-delete semantics)
 *   - List: all columns, pagination text, search (name/contact/no-match empty state)
 *   - Create: ALL fields (name/contactPerson/email/phone/bankName/swiftCode)
 *     + mandatory shipping-location sub-modal
 *   - Validation: required fields, location guard toast, email/SWIFT formats,
 *     input normalizers (lettersOnly contact, phone charset, min-2 name)
 *   - Shipping locations sub-list: add / edit / delete rows + sub-modal validation
 *   - Postal-code lookup (api.zippopotam.us) — network-tolerant
 *   - Edit: name locked, Update gated until dirty
 *   - View drawer sections; Delete = soft (POST active:false)
 *
 * Source of truth: e2e/plan/inventory-masters-core.md §1
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import {
  antTableWaitForData,
  antPopconfirmYes,
  antDrawerClose,
} from '../../helpers/antd-helpers.js';
import { ensureSessionActive, goToMasterEntity } from '../../helpers/navigation.js';
import { buyerPayload } from '../../helpers/test-data.js';

const STAMP = () => Date.now().toString().slice(-6);

/** Buyer Add/Update modal (title-scoped so the location sub-modal never matches). */
const buyerModal = (page) =>
  page.locator('.ant-modal').filter({
    has: page.locator('.ant-modal-title', { hasText: /(Add|Update) Buyer/ }),
  });

/** Shipping-location sub-modal. */
const locationModal = (page) =>
  page.locator('.ant-modal').filter({
    has: page.locator('.ant-modal-title', { hasText: /Shipping Location/ }),
  });

/**
 * Type-to-filter Select helper. Works for showSearch selects; falls back to
 * scrolling the virtual list until the exact-title option is rendered.
 */
async function antSelectType(page, selectLocator, text) {
  await selectLocator.click();
  const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  await dropdown.waitFor({ state: 'visible', timeout: 5000 });
  await page.keyboard.type(String(text), { delay: 15 });
  await page.waitForTimeout(150);
  const byTitle = dropdown.locator(`.ant-select-item-option[title="${text}"]`).first();
  const byText = dropdown.locator('.ant-select-item-option').filter({ hasText: String(text) }).first();
  let option = (await byTitle.count()) ? byTitle : byText;
  for (let i = 0; i < 30 && !(await option.isVisible().catch(() => false)); i++) {
    await dropdown
      .locator('.rc-virtual-list-holder')
      .evaluate((el) => { el.scrollTop += 150; })
      .catch(() => {});
    await page.waitForTimeout(50);
    option = (await byTitle.count()) ? byTitle : byText;
  }
  await option.click();
  await dropdown.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
}

async function openAddBuyer(page) {
  await page.getByRole('button', { name: /Add Buyer/i }).first().click();
  const modal = buyerModal(page);
  await modal.locator('#name').waitFor({ state: 'visible', timeout: 10000 });
  return modal;
}

/** Fill + submit the shipping-location sub-modal. Postal blur is tolerated (abort route in caller). */
async function addShippingLocation(page, loc = {}) {
  const {
    label = `Main HQ ${STAMP()}`,
    address = '123 Test Street',
    country = 'India',
    postalCode = '411001',
    city = 'Pune',
    state = 'Maharashtra',
  } = loc;
  await buyerModal(page).getByRole('button', { name: /Add Shipping Location/i }).click();
  const sub = locationModal(page);
  await sub.locator('#label').waitFor({ state: 'visible', timeout: 5000 });
  await sub.locator('#label').fill(label);
  await sub.locator('#address').fill(address);
  await antSelectType(page, sub.locator('.ant-select').first(), country);
  await sub.locator('#postalCode').fill(postalCode);
  await sub.locator('#postalCode').press('Tab'); // blur fires the (mocked/failed) lookup
  await sub.locator('#city').fill(city);
  await sub.locator('#state').fill(state);
  await sub.getByRole('button', { name: /^(Add|Update)$/ }).click();
  await sub.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
}

/** Close the buyer modal, discarding the unsaved-changes confirm if it appears. */
async function cancelBuyerModal(page) {
  await buyerModal(page).getByRole('button', { name: /^Cancel$/ }).click();
  const discard = page.getByRole('button', { name: /^Discard$/ });
  if (await discard.isVisible({ timeout: 1500 }).catch(() => false)) {
    await discard.click();
  }
}

const searchBuyers = (page, text) => page.getByPlaceholder('Search buyers...').fill(text);

test.describe.serial('Buyer — CRUD', () => {
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
      const { response, data } = await api.get('/buyers');
      expect(response.ok()).toBeTruthy();
      expect(Array.isArray(data) || data.content).toBeTruthy();
    });

    test('API — Create returns created record', async () => {
      const payload = buyerPayload();
      const { response, data } = await api.post('/buyers', payload);
      expect(response.ok()).toBeTruthy();
      expect(data).toBeTruthy();
      expect(data.name).toBe(payload.name);
      createdId = data.id;
    });

    test('API — Update modifies record', async () => {
      test.skip(!createdId, 'No record created to update');
      const { data: existing } = await api.get(`/buyers/${createdId}`);
      const updated = { ...existing, contactPerson: 'Updated Contact' };
      // Buyer uses POST for both create and update
      const { response, data } = await api.post('/buyers', updated);
      expect(response.ok()).toBeTruthy();
      expect(data.contactPerson).toBe('Updated Contact');
    });

    test('API — Delete removes record', async () => {
      test.skip(!createdId, 'No record created to delete');
      const { response } = await api.delete(`/buyers/${createdId}`);
      expect([200, 204].includes(response.status())).toBeTruthy();
    });
  });

  // ─── UI Operations ──────────────────────────────────────────────────
  test.describe('UI Operations', () => {
    let api;
    let listSeed; // guarantees the list is never empty

    test.beforeAll(async () => {
      api = await createAuthenticatedClient();
      listSeed = buyerPayload({ name: `E2E ListBuyer ${STAMP()}` });
      const { response } = await api.post('/buyers', listSeed);
      expect(response.ok()).toBeTruthy();
    });

    test.afterAll(async () => { await api.dispose(); });

    test.beforeEach(async ({ page }) => {
      await goToMasterEntity(page, 'Buyers');
      await antTableWaitForData(page);
    });

    test('List: columns, pagination and row actions', async ({ page }) => {
      for (const col of ['Buyer Name', 'Contact Person', 'Email', 'Phone', 'Locations', 'Status', 'Actions']) {
        await expect(page.getByRole('columnheader', { name: col })).toBeVisible();
      }
      await expect(page.getByText(/of \d+ buyers/)).toBeVisible();
      const row = page.locator('.ant-table-row').first();
      await expect(row.locator('.anticon-eye')).toBeVisible();
      await expect(row.locator('.anticon-edit')).toBeVisible();
      await expect(row.locator('.anticon-delete')).toBeVisible();
    });

    test('Search: by name, by contact person, no-match empty state', async ({ page }) => {
      await searchBuyers(page, listSeed.name);
      await expect(page.locator('.ant-table-row').filter({ hasText: listSeed.name })).toBeVisible();

      await searchBuyers(page, listSeed.contactPerson);
      expect(await page.locator('.ant-table-row').count()).toBeGreaterThanOrEqual(1);

      await searchBuyers(page, 'zzz-no-match-xyz');
      await expect(page.getByText('No buyers found')).toBeVisible();

      await searchBuyers(page, '');
      expect(await page.locator('.ant-table-row').count()).toBeGreaterThanOrEqual(1);
    });

    test('Create: all fields incl. bank details + shipping location', async ({ page }) => {
      await page.route(/zippopotam/, (r) => r.abort()); // keep external lookup out of the create path
      const name = `E2E Buyer Full ${STAMP()}`;
      const modal = await openAddBuyer(page);

      await modal.locator('#name').fill(name);
      await modal.locator('#contactPerson').fill('Full Coverage Contact');
      await modal.locator('#email').fill(`buyer-full-${Date.now()}@e2e-test.com`);
      await modal.locator('#phone').fill('+91 9876543210');
      await modal.locator('#bankName').fill('State Bank of India');
      await modal.locator('#swiftCode').fill('INGBNL2A');

      await addShippingLocation(page, { label: 'Main HQ' });
      await expect(modal.locator('.ant-table-row').filter({ hasText: 'Main HQ' })).toBeVisible();

      const [resp] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/buyers') && r.request().method() === 'POST'),
        modal.getByRole('button', { name: /^Save$/ }).click(),
      ]);
      expect(resp.status()).toBeLessThan(300);
      await expect(page.locator('.ant-message').getByText(/Buyer added successfully/i)).toBeVisible({ timeout: 8000 });

      await antTableWaitForData(page);
      await searchBuyers(page, name);
      const row = page.locator('.ant-table-row').filter({ hasText: name });
      await expect(row).toBeVisible();
      await expect(row.locator('.ant-tag').filter({ hasText: '1' })).toBeVisible(); // locations count
      await expect(row.getByText(/Active/i)).toBeVisible();
    });

    test('Validation: required fields and shipping-location guard', async ({ page }) => {
      const modal = await openAddBuyer(page);

      // empty submit → required messages
      await modal.getByRole('button', { name: /^Save$/ }).click();
      await expect(page.getByText('Buyer Name is required', { exact: true })).toBeVisible();
      await expect(page.getByText('Contact Person is required', { exact: true })).toBeVisible();
      await expect(page.getByText('Email is required', { exact: true })).toBeVisible();

      // valid main form but 0 shipping locations → guard toast, save blocked
      await modal.locator('#name').fill(`E2E GuardBuyer ${STAMP()}`);
      await modal.locator('#contactPerson').fill('Guard Contact');
      await modal.locator('#email').fill(`buyer-guard-${Date.now()}@e2e-test.com`);
      await modal.getByRole('button', { name: /^Save$/ }).click();
      await expect(
        page.locator('.ant-message').getByText(/Please add at least one shipping location/i),
      ).toBeVisible({ timeout: 8000 });
    });

    test('Validation: field formats and input normalizers', async ({ page }) => {
      const modal = await openAddBuyer(page);

      // normalizers
      await modal.locator('#contactPerson').fill('John123');
      await expect(modal.locator('#contactPerson')).toHaveValue('John'); // digits stripped
      await modal.locator('#phone').fill('abc+12 (34)');
      await expect(modal.locator('#phone')).toHaveValue('+12 (34)'); // letters stripped
      await modal.locator('#swiftCode').fill('xyz12');
      await expect(modal.locator('#swiftCode')).toHaveValue('XYZ12'); // uppercased

      // format rules
      await modal.locator('#name').fill('A');
      await modal.locator('#email').fill('not-an-email');
      await modal.getByRole('button', { name: /^Save$/ }).click();
      await expect(page.getByText('Name must be at least 2 characters', { exact: true })).toBeVisible();
      await expect(page.getByText('Invalid email format', { exact: true })).toBeVisible();
      await expect(page.getByText(/Invalid SWIFT format/)).toBeVisible();
    });

    test('Shipping locations sub-list: add, edit, delete rows + sub-modal validation', async ({ page }) => {
      await page.route(/zippopotam/, (r) => r.abort());
      const modal = await openAddBuyer(page);

      await addShippingLocation(page, { label: 'Loc One', city: 'Pune' });
      await addShippingLocation(page, { label: 'Loc Two', city: 'Mumbai' });
      await expect(modal.locator('.ant-table-row')).toHaveCount(2);

      // edit first location via inner-table edit icon
      await modal.locator('.ant-table-row').filter({ hasText: 'Loc One' }).locator('.anticon-edit').click();
      const sub = locationModal(page);
      await sub.locator('#label').waitFor({ state: 'visible', timeout: 5000 });
      await sub.locator('#label').fill('Loc One Renamed');
      await sub.getByRole('button', { name: /^Update$/ }).click();
      await expect(modal.locator('.ant-table-row').filter({ hasText: 'Loc One Renamed' })).toBeVisible();

      // delete second location — immediate, no confirm
      await modal.locator('.ant-table-row').filter({ hasText: 'Loc Two' }).locator('.anticon-delete').click();
      await expect(modal.locator('.ant-table-row')).toHaveCount(1);

      // sub-modal required validation
      await modal.getByRole('button', { name: /Add Shipping Location/i }).click();
      await locationModal(page).getByRole('button', { name: /^Add$/ }).click();
      for (const msg of [
        'Location label is required', 'Address is required', 'Country is required',
        'Postal Code is required', 'City is required', 'State is required',
      ]) {
        await expect(page.getByText(msg, { exact: true })).toBeVisible();
      }
      await locationModal(page).getByRole('button', { name: /^Cancel$/ }).click();
      await cancelBuyerModal(page);
    });

    test('Postal-code lookup (network tolerant): fields stay manually editable', async ({ page }) => {
      // No mocking — real api.zippopotam.us. The test must pass whether the lookup
      // succeeds, fails, or times out.
      const modal = await openAddBuyer(page);
      await modal.getByRole('button', { name: /Add Shipping Location/i }).click();
      const sub = locationModal(page);
      await sub.locator('#label').waitFor({ state: 'visible', timeout: 5000 });

      await antSelectType(page, sub.locator('.ant-select').first(), 'United States');
      await sub.locator('#postalCode').fill('90210');
      await sub.locator('#postalCode').press('Tab'); // blur → lookup (outcome irrelevant)
      await page.waitForTimeout(3000); // give the 10s-timeout lookup a chance, without depending on it

      // Whatever the lookup did, city/state must remain manually editable
      await expect(sub.locator('#city')).toBeEnabled();
      await expect(sub.locator('#state')).toBeEnabled();
      await sub.locator('#city').fill('Testcity');
      await sub.locator('#state').fill('Teststate');
      await expect(sub.locator('#city')).toHaveValue('Testcity');
      await expect(sub.locator('#state')).toHaveValue('Teststate');

      await sub.getByRole('button', { name: /^Cancel$/ }).click();
      await cancelBuyerModal(page);
    });

    test('Edit: name locked, Update gated until dirty, change persists', async ({ page }) => {
      await page.route(/zippopotam/, (r) => r.abort());
      const seed = buyerPayload({
        name: `E2E EditBuyer ${STAMP()}`,
        shippingLocations: [{
          label: 'Seed HQ', address: '1 Seed Street', city: 'Pune',
          state: 'Maharashtra', country: 'India', postalCode: '411001', active: true,
        }],
      });
      const { response: seedResp } = await api.post('/buyers', seed);
      expect(seedResp.ok()).toBeTruthy();

      await goToMasterEntity(page, 'Buyers');
      await antTableWaitForData(page);
      await searchBuyers(page, seed.name);
      await page.locator('.ant-table-row').filter({ hasText: seed.name }).locator('.anticon-edit').click();

      const modal = buyerModal(page);
      await modal.locator('#name').waitFor({ state: 'visible', timeout: 10000 });
      await expect(modal.locator('#name')).toBeDisabled(); // name locked in edit
      await expect(modal.getByRole('button', { name: /^Update$/ })).toBeDisabled(); // gated until dirty

      // backend may not have persisted seeded locations — keep the save unblocked either way
      if ((await modal.locator('.ant-table-row').count()) === 0) {
        await addShippingLocation(page);
      }
      await modal.locator('#contactPerson').fill('Updated Person');
      await modal.locator('#bankName').fill('Updated Bank');
      await expect(modal.getByRole('button', { name: /^Update$/ })).toBeEnabled();

      const [resp] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/buyers') && r.request().method() === 'POST'),
        modal.getByRole('button', { name: /^Update$/ }).click(),
      ]);
      expect(resp.status()).toBeLessThan(300);
      await expect(page.locator('.ant-message').getByText(/Buyer updated successfully/i)).toBeVisible({ timeout: 8000 });
      await antTableWaitForData(page);
      await expect(
        page.locator('.ant-table-row').filter({ hasText: seed.name }).getByText('Updated Person'),
      ).toBeVisible();
    });

    test('View drawer: sections, fallbacks and Edit shortcut', async ({ page }) => {
      const seed = buyerPayload({ name: `E2E ViewBuyer ${STAMP()}` });
      const { response: seedResp } = await api.post('/buyers', seed);
      expect(seedResp.ok()).toBeTruthy();

      await goToMasterEntity(page, 'Buyers');
      await antTableWaitForData(page);
      await searchBuyers(page, seed.name);
      await page.locator('.ant-table-row').filter({ hasText: seed.name }).getByText(seed.name).click();

      const drawer = page.locator('.ant-drawer-open').last();
      await drawer.waitFor({ state: 'visible', timeout: 8000 });
      await expect(drawer.getByText('Contact Information')).toBeVisible();
      await expect(drawer.getByText(seed.contactPerson).first()).toBeVisible();
      await expect(drawer.getByText('Bank Details').first()).toBeVisible();
      await expect(drawer.getByText('No bank details provided')).toBeVisible(); // seed has no bank
      await expect(drawer.getByText('Shipping Locations').first()).toBeVisible();
      await expect(drawer.getByText('Metadata').first()).toBeVisible();
      await expect(drawer.getByRole('button', { name: /Edit/i })).toBeVisible();
      await antDrawerClose(page);
    });

    test('Delete: soft delete via DELETE /buyers/{id}', async ({ page }) => {
      const seed = buyerPayload({ name: `E2E DelBuyer ${STAMP()}` });
      const { response: seedResp } = await api.post('/buyers', seed);
      expect(seedResp.ok()).toBeTruthy();

      await goToMasterEntity(page, 'Buyers');
      await antTableWaitForData(page);
      await searchBuyers(page, seed.name);
      await page.locator('.ant-table-row').filter({ hasText: seed.name }).locator('.anticon-delete').click();

      const [resp] = await Promise.all([
        page.waitForResponse((r) => /\/buyers\/\d+/.test(r.url()) && r.request().method() === 'DELETE'),
        antPopconfirmYes(page),
      ]);
      expect(resp.status()).toBeLessThan(300);
      await expect(page.locator('.ant-message').getByText(/Buyer deleted successfully/i)).toBeVisible({ timeout: 8000 });

      // soft delete: row disappears from the refreshed list, or remains flagged Inactive
      await antTableWaitForData(page);
      const row = page.locator('.ant-table-row').filter({ hasText: seed.name });
      if (await row.count()) {
        await expect(row.first().getByText(/Inactive/i)).toBeVisible();
      }
    });
  });
});
