/**
 * Customs exchange rates (owner, 2026-11-17): the CBIC-notified export rates an export invoice
 * converts with, kept in a drawer on the Export Invoices list under the export-invoice key.
 *
 * Each run keys its rate on a date of its own far in the future, so the specs can run again on
 * the same stack and never collide with a real notification; whatever a run leaves is removed
 * through the API at the end.
 */
import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import {
  goTo, inputFor, fillDate, expectToast, button,
} from '../sample-requests/helpers.js';

const LIST = '/export-docs/invoices/list';
const API = '/export-docs/customs-rates';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// A date of this run's own: 2040 onwards, one of ~3,000 days
const day = new Date(Date.UTC(2040, 0, 1) + (Date.now() % 3000) * 86400000);
const pad = (n) => String(n).padStart(2, '0');
const ISO = `${day.getUTCFullYear()}-${pad(day.getUTCMonth() + 1)}-${pad(day.getUTCDate())}`;
const TYPED = `${pad(day.getUTCDate())}-${MONTHS[day.getUTCMonth()]}-${day.getUTCFullYear()}`;
const NOTIFICATION = `E2E/${Date.now().toString(36).toUpperCase()}`;

let api;

test.beforeAll(async () => {
  api = await createAuthenticatedClient();
});

test.afterAll(async () => {
  const { data } = await api.get(API);
  for (const r of (data || []).filter((x) => x.effectiveFrom === ISO)) await api.delete(`${API}/${r.id}`);
  await api?.dispose();
});

const drawer = (page) => page.locator('.ant-drawer-open').filter({ hasText: 'Customs exchange rates' }).last();
const rowOf = (page) => drawer(page).locator('.ant-table-row').filter({ hasText: NOTIFICATION });

test('a customs rate is added, refused twice for one date, edited, read as in force, and removed', async ({ page }) => {
  await goTo(page, LIST);
  await button(page, 'Customs rates').click();
  const d = drawer(page);
  await expect(d).toBeVisible();

  // Added: the code is stored upper-case and the row goes on top
  await inputFor(page, 'Currency').fill('usd');
  await inputFor(page, 'Export rate').fill('84.15');
  await fillDate(page, 'In force from', TYPED);
  await inputFor(page, 'Notification no.').fill(NOTIFICATION);
  await button(d, 'Add rate').click();
  await expectToast(page, /USD rate from .* saved/);
  await expect(rowOf(page)).toContainText('84.1500');

  // The same currency and date again is refused by the server, and nothing is added
  await inputFor(page, 'Currency').fill('USD');
  await inputFor(page, 'Export rate').fill('85');
  await fillDate(page, 'In force from', TYPED);
  await button(d, 'Add rate').click();
  await expectToast(page, /already recorded/);
  await expect(rowOf(page)).toHaveCount(1);

  // Edited in place
  await rowOf(page).getByRole('button', { name: 'Edit' }).click();
  await inputFor(page, 'Export rate').fill('84.2');
  await button(d, 'Save changes').click();
  await expectToast(page, /saved/);
  await expect(rowOf(page)).toContainText('84.2000');

  // An invoice dated that day reads it as the rate in force
  const { status, data } = await api.get(`${API}/in-force?currency=USD&date=${ISO}`);
  expect(status).toBe(200);
  expect(Number(data.exportRate)).toBeCloseTo(84.2, 4);
  expect(data.notificationNo).toBe(NOTIFICATION);

  // Removed
  await rowOf(page).getByRole('button', { name: 'Delete' }).click();
  await page.locator('.ant-popover:visible').getByRole('button', { name: 'Delete' }).click();
  await expect(rowOf(page)).toHaveCount(0);
});
