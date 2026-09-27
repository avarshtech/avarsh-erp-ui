/**
 * Costing — AI capture (speak / photo / paste) and the review drawer, pinned end to end.
 *
 *   - Pasted text → review: a matched fabric is pre-linked, a complete proposal is created in one
 *     batch, an unsure line stays unticked, the header profit is offered; Apply fills the sheet
 *     and Undo takes it back
 *   - Speaking: the browser's recording reaches the server as a 16 kHz mono WAV
 *
 * POST /cost-sheets/ai-draft is route-mocked, so the suite never calls the AI provider; the
 * materials, the batch find-or-create and the sheet are real. Chromium's fake microphone stands
 * in for a voice.
 */

import { test, expect } from '@playwright/test';
import { ensureSessionActive, navigateWithAuth } from '../../helpers/navigation.js';
import { createAuthenticatedClient } from '../../helpers/api-client.js';

test.use({
  permissions: ['microphone'],
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
});

const fabricRows = (page) => page.locator('[data-genie-anchor="section-fabric"] tr.ant-table-row');
const drawer = (page) => page.locator('.ant-drawer-open').filter({ hasText: 'Check what the AI found' });

/** A real fabric variant, and a complete new-material proposal against a real item type. */
async function masters() {
  const api = await createAuthenticatedClient();
  const { data: variants } = await api.get('/variants/search?category=Fabric&limit=1');
  const { data: categories } = await api.get('/items/meta');
  const { data: units } = await api.get('/unit-of-measures');
  const { data: attrs } = await api.get('/attribute-configs');
  await api.dispose();
  const attributeList = attrs.content || attrs;
  const colour = attributeList.find((a) => /colou?r/i.test(a.attributeName)) || attributeList[0];

  const fabric = categories.find((c) => c.name?.toLowerCase() === 'fabric');
  const sub = fabric.subCategories.find((s) => s.itemTypes?.length);
  const type = sub.itemTypes[0];
  // A type with no units configured takes any unit.
  const unit = type.uoms?.[0] || (units.content || units).find((u) => /^kg/i.test(u.symbol)) || (units.content || units)[0];
  const key = (name) => (name.includes(' ')
    ? name.split(' ').map((w, i) => (i ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())).join('')
    : name.toLowerCase());
  const newName = `AI Fabric ${Date.now() % 1000000}`;
  const proposedItem = {
    categoryId: fabric.id, categoryName: fabric.name, subCategoryId: sub.id, subCategoryName: sub.name,
    itemTypeId: type.id, itemTypeName: type.name, uomId: unit.id, uomSymbol: unit.symbol,
    variantName: newName,
    attributes: Object.fromEntries((type.attributes || []).map((a) => [key(a.attributeName), /gsm|weight|count|width/i.test(a.attributeName) ? '180' : 'E2E'])),
    missing: [],
  };
  return { existing: variants[0], proposedItem, newName, colour, key };
}

function draftFor({ existing, proposedItem }) {
  return {
    language: 'ta-en',
    transcript: 'Single jersey kaal kilo rate 320 rubai; puthu fabric arai kilo; main label',
    header: { profitPct: 12 },
    warnings: [],
    sourceFileIds: [],
    rows: [
      {
        ref: 'r1', section: 'FABRIC', name: existing.variantName, heardAs: 'single jersey kaal kilo', quantity: 0.25,
        rate: 320, rateCurrency: 'INR', confidence: 'HIGH', sourceRef: 'line 1',
        matchedVariantId: existing.id, matchScore: 0.9, suggestions: [{ variant: existing, score: 0.9 }],
      },
      {
        ref: 'r2', section: 'FABRIC', name: proposedItem.variantName, heardAs: 'puthu fabric arai kilo', quantity: 0.5,
        confidence: 'MEDIUM', sourceRef: 'line 2', suggestions: [], proposedItem,
      },
      {
        ref: 'r3', section: 'LOCAL_TRIM', name: 'Main Label Woven', heardAs: 'main label', confidence: 'LOW', sourceRef: 'line 3',
        suggestions: [], proposedItem: { variantName: 'Main Label Woven', missing: ['Item type'], attributes: {} },
      },
    ],
  };
}

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
  page.on('pageerror', (err) => console.log(`[browser:pageerror] ${err.message}`));
});

test('Pasted text is reviewed, new materials are created, and the sheet is filled — one Undo away', async ({ page }) => {
  const data = await masters();
  let sentText = null;
  await page.route('**/cost-sheets/ai-draft', async (route) => {
    sentText = route.request().postData();
    await route.fulfill({ json: draftFor(data) });
  });

  await navigateWithAuth(page, '/costing/new');
  await page.getByRole('button', { name: 'Type or paste', exact: true }).click();
  await page.getByLabel('Costing text').fill('Single jersey kaal kilo rate 320 rubai');
  await page.getByRole('button', { name: 'Read it' }).click();

  await expect(drawer(page)).toBeVisible();
  expect(sentText).toContain('Single jersey kaal kilo rate 320 rubai');
  await expect(drawer(page).getByLabel('Transcript')).toHaveValue(/kaal kilo/);
  await expect(drawer(page).getByText('Tamil + English')).toBeVisible();
  // The unsure trim is not in the master and stays out; the header profit is offered.
  await expect(drawer(page).getByLabel('Include Main Label Woven')).not.toBeChecked();
  await expect(drawer(page).getByText('needs Item type')).toBeVisible();
  await expect(drawer(page).getByRole('checkbox', { name: /Profit: 12%/ })).toBeChecked();

  const [batch] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/items/find-or-create/batch')),
    drawer(page).getByRole('button', { name: 'Create 1 new & add 2 lines' }).click(),
  ]);
  expect(batch.status()).toBe(200);
  const [created] = await batch.json();
  expect(created.clientRef).toBe('r2');
  expect(created.variant.variantName).toBe(data.newName);

  await expect(drawer(page)).toBeHidden();
  await expect(fabricRows(page)).toHaveCount(2);
  await expect(fabricRows(page).nth(0)).toContainText(data.existing.variantName);
  await expect(fabricRows(page).nth(0).locator('input[placeholder="Rate"]')).toHaveValue(/^320/);
  await expect(fabricRows(page).nth(1)).toContainText(data.newName);
  await expect(page.locator('input[name="profitPct"]')).toHaveValue(/^12/);

  await page.getByRole('button', { name: /Undo/ }).click();
  await expect(fabricRows(page)).toHaveCount(0);
});

test('A material whose sub-category and item type do not exist, and a new process, are created from the reading', async ({ page }) => {
  const { existing, proposedItem, colour, key } = await masters();
  const n = Date.now() % 1000000;
  // A new item type always carries attributes, so Item Master can show and edit its variants.
  const newMaterial = {
    ...proposedItem,
    subCategoryId: null, subCategoryName: `AI Sub ${n}`, newSubCategoryName: `AI Sub ${n}`,
    itemTypeId: null, itemTypeName: `AI Type ${n}`, newItemTypeName: `AI Type ${n}`, newItemTypeAttributeIds: [colour.id],
    variantName: `AI Velvet Red ${n}`, attributes: { [key(colour.attributeName)]: 'Red' }, missing: [],
  };
  const processName = `AI Smocking ${n}`;
  const draft = {
    language: 'ta-en', transcript: 'velvet red arai meter; smocking 18 rubai', header: {}, warnings: [], sourceFileIds: [],
    rows: [
      { ref: 'r1', section: 'FABRIC', name: newMaterial.variantName, heardAs: 'velvet red arai meter', quantity: 0.5, confidence: 'HIGH', suggestions: [], proposedItem: newMaterial },
      { ref: 'r2', section: 'MANUFACTURING', name: processName, heardAs: 'smocking 18 rubai', rate: 18, rateCurrency: 'INR', confidence: 'HIGH' },
    ],
  };
  expect(existing).toBeTruthy();
  await page.route('**/cost-sheets/ai-draft', (route) => route.fulfill({ json: draft }));

  await navigateWithAuth(page, '/costing/new');
  await page.getByRole('button', { name: 'Type or paste', exact: true }).click();
  await page.getByLabel('Costing text').fill('velvet red arai meter; smocking 18 rubai');
  await page.getByRole('button', { name: 'Read it' }).click();

  await expect(drawer(page).getByText(`AI Sub ${n} (new) › AI Type ${n} (new)`)).toBeVisible();
  await expect(drawer(page).getByText(`Process “${processName}” is created with a default cost of 18 INR.`)).toBeVisible();

  const processCreated = page.waitForResponse((r) => /\/processes$/.test(new URL(r.url()).pathname) && r.request().method() === 'POST');
  const [batch] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/items/find-or-create/batch')),
    drawer(page).getByRole('button', { name: 'Create 2 new & add 2 lines' }).click(),
  ]);
  expect(batch.status()).toBe(200);
  const [result] = await batch.json();
  expect(result.classifiersCreated).toEqual([`Sub-category AI Sub ${n}`, `Item type AI Type ${n}`]);
  expect(result.variant.attributes).toEqual({ [key(colour.attributeName)]: 'Red' });
  const process = await (await processCreated).json();
  expect(process.processName).toBe(processName);
  expect(Number(process.defaultCost)).toBe(18);

  await expect(drawer(page)).toBeHidden();
  await expect(fabricRows(page).first()).toContainText(newMaterial.variantName);
  const mfg = page.locator('[data-genie-anchor="section-manufacturing"] tr.ant-table-row');
  await expect(mfg).toHaveCount(1);
  await expect(mfg.first()).toContainText(processName);
  const values = await mfg.first().locator('input').evaluateAll((els) => els.map((e) => Number(e.value.replace(/,/g, ''))));
  expect(values).toContain(18);
});

test('A spoken note reaches the server as a 16 kHz mono WAV', async ({ page }) => {
  let upload = null;
  await page.route('**/cost-sheets/ai-draft', async (route) => {
    upload = route.request().postDataBuffer();
    await route.fulfill({ json: { transcript: 'test', language: 'en', header: {}, rows: [], warnings: [], sourceFileIds: [] } });
  });

  await navigateWithAuth(page, '/costing/new');
  await page.getByRole('button', { name: 'Speak it', exact: true }).click();
  await page.getByRole('button', { name: 'Start recording' }).click();
  await expect(page.getByText(/^0:0\d \/ 5:00$/)).toBeVisible();
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: 'Stop recording' }).click();

  await expect(drawer(page)).toBeVisible({ timeout: 20000 });
  const body = upload.toString('latin1');
  expect(body).toMatch(/filename="voice-note-[\d-]+\.wav"/);
  expect(body).toContain('Content-Type: audio/wav');
  const wav = body.indexOf('RIFF');
  expect(body.slice(wav + 8, wav + 12)).toBe('WAVE');
  // fmt chunk: PCM, 1 channel, 16000 Hz.
  expect(upload.readUInt16LE(wav + 20)).toBe(1);
  expect(upload.readUInt16LE(wav + 22)).toBe(1);
  expect(upload.readUInt32LE(wav + 24)).toBe(16000);
  await expect(drawer(page).getByText('No costing lines were found', { exact: false })).toBeVisible();
});
