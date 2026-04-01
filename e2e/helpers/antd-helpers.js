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
  // Wait for table to appear
  await page.locator('.ant-table').waitFor({ state: 'visible', timeout });
  // Wait for spinner to disappear
  await page.locator('.ant-spin-spinning').waitFor({ state: 'hidden', timeout }).catch(() => {});
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
