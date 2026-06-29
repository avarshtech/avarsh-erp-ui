# E2E Testing Guide — Garment ERP

Comprehensive Playwright E2E test suite that runs against H2 in-memory database. Zero external dependencies.

## Prerequisites

- **Java 21** — for the API server
- **Node 22 + npm** — for UI and Playwright
- **Both repos cloned side-by-side:**
  ```
  parent-folder/
  ├── avarsh-erp-ui/      ← this repo
  └── erp-purchase/        ← API repo
  ```
- **Playwright browsers:** `npx playwright install chromium`

---

## Quick Start — Local (Windows)

### Option A: Manual (3 terminals)

```powershell
# Terminal 1: Start API with H2
cd path\to\erp-purchase
$env:SPRING_PROFILES_ACTIVE="e2e"; $env:SERVER_PORT="8088"
.\gradlew bootRun

# Terminal 2: Start UI
cd path\to\avarsh-erp-ui
$env:VITE_API_BASE_URL="http://localhost:8088/api/v1"
npm run dev

# Terminal 3: Run tests
cd path\to\avarsh-erp-ui
npx playwright test                        # all modules
npx playwright test --project=costing      # specific module
npx playwright test --ui                   # visual UI mode
npx playwright test --headed               # see browser
```

### Option B: One-command (PowerShell)

```powershell
.\scripts\run-e2e.ps1                      # all modules
.\scripts\run-e2e.ps1 -Module costing      # specific module
.\scripts\run-e2e.ps1 -Headed              # see browser
```

### Option C: npm shortcuts

```bash
npm run test:e2e              # all modules
npm run test:e2e:master       # master data
npm run test:e2e:costing      # costing
npm run test:e2e:orders       # orders
npm run test:e2e:bom          # BOM
npm run test:e2e:po           # purchase orders
npm run test:e2e:admin        # users + roles + approval flows
npm run test:e2e:validation   # optimistic locking + ref integrity + RBAC
npm run test:e2e:ui           # Playwright visual UI
npm run test:e2e:headed       # headed browser
```

---

## Quick Start — Local (Mac/Linux)

```bash
./scripts/run-e2e.sh                  # all modules
./scripts/run-e2e.sh costing          # specific module
E2E_HEADED=true ./scripts/run-e2e.sh  # headed mode
```

---

## Module-Wise Execution

| Module | Command | Tests | Seed Data Used |
|--------|---------|-------|----------------|
| `master-data` | `--project=master-data` | 14 specs: CRUD for all master entities | UOMs, Categories, Buyers, Suppliers, etc. |
| `costing` | `--project=costing` | 2 specs: CRUD + workflow (Draft→Final→Approved) | Items, Buyers, Styles, Processes, Overheads |
| `orders` | `--project=orders` | 2 specs: CRUD + workflow (Draft→Submitted→Approved) | Buyers, Styles, PaymentTerms, SizePresets |
| `bom` | `--project=bom` | 2 specs: CRUD + workflow | Orders, Items, Parts, Processes |
| `po` | `--project=po` | 2 specs: CRUD + workflow (approval, reject, refer back) | Suppliers, Items, TermsConditions |
| `admin` | `--project=admin` | 3 specs: Users, Roles, Approval Flows | Roles, Users |
| `validation` | `--project=validation` | 3 specs: Optimistic locking, Referential integrity, RBAC | All seeded data |

---

## Viewing Reports

After test execution:

```bash
# Open HTML report
npx playwright show-report e2e-report

# Or browse directly
open e2e-report/index.html        # Mac
start e2e-report\index.html       # Windows
```

- **Screenshots**: Captured only on failure — in `e2e-report/`
- **Videos**: Retained only on failure — in `e2e-report/`
- **Traces**: Available on first retry — in `e2e-report/`

---

## How It Works

```
┌─────────────┐     ┌─────────────┐     ┌────────────┐
│  Playwright  │────>│  UI (Vite)  │────>│ API (H2)   │
│  Tests       │     │  :3000      │     │ :8088      │
└─────────────┘     └─────────────┘     └────────────┘
                                              │
                                        ┌─────┴─────┐
                                        │ H2 Memory │
                                        │ Database  │
                                        └───────────┘
```

1. **API starts** with `SPRING_PROFILES_ACTIVE=e2e` → H2 in-memory DB created
2. **Flyway runs** H2-compatible migrations (schema) + seed data (~200 records)
3. **UI starts** with `VITE_API_BASE_URL` pointing to API
4. **Playwright authenticates** as `superadmin` (seeded user)
5. **Tests execute** module by module
6. **Cleanup**: kill processes → H2 data gone (clean slate)

---

## Pipeline: GitHub Actions

The repo includes `.github/workflows/e2e.yml` — triggered manually with module selector.

```yaml
# Trigger from GitHub Actions UI:
# Actions → E2E Tests → Run workflow → select module
```

Features:
- On-demand execution with module dropdown
- Uploads HTML report as artifact (14-day retention)
- Can be triggered post-deploy via `repository_dispatch`

---

## Pipeline: Netlify

Netlify deploys the UI bundle. E2E tests run separately.

```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = "dist"
```

**Post-deploy E2E approach:**
1. Netlify build deploys `dist/` as static site
2. After deploy, trigger GitHub Actions via webhook:
   ```bash
   curl -X POST \
     -H "Accept: application/vnd.github.v3+json" \
     -H "Authorization: token $GITHUB_TOKEN" \
     https://api.github.com/repos/avarshtech/avarsh-erp-ui/dispatches \
     -d '{"event_type": "deploy-complete"}'
   ```
3. GitHub Actions runs E2E against the deployed Netlify URL

---

## Pipeline: GCS Static Bucket

```bash
# Build UI
npm run build

# Upload to GCS bucket
gsutil -m rsync -r dist/ gs://erp-ui-bucket/

# Run E2E tests against deployed URL
E2E_BASE_URL=https://app-e2e.avarshai.com npx playwright test
```

---

## Pipeline: Cloud Run (Full Stack)

```bash
# 1. Build API with e2e profile
docker build -t erp-api:e2e --build-arg SPRING_PROFILES_ACTIVE=e2e .

# 2. Deploy ephemeral API to Cloud Run
gcloud run deploy erp-api-e2e --image=erp-api:e2e --memory=1Gi --port=8088

# 3. Build UI pointing to Cloud Run API
VITE_API_BASE_URL=https://erp-api-e2e-xxx.run.app/api/v1 npm run build

# 4. Deploy UI (Cloud Run or GCS bucket)

# 5. Run Playwright
E2E_BASE_URL=https://erp-ui-e2e.run.app npx playwright test

# 6. Tear down
gcloud run services delete erp-api-e2e --quiet
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `E2E_BASE_URL` | `http://localhost:3000` | UI URL for Playwright |
| `E2E_API_URL` | `http://localhost:8088/api/v1` | API URL for direct API tests |
| `E2E_USERNAME` | `superadmin` | Login username |
| `E2E_PASSWORD` | `admin123` | Login password |
| `E2E_HEADED` | _(unset)_ | Set to `true` for visible browser |
| `SPRING_PROFILES_ACTIVE` | `e2e` | API profile (H2 database) |
| `SERVER_PORT` | `8088` | API port |
| `VITE_API_BASE_URL` | `http://localhost:8088/api/v1` | API URL for UI |
| `API_REPO_PATH` | `../erp-purchase` | API repo path (for scripts) |

---

## Test Architecture

```
e2e/
├── global-setup.js              # Auth setup (login + save state)
├── helpers/
│   ├── api-client.js            # Authenticated API wrapper
│   ├── antd-helpers.js          # Ant Design component interactions
│   ├── navigation.js            # Auth-aware navigation
│   └── test-data.js             # Test payload factories
├── specs/
│   ├── master-data/             # 14 specs: buyer, supplier, category, etc.
│   ├── costing/                 # 2 specs: CRUD + workflow
│   ├── orders/                  # 2 specs: CRUD + workflow
│   ├── bom/                     # 2 specs: CRUD + workflow
│   ├── po/                      # 2 specs: CRUD + workflow
│   ├── admin/                   # 3 specs: users, roles, approval flows
│   └── validation/              # 3 specs: locking, integrity, RBAC
├── costing.spec.js              # Legacy (existing tests)
└── costing-full-entry.spec.js   # Legacy (existing tests)
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| API won't start | Check Java 21: `java -version`. Check port 8088 not in use: `netstat -an \| grep 8088` |
| Auth fails in tests | Ensure seed data loaded — check API startup logs for Flyway migration success |
| Tests timeout | Increase `timeout` in `playwright.config.js` (default: 60s) |
| H2 schema errors | Compare H2 migration against latest PostgreSQL migration for missing columns |
| Windows path issues | Use forward slashes in scripts, or use the PowerShell script |
| Ant Design dropdown not found | Increase wait timeout in `antd-helpers.js` |
| Session expired mid-test | The `navigateWithAuth` helper auto-re-authenticates |
| Port already in use | Kill existing process: `npx kill-port 8088 3000` |

---

## Seed Data Summary

The H2 database is seeded with ~200+ records on startup:

| Category | Records | Examples |
|----------|---------|----------|
| Roles | 2 | Super Admin, Admin |
| Users | 1 | superadmin (admin123) |
| UOMs | 20 | Meters, Kilograms, Pieces, Yards, etc. |
| Categories | 7 | Fabric, Trims, Accessories, Packaging, etc. |
| SubCategories | ~47 | Woven, Knit, Buttons, Zippers, etc. |
| ItemTypes | ~15 | Poplin, Single Jersey, Polyester Button, etc. |
| Processes | 30+ | Cutting, Sewing, Washing, Embroidery, etc. |
| Parts | 28 | Front Panel, Back Panel, Sleeve, Collar, etc. |
| Overheads | 20+ | Testing, Freight, Insurance, Sampling, etc. |
| PaymentTerms | 15 | LC at Sight, TT Advance, Open Account, etc. |
| SizePresets | 19 | Alpha S-XL, Numeric 28-38, EU 36-46, etc. |
| Buyers | 5 | H&M, Zara, Next, Primark, Target |
| Suppliers | 5 | Arvind, Vardhman, Shahi, Gokaldas, Premier |
| Styles | 5 | AV-SS26-001 (Polo), AV-AW25-001 (Hoodie), etc. |
| Items | 20+ | Cotton SJ 180 GSM, YKK Zipper, Sewing Thread, etc. |
| Cost Sheets | 3 | Draft, Final, Approved |
| Orders | 3 | Draft, Submitted, Approved |
| BOMs | 2 | Linked to approved orders |
| Purchase Orders | 3 | Draft, Submitted, Approved |
| Approval Flows | 2 | PO approval, Costing approval |
