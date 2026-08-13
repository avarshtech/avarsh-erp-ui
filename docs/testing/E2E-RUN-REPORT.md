# E2E Run Report

UI-driven journey suite: `npm run test:e2e:journey`
Environment: frontend `http://localhost:3000`, backend `http://localhost:8088/api/v1`, user `superadmin`.

---

## Session 0 — UI contract alignment + harness (complete)

**Goal:** make the frontend speak the refactored Item Master API, and stand up a
UI-only journey harness. Started from an empty database.

### Result

| Check | Result |
|-------|--------|
| `npm run build` | Pass |
| ESLint on all touched files | No new issues (matches pre-change baseline exactly) |
| Deprecated AntD prop scan | Clean |
| `00-contract-smoke.spec.js` | **6/6 pass** (1.8 min) |
| Idempotent re-run | Pass — second run reports every record as `skipped`, creates nothing |

### Verified against the live API

The smoke test drives only real screens. After the run, `GET /items/search` returns:

```
ITEM: KNI-SIN-001 | Fabric / Knits / Single Jersey
  uom: KG -> secondary: MTR | conversionFactor: 3.2
  hsn: 60062200 | allowance: 3 | desc: 100% Combed Cotton Single Jersey
  VARIANT: KNI-SIN-001-NAVY-180 | Single Jersey 180 GSM Navy Blue | {"gsm":"180","color":"Navy Blue"}
  VARIANT: KNI-SIN-001-WHIT-180 | Single Jersey 180 GSM White  | {"gsm":"180","color":"White"}
```

Every element of the new contract round-trips: derived item name, auto item code,
UOM conversion factor, per-variant names, and server-generated variant SKUs.
`GET /variants/search?category=Fabric` returns both variants with the parent item's
description and UOM — the data the costing picker now consumes.

### Data created

Categories 1 · Sub-categories 1 · Item types 1 · Attributes 2 · UOMs 2 · Items 1 (2 variants).
This is the minimal chain for the smoke test; the full dataset lands in Session 1.

### Bugs

8 contract bugs (B-001…B-008) and 5 AntD 6 harness bugs (B-009…B-013) found and
fixed; 3 follow-ups logged (B-014…B-016). See [E2E-BUG-LOG.md](./E2E-BUG-LOG.md).

Two were outright blockers — before this session **no item could be created from the
UI at all**, and **no fabric item could be created by any means**.

---

## Session 1 — Masters

_Not started._ Seeds the full canonical dataset from `e2e/data/garment-dataset.js`
across all 17 master screens.

## Session 2 — Costing

_Not started._

## Session 3 — BOM

_Not started._

## Session 4 — Orders

_Not started._

## Session 5 — Purchase Orders

_Not started._

## Session 6 — GRN

_Not started._
