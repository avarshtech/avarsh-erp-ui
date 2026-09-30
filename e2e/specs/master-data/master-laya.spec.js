/**
 * Laya AI on the Master Data page, pinned end to end with POST /genie/chat faked in this test's
 * browser (the suite never calls Gemini): every question carries the master on show; Laya AI
 * switches master, searches, fills a form the user then saves, takes a fill back with Undo, and a
 * new item goes through the New material card. The chat opens by its button, can be dragged
 * anywhere (remembered; double-click puts it back) and minimised to its title bar.
 */

import { test, expect } from '@playwright/test';
import { ensureSessionActive, navigateWithAuth } from '../../helpers/navigation.js';

const launcher = (page) => page.locator('.genie-launcher');
const panel = (page) => page.getByRole('dialog', { name: 'Laya AI' });

async function ask(page, text) {
  await panel(page).getByLabel('Ask Laya AI').fill(text);
  await panel(page).getByRole('button', { name: 'Send' }).click();
}

/** Answers every question with the given actions/proposals; keeps the requests for checking. */
async function fake(page, answer) {
  const requests = [];
  await page.route('**/genie/chat', async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ json: { reply: 'Done.', actions: [], proposals: [], ...answer(requests.length) } });
  });
  return requests;
}

async function openMasters(page) {
  await navigateWithAuth(page, '/master');
  await expect(launcher(page)).toBeVisible({ timeout: 20000 });
  await launcher(page).click();
  await expect(panel(page)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
  page.on('pageerror', (err) => console.log(`[browser:pageerror] ${err.message}`));
});

test('Every question carries the master on show; Laya AI switches master', async ({ page }) => {
  const requests = await fake(page, (n) => (n === 1 ? { actions: [{ tool: 'open_master', args: { entity: 'style' } }] } : {}));
  await openMasters(page);

  await ask(page, 'Take me to styles');
  await expect(page.getByText('Styles', { exact: true }).first()).toBeVisible();
  await expect(panel(page).getByText('Opened Styles')).toBeVisible();
  expect(requests[0].screenId).toBe('master-data');
  expect(requests[0].context.screen.entity).toBeTruthy();
  expect(requests[0].context.masters.map((m) => m.entity)).toEqual(expect.arrayContaining(['buyer', 'style', 'overhead']));

  await ask(page, 'And now?');
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[1].context.screen.entity).toBe('style');
  expect(requests[1].context.list.total).toBeGreaterThanOrEqual(0);
});

test('A form Laya AI fills is saved by the user; Undo takes a fill back', async ({ page }) => {
  const name = `Laya Overhead ${Date.now() % 1000000}`;
  await fake(page, (n) => (n === 1
    ? {
      actions: [
        { tool: 'open_master', args: { entity: 'overhead' } },
        { tool: 'fill_form', args: { fields: [{ field: 'overheadName', text: name }, { field: 'defaultCost', number: 12.5 }] } },
      ],
    }
    : { actions: [{ tool: 'fill_form', args: { fields: [{ field: 'overheadName', text: 'Taken back' }] } }] }));
  await openMasters(page);

  await ask(page, `Add an overhead ${name} at 12.5`);
  await expect(page.locator('#overheadName')).toHaveValue(name);
  await expect(page.locator('#defaultCost')).toHaveValue(/12\.5/);
  // The chat sits over the form's Save button: minimise it to its title bar, then save.
  await panel(page).getByRole('button', { name: 'Minimise Laya AI' }).click();
  await expect(panel(page).getByLabel('Ask Laya AI')).toBeHidden();
  const [saved] = await Promise.all([
    page.waitForResponse((r) => /\/overheads$/.test(r.url()) && r.request().method() === 'POST'),
    page.getByRole('button', { name: /Save/ }).first().click(),
  ]);
  expect(saved.status()).toBeLessThan(300);
  await expect(page.locator('[data-laya="list"]')).toContainText(name);

  await panel(page).getByRole('button', { name: 'Restore Laya AI' }).click();
  await ask(page, 'Fill another');
  await expect(page.locator('#overheadName')).toHaveValue('Taken back');
  await panel(page).getByRole('button', { name: 'Undo these changes' }).last().click();
  await expect(page.locator('#overheadName')).toHaveCount(0);
});

test('Laya AI types into the list search', async ({ page }) => {
  await fake(page, () => ({ actions: [{ tool: 'open_master', args: { entity: 'buyer' } }, { tool: 'search_list', args: { text: 'zzz-no-such-buyer' } }] }));
  await openMasters(page);

  await ask(page, 'Find buyer zzz');
  await expect(page.getByPlaceholder('Search buyers...')).toHaveValue('zzz-no-such-buyer');
  await expect(panel(page).getByText('Searched "zzz-no-such-buyer"')).toBeVisible();
});

test('A new item goes through the New material card, not the Items form', async ({ page }) => {
  await fake(page, () => ({
    actions: [{ tool: 'open_master', args: { entity: 'item' } }, { tool: 'fill_form', args: { fields: [{ field: 'hsnCode', text: '6006' }] } }],
    proposals: [{
      id: 'p1', kind: 'material', title: 'New material: Laya Rib Black', detail: 'Fabric › Knit › Rib',
      data: { category: 'Fabric', proposal: { categoryName: 'Fabric', variantName: 'Laya Rib Black', missing: [] } },
    }],
  }));
  await openMasters(page);

  await ask(page, 'Add rib black');
  await expect(panel(page).getByText('New items are added with the New material card')).toBeVisible();
  const card = panel(page).getByRole('group', { name: 'New material: Laya Rib Black' });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Create & add' }).click();
  const drawer = page.locator('.ant-drawer-open');
  await expect(drawer.getByText('New material')).toBeVisible();
  await expect(drawer.locator('#quickItem_variantName')).toHaveValue('Laya Rib Black');
});

test('The chat opens by its button, drags anywhere (remembered), and double-click puts it back', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => { try { localStorage.removeItem('laya-panel-position'); } catch { /* none */ } }).catch(() => {});
  await openMasters(page);
  const start = await panel(page).boundingBox();
  const launch = await launcher(page).boundingBox();
  expect(start.x + start.width).toBeGreaterThan(launch.x); // on the right, above its button

  const handle = panel(page).locator('.genie-drag');
  const grab = await handle.boundingBox();
  await page.mouse.move(grab.x + 60, grab.y + grab.height / 2);
  await page.mouse.down();
  await page.mouse.move(grab.x - 700, grab.y + grab.height / 2 + 120, { steps: 8 });
  await page.mouse.up();
  const moved = await panel(page).boundingBox();
  expect(start.x - moved.x).toBeGreaterThan(600);
  expect(moved.y - start.y).toBeGreaterThan(100);

  // Remembered after closing and opening again.
  await panel(page).getByRole('button', { name: 'Close Laya AI' }).click();
  await launcher(page).click();
  expect(Math.round((await panel(page).boundingBox()).x)).toBe(Math.round(moved.x));

  await handle.dblclick();
  await expect.poll(async () => Math.round((await panel(page).boundingBox()).x)).toBe(Math.round(start.x));
});
