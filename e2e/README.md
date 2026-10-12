# End-to-end tests (Playwright)

The specs drive the real UI against a local erp-purchase API that runs on an in-memory H2
database (the API's `e2e` profile). Flyway builds the schema and loads the e2e seed on every
boot, so each run starts from the same data, and stopping the API throws it away.

```
Playwright ──> UI (vite --mode e2e, :3001) ──> API (e2e profile, :8088) ──> H2 in memory
```

## Before you start: stay off real data

- **`npm run dev` talks to a shared API with real data.** `.env` points the dev server at
  `https://api.avarshai.com/api/v1`. Always start the UI with `--mode e2e`, which loads
  `.env.e2e` (`http://localhost:8088/api/v1`, `VITE_APP_ENV=e2e`).
- **`E2E_BASE_URL` defaults to `http://localhost:3000`**, the port a plain `npm run dev` takes.
  Always set it to the port you pinned for the e2e dev server.
- **Passwords.** The specs log in as the e2e seed's `superadmin` / `admin123`
  (`erp-purchase/src/main/resources/db/e2eseed/V100__seed_roles_users.sql`). Pass any other
  password through `E2E_PASSWORD`; never commit one.

## Prerequisites

- `erp-purchase` cloned next to this repo (`../erp-purchase`). It builds with Gradle
  (`./gradlew`, JDK 25 toolchain); there is no Maven wrapper.
- Node 24.21.0 (`.nvmrc`) and `npm ci` in this repo.
- Chromium for Playwright, once and after every Playwright upgrade: `npx playwright install chromium`.

## Run the stack locally

### 1. The API on port 8088

```bash
cd ../erp-purchase
SERVER_PORT=8088 ./gradlew bootRun --args="--spring.profiles.active=e2e"
```

PowerShell: `$env:SERVER_PORT = '8088'; ./gradlew bootRun --args="--spring.profiles.active=e2e"`

- Flyway runs `db/h2migration` and then the seed in `db/e2eseed`.
- A boot takes about 2 minutes when the machine is warm and up to about 20 minutes cold on a
  slow drive. The log can sit at `> Task :bootRun` for minutes while classes are scanned; that is
  not a hang, so do not kill it and reboot.
- It is ready when the log prints `Started ErpPurchaseApplication`, or when
  `curl -s http://localhost:8088/actuator/health` returns `{"status":"UP"}`
  (`/actuator/health/readiness` is there too). The `/api/v1/...` data endpoints need a login,
  so they are no use as a readiness probe.

### 2. The UI dev server on a pinned port

```bash
npx vite --mode e2e --port 3001 --strictPort
curl -s http://localhost:3001/src/main.jsx > /dev/null    # warm it up once
```

- `--strictPort` makes vite fail when the port is taken. Without it, vite moves to the next
  free port while your tests still go to the pinned one, where another session's dev server
  (perhaps pointed at the shared API) is listening.
- The dev server compiles on first request. Without the warm-up, the first run's `setup` login
  can time out, which reads as "1 failed, N did not run".

### 3. Playwright

```bash
E2E_BASE_URL=http://localhost:3001 E2E_PASSWORD=admin123 \
  npx playwright test e2e/specs/po/po-workflow.spec.js --project=po
```

PowerShell: `$env:E2E_BASE_URL = 'http://localhost:3001'; $env:E2E_PASSWORD = 'admin123'; npx playwright test e2e/specs/po/po-workflow.spec.js --project=po`

- Run what your change touches: the affected spec files, with their project. Whole projects
  and the full suite are for CI or when they are asked for.
- Always name the project. Without `--project`, Playwright runs all of them, including
  `full-flow` (a headed, slowed-down demo with an 8-minute timeout) and the `rbac-soak` projects.
- For several projects, pass several `--project` flags to one command: `setup` then runs once,
  and `workers: 1` runs the rest one after another.
- Headed browser: set `E2E_HEADED=true`, or use `--headed` / `--ui`. The
  `npm run test:e2e:headed` script uses POSIX syntax and does not work in cmd or PowerShell.
- The `npm run test:e2e:<project>` scripts exist, but they set no base URL; export
  `E2E_BASE_URL` and `E2E_PASSWORD` first.

### A second stack on 8089 and 3002

When another session already holds 8088 or 3001, leave it alone and start your own:

```bash
cd ../erp-purchase && SERVER_PORT=8089 ./gradlew bootRun --args="--spring.profiles.active=e2e"
VITE_API_BASE_URL=http://localhost:8089/api/v1 npx vite --mode e2e --port 3002 --strictPort
E2E_BASE_URL=http://localhost:3002 E2E_API_URL=http://localhost:8089/api/v1 E2E_PASSWORD=admin123 \
  npx playwright test <spec> --project=<project>
```

- A variable already set in the environment wins over `.env.e2e`.
- Run at most two stacks on one machine.
- Run one Playwright process per stack. Two runs at once against a freshly booted stack time
  out the `setup` login and report everything else as "did not run". That looks like a broken
  login, but it is not.

### Stopping the stack

Closing the terminal or stopping the task that ran `bootRun` can leave the forked JVM
listening, and `npx vite` can leave its node process behind. The next boot then fails with
"Port 8088 was already in use", or a later run quietly talks to the old API. Free your ports
explicitly (PowerShell), after checking the process is yours:

```powershell
Get-NetTCPConnection -LocalPort 8088 -State Listen | ForEach-Object { Get-Process -Id $_.OwningProcess }
Get-NetTCPConnection -LocalPort 8088 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess }
```

Do the same for the vite port.

## Environment variables

| Variable | Default | Used by |
|---|---|---|
| `E2E_BASE_URL` | `http://localhost:3000` | `playwright.config.js` (`baseURL`). Always set it. |
| `E2E_API_URL` | `http://localhost:8088/api/v1` | `helpers/api-client.js`: API logins, seeding and the API-level specs |
| `E2E_USERNAME` | `superadmin` | `global-setup.js`, `helpers/navigation.js`, `helpers/api-client.js` |
| `E2E_PASSWORD` | `admin123` (the e2e seed) | the same three files |
| `E2E_HEADED` | unset | `playwright.config.js`: a visible browser when set |
| `SWEEP_SECTIONS` | unset, meaning all | `specs/smoke/route-sweep.spec.js`: comma-separated `SECTIONS` keys to sweep |
| `E2E_LIVE_AI` | unset | `specs/costing/costing-ai-live.spec.js` runs only when it is set, and calls the real AI model |
| `SERVER_PORT` | `8088` | the API's e2e profile |
| `VITE_API_BASE_URL` | from `.env.e2e` | the API the dev server talks to |

## Projects

`playwright.config.js` defines 31 projects. On 2026-10-12, `npx playwright test --list`
counted 1,049 tests in 141 files.

| Project | Specs | Notes |
|---|---|---|
| `setup` | `global-setup.js` | Logs in once and saves `e2e/.auth/user.json`. Every browser project depends on it. |
| `unit` | `e2e/unit/` | Node only: pure calculators and models. No browser, login or API. |
| `tna-engine` | `specs/tna/01-engine*.spec.js` | Node only: the T&A engine against the CR-TNA-001 worked example. |
| `smoke` | `specs/smoke/route-sweep.spec.js` | Every parameter-free route in `SCREENS` (`src/utils/permissions.js`) loads with no page error and no console error or warning. Run it against the dev server: React and antd warnings exist only in development builds. |
| `legacy` | `e2e/costing.spec.js`, `e2e/costing-full-entry.spec.js` | The original costing specs. |
| `master-data`, `costing`, `orders`, `bom`, `po`, `production-po`, `cutting`, `sewing`, `virtual-factory`, `tna`, `sample-requests`, `hr`, `admin`, `approvals`, `inventory`, `reports`, `validation`, `grn-qc`, `export-docs` | `specs/<project>/` | One folder per module. Where the files are numbered, they run in order and build on each other. |
| `journey` | `specs/journey/` | Creates every record through the real screens (masters, costing, BOM, order, PO, GRN). Numbered and idempotent; 15-minute test timeout; video on. |
| `branch` | `specs/branch/` | Makes the company multi-branch, and `99-restore-single-branch` closes the branches again. Declared last: run nothing after it until the restore has run. |
| `rbac-soak-setup`, `rbac-soak-merch`, `rbac-soak-store`, `rbac-soak-costing` | `rbac-soak-setup.js`, `specs/rbac-soak/` | Non-admin roles that exist only in the e2e seed, with their own setup. Run them by name. |
| `full-flow` | `specs/full-flow.spec.js` | A headed, slowed-down demo of costing, order, BOM and PO, with its own login. |

## Layout

```
e2e/
  global-setup.js       login once, save the storage state (project "setup")
  rbac-soak-setup.js    logins for the rbac-soak projects
  costing*.spec.js      the legacy costing specs
  helpers/              api-client (API login and seeding), navigation (navigateWithAuth),
                        antd-helpers, and per-module seed and data builders
  specs/<project>/      one folder per project
  unit/                 Node-only tests (project "unit")
  data/, fixtures/      datasets and upload fixtures
```

## Reports and artifacts

- `npx playwright show-report e2e-report` opens the HTML report.
- Screenshots are taken on failure and videos are kept on failure (`journey` records every
  test). Traces are recorded only on a retry, and local runs do not retry, so pass
  `--trace on` when you need one.
- `e2e-report/`, `test-results/`, `e2e/.auth/`, `e2e/reports/` and `e2e/videos/` are git-ignored.

## Known failures

As of 2026-10-12 these fail on a clean `dev`. Check this list before you blame your change, and
delete a row in the commit that fixes it.

| Spec | Cause |
|---|---|
| `po/po-workflow.spec.js:96` "Approve by a non-approver is refused by the engine (role guard)" | Stale assertion: a superuser now bypasses the approver check on purpose, so the request succeeds. |
| `master-data/process.spec.js`, the serial "UI Operations" block from `:126` | Stale: the screen now derives Type from the category and has no Cost/Allowance toggle. `:126` fails, so the serial tests after it never run. |
| `grn-qc` | Spec defects, for example `grn-qc-ui.spec.js:136` "Test 5: Create Accessories GRN via UI", where the sticky header intercepts the checkbox click. |
| `inventory/bill-passing.spec.js` list tests: `:79` "the list loads from the API and shows its KPI cards", `:127` "a bill is raised, saved, referred back and resubmitted" | Not diagnosed yet. |
| `master-data/item.spec.js:376` "Create: full cascade enablement, all fields, variant attribute" | Stale: the Active checkbox has been edit-only since 2026-09-11, and the spec still expects it on create. |
| `export-docs/buyer-templates.spec.js:74`, the font picker step | Flaky: the click can land while the option list re-renders. It passes on a re-run. |

Things that look like failures but come from the environment:

- The first run after starting vite times out the `setup` login: warm the dev server first.
- Two Playwright processes on one stack time out `setup` and report "N did not run".
- An API that has run for hours (after several full projects) slows down until costing
  scenarios and the `journey` pickers fail. Prove a regression on a freshly booted API.

## CI

- `.github/workflows/ci.yml` lints, builds and audits every push to `dev`. It runs no e2e tests.
- `.github/workflows/e2e.yml` is manual-only and does not work as written: it starts
  `npm run dev` on port 3000 and waits for `/api/v1/categories`, which needs a login, so the wait
  never succeeds. It is being replaced by a pipeline that runs the smoke tests on every push and
  the full suite nightly.
- `scripts/run-e2e.sh`, `run-e2e.ps1` and `run-e2e.bat` have the same two problems, and
  `scripts/run-regression.sh` expects the UI on port 3000. Use the steps above; the scripts go
  when the new pipeline lands.
