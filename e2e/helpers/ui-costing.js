/**
 * UI helpers for the Cost Sheet form.
 *
 * The form is a single Collapse with all panels open by default
 * (`general`, `fabric`, `trims`, `manufacturing`, `overhead`, `summary`), each
 * containing an editable AntD table. Rows are added with an "Add <X>" section button
 * and then filled cell by cell.
 *
 * Cells are addressed by COLUMN HEADER, not by index or placeholder:
 *   - placeholders don't work — an AntD Select renders its placeholder as a span, so
 *     getByPlaceholder() never matches one (same trap as ui-master.js)
 *   - hard-coded indices break the moment a column is added
 * Header text is matched as a prefix so currency-suffixed headers like "Cost (₹)" work.
 */

import { expect } from '@playwright/test';
import { visibleOption } from './ui-master.js';

const ACTION_TIMEOUT = 15000;
const SETTLE_MS = 300;

const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The open Collapse panel whose header matches, e.g. /Section B/. */
export function section(page, headingPattern) {
  return page.locator('.ant-collapse-item').filter({ hasText: headingPattern }).first();
}

/** Zero-based index of the column whose header starts with `headerText`. */
async function columnIndex(sectionLocator, headerText) {
  const heads = sectionLocator.locator('.ant-table-thead th');
  const count = await heads.count();
  const pattern = new RegExp(`^\\s*${escapeRe(headerText)}`);
  for (let i = 0; i < count; i++) {
    if (pattern.test((await heads.nth(i).innerText()).trim())) return i;
  }
  throw new Error(`Column "${headerText}" not found in section (${count} columns)`);
}

/** The cell in `row` under the column whose header starts with `headerText`. */
export async function cell(sectionLocator, row, headerText) {
  return row.locator('td').nth(await columnIndex(sectionLocator, headerText));
}

/** Add a row to a section via its "Add ..." button, then return the new row. */
export async function addRow(page, sectionLocator, buttonText) {
  const before = await sectionLocator.locator('.ant-table-row').count();
  await sectionLocator.locator('button').filter({ hasText: buttonText }).first().click({ timeout: ACTION_TIMEOUT });
  await expect(sectionLocator.locator('.ant-table-row')).toHaveCount(before + 1, { timeout: 10000 });
  return sectionLocator.locator('.ant-table-row').nth(before);
}

/**
 * Choose an option in the Select under a given column.
 * Costing pickers are searchable, so type to filter — the variant lists are long
 * enough to be virtualised (see B-018).
 */
export async function pickInRow(page, sectionLocator, row, headerText, optionText) {
  const select = (await cell(sectionLocator, row, headerText)).locator('.ant-select').first();
  await select.click({ timeout: ACTION_TIMEOUT });
  await page.waitForTimeout(200);

  const input = select.locator('input').first();
  if ((await input.getAttribute('readonly')) === null) {
    await input.fill('');
    await input.type(String(optionText), { delay: 10 });
    await page.waitForTimeout(350);
  }
  await visibleOption(page, optionText).click({ timeout: ACTION_TIMEOUT });
  await page.waitForTimeout(SETTLE_MS);
}

/** Type into the input under a given column. */
export async function typeInRow(page, sectionLocator, row, headerText, value) {
  const input = (await cell(sectionLocator, row, headerText)).locator('input').first();
  await input.fill(String(value), { timeout: ACTION_TIMEOUT });
  await page.waitForTimeout(150);
}

/** Read the input value under a given column (used to assert auto-filled costs). */
export async function readInRow(sectionLocator, row, headerText) {
  return (await cell(sectionLocator, row, headerText)).locator('input').first().inputValue();
}
