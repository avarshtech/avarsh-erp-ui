/**
 * Production flow 08 — packing: a carton packing entry for the flow order is keyed by hand (one carton
 * group of the first size, Black, cartons 1–2), saved, marked complete, counted on the day's packing
 * summary, and reopened for editing.
 */
import { test, expect } from '../../fixtures.js';
import { findFlowOrder } from '../../helpers/production-flow-seed.js';
import { waitForPageReady } from '../../helpers/navigation.js';
import { choose, labelled, responseOf, successToast } from './helpers.js';

test.describe.configure({ mode: 'serial' });

const ctx = {};

/** The main cartons section (the first collapse panel; the second holds leftover cartons). */
const mainSection = (page) => page.locator('.ant-collapse-item').first();

/** The input in `row` under the column headed `title` of the carton-group table. */
async function cell(page, row, title) {
  const heads = await mainSection(page).locator('.ant-table-thead th').allInnerTexts();
  const idx = heads.findIndex((h) => h.trim() === title);
  expect(idx, `carton-group column "${title}" (have: ${heads.join(' | ')})`).toBeGreaterThanOrEqual(0);
  return row.locator('td').nth(idx).locator('input').first();
}

test.describe('Production flow — packing', () => {
  test.beforeAll(async ({ api }) => {
    ctx.order = await findFlowOrder(api);
    ctx.sizes = ctx.order.orderLines[0].sizePrices ? Object.keys(ctx.order.orderLines[0].sizePrices) : [];
  });

  test('a carton packing entry is keyed for the order, saved and marked complete', async ({ api, authedPage, consoleGuard }) => {
    await authedPage.goto('/production/packing/new');
    await waitForPageReady(authedPage);
    const orderSelect = labelled(authedPage, 'Order').locator('.ant-select').first();
    await choose(authedPage, orderSelect, ctx.order.orderNo);
    await expect(labelled(authedPage, 'Style').locator('input')).toHaveValue(ctx.order.styleNo);

    await mainSection(authedPage).getByRole('button', { name: /Add carton group/ }).click();
    const row = mainSection(authedPage).locator('.ant-table-tbody .ant-table-row').first();
    await (await cell(authedPage, row, 'From')).fill('1');
    await (await cell(authedPage, row, 'To')).fill('2');
    const colour = row.getByPlaceholder('Navy or 19-4052 TCX');
    if (await colour.count()) await colour.fill('Black');
    const size = ctx.sizes[0];
    await (await cell(authedPage, row, size)).fill('10');
    await (await cell(authedPage, row, 'N.W. (kg)')).fill('8');
    await (await cell(authedPage, row, 'G.W. (kg)')).fill('9');
    await (await cell(authedPage, row, 'L (cm)')).fill('60');
    await (await cell(authedPage, row, 'B (cm)')).fill('40');
    await (await cell(authedPage, row, 'H (cm)')).fill('30');
    await expect(row.locator('td', { hasText: /^20$/ })).toHaveCount(1); // Total pcs = 2 cartons × 10

    const saved = await responseOf(authedPage, 'POST', /\/packing\/entries$/,
      () => authedPage.getByRole('button', { name: /Save/ }).last().click());
    await successToast(authedPage, new RegExp(`${saved.packingNo} saved`));
    await expect(authedPage).toHaveURL(new RegExp(`/production/packing/edit/${saved.id}`));
    expect(saved.status).toBe('OPEN');
    ctx.entry = saved;

    await authedPage.getByRole('button', { name: /Mark complete/ }).click();
    const completed = await responseOf(authedPage, 'POST', new RegExp(`/packing/entries/${saved.id}/complete$`),
      () => authedPage.locator('.ant-modal-confirm').getByRole('button', { name: /Mark complete/ }).click());
    await successToast(authedPage, new RegExp(`${saved.packingNo} marked complete`));
    expect(completed.status).toBe('COMPLETED');

    const { data: entry } = await api.get(`/packing/entries/${saved.id}`);
    expect(entry.groups).toHaveLength(1);
    expect(entry.groups[0].cartonFrom).toBe(1);
    expect(entry.groups[0].cartonTo).toBe(2);
    expect(consoleGuard).toEqual([]);
  });

  test('the day’s packing summary counts the cartons, and the entry reopens for editing', async ({ api, authedPage, consoleGuard }) => {
    const { data: summary } = await api.get('/packing/daily-summary', { date: ctx.entry.packingDate });
    const rows = summary.rows || summary.content || summary;
    const ours = (Array.isArray(rows) ? rows : []).find((r) => r.orderNo === ctx.order.orderNo);
    expect(ours, 'the daily summary lists the flow order').toBeTruthy();
    expect(Number(ours.cartons)).toBe(2);
    expect(Number(ours.pieces)).toBe(20);

    await authedPage.goto('/production/packing/list');
    await waitForPageReady(authedPage);
    await expect(authedPage.locator('.ant-card', { hasText: /Daily Packing/i }).getByText(ctx.order.orderNo).first()).toBeVisible({ timeout: 20000 });

    await authedPage.goto(`/production/packing/edit/${ctx.entry.id}`);
    await waitForPageReady(authedPage);
    await authedPage.getByRole('button', { name: /Reopen/ }).click();
    const reopened = await responseOf(authedPage, 'POST', new RegExp(`/packing/entries/${ctx.entry.id}/reopen$`),
      () => authedPage.locator('.ant-modal-confirm').getByRole('button', { name: /^Reopen$/ }).click());
    await successToast(authedPage, new RegExp(`${ctx.entry.packingNo} reopened`));
    expect(reopened.status).toBe('OPEN');
    expect(consoleGuard).toEqual([]);
  });
});
