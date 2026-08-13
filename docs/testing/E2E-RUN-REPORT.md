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

## Session 1 — Masters (complete)

**Goal:** populate all 17 master screens with the canonical garment dataset, driven
entirely through the real UI.

### Result

| Check | Result |
|-------|--------|
| `npm run build` | Pass |
| ESLint on all touched files | Clean |
| Deprecated AntD prop scan | Clean |
| `01-masters.spec.js` — all 21 tests | **Pass** |
| Idempotent re-run | Pass — every test reports `0 created, N already present` |

### Data seeded (verified via API)

| Entity | Count | Entity | Count |
|--------|-------|--------|-------|
| Categories | 4 | Payment Terms | 2 |
| Sub-Categories | 10 | Terms & Conditions | 2 |
| Item Types | 19 | Overheads | 3 |
| Attributes | 7 | Processes | 8 |
| UOMs | 7 | Parts | 6 |
| **Items** | **19** | Defect Types | 5 |
| **Item Variants** | **31** | Trims QC Criteria | 4 |
| Buyers | 2 | Suppliers | 3 |
| Styles | 3 | Size Presets | 2 |

10 of the 19 items carry a UOM conversion factor (fabric KG→MTR, buttons GRS→PCS,
thread CON→MTR) — the input for the BOM purchase-quantity conversion in Session 3.

Sample of the generated variant SKUs:

```
KNI-SIN-001 | Fabric / Knits / Single Jersey | factor: 3.2
   KNI-SIN-001-NAVY-180 | Single Jersey 180 GSM Navy Blue
KNI-PIQ-001 | Fabric / Knits / Pique        | factor: 2.8
   KNI-PIQ-001-ROYA-220-66 | Pique 220 GSM Royal Blue
```

Costing can now resolve its process lists, which was impossible before B-017:

```
/processes/active?category=Manufacturing -> Cutting, Sewing, Finishing, Ironing, Packing
/processes/active?category=Overheads     -> Factory, Administrative, Financial
```

### Bugs

1 critical product bug (**B-017** — Process Master's category dropdown made cost-sheet
processes uncreatable), 3 harness bugs (B-018…B-020), and 4 form requirements
discovered. See [E2E-BUG-LOG.md](./E2E-BUG-LOG.md).

### Known deviation

The dataset defines 32 variants but 31 exist: `Single Jersey` was created by the
Session 0 smoke spec with 2 of its 3 variants, and the idempotent skip-if-exists rule
works at item level, so the third (`Single Jersey 160 GSM Black`) was never added.
Harmless for the downstream flow — noted for accuracy.

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
