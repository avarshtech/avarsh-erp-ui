---
name: playwright-test
description: >
  Create, run, and fix Playwright E2E tests for the Avarsh ERP UI, against the local e2e stack only.
  Runs headless by default; headed (and slowed down) only when the user wants to watch locally,
  never in CI. Use this skill whenever
  the user asks to: write E2E tests, test a page/module, create Playwright specs, record a test,
  run tests visually, debug a failing test, fix flaky tests, or says anything like "test this page",
  "write a spec for X", "run the tests", "check if X works", "record a test for Y", "watch the test",
  or "playwright". Also trigger when the user finishes implementing a feature and you want to verify
  it works end-to-end. Even if the user just says "test it" — use this skill.
---

# Playwright Test Skill

Create, execute, and fix Playwright E2E tests for the Avarsh Garment ERP UI. The rules for specs are
rules 42–45 of [`docs/engineering/ui-standards.md`](../../../docs/engineering/ui-standards.md); how to run
the stack, the projects, the fixtures and the known failures are in [`e2e/README.md`](../../../e2e/README.md).
Read both before writing or running a spec.

## Core Principles

1. **Local stack only** — specs run against the e2e API on 8088 (H2, rebuilt at every boot) and
   `vite --mode e2e` on a pinned port. `e2e/config/env.js` refuses any other server unless
   `E2E_ALLOW_REMOTE=1`; never set it to reach a shared or production API.
2. **Headless by default; headed only to watch** — when the user wants to watch locally, run with
   `--headed` (or `--ui` to step through). CI is always headless (`CI` set). Do not make headed or
   slow motion the default in any config.
3. **New specs use the fixtures** — `import { test, expect } from '../../fixtures.js'`: `authedPage`
   (signed in per test through the API), `api` (an API client per worker) and `consoleGuard`
   (fails on a page or console error). Seed through the API with unique data; no `waitForTimeout`,
   no empty `.catch()`, no copied helpers, no passwords or production URLs.
4. **Follow existing patterns** — reuse `e2e/helpers/`; never reinvent what already exists.
5. **Fix what you break** — when tests fail, diagnose the root cause. Ask the user whether it's a
   test issue or an app bug before fixing app code. Check the known failures in e2e/README.md first.

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

import { test, expect } from '../../fixtures.js';
import { antTableWaitForData } from '../../helpers/antd-helpers.js';

const STAMP = () => Date.now().toString().slice(-6);

test.describe('{Module Name} — {Test Category}', () => {
  test('{descriptive test name}', async ({ api, authedPage, consoleGuard }) => {
    // Seed through `api`, drive the screen through `authedPage`; consoleGuard fails the test on a
    // page error or console error.
    await authedPage.goto('/{route}');
    await antTableWaitForData(authedPage);
  });
});
```

Older specs use `@playwright/test` with the saved login (`ensureSessionActive`, `navigateWithAuth`);
leave them as they are unless you are asked to migrate them.

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
| Signed-in page per test | the `authedPage` fixture | `fixtures.js` |
| API client (seed, verify) | the `api` fixture | `fixtures.js` |
| Fail on console errors | the `consoleGuard` fixture | `fixtures.js` |
| Navigate with auth (older specs) | `navigateWithAuth(page, path)` | `navigation.js` |
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

### Scope: the affected spec file(s) only (owner's rule, 2026-10-06)

Run only the spec file(s) that cover the screen or flow you changed — like a unit test. A whole module
folder, a whole project, several projects or the full suite run **only when the user asks** for them
(the full suite took 2.2 h on this machine). Boot the local e2e stack only when a spec must run, reuse
it across iterations, and stop it when done. A failure in a spec you did not touch is reported, not
investigated, unless the user asks. Same rule as erp-dev SKILL.md Rule 7.

### Running a spec

Start the local stack first (e2e/README.md): the API on 8088 with the e2e profile, then
`npx vite --mode e2e --port 3001 --strictPort`, warmed with one request to `/src/main.jsx`.

```bash
E2E_BASE_URL=http://localhost:3001 E2E_PASSWORD=admin123 \
  npx playwright test e2e/specs/{module}/{file}.spec.js --project={project-name} --reporter=list
```

### Watching it (local only, when the user asks)

Add `--headed` to see the browser, or use `--ui` to step through and replay. Playwright has no
`--slow-mo` or `--video` CLI flag: slow motion and always-on video are config settings, used
by the `full-flow` demo in `playwright.demo.config.js`. For a one-off slowed run, copy that
project's `use` block into a temporary config; do not change the main config.

### Video and traces

`playwright.config.js` keeps videos and screenshots of failed tests (`test-results/`), and records
a trace on the first retry; local runs do not retry, so pass `--trace on` when you need one. CI
uploads the report, junit and traces as artifacts.

### Running All Tests (only when the user asks)

```bash
E2E_BASE_URL=http://localhost:3001 npx playwright test --reporter=list   # runs every project; nightly CI does this
```

### Running a Specific Module (only when the user asks)

```bash
E2E_BASE_URL=http://localhost:3001 npx playwright test --project={project-name} --reporter=list
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
| Auth redirect to /login | A shared saved login went stale (the API rotates refresh tokens) | Use the `authedPage` fixture |

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

After fixing, re-run the specific failing test (headed if the user wants to watch):

```bash
E2E_BASE_URL=http://localhost:3001 npx playwright test {spec-path} --project={project-name} --reporter=list
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

- [ ] New spec imports `test`/`expect` from `e2e/fixtures.js` and uses `authedPage`, `api`, `consoleGuard`
- [ ] Uses existing helpers from `e2e/helpers/`; role, label or `#id` selectors before `.ant-*` classes
- [ ] Unique data via `STAMP()` or the `test-data.js` factories, seeded through the API
- [ ] Waits for API responses on mutations (create/update/delete); no `waitForTimeout`, no empty `.catch()`
- [ ] No hardcoded IDs, passwords or production URLs
- [ ] File placed in the right `e2e/specs/{module}/` folder; test names say what the test proves
- [ ] Ran green against the local e2e stack (headed only if the user watched)
