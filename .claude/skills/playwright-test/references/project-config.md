# Project Playwright Configuration Reference

The full, maintained description is [`e2e/README.md`](../../../../e2e/README.md): the stack recipe,
every project, the environment variables, the fixtures, the known failures and the CI pipeline.
This file is the short version for writing specs; when the two disagree, the README wins.

## playwright.config.js

- `testDir: ./e2e`, 60 s per test, 10 s per `expect`, `workers: 1`, not fully parallel.
- `baseURL` comes from `e2e/config/env.js` (`E2E_BASE_URL`, default `http://localhost:3000` —
  always set it to your pinned e2e port). Loading env.js refuses a base or API URL that is not
  on this machine unless `E2E_ALLOW_REMOTE=1`.
- Local runs: retries 0, list + HTML reporters (`e2e-report/`), headless unless `E2E_HEADED` is
  set, screenshot and video kept on failure, trace on the first retry.
- With `CI` set: headless always, retries 1, `forbidOnly`, junit (`test-results/junit.xml`) and
  GitHub reporters as well.
- `playwright.demo.config.js` holds the headed `full-flow` demo (slowMo 800, video on) and the
  four `rbac-soak-*` projects; run them with `-c playwright.demo.config.js --project=...`.

## Projects

- `setup` (`global-setup.js`): logs in through the UI once and saves `e2e/.auth/user.json`; it
  stops any request the UI sends to another machine's API. Every module project depends on it.
- `smoke` (`specs/smoke/`): the route sweep, the fixtures' own checks and each core module's
  list; signs in per test, so it needs no `setup`. CI runs it on every push to dev.
- One project per module folder under `specs/` (`master-data`, `costing`, `orders`, `bom`, `po`,
  `production-po`, `inventory`, `grn-qc`, `sample-requests`, `export-docs`, ...), plus `legacy`,
  `journey` and `branch` (declared last; restores the single-branch company).
- Pure logic tests are Vitest (`npm test`), next to their modules in `src/`, not Playwright.

## Fixtures (`e2e/fixtures.js`) — use them in new specs

- `authedPage`: the page, signed in for this test through the API. The API rotates the refresh
  token on every use and revokes a reused one, so a saved login shared by many tests goes stale.
- `api`: an `ApiClient` logged in once per worker, for seeding and checking records.
- `consoleGuard`: fails the test on a page error or a console error;
  `test.use({ consoleGuardLevels: ['error', 'warning'] })` adds warnings.

## Helper files

- `helpers/antd-helpers.js`: Ant Design 6 interactions (`antSelect`, `antDatePickerToday`,
  `antTableWaitForData`, `antTableRowCount`, `antModalConfirm`, `antPopconfirmYes`,
  `antMessageContains`, `antDrawerWaitOpen`, `antDrawerClose`, `antFormFill`, `antFormSelect`).
- `helpers/navigation.js`: the older login-by-storage-state helpers (`navigateWithAuth`,
  `goToModule`, `goToListPage`, `waitForPageReady`, `ensureSessionActive`, `goToMasterEntity`).
- `helpers/test-data.js`: timestamp-based payload factories (`buyerPayload`, `supplierPayload`,
  `itemPayload`, `stylePayload`, `costSheetPayload`, `orderPayload`, ...).
- `helpers/api-client.js`: `ApiClient` and `createAuthenticatedClient(username?, password?)`.
- Per-module seed helpers: `order-seed.js`, `bom-seed.js`, `po-seed.js`, `grn-qc-data.js`,
  `job-work-*.js`, `branch-seed.js`, `export-templates.js`, `packing-api.js`, ...

## Patterns

API response assertion on save:

```javascript
const [saveResp] = await Promise.all([
  page.waitForResponse((r) => r.url().includes('/api/v1/{endpoint}') && r.request().method() === 'POST'),
  page.getByRole('button', { name: /Save$/i }).click(),
]);
expect(saveResp.status()).toBeLessThan(300);
```

Unique data: `const STAMP = () => Date.now().toString().slice(-6);`

Async-search Select: see `pickOption` in `e2e/specs/sample-requests/helpers.js`.
