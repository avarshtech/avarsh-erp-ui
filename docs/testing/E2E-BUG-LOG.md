# E2E Bug Log

Bugs found while running the UI-driven journey suite (`npm run test:e2e:journey`), logged live per session.

**Severity:** Critical = blocks the flow entirely · Major = wrong data or missing feature · Minor = cosmetic / DX

---

## Session 0 — UI ↔ API contract alignment

Found by analysis before any test run. The backend `Item Master Refactor` (`erp-purchase` `9c160bd`) was deployed to :8088 but the frontend was never updated — `grep -rn "variantName|variantCode|uomConversionFactor" src/` returned zero hits.

| ID | Module | Severity | Symptom | Root cause | Fix | Status |
|----|--------|----------|---------|------------|-----|--------|
| B-001 | Item Master | Critical | Every item create/update fails with `Variant name is required`. No item can be created from the UI at all. | `ItemService.saveOrUpdateVariantsFromDTO` now requires a per-variant `variantName` (non-blank, ≥ 5 chars, unique within the item). The UI sent `{ itemName, attributes, isActive }` with no `variantName`. | Added a required **Variant Name** input to the variant panel with client-side validation mirroring the server rules; variant payload now sends `variantName`. `src/pages/master/ItemMaster.jsx` | Fixed |
| B-002 | Item Master | Critical | Fabric items cannot be created — server rejects with `UOM conversion factor is required when the Secondary UOM differs from the Primary UOM`. Fabric forces a secondary UOM, so 100% of fabric items failed. | `ItemService.resolveConversionFactor` requires `uomConversionFactor` whenever secondary UOM ≠ primary. The UI never sent the field and had no input for it. | Added a conditional `uomConversionFactor` InputNumber labelled `1 {primary} = ? {secondary}`, shown and required only when a conversion applies. `src/pages/master/ItemMaster.jsx` | Fixed |
| B-003 | Item Master | Major | "Item Name" was a required, user-editable field, but `mst_items.item_name` no longer exists. Names typed by users were silently discarded, and a second item on the same Category+Sub-Category+Item Type failed with a confusing duplicate error. | Item identity is now derived server-side as `Category / Sub-Category / Item Type`, and duplicates are blocked on that triple rather than on the name. | Replaced the input with a read-only derived preview; removed `itemName` from the payload. Picking an occupied classifier triple now loads the existing item for editing instead of failing on save. `src/pages/master/ItemMaster.jsx` | Fixed |
| B-004 | Item Master | Major | Server-generated variant SKUs (`FAB-KNI-001-NAVY-180`) were invisible in the UI even though costing, BOM, PO, GRN and QC all key on them. | `ItemVariant.variantCode` was added server-side with no UI surface. | Variant code now renders read-only beside the variant name, on the variant tab, and in the item view drawer. `src/pages/master/ItemMaster.jsx` | Fixed |
| B-005 | Costing | Major | Saved cost sheets came back with **blank** fabric and trim names. | `CostSheetService` now reads `fabricType` / `item` from the selected **variant**, but `CostingForm` only ever set `itemId`, leaving `variantId` null. | Fabric / local trim / imported trim pickers now search variants via `GET /variants/search` and set `variantId`. New `src/services/master/variantService.js`; `src/pages/costing/CostingForm.jsx` | Fixed |
| B-006 | BOM → PO | Major | POs were raised in the consumption UOM instead of the purchase UOM — e.g. a button line ordered "1440 PCS" rather than "10 GRS". | `BomLine.purchaseUom` / `uomConversionFactor` / `purchaseQtyPrimary` were added server-side but the UI never populated them, so PO generation fell back to `purchaseQty`. | BOM snapshots the item's conversion factor at save time and computes `purchaseQtyPrimary`; PO now sources qty from `purchaseQtyPrimary ?? purchaseQty` and UOM from `purchaseUom`. `src/pages/bom/BOMForm.jsx`, `src/pages/bom/BOMView.jsx`, `src/pages/po/POForm.jsx` | Fixed |
| B-007 | PO / GRN | Minor | PO and GRN lines showed raw attribute tags (`Color:Navy`) with no variant name or SKU, so users could not tell which variant a line referred to. | `variantName` / `variantCode` were added to `PoLineItemDTO` and `GRNLineItemDTO` but never rendered. | Added variant name + code to the PO line table, PO view, the GRN PO-line picker, and both GRN line tables. `src/pages/po/POForm.jsx`, `src/pages/po/POView.jsx`, `src/pages/inventory/grn/*`, `src/services/inventory/inventoryService.js` | Fixed |
| B-008 | E2E harness | Minor | Every spec would have failed at login — the suite defaulted to password `admin123` while the actual superadmin password is `admin98`. | Stale default in the E2E helpers. | Updated the superadmin default across `e2e/global-setup.js`, `e2e/helpers/navigation.js`, `e2e/helpers/api-client.js` and the legacy specs. The separate `e2e-viewer` RBAC fixture is unchanged. | Fixed |

### Test-harness findings (AntD 6 upgrade fallout)

Discovered while getting the journey suite green. These break **any** existing spec
written against Ant Design 5 selectors — the legacy suites in `e2e/specs/*` will hit
the same walls when they are next run.

| ID | Severity | Symptom | Root cause | Fix |
|----|----------|---------|------------|-----|
| B-009 | Major | `getByRole('button', { name: /^Add/ })` matches nothing on every master screen. | AntD renders icons as `<span role="img" aria-label="plus">`, so the button's accessible name is `"plus Add UOM"` — an anchored `^Add` never matches. | Match buttons by **visible text** (`locator('button').filter({ hasText })`), not by role name. |
| B-010 | Major | Every `Select` interaction times out. | AntD 6.2.2 renamed the Select internals: `.ant-select-selector` → `.ant-select-content`, `.ant-select-selection-item` → `.ant-select-content-value`. | Click the stable `.ant-select` wrapper. Dropdown classes (`.ant-select-dropdown`, `.ant-select-item-option`) are unchanged. |
| B-011 | Major | `.ant-modal-content` never appears, so modal-scoped specs fail. | AntD 6 dropped the class. `.ant-modal` and `[role="dialog"]` still exist. | Added a `dialog(page)` helper. |
| B-012 | Minor | `getByPlaceholder('Select data type')` finds nothing. | An AntD `Select` renders its placeholder inside a div, not as an `input[placeholder]`. | Locate Selects by their **form label** instead. |
| B-013 | Minor | A bad selector burned the full 8-minute test timeout before reporting. | No per-action timeout on the journey project. | Set `actionTimeout: 15000`; failures now surface in ~20s. |

### Known follow-ups (not blocking)

| ID | Module | Severity | Note |
|----|--------|----------|------|
| B-014 | Item Master | Minor | `ItemSpecification` now matches **only** variant code/name. Searching the item list by category or item-type name silently returns nothing. Item code still matches because the variant code embeds it. Worth widening server-side if users complain. |
| B-015 | Costing | Minor | Techpack import matches at item level (`matchedItemId`); costing rows need a variant. The UI defaults to the item's first variant and lets the user refine it. A variant-aware matcher server-side would be better. |
| B-016 | Masters | Minor | UOM labelling is inconsistent between screens: **Item Types** lists UOMs by `name` ("Kilogram"), **Item Master** lists them by `symbol` ("KG"). Confusing for users; specs work around it with `UOM_NAME_BY_SYMBOL`. |

---

## Session 1 — Masters

| ID | Module | Severity | Symptom | Root cause | Fix | Status |
|----|--------|----------|---------|------------|-----|--------|
| B-017 | Process Master | **Critical** | A process created through the UI can never appear in a cost sheet. The Manufacturing and Overhead sections of every cost sheet stay permanently empty. | [ProcessMaster.jsx](../../src/pages/master/ProcessMaster.jsx) sourced its Category dropdown from the **item** categories in StoreContext (Fabric, Local Trims, …), but [CostingForm.jsx:318-319](../../src/pages/costing/CostingForm.jsx#L318-L319) queries `getActiveProcesses('Manufacturing')` and `getActiveProcesses('Overheads')`. The two lists had no values in common. BOM is unaffected — it loads processes unfiltered. | Replaced the dynamic list with the fixed `CATEGORY_OPTIONS` the cost sheet actually queries. | Fixed |
| B-018 | E2E harness | Major | Selecting any option beyond roughly the 8th in an AntD `Select` times out — e.g. sub-category "Interlining" (9th of 10) was unreachable even though the record existed. | AntD renders options in an `rc-virtual-list` capped at `max-height: 256px`; options below the fold are not in the DOM at all. | `chooseOption()` in [ui-master.js](../../e2e/helpers/ui-master.js) now filters by typing when the Select is searchable, and otherwise scrolls the virtual list until the option renders. | Fixed |
| B-019 | E2E harness | Major | Re-running the masters spec tried to re-create items that already existed, so the suite was not idempotent. | Two causes stacked: (a) the exists-check searched the **derived** item name, which `ItemSpecification` can never match (B-014); (b) the Items list filters server-side, so sampling the table 400 ms after typing raced the response. | Item exists-check now searches the first **variant** name and waits for the row (6 s) instead of sampling immediately. | Fixed |
| B-020 | E2E harness | Minor | A full 25-test run intermittently dies with "Target page, context or browser has been closed" around the 14-minute mark. | Chromium session exhaustion over a very long single-worker run; not reproducible when the same tests run in a shorter batch. | Not fixed — reruns cleanly. Watch it; if it recurs, split the journey run per module. | Open |

### Requirements discovered while seeding (not bugs)

- **Buyer** needs at least one shipping location, captured in a nested modal (Location Label, Address, Country, Postal Code, City, State/Province).
- **Supplier** requires a 10-digit phone with no country code, plus Pincode, PAN and GSTIN.
- **Terms & Conditions** content is a Quill rich-text editor, not an `Input` — it needs click-and-type, not `fill()`.
- **Size Presets** renders a "Clear All" button inside its `Sizes` label, so the label's text is `SizesClear All`.

## Session 2 — Costing

_Pending._

## Session 3 — BOM

_Pending._

## Session 4 — Orders

_Pending._

## Session 5 — Purchase Orders

_Pending._

## Session 6 — GRN

_Pending._
