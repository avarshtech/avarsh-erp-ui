/**
 * UI-Driven Master Data Helpers
 *
 * Every helper drives the real screen — no API seeding. All are idempotent: they
 * search the list first and skip creation when the record already exists, so a spec
 * can be re-run against an already-seeded database without creating duplicates.
 *
 * Most master screens share the MasterSplitView shell (src/components/MasterSplitView.jsx):
 * a searchable list card, an "Add <Entity>" button, and a form saved with "Save Changes".
 *
 * Locator strategy — learned the hard way:
 *   - Buttons are matched by VISIBLE TEXT, not by role. AntD renders icons as
 *     <span role="img" aria-label="plus">, which prefixes the accessible name
 *     ("plus Add UOM") and breaks anchored getByRole name matches.
 *   - Selects are matched by their FORM LABEL, not by placeholder. An AntD Select
 *     renders its placeholder inside the selector div, so getByPlaceholder() never sees it.
 *   - AntD 6 (6.2.2) dropped several v5 internal classes. Confirmed against the live DOM:
 *       .ant-select-selector       -> .ant-select-content
 *       .ant-select-selection-item -> .ant-select-content-value
 *       .ant-modal-content         -> gone; use .ant-modal or [role="dialog"]
 *     Prefer the stable outer classes (.ant-select, .ant-modal) over internals.
 *     .ant-select-dropdown, .ant-select-item-option, .ant-table-row and
 *     .ant-message-notice are unchanged.
 */

import { expect } from '@playwright/test';
import { goToMasterEntity, waitForPageReady } from './navigation.js';

/** AntD table/dropdown re-render needs a tick to settle. */
const SETTLE_MS = 400;
/** Fail fast on a bad selector instead of burning the whole test timeout. */
const ACTION_TIMEOUT = 15000;

const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Label text, tolerating a trailing required-marker asterisk. */
const labelPattern = (label) => new RegExp(`^\\s*${escapeRe(label)}\\s*\\*?\\s*$`);

// ── List card ──────────────────────────────────────────────────────

/**
 * The MasterSplitView list card — the one containing the records table.
 *
 * Scoping matters: the master dashboard renders its own "Search..." input for the
 * left-hand entity nav, so an unscoped getByPlaceholder(/Search/) is ambiguous.
 */
export function masterListCard(page) {
  return page.locator('.ant-card').filter({ has: page.locator('.ant-table') }).first();
}

/** The open modal dialog (Items uses a Modal rather than the split-view form). */
export function dialog(page) {
  return page.locator('.ant-modal').first();
}

/** Type into the MasterSplitView search box and wait for the list to filter. */
export async function searchMasterList(page, term) {
  const search = masterListCard(page).getByPlaceholder(/Search/i).first();
  await search.fill('', { timeout: ACTION_TIMEOUT });
  await search.fill(term, { timeout: ACTION_TIMEOUT });
  await page.waitForTimeout(SETTLE_MS);
}

/** Does a row with this text already exist? Searches first so it works past page 1. */
export async function masterRecordExists(page, name) {
  await searchMasterList(page, name);
  return (await page.locator('.ant-table-row').filter({ hasText: name }).count()) > 0;
}

// ── Form field helpers ─────────────────────────────────────────────

/** The .ant-form-item wrapping the field with this label. */
export function formField(page, label, scope = page) {
  return scope
    .locator('.ant-form-item')
    .filter({ has: page.locator('.ant-form-item-label label').filter({ hasText: labelPattern(label) }) })
    .first();
}

/** Fill a text input / textarea identified by its form label. */
export async function fillByLabel(page, label, value, scope = page) {
  const field = formField(page, label, scope);
  const input = field.locator('input:not([type="hidden"]), textarea').first();
  await input.fill(String(value), { timeout: ACTION_TIMEOUT });
}

/** Pick one option from an AntD Select identified by its form label. */
export async function selectByLabel(page, label, optionText, scope = page) {
  const field = formField(page, label, scope);
  await field.locator('.ant-select').first().click({ timeout: ACTION_TIMEOUT });
  await page.waitForTimeout(200);
  await visibleOption(page, optionText).click({ timeout: ACTION_TIMEOUT });
  await page.waitForTimeout(200);
}

/** Pick several options from a multi-select, then close the dropdown. */
export async function multiSelectByLabel(page, label, optionTexts, scope = page) {
  const field = formField(page, label, scope);
  await field.locator('.ant-select').first().click({ timeout: ACTION_TIMEOUT });
  await page.waitForTimeout(200);
  for (const text of optionTexts) {
    await visibleOption(page, text).click({ timeout: ACTION_TIMEOUT });
    await page.waitForTimeout(150);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
}

/**
 * An option in the currently-open dropdown, matched exactly.
 * AntD puts the full option label in a `title` attribute, which is a cleaner match
 * than text content (options also contain a hidden state span).
 */
export function visibleOption(page, text) {
  return page
    .locator(`.ant-select-dropdown:visible .ant-select-item-option[title="${String(text).replace(/"/g, '\\"')}"]`)
    .first();
}

// ── Actions ────────────────────────────────────────────────────────

/** Open the "Add <Entity>" form on a MasterSplitView screen. */
export async function openAddForm(page) {
  await page.locator('button').filter({ hasText: /^Add\b/i }).first().click({ timeout: ACTION_TIMEOUT });
  await page.waitForTimeout(SETTLE_MS);
}

/**
 * Click "Save Changes" and wait for the success toast.
 * Fails loudly if the server rejected the save — silent failures are the whole
 * reason the previous suite passed while the UI was broken.
 */
export async function saveMasterForm(page, { expectToast = /success|saved|created|updated/i } = {}) {
  await page.locator('button').filter({ hasText: /Save Changes|^Save$/i }).first().click({ timeout: ACTION_TIMEOUT });
  if (expectToast) {
    await expect(page.locator('.ant-message-notice').filter({ hasText: expectToast })).toBeVisible({ timeout: 20000 });
  }
  await page.waitForTimeout(SETTLE_MS);
}

/** Assert no error toast is showing — call after a save to be sure the API accepted it. */
export async function expectNoErrorToast(page) {
  const errors = page.locator('.ant-message-error, .ant-message-notice-error');
  if (await errors.count()) {
    throw new Error(`Unexpected error toast: ${await errors.first().innerText()}`);
  }
}

/**
 * Create a master record if it does not already exist.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string|RegExp} entity - Sidebar label, e.g. 'Categories'
 * @param {string} name - Unique display name used for the exists-check
 * @param {(page) => Promise<void>} fillForm - Fills the form fields
 * @returns {Promise<'created'|'skipped'>}
 */
export async function ensureMasterRecord(page, entity, name, fillForm) {
  await goToMasterEntity(page, entity);
  await waitForPageReady(page);

  if (await masterRecordExists(page, name)) return 'skipped';

  await openAddForm(page);
  await fillForm(page);
  await saveMasterForm(page);
  await expectNoErrorToast(page);

  // Confirm it actually landed in the list — proves the server accepted it.
  await expect(page.locator('.ant-table-row').filter({ hasText: name }).first())
    .toBeVisible({ timeout: 15000 });

  return 'created';
}
