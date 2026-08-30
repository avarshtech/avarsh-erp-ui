/**
 * Terms & Conditions Master — E2E Tests (full field coverage)
 *
 * What this tests:
 *   - API CRUD round-trip
 *   - List: Title column (the ONLY column), Total footer, search by title AND by
 *     rich-text body content (HTML stripped before matching), clear restore
 *   - Create: required validation (title messages, "Description content is required"
 *     toast), Quill rich-text body (.ql-editor — there is NO plain Name/textarea input),
 *     POST payload carries <p>-wrapped HTML
 *   - Duplicate title blocked (inline validator, trim + case-insensitive)
 *   - Rich text toolbar: bold formatting produces <strong> markup in the payload
 *   - Edit via ROW CLICK (split-view): existing HTML loads into the editor,
 *     Save disabled until dirty, 400ms dirty-suppression settle
 *   - Delete via form Delete button + confirm modal (hard delete)
 *
 * Source of truth: e2e/plan/inventory-masters-support.md §7
 * NOTE: the description is a Quill RichTextEditor (react-quill-new) held in React
 *       state — NOT a Form.Item. It has no #id; target
 *       `.rich-text-editor-wrapper .ql-editor` (contenteditable) and drive it with
 *       keyboard events so Quill's onChange fires.
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { antTableWaitForData } from '../../helpers/antd-helpers.js';
import { ensureSessionActive, goToMasterEntity } from '../../helpers/navigation.js';
import { termsConditionsPayload } from '../../helpers/test-data.js';

const STAMP = () => Date.now().toString().slice(-6);

/** Quill editor body — contenteditable, no DOM id (see inventory §7 automation note) */
const editorLocator = (page) => page.locator('.rich-text-editor-wrapper .ql-editor');

/**
 * Replace the Quill editor content by typing (keyboard events guarantee
 * Quill's text-change → onChange → React state update).
 */
async function fillRichText(page, text) {
  const editor = editorLocator(page);
  await editor.click();
  await editor.press('ControlOrMeta+a');
  await editor.press('Delete'); // fully clear (edit mode preloads HTML)
  await editor.pressSequentially(text, { delay: 10 });
  await page.waitForTimeout(150); // let the final onChange flush to React state
  return editor;
}

/** Quill encodes typed spaces as &nbsp; — normalize for substring assertions. */
const normalizeHtml = (s) => (s || '').replace(/&nbsp;| /g, ' ');

test.describe.serial('Terms & Conditions — CRUD', () => {
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
      const { response, data } = await api.get('/terms-conditions');
      expect(response.ok()).toBeTruthy();
      expect(Array.isArray(data) || data.content).toBeTruthy();
    });

    test('API — Create returns created record', async () => {
      const payload = termsConditionsPayload();
      const { response, data } = await api.post('/terms-conditions', payload);
      expect(response.ok()).toBeTruthy();
      expect(data).toBeTruthy();
      expect(data.name).toBe(payload.name);
      createdId = data.id;
    });

    test('API — Update modifies record', async () => {
      test.skip(!createdId, 'No record created to update');
      const { data: existing } = await api.get(`/terms-conditions/${createdId}`);
      const updated = { ...existing, description: '<p>Updated by E2E test</p>' };
      const { response, data } = await api.put(`/terms-conditions/${createdId}`, updated);
      expect(response.ok()).toBeTruthy();
      expect(data.description).toContain('Updated');
    });

    test('API — Delete removes record', async () => {
      test.skip(!createdId, 'No record created to delete');
      const { response } = await api.delete(`/terms-conditions/${createdId}`);
      expect([200, 204].includes(response.status())).toBeTruthy();
    });
  });

  // ─── UI Operations ──────────────────────────────────────────────────
  test.describe('UI Operations', () => {
    test.beforeEach(async ({ page }) => {
      await goToMasterEntity(page, 'Terms & Conditions');
      await antTableWaitForData(page);
    });

    test('List: Title column, search by title and body content, Total footer', async ({ page }) => {
      const title = `E2E TnC Search ${STAMP()}`;
      const bodyToken = `tncbody${STAMP()}`;

      // create a record through the UI so search has guaranteed unique matches
      await page.getByRole('button', { name: /Add Terms/i }).click();
      await page.waitForTimeout(400); // dirty-suppression settle
      await page.locator('#name').fill(title);
      await fillRichText(page, `Standard purchase terms ${bodyToken} apply to all orders.`);
      await Promise.all([
        page.waitForResponse((r) => r.url().includes('/terms-conditions') && r.request().method() === 'POST'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      await antTableWaitForData(page);

      // Title is the only column
      await expect(page.getByRole('columnheader', { name: 'Title' })).toBeVisible();

      // Total footer + rows
      const total = await page.locator('.ant-table-row').count();
      expect(total).toBeGreaterThan(0);
      await expect(page.getByText(/Total:\s*\d+/)).toBeVisible();

      const search = page.locator(".ant-card").filter({ has: page.locator(".ant-table") }).getByPlaceholder(/search/i).first();

      // search by title (client-side, per keystroke)
      await search.fill(title);
      await expect(page.locator('.ant-table-row')).toHaveCount(1);

      // search by plain-text body content (HTML tags stripped before matching)
      await search.fill(bodyToken);
      await expect(page.locator('.ant-table-row')).toHaveCount(1);

      // clear restores full list
      await search.clear();
      await expect(page.locator('.ant-table-row')).toHaveCount(total);
    });

    test('Create: required validation, rich-text description, all fields saved', async ({ page }) => {
      const title = `E2E TnC ${STAMP()}`;
      const body = `These terms were authored by E2E for ${title}.`;
      await page.getByRole('button', { name: /Add Terms/i }).click();
      await page.waitForTimeout(400); // dirty-suppression settle

      // default: editor starts empty
      await expect(editorLocator(page)).toHaveText('');

      // title required
      await page.getByRole('button', { name: /Save/i }).click();
      await expect(page.getByText(/please enter a title for this t&c template/i)).toBeVisible();

      // title min length 2
      await page.locator('#name').fill('A');
      await page.getByRole('button', { name: /Save/i }).click();
      await expect(page.getByText(/title must be at least 2 characters/i)).toBeVisible();

      // description required — manual check, toasts when the editor is empty
      await page.locator('#name').fill(title);
      await page.getByRole('button', { name: /Save/i }).click();
      await expect(page.getByText(/description content is required/i)).toBeVisible({ timeout: 8000 });

      // fill the Quill editor (the only content control — no plain input/textarea)
      await fillRichText(page, body);
      await expect(editorLocator(page)).toContainText(body);

      const [resp] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes('/api/v1/terms-conditions') && r.request().method() === 'POST',
        ),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      expect(resp.status()).toBeLessThan(300);
      // Quill wraps typed input in <p> — assert the HTML payload
      expect(resp.request().postData()).toContain('<p>');
      await antTableWaitForData(page);
      await expect(page.locator('.ant-table-row').filter({ hasText: title })).toBeVisible();
    });

    test('Create: duplicate title blocked (inline validator, case-insensitive)', async ({ page }) => {
      const title = `E2E DupTnC ${STAMP()}`;
      await page.getByRole('button', { name: /Add Terms/i }).click();
      await page.waitForTimeout(400);
      await page.locator('#name').fill(title);
      await fillRichText(page, 'Duplicate-guard body content.');
      await Promise.all([
        page.waitForResponse((r) => r.url().includes('/terms-conditions') && r.request().method() === 'POST'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      await antTableWaitForData(page);

      await page.getByRole('button', { name: /Add Terms/i }).click();
      await page.waitForTimeout(400);
      await page.locator('#name').fill(title.toUpperCase());
      await page.getByRole('button', { name: /Save/i }).click();
      await expect(
        page.getByText(/a terms & conditions with this title already exists/i).first(),
      ).toBeVisible({ timeout: 8000 });
    });

    test('Rich text editor: bold toolbar formatting produces <strong> markup', async ({ page }) => {
      const title = `E2E BoldTnC ${STAMP()}`;
      await page.getByRole('button', { name: /Add Terms/i }).click();
      await page.waitForTimeout(400);
      await page.locator('#name').fill(title);

      const editor = await fillRichText(page, 'Important clause: payment within agreed days.');
      // select all editor content and apply Bold from the Quill toolbar
      await editor.press('ControlOrMeta+a');
      await page.locator('.rich-text-editor-wrapper .ql-toolbar button.ql-bold').click();
      await expect(editor.locator('strong').first()).toBeVisible();

      const [resp] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes('/terms-conditions') && r.request().method() === 'POST',
        ),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      expect(resp.status()).toBeLessThan(300);
      expect(resp.request().postData()).toContain('<strong>');
      await antTableWaitForData(page);
      await expect(page.locator('.ant-table-row').filter({ hasText: title })).toBeVisible();
    });

    test('Edit via row click: existing HTML loads, change all fields and persist', async ({ page }) => {
      const title = `E2E EditTnC ${STAMP()}`;
      const renamed = `${title} v2`;
      const originalBody = 'Original body content authored by E2E.';
      const replacedBody = 'Replaced body content authored by E2E v2.';
      // create through UI first (independent of other tests)
      await page.getByRole('button', { name: /Add Terms/i }).click();
      await page.waitForTimeout(400);
      await page.locator('#name').fill(title);
      await fillRichText(page, originalBody);
      await Promise.all([
        page.waitForResponse((r) => r.url().includes('/terms-conditions') && r.request().method() === 'POST'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      await antTableWaitForData(page);

      // edit = click the row (no per-row edit icon in split view)
      await page.locator('.ant-table-row').filter({ hasText: title }).click();
      await page.locator('#name').waitFor({ state: 'visible' });
      await page.waitForTimeout(400); // dirty suppression

      // existing record's HTML is loaded into the editor
      await expect(editorLocator(page)).toContainText(originalBody);

      // Save disabled until the form is dirty
      await expect(page.getByRole('button', { name: /Save/i })).toBeDisabled();
      await page.locator('#name').fill(renamed);
      await expect(page.getByRole('button', { name: /Save/i })).toBeEnabled();

      // replace the rich-text body
      await fillRichText(page, replacedBody);
      await expect(editorLocator(page)).toContainText(replacedBody);

      const [putResp] = await Promise.all([
        page.waitForResponse((r) => r.url().match(/\/terms-conditions\/\d+/) && r.request().method() === 'PUT'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      expect(putResp.status()).toBeLessThan(300);
      expect(normalizeHtml(putResp.request().postData())).toContain('Replaced body content');
      await antTableWaitForData(page);
      await expect(page.locator('.ant-table-row').filter({ hasText: renamed })).toBeVisible();
    });

    test('Delete via form Delete button: hard delete removes row', async ({ page }) => {
      const title = `E2E DelTnC ${STAMP()}`;
      await page.getByRole('button', { name: /Add Terms/i }).click();
      await page.waitForTimeout(400);
      await page.locator('#name').fill(title);
      await fillRichText(page, 'Body for the delete-path record.');
      await Promise.all([
        page.waitForResponse((r) => r.url().includes('/terms-conditions') && r.request().method() === 'POST'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      await antTableWaitForData(page);

      await page.locator('.ant-table-row').filter({ hasText: title }).click();
      await page.locator('#name').waitFor({ state: 'visible' });
      await page.getByRole('button', { name: /Delete/i }).click();

      const confirm = page.locator('.ant-modal-confirm, .ant-modal, .ant-popconfirm').last();
      await confirm.waitFor({ state: 'visible' });
      const [delResp] = await Promise.all([
        page.waitForResponse((r) => r.url().match(/\/terms-conditions\/\d+/) && r.request().method() === 'DELETE'),
        confirm.getByRole('button', { name: /delete|ok|yes/i }).last().click(),
      ]);
      expect(delResp.status()).toBeLessThan(300);
      await antTableWaitForData(page);
      await expect(page.locator('.ant-table-row').filter({ hasText: title })).toHaveCount(0);
    });
  });
});
