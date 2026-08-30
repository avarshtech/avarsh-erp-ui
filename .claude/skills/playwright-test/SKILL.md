---
name: playwright-test
description: >
  Create, run, and fix Playwright E2E tests for the Avarsh ERP UI with headed browser and slow motion
  so the user can visually watch each step. Records video of every test run. Use this skill whenever
  the user asks to: write E2E tests, test a page/module, create Playwright specs, record a test,
  run tests visually, debug a failing test, fix flaky tests, or says anything like "test this page",
  "write a spec for X", "run the tests", "check if X works", "record a test for Y", "watch the test",
  or "playwright". Also trigger when the user finishes implementing a feature and you want to verify
  it works end-to-end. Even if the user just says "test it" — use this skill.
---

# Playwright Test Skill

Create, execute, and fix Playwright E2E tests for the Avarsh Garment ERP UI. Every test run uses a **headed browser with slow motion** so the user can see exactly what's happening, and **records video** for future reference.

## Core Principles

1. **Headed + SlowMo always** — Tests run with `headless: false` and `slowMo: 800` so the user watches each action in real-time. This is non-negotiable for this skill.
2. **Video recording on every run** — Every test records video saved to `e2e/videos/`. These persist for the user to review later.
3. **Follow existing patterns** — The project already has robust helpers and conventions in `e2e/`. Never reinvent what already exists.
4. **Fix what you break** — When tests fail, diagnose the root cause. Ask the user whether it's a test issue or an app bug before fixing.

---

## Phase 1: Creating Test Scripts

### Before Writing Any Test

1. **Read the page source** — Open the target page component in `src/pages/{module}/` and understand:
   - What routes exist (check `src/App.jsx` for the route path)
   - What API calls it makes (check the corresponding service in `src/services/`)
   - What Ant Design components it uses (Table, Form, Drawer, Modal, etc.)
   - What user flows are possible (CRUD, status transitions, search/filter)

2. **Check for existing tests** — Search `e2e/specs/` for tests covering the same module. Avoid duplication.

3. **Identify test scenarios** — Break down into:
   - **List page**: loads, table renders, search/filter works, pagination
   - **Create flow**: open form/drawer, fill fields, save, verify success message + list update
   - **Edit flow**: click row, modify fields, save, verify changes persist
   - **Delete flow**: delete action, confirm popconfirm, verify removal
   - **Workflow transitions**: status changes (Draft -> Submitted -> Approved, etc.)
   - **Validation**: required fields, invalid input, duplicate detection

### File Structure

Place tests following the existing convention:

```
e2e/specs/{module-name}/
  {module-name}-crud.spec.js    — Create, Read, Update, Delete operations
  {module-name}-workflow.spec.js — Status transitions & business logic
  {module-name}-ui.spec.js       — UI-specific tests (tabs, filters, responsive)
```

### Test Script Template

Every test file must follow this structure:

```javascript
/**
 * {Module Name} — E2E Tests
 *
 * What this tests:
 *   - {bullet list of scenarios}
 *
 * Prerequisites:
 *   - {any seed data or setup needed}
 */

import { test, expect } from '@playwright/test';
import {
  antSelect, antDatePickerToday, antTableWaitForData,
  antModalConfirm, antPopconfirmYes, antMessageContains,
  antFormFill, antFormSelect, antDrawerWaitOpen, antDrawerClose
} from '../../helpers/antd-helpers.js';
import {
  navigateWithAuth, ensureSessionActive, goToListPage,
  goToModule, waitForPageReady, goToMasterEntity
} from '../../helpers/navigation.js';

const STAMP = () => Date.now().toString().slice(-6);

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);

  // Capture browser errors for debugging
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[browser:${msg.type()}] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => {
    console.log(`[browser:pageerror] ${err.message}`);
  });
});

test.describe('{Module Name} — {Test Category}', () => {
  test('{descriptive test name}', async ({ page }) => {
    // Test implementation using helpers
  });
});
```

### Must-Use Helpers

Never write raw selectors for Ant Design components. Always use the helpers from `e2e/helpers/`:

| Task | Helper | Source |
|------|--------|--------|
| Select dropdown | `antSelect(page, locator, text)` | `antd-helpers.js` |
| Date picker | `antDatePickerToday(page, locator)` | `antd-helpers.js` |
| Wait for table data | `antTableWaitForData(page)` | `antd-helpers.js` |
| Confirm modal | `antModalConfirm(page)` | `antd-helpers.js` |
| Confirm popconfirm | `antPopconfirmYes(page)` | `antd-helpers.js` |
| Check toast message | `antMessageContains(page, text)` | `antd-helpers.js` |
| Fill form by label | `antFormFill(page, label, value)` | `antd-helpers.js` |
| Select in form by label | `antFormSelect(page, label, text)` | `antd-helpers.js` |
| Open drawer | `antDrawerWaitOpen(page)` | `antd-helpers.js` |
| Close drawer | `antDrawerClose(page)` | `antd-helpers.js` |
| Navigate with auth | `navigateWithAuth(page, path)` | `navigation.js` |
| Session setup | `ensureSessionActive(page)` | `navigation.js` |
| Go to list page | `goToListPage(page, path)` | `navigation.js` |
| Go to master entity | `goToMasterEntity(page, name)` | `navigation.js` |
| Generate unique data | Use `STAMP()` or helpers from `test-data.js` | `test-data.js` |

### Selector Strategy (Priority Order)

1. **Role selectors** — `page.getByRole('button', { name: /Save/i })` (preferred)
2. **ID selectors for Ant Design Selects** — `page.locator('#fieldName')` (most reliable for form Select/combobox fields, avoids asterisk-in-label issues)
3. **`getByTitle(text, { exact: true })`** — For dropdown option selection (prevents "Male" matching "Female")
4. **`getByRole('heading', { name: ... })`** — For page titles (avoids matching breadcrumb text)
5. **Text selectors** — `page.getByText('Draft')` for labels and content
6. **Placeholder** — `page.getByPlaceholder('Search...')` for inputs
7. **Ant Design class** — `.ant-table-row`, `.ant-tag`, `.ant-form-item` (when semantic selectors aren't possible)
8. **Test IDs** — `page.getByTestId('xyz')` (only if already in the component)

Never use fragile CSS selectors like `.ant-btn:nth-child(3)` — they break when layout changes.

### Critical Ant Design Select Gotchas

1. **Required field labels include asterisks** — The accessible name of a required Select becomes `"* Department"`, not `"Department"`. Using `getByRole('combobox', { name: /Department/ })` may fail. Instead, use the input element's `#id` attribute (e.g., `page.locator('#departmentId')`).

2. **Option text matching** — `filter({ hasText: 'Male' })` matches both "Male" and "Fe**male**". Always use `getByTitle('Male', { exact: true })` for dropdown options.

3. **Page title vs breadcrumb** — `getByText('HR Management')` matches both the page heading and breadcrumb. Always use `getByRole('heading', { name: 'HR Management' })`.

4. **Reliable Select helper pattern:**
```javascript
async function pickSelectById(page, idSelector, optionTitle) {
  await page.locator(idSelector).click();
  const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  await dropdown.waitFor({ state: 'visible', timeout: 5000 });
  if (optionTitle) {
    await dropdown.getByTitle(optionTitle, { exact: true }).click();
  } else {
    await dropdown.locator('.ant-select-item-option').first().click();
  }
  await dropdown.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
}
```

### Seeding Master Data

When tests depend on master data (departments, factories, designations, etc.), use the `ApiClient` from `e2e/helpers/api-client.js` in `test.beforeAll` to seed data via API:

```javascript
import { createAuthenticatedClient } from '../../helpers/api-client.js';

let api;
test.beforeAll(async () => {
  api = await createAuthenticatedClient();
  // Check if data exists, create if missing
  const resp = await api.get('/factories/active');
  if (!resp.data?.length) {
    await api.post('/factories', { factoryCode: 'E2E-FAC', factoryName: 'E2E Factory', isActive: true });
  }
});
test.afterAll(async () => { await api?.dispose(); });
```

This ensures dropdowns always have options, regardless of database state.

### API Response Assertions

For create/update/delete operations, always wait for the API response:

```javascript
const [response] = await Promise.all([
  page.waitForResponse(
    (r) => r.url().includes('/api/v1/{endpoint}') && r.request().method() === 'POST',
    { timeout: 20000 }
  ),
  page.getByRole('button', { name: /Save/i }).click(),
]);
expect(response.status()).toBeGreaterThanOrEqual(200);
expect(response.status()).toBeLessThan(300);
```

---

## Phase 2: Running Tests

### Headed + SlowMo + Video (Default)

Always run tests with this command so the user can watch:

```bash
E2E_HEADED=1 npx playwright test e2e/specs/{module}/ \
  --headed \
  --project={project-name} \
  --reporter=list \
  -- --slow-mo=800 \
  2>&1
```

If the test isn't in a specific project, or for running a single spec file:

```bash
npx playwright test e2e/specs/{module}/{file}.spec.js \
  --headed \
  --config=playwright.config.js \
  2>&1
```

To ensure headed + slowMo + video regardless of config, create a temporary override config or use the existing `full-flow` project settings as reference.

**Recommended approach** — run using the Bash tool with environment variables:

```bash
E2E_HEADED=1 npx playwright test {spec-path} \
  --headed \
  --reporter=list
```

The `E2E_HEADED` env var is already wired in `playwright.config.js` to disable headless mode.

### Video Recording

Videos are configured in `playwright.config.js` (`video: 'retain-on-failure'`). The `--video` flag is NOT a valid Playwright CLI option — do NOT pass it on the command line.

To record video on all runs (not just failures), the `full-flow` project already has `video: 'on'`. For other projects, videos are automatically saved on failure to `test-results/` directory.

After a test run, inform the user where videos are stored and how to view them:
- **HTML report:** `npx playwright show-report e2e-report`
- **Test results:** `test-results/{test-name}/video.webm`

### Running All Tests

```bash
E2E_HEADED=1 npx playwright test --headed --reporter=list
```

### Running a Specific Module

```bash
E2E_HEADED=1 npx playwright test e2e/specs/{module}/ --headed --project={project-name} --reporter=list
```

### Viewing Results

After any test run:

```bash
npx playwright show-report e2e-report
```

This opens the HTML report in a browser with video playback, screenshots, and trace viewer.

---

## Phase 3: Using Playwright MCP for Live Browser Interaction

When the user wants to interactively explore a page or record actions, use the **Playwright MCP tools** to drive a live browser session:

### Recording a Test Flow

1. **Launch and navigate**:
   - `browser_navigate` to the target URL
   - `browser_snapshot` to see the current page state

2. **Interact step by step**:
   - `browser_click` — click elements (use the `ref` from snapshot)
   - `browser_fill_form` — fill input fields
   - `browser_select_option` — select dropdown values
   - `browser_press_key` — keyboard actions

3. **Capture state after each action**:
   - `browser_snapshot` after each interaction to verify the result
   - `browser_take_screenshot` for visual evidence
   - `browser_console_messages` to check for errors

4. **Convert to spec file**:
   After recording the flow via MCP tools, convert the sequence of actions into a proper `.spec.js` file following the template above. Map each MCP action to the equivalent Playwright test API call using the project's helpers.

### When to Use MCP vs Spec Files

| Scenario | Use MCP Tools | Use Spec Files |
|----------|--------------|----------------|
| Exploring a page to understand its structure | Yes | No |
| Quick smoke test of a single flow | Yes | No |
| Recording actions to generate a test | Yes | Then convert to spec |
| Repeatable regression test | No | Yes |
| CI/CD pipeline test | No | Yes |
| User says "run the tests" | No | Yes |

---

## Phase 4: Diagnosing and Fixing Failures

When a test fails, follow this sequence:

### 1. Gather Evidence

- Read the error message and stack trace from the test output
- Check screenshots in `test-results/` (auto-captured on failure)
- Check video recording of the failed test
- If trace is available: `npx playwright show-trace {trace-path}`

### 2. Classify the Failure

| Symptom | Likely Cause | Fix Location |
|---------|-------------|--------------|
| Element not found / timeout | Selector changed, element not rendered | Test code — update selector |
| API returned 4xx/5xx | Backend issue or wrong request payload | App code (ask user first) |
| Unexpected text/value | Business logic changed | Could be either — investigate |
| Flaky pass/fail | Race condition, animation timing | Test code — add proper waits |
| Auth redirect to /login | Session expired, token issue | Test setup — check `ensureSessionActive` |

### 3. Fix Strategy

**Always ask the user before fixing app code.** Present your diagnosis:

> "The test `{name}` failed because `{reason}`. This looks like a **{test issue / app bug}**. 
> Here's what I'd fix: `{proposed change}`. Should I go ahead?"

For test code fixes, common solutions:
- **Timeout**: Increase specific wait timeout, add `waitForLoadState('networkidle')`
- **Selector broken**: Update to use role/text selectors instead of CSS
- **Race condition**: Add explicit waits for API responses before asserting
- **Animation**: Use `waitFor({ state: 'visible' })` instead of immediate assertions

### 4. Re-run After Fix

After fixing, always re-run the specific failing test in headed mode to verify:

```bash
E2E_HEADED=1 npx playwright test {spec-path} --headed --reporter=list --video=on
```

---

## Quick Reference: Existing Project Config

Read `references/project-config.md` for details on the existing Playwright setup, including:
- Project definitions in `playwright.config.js`
- Auth flow via `global-setup.js`
- Available helper functions
- Test data factories
- Environment variables

---

## Checklist Before Delivering a Test

- [ ] Uses existing helpers from `e2e/helpers/` (never raw Ant Design selectors)
- [ ] Has `ensureSessionActive(page)` in `beforeEach`
- [ ] Captures browser console errors for debugging
- [ ] Uses `STAMP()` or `test-data.js` factories for unique test data
- [ ] Waits for API responses on mutations (create/update/delete)
- [ ] Uses role/text selectors over CSS selectors
- [ ] File placed in correct `e2e/specs/{module}/` directory
- [ ] Test names are descriptive (describe what the test proves)
- [ ] No hardcoded IDs or data that could conflict between runs
- [ ] Ran successfully in headed mode with user watching
