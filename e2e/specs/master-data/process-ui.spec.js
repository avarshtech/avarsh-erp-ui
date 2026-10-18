/**
 * Process Master — the screen as it is now: the Type is derived from the Category (Manufacturing →
 * Cost with a default cost; Fabric and Trims → Allowance with the four allowance defaults; Cut Panel
 * and Garment → Requirement, with no defaults), and the save zeroes whatever the type does not carry.
 *
 * What this tests:
 *   - List: columns, the derived Type tag per category, Status tag
 *   - Search by name, description and category; clearing restores the list
 *   - Create: required-field messages, a Manufacturing process carries its cost and no allowances
 *   - Create: a Fabric process shows the allowance fields, and its cost is saved as 0
 *   - Edit by row click: moving a process from Manufacturing to Trims zeroes its cost
 *   - A duplicate process name is refused by the server
 *   - Delete through the form's Delete button and the confirm
 *
 * Replaces the old "UI Operations" block of process.spec.js, written for the Cost / Allowance switch
 * the screen no longer has.
 */
import { test, expect } from '../../fixtures.js';
import { processPayload } from '../../helpers/test-data.js';
import { waitForPageReady } from '../../helpers/navigation.js';

const STAMP = () => Date.now().toString().slice(-6);

const seeds = {};

/** The Processes master, opened from the Master Data menu. */
async function openProcesses(page) {
  await page.goto('/master');
  await waitForPageReady(page);
  await page.getByText('Processes', { exact: true }).first().click();
  await expect(page.locator('.ant-table-row').first()).toBeVisible({ timeout: 20000 });
}

const listSearch = (page) => page.locator('.ant-card').filter({ has: page.locator('.ant-table') }).getByPlaceholder(/search/i).first();
const saveButton = (page) => page.getByRole('button', { name: /Save/ }).last();

/** The category select of the open form. */
async function pickCategory(page, category) {
  await page.locator('#category').click();
  await page.locator('.ant-select-dropdown:visible').getByTitle(category, { exact: true }).click();
}

/** Save the open form; the response of the POST or PUT is returned. */
async function saveForm(page, method) {
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === method && /\/api\/v1\/processes(\/\d+)?$/.test(r.url())),
    saveButton(page).click(),
  ]);
  return res;
}

test.describe('Process Master — screen', () => {
  test.beforeAll(async ({ api }) => {
    const s = STAMP();
    const make = async (key, body) => {
      const { data, status } = await api.post('/processes', processPayload(body));
      expect(status, `seed ${key}`).toBeLessThan(300);
      seeds[key] = data;
    };
    await make('cost', { processName: `E2E Cost Process ${s}`, description: `seed-cost-${s}`, category: 'Manufacturing', defaultCost: 12.5 });
    await make('allowance', {
      processName: `E2E Allowance Process ${s}`, description: `seed-allow-${s}`, category: 'Fabric', defaultCost: 0,
      defaultShrinkageInches: 1, defaultProcessLossPercent: 2, defaultRejectionPercent: 1, defaultShipmentAllowancePercent: 1,
    });
    // A job-work (Garment) process carries the SAC, GST and unit the screen fills in for it
    await make('requirement', {
      processName: `E2E Garment Process ${s}`, description: `seed-req-${s}`, category: 'Garment', defaultCost: 0,
      sacCode: '998821', gstRatePercent: 5, defaultUom: 'PIECE', artworkRequired: false,
    });
  });

  test.afterAll(async ({ api }) => {
    for (const p of Object.values(seeds)) await api.delete(`/processes/${p.id}`);
  });

  test('the list derives each Type from the Category and shows the Status', async ({ authedPage, consoleGuard }) => {
    await openProcesses(authedPage);
    for (const col of ['Process Name', 'Category', 'Type', 'Status']) {
      await expect(authedPage.getByRole('columnheader', { name: col })).toBeVisible();
    }
    const expectRow = async (seed, category, type) => {
      await listSearch(authedPage).fill(seed.processName);
      const row = authedPage.locator('.ant-table-row', { hasText: seed.processName });
      await expect(row).toBeVisible();
      await expect(row.locator('.ant-tag', { hasText: category })).toBeVisible();
      await expect(row.locator('.ant-tag', { hasText: type })).toBeVisible();
      await expect(row.locator('.ant-tag', { hasText: 'Active' })).toBeVisible();
    };
    await expectRow(seeds.cost, 'Manufacturing', 'Cost');
    await expectRow(seeds.allowance, 'Fabric', 'Allowance');
    await expectRow(seeds.requirement, 'Garment', 'Requirement');
    expect(consoleGuard).toEqual([]);
  });

  test('search matches the name, the description and the category; clearing restores the list', async ({ authedPage, consoleGuard }) => {
    await openProcesses(authedPage);
    const rows = authedPage.locator('.ant-table-row');
    const search = listSearch(authedPage);
    await search.fill(seeds.cost.processName);
    await expect(rows).toHaveCount(1);
    await search.fill(seeds.allowance.description);
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(seeds.allowance.processName);
    await search.fill('Garment');
    await expect(authedPage.locator('.ant-table-row', { hasText: seeds.requirement.processName })).toBeVisible();
    await search.fill('zzz-no-such-process-zzz');
    await expect(rows).toHaveCount(0);
    await search.clear();
    await expect.poll(() => rows.count()).toBeGreaterThan(2);
    expect(consoleGuard).toEqual([]);
  });

  test('a Manufacturing process is created with its cost, and no allowances', async ({ api, authedPage, consoleGuard }) => {
    await openProcesses(authedPage);
    await authedPage.getByRole('button', { name: /Add Process/ }).click();
    await expect(authedPage.locator('#processName')).toHaveAttribute('maxlength', '200');
    await expect(authedPage.locator('#description')).toHaveAttribute('maxlength', '500');

    // Required fields first
    await saveButton(authedPage).click();
    await expect(authedPage.getByText('Please enter a process name')).toBeVisible();
    await expect(authedPage.getByText('Please select a category')).toBeVisible();

    const name = `E2E Stitching ${STAMP()}`;
    await authedPage.locator('#processName').fill(name);
    await pickCategory(authedPage, 'Manufacturing');
    await expect(authedPage.locator('#defaultShrinkageInches')).toHaveCount(0);
    await authedPage.locator('#defaultCost').fill('18.75');
    await authedPage.locator('#description').fill('Single-needle stitching, per piece');
    const res = await saveForm(authedPage, 'POST');
    expect(res.status()).toBeLessThan(300);
    const body = res.request().postDataJSON();
    expect(body.defaultCost).toBe(18.75);
    expect([body.defaultShrinkageInches, body.defaultProcessLossPercent, body.defaultRejectionPercent, body.defaultShipmentAllowancePercent])
      .toEqual([0, 0, 0, 0]);
    await expect(authedPage.locator('.ant-message-notice', { hasText: 'Process created successfully' })).toBeVisible();

    const created = await res.json();
    seeds.createdCost = created;
    expect(created.category).toBe('Manufacturing');
    const { data: all } = await api.get('/processes');
    expect((all.content || all).some((p) => p.processName === name && p.isActive !== false)).toBeTruthy();
    expect(consoleGuard).toEqual([]);
  });

  test('a Fabric process shows the allowance defaults, and its cost is saved as 0', async ({ authedPage, consoleGuard }) => {
    await openProcesses(authedPage);
    await authedPage.getByRole('button', { name: /Add Process/ }).click();
    const name = `E2E Washing ${STAMP()}`;
    await authedPage.locator('#processName').fill(name);
    await pickCategory(authedPage, 'Fabric');
    await expect(authedPage.locator('#defaultCost')).toHaveCount(0);
    await expect(authedPage.getByText(/Set default allowance values for this process/)).toBeVisible();
    await authedPage.locator('#defaultShrinkageInches').fill('1.5');
    await authedPage.locator('#defaultProcessLossPercent').fill('3');
    await authedPage.locator('#defaultRejectionPercent').fill('2');
    await authedPage.locator('#defaultShipmentAllowancePercent').fill('1');
    const res = await saveForm(authedPage, 'POST');
    expect(res.status()).toBeLessThan(300);
    const body = res.request().postDataJSON();
    expect(body.defaultCost).toBe(0);
    expect([body.defaultShrinkageInches, body.defaultProcessLossPercent, body.defaultRejectionPercent, body.defaultShipmentAllowancePercent])
      .toEqual([1.5, 3, 2, 1]);
    seeds.createdAllowance = await res.json();
    expect(consoleGuard).toEqual([]);
  });

  test('moving a process from Manufacturing to Trims on edit zeroes its cost', async ({ authedPage, consoleGuard }) => {
    await openProcesses(authedPage);
    await listSearch(authedPage).fill(seeds.createdCost.processName);
    await authedPage.locator('.ant-table-row', { hasText: seeds.createdCost.processName }).click();
    await expect(authedPage.locator('#processName')).toHaveValue(seeds.createdCost.processName);
    // The form ignores changes for a moment after it opens; re-pick until Save wakes up
    await expect(async () => {
      await pickCategory(authedPage, 'Trims');
      await expect(saveButton(authedPage)).toBeEnabled({ timeout: 1000 });
    }).toPass({ timeout: 10000 });
    await authedPage.locator('#defaultProcessLossPercent').fill('4');

    const res = await saveForm(authedPage, 'PUT');
    expect(res.status()).toBeLessThan(300);
    const body = res.request().postDataJSON();
    expect(body.category).toBe('Trims');
    expect(body.defaultCost).toBe(0);
    expect(body.defaultProcessLossPercent).toBe(4);
    await expect(authedPage.locator('.ant-message-notice', { hasText: 'Process updated successfully' })).toBeVisible();
    await listSearch(authedPage).fill(seeds.createdCost.processName);
    await expect(authedPage.locator('.ant-table-row', { hasText: seeds.createdCost.processName }).locator('.ant-tag', { hasText: 'Allowance' }))
      .toBeVisible();
    expect(consoleGuard).toEqual([]);
  });

  test('a second process with the same name is refused', async ({ api }) => {
    const dup = await api.post('/processes', processPayload({ processName: seeds.cost.processName, category: 'Manufacturing' }));
    expect(dup.status).toBeGreaterThanOrEqual(400);
  });

  test('a process is deleted from its form after the confirm', async ({ api, authedPage, consoleGuard }) => {
    const victim = seeds.createdAllowance;
    await openProcesses(authedPage);
    await listSearch(authedPage).fill(victim.processName);
    await authedPage.locator('.ant-table-row', { hasText: victim.processName }).click();
    await expect(authedPage.locator('#processName')).toHaveValue(victim.processName);
    await authedPage.getByRole('button', { name: /Delete/ }).first().click();
    const confirm = authedPage.locator('.ant-modal-confirm');
    await expect(confirm).toContainText('Delete Process');
    const [res] = await Promise.all([
      authedPage.waitForResponse((r) => r.request().method() === 'DELETE' && r.url().endsWith(`/processes/${victim.id}`)),
      confirm.getByRole('button', { name: /^Delete$/ }).click(),
    ]);
    expect(res.status()).toBeLessThan(300);
    await expect(authedPage.locator('.ant-message-notice', { hasText: 'Process deleted successfully' })).toBeVisible();
    const { data: all } = await api.get('/processes');
    expect((all.content || all).some((p) => p.id === victim.id)).toBeFalsy();
    delete seeds.createdAllowance;
    expect(consoleGuard).toEqual([]);
  });
});
