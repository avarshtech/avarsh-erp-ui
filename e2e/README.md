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
- Always name the project. Without `--project`, Playwright runs all of them, which is the
  nightly CI run (well over an hour here).
- The headed `full-flow` demo and the `rbac-soak` projects live in `playwright.demo.config.js`:
  `npx playwright test -c playwright.demo.config.js --project=full-flow`.
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

All the E2E_* defaults live in `e2e/config/env.js`. Loading it refuses an `E2E_BASE_URL` or
`E2E_API_URL` that is not on this machine, and the setup project and `authedPage` stop a UI that
sends its API calls to another machine (a plain `npm run dev`), so a run cannot touch real data.

| Variable | Default | Used by |
|---|---|---|
| `E2E_BASE_URL` | `http://localhost:3000` | `playwright.config.js` (`baseURL`). Always set it. |
| `E2E_API_URL` | `http://localhost:8088/api/v1` | `helpers/api-client.js` and the fixtures: API logins, seeding and the API-level specs |
| `E2E_USERNAME` | `superadmin` | `global-setup.js`, `helpers/navigation.js`, `helpers/api-client.js`, `fixtures.js` |
| `E2E_PASSWORD` | `admin123` (the e2e seed) | the same files |
| `E2E_ALLOW_REMOTE` | unset | `1` lets a run reach a server that is not this machine. Only on purpose. |
| `CI` | unset | set by GitHub: headless, one retry with a trace, no `test.only`, junit and GitHub reporters |
| `E2E_HEADED` | unset | `playwright.config.js`: a visible browser when set |
| `SWEEP_SECTIONS` | unset, meaning all | `specs/smoke/route-sweep.spec.js`: comma-separated `SECTIONS` keys to sweep |
| `E2E_LIVE_AI` | unset | `specs/costing/costing-ai-live.spec.js` runs only when it is set, and calls the real AI model |
| `SERVER_PORT` | `8088` | the API's e2e profile |
| `VITE_API_BASE_URL` | from `.env.e2e` | the API the dev server talks to |

## Projects

On 2026-10-13, `npx playwright test --list` counted 919 tests in 126 files in
`playwright.config.js`, and 7 in 3 files in `playwright.demo.config.js`.

| Project | Specs | Notes |
|---|---|---|
| `setup` | `global-setup.js` | Logs in once and saves `e2e/.auth/user.json`. Every module project depends on it. |
| `smoke` | `specs/smoke/` | What CI runs on every push: the route sweep (every parameter-free route in `SCREENS` loads with no page error, console error or warning), the fixtures' own checks, and each core module's records in the API and on its list. Signs in per test, so it needs no `setup`. On the dev server the sweep also catches React and antd warnings, which production builds strip. |
| `legacy` | `e2e/costing.spec.js`, `e2e/costing-full-entry.spec.js` | The original costing specs. |
| `master-data`, `costing`, `orders`, `bom`, `po`, `production-po`, `cutting`, `sewing`, `virtual-factory`, `tna`, `sample-requests`, `hr`, `admin`, `approvals`, `inventory`, `reports`, `validation`, `grn-qc`, `export-docs` | `specs/<project>/` | One folder per module. Where the files are numbered, they run in order and build on each other. |
| `production-flow` | `specs/production-flow/` | One fresh order from costing to packing. The upstream chain (costing → order → BOM → supplier PO → GRN → QC → stock) is built through the API; then every production stage runs on its screen: the floor masters, the Cutting PO and fabric issue, the Work Order, the cutting room (receipt, relaxation, marker plan and size-set, lay audit, TMB, cutting report, bundling, issue to sewing, re-cut, reconciliation), the sewing floor (plan, cut-parts receipt, trim card, hourly sheet, measurement, end-line check, replacements, garment issue), finishing on the API (Finishing PO, receiving, garment process out and back, garment check) and packing. Numbered: each file finds the order the earlier ones built (`helpers/production-flow-seed.js`). Signs in per test, so it needs no `setup`; about 6 minutes. |
| `journey` | `specs/journey/` | Creates every record through the real screens (masters, costing, BOM, order, PO, GRN). Numbered and idempotent; 15-minute test timeout; video on. |
| `branch` | `specs/branch/` | Makes the company multi-branch, and `99-restore-single-branch` closes the branches again. Declared last: run nothing after it until the restore has run. |
| `rbac-soak-setup`, `rbac-soak-merch`, `rbac-soak-store`, `rbac-soak-costing` (demo config) | `rbac-soak-setup.js`, `specs/rbac-soak/` | Non-admin roles that exist only in the e2e seed, with their own setup. |
| `full-flow` (demo config) | `specs/full-flow.spec.js` | A headed, slowed-down demo of costing, order, BOM and PO, with its own login. |

Tests tagged `@dev-server` (three export-docs files) import `/src` modules in the browser, which
only the dev server serves; CI runs them in its dev-server lane.

## Fixtures

New specs import `test` and `expect` from `e2e/fixtures.js`:

```js
import { test, expect } from '../../fixtures.js';

test('the list shows the seed', async ({ api, authedPage, consoleGuard }) => {
  const { data } = await api.get('/orders/search', { page: 0, size: 5 });
  await authedPage.goto('/orders/list');
});
```

- `api`: an API client logged in once per worker.
- `authedPage`: the page, signed in through the API for this test alone. The API rotates the
  refresh token on every use and revokes a reused one, so a login saved once and shared by many
  tests goes stale; this cannot. It needs no `setup` project or storage state.
- `consoleGuard`: fails the test on a page error or console error;
  `test.use({ consoleGuardLevels: ['error', 'warning'] })` adds warnings. Requesting it is
  enough. `helpers/console-noise.js` lists what it ignores.

## Layout

```
e2e/
  config/env.js         URLs, login, and the guard that keeps a run on this machine
  fixtures.js           api, authedPage, consoleGuard
  global-setup.js       login once, save the storage state (project "setup")
  rbac-soak-setup.js    logins for the rbac-soak projects
  costing*.spec.js      the legacy costing specs
  helpers/              api-client (API login and seeding), navigation (navigateWithAuth),
                        antd-helpers, and per-module seed and data builders
  specs/<project>/      one folder per project
  data/, fixtures/      datasets and upload fixtures
```

## Reports and artifacts

- `npx playwright show-report e2e-report` opens the HTML report.
- Screenshots are taken on failure and videos are kept on failure (`journey` records every
  test). Traces are recorded only on a retry, and local runs do not retry, so pass
  `--trace on` when you need one.
- `e2e-report/`, `test-results/`, `e2e/.auth/`, `e2e/reports/` and `e2e/videos/` are git-ignored.

## Known failures

As of 2026-10-19 these fail on a clean `dev`. Check this list before you blame your change, and
delete a row in the commit that fixes it.

| Spec | Cause |
|---|---|
| `journey` from `00-contract-smoke.spec.js:105` on | The journey's dataset (`data/garment-dataset.js`, the fixture in `00`) reuses names the e2e seed now owns under its own taxonomy: the seed has "Single Jersey" under "Knit", the journey wants it under "Knits". `ensureMasterRecord` checks by name only, so it skips the item type, and the fabric item cannot be created; every later step follows. Needs the dataset moved onto names of its own. |
| `export-docs/buyer-templates.spec.js:74`, the font picker step | Flaky: the click can land while the option list re-renders. It passes on a re-run. |

Things that look like failures but come from the environment:

- The first run after starting vite times out the `setup` login: warm the dev server first.
- Two Playwright processes on one stack time out `setup` and report "N did not run".
- **A run longer than about two hours loses its login.** `setup` writes `e2e/.auth/user.json`
  once and the session idles out after 120 minutes, so every spec that uses the saved state
  lands on the login page after that (specs on the `authedPage` fixture are not affected). The
  full suite takes longer than that on a laptop: run it in batches of projects that each finish
  in under ~90 minutes, since each command runs `setup` again.
- An API that has run for hours (after several full projects) slows down until costing
  scenarios and the `journey` pickers fail. Prove a regression on a freshly booted API.
- Re-running a project on the same database is not always idempotent:
  `production-po/02-work-order.spec.js:68` needs ORD/0003 to have no Garment Washing PO yet,
  which holds only on the run after a boot.

## CI

- `.github/workflows/ci.yml` lints, builds and audits every push to `dev`. It runs no e2e tests.
- `.github/workflows/e2e.yml` builds the API jar from `avarshtech/erp-purchase@master`, runs it
  with the e2e profile on 8088, waits on `/actuator/health/readiness`, builds this UI with
  `--mode e2e` and serves it with `vite preview` on 4173 (the e2e build registers no service
  worker). Then:
  - every push to `dev`: `--project=smoke`;
  - nightly (02:00 IST, checking out `dev`) and `workflow_dispatch` with `suite: full`: the full
    suite on the preview build (`--grep-invert @dev-server`), and in a parallel job the smoke
    project and the `@dev-server` specs on `vite --mode e2e`.
  The report, `test-results/junit.xml`, traces and both servers' logs are uploaded as artifacts.
  It needs the repository secret `REPO_TOKEN` (read access to erp-purchase).
