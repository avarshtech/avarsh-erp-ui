/**
 * T&A 01 — a buyer template made on the Masters screen. Zara's template copies the default, drops the
 * First Bulk Piece milestone and plans the fit sample dispatch in 4 working days instead of 7; once
 * activated, every Zara order confirmed afterwards is planned with it. Idempotent: an existing active
 * Zara template is reused.
 */
import { test, expect } from '../../fixtures.js';
import { ZARA, ok } from './helpers.js';

const activeZara = async (api) => ok(await api.get('/tna/masters/templates'), 'templates')
  .find((t) => t.buyerId === ZARA.id && t.status === 'ACTIVE');

const openMasters = async (page) => {
  await page.goto('/tna/masters?tab=templates');
  await expect(page.getByRole('heading', { name: 'T&A masters', level: 1 })).toBeVisible({ timeout: 90000 });
};

const editActivity = async (page, code, change) => {
  await page.getByRole('button', { name: `Edit ${code}` }).click();
  const modal = page.locator('.ant-modal').filter({ hasText: `${code} ·` });
  await expect(modal).toBeVisible();
  await change(modal);
  const saved = page.waitForResponse((r) => r.url().includes('/tna/masters/templates/') && r.request().method() === 'PUT');
  await modal.getByRole('button', { name: 'Save to draft' }).click();
  expect((await saved).status()).toBe(200);
  await expect(modal).toBeHidden();
};

test.describe('T&A buyer template', () => {
  test('Zara gets its own template: no First Bulk Piece, fit dispatch in 4 working days', async ({ api, authedPage: page, consoleGuard }) => {
    test.setTimeout(240000);
    if (!(await activeZara(api))) {
      await openMasters(page);
      await page.getByRole('button', { name: /New buyer template/ }).click();
      const modal = page.locator('.ant-modal').filter({ hasText: 'New T&A template' });
      await modal.getByLabel('Buyer').click();
      await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option', { hasText: ZARA.name }).click();
      await modal.getByLabel('Template name').fill(ZARA.template);
      const created = page.waitForResponse((r) => r.url().endsWith('/tna/masters/templates') && r.request().method() === 'POST');
      await modal.getByRole('button', { name: 'Create draft' }).click();
      expect((await created).status()).toBe(201);
      await expect(modal).toBeHidden();

      await editActivity(page, 'A09', (m) => m.getByRole('switch').first().click());
      await editActivity(page, 'A05', async (m) => {
        await m.getByLabel('Planned duration').fill('4');
      });
      await expect(page.locator('tr[data-row-key="A09"]')).toContainText('No');
      await expect(page.locator('tr[data-row-key="A05"]')).toContainText('4 WD');

      await page.getByRole('button', { name: /Activate template/ }).click();
      const activated = page.waitForResponse((r) => r.url().includes('/activate'));
      await page.locator('.ant-modal').filter({ hasText: 'Activate' }).getByRole('button', { name: 'Activate' }).click();
      expect((await activated).status()).toBe(200);
    }

    const zara = await activeZara(api);
    expect(zara, 'an active Zara template').toBeTruthy();
    expect(zara.name).toBe(ZARA.template);
    const detail = ok(await api.get(`/tna/masters/templates/${zara.id}`), 'template');
    const row = (code) => detail.activities.find((a) => a.code === code);
    expect(row('A09').included).toBe(false);
    expect(row('A05').duration).toBe(4);
    expect(row('A05').defaultDuration).toBe(7);
    expect(row('A24').included).toBe(true);
    expect(consoleGuard).toEqual([]);
  });
});
