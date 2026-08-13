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

/**
 * The .ant-form-item wrapping the field with this label.
 *
 * Matches the label exactly, or as a prefix. The prefix form is needed because some
 * labels embed extra controls: Size Presets renders a "Clear All" button inside its
 * Sizes label and JSX drops the whitespace between them, so the text is "SizesClear All".
 *
 * Prefix matching assumes labels are prefix-unique within a single form, which holds
 * across all master screens. Pass the fuller label when two could collide
 * (e.g. "State / Province" rather than "State").
 */
export function formField(page, label, scope = page) {
  const byPattern = (pattern) =>
    scope
      .locator('.ant-form-item')
      .filter({ has: page.locator('.ant-form-item-label label').filter({ hasText: pattern }) });

  return byPattern(labelPattern(label))
    .or(byPattern(new RegExp(`^\\s*${escapeRe(label)}`)))
    .first();
}

/** Fill a text input / textarea identified by its form label. */
export async function fillByLabel(page, label, value, scope = page) {
  const field = formField(page, label, scope);
  const input = field.locator('input:not([type="hidden"]), textarea').first();
  await input.fill(String(value), { timeout: ACTION_TIMEOUT });
}

/**
 * Click an option in the open dropdown.
 *
 * AntD renders options in an `rc-virtual-list` capped at 256px, so with more than
 * ~8 options the rest are simply not in the DOM. Two ways past that: filter by typing
 * when the Select is searchable, otherwise scroll the virtual list until the option
 * materialises.
 */
async function chooseOption(page, field, optionText) {
  const input = field.locator('input').first();
  const searchable = (await input.getAttribute('readonly')) === null;

  if (searchable) {
    await input.fill('');
    await input.type(String(optionText), { delay: 10 });
    await page.waitForTimeout(300);
  }

  let option = visibleOption(page, optionText);
  if ((await option.count()) === 0) {
    const holder = page.locator('.ant-select-dropdown:visible .rc-virtual-list-holder').first();
    for (let i = 0; i < 15 && (await option.count()) === 0; i++) {
      await holder.evaluate((el) => { el.scrollTop += 180; }).catch(() => {});
      await page.waitForTimeout(120);
      option = visibleOption(page, optionText);
    }
  }

  await option.click({ timeout: ACTION_TIMEOUT });
}

/** Pick one option from an AntD Select identified by its form label. */
export async function selectByLabel(page, label, optionText, scope = page) {
  const field = formField(page, label, scope);
  await field.locator('.ant-select').first().click({ timeout: ACTION_TIMEOUT });
  await page.waitForTimeout(200);
  await chooseOption(page, field, optionText);
  await page.waitForTimeout(200);
}

/** Pick several options from a multi-select, then close the dropdown. */
export async function multiSelectByLabel(page, label, optionTexts, scope = page) {
  const field = formField(page, label, scope);
  await field.locator('.ant-select').first().click({ timeout: ACTION_TIMEOUT });
  await page.waitForTimeout(200);
  for (const text of optionTexts) {
    await chooseOption(page, field, text);
    await page.waitForTimeout(150);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
}

/**
 * Fill a `mode="tags"` Select — free-text values committed with Enter
 * (e.g. the Sizes field on Size Presets).
 */
export async function fillTagsByLabel(page, label, values, scope = page) {
  const field = formField(page, label, scope);
  const input = field.locator('input').first();
  await input.click({ timeout: ACTION_TIMEOUT });
  for (const value of values) {
    await input.fill(String(value));
    await page.waitForTimeout(200);
    // When the tags Select also has preset options, typing filters them and Enter
    // commits whichever option is *highlighted* — typing "S" against an S/M/L/XS list
    // silently yielded "XS". Click the exact option when one exists; only fall back to
    // Enter for genuinely free-text values (e.g. numeric waist sizes).
    const exact = visibleOption(page, value);
    if (await exact.count()) {
      await exact.click({ timeout: ACTION_TIMEOUT });
    } else {
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(150);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
}

/**
 * Type into a Quill rich-text editor (Terms & Conditions content).
 * Quill is a contenteditable div, so `fill()` does not apply — click and type.
 */
export async function fillRichText(page, text, scope = page) {
  const editor = scope.locator('.rich-text-editor-wrapper .ql-editor').first();
  await editor.click({ timeout: ACTION_TIMEOUT });
  await page.keyboard.type(text, { delay: 5 });
  await page.waitForTimeout(200);
}

/** Tick a checkbox by its visible label text, if not already ticked. */
export async function checkByText(page, text, scope = page) {
  const box = scope
    .locator('.ant-checkbox-wrapper')
    .filter({ hasText: new RegExp(`^${escapeRe(text)}$`) })
    .first();
  if ((await box.locator('input:checked').count()) === 0) {
    await box.click({ timeout: ACTION_TIMEOUT });
  }
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
