# Project Playwright Configuration Reference

## playwright.config.js Summary

- **testDir**: `./e2e`
- **timeout**: 60s per test
- **expect timeout**: 10s
- **workers**: 1 (sequential)
- **fullyParallel**: false
- **retries**: 0
- **headless**: controlled by `E2E_HEADED` env var — set it to any value to go headed
- **reporter**: list + HTML (`e2e-report/`)
- **trace**: on first retry
- **screenshot**: only on failure
- **video**: retain on failure (override with `--video=on` for always-on recording)

## Projects Defined

| Project | testDir / testMatch | Notes |
|---------|-------------------|-------|
| setup | `global-setup.js` | Auth — saves `e2e/.auth/user.json` |
| legacy | `costing*.spec.js` | Original costing tests |
| master-data | `e2e/specs/master-data/` | All master entity CRUD |
| costing | `e2e/specs/costing/` | Costing CRUD + workflow |
| orders | `e2e/specs/orders/` | Order CRUD + workflow |
| bom | `e2e/specs/bom/` | BOM CRUD + workflow |
| po | `e2e/specs/po/` | Purchase Order CRUD + workflow |
| production-po | `e2e/specs/production-po/` | Production PO UI tests |
| work-orders | `e2e/specs/work-orders/` | Work Order UI tests |
| admin | `e2e/specs/admin/` | User/Role/Approval management |
| validation | `e2e/specs/validation/` | RBAC, optimistic lock, referential integrity |
| full-flow | `full-flow.spec.js` | End-to-end business flow, headed + slowMo:800 + video:on |

All projects except `setup` and `full-flow` depend on `setup` and use `storageState: './e2e/.auth/user.json'`.

## Auth Setup (global-setup.js)

- Navigates to `/login`
- Fills username/password from `E2E_USERNAME`/`E2E_PASSWORD` env vars (defaults: `superadmin`/`admin123`)
- Waits for POST to `/auth/login` to return 200
- Saves storage state to `e2e/.auth/user.json`

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `E2E_BASE_URL` | `http://localhost:3000` | App URL |
| `E2E_HEADED` | (unset = headless) | Set to any value for headed mode |
| `E2E_USERNAME` | `superadmin` | Login username |
| `E2E_PASSWORD` | `admin123` | Login password |

## Helper Files

### e2e/helpers/antd-helpers.js
Ant Design 6.x component interaction helpers:
- `antSelect(page, locator, text, { first })` — Select dropdown option
- `antDatePickerToday(page, locator)` — Pick today in DatePicker
- `antTableWaitForData(page, { timeout })` — Wait for table to load
- `antTableRowCount(page)` — Count table data rows
- `antModalConfirm(page, { buttonText, timeout })` — Confirm modal
- `antPopconfirmYes(page, { timeout })` — Confirm popconfirm
- `antMessageContains(page, text, { timeout })` — Check toast message
- `antDrawerWaitOpen(page, { timeout })` — Wait for drawer to open
- `antDrawerClose(page)` — Close drawer via X button
- `antFormFill(page, label, value)` — Fill input by form label
- `antFormSelect(page, label, text, options)` — Select in form by label

### e2e/helpers/navigation.js
Auth-aware navigation:
- `navigateWithAuth(page, path, { username, password })` — Navigate, re-login if session expired
- `goToModule(page, path)` — Navigate + wait for page ready
- `goToListPage(page, path)` — Navigate + wait for table, returns boolean (has data)
- `waitForPageReady(page, { timeout })` — Wait for spinners to clear
- `ensureSessionActive(page)` — Set sessionStorage flags in beforeEach
- `goToMasterEntity(page, entityName)` — Navigate to master data and click sidebar entity

### e2e/helpers/test-data.js
Timestamp-based unique test data factories:
- `buyerPayload(overrides)`, `supplierPayload(overrides)`, `categoryPayload(overrides)`
- `subCategoryPayload(categoryId, overrides)`, `itemPayload(overrides)`
- `stylePayload(buyerId, overrides)`, `processPayload(overrides)`, `partPayload(overrides)`
- `overheadPayload(overrides)`, `sizePresetPayload(overrides)`
- `paymentTermsPayload(overrides)`, `termsConditionsPayload(overrides)`, `uomPayload(overrides)`
- `costSheetPayload(buyerId, styleId, overrides)`, `orderPayload(buyerId, overrides)`

### e2e/helpers/api-client.js
Direct API calls for test setup (bypassing UI):
- Check this file for available API helper functions when tests need seed data

## Existing Test Patterns

### Common pattern: beforeEach with session + console capture
```javascript
test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[browser:${msg.type()}] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => {
    console.log(`[browser:pageerror] ${err.message}`);
  });
});
```

### Common pattern: API response assertion on save
```javascript
const [saveResp] = await Promise.all([
  page.waitForResponse(
    (r) => r.url().includes('/api/v1/{endpoint}') && r.request().method() === 'POST',
    { timeout: 20000 }
  ),
  page.getByRole('button', { name: /Save$/i }).click(),
]);
expect(saveResp.status()).toBeGreaterThanOrEqual(200);
expect(saveResp.status()).toBeLessThan(300);
```

### Common pattern: unique test data via timestamp
```javascript
const STAMP = () => Date.now().toString().slice(-6);
// Use in test: `Season: SS${STAMP()}`
```

### Common pattern: Ant Select with search + auto-populate verification
See `e2e/specs/production-po/production-po-ui.spec.js` for the `pickOrderInSelect` helper — this is the gold standard for interacting with async search Select components.
