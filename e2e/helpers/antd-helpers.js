/**
 * Ant Design Component Interaction Helpers for Playwright E2E Tests
 *
 * Provides reliable helpers for interacting with Ant Design 6.x components,
 * which use complex DOM structures (dropdowns, portals, animations).
 */

/**
 * Select an option from an Ant Design Select dropdown.
 * @param {Page} page - Playwright page
 * @param {Locator} selectLocator - Locator for the .ant-select element
 * @param {string|null} optionText - Text of the option to select (null to pick first)
 * @param {object} options - { first: boolean }
 */
export async function antSelect(page, selectLocator, optionText, { first = false } = {}) {
  await selectLocator.click();
  const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  await dropdown.waitFor({ state: 'visible', timeout: 5000 });

  if (first || !optionText) {
    await dropdown.locator('.ant-select-item-option').first().click();
  } else {
    await dropdown.locator('.ant-select-item-option').filter({ hasText: optionText }).click();
  }
  await dropdown.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
}

/**
 * Click today in an Ant Design DatePicker.
 */
export async function antDatePickerToday(page, pickerLocator) {
  await pickerLocator.click();
  const panel = page.locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)').last();
  await panel.waitFor({ state: 'visible', timeout: 5000 });
  await panel.locator('.ant-picker-cell-today .ant-picker-cell-inner').click();
  await panel.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
}

/**
 * Wait for an Ant Design table to finish loading (spinner gone, rows present).
 */
export async function antTableWaitForData(page, { timeout = 15000 } = {}) {
  // Wait for a table to appear (.first() — a form/modal may embed its own table,
  // e.g. Buyer shipping-locations, making a bare .ant-table match ambiguous)
  await page.locator('.ant-table').first().waitFor({ state: 'visible', timeout });
  // Wait for spinner to disappear
  await page.locator('.ant-spin-spinning').first().waitFor({ state: 'hidden', timeout }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
}

/**
 * Get the number of data rows in the first visible Ant Design table.
 */
export async function antTableRowCount(page) {
  return page.locator('.ant-table-row').count();
}

/**
 * Confirm an Ant Design Modal (click OK/Yes/Confirm button).
 */
export async function antModalConfirm(page, { buttonText = /ok|yes|confirm/i, timeout = 5000 } = {}) {
  const modal = page.locator('.ant-modal').last();
  await modal.waitFor({ state: 'visible', timeout });
  await modal.getByRole('button', { name: buttonText }).click();
  await modal.waitFor({ state: 'hidden', timeout }).catch(() => {});
}

/**
 * Confirm an Ant Design Popconfirm (click the confirm button inside popconfirm).
 */
export async function antPopconfirmYes(page, { timeout = 3000 } = {}) {
  const popconfirm = page.locator('.ant-popconfirm').last();
  await popconfirm.waitFor({ state: 'visible', timeout });
  await popconfirm.getByRole('button', { name: /ok|yes|delete|confirm/i }).click();
  await popconfirm.waitFor({ state: 'hidden', timeout }).catch(() => {});
}

/**
 * Check that an Ant Design message toast contains the expected text.
 */
export async function antMessageContains(page, text, { timeout = 8000 } = {}) {
  const messageEl = page.locator('.ant-message');
  await messageEl.waitFor({ state: 'visible', timeout }).catch(() => {});
  return messageEl.textContent();
}

/**
 * Wait for an Ant Design Drawer to open.
 */
export async function antDrawerWaitOpen(page, { timeout = 5000 } = {}) {
  const drawer = page.locator('.ant-drawer-open').last();
  await drawer.waitFor({ state: 'visible', timeout });
  return drawer;
}

/**
 * Close an Ant Design Drawer via the X button.
 */
export async function antDrawerClose(page) {
  await page.locator('.ant-drawer-open .ant-drawer-close').last().click();
  await page.locator('.ant-drawer-open').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
}

/**
 * Fill a form field by label text.
 */
export async function antFormFill(page, labelText, value) {
  const formItem = page.locator('.ant-form-item').filter({ hasText: labelText }).first();
  const input = formItem.locator('input, textarea').first();
  await input.clear();
  await input.fill(value);
}

/**
 * Select a value in a form's Select field by label text.
 */
export async function antFormSelect(page, labelText, optionText, options) {
  const formItem = page.locator('.ant-form-item').filter({ hasText: labelText }).first();
  const select = formItem.locator('.ant-select').first();
  await antSelect(page, select, optionText, options);
}

/**
 * Fill an Ant Design InputNumber. Accepts either a form label or a #id selector.
 * InputNumber nests the real <input> inside .ant-input-number, so antFormFill misses it
 * when the form item contains other inputs.
 * @param {Page} page
 * @param {string} labelOrId - form label text, or a selector starting with '#'
 * @param {number|string} value
 */
export async function antInputNumberFill(page, labelOrId, value) {
  let input;
  if (typeof labelOrId === 'string' && labelOrId.startsWith('#')) {
    input = page.locator(labelOrId);
  } else {
    const formItem = page.locator('.ant-form-item').filter({ hasText: labelOrId }).first();
    input = formItem.locator('.ant-input-number input').first();
  }
  await input.click();
  await input.press('ControlOrMeta+a');
  await input.fill(String(value));
  // Blur so onChange/formatter commits the value
  await input.press('Tab');
}

/**
 * Fill an input/InputNumber inside an editable table cell.
 * @param {Locator} rowLocator - locator for the .ant-table-row (or any row container)
 * @param {number} colIndex - 0-based cell index
 * @param {string|number} value
 */
export async function antTableCellInput(rowLocator, colIndex, value) {
  const cell = rowLocator.locator('td').nth(colIndex);
  const input = cell.locator('input:not([type="checkbox"]), textarea').first();
  await input.click();
  await input.press('ControlOrMeta+a');
  await input.fill(String(value));
  await input.press('Tab');
}

/**
 * Select an option in a Select that lives inside an editable table cell.
 * @param {Page} page
 * @param {Locator} rowLocator
 * @param {number} colIndex - 0-based cell index
 * @param {string|null} optionText - null picks first option
 */
export async function antTableCellSelect(page, rowLocator, colIndex, optionText) {
  const cell = rowLocator.locator('td').nth(colIndex);
  const select = cell.locator('.ant-select').first();
  await antSelect(page, select, optionText, { first: !optionText });
}

/**
 * Toggle an Ant Design Checkbox or Switch by its form label.
 * @param {Page} page
 * @param {string} labelText
 * @param {boolean|null} desired - true/false to force a state, null to just toggle
 */
export async function antCheckboxToggle(page, labelText, desired = null) {
  const formItem = page.locator('.ant-form-item').filter({ hasText: labelText }).first();
  const control = formItem.locator('.ant-checkbox-wrapper, .ant-switch').first();
  if (desired !== null) {
    const isChecked = await control.evaluate((el) =>
      el.classList.contains('ant-switch')
        ? el.classList.contains('ant-switch-checked')
        : el.classList.contains('ant-checkbox-wrapper-checked'),
    );
    if (isChecked === desired) return;
  }
  await control.click();
}

/**
 * Activate a tab by its label text.
 */
export async function antTabSelect(page, labelText) {
  const tab = page.locator('.ant-tabs-tab').filter({ hasText: labelText }).first();
  await tab.click();
  await page
    .locator('.ant-tabs-tab-active')
    .filter({ hasText: labelText })
    .waitFor({ state: 'visible', timeout: 3000 });
}
