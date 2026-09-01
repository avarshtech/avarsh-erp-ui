/**
 * Shared helpers for the sewing module specs.
 *
 * The sewing workspace is a single route with tabs, so almost every spec starts
 * by landing on a tab and waiting for its first API call to settle. These wrap
 * that, plus the two AntD interactions the module leans on hardest.
 */
import { expect } from '@playwright/test';
import { navigateWithAuth, waitForPageReady } from '../../helpers/navigation.js';

export const SEWING = '/production/sewing';

/** Tab keys as the workspace writes them into the query string. */
export const TABS = {
  dashboard: 'dashboard',
  plan: 'plan',
  receipt: 'receipt',
  trims: 'trim-verification',
  hourly: 'hourly',
  measurement: 'measurement',
  topse: 'topse',
  issue: 'issue',
  replacements: 'replacements',
  operators: 'operators',
};

/** Land on one tab of the sewing workspace with its data loaded. */
export async function openTab(page, tab) {
  await navigateWithAuth(page, `${SEWING}?tab=${tab}`);
  await waitForPageReady(page);
  await page.locator('[role="tabpanel"]').first().waitFor({ state: 'visible', timeout: 15000 });
  await settle(page);
}

/** Let the tab's fetches land — the screens issue 1-4 calls on mount. */
export async function settle(page, ms = 1200) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms);
}

/**
 * Pick an option from an AntD select. Scoped by an anchor locator because the
 * floor screens put several unlabelled selects in one toolbar.
 */
export async function pickOption(page, selectLocator, optionText) {
  await selectLocator.click();
  const option = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
    .locator('.ant-select-item-option')
    .filter({ hasText: optionText })
    .first();
  await option.waitFor({ state: 'visible', timeout: 10000 });
  await option.click();
  await page.waitForTimeout(250);
}

/** The nth select inside a scope, for toolbars where selects carry no label. */
export function selectAt(scope, index) {
  return scope.locator('.ant-select').nth(index);
}

/** Read a table as rows of plain text, header row dropped. */
export async function tableRows(page, scope = page) {
  return scope.locator('.ant-table-tbody tr').evaluateAll(
    (rows) => rows
      .map((r) => [...r.querySelectorAll('td')].map((c) => c.innerText.trim()).join(' | '))
      .filter(Boolean),
  );
}

/** Assert a success toast mentioning text appeared. */
export async function expectToast(page, pattern) {
  await expect(
    page.locator('.ant-message-notice').filter({ hasText: pattern }).first(),
  ).toBeVisible({ timeout: 15000 });
}

/**
 * Console errors worth failing a test over. The dev server's service worker and
 * one AntD deprecation in a shared component are pre-existing and unrelated to
 * the sewing screens, so they are filtered rather than allowed to mask real ones.
 */
const IGNORED_CONSOLE = [
  /unsupported MIME type/i,
  /Service worker registration failed/i,
  /overlayInnerStyle` is deprecated/i,
  /ResizeObserver loop/i,
  // Response failures are asserted properly against the response status, with
  // the auth handshake excluded; the console line carries no URL, so matching
  // on it here would only duplicate that check less precisely.
  /Failed to load resource/i,
];

export function watchConsole(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (IGNORED_CONSOLE.some((re) => re.test(text))) return;
    errors.push(text);
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  return errors;
}
