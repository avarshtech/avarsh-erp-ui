/**
 * Job-work master fields — E2E
 *
 * The Cut Panel PO and Garment Process PO offer only job workers that do the PO's process
 * and hold a current approval, and they tax and bill from the process master. These tests
 * pin the master side of that:
 *   - API: a job worker round-trips its processes (ascending), approval date and payment
 *     terms (the update used to drop them); an inactive supplier is listed only with
 *     includeInactive; a job worker needs at least one 'Cut Panel' / 'Garment' process.
 *   - API: 'Cut Panel' / 'Garment' processes require SAC code, GST % and a billing unit
 *     (Garment: Piece, Dozen or Kg only); other categories hold none; a process a job
 *     worker does can be neither deleted nor moved out of those categories.
 *   - UI: a job worker saves without Fabric / Trims and shows its processes and approval.
 *   - UI: choosing a job-work category pre-fills SAC 998821, GST 5 % and Piece.
 *
 * Job workers created here are never picked by the Supplier PO helpers (po-seed.js skips
 * them); each test deactivates what it created.
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { antTableWaitForData, antFormSelect } from '../../helpers/antd-helpers.js';
import { ensureSessionActive, goToMasterEntity } from '../../helpers/navigation.js';
import { supplierPayload } from '../../helpers/test-data.js';

const STAMP = () => Date.now().toString().slice(-6);
const letterStamp = () => STAMP().replace(/\d/g, (d) => 'ABCDEFGHIJ'[Number(d)]);
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

const jobWorker = (overrides = {}) => supplierPayload({
  name: `E2E Job Worker ${STAMP()}`, suppliesFabric: false, suppliesTrims: false,
  jobWorker: true, processIds: [garment.id, cutPanel.id], jobWorkApprovedUntil: '2027-03-31',
  paymentTerms: '30 Days Credit', ...overrides,
});

test('API — a job worker round-trips processes, approval date and payment terms', async () => {
  expect(cutPanel?.sacCode).toBe('998821');
  expect(Number(garment?.gstRatePercent)).toBe(5);
  expect(garment?.defaultUom).toBe('PIECE');

  const { response, data: created } = await api.post('/suppliers', jobWorker());
  expect(response.status()).toBe(201);
  expect(created.processIds).toEqual([cutPanel.id, garment.id].sort((a, b) => a - b));
  expect(created.jobWorkApprovedUntil).toBe('2027-03-31');

  const { data: updated } = await api.put(`/suppliers/${created.id}`, {
    ...created, paymentTerms: '45 Days Credit', processIds: [garment.id], active: false,
  });
  expect(updated.paymentTerms).toBe('45 Days Credit');
  expect(updated.processIds).toEqual([garment.id]);

  const active = (await api.get('/suppliers')).data;
  expect(active.some((s) => s.id === created.id)).toBe(false);
  const all = (await api.get('/suppliers?includeInactive=true')).data;
  expect(all.find((s) => s.id === created.id)).toMatchObject({ active: false, jobWorker: true, processIds: [garment.id] });
});

test('API — a job worker needs a Cut Panel or Garment process; others drop the job-work fields', async () => {
  const none = await api.post('/suppliers', jobWorker({ processIds: [] }));
  expect(none.response.status()).toBe(400);
  expect(none.data.message).toBe('Select at least one process this job worker does.');

  const wrong = await api.post('/suppliers', jobWorker({ processIds: [manufacturing.id] }));
  expect(wrong.response.status()).toBe(400);
  expect(wrong.data.message).toContain('must be Cut Panel or Garment processes');

  const { data: plain } = await api.post('/suppliers', jobWorker({ jobWorker: false, suppliesFabric: true }));
  expect(plain).toMatchObject({ jobWorker: false, processIds: [], jobWorkApprovedUntil: null });
  await api.put(`/suppliers/${plain.id}`, { ...plain, active: false });
});

test('API — job-work process fields: required, unit per category, guarded while a job worker does it', async () => {
  const name = `E2E Wash ${STAMP()}`;
  const metre = await api.post('/processes', { processName: name, category: 'Garment', sacCode: '998821', gstRatePercent: 5, defaultUom: 'METRE', ...COST_FIELDS });
  expect(metre.response.status()).toBe(400);
  expect(metre.data.message).toBe('Default UOM of a Garment process must be one of Piece, Dozen, Kg.');
  const noSac = await api.post('/processes', { processName: name, category: 'Garment', gstRatePercent: 5, defaultUom: 'KG', ...COST_FIELDS });
  expect(noSac.response.status()).toBe(400);

  const { data: wash } = await api.post('/processes', { processName: name, category: 'Garment', sacCode: '998821', gstRatePercent: 12, defaultUom: 'dozen', artworkRequired: true, ...COST_FIELDS });
  expect(wash).toMatchObject({ sacCode: '998821', defaultUom: 'DOZEN', artworkRequired: true });

  const { data: worker } = await api.post('/suppliers', jobWorker({ processIds: [wash.id] }));
  const del = await api.delete(`/processes/${wash.id}`);
  expect(del.response.status()).toBe(409);
  const move = await api.put(`/processes/${wash.id}`, { ...wash, category: 'Manufacturing' });
  expect(move.response.status()).toBe(409);
  expect(move.data.message).toContain('job-work suppliers do it');

  // Released by the supplier, the process moves freely and drops its job-work fields.
  await api.put(`/suppliers/${worker.id}`, { ...worker, jobWorker: false, active: false });
  const { data: moved } = await api.put(`/processes/${wash.id}`, { ...wash, category: 'Manufacturing' });
  expect(moved).toMatchObject({ category: 'Manufacturing', sacCode: null, defaultUom: null, artworkRequired: false });
  expect((await api.delete(`/processes/${wash.id}`)).response.status()).toBe(204);
});

test('UI — a job worker saves without Fabric / Trims and shows its processes and approval', async ({ page }) => {
  const name = `Job Worker ${letterStamp()}`; // the name field takes letters and spaces only
  await goToMasterEntity(page, 'Suppliers');
  await antTableWaitForData(page);
  await page.getByRole('button', { name: /Add Supplier/i }).first().click();
  const modal = page.locator('.ant-modal').filter({ has: page.locator('.ant-modal-title', { hasText: 'Add Supplier' }) });
  await modal.locator('#name').waitFor({ state: 'visible' });

  await modal.locator('#name').fill(name);
  await modal.locator('#contactPerson').fill('Job Work Contact');
  await modal.locator('#email').fill(`jobwork-${Date.now()}@e2e-test.com`);
  await modal.locator('#phone').fill('9876543210');
  await modal.locator('#address').fill('12 Dye House Road');
  await modal.locator('#pincode').fill('641601');
  await modal.locator('#city').fill('Tiruppur');
  await modal.locator('#state').fill('Tamil Nadu');
  await modal.locator('#country').fill('India');
  await modal.locator('#pan').fill('AABCJ1234F');
  await modal.locator('#gstin').fill('33AABCJ1234F1Z5');

  await modal.locator('.ant-checkbox-wrapper').filter({ hasText: /^Job worker$/ }).click();
  // The list is virtual (21 processes in two groups): search, then pick.
  await modal.locator('#processIds').click();
  const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  for (const name of ['Panel Printing', 'Enzyme Washing']) {
    await page.keyboard.type(name);
    await dropdown.locator('.ant-select-item-option').filter({ hasText: new RegExp(`^${name}$`) }).click();
  }
  await page.keyboard.press('Escape');
  await modal.locator('#jobWorkApprovedUntil').fill('31-Mar-2027');
  await modal.locator('#jobWorkApprovedUntil').press('Enter');
  await expect(modal.getByText('Approved to 31-Mar-2027')).toBeVisible();

  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/suppliers') && r.request().method() === 'POST'),
    modal.getByRole('button', { name: /^Save$/ }).click(),
  ]);
  expect(resp.status()).toBe(201);
  const body = resp.request().postDataJSON();
  expect(body).toMatchObject({ jobWorker: true, suppliesFabric: false, suppliesTrims: false, jobWorkApprovedUntil: '2027-03-31' });
  expect(body.processIds.slice().sort((a, b) => a - b)).toEqual([cutPanel.id, garment.id].sort((a, b) => a - b));

  await page.getByPlaceholder('Search suppliers...').fill(name);
  const row = page.locator('.ant-table-row').filter({ hasText: name });
  await expect(row.getByText('Job work', { exact: true })).toBeVisible();
  await row.getByText(name).click();
  const drawer = page.locator('.ant-drawer-open').last();
  await expect(drawer.getByText('Job Work', { exact: true })).toBeVisible();
  await expect(drawer.getByText('Approved to 31-Mar-2027')).toBeVisible();
  await expect(drawer.getByText('Panel Printing')).toBeVisible();
  await expect(drawer.getByText('Enzyme Washing')).toBeVisible();

  const created = await resp.json();
  await api.put(`/suppliers/${created.id}`, { ...created, active: false });
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
