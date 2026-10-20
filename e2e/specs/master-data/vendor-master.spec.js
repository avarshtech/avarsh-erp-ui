/**
 * Vendor master and the job-work process fields — E2E
 *
 * Job workers are vendors (Master Data › Vendors), no longer flagged suppliers. The Cut Panel PO and
 * Garment Process PO offer only vendors that do a process of the PO's category and hold a current
 * approval, and they tax and bill from the process master. These tests pin the master side:
 *   - API: a vendor round-trips its processes (ascending), approval date and payment terms; an
 *     update needs its version; delete deactivates and keeps it listable with includeInactive.
 *   - API: a vendor needs at least one process, of any category; the API otherwise requires only the
 *     name (the form asks for what the Supplier form asks for); a filled GSTIN is unique among active vendors.
 *   - API: the pickers' options carry each process's category and no PAN or bank details.
 *   - API: 'Cut Panel' / 'Garment' processes require SAC code, GST % and a billing unit (Garment:
 *     Piece, Dozen or Kg only); a process an active vendor does cannot be deleted; once that vendor is
 *     deactivated the process moves and deletes freely.
 *   - UI: the form requires what the Supplier form requires (contact, phone, email, address, pincode,
 *     city, state, country, GSTIN, PAN); a complete vendor saves with its processes and approval.
 *   - UI: an edit whose PAN and bank details failed to load cannot save until a retry loads them
 *     (the update replaces them, so saving blanks would erase what is stored).
 *   - UI: choosing a job-work category pre-fills SAC 998821, GST 5 % and Piece.
 *
 * Vendors created here are deactivated at the end of each test.
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { antTableWaitForData, antFormSelect } from '../../helpers/antd-helpers.js';
import { ensureSessionActive, goToMasterEntity } from '../../helpers/navigation.js';

const STAMP = () => Date.now().toString().slice(-6);
const COST_FIELDS = { defaultCost: 0, defaultShrinkageInches: 0, defaultProcessLossPercent: 0, defaultRejectionPercent: 0, defaultShipmentAllowancePercent: 0 };

let api;
let cutPanel;
let garment;
let manufacturing;

test.beforeAll(async () => {
  api = await createAuthenticatedClient();
  const byCategory = async (category) => (await api.get(`/processes/active?category=${encodeURIComponent(category)}`)).data;
  cutPanel = (await byCategory('Cut Panel')).find((p) => p.processName === 'Panel Printing');
  garment = (await byCategory('Garment')).find((p) => p.processName === 'Enzyme Washing');
  manufacturing = (await byCategory('Manufacturing'))[0];
});

test.afterAll(async () => { await api.dispose(); });

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
});

// Every field the form requires, so a vendor made here can also be saved from the form (GSTIN apart:
// it is unique among active vendors, so a test that needs one passes its own)
const vendor = (overrides = {}) => ({
  name: `E2E Vendor ${STAMP()}`, contactPerson: 'R Selvam', phone: '9840012345', email: 'jobs@e2e-vendor.in',
  address: '14 Kumaran Road', pincode: '641604', city: 'Tiruppur', state: 'Tamil Nadu', country: 'India',
  processIds: [garment.id, cutPanel.id], jobWorkApprovedUntil: '2027-03-31', paymentTerms: '30 Days Credit',
  active: true, ...overrides,
});
// A PAN of a firm (4th letter F) and the GSTIN that carries it, unique per call
const uniquePan = () => `AAPFU${STAMP().slice(-4)}K`;
const gstinOf = (pan) => `33${pan}1Z9`;

test('API — a vendor round-trips processes, approval and terms; update needs its version; delete deactivates', async () => {
  expect(cutPanel?.sacCode).toBe('998821');
  expect(Number(garment?.gstRatePercent)).toBe(5);
  expect(garment?.defaultUom).toBe('PIECE');

  const { response, data: created } = await api.post('/vendors', vendor({ pan: 'aapfs1234k' }));
  expect(response.status()).toBe(201);
  expect(created.id).toBeGreaterThanOrEqual(1000001);
  expect(created.processIds).toEqual([cutPanel.id, garment.id].sort((a, b) => a - b));
  expect(created.jobWorkApprovedUntil).toBe('2027-03-31');
  expect(created.pan).toBe('AAPFS1234K');

  const noVersion = await api.put(`/vendors/${created.id}`, { ...created, version: null });
  expect(noVersion.response.status()).toBe(400);

  const { data: updated } = await api.put(`/vendors/${created.id}`, {
    ...created, paymentTerms: '45 Days Credit', processIds: [garment.id],
  });
  expect(updated.paymentTerms).toBe('45 Days Credit');
  expect(updated.processIds).toEqual([garment.id]);
  expect(updated.version).toBeGreaterThan(created.version);

  expect((await api.delete(`/vendors/${created.id}`)).response.status()).toBe(204);
  const active = (await api.get('/vendors')).data;
  expect(active.some((v) => v.id === created.id)).toBe(false);
  const all = (await api.get('/vendors', { includeInactive: true })).data;
  expect(all.find((v) => v.id === created.id)).toMatchObject({ active: false, processIds: [garment.id] });
  expect(all.find((v) => v.id === created.id).pan).toBeFalsy(); // the list never carries PAN
});

test('API — any category, at least one process; one active vendor per GSTIN', async () => {
  const none = await api.post('/vendors', vendor({ processIds: [] }));
  expect(none.response.status()).toBe(400);
  expect(JSON.stringify(none.data)).toContain('at least one process');

  const { response: cmt, data: stitching } = await api.post('/vendors', vendor({ processIds: [manufacturing.id], jobWorkApprovedUntil: null }));
  expect(cmt.status()).toBe(201);

  const gstin = `33AAPFV${STAMP().slice(0, 4)}K1Z9`;
  const { data: first } = await api.post('/vendors', vendor({ gstin }));
  const twin = await api.post('/vendors', vendor({ gstin }));
  expect(twin.response.status()).toBe(409);
  expect(twin.data.message).toContain(first.name);
  const { response: inactiveTwin, data: secondUnit } = await api.post('/vendors', vendor({ gstin, active: false }));
  expect(inactiveTwin.status()).toBe(201);

  for (const v of [stitching, first, secondUnit]) await api.delete(`/vendors/${v.id}`);
});

test('API — the pickers read options: categories named, no PAN or bank details', async () => {
  const { data: created } = await api.post('/vendors', vendor({ pan: 'AAPFS1234K', bankAccountNumber: '50100012345678' }));
  const options = (await api.get('/vendors/options')).data;
  const option = options.find((o) => o.id === created.id);
  expect(option.processes.map((p) => p.category).sort()).toEqual(['Cut Panel', 'Garment']);
  expect(option).not.toHaveProperty('pan');
  expect(option).not.toHaveProperty('bankAccountNumber');
  await api.delete(`/vendors/${created.id}`);
});

test('API — job-work process fields: required, unit per category, guarded while an active vendor does it', async () => {
  const name = `E2E Wash ${STAMP()}`;
  const metre = await api.post('/processes', { processName: name, category: 'Garment', sacCode: '998821', gstRatePercent: 5, defaultUom: 'METRE', ...COST_FIELDS });
  expect(metre.response.status()).toBe(400);
  expect(metre.data.message).toBe('Default UOM of a Garment process must be one of Piece, Dozen, Kg.');
  const noSac = await api.post('/processes', { processName: name, category: 'Garment', gstRatePercent: 5, defaultUom: 'KG', ...COST_FIELDS });
  expect(noSac.response.status()).toBe(400);

  const { data: wash } = await api.post('/processes', { processName: name, category: 'Garment', sacCode: '998821', gstRatePercent: 12, defaultUom: 'dozen', artworkRequired: true, ...COST_FIELDS });
  expect(wash).toMatchObject({ sacCode: '998821', defaultUom: 'DOZEN', artworkRequired: true });

  const { data: worker } = await api.post('/vendors', vendor({ processIds: [wash.id] }));
  const del = await api.delete(`/processes/${wash.id}`);
  expect(del.response.status()).toBe(409);
  expect(del.data.message).toContain('active Vendors');

  // Deactivated, the vendor no longer holds the process back: it moves, then deletes.
  await api.delete(`/vendors/${worker.id}`);
  const { data: moved } = await api.put(`/processes/${wash.id}`, { ...wash, category: 'Manufacturing' });
  expect(moved).toMatchObject({ category: 'Manufacturing', sacCode: null, defaultUom: null, artworkRequired: false });
  expect((await api.delete(`/processes/${wash.id}`)).response.status()).toBe(204);
});

test('UI — the form asks for what the Supplier form asks for; a complete vendor saves with its processes and approval', async ({ page }) => {
  const name = `E2E Stitching Unit ${STAMP()}`;
  const pan = uniquePan();
  await goToMasterEntity(page, 'Vendors');
  await antTableWaitForData(page).catch(() => {}); // the list may be empty on a fresh database
  await page.getByRole('button', { name: /Add Vendor/i }).first().click();
  const modal = page.locator('.ant-modal').filter({ has: page.locator('.ant-modal-title', { hasText: 'Add Vendor' }) });
  await modal.locator('#name').waitFor({ state: 'visible' });

  // Saved empty, the form names every mandatory field (Country starts as India) and sends nothing
  await modal.getByRole('button', { name: /^Save$/ }).click();
  for (const message of ['Vendor Name is required', 'Contact Person is required', 'Phone is required', 'Email is required',
    'Address is required', 'Pincode is required', 'City is required', 'State is required', 'GSTIN is required',
    'PAN is required', 'Select at least one process this vendor does']) {
    await expect(modal.getByText(message, { exact: true })).toBeVisible();
  }

  await modal.locator('#name').fill(name);
  await modal.locator('#contactPerson').fill('S Velan');
  await modal.locator('#phone').fill('9840012345');
  await modal.locator('#email').fill('velan@e2e-vendor.in');
  await modal.locator('#address').fill('7 Avinashi Road');
  await modal.locator('#pincode').fill('641603');
  await modal.locator('#city').fill('Tiruppur');
  await modal.locator('#state').fill('Tamil Nadu');
  await modal.locator('#gstin').fill(gstinOf(pan));
  await modal.locator('#pan').fill(pan);
  // The list is virtual (processes of every category in groups): search, then pick.
  await modal.locator('#processIds').click();
  const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  for (const process of ['Panel Printing', 'Enzyme Washing']) {
    await page.keyboard.type(process);
    await dropdown.locator('.ant-select-item-option').filter({ hasText: new RegExp(`^${process}$`) }).click();
  }
  await page.keyboard.press('Escape');
  await modal.locator('#jobWorkApprovedUntil').fill('31-Mar-2027');
  await modal.locator('#jobWorkApprovedUntil').press('Enter');
  await expect(modal.getByText('Approved to 31-Mar-2027')).toBeVisible();

  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/vendors') && r.request().method() === 'POST'),
    modal.getByRole('button', { name: /^Save$/ }).click(),
  ]);
  expect(resp.status()).toBe(201);
  const body = resp.request().postDataJSON();
  expect(body).toMatchObject({
    name, contactPerson: 'S Velan', phone: '9840012345', email: 'velan@e2e-vendor.in', address: '7 Avinashi Road',
    pincode: '641603', gstin: gstinOf(pan), stateCode: '33', pan, jobWorkApprovedUntil: '2027-03-31', active: true,
  });
  expect(body.processIds.slice().sort((a, b) => a - b)).toEqual([cutPanel.id, garment.id].sort((a, b) => a - b));

  await page.getByPlaceholder('Search name, GSTIN, city…').fill(name);
  const row = page.locator('.ant-table-row').filter({ hasText: name });
  await expect(row.getByText('Approved to 31-Mar-2027')).toBeVisible();
  await expect(row.getByText(gstinOf(pan))).toBeVisible();
  await row.getByText(name).click();
  const drawer = page.locator('.ant-drawer-open').last();
  await expect(drawer.getByText('Job Work', { exact: true })).toBeVisible();
  await expect(drawer.getByText('Panel Printing')).toBeVisible();
  await expect(drawer.getByText('Enzyme Washing')).toBeVisible();

  const created = await resp.json();
  await api.delete(`/vendors/${created.id}`);
});

test('UI — an edit whose PAN and bank details failed to load cannot save until they load, so they are never erased', async ({ page }) => {
  const pan = uniquePan();
  const { data: created } = await api.post('/vendors', vendor({ pan, gstin: gstinOf(pan), bankAccountNumber: '50100012345678' }));
  let failDetail = true;
  await page.route(`**/api/v1/vendors/${created.id}`, (route) => (failDetail && route.request().method() === 'GET'
    ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"E2E: detail unavailable"}' })
    : route.continue()));

  await goToMasterEntity(page, 'Vendors');
  await page.getByPlaceholder('Search name, GSTIN, city…').fill(created.name);
  await page.locator('.ant-table-row').filter({ hasText: created.name }).locator('button:has(.anticon-edit)').click();
  const modal = page.locator('.ant-modal').filter({ has: page.locator('.ant-modal-title', { hasText: 'Update Vendor' }) });
  await expect(modal.getByText('The PAN and bank details could not be loaded')).toBeVisible();
  await modal.locator('#phone').fill('9840099999');
  await expect(modal.getByRole('button', { name: 'Update' })).toBeDisabled();

  failDetail = false;
  await modal.getByRole('button', { name: 'Retry' }).click();
  await expect(modal.locator('#pan')).toHaveValue(pan);
  await expect(modal.locator('#phone')).toHaveValue('9840099999'); // a retry keeps the other edits
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith(`/vendors/${created.id}`) && r.request().method() === 'PUT'),
    modal.getByRole('button', { name: 'Update' }).click(),
  ]);
  expect(resp.status()).toBe(200);
  expect(resp.request().postDataJSON()).toMatchObject({ phone: '9840099999', pan, bankAccountNumber: '50100012345678' });

  await api.delete(`/vendors/${created.id}`);
});

test('UI — a job-work process starts with SAC 998821, GST 5 % and Piece; Garment bills by Piece, Dozen or Kg', async ({ page }) => {
  const name = `E2E Garment Process ${STAMP()}`;
  await goToMasterEntity(page, 'Processes');
  await antTableWaitForData(page);
  await page.getByRole('button', { name: /Add Process/i }).click();
  await page.locator('#processName').fill(name);
  await antFormSelect(page, 'Category', 'Garment');

  await expect(page.getByText(/bought on the Garment Process PO/)).toBeVisible();
  await expect(page.locator('#sacCode')).toHaveValue('998821');
  await expect(page.locator('#gstRatePercent')).toHaveValue('5.00');
  await page.locator('#defaultUom').click();
  const units = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last().locator('.ant-select-item-option');
  await expect(units).toHaveText(['Piece', 'Dozen', 'Kg']);
  await units.filter({ hasText: 'Dozen' }).click();
  await page.locator('#defaultInstructions').fill('Enzyme wash, tumble dry, no bleach');

  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/v1/processes') && r.request().method() === 'POST'),
    page.getByRole('button', { name: /Save/i }).click(),
  ]);
  expect(resp.status()).toBe(201);
  expect(resp.request().postDataJSON()).toMatchObject({
    category: 'Garment', sacCode: '998821', gstRatePercent: 5, defaultUom: 'DOZEN',
    defaultInstructions: 'Enzyme wash, tumble dry, no bleach', artworkRequired: false,
  });

  const created = await resp.json();
  await api.delete(`/processes/${created.id}`).catch(() => {});
});
