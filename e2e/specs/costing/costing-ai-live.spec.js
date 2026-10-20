/**
 * Costing — AI capture and Laya AI against the REAL model. Opt-in: these call Gemini, so
 * they run only with E2E_LIVE_AI=1 against a backend that has the key (never in CI).
 *
 *   L1  A spoken costing (fake microphone playing a real recording) is read, reviewed and applied
 *   L2  A photographed handwritten costing is read; a target in another currency is not applied
 *   L3  A new material the AI proposes is completed in the pre-filled form (its item type keeps
 *       attributes, so Item Master can show its variants) and lands on the sheet
 *   L4  The Genie by text: explains, fills rows, points at a field, removes a row, proposes a material
 *   L5  The Genie by voice: what it heard is shown, and it answers
 *
 * The model's wording varies run to run, so these assert what must hold — rows land, masters are
 * created with attributes, the screen changes — not exact text.
 */

import path from 'node:path';
import { test, expect } from '@playwright/test';
import { ensureSessionActive, navigateWithAuth } from '../../helpers/navigation.js';
import { createAuthenticatedClient } from '../../helpers/api-client.js';

const VOICE = path.resolve('e2e/fixtures/ai/voice-costing-en.wav');
const PHOTO = path.resolve('e2e/fixtures/ai/handwritten-costing.png');

test.skip(!process.env.E2E_LIVE_AI, 'Calls the real AI model — set E2E_LIVE_AI=1 to run');
test.describe.configure({ timeout: 240000 });
test.use({
  permissions: ['microphone'],
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${VOICE}`] },
});

const drawer = (page) => page.locator('.ant-drawer-open').filter({ hasText: 'Check what the AI found' });
const rows = (page, key) => page.locator(`[data-genie-anchor="section-${key}"] tr.ant-table-row`);
const allRows = (page) => page.locator('[data-genie-anchor^="section-"] tr.ant-table-row');
const panel = (page) => page.getByRole('dialog', { name: 'Laya AI' });

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
  page.on('pageerror', (err) => console.log(`[browser:pageerror] ${err.message}`));
  await page.addInitScript(() => { try { sessionStorage.removeItem('avarsh-genie-threads'); localStorage.removeItem('costing-sheet:unsaved-new'); } catch { /* storage blocked */ } });
});

/** Applies whatever the drawer can apply, and reports what it held. */
async function applyReview(page) {
  const review = drawer(page);
  const lines = await review.locator('.ai-draft-row').count();
  const apply = review.locator('.ant-drawer-footer .ant-btn-primary');
  const label = await apply.innerText();
  await apply.click();
  await expect(review).toBeHidden({ timeout: 60000 });
  return { lines, label };
}

test('L1 A spoken costing is read, reviewed and applied', async ({ page }) => {
  await navigateWithAuth(page, '/costing/new');
  await page.getByRole('button', { name: 'Speak it', exact: true }).click();
  await page.getByRole('button', { name: 'Start recording' }).click();
  // The recording is 26 s and ends with "profit twelve percent"; let it all play.
  await page.waitForTimeout(29000);
  await page.getByRole('button', { name: 'Stop recording' }).click();

  await expect(drawer(page)).toBeVisible({ timeout: 120000 });
  await expect(drawer(page).getByLabel('Transcript')).toHaveValue(/320/);
  const { lines, label } = await applyReview(page);
  console.log(`L1: ${lines} lines read; applied with "${label}"`);
  expect(lines).toBeGreaterThanOrEqual(4);
  await expect(allRows(page)).not.toHaveCount(0);
  await expect(page.locator('input[name="profitPct"]')).toHaveValue(/^12/);
});

test('L2 A photographed handwritten costing is read; a target in another currency is held back', async ({ page }) => {
  await navigateWithAuth(page, '/costing/new');
  await page.getByRole('button', { name: 'Photo or tech pack', exact: true }).click();
  await page.locator('.ant-modal-wrap:visible input[type="file"]').setInputFiles(PHOTO);
  await page.getByRole('button', { name: 'Read it' }).click();

  await expect(drawer(page)).toBeVisible({ timeout: 120000 });
  await expect(drawer(page).locator('.ai-draft-row').filter({ hasText: /poplin/i })).toHaveCount(1);
  // "Target 4.20 USD" cannot go into a rupee sheet's target.
  await expect(drawer(page).getByText("The sheet's target is in INR")).toBeVisible();
  const { lines } = await applyReview(page);
  console.log(`L2: ${lines} lines read`);
  expect(lines).toBeGreaterThanOrEqual(5);
  await expect(allRows(page)).not.toHaveCount(0);
});

test('L3 A new material is completed in the pre-filled form, keeps its attributes, and lands on the sheet', async ({ page }) => {
  const n = Date.now() % 100000;
  await navigateWithAuth(page, '/costing/new');
  await page.getByRole('button', { name: 'Type or paste', exact: true }).click();
  await page.getByLabel('Costing text').fill(`Corduroy ${n} wale fabric maroon, 0.6 meter per piece, rate 240 rubai.`);
  await page.getByRole('button', { name: 'Read it' }).click();
  await expect(drawer(page)).toBeVisible({ timeout: 120000 });

  const line = drawer(page).locator('.ai-draft-row').first();
  const complete = line.getByRole('button', { name: /Complete details/ });
  const variantName = (await line.locator('.ant-typography strong, strong').first().innerText()).trim();
  if (await complete.isVisible().catch(() => false)) {
    await complete.click();
    const form = page.locator('.ant-drawer-open').filter({ hasText: 'New material' });
    await expect(form).toBeVisible();
    // The new item type arrives with attributes chosen; fill whatever value the AI could not hear.
    await expect(form.locator('input[id^="quickItem_attr_"]').first()).toBeVisible();
    // A new item type arrives with its attributes chosen (the placeholder shows only when none are).
    const newTypeAttributes = form.locator('.ant-select').filter({ has: form.locator('#quickItem_newTypeAttributeIds') });
    if (await newTypeAttributes.count()) await expect(newTypeAttributes).not.toContainText('e.g. Colour');
    for (const input of await form.locator('input[id^="quickItem_attr_"]').all()) {
      if (!(await input.inputValue())) await input.fill('Maroon');
    }
    const [created] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/items/find-or-create') && r.request().method() === 'POST'),
      form.locator('button[type="submit"]').click(),
    ]);
    expect([200, 201]).toContain(created.status());
  }
  await applyReview(page);
  await expect(rows(page, 'fabric')).toHaveCount(1);

  // The item type behind it has attributes, so Item Master shows the item's variants.
  const client = await createAuthenticatedClient();
  const { data: found } = await client.get(`/variants/search?category=Fabric&q=${encodeURIComponent(variantName.split(' ')[0])}&limit=10`);
  const variant = (found.content || found).find((v) => v.variantName === variantName) || (found.content || found)[0];
  const { data: item } = await client.get(`/items/${variant.itemId}`);
  const { data: meta } = await client.get('/items/meta');
  await client.dispose();
  const type = meta.flatMap((c) => c.subCategories || []).flatMap((s) => s.itemTypes || []).find((t) => t.id === item.itemTypeId);
  console.log(`L3: ${variantName} → ${type?.name} [${(type?.attributes || []).map((a) => a.attributeName).join(', ')}]`);
  expect(type.attributes.length).toBeGreaterThan(0);
});

test('L4 The Genie by text: explains, fills, points, removes, proposes', async ({ page }) => {
  await navigateWithAuth(page, '/costing/new');
  await page.locator('.genie-launcher').click();
  const ask = async (text) => {
    const before = await panel(page).locator('.genie-msg-genie').count();
    await panel(page).getByLabel('Ask Laya AI').fill(text);
    await panel(page).getByRole('button', { name: 'Send' }).click();
    const reply = panel(page).locator('.genie-msg-genie').nth(before);
    await expect(reply).not.toContainText('Thinking', { timeout: 120000 });
    const said = (await reply.innerText()).replace(/\s+/g, ' ');
    console.log(`L4 > ${text}\n   < ${said.slice(0, 300)}`);
    return reply;
  };

  await expect(await ask('How is wastage applied to the fabric cost?')).toContainText(/wastage/i);

  await ask('Add Charcoal fabric 0.25 kg at 320 rupees, and a cutting charge.');
  await expect(rows(page, 'fabric')).toHaveCount(1);
  await expect(rows(page, 'manufacturing')).toHaveCount(1);
  await expect(rows(page, 'fabric').first().locator('input[placeholder="Rate"]')).toHaveValue(/^320/);

  await ask('Where do I set the exchange rate?');
  await expect(page.locator('#actualRate')).toBeFocused();

  await ask('Remove the cutting row.');
  await expect(rows(page, 'manufacturing')).toHaveCount(0);

  const proposed = await ask('Add a woven main label, one per garment.');
  const card = proposed.locator('.genie-card');
  if (await card.count()) {
    await card.getByRole('button', { name: /Create/ }).first().click();
    const form = page.locator('.ant-drawer-open').filter({ hasText: 'New material' });
    if (await form.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(form.locator('input[id^="quickItem_attr_"]').first()).toBeVisible();
      for (const input of await form.locator('input[id^="quickItem_attr_"]').all()) {
        if (!(await input.inputValue())) await input.fill('White');
      }
      await form.locator('button[type="submit"]').click();
    }
    await expect(rows(page, 'localTrim')).toHaveCount(1, { timeout: 30000 });
  } else {
    // Found an existing label and added it directly.
    await expect(rows(page, 'localTrim')).toHaveCount(1);
  }
});

test('L5 The Genie by voice: what it heard is shown, and it answers', async ({ page }) => {
  await navigateWithAuth(page, '/costing/new');
  await page.locator('.genie-launcher').click();
  await panel(page).getByRole('button', { name: 'Speak to Laya AI' }).click();
  await page.waitForTimeout(12000);
  await panel(page).getByRole('button', { name: 'Send' }).click();
  const heard = panel(page).locator('.genie-msg-user').last();
  await expect(heard).toContainText(/H&M|jersey|costing/i, { timeout: 120000 });
  const reply = panel(page).locator('.genie-msg-genie').last();
  await expect(reply).not.toContainText('Thinking', { timeout: 120000 });
  console.log(`L5 heard: ${(await heard.innerText()).slice(0, 200)}\n   reply: ${(await reply.innerText()).replace(/\s+/g, ' ').slice(0, 300)}`);
  await expect(reply).not.toBeEmpty();
});
