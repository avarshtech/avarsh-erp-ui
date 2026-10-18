// Screen helpers for the production-flow specs. The production screens lay their fields out with a small
// caption div above each control instead of a Form.Item label, so fields are found by that caption.
import { expect } from '../../fixtures.js';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The block holding the control captioned `caption` (the caption div sits right above the control). */
export function captioned(page, caption, scope = page) {
  // A caption is a bare styled div; an antd placeholder with the same text carries a class
  return scope.locator('div').filter({
    has: page.locator(':scope > div:not([class])', { hasText: new RegExp(`^\\s*${escapeRe(caption)}\\s*$`) }),
  }).first();
}

/** The open dropdown's option containing `text`, after typing it into the searchable select `select`. */
export async function choose(page, select, text) {
  await select.click();
  const search = select.locator('input').first();
  if (await search.isEditable().catch(() => false)) await search.fill(text);
  const option = page.locator('.ant-select-dropdown:visible .ant-select-item-option', { hasText: text }).first();
  await option.waitFor({ state: 'visible', timeout: 15000 });
  await option.click();
  await expect(page.locator('.ant-select-dropdown:visible')).toHaveCount(0, { timeout: 5000 }).catch(() => page.keyboard.press('Escape'));
}

/** Pick `text` in the select captioned `caption`. */
export const chooseCaptioned = (page, caption, text, scope = page) => choose(page, captioned(page, caption, scope).locator('.ant-select').first(), text);

/** Pick `text` in the Form.Item select labelled `label` (exact label, required asterisk ignored). */
export function labelled(page, label, scope = page) {
  return scope.locator('.ant-form-item').filter({
    has: page.locator('.ant-form-item-label label', { hasText: new RegExp(`^\\s*${escapeRe(label)}\\s*$`) }),
  }).first();
}
export const chooseLabelled = (page, label, text, scope = page) => choose(page, labelled(page, label, scope).locator('.ant-select').first(), text);

/** Type a date (or date-time) into an antd picker in the format it displays, and close it. */
export async function typeDate(page, picker, text) {
  const input = picker.locator('input').first();
  await input.click();
  await input.fill(text);
  await input.press('Enter');
  await page.locator('.ant-picker-dropdown:visible').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => page.keyboard.press('Escape'));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => String(n).padStart(2, '0');

/** DD-MMM-YYYY HH:mm, `hoursAgo` hours before now (rounded down to the minute). */
export function dateTimeAgo(hoursAgo) {
  const d = new Date(Date.now() - hoursAgo * 3600e3);
  return `${pad(d.getDate())}-${MONTHS[d.getMonth()]}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The success toast matching `pattern`; returns its text. */
export async function successToast(page, pattern) {
  const toast = page.locator('.ant-message-notice', { hasText: pattern }).first();
  await expect(toast).toBeVisible({ timeout: 20000 });
  return toast.innerText();
}

/** The open drawer (antd 6 renders closed ones too). */
export const openDrawer = (page) => page.locator('.ant-drawer-open').last();

/** The open modal. */
export const openModal = (page) => page.locator('.ant-modal-wrap:visible .ant-modal').last();

/** Wait for the response to a `method` call whose URL matches `pattern`, triggered by `action`. */
export async function responseOf(page, method, pattern, action) {
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === method && pattern.test(r.url()), { timeout: 30000 }),
    action(),
  ]);
  expect(res.status(), `${method} ${res.url()} → ${res.status()} ${await res.text().catch(() => '')}`).toBeLessThan(300);
  return res.json().catch(() => null);
}

/** The active workspace tab panel (inactive tabs stay mounted on some workspaces). */
export const activePane = (page) => page.locator('.ant-tabs-tabpane-active').first();
