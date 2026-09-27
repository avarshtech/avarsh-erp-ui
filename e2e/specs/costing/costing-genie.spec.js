/**
 * Costing — the Help Genie, pinned end to end with POST /genie/chat route-mocked (the suite never
 * calls the AI provider; the sheet, the masters and the create endpoints are real).
 *
 *   - The launcher is on the costing sheet and nowhere else; each question carries the sheet's state
 *   - Screen changes (add a row, point at a field) are applied and one "Undo these changes" takes them back
 *   - A proposed material is created only on "Create & add", and lands on the sheet
 */

import { test, expect } from '@playwright/test';
import { ensureSessionActive, navigateWithAuth } from '../../helpers/navigation.js';
import { createAuthenticatedClient } from '../../helpers/api-client.js';

const launcher = (page) => page.locator('.genie-launcher');
const panel = (page) => page.getByRole('dialog', { name: 'Help Genie' });
const fabricRows = (page) => page.locator('[data-genie-anchor="section-fabric"] tr.ant-table-row');

async function ask(page, text) {
  await panel(page).getByLabel('Ask the Genie').fill(text);
  await panel(page).getByRole('button', { name: 'Send' }).click();
}

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
  page.on('pageerror', (err) => console.log(`[browser:pageerror] ${err.message}`));
});

test('The Genie is on the costing sheet only, and every question carries the sheet', async ({ page }) => {
  await navigateWithAuth(page, '/costing/list');
  await expect(page.getByRole('heading', { level: 1 }).or(page.locator('h1, h2').first())).toBeVisible();
  await expect(launcher(page)).toHaveCount(0);

  let body = null;
  await page.route('**/genie/chat', async (route) => {
    body = route.request().postDataJSON();
    await route.fulfill({ json: { reply: 'Wastage multiplies the fabric net cost by **(1 + wastage% / 100)**.', actions: [], proposals: [] } });
  });
  await navigateWithAuth(page, '/costing/new');
  await expect(launcher(page)).toBeVisible();
  await launcher(page).click();
  await expect(panel(page)).toBeVisible();
  // An empty chat opens with what still blocks the sheet.
  await expect(panel(page).getByText('Buyer is not picked')).toBeVisible();

  await panel(page).getByRole('button', { name: 'How is wastage applied?' }).click();
  await expect(panel(page).locator('.genie-msg-genie strong')).toHaveText('(1 + wastage% / 100)');
  expect(body.screenId).toBe('costing-sheet');
  expect(body.message).toBe('How is wastage applied?');
  expect(body.context.header.currency).toBe('INR');
  expect(body.context.problems).toContain('Buyer is not picked');
  expect(Object.keys(body.context.sections)).toEqual(['FABRIC', 'LOCAL_TRIM', 'IMPORTED_TRIM', 'MANUFACTURING', 'OVERHEAD']);
});

test('Screen changes are applied, pointed at, and undone in one step', async ({ page }) => {
  const api = await createAuthenticatedClient();
  const { data: variants } = await api.get('/variants/search?category=Fabric&limit=1');
  await api.dispose();
  const variant = variants[0];

  await page.route('**/genie/chat', (route) => route.fulfill({
    json: {
      reply: 'Added the fabric and set profit to 12%. The actual rate is highlighted.',
      actions: [
        { tool: 'add_rows', args: { rows: [{ section: 'FABRIC', variantId: variant.id, quantity: 0.25, rate: 320 }] } },
        { tool: 'set_commercials', args: { profitPct: 12 } },
        { tool: 'focus_field', args: { target: 'actual-rate' } },
      ],
      proposals: [],
    },
  }));
  await navigateWithAuth(page, '/costing/new');
  await launcher(page).click();
  await ask(page, 'Add single jersey quarter kilo at 320, profit 12');

  await expect(fabricRows(page)).toHaveCount(1);
  await expect(fabricRows(page).first()).toContainText(variant.variantName);
  await expect(fabricRows(page).first().locator('input[placeholder="Rate"]')).toHaveValue(/^320/);
  await expect(page.locator('input[name="profitPct"]')).toHaveValue(/^12/);
  // Pointed at: the field is focused (its pulse only lasts a couple of seconds).
  await expect(page.locator('#actualRate')).toBeFocused();
  await expect(panel(page).getByText('Added 1 to Fabric')).toBeVisible();

  await panel(page).getByRole('button', { name: 'Undo these changes' }).click();
  await expect(fabricRows(page)).toHaveCount(0);
  await expect(page.locator('input[name="profitPct"]')).toHaveValue(/^0/);
  await expect(panel(page).getByText('Undone.')).toBeVisible();
});

test('A proposed material is created only when confirmed, then added to the sheet', async ({ page }) => {
  const api = await createAuthenticatedClient();
  const { data: categories } = await api.get('/items/meta');
  const { data: units } = await api.get('/unit-of-measures');
  const { data: attrs } = await api.get('/attribute-configs');
  const attributeList = attrs.content || attrs;
  const colour = attributeList.find((a) => /colou?r/i.test(a.attributeName)) || attributeList[0];
  const colourKey = colour.attributeName.includes(' ')
    ? colour.attributeName.split(' ').map((w, i) => (i ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())).join('')
    : colour.attributeName.toLowerCase();
  const fabric = categories.find((c) => c.name?.toLowerCase() === 'fabric');
  const sub = fabric.subCategories.find((s) => s.itemTypes?.length);
  const unit = (units.content || units).find((u) => /^kg/i.test(u.symbol)) || (units.content || units)[0];
  const n = Date.now() % 1000000;
  const name = `Genie Rib ${n}`;

  let created = false;
  page.on('request', (r) => { if (r.url().includes('/items/find-or-create')) created = true; });
  await page.route('**/genie/chat', (route) => route.fulfill({
    json: {
      reply: `${name} is not in the master yet — confirm the card to create it.`,
      actions: [],
      proposals: [{
        id: 'p1', kind: 'material', title: `New material: ${name}`, detail: `Fabric › ${sub.name} › Genie Type ${n} (new)`,
        data: {
          section: 'FABRIC', quantity: 0.03, unit: unit.symbol, rate: null,
          proposal: {
            categoryId: fabric.id, categoryName: fabric.name, subCategoryId: sub.id, subCategoryName: sub.name,
            itemTypeId: null, itemTypeName: `Genie Type ${n}`, newItemTypeName: `Genie Type ${n}`, newItemTypeAttributeIds: [colour.id],
            uomId: unit.id, uomSymbol: unit.symbol, variantName: name, attributes: { [colourKey]: 'Black' }, missing: [],
          },
        },
      }],
    },
  }));
  await navigateWithAuth(page, '/costing/new');
  await launcher(page).click();
  await ask(page, 'Add rib 1x1 black for the collar, 0.03 kg');

  const card = panel(page).getByRole('group', { name: `New material: ${name}` });
  await expect(card).toBeVisible();
  expect(created).toBe(false);
  await expect(fabricRows(page)).toHaveCount(0);

  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/items/find-or-create') && r.request().method() === 'POST'),
    card.getByRole('button', { name: 'Create & add' }).click(),
  ]);
  expect(resp.status()).toBe(201);
  expect((await resp.json()).classifiersCreated).toEqual([`Item type Genie Type ${n}`]);
  await expect(card.getByText(/Created .* and added it/)).toBeVisible();
  await expect(fabricRows(page)).toHaveCount(1);
  await expect(fabricRows(page).first()).toContainText(name);
  await expect(fabricRows(page).first().locator('input[placeholder="Qty"]')).toHaveValue(/^0\.03/);

  // The new item type carries the attribute, so Item Master shows the item's variants.
  const check = await createAuthenticatedClient();
  const { data: meta } = await check.get('/items/meta');
  await check.dispose();
  const newType = meta.flatMap((c) => c.subCategories || []).flatMap((s) => s.itemTypes || []).find((t) => t.name === `Genie Type ${n}`);
  expect(newType.attributes.map((a) => a.id)).toEqual([colour.id]);
});
