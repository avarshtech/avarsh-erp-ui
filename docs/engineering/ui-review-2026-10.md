# UI code review register — October 2026

Workstream WS1 of the UI production-readiness programme (Tier 1, Phase 1, lane D). This file is
rendered from `ui-review-2026-10.json`, which holds the same records; edit the JSON and re-render
rather than editing this file by hand.

## Scope and method

- **Batch 1 (this revision):** orders, BOM, costing and purchase orders: every screen under
  `src/pages/{orders,bom,costing,po}`, their services under `src/services/`, the module utilities
  they import (calculators, constants, print generators) and the shared hooks and components they
  lean on, where a defect shows on these screens. Code reviewed at `dev` 4672795 (2026-10-12).
- **Batch 2:** inventory, production and master data: `src/pages/{inventory,production,master}`,
  their services and the API behind them. The browser-only Preview screens in these folders
  (production finishing, production job work, job-work bill passing — all browser demo data with a
  Preview tag) wait for the Preview batch. Batch 2 ids start at
  U208; batch 1 ids are unchanged.
- **Batch 3:** admin (users, roles, approval flows, company profile, admin dashboard, My
  Approvals), sample request (all seven stages), HR and reports (report list, designer, run screen,
  saved reports and the AI chat): `src/pages/{admin,approvals,sample-request,hr,reports}`, their
  services and the API behind them (`erp/{iam,approval,sampling,hr,reporting,ai}`). Batch 3 ids
  start at U305; it also adds one PO finding raised by lane B.
- **Batch 4:** this batch was reviewed on the phase1 integration branch (3ceb9a2), not on `dev`, because phase1 has rewritten much of the shared code. It covers two areas:
  - **The shared code as a whole:** `src/{components,hooks,context,layout,observability}`, `src/services/core`, the generic utils, `App.jsx`, `main.jsx`, `sw.js`, the login page and the dashboard. These findings are in the Shared section.
  - **The Preview modules:** production finishing, production job work and job-work bill passing. These are in their own section. Each finding says which screens run on browser demo data and which on the API.
  
  Batch 4 ids start at U372. Three reviewers covered the batch: platform, components and Preview.
- **Not yet reviewed by any batch:** Export Docs (`src/pages/expdoc` and the `expDoc*` utils), T&A, Virtual Factory, and the module-master loader hooks.
- **Method:** nine reviewers, one per slice (orders; BOM; cut panel and garment process
  requirements; costing list and view; costing sheet; supplier PO form; supplier PO view and list;
  production POs; job-work POs), read every line of their slice against Appendix A of the plan and
  the erp-dev review dimensions, and read the API (`erp-purchase`) wherever a finding depends on what
  the server does. An independent verifier per slice then re-read each finding end to end and could
  confirm, correct, re-grade or refute it; a few defects the verifiers spotted on the way were
  checked by the lead before being added. The mechanical sweep items (catch-block toasts, locale,
  memoised columns) were checked by the lead with scripted greps. The lead re-checked every P0 and
  P1 against the code. Anything that could not be confirmed was dropped. To stay within the
  account's usage limit, batch 2's reviewers confirmed each finding themselves by re-reading the
  code path before reporting it (no separate verifier pass); the lead re-checked every P0 and P1
  and spot-checked the P2s. Batch 3 used the same method with three reviewers (HR; admin, approvals
  and reports; sample request).
- **Severity:** P0 = crash, data loss or a security hole. P1 = wrong data, a blocked workflow, or a
  visible bug users hit. P2 = degraded UX, or a maintainability risk with a real consequence.
  P3 = cleanup.
- **Rules** are the Appendix A numbers (the future `docs/engineering/ui-standards.md`).
- **Fixes** follow the owner's UX-parity rule: nothing changes except the defect itself. Each fix
  says whether it is visible to users.
- **Estimates** are developer hours with Claude Code, including the targeted check (lint on the
  changed files, the module's spec). Triage per the plan: P0/P1 are fixed in Tier 1 Phase 2; P2/P3
  feed the other workstreams.
- **Aggregated findings:** sweeps that other workstreams already own (duplicate catch-block toasts
  for WS7, bare `toLocaleString()` for WS2a, un-memoised `columns` for WS6) are recorded once per
  file, with the line numbers, so this register stays usable.

## Summary

Open findings by module and severity, with the estimate in developer hours. The last column counts the findings the test-release gate already fixed (listed at the end, not re-reported). Ids are stable: new batches append from the next free id, so ids are not contiguous within a module.

| Module | P0 | P1 | P2 | P3 | Open | Estimate (h) | Fixed by the gate |
|---|---:|---:|---:|---:|---:|---:|---:|
| Orders | 1 | 5 | 11 | 10 | 27 | 20.4 | 0 |
| BOM (bill of materials, cut panel and garment process requirements) | 1 | 9 | 18 | 20 | 48 | 47.6 | 2 |
| Costing | 2 | 7 | 20 | 16 | 45 | 57 | 0 |
| Purchase orders (supplier, production and job-work POs) | 0 | 14 | 45 | 25 | 84 | 111.4 | 2 |
| Inventory (GRN, QC, bill passing, issues, transfers, stock) | 0 | 10 | 20 | 11 | 41 | 84 | 0 |
| Production (cutting, sewing, packing, production masters) | 0 | 8 | 14 | 7 | 29 | 70.8 | 0 |
| Master data | 0 | 5 | 11 | 5 | 21 | 34.3 | 0 |
| Admin (users, roles, approval flows, company profile, approvals inbox) | 0 | 2 | 8 | 3 | 13 | 12.8 | 0 |
| Sample requests | 1 | 5 | 10 | 5 | 21 | 28.5 | 0 |
| HR and payroll | 0 | 4 | 12 | 4 | 20 | 35.5 | 0 |
| Reports (report builder, saved reports, AI chat) | 1 | 4 | 4 | 3 | 12 | 15.5 | 0 |
| Shared code (components, hooks, context, layout, core services, generic utils) | 0 | 5 | 13 | 12 | 30 | 32.8 | 1 |
| Preview modules (production finishing, production job work, job-work bill passing) | 0 | 2 | 9 | 6 | 17 | 38 | 0 |
| **Total** | **6** | **80** | **195** | **127** | **408** | **588.3** | **5** |

P0 and P1 together: 86 findings, about 185 h. Every one was re-checked by the lead against the code on `dev`.

## Orders

### P0

#### U001 · P0 · rule 4 — A deep-link Approve/Reject stays armed and auto-actions the next pending order the user opens

*OrderList, OrderView* — `src/pages/orders/OrderList.jsx:65, 153-162, 398-402; src/pages/orders/OrderView.jsx:157-164`

- **What happens:** An approver taps Approve on the notification for order 1010 (refer-back requested); the app opens /orders/list?viewId=1010&action=approve and approves it. pendingAction is never cleared on that path (handleStatusActionComplete and handleView leave it; only the dialog's cancel clears it), so when the approver next opens order 1012 (cancel requested) just to read it, OrderView's effect cancels 1012 at once with no Popconfirm. CANCELLED is terminal. A failed deep-link fetch and any action taken while armed also leave it armed.
- **Fix:** Consume the action once: clear it in handleStatusActionComplete, handleView and the fetch's catch, bind it to the deep-linked id, and only open the confirm when orderData.id matches. *(not visible)*
- **Estimate:** 1 h

### P1

#### U002 · P1 · correctness — Every edit or resubmit re-dates the order to today

*OrderForm* — `src/pages/orders/OrderForm.jsx:1575, 1585, 1607-1611, 2026-2031; erp/order/service/OrderService.java:174`

- **What happens:** buildOrderData always sends orderDate = dayjs(), for updates too, and the server overwrites the stored date. An order confirmed on 02-Oct, referred back and resubmitted on 12-Oct becomes dated 12-Oct in the list, view, date filters and printed confirmation, and every line's lead time shrinks by 10 days. The edit form also shows today's date for every order.
- **Fix:** In edit mode send and display existingOrder.orderDate and compute lead times from it; optionally have the API ignore orderDate on update. *(visible: the edit form shows the order's real date)*
- **Estimate:** 1 h

#### U003 · P1 · correctness — Saved orders show letter sizes in database key order (L, M, S, XL, XS, XXL), including on the printed confirmation

*OrderForm, OrderView, order print* — `src/pages/orders/OrderForm.jsx:1008; src/pages/orders/OrderView.jsx:315; src/utils/orderPdfGenerator.js:60; erp/order/domain/OrderLine.java:50-53 (db/migration/V6__order.sql:41 size_prices jsonb)`

- **What happens:** Size columns are taken from Object.keys(sizePrices), a map stored in a PostgreSQL jsonb column, which returns keys shortest-first. An order entered XS, S, M, L, XL, XXL reads L, M, S, XL, XS, XXL in the edit form, the view and the confirmation sent to the buyer. The e2e H2 twin uses json, which keeps order, so tests cannot see it.
- **Fix:** Order each line's sizes by its sizePresetId preset with unknown sizes appended (the helper resolveOrderSizes in src/utils/orderSizes.js already does this for packing), in all three readers. *(visible: size columns appear in preset order)*
- **Estimate:** 2.5 h

#### U004 · P1 · rule 5 — Edit opens the list's row snapshot from history state, so Back/F5 show stale data and the conflict dialog's Reload loops

*OrderForm* — `src/pages/orders/OrderForm.jsx:1046-1052; src/pages/orders/OrderList.jsx:289; src/pages/orders/OrderView.jsx:502; src/components/ConflictDialog.jsx:36`

- **What happens:** Edit uses location.state.orderData whenever its id matches and never refetches; BrowserRouter keeps that state across a reload. The list is loaded at 10:00, order 1007's version moves at 10:05 (a colleague, or the PO-delay engine), the user edits at 10:10 and saves: 409. Reload restores the same snapshot and version, so every later save is refused too. Back after a save also reopens the pre-save values, and a just-submitted order reopens as an editable draft.
- **Fix:** Always call getOrderById on mount and use the passed row only as a placeholder (or replace the history entry's state after reading it). *(visible: the edit page shows its skeleton briefly when opened from the list)*
- **Estimate:** 1 h
- **Note:** Same defect as BOMForm (see the BOM section).

#### U005 · P1 · rule 1 — Submit Order in the view confirms a draft with no validation and no confirmation

*OrderView* — `src/pages/orders/OrderView.jsx:273-275, 505-511; src/pages/orders/OrderForm.jsx:1532-1564; erp/order/service/OrderService.java:276-284`

- **What happens:** Drafts are saved without the size/quantity/price checks, and the view's Submit Order calls the status change directly. A merchandiser saves a draft with no size breakdown yet; a manager opens it and clicks Submit Order: the order is Confirmed at 0 pcs and 0 value and the confirmation notices go out. Undoing it needs a refer-back request and its approval. The server checks only the version and the transition.
- **Fix:** Run the form's submit validation (as a shared helper) and the same confirm before handleSubmit; validate completeness on the server for the move to CONFIRMED. *(visible: a confirmation and validation messages when submitting from the view)*
- **Estimate:** 2.5 h

#### U006 · P1 · correctness — New Order after editing another order keeps that order's style and garment name, and a sample order saves them

*OrderForm* — `src/pages/orders/OrderForm.jsx:1025-1039, 1586, 1588`

- **What happens:** The same OrderForm instance serves /orders/edit/:id and /orders/new. Its reset effect clears the form but not resolvedStyleId/resolvedGarmentName. Edit order 1005 (style ST-100), click New Order in the sidebar, create a Sample order by typing buyer and style, and save: the new order is linked to ST-100's style id and garment name, its view shows ST-100's image, and the sample BOM preview and production lookups read that style.
- **Fix:** Reset both values in the reset effect (or key the form by route id). *(visible: the stray empty Style Image box no longer shows on New Order)*
- **Estimate:** 0.25 h

### P2

#### U007 · P2 · rule 5 — If the status call fails after a create, a retry creates a duplicate order

*OrderForm* — `src/pages/orders/OrderForm.jsx:902, 1681-1695`

- **What happens:** On /orders/new, Submit creates SG/26-27/1020 and then confirms it. If the confirm call fails (network drop, expired session), the catch says Failed to submit order and drops the created record; isEdit is still false, so clicking Submit again creates SG/26-27/1021 and leaves 1020 as a stray draft.
- **Fix:** Keep the created record and decide create-vs-update from it, retrying only the status call. *(not visible)*
- **Estimate:** 0.5 h

#### U008 · P2 · rule 7 — New row keys share a namespace with keys built from database ids, so a new colour or line can take an existing row's key

*OrderForm* — `src/pages/orders/OrderForm.jsx:123-124, 857, 1001, 1011`

- **What happens:** New keys are c_N/line_N from a module-level counter that advances twice per render (the useState initializer is not lazy), while saved rows get c_<id>/line_<id>. Editing an order whose colour rows have ids 19-21, after about ten renders Add Color mints c_21: typing the new colour's quantities overwrites colour 21's, and deleting one deletes both. Most likely on a young database (QA, early production).
- **Fix:** Give client keys their own prefix (e.g. new_c_N) and make the initializer lazy (useState(() => [createEmptyLine()])). *(not visible)*
- **Estimate:** 0.5 h

#### U009 · P2 · rule 1 — The server's "review the BOMs" warning after an order edit is never shown

*OrderForm* — `erp/order/service/OrderService.java:202-207; src/pages/orders/OrderForm.jsx:1640, 1682`

- **What happens:** When an order with BOMs is updated, the API returns warnings ['N BOM(s) exist for this order. Review BOMs after changes.'], but the form reads only id and version. A referred-back order goes from 3,000 to 4,000 pcs and is resubmitted; the user sees only the success toast, and the BOM and the POs raised from it stay sized for 3,000.
- **Fix:** Show saved.warnings as a warning message (or notification) after save and submit. *(visible: a warning after saving an order that has BOMs)*
- **Estimate:** 0.5 h

#### U010 · P2 · correctness — An unapproved costing ID keeps the previous costing's buyer, style and currency on the form

*OrderForm* — `src/pages/orders/OrderForm.jsx:1408-1416, 1489-1491`

- **What happens:** After looking up approved CST/26-27/1001, the user changes the field to draft costing CST/26-27/1002. The lookup shows the 'not approved' error and returns early without clearing anything, and validation treats the existing buyerId as verified, so Save stores costingId 1002 with 1001's buyer, style, currency and style id.
- **Fix:** Clear the costing-derived fields (or block saving) when the lookup rejects the costing. *(visible: the costing-derived fields clear after a rejected lookup)*
- **Estimate:** 0.5 h

#### U011 · P2 · correctness — Editing an order whose buyer was deactivated saves it with a blank buyer name

*OrderForm* — `src/pages/orders/OrderForm.jsx:955, 1574, 1584; erp/order/service/OrderService.java:173`

- **What happens:** The buyer list holds active buyers only, so buyers.find() misses a deactivated buyer and buyerName is sent as ''. The buyer is deactivated while order X is referred back; a quantity fix and resubmit stores an empty buyer name, so the list shows '-' and the print has no buyer. buyerId survives, so it is recoverable.
- **Fix:** Keep the loaded order's buyer name when the buyer is not in the active list (or load the order's own buyer). *(visible: the buyer name shows on such orders)*
- **Estimate:** 0.5 h

#### U012 · P2 · rule 8 — Editing only the components does not mark the form dirty, so Save says "No changes detected"

*OrderForm* — `src/pages/orders/OrderForm.jsx:1816-1819, 1626-1628, 1659-1661`

- **What happens:** A 2-piece set needs a third piece: Edit components, add Scarf, Save Components, Save as Draft gives 'No changes detected.' Resubmit of a referred-back order is blocked the same way, and leaving the page discards the change without the unsaved-changes prompt.
- **Fix:** Call setIsDirty(true) in the component dialog's onSave. *(not visible)*
- **Estimate:** 0.25 h

#### U013 · P2 · correctness — Blurring the Costing ID re-runs the lookup and overwrites a customised fabric description

*OrderForm* — `src/pages/orders/OrderForm.jsx:1405-1472, 1885`

- **What happens:** The lookup runs on every blur of a valid ID, in edit mode too, and writes fabricDescription from the style master. The user types '100% Cotton SJ 180 GSM, enzyme wash', then tabs through Costing ID: the description reverts and is saved reverted. A failed lookup clears buyer, style, season, currency and fabric.
- **Fix:** Skip the lookup when the ID equals the last verified one and never overwrite a description the user edited. *(not visible)*
- **Estimate:** 1 h

#### U014 · P2 · rule 1 — A refer-back or cancel reason is wiped when the request fails

*OrderView* — `src/pages/orders/OrderView.jsx:260-271, 626-630, 671-675`

- **What happens:** doStatusChange swallows the error, so the handler closes the box and clears the 50-500 character reason even when the request failed (a 409 because the delay engine bumped the version, or a network drop).
- **Fix:** Have doStatusChange return success and clear the input only on success. *(not visible)*
- **Estimate:** 0.25 h

#### U015 · P2 · rule 1 — A branch split saved from the view never reaches the list, so reopening the order shows the old split

*OrderView, OrderList* — `src/pages/orders/OrderView.jsx:100, 774, 920; src/pages/orders/OrderList.jsx:153-156, 398-402`

- **What happens:** The saved split is kept only in the dialog's local state; closing the dialog drops it and the list is not refetched. Split order 1008 600 Tirupur / 400 Erode and close: the Branch column still says Tirupur and reopening shows 'Tirupur: 1,000 pcs'. The server holds the right split.
- **Fix:** Refetch the list (or patch the row's allocations) after an allocation save. *(visible: the Branch column updates after a split)*
- **Estimate:** 0.5 h

#### U016 · P2 · rule 4 — Notification links to an order do nothing while the Order List is open, and the leftover action replays later

*OrderList* — `src/pages/orders/OrderList.jsx:61-77; src/components/NotificationCenter.jsx:191, 202`

- **What happens:** The deep-link effect runs only on mount. Clicking a bell entry (or its Approve chip) while on the list only changes the URL to ?viewId=12&action=approve and no dialog opens; a later F5 or Back to that entry opens order 12 and acts on it (and re-arms the P0 above). Push-notification taps do a full navigation and work.
- **Fix:** Drive the effect from searchParams (viewId and action), consume them once and strip them. *(visible: the order dialog opens from the bell while on the list)*
- **Estimate:** 0.5 h

#### U017 · P2 · rule 6 — Order List page, filters and sort are lost on every return from the form

*OrderList* — `src/pages/orders/OrderList.jsx:42-52; src/pages/orders/OrderForm.jsx:1650, 1692`

- **What happens:** All list state is local, and the form returns with navigate('/orders/list'). Filter Status = Draft, go to page 3, edit and save an order: the list is back on page 1, unfiltered, for every draft in turn.
- **Fix:** Keep page, sort and filters in the URL and return to it (WS7 list-state work). *(visible: the list comes back as the user left it)*
- **Estimate:** 1.5 h

### P3

#### U018 · P3 · rule 4 — Order List: an older search response can overwrite a newer one

*OrderList* — `src/pages/orders/OrderList.jsx:86-121, 124-127`

- **What happens:** fetchData has no request sequencing; switching branch or filter while a slow request is in flight can leave the older result under the newer filter until the next refresh.
- **Fix:** Drop stale responses with a request-sequence ref (or move the list onto useServerList). *(not visible)*
- **Estimate:** 0.25 h

#### U019 · P3 · rule 6 — Order List: ties on a chosen sort column page unstably, and clearing a sort keeps sorting by it

*OrderList* — `erp/order/service/OrderService.java:61-63; src/pages/orders/OrderList.jsx:130-135`

- **What happens:** Sorting by Order Date with many orders on one day can repeat a row on two pages and drop another (no id tie-breaker). Clearing the column sort sends field undefined, and the code keeps the old field, descending, while the header shows no sort.
- **Fix:** Append an id tie-breaker on the server (covered by A1) and reset to id/desc when sorter.order is undefined. *(visible: a cleared sort returns to newest-first)*
- **Estimate:** 0.25 h

#### U020 · P3 · rule 14, rule 50 — On large orders every keystroke re-renders every line's size matrix (unmeasured)

*OrderForm* — `src/pages/orders/OrderForm.jsx:334, 1021, 2213-2446`

- **What happens:** All panels open in edit mode, the Collapse items and the inline onLineChange are rebuilt each render, and SizeBreakdownTable is not memoised. A 20-line × 6-colour × 8-size order has about 1,100 inputs re-rendering per keystroke. Re-grade to P2 if a 10-line order measures over 100 ms per keystroke.
- **Fix:** Memoise SizeBreakdownTable and pass a stable handler plus the line key. *(not visible)*
- **Estimate:** 1.5 h

#### U021 · P3 · rule 2 — Duplicate catch-block toasts in the order screens

*OrderForm, OrderView, OrderList* — `src/pages/orders/OrderForm.jsx:148, 719, 957, 966, 974, 1060, 1652, 1694; src/pages/orders/OrderView.jsx:267; src/pages/orders/OrderList.jsx:75, 115, 146`

- **What happens:** Each toasts after an axios failure the interceptor has already toasted; a failed save shows two stacked toasts, and a version conflict shows the conflict dialog plus 'Failed to save order'.
- **Fix:** Use toastUnlessHandled(message, e, fallback) from src/utils/apiError.js (WS7 toast sweep). *(visible: one toast instead of two)*
- **Estimate:** 1 h

#### U022 · P3 · rule 9 — Numbers formatted with the browser locale instead of en-IN

*OrderForm, OrderView, OrderList, OrderBranchAllocation, order print* — `src/pages/orders/OrderForm.jsx:624, 627, 654, 667, 674, 1715, 1719, 2145, 2156, 2494, 2516, 2534, 2546; src/pages/orders/OrderView.jsx:198, 368, 384, 754, 781, 787, 838, 886; src/pages/orders/OrderList.jsx:221; src/pages/orders/OrderBranchAllocation.jsx:175-178; src/utils/orderPdfGenerator.js:15, 100, 108, 167, 233, 577, 624, 651`

- **What happens:** toLocaleString() with no locale (or undefined) groups digits by the browser's locale, so the same quantity reads 1,25,000 in one place and 125,000 in another; the order print hard-codes en-US at :15.
- **Fix:** Use formatNumber/formatCurrency from src/utils/formatters.js (WS2a). *(visible: en-IN grouping on non-en-IN browsers)*
- **Estimate:** 1 h

#### U023 · P3 · rule 14 — Column arrays rebuilt on every render

*OrderForm, OrderView* — `src/pages/orders/OrderForm.jsx:247-301, 2461-2523; src/pages/orders/OrderView.jsx:805-864`

- **What happens:** Inline columns arrays are recreated per render (per keystroke on the form).
- **Fix:** useMemo or module-level factories (WS6). *(not visible)*
- **Estimate:** 0.5 h

#### U024 · P3 · rule 7 — Order view colour rows are keyed by an undefined row.key

*OrderView* — `src/pages/orders/OrderView.jsx:359-360`

- **What happens:** API colour rows carry id but no key, so React logs a unique-key warning for every order with two or more colours.
- **Fix:** key={row.id ?? row.key}. *(not visible)*
- **Estimate:** 0.1 h

#### U025 · P3 · rule 33 — Accessibility gaps: a clickable div, and controls without a name or label

*OrderForm, OrderView* — `src/pages/orders/OrderForm.jsx:158-165, 483-493; src/pages/orders/OrderView.jsx:605-613, 649-657`

- **What happens:** Keyboard users cannot download costing documents (div with onClick only); the size-preset Select and the refer-back/cancel reason boxes have no id, name or aria-label.
- **Fix:** Use a button (or role, tabIndex and Enter handling) and add aria-label/ids. *(not visible)*
- **Estimate:** 0.5 h

#### U026 · P3 · rule 34 — Dead fields and exports in the order code

*OrderForm* — `src/pages/orders/OrderForm.jsx:345, 366, 393, 829, 1002, 1104; src/utils/orderConstants.js:41`

- **What happens:** line.basePrice is never set, lineId is stored but never sent, _imagePreviewUrl is never set on an order line, and ACTIONABLE_STATUSES has no importer.
- **Fix:** Remove them. *(not visible)*
- **Estimate:** 0.25 h

#### U027 · P3 · rule 4 — Order form fetch effects have no ignore flag

*OrderForm* — `src/pages/orders/OrderForm.jsx:905-908, 947-975, 1042-1068`

- **What happens:** Unlikely race: opening /orders/edit/A by URL and clicking New Order before A's GET returns fills the new form with A's data, and Save creates a copy.
- **Fix:** Add a cancelled flag in each effect's cleanup. *(not visible)*
- **Estimate:** 0.25 h

## BOM (bill of materials, cut panel and garment process requirements)

### P0

#### U028 · P0 · correctness — Saving a BOM that has a PO-locked line stores each later line's quantities, UOM and conversion factor from a different line

*BOMForm* — `src/pages/bom/BOMForm.jsx:1275, 1280, 1287, 1292-1306; erp/bom/service/BomService.java:560-565`

- **What happens:** buildPayload filters out PO-generated lines and then reads lines[idx] from the UNfiltered list, so every editable line after a locked one gets baseQty, totalQty, purchaseQty, purchaseUom, uomConversionFactor and purchaseQtyPrimary from the line before it; the server stores them as sent. Lines in id order: #1 fabric (PO raised, 1,250 M), #2 buttons (6,180 PCS), #3 thread (600 cones). Any edit + Update BOM stores #2 with 1,250 M and #3 with 6,180 PCS. The editor recomputes on screen so nobody notices, but the BOM view, the list total and the next PO for the thread (pre-filled with 6,180 PCS) carry the wrong figures. It re-corrupts on every save while the locked line exists.
- **Fix:** Map over the filtered line objects and compute every quantity from that same line (not lines[idx]). Before go-live, list BOMs whose PO-generated line precedes an editable line, re-save them from the fixed editor, and review POs raised from shifted lines. *(not visible (stored figures become correct))*
- **Estimate:** 2.5 h

### P1

#### U029 · P1 · rule 5 — Edit opens the list's row snapshot from history state, so Back/F5 show stale data and the conflict dialog's Reload loops

*BOMForm* — `src/pages/bom/BOMForm.jsx:171, 320; src/pages/bom/BOMList.jsx:212; src/components/ConflictDialog.jsx:36`

- **What happens:** List rows carry full lines, so Edit always uses location.state.bomData and never fetches; BrowserRouter keeps that state across a reload. User B saves a BOM while user A edits it from an older list: A's save gets 409, Reload restores the same snapshot and version, and every further save is refused until A re-enters from the list. Back after a save reopens the pre-save values. The stale snapshot also widens the PO-lock race below.
- **Fix:** Always call getBomById(id) in edit mode (the state only as a placeholder), or replace the history entry's state after reading it. *(visible: Edit shows its skeleton briefly)*
- **Estimate:** 0.5 h
- **Note:** Same defect as OrderForm (see Orders).

#### U030 · P1 · rule 5 — The server overwrites a BOM line that became PO-generated after the editor loaded it

*BOMForm (API)* — `erp/bom/service/BomService.java:513-517, 547-566; erp/bom/repository/BomLineRepository.java:19-21; src/pages/bom/BOMForm.jsx:385, 1275`

- **What happens:** syncLines updates any existing line id without checking isPoGenerated, and the PO lock is a bulk JPQL update that bumps no version, so the version guard passes. 10:00 the merchandiser opens the BOM; 10:05 Purchase raises a fabric PO from line 1; 10:10 the merchandiser changes line 1's consumption from 1.20 to 1.35 and saves. Line 1 is now locked at 1.35 while its PO was raised on 1.20, and the UI cannot correct it.
- **Fix:** In syncLines skip (or refuse with 409) DTOs for lines already PO-generated, and increment the BOM version when updateLinePoStatus locks lines. *(not visible)*
- **Estimate:** 2 h
- **Note:** API change (erp-purchase), released with the UI as a pair.

#### U031 · P1 · correctness — Fabric base quantity takes the first partial colour match, so "White" picks up "Off White"

*BOMForm* — `src/pages/bom/BOMForm.jsx:949-952, 742-747`

- **What happens:** For each order line the first colour row matching by substring in either direction wins, with no preference for an exact match. With colours [Off White 1,200, White 800], the White fabric line is sized on 1,200 (50% over); listed the other way round, Off White gets 800. Grey/Grey Melange and Black/Black Melange behave the same.
- **Fix:** Prefer an exact (trimmed, case-insensitive) match; fall back to a partial match only when exactly one exists, otherwise treat the colour as missing so the override picker appears. *(not visible (corrected quantities))*
- **Estimate:** 1 h

#### U032 · P1 · correctness — After an order amendment, trims lines keep the BOM's old order quantity while fabric lines use the live order

*BOMForm* — `src/pages/bom/BOMForm.jsx:334, 452-478, 946, 964, 1320; erp/bom/service/BomService.java:247`

- **What happens:** Edit mode sets orderQty from the stored BOM, and the edit-mode order fetch refreshes colours and the order summary but never orderQty, which is also sent back on save. The order goes from 10,000 to 12,000 pcs and is re-confirmed: fabric is computed for 12,000 garments, Simple trims for 10,000, and the trims PO is 2,000 garments short.
- **Fix:** Set orderQty from the order's current total in the edit-mode order effect and say when it changed. *(visible: the header Order Qty shows the order's current total)*
- **Estimate:** 0.5 h

#### U033 · P1 · correctness — Removing a process keeps its allowances in the purchase quantity

*BOMForm* — `src/pages/bom/BOMForm.jsx:1083, 1090, 1043-1045; src/utils/bomConstants.js:109-113, 119-122`

- **What happens:** Removing a process updates only the process list and returns; processAllowances is never pruned, and calcLinePurchaseQty sums every entry. A fabric line with Dyeing (8/2/1%) and Printing (5/2/0%) keeps base +18% after Printing is removed instead of +11%, and the edit dialog no longer shows the cause. The inflated quantity is saved and used by the PO.
- **Fix:** Filter processAllowances to the remaining process ids whenever processes change. *(not visible (corrected quantity))*
- **Estimate:** 0.5 h

#### U034 · P1 · correctness — Adding a process reopens the allowance dialog with master defaults for every process, discarding edited values

*BOMForm, ProcessAllowanceModal* — `src/pages/bom/BOMForm.jsx:998-1007, 1101-1102, 1151; src/pages/bom/ProcessAllowanceModal.jsx:48`

- **What happens:** openAllowanceDialog rebuilds every row from master defaults with no per-size allowances, and Apply replaces them all (editAllowanceDialog merges saved values; this path does not). The user raises Dyeing rejection from 2% to 3% (with eight per-size values on a matrix line), then adds Compacting: the dialog shows Dyeing back at 2% with no per-size values, and Apply saves that.
- **Fix:** Seed already-selected processes from line.processAllowances (including sizeAllowances), as editAllowanceDialog does. *(visible: the dialog shows the user's saved values instead of defaults)*
- **Estimate:** 1 h

#### U035 · P1 · correctness — Fabric lines in Size-wise or Variant-per-size mode never apply process loss, and the dialog offers no loss or shrinkage input

*BOMForm, ProcessAllowanceModal* — `src/utils/bomConstants.js:100-116; src/pages/bom/ProcessAllowanceModal.jsx:358, 529-567; src/pages/bom/BOMForm.jsx:1744-1799; erp/bom/service/BomVariantBreakdown.java:182-205`

- **What happens:** The matrix branch adds only rejection and shipment; the dialog hides Loss/Shrinkage in matrix mode, yet the mode toggle is offered for fabric ('more fabric for larger sizes'). A Size-wise jersey line needing 1,000 kg with Dyeing at 8% loss / 2% rejection / 1% shipment orders 1,030 kg; Simple mode would order 1,110 kg, so 80 kg short.
- **Fix:** Owner ruling first: either apply process loss on fabric matrix lines (and show Loss/Shrinkage in the dialog and BomVariantBreakdown), or stop offering matrix modes for fabric. *(visible: Loss/Shrinkage inputs in the matrix allowance dialog, or the mode hidden for fabric)*
- **Estimate:** 3 h
- **Note:** Needs owner: the code comments assume matrix modes are for trims, but the UI offers them for fabric.

#### U036 · P1 · correctness — A CAD marker staged on a new line is skipped whenever the same save adds a new line without a CAD

*BOMForm* — `src/pages/bom/BOMForm.jsx:1492-1497`

- **What happens:** Staged uploads are paired positionally, but one side counts only lines with a staged file and the other counts every new line; on a mismatch all uploads are skipped. On Create every saved line is new and trims lines cannot hold a CAD, so any new BOM with a trims line drops every staged marker: 'BOM created successfully', a warning toast, and no CAD stored.
- **Fix:** Pair all new local lines (in payload order) with the new saved lines, then upload only where a file is staged. *(not visible (markers are stored))*
- **Estimate:** 1 h

#### U037 · P1 · rule 6 — Searching or filtering from page 2+ shows "No BOMs found" for matches that exist, with no way back to page 1

*BOMList* — `src/pages/bom/BOMList.jsx:57-62, 75, 84-88, 245, 253`

- **What happens:** Search and status changes never reset the page, so the request asks for the current page of the filtered result. On page 3 the user types 'SG/25-26/1042': the table says No BOMs found while the footer says 1-1 of 1, and clicking '1' does nothing (it is the displayed current page). The user may then try to create the BOM again and hit 'BOM already exists'. Deleting the last row of the last page lands on the same dead end.
- **Fix:** Reset to page 1 when search or status changes, and step back a page when a delete empties the page. *(not visible (results appear))*
- **Estimate:** 1 h
- **Note:** Remains after 6519a67, which fixed the page fields themselves.

### P2

#### U038 · P2 · correctness — Validation checks PO-locked lines, so a locked variant-per-size line can freeze the whole BOM

*BOMForm* — `src/pages/bom/BOMForm.jsx:1355-1412`

- **What happens:** validateBom iterates every line, including PO-locked lines that are neither sent nor editable. A variant-per-size zipper line is PO'd; the order is referred back and an XXL size added. Every Save/Update now fails 'Line 1: Variant mapping missing for sizes: XXL.' and line 1 cannot be edited, so the BOM is frozen until the PO is cancelled.
- **Fix:** Skip PO-generated lines in validation. *(not visible)*
- **Estimate:** 0.25 h

#### U039 · P2 · correctness — A BOM can be built for an order that already has one, and the work is lost at Create

*BOMForm* — `src/pages/bom/BOMForm.jsx:488-494; erp/bom/service/BomService.java:191-195`

- **What happens:** The order lookup checks only that the order is Confirmed; suggestions include orders that already have a BOM. A user builds 12 lines with CAD files, presses Create BOM, and gets 409 'BOM already exists for order'. Nothing can be saved.
- **Fix:** Check for an existing BOM on order lookup (getBomByOrderNo) and offer to open it. *(visible: an early message on picking such an order)*
- **Estimate:** 0.5 h

#### U040 · P2 · correctness — The allowance dialog shows the previous line's rows when the line's processes are not in the active list

*BOMForm, ProcessAllowanceModal* — `src/pages/bom/ProcessAllowanceModal.jsx:35-40; src/pages/bom/BOMForm.jsx:1043-1047, 1151`

- **What happens:** Rows reset only when processes.length > 0 and the modal stays mounted. 'Edit allowances' on a line whose processes were retired (or when the process list failed to load) receives [] and shows the previous line's rows; Apply copies those foreign allowances onto this line, or [] wipes them.
- **Fix:** Always reset rows when the dialog opens. *(not visible)*
- **Estimate:** 0.25 h

#### U041 · P2 · correctness — Retired or deleted processes lose their name on the next save, and the process delete guard never sees BOM usage

*BOMForm* — `src/pages/bom/BOMForm.jsx:375, 1043-1045, 1309-1312; src/pages/bom/BOMView.jsx:37; erp/masterdata/process/ProcessService.java:180-185, 208-214; erp/bom/repository/BomLineRepository.java:27-31`

- **What happens:** Load keeps only process ids, save writes {id} when the process is no longer in the active list, the edit dialog drops it, and BOMView falls back to the bare id. The master's delete/rename guard searches JSON for "processId" while the UI writes {"id": …}, so it never sees BOM usage. 'Enzyme Wash' is deactivated: the BOM shows tag '17', any save stores {"id":17}, production lookups lose the name and 'Edit allowances' drops its allowance.
- **Fix:** UI: keep each loaded {id, processName} as the label and payload fallback, and keep retired processes' allowances. API: match both id and processId in the usage guard. *(visible: retired processes show their names)*
- **Estimate:** 3 h

#### U042 · P2 · correctness — Changing an item or category keeps the previous item's variant code, saved base quantity and CAD marker on the line

*BOMForm* — `src/pages/bom/BOMForm.jsx:653-660, 1689-1691, 956, 426`

- **What happens:** resetItemFields omits variantCode, variantName, _savedBaseQty, the override fields and the CAD fields. Line 1 changes from Single Jersey to Pique: Item Code still shows the jersey's variant code, a new fabric missing from the order inherits the old 'Saved — 1,200' base, and the jersey marker stays attached (green tick, old file name) and is offered as the download in BOMView.
- **Fix:** Add those fields (and the CAD fields, deleting the old marker on save) to resetItemFields, and mention the marker in the confirm text. *(visible: stale code, base and marker disappear after a change)*
- **Estimate:** 0.5 h

#### U043 · P2 · correctness — Cancelling the first allowance dialog leaves no pencil to reopen it, and Submit is then blocked

*BOMForm* — `src/pages/bom/BOMForm.jsx:2656, 2074, 1427-1431`

- **What happens:** Cancel only closes the dialog while the process stays selected; the Edit-allowances icon shows only when allowances exist; Submit requires allowances. Pick Dyeing, press Esc: no pencil, and Update BOM warns. Workaround: remove and re-add the process.
- **Fix:** Show Edit allowances whenever the line has processes, and validate that every selected process has an entry. *(visible: the pencil appears on lines with processes but no allowances)*
- **Estimate:** 0.25 h

#### U044 · P2 · correctness — Changing a Size-wise line's variant silently wipes its consumption matrix

*BOMForm* — `src/pages/bom/BOMForm.jsx:879, 886, 898, 1837`

- **What happens:** The Change-variant pencil clears the variant and every variant path nulls consumptionMatrix and variantMapping. Swapping the shade on a 5-colour × 6-size Size-wise line loses the whole matrix, even when the same variant is picked again.
- **Fix:** Keep the matrix on a variant change in Size-wise mode (clear only when leaving Variant-per-size), or confirm first. *(visible only if a confirmation is chosen)*
- **Estimate:** 1 h

#### U045 · P2 · correctness — Trims processes: the master's process loss is applied but hidden, so the dialog's figures do not add up

*ProcessAllowanceModal* — `src/pages/bom/ProcessAllowanceModal.jsx:44, 113, 129-169, 261, 569-576; src/pages/master/ProcessMaster.jsx:170-175`

- **What happens:** For trims the Loss column is hidden and the formula line omits it, but the stored loss is applied. A trims process with 3/2/1% shows 'Base 10,000 + Rejection 200 + Shipment 100 = 10,600'.
- **Fix:** Show Loss for trims, or zero it for trims consistently in the dialog and calcLinePurchaseQty. *(visible)*
- **Estimate:** 0.5 h

#### U046 · P2 · correctness — The "Buyer PO" basis shows separate per-PO matrices that share one value per colour × size

*ConsumptionMatrixDialog* — `src/pages/bom/ConsumptionMatrixDialog.jsx:79-81, 113, 247-251, 392-397`

- **What happens:** Each PO table edits the same matrix cell. Enter 0.50 for Navy/M under PO-A, then 0.60 under PO-B: PO-A now shows 0.60 and both save 0.60. The screen implies per-PO consumption that does not exist.
- **Fix:** Render one editable grid with a read-only per-PO breakdown until per-PO consumption exists. *(visible)*
- **Estimate:** 2 h

#### U047 · P2 · correctness — The AI consumption result is applied without checking its unit

*BOMForm* — `src/pages/bom/BOMForm.jsx:1257-1268; src/pages/costing/ConsumptionCalcModal.jsx:69, 78, 87`

- **What happens:** The modal returns uom (kgs for knits) but the BOM handler drops it. A knit line consumed in GMS gets 0.2450, so 5,000 pcs need 1,225 GMS instead of 1,225 kg. Costing warns in this case; BOM does not.
- **Fix:** Compare the result's unit with the line's consumption unit, convert mass units, and warn otherwise. *(visible: a warning or a converted value)*
- **Estimate:** 1 h
- **Note:** Same calculator as the costing finding on AI consumption units.

#### U048 · P2 · rule 5 — If the release fails after a successful update, the new version is not adopted and every retry gets a 409

*BOMForm* — `src/pages/bom/BOMForm.jsx:1543-1544, 1552, 1582-1583, 1591, 1595-1596`

- **What happens:** Update succeeds (v5→v6), then releaseBom fails (network, 500). The catch says Failed to update BOM and the form still holds v5, so the retry's PUT is refused as a conflict although the draft was saved; with the snapshot defect above, Reload does not recover.
- **Fix:** Adopt saved.version and status straight after updateBom, and say 'Saved; release failed' on that path. *(visible only on that failure path)*
- **Estimate:** 0.5 h

#### U049 · P2 · rule 4 — Edit downloads every fabric line's whole CAD file just to show a tick, never revokes the URLs, and a late download can undo a fresh replace

*BOMForm* — `src/pages/bom/BOMForm.jsx:421-436, 2194, 2231, 2243`

- **What happens:** Each fabric CAD (often several MB) is downloaded as a blob on every Edit open; the object URL is only used as a flag and never revoked. On a slow link, staging a replacement before the download lands records no file to delete, and the late load writes the old file id back, leaving two CAD_MARKER files.
- **Fix:** Read file metadata instead of downloading, revoke staged URLs, and ignore a loader result if the line already has a staged file. *(not visible)*
- **Estimate:** 1 h

#### U050 · P2 · correctness — "Total Purchase Qty" adds metres, pieces and cones together

*BOMForm, BOMList* — `src/pages/bom/BOMForm.jsx:1238-1241, 2616; src/pages/bom/BOMList.jsx:172-180; erp/bom/service/BomService.java:593-622`

- **What happens:** Both sum each line's purchase quantity in its own unit, with no unit shown: fabric 1,250 M + buttons 6,180 PCS + thread 3,000,000 M shows as 3,007,430.00. The form's card does not even equal its own column, which is converted.
- **Fix:** Remove the figure or show totals per UOM. *(visible)*
- **Estimate:** 1 h

#### U051 · P2 · rule 33 — The consumption matrix and allowance editor can only be opened with a mouse

*BOMForm, ProcessAllowanceModal, ConsumptionMatrixDialog* — `src/pages/bom/BOMForm.jsx:1835-1838, 1915-1918, 2076-2079, 2202-2218; src/pages/bom/ProcessAllowanceModal.jsx:302-324; inputs without name/id at BOMForm.jsx:1621, 1643, 1666, 1802, 1993, 2033, 2053, 2634`

- **What happens:** The entry points are antd icons with onClick, which render with tabIndex -1 and role img; process reordering is drag-only. A keyboard user cannot enter size-wise consumption or reopen allowances.
- **Fix:** Use Button type=text with aria-labels, add move up/down for reordering, and give inputs a name/id. *(visible: focus rings on the icon buttons)*
- **Estimate:** 2 h

#### U052 · P2 · rule 5 — Any 409 on "Save changes" reloads the requirement and wipes the user's edits behind a dialog that tells them to stay and copy their work

*Cut Panel / Garment Process Requirement* — `src/pages/bom/shared/useRequirementActions.js:32-34; src/pages/bom/shared/useRequirementDocument.js:43-45; src/components/ConflictDialog.jsx:31-33`

- **What happens:** The revise call reloads on any 409, which dispatches LOADED (doc replaced, dirty cleared), while the interceptor opens the conflict dialog for OPTIMISTIC_LOCK_CONFLICT. Two people edit the same submitted CPR; A saves; B clicks Save changes and the dialog says 'stay to copy your work' while B's grid already shows A's version. A GPO placed against a GPR also arrives as a version conflict, so the stated cause is wrong in that case too.
- **Fix:** On a 409 re-read without dispatching, and adopt the fresh copy only if a PO was placed or the status left SUBMITTED; otherwise keep the user's document on screen for the dialog's choice. *(visible: the user's edits stay on screen behind the dialog)*
- **Estimate:** 2 h

#### U053 · P2 · rule 1 — Edits typed while a requirement save is running are silently replaced by the server's copy

*Cut Panel / Garment Process Requirement* — `src/pages/bom/shared/useRequirementActions.js:20-30, 33-38; src/pages/bom/cutPanel/cprReducer.js:73-74; src/pages/bom/garmentProcess/gprReducer.js:85-94; src/pages/bom/cutPanel/CutPanelForm.jsx:59; src/pages/bom/garmentProcess/GarmentProcessForm.jsx:49`

- **What happens:** The save sends the document captured at the click, then SAVED replaces it and clears dirty; the grid, remarks and Add to Grid stay live during the save. On a 150-line CPR the user clicks Save Draft and keeps keying quantities: when the response lands those cells snap back and leaving the page gives no warning.
- **Fix:** Make the document read-only while a save, submit or revise is running. *(visible: inputs are disabled during a save)*
- **Estimate:** 1.5 h

#### U054 · P2 · rule 14, rule 49, rule 50 — Every keystroke in the CPR grid rebuilds the columns and re-renders every input on every line

*Cut Panel Requirement* — `src/pages/bom/cutPanel/CprRequirementGrid.jsx:30-47, 77-83; src/pages/bom/cutPanel/cprGridRows.js:25; src/pages/bom/cutPanel/CprGridInputs.jsx:29-45`

- **What happens:** A quantity edit rebuilds every row object, lineKeys, focusNext and the columns, so rc-table re-renders every cell. 200 lines × 8 sizes is about 1,600 Tooltip-wrapped inputs plus 600 others per keystroke, likely over the 50 ms budget (rule 53). Not profiled.
- **Fix:** Profile first; then hold lineKeys in a ref, memoise onRow/rowSelection and cache row objects per line. *(not visible)*
- **Estimate:** 4 h

#### U055 · P2 · rule 6 — BOM and requirement lists lose page, search, filters and sort after Edit or Save

*BOMList, Cut Panel / Garment Process lists* — `src/pages/bom/BOMList.jsx:38-46; src/pages/bom/BOMForm.jsx:1555, 1594; src/hooks/useServerList.js:15-17; src/pages/bom/cutPanel/CutPanelList.jsx:31-33; src/pages/bom/garmentProcess/GarmentProcessList.jsx:23-25`

- **What happens:** List state is local and the forms return with navigate(list). Page 3 filtered to Draft → Edit → Update lands on page 1, unfiltered; the CPR list's default financial-year range comes back too.
- **Fix:** Keep list state in the URL (useServerList for the requirement lists) — WS7 list-state work. *(visible: the list comes back as the user left it)*
- **Estimate:** 2.5 h

### P3

#### U056 · P3 · rule 4 — A slow item lookup after an Item Type change can attach the wrong item

*BOMForm* — `src/pages/bom/BOMForm.jsx:716-721`

- **What happens:** No staleness check: pick Item Type A, immediately re-pick B; if A's response lands last the line shows type B with item A's code, variants and UOM.
- **Fix:** Per-line request counter; ignore stale responses. *(not visible)*
- **Estimate:** 0.5 h

#### U057 · P3 · rule 1 — Save Draft and Create/Update are not disabled while the other is running

*BOMForm* — `src/pages/bom/BOMForm.jsx:2332, 2339`

- **What happens:** Clicking Save Draft and then Create BOM during the save gives 'BOM already exists' plus 'Failed…' toasts. No duplicate is possible (unique order_no).
- **Fix:** Disable both while either runs (useBusyAction). *(visible: the other button greys out during a save)*
- **Estimate:** 0.25 h

#### U058 · P3 · rule 33 — PO-locked lines are locked by CSS only

*BOMForm* — `src/pages/bom/BOMForm.jsx:2587-2595, 1621-1630, 1929-1942`

- **What happens:** pointer-events: none stops the mouse, but Tab reaches the inputs: typed values change the totals on screen and are silently not saved.
- **Fix:** Disable the controls when record.isPoGenerated. *(not visible to mouse users)*
- **Estimate:** 0.5 h

#### U059 · P3 · correctness — Locked lines display the item master's current conversion factor, not their snapshot

*BOMForm* — `src/pages/bom/BOMForm.jsx:369-371, 408-410`

- **What happens:** The code contradicts its comment: the factor comes from the item master even on PO-generated lines, so after a cone length changes a locked thread line's figures no longer match its PO.
- **Fix:** Keep the snapshot when line.isPoGenerated. *(visible on locked lines only)*
- **Estimate:** 0.25 h

#### U060 · P3 · correctness — BOM view shows "Consumption —" for fabric lines in Size-wise or Variant-per-size mode

*BOMView* — `src/pages/bom/BOMView.jsx:213, 252-256, 303-310`

- **What happens:** isMatrix excludes fabric, while the form clears consumptionPerGarment in matrix mode, so the view shows a dash and no mode tag.
- **Fix:** Drop the !fabric condition. *(visible)*
- **Estimate:** 0.25 h

#### U061 · P3 · rule 6 — BOM list sort quirks: a cleared sort keeps sorting, no id tie-breaker, and every page change fetches twice

*BOMList* — `src/pages/bom/BOMList.jsx:84-97; erp/bom/service/BomService.java:96-100`

- **What happens:** The third header click shows no arrow but the list stays sorted by Style No descending; repeat orders of one style can repeat or vanish across pages; each page change sends two requests.
- **Fix:** Reset to id/desc when sorter.order is undefined, add the id tie-breaker on the server (A1), and drop the duplicate fetch. *(visible: a cleared sort returns to newest-first)*
- **Estimate:** 0.5 h

#### U062 · P3 · rule 14, rule 49 — The BOM grid redoes all per-row work on every keystroke

*BOMForm* — `src/pages/bom/BOMForm.jsx:1604, 1239, 1907, 2095, 2141, 2150, 2657-2713`

- **What happens:** Columns are rebuilt each render, computeTotalQty runs about three times per row, the order grid is rebuilt per row, and twelve lines.find calls run per render. With 200 lines one digit re-renders about 1,200 selects.
- **Fix:** Memoise columns, the order grid and per-line totals (a Map keyed by line key) — WS17 measures first. *(not visible)*
- **Estimate:** 3 h

#### U063 · P3 · rule 4 — BOM list and view fetches have no stale-response guard

*BOMList, BOMView* — `src/pages/bom/BOMList.jsx:57-88; src/pages/bom/BOMView.jsx:54-70`

- **What happens:** Typing, pausing past the debounce and typing again can let the older response land last; the view's fetch runs only for BOMs without lines, so it is practically unreachable.
- **Fix:** Track the latest request and ignore older responses. *(not visible)*
- **Estimate:** 0.25 h

#### U064 · P3 · rule 34 — Dead or unwired BOM code (beyond the known match-by panel)

*BOMForm, BOMList, BOMView* — `src/pages/bom/BOMForm.jsx:267-271, 939-967, 1092-1144, 1259-1267, 1864-1873, 2723-2755; src/services/bom/bomService.js:52-57; src/pages/bom/BOMList.jsx:290-294`

- **What happens:** getColorQty always returns needsPoPick false, so the Buyer PO picker and handleBuyerPoPick are unreachable; splitBySizes is never sent; changeBomStatus has no caller; BOMList passes an onStatusChange that BOMView ignores.
- **Fix:** Delete, or wire with the owner's UNWIRED decision. *(not visible)*
- **Estimate:** 0.5 h

#### U065 · P3 · rule 2 — Duplicate catch-block toasts in the BOM screens

*BOMForm, BOMView, BOMList* — `src/pages/bom/BOMForm.jsx:439, 726, 1557, 1596; src/pages/bom/BOMView.jsx:63, 146; src/pages/bom/BOMList.jsx:80, 107`

- **What happens:** Each toasts after an axios failure the interceptor already toasted; Failed to save/update BOM also stacks on the conflict dialog.
- **Fix:** toastUnlessHandled (WS7). *(visible: one toast instead of two)*
- **Estimate:** 0.5 h

#### U066 · P3 · rule 9 — BOM numbers formatted with the browser locale instead of en-IN

*BOMForm, BOMView, BOMList, allowance and matrix dialogs* — `src/pages/bom/BOMForm.jsx (16 calls, e.g. 1911, 1977, 2019, 2444, 2624, 2984); src/pages/bom/BOMView.jsx:205, 309, 405, 441; src/pages/bom/BOMList.jsx:179; src/pages/bom/ProcessAllowanceModal.jsx:550-575; src/pages/bom/ConsumptionMatrixDialog.jsx:270-314, 405; src/utils/uomConversions.js:64`

- **What happens:** toLocaleString() with no or undefined locale; grouping follows the browser, mixed with en-IN figures in the same dialog.
- **Fix:** formatNumber from src/utils/formatters.js (WS2a). *(visible on non-en-IN browsers)*
- **Estimate:** 1 h

#### U067 · P3 · rule 1 — The CPR screen ignores the BOM's status, so an unreleased BOM never shows "no approved BOM" (latent)

*Cut Panel Requirement* — `src/pages/bom/cutPanel/CprHeaderSection.jsx:63; src/utils/cutPanelCalc.js:206; erp/jobwork/common/service/JobWorkOrderContextService.java:65-66, 82-84`

- **What happens:** The server sends the latest unreleased BOM's id with bomStatus, but the UI treats any bomId as approved. Only reachable if a released BOM is reopened outside the app (the BOM form hides Save Draft on a released BOM); then Save is refused by the server with its own message.
- **Fix:** Treat bomStatus !== 'CREATED' as VAL-02 in the header, draft checks and pre-submit checks. *(not visible today)*
- **Estimate:** 0.5 h

#### U068 · P3 · correctness — The header's Recalculate wipes every manual quantity edit without asking

*Cut Panel Requirement* — `src/pages/bom/cutPanel/CprHeaderSection.jsx:57; src/pages/bom/cutPanel/CprGridToolbar.jsx:68; src/pages/bom/cutPanel/cprReducer.js:47-52`

- **What happens:** The toolbar's identical action asks first ('All manual quantity edits are replaced'); the header button next to 'Order revised' does not.
- **Fix:** Wrap the header button in the same Popconfirm. *(visible: a confirmation appears)*
- **Estimate:** 0.25 h

#### U069 · P3 · correctness — The selection strip and toolbar keep the allowance seen at load after a save re-takes the order's allowance

*Cut Panel Requirement* — `src/pages/bom/cutPanel/useCprSelection.js:19; src/pages/bom/cutPanel/CprGridToolbar.jsx:20; erp/jobwork/cutpanel/service/CprService.java:99`

- **What happens:** The item's default allowance moves from 5% to 7%; after Save Draft the document says 7, but Add to Grid still creates 5% lines (each flagged WRN-04 needing a reason) and 'Apply allowance to all' is pre-filled with 5.
- **Fix:** Re-seed both from the document's allowance when it changes. *(visible: the strip shows the current allowance)*
- **Estimate:** 0.25 h

#### U070 · P3 · correctness — A GPR draft whose order is no longer eligible shows the order's numeric id

*Garment Process Requirement* — `src/pages/bom/garmentProcess/GprOrderSection.jsx:47-49; src/pages/bom/shared/RequirementOrderSelect.jsx:11-16`

- **What happens:** The order select's options are only eligible orders; a draft on an order that was later referred back, completed or cancelled shows '137' instead of ORD-0137.
- **Fix:** Add the draft's own order as a fallback option. *(visible: the order number shows)*
- **Estimate:** 0.5 h

#### U071 · P3 · correctness — "NaN" in the GPR over-quantity list

*Garment Process Requirement* — `src/pages/bom/garmentProcess/GprOverQtyReasons.jsx:26`

- **What happens:** Missing || 0: on a multi-line order whose lines use different size sets, typing a quantity into a size the colour was not ordered in lists 'Red S: 10 of NaN'.
- **Fix:** Number(order.qtyMatrix[color]?.[size] || 0). *(visible: 0 instead of NaN)*
- **Estimate:** 0.1 h

#### U072 · P3 · correctness — "Qty incl. Allowance" and the colour headers disagree with the grid's totals

*Cut Panel Requirement* — `src/pages/bom/cutPanel/CprOrderFacts.jsx:27; src/pages/bom/cutPanel/cprGridRows.js:21`

- **What happens:** The tile and headers round up once per order/colour; the grid and server round up per size. Black S=7, M=7, L=7 at 5%: header 23, lines 24.
- **Fix:** Sum per-size round-ups (or relabel). *(visible: the figures rise slightly to match the grid)*
- **Estimate:** 0.5 h

#### U073 · P3 · rule 4 — Picking a second order before the first one's details arrive can leave the first one loaded

*Cut Panel / Garment Process Requirement* — `src/pages/bom/shared/useRequirementDocument.js:47-53; src/pages/bom/cutPanel/CprHeaderSection.jsx:35; src/pages/bom/garmentProcess/GprOrderSection.jsx:48`

- **What happens:** No latest-request guard and no pending state on the select: pick A then B quickly; if A answers last the screen ends on A.
- **Fix:** Request counter, and pass the select's loading prop. *(visible: a spinner while the order loads)*
- **Estimate:** 0.5 h

#### U074 · P3 · rule 1 — Any load failure reads as "may have been deleted", with no retry

*Cut Panel / Garment Process Requirement* — `src/pages/bom/shared/useRequirementDocument.js:25-35; src/pages/bom/shared/RequirementNotFound.jsx:10-12`

- **What happens:** A timeout of the eligible-orders call on /bom/garment-process/new tells the user that a requirement they never created may have been deleted.
- **Fix:** Distinguish not-found from other failures and offer Retry. *(visible: an accurate message and a Retry button)*
- **Estimate:** 0.5 h

#### U075 · P3 · rule 34 — Dead requirement code

*Garment Process / Cut Panel utilities* — `src/utils/garmentProcessCalc.js:98-107; src/utils/cutPanelConstants.js:24-25, 34`

- **What happens:** toSavedLine has no caller (the server filters cells itself); CPR_VAL.VAL_08, VAL_10 and CPR_WRN.WRN_03 are never read.
- **Fix:** Delete them and update the API comments that cite toSavedLine. *(not visible)*
- **Estimate:** 0.25 h

## Costing

### P0

#### U076 · P0 · rule 36 — Stored XSS: the cost-sheet print writes user text unescaped into a same-origin window

*Cost sheet print and preview* — `src/utils/costingPdfGenerator.js:83-84, 504, 53-54 (used at :81, :101, :117), 466-469, 757; sinks :794-800 and src/pages/costing/CostingPdfPreviewModal.jsx:15-19`

- **What happens:** Width (Std) and Width (Vendor) are free-text sheet cells and the header sizes an unbounded list; the generator interpolates them (and the UOM and organisation fields) raw, and writes the HTML with window.open('') + document.write into a window in the app's own origin. A costing editor saves '<img src=x onerror=…>' as a width; when an approver uses Direct Print in the view (or anyone uses Print in the list), the script runs as that user and can call the API with their session. The gate fixed this class in the PO and order prints only; the CSP is report-only.
- **Fix:** Route every interpolation through printDoc.js esc/escInline (widths, sizes, UOM, all organisation fields) and drop the local esc; sandbox the preview iframe too, since fixing the preview (below) makes it a second live sink. *(not visible)*
- **Estimate:** 2 h

#### U077 · P0 · rule 36, rule 37 — Stored XSS: previewing an attachment opens the file as whatever content type the uploader declared, in the app's origin

*Costing sheet attachments and garment image* — `src/pages/costing/sheet/hooks/useAttachments.js:20-23, 51; src/pages/costing/sheet/hooks/useGarmentImage.js:20; src/components/FileUpload.jsx:306; erp/storage/service/FileStorageService.java:62, 135, 343-347; erp/storage/controller/FileStorageController.java:167`

- **What happens:** The server checks only the file extension and stores the multipart part's declared Content-Type, then serves it back; the sheet downloads the file as a blob (so the blob takes that type) and opens URL.createObjectURL(blob) in a new window, which renders in the app's origin (the garment image's 'View full size' even keeps window.opener). Any user with costing write access sends 'techpack.pdf' declared as text/html straight to the API (or through the AI-draft upload); anyone who then opens the sheet in the editor and clicks the attachment runs the script as themselves, and it can refresh their session token. The CSP is report-only.
- **Fix:** Server: serve a Content-Type from a fixed extension→MIME map (ignore the client's), with nosniff and a sandbox CSP on /files/download — this covers all 22 entity kinds that store files. Client: rebuild blobs with an allow-listed type (pdf/png/jpeg) or download them, add noopener at FileUpload.jsx:306 and ItemMaster.jsx:2406, revoke object URLs, and make the CSP enforcing. *(not visible for legitimate files)*
- **Estimate:** 4 h
- **Note:** API change (erp-purchase), released with the UI as a pair. Item Master opens variant-image blobs the same way.

### P1

#### U078 · P1 · rule 38 — The unsaved-costing draft in localStorage is shared by every user of the browser and survives logout

*Costing sheet* — `src/pages/costing/sheet/hooks/useLocalDraft.js:6, 26, 30-34; src/services/auth/sessionStore.js:178-197`

- **What happens:** One key ('costing-sheet:unsaved-new') holds the form values, rows, notes and commercials for 7 days, and logout does not remove it. User A starts a costing (rates, profit %, target) and logs out without saving; user B on the same PC opens Costing → New, sees 'You have an unsaved costing from …' and can restore A's figures and save them as their own.
- **Fix:** Key the draft by user id (and branch) so each user keeps only their own draft (as the gate kept the Preview data per the UX-parity rule). *(not visible to the same user)*
- **Estimate:** 1 h

#### U079 · P1 · correctness — Imported trims priced in USD are converted at the quote rate, so sheets not quoted in USD are mispriced

*Costing sheet* — `src/pages/costing/sheet/model/costCalculator.js:27, 35, 47; erp/costing/util/CostingCalculator.java:87-97, 131-134, 176-184`

- **What happens:** usdToCostingRate reuses the quote→costing rate unless the costing currency is USD, and the server mirrors it. An INR costing quoted in INR (a domestic buyer) adds a $0.50 zipper as ₹0.50 instead of about ₹42; quoted in EUR at 92 it converts at 92 instead of about 84 (+9%). For a USD costing quoted in EUR, the USD price is the USD total divided by 83.8. finalPriceUsd also feeds the buyer price trend.
- **Fix:** Convert imported trims with a real USD→costing rate (actualRate when quoting in USD, the stored USD→INR rate for INR costings) and compute the USD figure from it; change costCalculator.js and CostingCalculator together and decide whether existing sheets recompute on their next save. *(visible: imported-trim totals and prices change on sheets not quoted in USD)*
- **Estimate:** 5 h
- **Note:** API change (erp-purchase), released with the UI as a pair.

#### U080 · P1 · correctness — "Copy a costing" re-prices the copied rows in the sheet's old currency, then switches currency

*Costing sheet* — `src/pages/costing/sheet/start/useStartFrom.js:23-29, 43-48; src/pages/costing/sheet/model/priceRefresh.js:15`

- **What happens:** copyCosting refreshes last prices with the form's current currency before setting the source's currency (applyTemplate does it the right way round). A new sheet starts in INR; copying a USD costing writes INR PO rates (say 290) into the rows, then the sheet becomes USD, giving $290/m, and the toast reports 'N rate(s) updated'.
- **Fix:** Refresh with the source's currency, or set the header before refreshing. *(not visible beyond the corrected rates)*
- **Estimate:** 0.5 h

#### U081 · P1 · rule 1 — "Preview / PDF" never renders: an endless spinner over a blank page, and its Print button prints a blank page

*CostingView (Preview / PDF)* — `src/pages/costing/CostingPdfPreviewModal.jsx:9, 11-25, 49; src/pages/costing/CostingView.jsx:658, 856-860; node_modules/@rc-component/dialog/es/DialogWrap.js:41-50`

- **What happens:** The modal writes the document only if the iframe exists, with effect dependencies [open, costSheetData]. With destroyOnHidden, rc-dialog renders nothing on the commit where open turns true, so the effect finds no iframe, and nothing re-runs it once the iframe mounts. Every cost sheet's Preview / PDF shows a spinner forever; Direct Print still works.
- **Fix:** Build the HTML with useMemo while open and render <iframe srcDoc={html} onLoad={…} sandbox>, as the packing-list and invoice preview drawers do. *(visible: the preview shows the cost sheet)*
- **Estimate:** 1 h

#### U082 · P1 · correctness — Costing History compares every row with the wrong row, showing changes that never happened and hiding real ones

*CostingHistoryModal* — `src/pages/costing/CostingHistoryModal.jsx:64-66, 102-131, 186-192, 213, 369, 403, 415; erp/costing/service/CostSheetService.java:1116-1120, 1322-1327`

- **What happens:** Rows are matched on 'key', which snapshot rows do not have, so every row maps to undefined and is compared with the last previous row; removed rows never appear, added rows show as modified, and UOM changes are never seen ('uom' is not a snapshot field). The version badge compares raw JSON including row ids that change on every save. A sheet with 3 fabric rows submitted and approved unchanged shows 'Fabric — 2 changes' on the approval audit trail.
- **Fix:** Match rows on a stable identity (variant/process/overhead id plus sizes, with an occurrence counter), compute the badge from the same comparison, and compare uomSymbol. *(visible: only real changes are listed)*
- **Estimate:** 3 h

#### U083 · P1 · correctness — AI consumption is applied in the AI's unit to rows kept in GMS or yards (knit fabric about 1000× too low)

*Costing sheet (AI consumption calculator)* — `src/pages/costing/sheet/SheetDialogs.jsx:35-56; src/pages/costing/ConsumptionCalcModal.jsx:68-89; src/utils/uomConversions.js:90-91`

- **What happens:** The AI answers knits in 'kgs' and woven in 'meters'; the sheet warns 'applied as-is' and writes the number unchanged, then toasts success. Knit fabric is consumed in GMS by design, so 0.1363 kg lands as 0.1363 GMS and the fabric cost and FOB come out about 1000× too low; the woven calculator on a yards row is 9% off. Even KG rows get a false warning ('kgs' ≠ 'kg').
- **Fix:** Convert mass and length units before applying (or convert inside the calculator from the row's unit, as the knits calculator does), and compare with sameUom. *(visible: applied figures are in the row's unit; false warnings go)*
- **Estimate:** 2 h
- **Note:** The BOM form applies the same calculator's result without any unit check (see BOM).

#### U084 · P1 · correctness — BOM import drops each line's unit ids and conversion factor, so imported rows are priced unconverted and saved with no UOM

*BOM import into a cost sheet* — `src/pages/costing/BomImportModal.jsx:35-62; src/pages/costing/sheet/SheetDialogs.jsx:65-71; src/pages/costing/sheet/model/rowFactory.js:89-98; erp/costing/service/CostSheetService.java:1132-1134`

- **What happens:** Imported rows carry the consumption and the unit text only. A knit line of 250 GMS per garment bought per kg, priced at ₹600/kg, costs ₹1,50,000 per garment instead of ₹150; thread at 150 MTR per garment bought per ₹75 cone costs ₹11,250 instead of ₹2.25. The saved rows have no UOM. Only re-picking each variant repairs a row.
- **Fix:** Resolve each line's variant through the sheet's variant options (or carry purchaseUom, uomConversionFactor and the UOM ids). *(visible: imported rows show units and correct prices)*
- **Estimate:** 3 h

### P2

#### U085 · P2 · rule 1, rule 2 — A failed save step inside Submit (or Save as Draft on a submitted sheet) shows no message at all

*Costing sheet* — `src/pages/costing/sheet/hooks/useSheetPersist.js:52, 59-60; src/services/costing/costingService.js:116; src/pages/costing/sheet/hooks/useSheetSave.js:45-47, 78-80`

- **What happens:** The save that precedes the submit command (and the save after a withdraw) is sent as a silent autosave, so the interceptor does not toast, and the catch blocks are empty because they assume it did. A 400, 403 or the width-overflow 409 below makes Submit spin and stop with no reason; autosave later pauses, also without a reason.
- **Fix:** Send those saves without silent (keep the autosave flag), or toast errorText(e) in these catches when e.config.silent is set. *(visible: an error toast appears)*
- **Estimate:** 1 h

#### U086 · P2 · rule 1, rule 5 — The save queue lets two waiting saves run at once, raising a self-inflicted conflict dialog

*Costing sheet* — `src/pages/costing/sheet/hooks/useSheetPersist.js:29-30, 41, 70-75; src/pages/costing/sheet/hooks/useSheetShortcuts.js:19-22; src/pages/costing/sheet/hooks/useSheetSave.js:17-34`

- **What happens:** Every caller that arrives during a save awaits the same promise, then all run together with the same version. Pressing Ctrl+S twice (or holding it; there is no e.repeat check and no busy guard) during an autosave sends two saves; one gets 409 and the dialog says 'Your changes could not be saved'. Choosing Reload loses anything typed since.
- **Fix:** Chain saves properly (each awaits the previous one), ignore repeated keydowns and return early from saveDraft while busy. *(not visible)*
- **Estimate:** 1 h

#### U087 · P2 · rule 8 — After the first Save as Draft, edits typed during the save have no leave-page protection

*Costing sheet* — `src/pages/costing/sheet/hooks/useSheetSave.js:40-44; src/hooks/useUnsavedChanges.jsx:24-29`

- **What happens:** clearDirty forces the guard off; edits typed during the first save keep the sheet dirty, so isDirty never changes and the guard is not re-armed. The user saves with a tech pack attached, fixes a consumption while uploads run, and clicks back within the 4-second autosave delay: no prompt, and the fix is lost.
- **Fix:** Re-arm the guard after the navigation (sync its ref on every render). *(visible: the leave prompt appears in that window)*
- **Estimate:** 1 h

#### U088 · P2 · correctness — Undo restores rows but not the header a template, copy, AI or Genie batch changed

*Costing sheet* — `src/pages/costing/sheet/model/sheetReducer.js:32, 82-85; src/pages/costing/sheet/start/useStartFrom.js:33, 47; src/pages/costing/sheet/ai/useDraftApply.js:29-41; src/pages/costing/sheet/genie/useCostingGenieActions.js:118-137`

- **What happens:** The undo snapshot holds sections, notes and commercials only. On an INR sheet the user applies a template saved from a USD sheet and clicks Undo: the INR rows come back but the sheet stays in USD, so every rupee rate is priced as dollars. The tooltip promises 'Undo the last import, template or delete'.
- **Fix:** Snapshot the header fields a batch changes and restore them on Undo. *(visible: Undo also reverts the header)*
- **Estimate:** 2.5 h

#### U089 · P2 · rule 1 — Submit on a revised (Final) sheet with edits fails with "cannot be edited"

*Costing sheet* — `src/pages/costing/sheet/hooks/useSheetPersist.js:43-61; erp/costing/service/CostSheetService.java:183-216; src/pages/costing/CostingList.jsx:380-385`

- **What happens:** Revise opens a Final sheet as editable; on Submit no withdraw runs and a plain update is sent, which the server refuses because data may change only on Draft/Rejected sheets. The user gets a 409 toast; only Save as Draft followed by Submit works, despite the banner saying saving reverts it.
- **Fix:** Treat Submit on a Final sheet as withdraw → save → submit. *(visible: Submit works)*
- **Estimate:** 1.5 h

#### U090 · P2 · correctness — "One costing per style" is enforced only on create

*Costing sheet (API)* — `erp/costing/service/CostSheetService.java:154-160, 1087-1088; src/pages/costing/sheet/header/BuyerStyleFields.jsx:56-65`

- **What happens:** The check runs only when creating, there is no unique index, and the Style picker stays enabled on a saved sheet. Changing a draft's style to one that already has an approved costing is autosaved within 4 s, leaving two live costings for one style (also reachable via AI header picks, the Genie and Restore).
- **Fix:** Run the same check on update when the style changes, excluding the sheet itself. *(visible: a refusal on that change)*
- **Estimate:** 1.5 h
- **Note:** API change (erp-purchase).

#### U091 · P2 · rule 1 — Text cells allow 500 characters but the columns hold 20/50/100, and the failure names no field

*Costing sheet* — `src/pages/costing/sheet/grid/GridCell.jsx:45; src/pages/costing/sheet/model/sectionConfig.js:15-16, 39-40; db/migration/V4__costing.sql:42-43, 106-107, 137-138`

- **What happens:** Width (Std) '58" (147cm) cuttable' is 21 characters against varchar(20): Save as Draft shows 'Data integrity violation. A referenced record does not exist or is still in use.' with no field named, autosave pauses, and Submit fails silently (finding above).
- **Fix:** Set maxLength per field (20, 50, 100) and add @Size on the DTOs. *(visible: those inputs stop at the column length)*
- **Estimate:** 0.5 h

#### U092 · P2 · rule 5 — An ignored "unsaved costing" banner stays on the saved sheet, and Restore overwrites the saved record

*Costing sheet* — `src/pages/costing/sheet/hooks/useLocalDraft.js:26, 38-48; src/pages/costing/sheet/CostingSheetPage.jsx:44-48`

- **What happens:** clear() removes the stored draft but never resets the offer, and the banner renders regardless of isNew. A user ignores a leftover banner, builds and saves a new costing, later clicks Restore: the saved costing's buyer, style and rows are replaced and autosaved within 4 s, and Undo cannot bring the header back.
- **Fix:** clear: remove() and setOffer(null); show the banner only on a new sheet. *(visible: the banner goes after the first save)*
- **Estimate:** 0.25 h

#### U093 · P2 · rule 13, rule 37 — A microphone that starts after the AI dialog closes (or a double-click) records the room for five minutes and uploads it

*Costing sheet (voice capture)* — `src/hooks/useWavRecorder.js:41-47, 76-117; src/pages/costing/sheet/ai/VoiceRecorder.jsx:13, 25-26; src/pages/costing/sheet/ai/useAiCapture.js:15, 23`

- **What happens:** start() creates the recorder after `await getUserMedia` with no cancel token, and the session is set only afterwards, so the button stays clickable. A slow microphone start (or a double-click) leaves a recorder the unmount cleanup and Stop never see; at 300 s it hands the audio to the AI upload, the server keeps it, and a review drawer pops up.
- **Fix:** A cancel token checked after getUserMedia, stopping the tracks if unmounted, and a 'starting' state that disables the button. *(not visible)*
- **Estimate:** 1 h

#### U094 · P2 · correctness — Replacing the garment image deletes the old one before uploading, so a failed upload loses it

*Costing sheet (garment image)* — `src/pages/costing/sheet/hooks/useGarmentImage.js:26-43`

- **What happens:** The old file is deleted first; if the upload is then refused (e.g. a .jfif photo, accepted by the picker as image/jpeg but rejected by the server's extension list), the card keeps showing the new picture and after a reload the sheet has no garment image.
- **Fix:** Upload first and delete the old file only after success; restore the old preview on failure. *(visible: the old image survives a failed replace)*
- **Estimate:** 0.5 h

#### U095 · P2 · correctness — Attachments added to a submitted or approved sheet are stored at once, with no withdraw and no history

*Costing sheet (attachments)* — `src/pages/costing/sheet/hooks/useAttachments.js:52-55, 63-73; erp/storage/service/FileAccessPolicy.java:113-116`

- **What happens:** On a saved sheet each dropped file uploads immediately and the file policy ignores the sheet's status. Revising a Final sheet and dropping a new tech pack changes what the pending approval sees, without the withdraw that row edits trigger; the same holds on an Approved sheet opened by URL.
- **Fix:** Stage attachments on non-Draft sheets until the save that withdraws them (or refuse uploads outside Draft/Rejected on the server). *(visible: attachments upload with the next save on submitted sheets)*
- **Estimate:** 1.5 h

#### U096 · P2 · correctness — The cost-sheet print shows a fixed 83.80 USD→INR rate, labels the total INR whatever the currency, and omits costing type and pricing unit

*Cost sheet print* — `src/utils/costingPdfGenerator.js:481-526 (esp. 522-525), 711-714`

- **What happens:** The response has no usdToInrRate, so the print always shows 83.80 whatever rate the server used; 'Total Price (INR) ₹' prints totalPrice even for a USD-costed sheet; a per-dozen sheet prints '$ 42.00' with no unit, and a CMT sheet's lines do not add up with no explanation.
- **Fix:** Print the rate as totalPrice ÷ finalPriceUsd (or add it to the API), label with cs.currency, and add Costing Type and Pricing Unit cells. *(visible: those cells and labels)*
- **Estimate:** 1 h

#### U097 · P2 · rule 4 — The knits calculator wipes the parts being typed whenever the sheet re-renders (autosave, price lookup)

*Knits consumption calculator* — `src/pages/costing/KnitsConsumptionModal.jsx:37-48; src/pages/costing/sheet/SheetDialogs.jsx:81-82; src/pages/costing/sheet/CostingSheetContext.jsx:97-102`

- **What happens:** The modal resets its parts whenever initialParts changes, and the caller passes a new [] on every render for a row with no saved parts. Pick a knit fabric and open the calculator: when autosave fires 4 s later, or the price lookup lands, the table snaps back to five blank default parts.
- **Fix:** Seed the parts only when the dialog opens (read initialParts through a ref, or pass a constant empty array). *(not visible)*
- **Estimate:** 0.5 h

#### U098 · P2 · rule 4 — Cost sheet list: an older search response can overwrite a newer one

*CostingList* — `src/pages/costing/CostingList.jsx:73-108, 119-123`

- **What happens:** No request sequencing, and the search response is heavy (it embeds history, below). Open the list unfiltered and pick Status = Final before it returns: the light Final response lands first and the unfiltered one overwrites it, so Draft and Approved sheets show under 'Final'.
- **Fix:** Drop stale responses with a latest-request ref, or move the list onto useServerList. *(not visible)*
- **Estimate:** 0.5 h

#### U099 · P2 · rule 6 — Cost sheet list: state is lost on return, ties page unstably, and a cleared sort keeps sorting

*CostingList* — `src/pages/costing/CostingList.jsx:46-59, 125-131; src/pages/costing/CostingView.jsx:639; erp/costing/service/CostSheetService.java:680-684`

- **What happens:** Filter by buyer and Final, go to page 3, open and approve a sheet, click Back: page 1 with no filters. Thirty sheets dated 12-Oct sorted by date repeat one sheet on two pages (no id tie-breaker); clearing the date sort leaves the data date-sorted with no way back to newest-first.
- **Fix:** Keep list state in the URL (WS7), add the id tie-breaker (A1), and reset to id/desc when sorter.order is undefined. *(visible: the list returns as left; a cleared sort returns to newest-first)*
- **Estimate:** 2.5 h

#### U100 · P2 · rule 17 — Search and get-by-id responses embed every version snapshot of every sheet

*Cost sheet API (search, get by id)* — `erp/costing/service/CostSheetService.java:642, 692-694, 1404-1407`

- **What happens:** toResponse adds the full history (each entry a whole sheet snapshot) and search maps every row through it, with one extra query per row; the UI never reads history from these responses. A 25-row page of sheets with 4-6 versions each carries megabytes and grows with every approval cycle.
- **Fix:** Build list and view responses without history (check first that the owner app does not read it). *(not visible)*
- **Estimate:** 1 h
- **Note:** API change (erp-purchase).

#### U101 · P2 · correctness — "Apply lining avg" writes the lining figure into the row the calculator was opened from, usually the shell

*AI consumption calculator* — `src/pages/costing/ConsumptionCalcModal.jsx:82-89, 235-249, 449-468; src/pages/costing/sheet/SheetDialogs.jsx:26-28`

- **What happens:** The result says to add a lining row and apply its consumption, right above 'Apply lining avg'; the button updates the row the dialog was opened for, and the result step never names it. Following the instruction replaces the shell fabric's consumption with the lining's.
- **Fix:** Name the target row in the result and on the buttons, and tell users to open the calculator from the lining row. *(visible: wording and labels)*
- **Estimate:** 0.5 h

#### U102 · P2 · rule 1 — The AI consumption call gives up at 60 s while the server waits up to 150 s

*AI consumption calculator* — `src/services/costing/costingService.js:286-291; src/services/core/axiosInstance.js:13, 236-249; src/services/costing/costingAiService.js:3-4`

- **What happens:** The upload helper uses the default 60-second timeout; the sibling AI call uses 180 s. A chart plus a long tech pack answered at 75 s is shown as 'Network error' plus 'AI calculation failed', and a retry hits the same wall.
- **Fix:** Pass a 180-second timeout for this call. *(not visible)*
- **Estimate:** 0.25 h

#### U103 · P2 · correctness — The cost sheet view hides the section notes, target price and attachments an approver needs

*CostingView* — `src/pages/costing/CostingView.jsx:378-633; src/pages/costing/sheet/model/payloadMapper.js:50-54; src/services/costing/costingService.js:323-326`

- **What happens:** The sheet saves fabric/trims/manufacturing/overhead notes, a target price and attachments, but the view renders none of them. The approver opening /costing/:id?action=approve never sees 'rate per mill quote 10-Oct, 3% shrinkage included' or the tech pack.
- **Fix:** Render non-empty notes under their sections, the target price, and a read-only attachments list. *(visible: new read-only blocks)*
- **Estimate:** 2.5 h

#### U104 · P2 · rule 2 — Printing silently does nothing when the pop-up is blocked

*Cost sheet print* — `src/utils/costingPdfGenerator.js:794-798; src/pages/costing/CostingList.jsx:172-182`

- **What happens:** A blocked window.open only logs to the console; the list opens the window after awaiting the fetch, outside the click's activation on a slow connection or in Safari, so the print icon spins and nothing appears.
- **Fix:** Report a blocked pop-up (printDoc.openPrintWindow returns false for this) and open the window inside the click before awaiting. *(visible: a warning when blocked)*
- **Estimate:** 1 h

### P3

#### U105 · P3 · rule 1 — Autosave, once paused, never resumes and its warning stays on

*Costing sheet* — `src/pages/costing/sheet/hooks/useDraftAutosave.js:15, 25-27; src/pages/costing/sheet/header/SheetActions.jsx:11-14`

- **What happens:** One 502 during a deploy turns autosave off for the rest of the visit, and 'Autosave paused — use Save as Draft' stays even after a successful manual save.
- **Fix:** Reset the phase after any successful save. *(visible: the label clears and autosave resumes)*
- **Estimate:** 0.5 h

#### U106 · P3 · rule 13, rule 14 — Every keystroke re-renders every cell of every section

*Costing sheet* — `src/pages/costing/sheet/CostingSheetContext.jsx:97-102; src/pages/costing/sheet/grid/GridCell.jsx:12`

- **What happens:** The provider value is new each render and every cell consumes it, so each edit re-renders all five grids and the price panel (about 200 inputs on a 40-row sheet). Memoising the value alone will not help because sheet and totals change per keystroke.
- **Fix:** Profile first (WS17); then split stable actions/masters from volatile state, or pass row data as props. *(not visible)*
- **Estimate:** 4 h

#### U107 · P3 · rule 1 — Multi-file picks bypass the AI capture limits, and a partly failed attachment batch re-uploads the rest on every save

*Costing sheet (AI capture, attachments)* — `src/pages/costing/sheet/ai/AiCaptureModal.jsx:42-49, 74; src/pages/costing/sheet/hooks/useAttachments.js:39-44; src/pages/costing/sheet/header/AttachmentsPanel.jsx:46`

- **What happens:** beforeUpload runs for every picked file before a re-render, so picking 8 photos passes the 5-file / 18 MB checks and the AI read times out. On a new sheet, if one staged file is refused, load() is skipped and the stored ones stay 'staged', so each later save stores another copy. The hint says 'uploaded on save' although saved sheets upload immediately, and the per-category accept lists are never passed to the picker.
- **Fix:** Count with the file-list argument or a ref; reload after a partial batch; correct the hint and pass accept. *(visible: limit messages appear; the hint changes)*
- **Estimate:** 1 h

#### U108 · P3 · correctness — The past-prices popover shows ₹ for a EUR or GBP costing price

*Costing sheet* — `src/pages/costing/sheet/grid/PastPriceList.jsx:23`

- **What happens:** `currency === 'USD' ? '$' : '₹'` labels a 3.20 EUR price as '₹ 3.20 · Last costed' (the Use button is gated correctly).
- **Fix:** getCurrencySymbol(costing.currency). *(visible: € / £)*
- **Estimate:** 0.25 h

#### U109 · P3 · rule 34 — Dead code in the costing sheet

*Costing sheet* — `src/pages/costing/sheet/model/sheetReducer.js:103-104; src/pages/costing/sheet/model/sectionConfig.js:111-118`

- **What happens:** CLEAR_HIGHLIGHT is never dispatched and SECTION_NOTE is never imported.
- **Fix:** Delete both. *(not visible)*
- **Estimate:** 0.25 h

#### U110 · P3 · rule 2 — Duplicate catch-block toasts in the costing sheet

*Costing sheet hooks* — `src/pages/costing/sheet/hooks/useSheetLoader.js:31; src/pages/costing/sheet/hooks/useAttachments.js:43, 50, 51, 54, 70; src/pages/costing/sheet/hooks/useGarmentImage.js:41, 47`

- **What happens:** Each toasts after a non-silent axios failure the interceptor already toasted ('Cost sheet with id 999 not found' plus 'Failed to load cost sheet'). useGarmentImage.js:57 ('Cost sheet saved, but the garment image upload failed') adds real information and should stay.
- **Fix:** toastUnlessHandled (WS7). *(visible: one toast)*
- **Estimate:** 0.5 h

#### U111 · P3 · rule 7 — "Save as template" fields never reset, and the closing dialog flashes the Load view

*Costing templates* — `src/pages/costing/CostingTemplateModal.jsx:83-96; src/pages/costing/sheet/SheetDialogs.jsx:87`

- **What happens:** The reset lives in the save-mode modal's afterClose, but closing flips the mode to 'load' in the same render, so the reused modal loses it: the next 'Save as template' opens with the previous name and saving creates a duplicate.
- **Fix:** Reset when the dialog opens in save mode (or latch the mode until afterClose). *(visible: fields open empty; no flash)*
- **Estimate:** 0.5 h

#### U112 · P3 · correctness — Comparison and price-trend figures mix currencies and per-dozen with per-piece prices

*CostComparison, BuyerPriceTrendModal* — `src/pages/costing/CostComparison.jsx:77-97, 273-277; src/pages/costing/BuyerPriceTrendModal.jsx:24-31; erp/costing/service/CostSheetService.java:1734-1748`

- **What happens:** €3.10 vs $3.50: the euro sheet is marked 'Lowest value' though it is dearer; a buyer with one $42/dozen sheet shows 'Highest FOB $42.00'.
- **Fix:** Highlight only like-for-like currencies and units (or compare USD per piece); add pricingUnit to the trend. *(visible)*
- **Estimate:** 1 h

#### U113 · P3 · correctness — Knits "Apply" with an empty table overwrites the row's consumption with 0

*Knits consumption calculator* — `src/pages/costing/KnitsConsumptionModal.jsx:99-101, 227-234; src/pages/costing/sheet/SheetDialogs.jsx:30-33`

- **What happens:** Apply is always enabled; opening the calculator on a row with 180 GMS typed by hand and clicking Apply sets the fabric cost to 0 (the woven calculator disables Apply at 0).
- **Fix:** Disable Apply while the total is 0. *(visible: Apply greyed while empty)*
- **Estimate:** 0.1 h

#### U114 · P3 · correctness — History is hidden for Draft and Rejected sheets that have versions

*CostingList* — `src/pages/costing/CostingList.jsx:402-407; erp/costing/service/CostSheetService.java:353, 529, 600, 708-717`

- **What happens:** The list offers History only for Approved/Final, though history is written on reject, revert and withdraw; the reverted or rejected version cannot be inspected until resubmission.
- **Fix:** Show History for every status except a never-submitted draft. *(visible)*
- **Estimate:** 0.25 h

#### U115 · P3 · rule 7 — Cost sheet view tables are keyed on a key field the rows do not have

*CostingView* — `src/pages/costing/CostingView.jsx:424, 451, 463, 489, 512`

- **What happens:** rowKey="key" while rows carry id only, so every view logs React's unique-key warning.
- **Fix:** rowKey="id". *(not visible)*
- **Estimate:** 0.1 h

#### U116 · P3 · rule 34 — Dead costing code, including a mock costing-number generator

*Costing services and constants* — `src/services/costing/costingService.js:354-357; src/utils/costingConstants.js:36-41, 46-51, 100-172, 215-225`

- **What happens:** getScenarios has no caller (the endpoint stays), and STATUS_TRANSITIONS, STATUS_COLORS, FABRIC_TYPES, LOCAL_TRIM_ITEMS, IMPORTED_TRIM_ITEMS, MANUFACTURING_PROCESSES, OVERHEAD_CATEGORIES and generateCostingId (`let costingCounter = 1004`) have no importers.
- **Fix:** Delete them. *(not visible)*
- **Estimate:** 0.5 h

#### U117 · P3 · rule 4 — Costing fetch effects have no stale-response guard

*Costing view and modals* — `src/pages/costing/CostingView.jsx:115-130; src/pages/costing/CostingHistoryModal.jsx:145-165; src/pages/costing/CostComparison.jsx:53-69; src/pages/costing/BuyerPriceTrendModal.jsx:14-22; src/pages/costing/BomImportModal.jsx:14-23; src/pages/costing/CostingTemplateModal.jsx:22-30`

- **What happens:** Timing-dependent: /costing/A → /costing/B before A answers leaves A's data under B's URL (actions use B's id); on a failed fetch the BOM import keeps the previous style's BOMs listed and importable.
- **Fix:** Ignore flags or latest-request refs; clear lists before refetching. *(not visible)*
- **Estimate:** 1.5 h

#### U118 · P3 · rule 2 — Duplicate catch-block toasts in the costing list, view and modals

*Costing view, list and modals* — `src/pages/costing/CostingView.jsx:125, 139, 152, 171, 185, 204; src/pages/costing/CostingList.jsx:102, 140, 153, 178; src/pages/costing/CostComparison.jsx:49, 65; src/pages/costing/ConsumptionCalcModal.jsx:61; src/pages/costing/CostingTemplateModal.jsx:27, 44, 61; src/pages/costing/BomImportModal.jsx:20; src/pages/costing/BuyerPriceTrendModal.jsx:19`

- **What happens:** Each toasts after an axios failure the interceptor already toasted; a version conflict on revise also stacks a toast on the conflict dialog.
- **Fix:** toastUnlessHandled (WS7). *(visible: one toast)*
- **Estimate:** 1 h

#### U119 · P3 · rule 14 — Un-memoised columns in the costing view and modals

*Costing view and modals* — `src/pages/costing/CostingView.jsx:316-371; src/pages/costing/ConsumptionCalcModal.jsx:123-198; src/pages/costing/KnitsConsumptionModal.jsx:103-217; src/pages/costing/CostingTemplateModal.jsx:67-81; src/pages/costing/BomImportModal.jsx:69-74; src/pages/costing/BuyerPriceTrendModal.jsx:33-63; src/pages/costing/sheet/start/CopyCostingDrawer.jsx:36-43`

- **What happens:** Inline columns are rebuilt every render (every keystroke in the knits calculator); negligible on these small tables.
- **Fix:** useMemo or module factories (WS6). *(not visible)*
- **Estimate:** 1 h

#### U120 · P3 · rule 33 — Accessibility: clickable div and Tag without role or keyboard, and unlabeled controls

*Costing history, BOM import, view and modals* — `src/pages/costing/CostingHistoryModal.jsx:544-554; src/pages/costing/BomImportModal.jsx:97-105; src/pages/costing/CostingView.jsx:796-805, 877-884; src/pages/costing/CostComparison.jsx:170-186; src/pages/costing/WovenConsumptionModal.jsx:71-95; src/pages/costing/CostingTemplateModal.jsx:99-107; src/pages/costing/KnitsConsumptionModal.jsx:114-200`

- **What happens:** A keyboard user cannot pick a history version or a BOM to import (so 'Import Selected BOM' stays disabled); several inputs have no id, name or label.
- **Fix:** Use buttons (or role, tabIndex and Enter handling) and add ids/aria-labels. *(visible: focus rings only)*
- **Estimate:** 1 h

## Purchase orders (supplier, production and job-work POs)

### P1

#### U121 · P1 · correctness — Every inter-state (IGST) PO prints 0% tax on its lines under "CGST + SGST" while its grand total includes IGST

*Supplier PO print* — `src/utils/poPdfGenerator.js:104, 119-127, 223-225, 702; erp/purchaseorder/dto/PurchaseOrderDTO.java; erp/purchaseorder/dto/PoLineItemDTO.java:41-46; src/pages/po/POForm.jsx:1376-1378`

- **What happens:** The print decides IGST from po.isIgstApplicable || po.igstApplicable, but the PO DTO has no such field, so it is always false; IGST lines are stored with cgst = sgst = 0 and igst = 5, so each line's tax is computed as 0% and the tax type prints 'CGST + SGST', while the grand total (from the server) includes the IGST. The supplier receives a document whose lines and totals do not add up. An earlier review note had cleared this on the assumption that the flag was persisted on the DTO; it is not. (POView itself avoids it with a line-level fallback.)
- **Fix:** Derive IGST in the print from the lines (any line with igst > 0, as POView does) or add isIgstApplicable to PurchaseOrderDTO. *(visible: IGST POs print IGST per line and as the tax type)*
- **Estimate:** 1 h

#### U122 · P1 · rule 5 — Every PO edit deletes and re-creates all its lines, so a referred-back General PO with order mappings can never be saved

*POForm* — `src/pages/po/POForm.jsx:582-612, 1389-1413; erp/purchaseorder/service/PurchaseOrderService.java:483-491, 510, 566-568; db/migration/V20260909130000__po_order_mapping.sql:63-64`

- **What happens:** The form never sends line ids, so the server deletes every line and inserts new ones (and skips its mapped-quantity guard). A General PO is approved, a merchandiser maps 300 kg of its fabric line to an order, then the PO is referred back to fix the delivery date: the edit's save hits the ON DELETE RESTRICT mapping key and the user sees 'Data integrity violation…' plus 'Failed to submit purchase order', with nothing pointing at the mappings. On every other PO each save silently replaces every line id.
- **Fix:** Keep id when mapping loaded lines and send it in buildPayload (the server already updates lines by id); optionally add a constraint message naming Order Mapping. *(not visible)*
- **Estimate:** 2 h

#### U123 · P1 · correctness — Re-opening "Select BOM Lines" rebuilds every BOM line, wiping typed prices, GST %, edited quantities, descriptions and fabric stages

*POForm, BomLineSelectionDrawer* — `src/pages/po/BomLineSelectionDrawer.jsx:129-144, 236-247; src/pages/po/POForm.jsx:962-994, 1063, 1243-1246, 2058`

- **What happens:** The drawer pre-ticks the existing lines and returns all ticked lines; the form builds each from scratch (BOM quantity, blank price, 0% GST, no stages) and replaces the whole list. The buyer re-opens the drawer to add a sixth trims line: all six come back blank at 0% GST and full BOM quantity. Submit flags the blank prices, but the 0% GST and restored quantities pass. BOM lines have no delete button, so the drawer is the only way to add or remove one.
- **Fix:** Merge instead of replace: keep existing lines (id, price, GST, qty, description, stages) while their BOM sources stay ticked, add only new ones, drop unticked ones. *(visible: existing lines keep their entered values)*
- **Estimate:** 3 h

#### U124 · P1 · correctness — BOM-sourced PO lines are saved with no unit, because the UOM list they are matched against is never loaded on this screen

*POForm* — `src/pages/po/POForm.jsx:362, 950-960, 976; src/context/StoreContext.jsx:18; src/pages/master/MasterDashboard.jsx:494-498; erp/purchaseorder/service/PurchaseOrderService.java:611-615`

- **What happens:** The line's uomId is resolved from the store's 'uoms', which only the Master Data dashboard ever loads; the server sets the unit only from uomId. Create a Regular PO from a BOM in a normal session: the Qty cell shows 'KG', but the stored line has no unit, so the PO view, PDF and GRN show a blank unit (the e2e notes record it as bug B-030).
- **Fix:** Load the UOMs on POForm mount when the store is empty, and refuse or flag a BOM line whose unit symbol matches no UOM. *(not visible (units are stored))*
- **Estimate:** 1.5 h

#### U125 · P1 · rule 4 — The Order Mapping workspace snaps back to page 1 on every page change

*PO → Order Mapping workspace* — `src/pages/po/order-mapping/PoOrderMappingWorkspace.jsx:39-65`

- **What happens:** handleTableChange always sets a new sort object, which re-creates fetchData, which re-fires the effect fetchData(1) right after the page-2 request; the two race and page 1 usually wins. With more than 10 mappable POs, pages 2+ are reachable only by raising the page size or searching.
- **Fix:** Set sort only when it changed and drive reloads from the filter values, not fetchData's identity. *(not visible (paging works))*
- **Estimate:** 1 h

#### U126 · P1 · rule 4 — Switching the working branch leaves the previous branch's POs on the Supplier PO list

*POList* — `src/pages/po/POList.jsx:137, 141-144; src/context/BranchContext.jsx:47-58`

- **What happens:** fetchData lists activeBranchId among its dependencies, but the only effect that calls it depends on the filters alone, and nothing remounts the list. A user on 'All branches' picks Tiruppur: the other branches' rows and total stay until they page, filter or refresh. In a fresh browser the first search can also go out before the home branch is written.
- **Fix:** Add activeBranchId to the effect (it already restarts at page 1). *(visible: the list reloads on a branch change)*
- **Estimate:** 0.25 h

#### U127 · P1 · correctness — Multi-fabric BOMs: the first fabric's CAD per piece is applied to every fabric line (requirement, variance and the reservation at approval)

*Cutting PO* — `src/pages/po/cutting/CuttingPoForm.jsx:74, 84, 135, 144, 171; erp/production/common/service/ProductionStockAssembler.java:112; erp/production/cutting/service/CuttingPoService.java:331-336`

- **What happens:** The form sends and stores only consumption[0]'s CAD, and the server applies that one value to every fabric line. A polo with body fabric (250 g/pc) and rib (30 g/pc), 1,030 pcs: the rib's CAD requirement shows about 257 kg instead of about 31 kg (a false shortage), a corrected rib CAD is ignored and dropped on save, reopening shows +733% variance with a red banner, and approval reserves about 257 kg of rib.
- **Fix:** Store CAD per BOM line and use each line's own CAD (falling back to its BOM figure) in stock-by-bom and allocateFabric; interim UI-only fix: send cadPerPc only when the BOM has one fabric line. *(visible: per-fabric requirement and variance become correct)*
- **Estimate:** 6 h
- **Note:** API change (erp-purchase) for the full fix.

#### U128 · P1 · correctness — The stock tabs replace the server's reservation-aware figures with their own, so shortages from other POs' reservations are hidden

*Cutting PO, Work Order* — `src/pages/po/cutting/CuttingPoForm.jsx:30-34, 280; src/pages/po/workorder/WorkOrderForm.jsx:28-32, 267; erp/production/common/service/ProductionStockAssembler.java:125-150`

- **What happens:** normFabricStock/normTrimStock overwrite allocated, availableBalance and shortageSurplus with this PO's own requirement, and make Allocated an input that is never saved. 1,000 kg on hand, 800 kg reserved by another order's approved PO, this PO needs 400 kg: the server says available 200, short 200; the form shows Allocated 400 / Available 600 / ▲600, no banner and no shortage line in the submit confirm.
- **Fix:** Render the server's allocated/available/shortage unchanged and make Allocated read-only. *(visible: the three columns show the server's figures; Allocated is no longer editable)*
- **Estimate:** 1.5 h

#### U129 · P1 · correctness — The Finishing PO wizard always sends all four processes, so an order with a live Finishing PO can never get another

*Finishing PO wizard* — `src/pages/po/finishing/FinishingPoGenerateWizard.jsx:17, 80-86; src/pages/po/finishing/ProcessAssignmentTable.jsx:28-35; erp/production/finishing/service/FinishingPoGenerateService.java:83-95`

- **What happens:** Every process is either In-house or Outsource (no 'not needed'), and the server refuses any process already covered by a live Finishing PO. FPO-1 (in-house Trimming + Checking) is live and FPO-2 (vendor V1, Ironing + Packing) was cancelled: regenerating Ironing + Packing for V2 also sends Trimming and Checking and is refused 'already covered'.
- **Fix:** Add a 'Not needed' choice whose rows are left out, and pre-mark processes already covered by the order's live FPOs (getFinishingPosByOrder exists, unused). *(visible: a third option and covered processes marked)*
- **Estimate:** 3 h

#### U130 · P1 · correctness — Editing a Cutting PO without opening "Consumption & Marker" wipes its marker efficiency and marker file

*Cutting PO* — `src/pages/po/cutting/CuttingPoForm.jsx:95, 172, 178, 273-278; erp/production/cutting/mapper/CuttingPoMapper.java:33`

- **What happens:** The tab has no forceRender, so its fields are not registered until opened; validateFields() then omits them, the payload sends undefined and the mapper nulls the stored values. A PO with marker efficiency 86.5%: Edit, change the cut date, Save Draft — the efficiency and marker reference are gone from the view and print. FinishingPoForm documents the same trap and uses forceRender.
- **Fix:** Add forceRender: true to the Consumption & Marker tab. *(not visible)*
- **Estimate:** 0.5 h

#### U131 · P1 · correctness — Finishing PO "PO Value" is ₹0.00 on every list row, and the matrix shows Rate/Pc 0.00

*Finishing PO list* — `src/pages/po/finishing/FinishingPoList.jsx:26, 96; erp/production/finishing/mapper/FinishingPoMapper.java:26; src/pages/po/components/ProductionPoView.jsx:130; src/pages/po/finishing/FinishingPoForm.jsx:138`

- **What happens:** The list multiplies each item's ratePerPiece, which the API deliberately never fills (finishing items carry no per-row rate). Every Finishing PO shows ₹0.00 in the list while its view says ₹45,000.00; its matrix tab totals 0.00.
- **Fix:** Compute the value as totalPlannedQty × vendorRate (as the view and print do) and feed the matrix the header rate (or hide its rate columns). *(visible: real values)*
- **Estimate:** 0.5 h

#### U132 · P1 · rule 36 — The production PO print writes the organisation address unescaped into a same-origin window

*Cutting / Finishing PO print* — `src/utils/productionPoPdfGenerator.js:68, 94, 122-124`

- **What happens:** The company name and GSTIN are escaped but the address lines are joined raw with <br>. Someone who can edit the company profile saves an address containing '<img src=x onerror=…>', and every user who prints a Cutting or Finishing PO runs it in the app's origin. Planting it needs company-profile rights, which keeps it below P0.
- **Fix:** Escape each address part before joining (as poPdfGenerator does). *(not visible)*
- **Estimate:** 0.5 h

#### U133 · P1 · rule 5 — When "Submit amendment" is refused, the screen keeps a stale version, so the next save raises a false conflict

*Cut Panel PO* — `src/pages/po/cutPanelPo/useCppFlowActions.js:12-15, 24-27; erp/jobwork/cutpanel/service/CppAmendmentService.java:66, 87, 96-97`

- **What happens:** submitRev saves the amendment (new version) and then submits; if the submit is refused (422, e.g. a late delivery date without a reason), the saved record is thrown away and the screen keeps the old version. The user types the reason and clicks Submit amendment again: the conflict dialog says someone else changed the PO, though it was the user's own save, and only a reload (which drops the reason) gets out.
- **Fix:** Take the intermediate save into state (dispatch SAVED, clearDirty) before submitting it. *(not visible)*
- **Estimate:** 1 h

#### U134 · P1 · correctness — "Print vendor copy" prints an open, unapproved amendment (and unsaved edits) under the live PO number

*Cut Panel PO* — `src/pages/po/cutPanelPo/useCppHandlers.js:53-56; src/pages/po/cutPanelPo/useCppView.js:40-42; src/utils/jobWorkPoPrint.js:37`

- **What happens:** The screen prints view.working, the PO merged with the open amendment, under the live revision number and status, while printing from the list prints the live record. A Sent-to-Vendor CPP with amendment R1 drafted (rate ₹12→₹15, qty 500→600) prints 600 pcs at ₹15 from the screen and 500 at ₹12 from the list; the job worker can get a copy that was never approved.
- **Fix:** Print the saved, approved record (fetch it and print it as the list does). *(visible: the screen's copy matches the list's while an amendment is open)*
- **Estimate:** 1 h

### P2

#### U135 · P2 · rule 5 — An amendment's rate-variance reason and zero-rate remark disappear after Save, and the next save wipes them

*Cut Panel PO (API)* — `erp/jobwork/cutpanel/mapper/CppMapper.java:61-66; erp/jobwork/cutpanel/service/CppRevisions.java:40-41; src/pages/po/cutPanelPo/cppReducer.js:36, 49; src/services/po/cutPanelPo/cutPanelPoService.js:46-49`

- **What happens:** The server stores the amended line's reason and remark, but CppMapper.patched returns the LIVE line's values, and the screen rebuilds the amendment from that response and sends it back. Raise a line's rate more than 10% and type the reason, Save amendment: the box comes back empty and the advisory asks for a reason; save again and the stored reason is overwritten with blank, so Submit amendment is refused (VR-12). The approver never sees the maker's reason.
- **Fix:** In CppMapper.patched use the patch's rateReasonCode and rateRemark. *(visible: the amended line keeps the reason that was typed)*
- **Estimate:** 1 h
- **Note:** API change (erp-purchase).

#### U136 · P2 · correctness — An approved override smaller than the line's current excess blocks Submit, and the grid hides "Request override"

*Cut Panel PO, Garment Process PO* — `src/pages/po/cutPanelPo/CppGridCells.jsx:20, 25-27; src/pages/po/garmentProcessPo/GpoLineCells.jsx:21, 25-27; src/utils/cutPanelPoCalc.js:61-62, 157`

- **What happens:** Any override on a line removes the red outline and the request link, but Submit needs an authorised override at least as large as the excess (the server accepts a new, larger request). A line over its balance by 10 gets an override for 10, then the quantity rises by 10: the cell shows 'Exceeds balance by 20' with a green 'Override authorised' tag and no link, and Submit is refused (VR-11).
- **Fix:** When the existing override no longer covers the excess, show the error state and the request link for the current excess. *(visible: outline and link return in that case only)*
- **Estimate:** 1.5 h

#### U137 · P2 · correctness — Last rates and the duplicate-PO check are not refreshed when switching between job workers that have no GSTIN

*Cut Panel PO, Garment Process PO* — `src/pages/po/cutPanelPo/useCppContext.js:17-20; src/pages/po/garmentProcessPo/useGpoContext.js:17-20`

- **What happens:** The context's refetch key identifies the vendor only by GSTIN, which unregistered job workers lack, so 'no vendor', unregistered A and unregistered B all share one key. Switching a draft from A to B keeps A's last rates: 'Copy last PO rates' copies A's rates onto B's PO, and the >10% variance and duplicate checks pass on screen and then fail on the server.
- **Fix:** Key on the vendor id (doc.vendor?.id ?? gstin). *(not visible)*
- **Estimate:** 0.5 h

#### U138 · P2 · rule 5 — The first Save of a new job-work PO flips the form to read-only until the route change commits

*Cut Panel PO, Garment Process PO* — `src/pages/po/cutPanelPo/useCppView.js:27; src/pages/po/garmentProcessPo/useGpoView.js:25, 34; src/pages/po/cutPanelPo/useCppDraftActions.js:27-29; src/pages/po/garmentProcessPo/useGpoDraftActions.js:22-24; src/hooks/useEditParam.js:11-16`

- **What happens:** Edit mode is '!doc.id || ?edit=1'. After the first save the document has an id but the URL is still /new without ?edit=1 until the replace-navigation commits, so the inputs turn to text and the bar shows Delete draft / Cancel PO / Edit for up to a couple of seconds; clicking Edit then can leave the saved draft on …/new?edit=1.
- **Fix:** Stay in edit mode while the route has no id yet (editing || !routeId). *(visible: the flash goes)*
- **Estimate:** 1 h

#### U139 · P2 · correctness — The vendor copy's "Total quantity" prints the piece count with the billing unit's name

*Job-work PO vendor copy* — `src/utils/jobWorkPoPrint.js:80; src/utils/jobWorkPoCalc.js:64-74`

- **What happens:** Subtotals by unit sum pieces into poQty and keep the billing quantity separately, but the print shows poQty with the billing unit's label. A washing GPO billed per kg (500 pieces, 150 kg) prints 'Total quantity 500 Kg'; 600 pieces billed per dozen prints '600 Dozen' instead of 50.
- **Fix:** Print the billing quantity with its unit (or the pieces as pcs). *(visible: the total-quantity line of the print)*
- **Estimate:** 0.5 h

#### U140 · P2 · rule 4 — Picking a vendor waits on a network call with no feedback, then overwrites the lines from a stale copy

*Garment Process PO* — `src/pages/po/garmentProcessPo/useGpoHandlers.js:18-23; src/pages/po/garmentProcessPo/gpoReducer.js:33-34`

- **What happens:** pickVendor awaits the last-rates lookup and then replaces lines with the copy taken before the call, and overlapping picks are not ordered. Quantities typed while the call is out revert, and picking A then B can end on A if A answers last; the select keeps showing the old vendor meanwhile.
- **Fix:** Set the vendor at once, apply fetched rates with a functional update that fills only empty rates, and drop stale responses. *(visible: the vendor shows at once)*
- **Estimate:** 1.5 h

#### U141 · P2 · correctness — A Cut Panel PO accepts an expected delivery date before the PO date (the Garment Process PO blocks it)

*Cut Panel PO* — `src/pages/po/cutPanelPo/CppDeliverySection.jsx:31-34; src/utils/cutPanelPoCalc.js:133; src/pages/po/garmentProcessPo/GpoDeliveryCard.jsx:17-21`

- **What happens:** The CPP passes no minDate or date note and its checks only require a date. A mis-click of 05-Oct on a PO dated 12-Oct passes submit and approval, reaches the vendor copy, and the PO shows Overdue from approval.
- **Fix:** Copy the GPO rule: minDate={doc.poDate}, the date note, and the same blocking check in validateCpp and the server's CppValidator. *(visible: earlier dates disabled; a blocking message)*
- **Estimate:** 2 h

#### U142 · P2 · rule 5 — Production PO edits have no optimistic lock, so a second editor silently overwrites the first

*Cutting PO, Work Order, Finishing PO (API)* — `erp/production/cutting/dto/CuttingPoRequest.java; erp/production/workorder/dto/WorkOrderRequest.java; erp/production/finishing/dto/FinishingPoUpdateRequest.java; src/pages/po/cutting/CuttingPoForm.jsx:164-174; src/pages/po/workorder/WorkOrderForm.jsx:147-161; src/pages/po/finishing/FinishingPoForm.jsx:80-88`

- **What happens:** None of the three update requests carries a version and the services overwrite every field and item without comparing one (only the status commands check). A and B both edit draft CPO-0012; A sets rates and saves; B changes the cut date and saves with the old matrix, and A's rates are gone with no conflict dialog.
- **Fix:** Add version to the three update DTOs with VersionGuard in update(), and send the loaded record's version. *(visible: the conflict dialog instead of a silent overwrite)*
- **Estimate:** 2 h
- **Note:** API change (erp-purchase).

#### U143 · P2 · rule 5 — A failed submit after a successful create leaves the form on /new, so the retry creates a duplicate PO

*Cutting PO, Work Order* — `src/pages/po/cutting/CuttingPoForm.jsx:187-197; src/pages/po/workorder/WorkOrderForm.jsx:175-181`

- **What happens:** Save & Submit creates CPO-0042 and then submits it; if the submit fails, the catch keeps isEdit false and drops the created record, so Save Draft creates CPO-0043 for the same order.
- **Fix:** Keep the created record and decide create-vs-update from it. *(not visible)*
- **Estimate:** 1 h

#### U144 · P2 · correctness — Editing a Cutting PO shows and re-saves the order's live allowance instead of the PO's own, with a false 'allowance changed' warning

*Cutting PO, Work Order* — `src/pages/po/cutting/CuttingPoForm.jsx:72, 87-88, 170, 234; src/pages/po/workorder/WorkOrderForm.jsx:155`

- **What happens:** In edit mode the allowance field and the payload use the eligible order's current allowance. A PO raised at 5% (planned 1,050) on an order now at 3%: reopening to fix a rate shows 3%, warns that the allowance changed, and Save stores 3% while the rows stay at 5%; the view then reads '1,050 (3% allow.)'.
- **Fix:** Seed the field from the PO's own allowance in edit mode and warn only when the order's default changed since the PO was raised. *(visible: edit shows the PO's own allowance; the false warning goes)*
- **Estimate:** 1 h

#### U145 · P2 · correctness — Editing the allowance recomputes planned quantity in floating point, adding a piece to some rows

*Cutting PO* — `src/pages/po/cutting/CuttingPoForm.jsx:155; erp/production/common/service/ProductionLookupService.java:172-178`

- **What happens:** Math.ceil(q * (1 + 10/100)) gives 111, 100 and 221 for order quantities 100, 90 and 200 (110.00000000000001 etc.), where the server's BigDecimal rule gives 110, 99 and 220; the server stores the client's rows.
- **Fix:** Compute in integer hundredths, Math.ceil(q * (100 + pct) / 100), in one shared helper. *(visible: those rows drop by one)*
- **Estimate:** 0.5 h

#### U146 · P2 · correctness — Order coverage compares planned quantity (with allowance) against order quantity (without), so every full-order PO is flagged as over

*Cutting PO, Work Order (coverage panel)* — `erp/production/cutting/service/CuttingPoService.java:96-101; erp/production/workorder/service/WorkOrderService.java:93-96; src/pages/po/cutting/CuttingPoForm.jsx:115-116, 122; src/pages/po/workorder/WorkOrderForm.jsx:131-137; src/pages/po/components/OrderCoveragePanel.jsx:10-13, 39-45`

- **What happens:** An order of 1,000 pcs at 3% default allowance gives a 1,030-pc PO; the panel shows 'Over by 30' in red and Save & Submit always asks 'quantity over the order qty — Submit anyway?', which trains users to click through.
- **Fix:** Compare like with like (the order's planned total, or the siblings' order quantity). *(visible: normal POs are no longer flagged)*
- **Estimate:** 2 h

#### U147 · P2 · correctness — The production PO view counts an approved PO's own reservation against itself and shows a false Shortage

*Production PO view* — `src/pages/po/components/ProductionPoView.jsx:45, 54, 118-120; src/services/po/production/productionLookupService.js:49-50; erp/production/common/service/StockAllocationService.java:263-266`

- **What happens:** The view's stock call passes no excludeType/excludePoId, so a PO that reserved 400 kg of a 500 kg stock computes 500 − 400 − 400 and shows Shortage.
- **Fix:** Pass excludeType (the PO's engine entity type) and excludePoId: record.id. *(visible: false Shortage tags go)*
- **Estimate:** 0.5 h

#### U148 · P2 · correctness — Form stock is fetched before the PO's branch is known and not refetched when it is set (multi-branch)

*Cutting PO, Work Order* — `src/pages/po/cutting/CuttingPoForm.jsx:74, 84, 90-93, 110-113; src/pages/po/workorder/WorkOrderForm.jsx:64, 80, 91-92, 111-116`

- **What happens:** The hydrate reads branchId from the form before edit mode sets it, and picking an allocation sets the branch without refetching. With the working branch on All and the PO for branch B (no fabric there), the tab shows all-branch stock as OK.
- **Fix:** Refetch stock and consumption once branchId is known and when it changes. *(visible: the stock tab shows the PO's branch)*
- **Estimate:** 1 h

#### U149 · P2 · correctness — List Print prints Draft and Referred-back Cutting and Finishing POs that the view refuses to print

*Cutting PO / Finishing PO lists* — `src/pages/po/cutting/CuttingPoList.jsx:89-92; src/pages/po/finishing/FinishingPoList.jsx:101-104; src/pages/po/components/ProductionPoView.jsx:64, 149`

- **What happens:** The lists hide actions only for Cancelled; a merchandiser prints a Draft Cutting PO from the list (with only a small status pill, no watermark) and hands it to a unit before approval.
- **Fix:** Apply the view's printBlocked rule and tooltip to the list buttons. *(visible: Print disabled for drafts in these lists)*
- **Estimate:** 0.5 h

#### U150 · P2 · rule 34 — The "CAD Marker File" upload never uploads; only the file name is stored

*Cutting PO (CAD marker)* — `src/pages/po/components/MarkerUploadCard.jsx:21-28; src/components/FileUpload.jsx:61-62; src/pages/po/components/ProductionPoView.jsx:122`

- **What happens:** onSelect stores file.name in markerFileUrl and the file itself is discarded (FileUpload is a pure UI component). The view says 'CAD Marker: marker.dxf' but nobody can ever open it.
- **Fix:** Upload through fileService against the cutting PO and show a download link, or relabel it as a text marker reference. *(visible)*
- **Estimate:** 4 h

#### U151 · P2 · rule 34 — The Work Order "Sewing Line" list is hard-coded demo data although a production-line master exists

*Work Order* — `src/services/po/production/productionLookupService.js:83-84; src/services/po/production/productionMockData.js:110-114; src/pages/po/workorder/WorkOrderForm.jsx:59, 247; src/hooks/useSewingMasters.js:58-65`

- **What happens:** Every Work Order offers Line A/B/C whatever lines the factory has, and the stored value surfaces in Virtual Factory as 'LINE-A'.
- **Fix:** Feed the select from useSewingMasters().linesByUnit(processingUnitId) and delete the static list. *(visible: real line names)*
- **Estimate:** 2 h

#### U152 · P2 · correctness — The view's Approval History is empty for POs opened from a list when there is no engine request

*Production PO view* — `src/pages/po/components/ProductionPoView.jsx:132-134; erp/production/cutting/mapper/CuttingPoMapper.java:19; src/pages/po/components/ProductionEngineHistory.jsx:28`

- **What happens:** List rows never carry approvalHistory (the mapper ignores it on search), and an auto-approval writes no history entry; with no approval flow configured, any approved Cutting PO opened from the list says 'No history yet' and shows no approver or date.
- **Fix:** Load the full record for the view and add an Approved entry from approvedBy/approvedDate when there is no engine request. *(visible: Created/Approved entries appear)*
- **Estimate:** 2 h

#### U153 · P2 · correctness — "By Order (coverage)" shows false GAPs under filters and hides real gaps behind rejected Finishing POs

*Finishing PO list (By Order)* — `src/pages/po/finishing/FinishingPoList.jsx:51-55, 148-149; src/pages/po/finishing/FinishingCoverageMatrix.jsx:29-31`

- **What happens:** The matrix is built from the filtered first 100 rows and treats Rejected FPOs as covering. Filter Vendor = FineFinish and switch to By Order: every in-house process shows GAP; a process whose only FPO was rejected shows a tick.
- **Fix:** Build the matrix from an unfiltered by-order fetch and treat Rejected like Cancelled. *(visible)*
- **Estimate:** 2 h

#### U154 · P2 · rule 4, rule 15 — The three production PO lists fetch only the newest 100 POs, page on the client, and keep whichever response lands last

*Cutting PO, Work Order, Finishing PO lists* — `src/pages/po/cutting/CuttingPoList.jsx:42-55, 71, 131; src/pages/po/workorder/WorkOrderList.jsx:42-55, 79, 140; src/pages/po/finishing/FinishingPoList.jsx:48-61, 77, 157`

- **What happens:** From the 101st Cutting PO onwards the oldest drop off the list and the pager says 'of 100'; the Buyer filter options come from the loaded rows; changing Status twice quickly can leave the first status's rows under the second.
- **Fix:** Move the three lists onto useServerList (server paging with a stale-response guard). *(visible: real totals and server paging)*
- **Estimate:** 5 h

#### U155 · P2 · rule 4 — Production form lookups have no stale-response guard, so a PO can be saved against the wrong order

*Cutting PO, Work Order, Finishing PO, wizard* — `src/pages/po/cutting/CuttingPoForm.jsx:65-76, 100-108, 133-145, 165; src/pages/po/workorder/WorkOrderForm.jsx:61-66, 102-109, 125-129; src/pages/po/finishing/FinishingPoForm.jsx:60-66; src/pages/po/finishing/FinishingPoGenerateWizard.jsx:40-44`

- **What happens:** The payload uses orderId from the last response to land, not the select's value. Pick order A then quickly order B; if A answers last, the PO is created for A while the select shows B. In the wizard a work order of order A can be generated under order B.
- **Fix:** Guard each lookup with a request counter; check the overlap against the work order's own order on the server. *(not visible)*
- **Estimate:** 2 h

#### U156 · P2 · rule 2 — Production PO catch blocks add a second toast with axios's raw "Request failed with status code N"

*Production PO forms and lists* — `src/pages/po/cutting/CuttingPoForm.jsx:197; src/pages/po/workorder/WorkOrderForm.jsx:181; src/pages/po/finishing/FinishingPoForm.jsx:94; src/pages/po/finishing/FinishingPoGenerateWizard.jsx:90; src/pages/po/cutting/CuttingPoList.jsx:51, 66; src/pages/po/workorder/WorkOrderList.jsx:51, 66, 75; src/pages/po/finishing/FinishingPoList.jsx:57, 72; src/pages/po/components/ProductionPoView.jsx:72; src/pages/po/components/ProductionStatusBar.jsx:73`

- **What happens:** These toast e.message after the interceptor has toasted the server's text; for an axios error e.message is the generic status line. Cancelling a Cutting PO that has a Work Order shows the server's reason and then 'Request failed with status code 409'; on a version conflict it stacks on the dialog.
- **Fix:** toastUnlessHandled(message, e, fallback) everywhere (WS7). *(visible: one meaningful toast)*
- **Estimate:** 1 h

#### U157 · P2 · correctness — BOM lines are locked and unlocked by separate client calls whose failures are ignored, and decisions taken outside POView never unlock them

*POForm, POView (BOM line lock)* — `src/pages/po/POForm.jsx:1607-1625; src/pages/po/POView.jsx:447-460, 496; erp/purchaseorder/service/PurchaseOrderApprovalListener.java`

- **What happens:** After submit the form locks the sourced BOM lines inside Promise.allSettled, whose results are never checked: if the PATCH fails the PO is submitted but the line stays selectable, so a second PO can be raised from it. Unlock on reject/refer-back happens only in POView's client code; a rejection from My Approvals or the owner app never unlocks the lines.
- **Fix:** Lock and unlock BOM lines on the server, in the same transaction as the PO's submit and its approval outcome. *(not visible)*
- **Estimate:** 3 h
- **Note:** API change (erp-purchase).

#### U158 · P2 · correctness — Removing an order in the BOM drawer applies at once and Cancel does not undo it; the order's lines stay but drop out of the order references

*POForm, BomLineSelectionDrawer* — `src/pages/po/BomLineSelectionDrawer.jsx:221-234, 400, 486-489; src/pages/po/POForm.jsx:924-942, 1347, 2547; erp/purchaseorder/service/PurchaseOrderService.java:467`

- **What happens:** The X beside an order calls onBomOrdersChange immediately (wired to setBomOrders). On a Combined PO with orders A, B and C the buyer clicks C's X and then Cancel: C vanishes from Order Information but its lines stay, the PO is saved with order references [A, B] so C stops following this PO's delays, and at the next drawer confirm C's lines silently disappear. POForm.removeOrder, which would also remove the lines, is never called.
- **Fix:** Hold the removal inside the drawer and apply it on confirm through POForm.removeOrder. *(visible: Cancel really cancels a removal)*
- **Estimate:** 2 h

#### U159 · P2 · rule 1 — BOM-sourced PO lines skip quantity validation, so zero quantities are submitted and lock the BOM line

*POForm* — `src/pages/po/POForm.jsx:1243-1250, 1364, 1931-1934`

- **What happens:** For BOM POs only the price is checked; the 'quantity at least 1' rule sits in the General-PO branch. 'Reduce by stock' turns a line covered by stock into 0, the PO goes to the supplier with a 0-quantity line, and the BOM line is locked as 'PO placed'.
- **Fix:** Apply qty > 0 to BOM lines too and let the buyer drop a zero line. *(visible: a validation message)*
- **Estimate:** 0.5 h

#### U160 · P2 · correctness — "Reduce by stock" subtracts the stock again on every click

*POForm* — `src/pages/po/POForm.jsx:1930-1935, 1947`

- **What happens:** The reduced figure is computed from the current quantity on each render and the link stays enabled: a double-click on a 100 KG line with 30 KG in stock leaves 40 KG instead of 70 KG.
- **Fix:** Reduce from the remembered BOM quantity and disable the link once applied. *(visible: the link greys out after one use)*
- **Estimate:** 1 h

#### U161 · P2 · correctness — Changing a line's variant clears its unit price, resets GST to 0% and overwrites its description

*POForm* — `src/pages/po/POForm.jsx:735-738, 750, 757-758, 777-780`

- **What happens:** The variant handler reads price and GST from fields the item DTO does not carry, so a line 'Navy' at ₹180 with 5% GST changed to 'Black' comes back with a blank price and 0% GST; Submit flags only the price.
- **Fix:** On a variant change update only the variant fields. *(visible: price and GST survive a variant change)*
- **Estimate:** 0.5 h

#### U162 · P2 · correctness — The Combined PO same-buyer rule is skipped when editing a saved PO

*POForm* — `src/pages/po/POForm.jsx:563-572, 881-891; erp/purchaseorder/service/PoOrderRefs.java:72-78`

- **What happens:** Edit mode builds the orders without buyerId, so the check never fires, and the server does not check either: a saved Combined PO for buyer X accepts an order of buyer Y through Select BOM Lines.
- **Fix:** Copy buyerId/buyerName into the edit-mode orders and enforce one buyer on the server. *(not visible)*
- **Estimate:** 0.5 h

#### U163 · P2 · correctness — Saving recomputes IGST vs CGST/SGST from the active-supplier list, so a deactivated IGST supplier's draft is re-saved as CGST + SGST

*POForm* — `src/pages/po/POForm.jsx:1328, 1334, 1374-1385, 488-490`

- **What happens:** The supplier is looked up in the active list (empty if master data failed to load); a draft PO for an inter-state supplier who has since been deactivated, re-saved after a date change, stores its lines as 2.5% CGST + 2.5% SGST, which the server keeps.
- **Fix:** In edit mode load the PO's own supplier (or keep the split already on the lines) and block saving until master data loads. *(visible: the inactive supplier's name shows instead of an id)*
- **Estimate:** 2 h

#### U164 · P2 · rule 5, rule 1 — If the activity call fails after a successful create, the form stays on /new and a retry creates a duplicate PO

*POForm* — `src/pages/po/POForm.jsx:364, 1455-1476, 1578-1633`

- **What happens:** Create and the follow-up createActivity share one try; if the activity POST fails the catch says 'Failed to save purchase order', nothing is adopted and the next click creates a second PO number (with no approval flow both are approved and sent).
- **Fix:** Adopt the created record as soon as create returns; give the activity and BOM-lock follow-ups their own try with a warning. *(not visible)*
- **Estimate:** 1.5 h

#### U165 · P2 · correctness — The form says "submitted for approval", and logs it, after the server has already auto-approved and sent the PO

*POForm* — `src/pages/po/POForm.jsx:1597-1604, 1627; erp/purchaseorder/service/PurchaseOrderService.java:229-252`

- **What happens:** With no approval flow configured the server approves and sends the PO (and logs 'Auto-approved'), but the form toasts 'submitted for approval' and then logs a Pending Approval entry after the approval, so the trail reads in reverse order.
- **Fix:** Branch on result.status and word the toast and log accordingly. *(visible: wording for auto-approved POs)*
- **Estimate:** 1 h

#### U166 · P2 · rule 1 — A referred-back or rejected PO cannot be resubmitted unchanged; the built-in "Re-submit anyway" is unreachable

*POForm* — `src/pages/po/POForm.jsx:1519-1523, 1538-1555, 1493, 1506`

- **What happens:** 'No changes detected' runs before the Re-submit Anyway confirm, and the change check ignores GST %, T&C, PO date, branch and stages. A PO referred back with 'confirm price' that needs no change can only be resubmitted after a dummy edit.
- **Fix:** Let unchanged referred-back/rejected POs reach the existing confirm, and include those fields in the comparison. *(visible: the confirm appears instead of the warning)*
- **Estimate:** 1 h

#### U167 · P2 · rule 4, rule 2 — A failing variant-image download is retried on every keystroke, with an error toast each time

*POForm, BomLineSelectionDrawer* — `src/pages/po/POForm.jsx:442-461, 1075-1092; src/pages/po/BomLineSelectionDrawer.jsx:113-116`

- **What happens:** On failure the variant id is removed from the loaded set inside an effect keyed on lineItems, and the 'loading' marker is never cleared, so every keystroke in any cell re-requests a missing image and toasts again.
- **Fix:** Remember failed ids, clear the loading marker, and make the read silent (see the shared fileService finding). *(visible: no repeated toasts)*
- **Estimate:** 1 h

#### U168 · P2 · rule 33 — The variant picker cannot be used from the keyboard

*POForm* — `src/pages/po/POForm.jsx:208-211, 231-247`

- **What happens:** The modal has no footer, no close button and no mask close, and each option is a div with onClick only, so Tab cannot reach a variant; this step is mandatory for multi-variant items.
- **Fix:** Make the options buttons (or role=button, tabIndex and Enter/Space handling). *(not visible)*
- **Estimate:** 1 h

#### U169 · P2 · rule 4 — Clicking a PO notification while on the Supplier PO list opens nothing

*POList* — `src/pages/po/POList.jsx:67-79; src/components/NotificationCenter.jsx:190-191`

- **What happens:** The ?viewId= handler runs once on mount; a bell, live-feed or approval link while the list is mounted only changes the URL and no dialog opens.
- **Fix:** Drive the handler from searchParams and strip the params after reading. *(visible: the PO dialog opens)*
- **Estimate:** 0.5 h

#### U170 · P2 · correctness — Every PO line card shows the variant name and code twice

*POView* — `src/pages/po/POView.jsx:932-948`

- **What happens:** The heading shows variantName and variantCode, and the block meant for the item line repeats them ('Cotton Lycra Navy · CLY-NV-60 · Cotton Lycra Navy · CLY-NV-60'); the derived item name is never shown.
- **Fix:** Owner's pick: drop the repeat, or make the heading the item name so the second block is the variant line. *(visible)*
- **Estimate:** 0.25 h

#### U171 · P2 · correctness — Mark Stage Complete blocks dates after the delivery date but accepts future dates

*POView (stages)* — `src/pages/po/POView.jsx:149-156, 1847; erp/purchaseorder/service/PurchaseOrderService.java:697-700`

- **What happens:** The date picker is bounded by [PO date, delivery date]: a stage that really finished late cannot be recorded (the delay chip then says 'On time' or the delivery date must be revised first), while a completion dated in the future is accepted.
- **Fix:** Bound the date by [PO date, today]. *(visible: late dates selectable, future dates disabled)*
- **Estimate:** 0.5 h

#### U172 · P2 · rule 5 — Stage edits replace the whole stage list from a stale copy, overwriting a colleague's completions

*POView (stages)* — `src/pages/po/FabricStagesDialog.jsx:195-219; src/pages/po/POView.jsx:589-601; erp/purchaseorder/service/PurchaseOrderService.java:690-695, 758`

- **What happens:** The dialog always returns the full reordered list, so POView always calls reorder (the append path is unreachable); the server replaces the list wholesale and completes stages by array position, with no version. The store marks Dyeing complete at 10:00; a merchandiser whose view opened at 09:55 adds Packing at 10:05, and Dyeing is open again with its completion details gone.
- **Fix:** Version the line's stages (409 on a stale copy) and use the append endpoint when no existing stage moved. *(not visible except a conflict dialog on a real clash)*
- **Estimate:** 4 h
- **Note:** API change (erp-purchase).

#### U173 · P2 · correctness — The PO activity trail can be forged: author and type come from the request, and JSON notes render as status changes

*POView (activity) and API* — `erp/purchaseorder/controller/PoActivityLogController.java:26-41; erp/purchaseorder/service/PoActivityLogService.java:71-97; src/pages/po/POView.jsx:197-206, 725-752`

- **What happens:** Create stores the name and system flag sent by the client, PUT/DELETE check only that the row belongs to the PO, and POView renders any note whose text parses as {type:'status_change'} as a real transition. A user types '{"type":"status_change","from":"Pending_Approval","to":"Sent_To_Supplier","by":"Managing Director"}' into the activity box and the timeline shows that approval.
- **Fix:** Stamp the author on the server, write status events server-side, accept only plain notes from the screen, and limit edits/deletes to the author's own notes. *(visible: such text shows as plain text)*
- **Estimate:** 6 h
- **Note:** API change (erp-purchase).

#### U174 · P2 · correctness — Version history names the PO's creator as the submitter of every version

*POVersionHistory (API)* — `erp/purchaseorder/service/PurchaseOrderService.java:344; src/pages/po/POVersionHistory.jsx:176-181, 215-220`

- **What happens:** captureVersion is passed po.getCreatedBy(): Priya raises a PO (v1), Ravi edits and resubmits it after a refer-back (v2), and v2 says Priya.
- **Fix:** Pass the current user. *(visible: later versions name the real submitter)*
- **Estimate:** 0.5 h

#### U175 · P2 · rule 2 — Print PO does nothing, with no message, when the pop-up is blocked

*PO print* — `src/utils/poPdfGenerator.js:871-916; src/pages/po/POView.jsx:855-873`

- **What happens:** window.open runs after several awaits (images, organisation, supplier, T&C, sanitiser), outside the click's activation on Safari/iPad or a slow line; a blocked window only logs to the console.
- **Fix:** Open the window in the click and write into it after the awaits, or report 'Allow pop-ups to print'. *(visible: a warning when blocked)*
- **Estimate:** 1 h

#### U176 · P2 · rule 6 — The delivery-date filter and sort use the original date while the column shows the revised date

*POList* — `src/pages/po/POList.jsx:117-121, 212-226; erp/purchaseorder/repository/PurchaseOrderSpecification.java:38-43; erp/purchaseorder/service/PurchaseOrderService.java:369`

- **What happens:** Filtering Delivery 25-31 Oct misses a PO originally due 05-Oct and revised to 28-Oct, and includes one revised away to 20-Nov; sorting orders rows by the struck-through dates.
- **Fix:** Filter and sort on coalesce(revised, original) on the server. *(visible: results follow the date shown)*
- **Estimate:** 3 h

#### U177 · P2 · rule 6 — PO lists lose page, filters and sort after Edit or Save, and a cleared sort keeps sorting

*POList and the production / job-work lists* — `src/pages/po/POList.jsx:43-54; src/pages/po/POForm.jsx:1473, 1630; src/pages/po/cutting/CuttingPoList.jsx:33-37; src/pages/po/workorder/WorkOrderList.jsx:33-37; src/pages/po/finishing/FinishingPoList.jsx:34-41`

- **What happens:** List state is local and the forms return to the bare list path: Status = Referred Back, page 3, Edit and Save lands on page 1 unfiltered (the Finishing list also returns to 'All FPOs'). Clearing a sort keeps the old field, descending.
- **Fix:** Keep list state in the URL (WS7) and reset to id/desc on a cleared sort; the id tie-breaker is A1. *(visible: the list returns as left)*
- **Estimate:** 3 h

#### U208 · P2 · rule 4 — A slow earlier PO load can replace the PO the user just opened, and actions then apply to it

*POView* — `src/pages/po/POView.jsx:236-291`

- **What happens:** loadPODetails sets the PO and its attachments from whichever response lands, with no guard against a newer poId. Clicking PO A, closing it before it loads and opening PO B can show A in B's dialog (Cancel/Refer Back then act on A), or list A's attachments under B so Remove deletes A's file while logging it on B.
- **Fix:** Tag each load with the poId (or a counter) and drop results for any other PO; revoke blob URLs that arrive after close. *(not visible)*
- **Estimate:** 1.5 h

#### U371 · P2 · rule 4 — A deep-link Approve/Reject stays armed on the PO list and re-opens the action dialog on the next PO the user opens (the U001 pattern)

*POList, POView* — `src/pages/po/POList.jsx:64, 74, 161-171, 404-416; src/pages/po/POView.jsx:422-444; src/components/NotificationCenter.jsx:196-203`

- **What happens:** A notification action chip opens /purchase-orders/supplier-po/list?viewId=…&action=approve. pendingAction is cleared only by the dialog's own close, never by handleStatusActionComplete or handleView, so after the first PO is actioned, opening any other PO whose status allows that action pops its 'Approve Purchase Order?' confirm (or the reject/refer-back reason dialog) unprompted; a habitual OK approves the wrong PO. Unlike U001 it never acts without the user's OK. Mostly dormant today: the server never emits the PO-specific approval notification, so it fires only from generic notifications that carry action chips.
- **Fix:** Clear pendingAction in handleStatusActionComplete, handleView and the deep-link fetch's failure path, and bind it to the deep-linked PO id (act only when po.id matches) — the same fix as U001. *(not visible (no unprompted dialogs))*
- **Estimate:** 0.5 h
- **Note:** Reported by lane B; verified by the lead.

### P3

#### U178 · P3 · rule 1 — A failed requirement lookup leaves the CPP table spinning (or the GPO picker saying there are no requirements) with no retry

*Cut Panel PO, Garment Process PO* — `src/pages/po/cutPanelPo/useCppRequirementLookup.js:20, 27, 34; src/pages/po/garmentProcessPo/useGpoRequirementRows.js:18, 22`

- **What happens:** The catches swallow the error without recording the key, so loading stays true; once lines exist the process is locked and nothing refetches short of a reload.
- **Fix:** On error set { key, list: [] } as useGpoRequirementCells already does. *(visible: the spinner stops and the empty text shows)*
- **Estimate:** 0.5 h

#### U179 · P3 · rule 2 — A version conflict on Submit shows the conflict dialog and also a red toast

*Job-work POs (useActionRunner)* — `src/services/po/jobWork/jobWorkApi.js:24; src/hooks/useActionRunner.js:38-39`

- **What happens:** Submits are sent silent; the interceptor still opens the conflict dialog for OPTIMISTIC_LOCK_CONFLICT, and useActionRunner then toasts every silent failure that has no error list.
- **Fix:** Skip the toast when e.isOptimisticLockConflict. *(visible: the duplicate toast goes)*
- **Estimate:** 0.5 h

#### U180 · P3 · rule 14, rule 49 — The job-work PO grids re-render fully and run linear look-ups on every keystroke

*Cut Panel PO, Garment Process PO* — `src/pages/po/cutPanelPo/CutPanelPoForm.jsx:107; src/pages/po/cutPanelPo/CppGridSection.jsx:27-33; src/pages/po/cutPanelPo/cppGridColumns.jsx:55-60, 81; src/utils/cutPanelPoCalc.js:24-30; src/utils/garmentProcessPoCalc.js:25-31; src/pages/po/jobWork/JobWorkApprovalPanel.jsx:25-41`

- **What happens:** A new rates object each render rebuilds the CPP columns, so the memoised cells re-render; liveCell does .find over requirement cells three or four times per row. A 144-line CPP runs about 1,000 scans per keystroke.
- **Fix:** Memoise rates, index usage cells by id once, memoise the approval panel's columns (WS17 measures first). *(not visible)*
- **Estimate:** 2 h

#### U181 · P3 · rule 34 — Unused configuration in the job-work PO code

*Garment Process PO, Cut Panel PO* — `src/pages/po/garmentProcessPo/gpoDialogs.js:16; src/utils/cutPanelPoRevision.js:24-32`

- **What happens:** A 'Reject to Draft' dialog that no button can open, and revision labels revisionChanges never produces.
- **Fix:** Delete them. *(not visible)*
- **Estimate:** 0.25 h

#### U182 · P3 · rule 33 — The requirement number on the GPO requirement cards can only be opened with a mouse

*Garment Process PO* — `src/pages/po/garmentProcessPo/GpoRequirementCards.jsx:30; src/components/RecordLink.jsx:14-24`

- **What happens:** RecordLink renders a Text with onClick and no role, tabIndex or key handler, so keyboard users cannot open the GPR from the card (the trace line's links work).
- **Fix:** Render a router Link there, as GpoTraceLine does. *(visible: a focus ring when tabbed to)*
- **Estimate:** 0.5 h

#### U183 · P3 · rule 1 — Production edit screens have no load-failure path (blank form, endless spinner, fields nulled on the next save)

*Cutting PO, Work Order, Finishing PO* — `src/pages/po/cutting/CuttingPoForm.jsx:81-97; src/pages/po/workorder/WorkOrderForm.jsx:77-99; src/pages/po/finishing/FinishingPoForm.jsx:39-56, 69, 98`

- **What happens:** The loads have no catch: a failed GET leaves an empty disabled form or a spinner forever; on FinishingPoForm a failed secondary lookup skips setFieldsValue, so a later Save Draft nulls vendor rate, remarks and delivery date.
- **Fix:** Catch, toast and return to the list; set fields before secondary lookups. *(visible: an error or redirect)*
- **Estimate:** 1 h

#### U184 · P3 · rule 1, rule 4 — The production PO view shows the previous PO's PP status and stock until the new fetch lands

*Production PO view* — `src/pages/po/components/ProductionPoView.jsx:36-49, 53-54, 131, 164; src/pages/po/cutting/CuttingPoForm.jsx:280; src/pages/po/workorder/WorkOrderForm.jsx:267`

- **What happens:** The effect never resets stockRows/ppStatus and the stock panels get no loading flag: opening CPO-2 after CPO-1 briefly shows CPO-1's Shortage and an enabled Submit; the forms show 'No stock data — select an order' while fetching.
- **Fix:** Reset both at the start of the effect and pass a loading flag. *(visible: a brief loading state)*
- **Estimate:** 0.5 h

#### U185 · P3 · rule 9 — Production PO numbers and dates formatted with the browser locale

*Production PO screens* — `src/pages/po/cutting/CuttingPoForm.jsx:249; src/pages/po/cutting/CuttingPoList.jsx:24, 80-81; src/pages/po/workorder/WorkOrderList.jsx:24, 91-92; src/pages/po/finishing/FinishingPoList.jsx:94-95; src/pages/po/components/ProductionPoView.jsx:111-112; src/pages/po/components/MaterialStockPanel.jsx:19, 33, 87; src/pages/po/components/OrderCoveragePanel.jsx:44; src/pages/po/components/ProductionApprovalTimeline.jsx:19; src/pages/po/SizeColorMatrix.jsx:23, 32, 40, 61, 63, 65`

- **What happens:** List dates use toLocaleDateString() (10/12/2026 on one PC, 12/10/2026 on another) and quantities toLocaleString(); MaterialStockPanel formats the date-only last-GRN date as a date-time.
- **Fix:** formatters.js / dayjs DATE_FORMAT (WS2a). *(visible: Indian formats)*
- **Estimate:** 1 h

#### U186 · P3 · rule 14 — Un-memoised columns in the production PO tables

*Production PO components* — `src/pages/po/components/ConsumptionComparisonPanel.jsx:33-54; src/pages/po/finishing/FinishingCoverageMatrix.jsx:46-50; src/pages/po/finishing/ProcessAssignmentTable.jsx:15-53`

- **What happens:** Small tables rebuild their columns on every render (each CAD keystroke).
- **Fix:** useMemo (WS6). *(not visible)*
- **Estimate:** 0.5 h

#### U187 · P3 · rule 34 — Dead mock layer, a duplicate mock flag and unused exports in the production PO services

*Production PO services* — `src/services/po/production/productionEnv.js:6; src/services/po/production/cuttingPoService.js:10-46; src/services/po/production/workOrderService.js:10-52; src/services/po/production/finishingPoService.js:10-40; src/services/po/production/productionLookupService.js:11-78; src/services/po/production/mockApi.js:17, 216; src/utils/productionConstants.js:36-39, 159-160; src/pages/po/components/ConsumptionComparisonPanel.jsx:22-26, 69-78, 88-101; src/utils/productionPoPdfGenerator.js:43, 102`

- **What happens:** USE_MOCK_PRODUCTION_DATA is false, so every mock branch is dead; mockApi.js declares its own flag set to true, naming endpoints that do not exist. mockApi.getSewingLines is still live (see the Sewing Line finding), so the mock files can go only after that fix.
- **Fix:** Delete after the Sewing Line fix (WS2f). *(not visible)*
- **Estimate:** 1 h

#### U188 · P3 · correctness — The in-house unit field label reads "Unit Unit"

*Cutting PO, Work Order* — `src/pages/po/components/ProcessingUnitSelector.jsx:55`

- **What happens:** Every Cutting PO and Work Order form shows the label 'Unit Unit'.
- **Fix:** Label it 'In-house Unit'. *(visible: label text)*
- **Estimate:** 0.1 h

#### U189 · P3 · rule 33 — Production PO inputs outside Form.Item have no name, id or label

*Production PO forms* — `src/pages/po/cutting/CuttingPoForm.jsx:234, 267; src/pages/po/workorder/WorkOrderForm.jsx:260; src/pages/po/components/ConsumptionComparisonPanel.jsx:39; src/pages/po/components/MaterialStockPanel.jsx:81; src/pages/po/finishing/ProcessAssignmentTable.jsx:29-34, 39-47`

- **What happens:** Screen readers announce 'edit text' for each CAD and Allocated cell; DevTools flags fields with no id or name.
- **Fix:** Add name/id and an aria-label naming the row. *(not visible)*
- **Estimate:** 0.5 h

#### U190 · P3 · rule 7 — The stages dialog resets on every POView render, so newly typed stages can vanish

*FabricStagesDialog (from POView)* — `src/pages/po/FabricStagesDialog.jsx:57-83; src/pages/po/POView.jsx:1832`

- **What happens:** The reset effect depends on initialStages and POView passes stages={[]}, a new array each render; a line image finishing loading while the dialog is open wipes a typed stage row.
- **Fix:** Initialise only when the dialog opens, or pass a stable empty array. *(not visible)*
- **Estimate:** 0.5 h

#### U191 · P3 · rule 8 — The back arrow with unsaved changes asks twice

*POForm* — `src/pages/po/POForm.jsx:1645-1648`

- **What happens:** The form's own Leave confirm navigates without clearDirty, so the unsaved-changes guard asks again.
- **Fix:** Call clearDirty() before navigate. *(visible: one prompt)*
- **Estimate:** 0.25 h

#### U192 · P3 · correctness — After a partial mapping the adder's quantity resets to the old open quantity

*PO → Order Mapping* — `src/pages/po/order-mapping/AllocationAdder.jsx:20-21, 33, 47`

- **What happens:** resetFields runs before the new line arrives, so with 500 kg open and 200 mapped the box shows 500 again and Map fails 'Max 300'.
- **Fix:** Reset to the new unmappedQty (key the adder on it). *(visible: the correct default)*
- **Estimate:** 0.5 h

#### U193 · P3 · rule 2 — Revise Delivery Date accepts the unchanged date and then shows the server's refusal twice

*ReviseDeliveryDateDialog* — `src/pages/po/ReviseDeliveryDateDialog.jsx:119-121, 171; erp/purchaseorder/service/PurchaseOrderService.java:794-796`

- **What happens:** Save is enabled whenever a date and reason exist; picking the current date gives the server's 'same as the current delivery date' twice.
- **Fix:** Disable Save when the shift is 0 days; toastUnlessHandled. *(visible: Save disabled for the current date)*
- **Estimate:** 0.5 h

#### U194 · P3 · correctness — A Partially Received PO cannot be cancelled or closed from the view, although the API allows it

*POView* — `src/pages/po/POView.jsx:416; erp/purchaseorder/domain/POStatus.java:38`

- **What happens:** Cancel is offered only from Draft, Pending Approval and Sent To Supplier; a supplier who delivers 800 of 1,000 m and stops leaves the PO open for GRN with no way to close it.
- **Fix:** Owner decides: offer cancel / short close on Partially Received, or remove that move from the server's flow. *(visible if offered)*
- **Estimate:** 1 h
- **Note:** Needs owner.

#### U195 · P3 · rule 34 — The e-way bill generate dialog is never imported; the feature is off and has defects to fix before it is switched on

*E-way bill (dormant)* — `src/pages/po/EwayBillGenerateDialog.jsx; src/services/po/purchaseOrderService.js:293-306; src/pages/po/POView.jsx:647-657, 1514-1544`

- **What happens:** Nothing imports the dialog and the controller exists only with ewaybill.enabled (default false). Before wiring: map the NIC errorMessage (today the user would see only generic failures), uppercase GSTINs on input, cap cancel remarks at 50, reload the PO after a cancel.
- **Fix:** Owner's call: delete until scheduled, or wire with those fixes. *(not visible today)*
- **Estimate:** 0.5 h
- **Note:** Needs owner.

#### U196 · P3 · rule 2 — Duplicate catch-block toasts in the supplier PO screens

*POForm, POView, POList* — `src/pages/po/POForm.jsx:489, 616, 914, 1475, 1632; src/pages/po/POView.jsx:287, 314, 361, 389, 406, 505, 580, 637, 655, 871; src/pages/po/POList.jsx:132, 291`

- **What happens:** Each toasts after an axios failure the interceptor already toasted; a reject on a changed PO shows the conflict dialog plus a red toast; a failed activity write after a successful upload reports 'Failed to upload file'.
- **Fix:** toastUnlessHandled (WS7); give follow-up activity writes their own try. *(visible: one toast)*
- **Estimate:** 1.5 h

#### U209 · P3 · rule 4 — Supplier PO list: an older search response can overwrite a newer one

*POList* — `src/pages/po/POList.jsx:91-135`

- **What happens:** No request token: typing a supplier name then quickly picking a status can leave the search's rows and total under the status filter until the next refresh.
- **Fix:** Sequence-ref guard (or move onto useServerList). *(not visible)*
- **Estimate:** 0.5 h

#### U210 · P3 · correctness — POView's tax totals add per-line rounded values, so they can differ by a paisa from the form, the stored header and the print

*POView* — `src/pages/po/POView.jsx:673-675, 704-707`

- **What happens:** When lines carry stored tax values the view sums each line's rounded CGST/SGST; the form, the server header and the print add unrounded tax and round once. Two ₹10.10 lines at 5% show CGST ₹0.50 here and ₹0.51 everywhere else, and the components no longer add up to the grand total.
- **Fix:** Show the header's stored tax values when present; keep line values for the per-rate breakup only. *(visible: totals can change by a paisa)*
- **Estimate:** 1 h

#### U211 · P3 · rule 27 — POView shows the same status in two colours

*POView* — `src/pages/po/POView.jsx:176-185, 729-736; src/utils/statusConfig.js:62-71`

- **What happens:** The local STATUS_CONFIG makes Sent To Supplier magenta and Pending Approval gold, while the header's StatusTag uses PO_STATUS_CONFIG (cyan, processing); the timeline and header disagree in one dialog.
- **Fix:** Render the timeline's status tags with StatusTag and PO_STATUS_CONFIG. *(visible: timeline tags take the header's colours)*
- **Estimate:** 0.5 h

#### U212 · P3 · correctness — The PO print's "Approved By" name is always blank

*PO print* — `src/utils/poPdfGenerator.js:836; erp/purchaseorder/dto/PurchaseOrderDTO.java`

- **What happens:** The print reads po.approvedByName, which PurchaseOrderDTO does not have, so every printed PO has an empty name above Approved By while Prepared By is filled.
- **Fix:** Add approvedByName to the DTO from the approval, or drop the name line. *(visible: the approver's name appears)*
- **Estimate:** 1 h

#### U213 · P3 · rule 1 — Version history's change summary ignores line edits, and a load error reads as "no history"

*POVersionHistory* — `src/pages/po/POVersionHistory.jsx:36-57, 92-110, 131-137`

- **What happens:** getDiff compares only header fields (supplier, delivery date, grand total, line count, remarks), so a resubmit that swapped a line's variant shows no change; a failed /versions call shows 'No version history available'.
- **Fix:** Diff lines by id (variant, quantity, rate) plus PO date and T&C, and show an error state with Retry. *(visible: more change lines; an error panel)*
- **Estimate:** 2 h

#### U413 · P3 · correctness — On a PO with a revised delivery date the printed details strip has five cells in a four-column grid, so Tax Type wraps alone onto a second row beside three empty grey cells

*Supplier PO print* — `src/utils/poPdfGenerator.js:426-436, 682-706`

- **What happens:** A supplier PO whose delivery date was revised is printed: PO Date, PO Type, Delivery Date and Revised Delivery Date fill the first row, and Tax Type sits alone on a second row with the grid's grey background showing in the three empty cells. POs without a revision print a tidy single row.
- **Fix:** Use five columns when the revised date is present (or always reserve the cell), so the strip stays one row. *(visible: the revised-PO print strip is one row)*
- **Estimate:** 0.25 h
- **Note:** Carried over from batch 1's unverified list; verified by the lead on phase1.

## Inventory (GRN, QC, bill passing, issues, transfers, stock)

### P1

#### U214 · P1 · correctness — The "Received At (Branch)" choice is never sent to the API, so the GRN and its stock go to the PO's delivery branch

*Fabric / Accessories GRN form* — `src/services/inventory/inventoryService.js:426-495 (the request built at 481-494 has no branchId); src/pages/inventory/grn/FabricGRNForm.jsx:273, 427-429; src/pages/inventory/grn/AccessoriesGRNForm.jsx:261, 404-406; erp/inventory/grn/service/GRNService.java:208-215`

- **What happens:** In a multi-branch company the user picks Received At = Branch B for a PO delivered to Branch A and submits. buildGrnRequest drops branchId, so the server falls back to the PO's delivery branch A, and QC approval puts the stock at Branch A. Changing the branch on an edit is ignored the same way.
- **Fix:** Add branchId to the object buildGrnRequest returns. *(not visible (the saved branch matches what the user picked))*
- **Estimate:** 0.5 h

#### U215 · P1 · correctness — Reopening a saved Fabric QC replaces the recorded per-roll results with blank rows rebuilt from the GRN

*Fabric QC inspection* — `src/pages/inventory/qc/FabricQCInspection.jsx:82-107, 120-147; reached from src/pages/inventory/bill-passing/BpQcPanel.jsx:60-65 and BpAttachments.jsx:95-98`

- **What happens:** Opening a Draft or Referred-Back QC (or an Approved one through Bill Passing's QC No link) loads the saved rolls, then the materialise effect (deps selectedGRN/poLineItemId/grns) rebuilds them with actual width, GSM and result all null. Every roll shows undecided, and a Save Draft after any edit writes the blanks over the inspector's results.
- **Fix:** Rebuild rolls only when the user picks a GRN or line (or skip it when the rolls belong to the loaded QC), and map the saved width/GSM back on load. *(visible: an existing QC shows its saved per-roll results)*
- **Estimate:** 1.5 h

#### U216 · P1 · correctness — The standard width and GSM of each QC roll are never saved (UI sends stdWidth/stdGsm, the DTO expects width/gsm)

*Fabric QC inspection / QC view / QC report print* — `src/pages/inventory/qc/FabricQCInspection.jsx:128-140; src/pages/inventory/qc/FabricQCRollInspectionTable.jsx:41-42; src/pages/inventory/qc/QCViewModal.jsx:58-59; src/utils/fabricQCPdfGenerator.js:82-83, 131-142; erp/inventory/qc/dto/QCRollDTO.java:21-22; erp/inventory/qc/service/QCService.java:611-612`

- **What happens:** Every saved fabric QC roll stores width and GSM as null, so the QC view's Width/GSM columns are empty, the printed QC report shows '-' for the PO width/GSM, and the 4-point average is never calculated. A supplier-facing rejection report goes out without the specification it was measured against.
- **Fix:** Send width and gsm (from stdWidth/stdGsm) in the roll payload and read them back into the view and the edit table. *(visible: the view and the report show the standard width/GSM and the 4-point average)*
- **Estimate:** 1.5 h

#### U217 · P1 · correctness — Attachments, debits, issues and workflow actions adopt the server's bill and silently discard unsaved edits; Approve can pass figures the approver was not shown

*Bill Passing workspace* — `src/pages/inventory/bill-passing/BillPassingForm.jsx:79-84, 374-377, 402-404, 416-417; src/hooks/useBillWorkflow.js:18-24; src/pages/inventory/bill-passing/billWorkflowActions.js:42, 79, 92-103; erp/inventory/billpassing/controller/BpAttachmentController.java:36-37`

- **What happens:** A clerk ticks GRN lines and enters charges, then attaches the supplier invoice (required by BR-15), adds a debit or logs an issue: the returned bill replaces the local one, the edits vanish and the dirty flag clears. A verifier or approver who edits figures and then clicks Send for Approval or Approve passes the last saved figures, while the Approve confirmation shows the locally recalculated Net Payable.
- **Fix:** When the bill is dirty, save it before any workflow, debit, issue or attachment call (as Submit does) or block with 'Save your changes first'; for those responses merge only server-owned parts and the new version. *(visible: edits survive, or the user is asked to save first)*
- **Estimate:** 3 h

#### U218 · P1 · correctness — Late deliveries cannot be received: invoice and DC dates are capped at the PO's original delivery date and the revised date is ignored

*Fabric / Accessories GRN form* — `src/pages/inventory/grn/FabricGRNForm.jsx:461-467, 482-488; src/pages/inventory/grn/AccessoriesGRNForm.jsx:438-444, 459-465; src/utils/grnValidation.js:43-45, 55-57; src/services/inventory/inventoryService.js:49; erp/inventory/grn/service/GRNService.java:782-792`

- **What happens:** A supplier ships two weeks late with an invoice dated after the PO delivery date: the pickers disable that date and the server refuses 'Invoice date must fall within the PO date range', even when the PO's revised delivery date covers it. The goods cannot be received without amending the PO.
- **Fix:** Use revisedDeliveryDate ?? deliveryDate as the upper bound in UI and API, or allow late dates with a warning. *(visible: later dates become selectable)*
- **Estimate:** 2 h
- **Note:** Needs owner: decide whether late invoices are allowed with a warning or only up to the revised date.

#### U219 · P1 · correctness — GRNs from the previous financial year that are still QC-pending vanish from the QC GRN dropdown on 1 April

*QC inspection (Fabric and Accessories): GRN picker* — `src/services/inventory/inventoryService.js:617-629; erp/inventory/grn/service/GRNService.java:113-121`

- **What happens:** Goods received on 28 March and inspected on 2 April: the lookup sends no date range, the server applies the current-FY window, the GRN is not offered, no QC can be raised, and the goods never reach stock.
- **Fix:** Send an explicit wide dateStart for this status lookup, or skip the FY default for status=QC_Pending. *(not visible (older pending GRNs reappear))*
- **Estimate:** 1 h

#### U220 · P1 · rule 15 — The bulk issue registers only ever load the newest 25 issues

*Material Issue – Fabric / Accessories registers* — `src/services/inventory/materialIssueService.js:10-13; src/pages/inventory/issue/FabricIssueList.jsx:39-58, 152-160; src/pages/inventory/issue/AccessoriesIssueList.jsx:39-58, 163-171; erp/inventory/issue/dto/MaterialIssueRequests.java:85-86`

- **What happens:** The list sends only type and search, so the server returns its default first page of 25 and the table paginates those on the client. Once a branch has more than 25 fabric issues, 'Total Issues' shows 40 but older issues cannot be viewed, reprinted or cancelled, and the date filter searches only those 25. Search also refetches on every keystroke.
- **Fix:** Use server paging (page, size, dates, debounced search) as StockTransferList does. *(visible: the pager reaches every issue)*
- **Estimate:** 4 h

#### U221 · P1 · rule 15 — The stock registers show only the first 25 items

*Stock Register (Fabric / Accessories)* — `src/services/inventory/inventoryService.js:865-870, 913-918; src/pages/inventory/stock/FabricStockRegister.jsx:33-58, 97-104; src/pages/inventory/stock/AccessoriesStockRegister.jsx:43-57, 88-95; erp/inventory/stock/service/FabricStockService.java:70, 163-177`

- **What happens:** The register always requests page 0 of 25 and lets antd paginate that one page. A store with 60 fabric items shows 'Total Fabric Items 60', but only 25 rows can be reached without searching, and the Sub Category filter is built from those 25 rows.
- **Fix:** Pass the table's page and size to the server and render totalElements; debounce the search; take sub-category options from master data. *(visible: every stock item reachable)*
- **Estimate:** 4 h

#### U222 · P1 · correctness — Accessories issue ignores the BOM line's variant: same-item rows collide and FIFO takes another colour's lots

*Accessories Material Issue (bulk, Work Order)* — `erp/inventory/issue/service/MaterialIssueLookupService.java:148-158; erp/inventory/issue/service/MaterialIssueService.java:397-417; src/pages/inventory/issue/AccessoriesIssueForm.jsx:73-76, 96-99, 133-137; src/pages/inventory/issue/AccessoriesIssueItemTable.jsx:12-14, 68`

- **What happens:** A Work Order BOM with ZIP-001 Navy and ZIP-001 Black shows two identical rows sharing one key (id = itemId), with no colour. Entering 200 on the Navy row FIFO-consumes every lot of the item at the branch with no variant filter, so the older Black lot is decremented while Navy stays in stock; variant stock is silently wrong afterwards.
- **Fix:** Carry bomLineId and variantId on the lines, key rows by bomLineId, show the variant, and filter FIFO lots by the line's variant. *(visible: rows show variant code/colour)*
- **Estimate:** 8 h
- **Note:** API change (erp-purchase).

#### U223 · P1 · correctness — Opening stock is captured without a variant, so it never counts as stock for a variant BOM line

*Opening Stock batch form → Stock Register / Accessories Issue* — `src/pages/inventory/opening-stock/ItemPicker.jsx:11-58; src/pages/inventory/opening-stock/OpeningStockFabricRollTable.jsx:40-49; src/pages/inventory/opening-stock/OpeningStockAccessoriesItemTable.jsx:39-49; erp/inventory/openingstock/service/OpeningStockPostingService.java:116, 189; erp/production/common/service/StockPool.java:76-80`

- **What happens:** The picker and the CSV parse set only itemId, so every posted opening lot has no variant. The register shows 'Item Code —' for those rows, and for a Work Order whose BOM line names a variant StockPool skips them: the issue form shows Available 0 and blocks issuing stock that physically exists.
- **Fix:** Add a variant selector to opening-stock rows and the CSV template; fall back to itemCode in the register. *(visible: variant picker; register shows a code)*
- **Estimate:** 8 h

### P2

#### U224 · P2 · correctness — Multi-colour fabric lines share one id, and the roll picker cannot tell colours apart

*Fabric Material Issue (bulk, Cutting PO)* — `erp/inventory/issue/service/MaterialIssueLookupService.java:104-113; erp/inventory/issue/dto/IssuableRollDTO.java:12-29; src/pages/inventory/issue/FabricIssueForm.jsx:100-106, 134-141; src/pages/inventory/issue/FabricIssueRollPicker.jsx:112-121`

- **What happens:** A Cutting PO BOM with F-100 Navy and F-100 Black gives two line options with the same value; choosing Black resolves to Navy's line, rolls of both colours are offered with no colour column, and black rolls can be issued against the navy line.
- **Fix:** Key lines by bomLineId and add colour/variant to the roll picker, filtering or flagging other variants. *(visible: colour column)*
- **Estimate:** 5 h

#### U225 · P2 · correctness — Bulk accessories issues never store bomQty, so every line reads as excess and the gate pass prints BOM Qty 0

*Material Issue view / Accessories issue slip* — `erp/inventory/issue/service/MaterialIssueService.java:407; src/pages/inventory/issue/IssueViewDrawer.jsx:38-50; src/utils/issueSlipPdfGenerator.js:73, 76, 131, 138`

- **What happens:** Issue 150 buttons against a Work Order needing 200: the view shows a blank BOM Qty and '+150' excess, and the printed slip shows BOM Qty 0 and '—' for the item code.
- **Fix:** Pass the served BOM line's requirement into ofLot; fall back to itemCode in the slip. *(visible: correct BOM qty and item code)*
- **Estimate:** 2 h

#### U226 · P2 · correctness — Date-range filters drop records dated on the first day of the range

*Material Issue registers, QC lists* — `src/pages/inventory/issue/FabricIssueList.jsx:71-75; src/pages/inventory/issue/AccessoriesIssueList.jsx:70-74; src/pages/inventory/qc/FabricQCList.jsx:118-126; src/pages/inventory/qc/TrimsQCList.jsx:125-132`

- **What happens:** A client re-filter uses a strict isAfter(start of day), so filtering 14-Oct to 14-Oct (or 1-31 Oct) hides every record dated on the start day while the stat cards count them.
- **Fix:** Use !isBefore(start) && !isAfter(end), or let the server filter. *(visible: start-day records appear)*
- **Estimate:** 0.5 h

#### U227 · P2 · correctness — A Rejected QC shows an Edit button, but the form opens read-only

*Fabric / Accessories QC list and inspection* — `src/pages/inventory/qc/FabricQCList.jsx:27-31, 175-177; src/pages/inventory/qc/TrimsQCList.jsx:27-31, 178-180; src/pages/inventory/qc/FabricQCInspection.jsx:72-73; src/pages/inventory/qc/TrimsQCInspection.jsx:102; erp/inventory/qc/service/QCService.java:846, 853-856`

- **What happens:** The rejection dialog says the QC is returned to the creator for revision; the creator clicks Edit and gets a disabled form, although the API allows editing a Rejected QC.
- **Fix:** Make Rejected editable in the forms or remove it from the lists' editable statuses. *(visible)*
- **Estimate:** 1 h
- **Note:** Needs owner: the intended flow for a rejected QC.

#### U228 · P2 · correctness — Nothing prevents a second QC on the same GRN line

*QC inspection (Fabric and Accessories)* — `src/pages/inventory/qc/FabricQCInspection.jsx:192-195; src/pages/inventory/qc/TrimsQCInspection.jsx:201-207; erp/inventory/qc/service/QCService.java:213-217, 821-828`

- **What happens:** Two inspectors (or one user twice) raise QCs for the same line; if one is approved and the other rejected, the same rolls are both stocked and queued for return.
- **Fix:** Refuse a QC for a line that already has a non-Draft, non-Rejected QC, and disable those lines in the picker. *(visible: inspected lines disabled)*
- **Estimate:** 2 h
- **Note:** API change (erp-purchase).

#### U229 · P2 · rule 9 — API "not in the future" date checks use the UTC date, so today's date is rejected between 00:00 and 05:30 IST

*GRN / QC submit (API)* — `erp/inventory/grn/service/GRNService.java:774-784; erp/inventory/qc/service/QCService.java:569, 711`

- **What happens:** A night-shift receipt or inspection at 01:30 IST with today's invoice/DC/inspection date is refused as 'in the future' (LocalDate.now() is still yesterday in UTC), so users backdate it.
- **Fix:** Use LocalDate.now(businessClock), which these services already inject for the FY. *(not visible)*
- **Estimate:** 0.5 h
- **Note:** API change (erp-purchase).

#### U230 · P2 · rule 15 — The GRN and QC lists load only the newest 100 records of the year

*GRN list / QC lists* — `src/services/inventory/inventoryService.js:149-154, 574-580; src/pages/inventory/grn/GRNList.jsx:53, 161-167; src/pages/inventory/qc/FabricQCList.jsx:203-211; src/pages/inventory/qc/TrimsQCList.jsx:206-214`

- **What happens:** Past 100 GRNs or QCs in a year the 'Total GRNs' card says 340 while paging stops at 100; older records can be reached only by searching.
- **Fix:** Server paging as the Bill Passing list does. *(visible: all records reachable)*
- **Estimate:** 3 h

#### U231 · P2 · rule 16, rule 4 — Search fires on every keystroke with no debounce and no stale-response guard

*GRN list / QC lists* — `src/pages/inventory/grn/GRNList.jsx:43-64, 156; src/pages/inventory/qc/FabricQCList.jsx:58-74, 102-104, 199; src/pages/inventory/qc/TrimsQCList.jsx:66-82, 110, 202`

- **What happens:** Typing 'GRN/26-27/0123' quickly on a slow line can let the response for 'GRN/2' land last and show the wrong rows.
- **Fix:** useDebouncedSearch plus a request-sequence guard. *(not visible)*
- **Estimate:** 1.5 h

#### U232 · P2 · correctness — Three QC list columns are always blank (Fabric Description, Item Description, Category)

*Fabric / Accessories QC list* — `src/pages/inventory/qc/FabricQCList.jsx:156; src/pages/inventory/qc/TrimsQCList.jsx:159-160; src/pages/inventory/qc/FabricQCInspection.jsx:250-270; erp/inventory/qc/dto/QCResponse.java:37-39`

- **What happens:** The payload never sets fabricDescription and the response has no itemDescription or category, so those columns are empty and the search box cannot match them.
- **Fix:** Send fabricDescription and add itemDescription/category to the response (or drop the columns). *(visible: columns populated)*
- **Estimate:** 1.5 h

#### U233 · P2 · rule 8, rule 5 — Accessories QC has no unsaved-changes guard, sends no version, and fails silently on load

*Accessories QC inspection* — `src/pages/inventory/qc/TrimsQCInspection.jsx:83-129, 255-271`

- **What happens:** An inspector ticks 12 criteria and clicks Back: everything is lost without the prompt the Fabric screen shows; two users saving one draft overwrite each other; a failed load leaves an empty form that looks new.
- **Fix:** Add useUnsavedChanges, send version, and add a loading state with a catch. *(visible: leave prompt and loading skeleton)*
- **Estimate:** 1 h

#### U234 · P2 · correctness — After a reversal request in the view modal, the GRN list keeps the old status and actions

*GRN list / GRN view modal* — `src/pages/inventory/grn/GRNViewModal.jsx:158; src/pages/inventory/grn/GRNList.jsx:172-176`

- **What happens:** The row still shows QC Pending with Cancel and Edit after the modal closes, and Cancel then fails with a transition error until a reload.
- **Fix:** Pass onUpdated from GRNList to reload, as the QC lists do. *(visible: the row refreshes)*
- **Estimate:** 0.5 h

#### U235 · P2 · rule 5 — A failed Post on a new batch leaves an orphan draft, and the retry creates a second batch that can double stock

*Opening Stock batch form* — `src/pages/inventory/opening-stock/OpeningStockBatchForm.jsx:172-189; erp/inventory/openingstock/service/OpeningStockPostingService.java:103-108, 170-182`

- **What happens:** Post creates draft OSB-ACC-0007, then posting fails (a UOM mismatch); the saved id is not kept, so the retry creates and posts OSB-ACC-0008 while 0007 stays a draft with the same rows; posting 0007 later doubles the accessories stock.
- **Fix:** Adopt the saved batch as soon as the save returns, before posting. *(not visible)*
- **Estimate:** 1 h

#### U236 · P2 · rule 7 — The item picker shows raw numeric ids for loaded rows, and index row keys mix rows up

*Opening Stock batch form* — `src/pages/inventory/opening-stock/ItemPicker.jsx:12, 46-57; src/pages/inventory/opening-stock/OpeningStockFabricRollTable.jsx:40-49, 112, 118; src/pages/inventory/opening-stock/OpeningStockAccessoriesItemTable.jsx:39-49, 98, 104`

- **What happens:** After a CSV load or reopening a draft the Item column shows '1043', '1044'…; deleting row 3 shifts the index keys so row 4's picker inherits row 3's options. The columns' useMemo also omits patch.
- **Fix:** Seed each picker's options from the row and give rows a monotonic client key. *(visible: item codes instead of numbers)*
- **Estimate:** 2 h

#### U237 · P2 · rule 8 — Opening Stock has no unsaved-changes guard, so a long manual or CSV entry is lost on navigation

*Opening Stock batch form* — `src/pages/inventory/opening-stock/OpeningStockBatchForm.jsx:35-62, 283`

- **What happens:** 200 rows entered or loaded, then a sidebar click or Back discards everything without a prompt.
- **Fix:** useUnsavedChanges with a dirty flag cleared on save/post. *(visible: leave prompt)*
- **Estimate:** 1 h

#### U238 · P2 · correctness — The allowance report checks at most 100 GRNs with one call per GRN, and flags Draft GRNs

*GRN Allowance Exceptions* — `src/services/inventory/inventoryService.js:149-154, 263-287; src/pages/inventory/allowance/AllowancePage.jsx:34-47`

- **What happens:** A month with 140 GRNs silently misses over-allowance receipts among the older 40, fires up to 100 parallel detail requests, and counts unsubmitted drafts as supplier over-supply.
- **Fix:** A server endpoint for offending lines in the range, excluding Draft. *(visible: missing GRNs appear, drafts drop out)*
- **Estimate:** 4 h

#### U239 · P2 · rule 5 — Create versus update is decided by the route id, so a quick second Save makes a duplicate draft transfer

*Stock Transfer form* — `src/pages/inventory/transfer/StockTransferForm.jsx:51-52, 178-187; erp/inventory/transfer/service/StockTransferService.java:125-136, 335-372`

- **What happens:** Save Draft on a new accessories transfer navigates to /inventory/transfer/:id; a second Save before that commits POSTs again, giving two STN drafts with the same lines. Accessories are not guarded like fabric rolls, so both can be dispatched and move twice the stock.
- **Fix:** Keep the saved id in state and choose PUT/POST from the record in hand. *(not visible)*
- **Estimate:** 1 h

#### U240 · P2 · correctness — The category filter is a hard-coded list of 7 names that does not match stored categories

*Accessories Stock Register* — `src/pages/inventory/stock/AccessoriesStockRegister.jsx:20-28, 86; erp/inventory/stock/service/StockPopulationService.java:251; erp/inventory/openingstock/service/OpeningStockPostingService.java:192-193`

- **What happens:** GRN trims store their sub-category ('Hang Tag', 'Poly Bag') and opening stock stores the top category ('Trims'); the dropdown offers only Buttons, Zippers, Labels, Thread, Elastic, Interlining, Packaging, so most categories cannot be filtered.
- **Fix:** Build options from master data and store one consistent category on opening lots. *(visible: real categories)*
- **Estimate:** 2 h

#### U241 · P2 · rule 17 — The 'Pending Issues' card builds full BOM stock for every approved PO on each visit

*Material Issue registers* — `src/pages/inventory/issue/FabricIssueList.jsx:54-58, 136; src/pages/inventory/issue/AccessoriesIssueList.jsx:54-58, 147; erp/inventory/issue/service/MaterialIssueLookupService.java:48-62, 100-146`

- **What happens:** Each register visit computes stock-by-BOM for every approved PO just to count them, so load time grows with PO count, and the card shows approved POs rather than issues pending.
- **Fix:** A lightweight count endpoint. *(visible: the card value may change)*
- **Estimate:** 3 h

#### U242 · P2 · correctness — Total Variance adds quantities across different units

*Stock Adjustment register / view* — `erp/inventory/adjustment/service/StockAdjustmentService.java:199-212; src/pages/inventory/adjustment/StockAdjustmentList.jsx:109-118, 140-148, 174; src/pages/inventory/adjustment/AdjustmentViewDrawer.jsx:11-12`

- **What happens:** -50 pcs of buttons and +20 m of elastic is stored as total variance -30 'pcs', and the stat card adds kg, pcs and m together.
- **Fix:** Show totals per unit or drop the mixed total. *(visible: per-unit totals)*
- **Estimate:** 2 h

#### U243 · P2 · rule 37 — "Adjusted By" on a stock adjustment is taken from the request body

*Stock Adjustment form (API)* — `src/pages/inventory/adjustment/StockAdjustmentForm.jsx:123-124, 144; erp/inventory/adjustment/service/StockAdjustmentService.java:177-179`

- **What happens:** The server keeps any non-blank adjustedBy it receives, so a crafted request can record someone else as the counter on a stock correction.
- **Fix:** Use the authenticated actor on the server and stop sending the field. *(not visible)*
- **Estimate:** 1 h
- **Note:** API change (erp-purchase).

### P3

#### U244 · P3 · correctness — Reopened draft lines are keyed by line id, so 'Add' on an already-picked roll duplicates it

*Stock Transfer form* — `src/pages/inventory/transfer/StockTransferForm.jsx:85-99, 144-150, 266-267`

- **What happens:** On a reopened draft the candidate row for a roll already on the transfer reads Add instead of Update; clicking it appends a second line and Save fails 'the same roll is on the transfer twice'.
- **Fix:** Key hydrated lines with the candidates' row id. *(visible: the button reads Update)*
- **Estimate:** 1 h

#### U245 · P3 · rule 5 — Draft transfers and opening batches have no optimistic lock, so the last writer silently wins

*Stock Transfer / Opening Stock forms (API)* — `src/pages/inventory/transfer/StockTransferForm.jsx:164-175; erp/inventory/transfer/service/StockTransferService.java:138-145; src/pages/inventory/opening-stock/OpeningStockBatchForm.jsx:125-136; erp/inventory/openingstock/service/OpeningStockService.java:127-142`

- **What happens:** Two users editing the same draft: the second save replaces all lines with no conflict.
- **Fix:** Send and check @Version (saveAndFlush so the echo is fresh). *(not visible)*
- **Estimate:** 2 h

#### U246 · P3 · rule 7 — The success dialog uses static Modal.confirm instead of App.useApp().modal

*Return to Supplier – New Return* — `src/pages/inventory/return-to-supplier/ReturnToSupplierForm.jsx:4, 109-123`

- **What happens:** The static dialog ignores the app theme (dark tokens) and antd warns that static functions cannot consume context.
- **Fix:** Use modal from App.useApp(). *(visible: the dialog follows the theme)*
- **Estimate:** 0.5 h

#### U247 · P3 · rule 36 — Inventory print generators use private escapers, leave the GRN UOM unescaped, total mixed units, and fail silently on a blocked pop-up

*GRN, QC and issue prints* — `src/utils/grnPdfGenerator.js:77-85, 654, 729-733; src/utils/fabricQCPdfGenerator.js:37, 148-150, 181-184; src/utils/trimsQCPdfGenerator.js:25; src/utils/issueSlipPdfGenerator.js:848-860`

- **What happens:** rows[0].uom is written raw (master-controlled, low risk); the GRN grand total sums kg, m and pcs under the first line's unit; the Fabric QC status badge is always amber because it compares 'Pass' with 'PASS'; the issue slip can call print() twice; a blocked pop-up only logs to the console.
- **Fix:** Move onto printDoc.js esc/openPrintWindow, show per-unit totals, compare case-insensitively, print once, and warn when blocked. *(visible: totals line, badge colour, pop-up warning)*
- **Estimate:** 2 h

#### U248 · P3 · correctness — The PO picker stays editable on an existing GRN, but the API refuses a PO change

*Fabric / Accessories GRN form* — `src/pages/inventory/grn/FabricGRNForm.jsx:432; src/pages/inventory/grn/AccessoriesGRNForm.jsx:409; erp/inventory/grn/service/GRNService.java:492-496`

- **What happens:** Switching the PO on a draft clears every roll; after re-entering them, Save is refused 'cannot be moved to another purchase order'.
- **Fix:** Disable the PO select in edit mode. *(visible: PO field disabled in edit)*
- **Estimate:** 0.25 h

#### U249 · P3 · rule 9 — PO, received and balance quantities show 1 decimal although quantities carry 3

*GRN form: PO line picker* — `src/pages/inventory/grn/POLineItemPicker.jsx:30-31, 45`

- **What happens:** A balance of 1,903.125 KG shows as 1,903.1; keying the rounded figure gives a 'short' notice.
- **Fix:** formatNumber(v, 3). *(visible: 3 decimals)*
- **Estimate:** 0.25 h

#### U250 · P3 · rule 34 — Dead inventory code: issue edit mode and routes, mock exports, and the mock-only toISOString date

*Inventory screens* — `src/App.jsx:408, 410; src/pages/inventory/issue/FabricIssueForm.jsx:54-93, 216-222; src/pages/inventory/issue/AccessoriesIssueForm.jsx:56-90, 113-119; src/services/inventory/inventoryService.js:26, 935-960, 1113-1130`

- **What happens:** Nothing navigates to the issue edit routes (saving there only says 'cannot be amended'); the mock list exports have no callers; Appendix B's toISOString date at inventoryService.js:1125 runs only in the mock branch, which is dead while USE_MOCK_INVENTORY_DATA is false.
- **Fix:** Remove the edit routes, edit-mode hydration and mock exports. *(not visible)*
- **Estimate:** 1.5 h

#### U251 · P3 · rule 2 — Duplicate catch-block toasts across the inventory screens

*Inventory screens* — `src/pages/inventory/grn/FabricGRNForm.jsx:80, 137, 314, 332; src/pages/inventory/grn/AccessoriesGRNForm.jsx:78, 129, 291, 309; src/pages/inventory/grn/GRNList.jsx:56, 77, 97; src/pages/inventory/grn/GRNViewModal.jsx:117; src/pages/inventory/grn/GRNApprovalActions.jsx:66; src/pages/inventory/grn/CancelGRNModal.jsx:33; src/pages/inventory/qc/FabricQCInspection.jsx:77-78, 105, 291, 311; src/pages/inventory/qc/TrimsQCInspection.jsx:106-107, 288, 304; src/pages/inventory/qc/FabricQCList.jsx:70, 94; src/pages/inventory/qc/TrimsQCList.jsx:78, 102; src/pages/inventory/qc/QualityControlPage.jsx:46; src/pages/inventory/bill-passing/BillPassingViewModal.jsx:59; src/pages/inventory/issue/FabricIssueForm.jsx:51, 88, 115, 247; src/pages/inventory/issue/AccessoriesIssueForm.jsx:53, 85, 143; src/pages/inventory/issue/FabricIssueList.jsx:46; src/pages/inventory/issue/AccessoriesIssueList.jsx:46; src/pages/inventory/issue/CancelIssueModal.jsx:38; src/pages/inventory/transfer/StockTransferForm.jsx:106, 119, 129, 189, 203, 235; src/pages/inventory/transfer/StockTransferList.jsx:53; src/pages/inventory/adjustment/StockAdjustmentForm.jsx:68, 83, 102, 158; src/pages/inventory/adjustment/StockAdjustmentList.jsx:58; src/pages/inventory/allowance/AllowancePage.jsx:40; src/pages/inventory/opening-stock/OpeningStockBatchForm.jsx:79, 153, 185, 200; src/pages/inventory/opening-stock/CsvUploadCard.jsx:38, 53; src/pages/inventory/opening-stock/OpeningStockDashboard.jsx:58, 75; src/pages/inventory/return-to-supplier/ReturnToSupplierForm.jsx:49, 68, 132; src/pages/inventory/return-to-supplier/ReturnToSupplierList.jsx:39; src/pages/inventory/return-to-supplier/ReturnToSupplierDetailDrawer.jsx:43; src/pages/inventory/stock/FabricStockRegister.jsx:43; src/pages/inventory/stock/AccessoriesStockRegister.jsx:53; src/pages/inventory/dashboard/InventoryDashboard.jsx:38`

- **What happens:** Any refused save or failed load shows the server message twice, or the server message plus a generic one. Bill Passing and the sample issue forms already use the right pattern.
- **Fix:** toastUnlessHandled (WS7). *(visible: one toast)*
- **Estimate:** 3 h

#### U252 · P3 · rule 14 — Un-memoised columns in inventory tables

*Inventory screens* — `src/pages/inventory/qc/FabricQCParameters.jsx:54-165; src/pages/inventory/transfer/StockTransferForm.jsx:246, 272; src/pages/inventory/opening-stock/OpeningStockDashboard.jsx:88; src/pages/inventory/return-to-supplier/ReturnToSupplierDetailDrawer.jsx:61, 134; src/pages/inventory/stock/AccessoriesStockViewDrawer.jsx:162`

- **What happens:** Columns rebuild on every keystroke, re-rendering every row.
- **Fix:** useMemo (WS6). *(not visible)*
- **Estimate:** 1.5 h

#### U253 · P3 · rule 33 — Keyboard and screen-reader gaps: mouse-only row openers, a clickable Tag, unlabeled controls

*Inventory screens* — `src/pages/inventory/stock/FabricStockRegister.jsx:104-107; src/pages/inventory/stock/AccessoriesStockRegister.jsx:95-98; src/pages/inventory/opening-stock/OpeningStockDashboard.jsx:198-201; src/pages/inventory/return-to-supplier/ReturnToSupplierList.jsx:101-104; src/pages/inventory/issue/AwaitingSrsAlert.jsx:28-33; src/pages/inventory/adjustment/AdjustmentFilterCard.jsx:27-60; src/pages/inventory/grn/FabricGRNRollTable.jsx:251-267`

- **What happens:** A keyboard user cannot open a stock item, opening batch or return (row click only); SR chips are clickable Tags; filter Selects and icon-only add/remove roll buttons have no accessible name.
- **Fix:** A view link per row, buttons for chips, aria-labels/ids. *(visible: a view link per row)*
- **Estimate:** 2.5 h

#### U254 · P3 · rule 1, rule 9 — The count sheet shows no loading state, and the posted-batch banner prints raw numbers

*Stock Adjustment / Opening Stock forms* — `src/pages/inventory/adjustment/StockAdjustmentForm.jsx:249-253; src/pages/inventory/adjustment/AdjustmentCountTable.jsx:23, 101-113; src/pages/inventory/opening-stock/OpeningStockBatchForm.jsx:235`

- **What happens:** While a category's count sheet loads the card still says 'Select category to load items'; a posted batch shows 'total value ₹125000.0000'.
- **Fix:** Pass loading to the table; format the banner. *(visible: spinner and formatted figures)*
- **Estimate:** 0.5 h

## Production (cutting, sewing, packing, production masters)

### P1

#### U255 · P1 · rule 9 — Panel issues and process returns recorded before 05:30 IST are dated the previous day

*Cutting — panel issue and process return* — `src/pages/production/cutting/PanelIssueDrawer.jsx:55; src/pages/production/cutting/ProcessReturnDrawer.jsx:91; erp/production/cuttingroom/service/CutExternalProcessService.java:107, 177`

- **What happens:** Both drawers send new Date().toISOString().slice(0, 10), the UTC date, and the server stores it as the issue/return date. A night shift issuing panels to a job worker at 02:00 IST on 15-Oct records 14-Oct, which then drives the DC, the job-work tracker and any ageing by date.
- **Fix:** Send dayjs().format('YYYY-MM-DD') (local date). *(not visible (dates become correct))*
- **Estimate:** 0.25 h
- **Note:** Appendix B bug 6. Its third cited site, src/services/inventory/inventoryService.js:1125, is in the mock branch (USE_MOCK_INVENTORY_DATA is false) and is dead code, not a live bug.

#### U256 · P1 · rule 34 — "Import CAD Marker Excel" imports nothing: it overwrites the plan with hard-coded demo markers

*Cutting › Marker Plan form* — `src/pages/production/cutting/MarkerPlanForm.jsx:91-105; src/pages/production/cutting/MarkerMatrix.jsx:132`

- **What happens:** No file picker opens: widths become 59.5/57, allowance 5%, and the planner's markers are replaced by three invented rows (heights 100/66/40, fake file names) with a success toast; with fewer than 4 sizes the ratio gets an 'undefined' key. Saving stores the invented markers, from which cut quantities and lays are derived.
- **Fix:** Hide the button until a real CAD import exists (or wire it to an upload and server parse); never replace entered markers without asking. *(visible: the button disappears (or opens a file picker))*
- **Estimate:** 1 h

#### U257 · P1 · correctness — Work Order # is pre-filled with the demo value 'WO/26-27/1001' and saved as-is

*Cutting › Bundling › Issue to Sewing* — `src/pages/production/cutting/BundleIssueDrawer.jsx:12, 28, 32, 66; erp/production/cuttingroom/service/CutBundlingService.java:198`

- **What happens:** Issuing bundles without retyping the box records work order WO/26-27/1001 (free text, unvalidated), which sewing's Cut Parts Receipt and the issues register then show; the box is not cleared after a save, so the next issue repeats it.
- **Fix:** Start empty (or pick from the Cut PO's approved work orders) and clear after each save. *(visible: the box starts empty)*
- **Estimate:** 1 h

#### U258 · P1 · correctness — The mandatory re-cut 'Line' and the line filter use a hard-coded demo list, not the production-line master

*Cutting › Re-Cut Register* — `src/pages/production/cutting/ReCutRegisterTab.jsx:9, 73, 92, 113; src/utils/cuttingConstants.js:65`

- **What happens:** The dropdown offers only Line-A, Line-B, B-1, B-2; the factory's real lines are absent and the field is required, so every re-cut is saved against a fictitious line and the filter never matches real data.
- **Fix:** Feed both selects from useSewingMasters().lineOptions. *(visible: real line names)*
- **Estimate:** 1 h

#### U259 · P1 · correctness — The TMB gate is client-only, judged per Cut PO rather than per lay, from the newest 200 checks

*Cutting › Bundling › Generate Bundles* — `src/pages/production/cutting/BundlingDrawer.jsx:37-41, 67, 87-90; src/pages/production/cutting/BundlingTab.jsx:29; src/services/production/cuttingApi.js:161-164; erp/production/cuttingroom/service/CutBundlingService.java:107-160`

- **What happens:** A Cut PO with 4 cut lays and a PASSED TMB check only for lay 1 can bundle and issue the 3 unchecked lays (against BR-FR-06-07); the server's generate has no TMB check. Once there are more than 200 TMB checks, an older Cut PO's checks fall out of the list and 'Auto-Generate Bundles' is disabled for good.
- **Fix:** Enforce 'every reported lay has a PASSED TMB check' in CutBundlingService.generate and return the blocking reason from the preview endpoint. *(not visible (the button is enabled or blocked correctly))*
- **Estimate:** 4 h
- **Note:** API change (erp-purchase).

#### U260 · P1 · rule 15 — Every cutting list fetches only the newest 200 rows, which breaks bundling, TMB checks and panel-check edits as history grows

*Cutting registers and the pickers built from them* — `src/services/production/cuttingApi.js:44, 61, 82, 136, 162, 198, 221, 233, 251, 261, 275; src/pages/production/cutting/TmbCheckForm.jsx:30, 89-91; src/pages/production/cutting/PanelCheckForm.jsx:32-37; src/pages/production/cutting/FabricRelaxationDrawer.jsx:93; src/pages/production/cutting/ProcessReturnDrawer.jsx:21, 117`

- **What happens:** A week or two after go-live there are more than 200 lay audits: an older lay cannot be picked for a TMB check, 'Receive from Vendor' no longer lists an older open panel issue, an older panel check spins forever (looked up in the list), and the registers stop at 200 with no hint.
- **Fix:** Server paging for the registers; pickers query by filter (Cut PO, open issues); load a panel check by id. *(visible: registers page through the full history)*
- **Estimate:** 8 h

#### U261 · P1 · rule 4, rule 8 — Changing date, shift or plan keeps the previous sheet's id, so a save moves that sheet to the new slot; unsaved rows are discarded without warning

*Sewing › Hourly Production* — `src/pages/production/sewing/HourlyProductionTab.jsx:52-63, 87-95, 107, 133-139; erp/production/sewing/service/SewHourlyService.java:87-93, 175-178`

- **What happens:** With 14-Oct's sheet open the supervisor changes the date to 13-Oct; before the load returns (or if it fails) the grid still holds 14-Oct's sheet id, and Save posts that id with sheetDate 13-Oct, so the server rewrites the 14th's sheet as the 13th's. Switching plans quickly can save one line's rows onto another plan. Typed rows are lost on any selector change.
- **Fix:** Clear the sheet while switching and drop stale responses; build the payload from the loaded sheet's own plan/date/shift; confirm before discarding unsaved rows. *(visible: a brief spinner and a discard confirm)*
- **Estimate:** 3 h

#### U262 · P1 · correctness — No screen enrols sewing operators or maintains SAM sheets, so the hourly grid has no operators to book against

*Sewing › Hourly Production / Operators & SAM* — `src/services/production/sewingApi.js:17-22, 37-42; src/pages/production/sewing/HourlyGrid.jsx:25-29; src/pages/production/sewing/OperatorSamTab.jsx:9-92; erp/production/sewing/service/SewOperatorService.java:59-67`

- **What happens:** saveOperator and saveStyleSam have no caller and nothing seeds operators. On a fresh production database the Tailor dropdown is empty, so hourly output (and efficiency, incentives, skill matrix) cannot be recorded, and 'Load from SAM Sheet' always says none exists.
- **Fix:** Add operator enrolment and SAM-sheet editors calling the existing endpoints. *(visible: new add/edit forms)*
- **Estimate:** 12 h
- **Note:** Needs owner: confirm the go-live scope of hourly production.

### P2

#### U263 · P2 · correctness — Cutting and Sewing never check add/update/approve in the UI: view-only users see and can try every write action

*Cutting and Sewing workspaces* — `src/App.jsx:330-346; src/pages/production/cutting/FabricReceiptList.jsx:52, 63; BundlingTab.jsx:69-70; ReconciliationTab.jsx:111, 119, 175; MarkerPlanForm.jsx:165, 215-218; ExternalProcessTab.jsx:94-102; src/pages/production/sewing/CutPartsReceiptList.jsx:55; HourlyProductionTab.jsx:149; GarmentIssueList.jsx:63; erp application.properties:329 (ENFORCE) vs application-qa/dev.properties (AUDIT)`

- **What happens:** A supervisor with view-only rights on production-cutting sees Generate Bundles, Issue to Sewing, Return Roll and 'Mark Size-Set Approved'. In production (ENFORCE) the server refuses them with an error; on QA and dev (AUDIT) they succeed.
- **Fix:** Gate each create/save/issue/return button with hasPermission(module, op), put size-set approval behind 'approve', and make the /:id forms read-only without 'update'. *(visible: users without add/update no longer see those buttons)*
- **Estimate:** 6 h

#### U264 · P2 · rule 4 — End-bit weight is saved on every keystroke, so out-of-order or colliding saves can store a partial weight that is then credited to stock

*Cutting › Reconciliation* — `src/pages/production/cutting/ReconciliationTab.jsx:44-47, 79, 86; erp/production/cuttingroom/service/CutReconciliationService.java:122-137, 188`

- **What happens:** Typing 12.75 sends PUTs for 1, 12, 12.7 and 12.75; the first inserts can collide on the unique key, and if an earlier response lands last the roll keeps 12.7 or 1, which 'Return End-Bit' then credits back to fabric stock.
- **Fix:** Save on blur/Enter, one request at a time, dropping stale responses (same for Reusable). *(visible: the weight saves when the cell is left)*
- **Estimate:** 1.5 h

#### U265 · P2 · rule 1 — Add Re-Cut Entry has no in-flight guard: a double click posts duplicates that the UI cannot delete

*Cutting › Re-Cut Register* — `src/pages/production/cutting/ReCutRegisterTab.jsx:72-81, 102; erp/production/cuttingroom/service/CutRecutService.java:62-86`

- **What happens:** A double click on a slow connection saves two identical re-cut rows, doubling re-cut qty, re-cut % and the fabric charged to reconciliation; there is no delete in the UI, and a failed POST is an unhandled rejection.
- **Fix:** A saving state on the modal's OK (confirmLoading), early return while saving, try/finally. *(visible: the OK button spins)*
- **Estimate:** 0.5 h

#### U266 · P2 · rule 5 — A quick second Save after creating a plan POSTs a duplicate plan

*Sewing › Production Plan form* — `src/pages/production/sewing/SewingPlanForm.jsx:41-63, 108-120`

- **What happens:** The create path navigates to /plan/:id without adopting the saved plan, so plan.id stays empty until the route commits; a second Save in that window creates a second plan for the same line.
- **Fix:** setPlan(saved) before navigating and decide create-vs-update from plan.id. *(not visible)*
- **Estimate:** 0.5 h

#### U267 · P2 · correctness — 'Save & Print DC', 'Save & Print Receipt' and 'Issue & Print Note' print nothing, and the bundle ticket is a mock-up

*Cutting › External Process / Bundling* — `src/pages/production/cutting/PanelIssueDrawer.jsx:56, 71; src/pages/production/cutting/ProcessReturnDrawer.jsx:109; src/pages/production/cutting/BundleIssueDrawer.jsx:54; src/pages/production/cutting/BundleTicketPreview.jsx:13, 22-23, 39-42; src/pages/production/cutting/BundlingTab.jsx:47`

- **What happens:** Sending panels to an embroiderer with 'Save & Print DC' toasts 'DC ready to print' but produces no challan, so goods leave without the delivery challan the gate and GST job-work rules need; the bundle ticket shows a placeholder QR stamped with today's date.
- **Fix:** Build the prints with printDoc.js (escaping every value), or rename the buttons to Save/Issue until printing exists. *(visible: a print window opens, or the labels lose 'Print')*
- **Estimate:** 8 h
- **Note:** Needs owner: build the challan prints now or relabel for go-live.

#### U268 · P2 · correctness — Cutting lookups, thresholds and fabric types (relaxation hours) have no maintenance screen

*Production Masters* — `src/services/production/cuttingMasterService.js:8-22; src/pages/production/masters/ProductionMastersPage.jsx:17-26; erp/masterdata/cuttinglookup/CuttingLookupController.java:42-47`

- **What happens:** Adding a re-cut reason, changing TMB_TOLERANCE_CM or RECUT_ALERT_PCT, or setting Denim to 48 h relaxation needs a database edit, although the API has POST/PUT.
- **Fix:** Add 'Cutting Lookups & Thresholds' and 'Fabric Types' tabs on ProductionMasterPanel. *(visible: two new tabs)*
- **Estimate:** 4 h

#### U269 · P2 · correctness — On a saved plan the SAM / Target / CM tiles show the saved figures while editing, not the live preview

*Sewing › Production Plan form* — `src/pages/production/sewing/SewingPlanForm.jsx:116, 216-222`

- **What happens:** Changing operators from 6 to 8 keeps Target/Hour, Target/Day, Garment SAM and CM Rate at the last saved values until Save, so line loading is judged on stale numbers.
- **Fix:** Show the locally computed values while the plan has unsaved changes. *(visible: tiles update as fields change)*
- **Estimate:** 1 h

#### U270 · P2 · correctness — Partly filled rows are silently dropped on save

*Sewing › Parts Replacement / Cutting › Panel Issue* — `src/pages/production/sewing/PartsReplacementDrawer.jsx:86-96; src/pages/production/cutting/PanelIssueDrawer.jsx:44-46`

- **What happens:** Three rejected parts with one missing its damage reason saves two parts with a normal toast; the third never reaches cutting.
- **Fix:** Refuse to save while a row is incomplete and name it. *(visible: a warning naming the row)*
- **Estimate:** 1 h

#### U271 · P2 · rule 17 — The Bundling tab loads every bundle ever cut, and each issue re-reads all bundles of its Cut PO

*Cutting › Bundling* — `src/services/production/cuttingApi.js:202-205; src/pages/production/cutting/BundlingTab.jsx:29; erp/production/cuttingroom/service/CutBundlingService.java:57-62, 261-264`

- **What happens:** After a season (tens of thousands of bundles) opening Bundling pulls the whole table into the browser and the issue list runs one bundle query per issue; it gets slower every week.
- **Fix:** Page bundles server-side and load bundled bundles per Cut PO in the drawer. *(not visible)*
- **Estimate:** 4 h

#### U272 · P2 · correctness — The 'Fabric Utilization' KPI is the utilization of whichever Cut PO happens to be first

*Cutting › Dashboard* — `src/pages/production/cutting/CuttingDashboard.jsx:21-26, 36`

- **What happens:** 'Fabric Utilization 92%' reads as the cutting room's figure but is getReconciliation(pos[0]) for one arbitrary Cut PO.
- **Fix:** Return a plant-level figure, or label the tile with its Cut PO. *(visible)*
- **Estimate:** 1 h

#### U273 · P2 · correctness — Changing the order on a new entry keeps the carton groups built for the previous order

*Packing › Carton Packing form* — `src/pages/production/packing/CartonPackingForm.jsx:158-186`

- **What happens:** Picking Order A, adding carton ranges, then switching to Order B keeps A's buyer POs and size keys (hidden from the grid), all saved against B; the server does not check sizes against the entry.
- **Fix:** Confirm and clear the groups on an order change. *(visible: a confirm)*
- **Estimate:** 1 h

#### U274 · P2 · correctness — A COMPLETED packing entry can be deleted although it cannot be edited

*Packing › Carton Packing register (API)* — `src/pages/production/packing/CartonPackingColumns.jsx:145-155; erp/production/packing/service/PackingEntryService.java:120-122, 173-178`

- **What happens:** Delete has no status check on the server, so a completed entry that packing lists are built from can be removed and its cartons vanish from those documents; update refuses completed entries.
- **Fix:** Refuse delete unless OPEN on the server and hide Delete on completed rows. *(visible: no Delete on completed rows)*
- **Estimate:** 1 h
- **Note:** API change (erp-purchase).

#### U275 · P2 · correctness — The Inspector picker offers only the first 200 active employees

*Sewing › Measurement / End-Line Check forms* — `src/pages/production/sewing/MeasurementReportForm.jsx:55, 226-229; src/pages/production/sewing/TopseForm.jsx:44, 190-193`

- **What happens:** With more than 200 active employees (normal with tailors on payroll) the inspector may be missing, and the field is required; an inspector beyond 200 shows as a bare id when editing.
- **Fix:** Search the employee API (debounced) and include the saved inspector as an option. *(visible: typing searches all employees)*
- **Estimate:** 2 h

#### U276 · P2 · rule 4 — Two photo uploads in quick succession keep only the last; the first file is orphaned

*Sewing › Measurement Report form* — `src/pages/production/sewing/MeasurementReportForm.jsx:155-164`

- **What happens:** Both upload callbacks patch from the same report.photos, so the second overwrites the first and the report saves with one photo.
- **Fix:** Append with a functional state update. *(not visible)*
- **Estimate:** 0.5 h

### P3

#### U277 · P3 · rule 1 — Endless spinner when there is no Cut PO to show

*Cutting › Cutting Report / Reconciliation* — `src/pages/production/cutting/CuttingReportTab.jsx:18, 25-26, 58; src/pages/production/cutting/ReconciliationTab.jsx:25, 34-35, 130-139`

- **What happens:** With no active Cut PO (go-live, or all closed) or a failed load, both tabs spin forever instead of saying there is nothing to show.
- **Fix:** An EmptyState when the list is empty or none is selected. *(visible: an empty state)*
- **Estimate:** 0.5 h

#### U278 · P3 · correctness — Small cutting display defects: empty Action tags, lay date not pre-filled, quantities always labelled kg

*Cutting › various* — `src/pages/production/cutting/SizeJumpAlert.jsx:14; src/pages/production/cutting/CuttingReportPivot.jsx:130; src/pages/production/cutting/ReconciliationTab.jsx:56-74, 105-120, 163-168; src/pages/production/cutting/CuttingReportTab.jsx:62-68`

- **What happens:** The size-jump alert's Action column shows blank tags; picking a lay never pre-fills its date (reads l.date, the field is layDate); woven/denim quantities in metres are labelled kg.
- **Fix:** Fill or drop the column, use layDate, use the reconciliation's unit. *(visible)*
- **Estimate:** 1 h

#### U279 · P3 · correctness — Misleading over-issue wording, a stale lookup-type alert, and a duplicate chart load

*Sewing › Garment Issue / Production Masters / Measurement* — `src/pages/production/sewing/GarmentIssueDrawer.jsx:66-67, 102-105; src/pages/production/masters/SewingLookupMaster.jsx:23, 52, 60-73; src/pages/production/sewing/MeasurementReportForm.jsx:99-102, 217`

- **What happens:** 'PM approval required' is promised but no approval exists; after viewing a THRESHOLD lookup, Add keeps its alert and required value; changing size loads the chart twice (two 'no chart' warnings).
- **Fix:** Reword; reset lookupType on Add; let the effect alone load the chart. *(visible: wording and a single warning)*
- **Estimate:** 0.75 h

#### U280 · P3 · rule 7 — Editable grids key rows by array index

*Production editable grids* — `src/pages/production/cutting/MarkerMatrix.jsx:138; LayAuditRollGrid.jsx:94; TmbCheckGrid.jsx:78; PanelCheckForm.jsx:155; src/pages/production/sewing/HourlyGrid.jsx:86; OperationBreakdownGrid.jsx:109; MeasurementReportForm.jsx:244; TopseForm.jsx:225; PartsReplacementDrawer.jsx:136`

- **What happens:** Deleting a middle row re-keys the rows below, so an expanded row or a focused input's draft moves to the neighbour.
- **Fix:** A monotonic client key per new row (as CartonGroupEditor does). *(not visible)*
- **Estimate:** 2 h

#### U281 · P3 · rule 34 — Unwired service functions: hourly sheet submit/reopen and issuedBySize have no caller

*Sewing services* — `src/services/production/sewingApi.js:135-143, 280-283`

- **What happens:** The day's hourly sheet can never be closed (SUBMITTED) from the UI although the API has the flow.
- **Fix:** Add Submit/Reopen to the sheet or record them as intentionally unused. *(not visible)*
- **Estimate:** 0.5 h

#### U282 · P3 · rule 2 — Duplicate catch-block toasts across the production screens

*Cutting, Sewing, Packing, Masters* — `src/pages/production/cutting/* (FabricReceiptList.jsx:25; FabricReceiptDrawer.jsx:78, 148; FabricRelaxationList.jsx:32, 49; FabricRelaxationDrawer.jsx:70; MarkerPlanTab.jsx:26; MarkerPlanForm.jsx:53, 136, 146; LayAuditList.jsx:24; LayAuditForm.jsx:42, 84; TmbCheckList.jsx:25; TmbCheckForm.jsx:38, 69; CuttingReportTab.jsx:22, 29; CuttingReportPivot.jsx:100; CuttingDashboard.jsx:27; BundlingTab.jsx:31; BundlingDrawer.jsx:53; BundleIssueDrawer.jsx:37; ExternalProcessTab.jsx:32; ReCutRegisterTab.jsx:40; ReconciliationTab.jsx:29, 39); src/pages/production/sewing/* (SewingPlanList.jsx:23; SewingPlanForm.jsx:58, 97, 105, 118; CutPartsReceiptList.jsx:24; CutPartsReceiptDrawer.jsx:30, 110; GarmentIssueList.jsx:24; GarmentIssueDrawer.jsx:24, 71; HourlyProductionTab.jsx:45, 54, 60, 110; MeasurementReportForm.jsx:69, 96, 175; MeasurementReportList.jsx:25; MeasurementChartUpload.jsx:25, 62; TopseForm.jsx:146; TopseList.jsx:25; TrimVerificationDrawer.jsx:57, 129; TrimVerificationList.jsx:30; PartsReplacementList.jsx:30, 45; PartsReplacementDrawer.jsx:35, 101; OperatorSamTab.jsx:25; SewingDashboard.jsx:16); src/pages/production/packing/CartonPackingForm.jsx:261, 283, 308; CartonPackingList.jsx:76, 98; CartonPackingView.jsx:39; DailyPackingSummary.jsx:44; src/pages/production/masters/ProductionMasterPanel.jsx:61, 122, 142; ProductionLineMaster.jsx:21; CuttingTableMaster.jsx:22; SewingOperationMaster.jsx:14; MeasurementChartMaster.jsx:34, 43`

- **What happens:** Any refusal shows two error toasts; a stale-version 409 on plan status or packing complete/reopen shows the conflict dialog plus a red toast.
- **Fix:** toastUnlessHandled (WS7), as PanelCheckForm does. *(visible: one toast)*
- **Estimate:** 3 h

#### U283 · P3 · rule 14, rule 33 — Un-memoised columns, and a link without href

*Cutting drawers and dashboard* — `src/pages/production/cutting/PanelIssueFromPo.jsx:27; PanelIssueFreeText.jsx:35; CuttingDashboard.jsx:84, 88-98; BundlingDrawer.jsx:103-107; BundleIssueDrawer.jsx:73-78`

- **What happens:** Columns rebuild on every keystroke in these drawers; the dashboard's 'Fabric In →' is an <a> with no href, unreachable by keyboard.
- **Fix:** useMemo; Button type=link. *(not visible)*
- **Estimate:** 0.75 h

## Master data

### P1

#### U284 · P1 · rule 5 — A second edit of the same master record without a reload raises a spurious conflict: the API echoes a stale version that the screen keeps

*Categories, Sub Categories, Item Types, UOM, Payment Terms, Styles* — `src/pages/master/CategoryMaster.jsx:101-104; src/pages/master/SubCategoryMaster.jsx:101-104; src/pages/master/ItemTypeMaster.jsx:106-109; src/pages/master/UomMaster.jsx:101-104; src/pages/master/PaymentTermsMaster.jsx:119-122; src/pages/master/StyleMaster.jsx:264-275; erp/masterdata/category/CategoryService.java:43-53; erp/masterdata/subcategory/SubCategoryService.java:46-63; erp/item/service/ItemTypeService.java:133-154; erp/masterdata/unitofmeasure/UnitOfMeasureService.java:43-55; erp/masterdata/paymentterms/PaymentTermsService.java:43-55; erp/costing/service/StyleService.java:30-67`

- **What happens:** These updates return toDTO(repository.save(entity)), mapped before the version increment, and the screens write that response into the store. Edit a UOM and save, then change the same UOM again and save: the second save sends the old version and gets the 'modified by another user' dialog for the user's own edit. Buyer, Supplier, T&C, Size Preset, Item, Process, Parts, Overhead, Branch, Courier and Vendor are unaffected (they reload or flush).
- **Fix:** saveAndFlush in the six update methods (the courier/vendor pattern); no UI change. *(not visible)*
- **Estimate:** 2 h
- **Note:** API change (erp-purchase). This is the version-echo trap recorded in project memory; most old master services still have it.

#### U285 · P1 · correctness — The Buyer dropdown is empty, and the list shows raw buyer ids, unless another screen loaded buyers first

*Styles* — `src/pages/master/StyleMaster.jsx:18, 44-46, 62-65, 430-441; src/pages/master/MasterDashboard.jsx:451-537`

- **What happens:** After login, Master Data → Styles → Add Style: the store's buyers key is filled only by Buyer Master, the shipment form or the costing sheet, and neither StyleMaster nor the dashboard loads it, so the required Buyer select has no options (no style can be created) and the Buyer column shows ids like 12.
- **Fix:** Load buyers into the store when empty or stale (in StyleMaster or MasterDashboard.fetchAllMetaData). *(visible: the dropdown is populated and names show)*
- **Estimate:** 1 h

#### U286 · P1 · correctness — The shipping-location address strips commas, slashes, hyphens, '#' and '.' as typed, corrupting the consignee address printed on export documents

*Buyers (shipping locations)* — `src/pages/master/BuyerMaster.jsx:53, 905-914; erp/exportdoc/shipment/service/ShipmentPartyBuilder.java:72-75`

- **What happens:** 'Unit 12/3, Rue de la Paix - Bat. B' is saved as 'Unit 123 Rue de la Paix  Bat B' by the alphanumeric normalizer; the house number is now wrong on every export document that prints this consignee or notify address.
- **Fix:** Drop the normalizer or allow normal address punctuation (, . / - # & ' ( )). *(visible: the field accepts punctuation)*
- **Estimate:** 0.5 h

#### U287 · P1 · rule 8 — Changing only the approved units never marks the form dirty, so Update stays disabled and Cancel drops the change silently

*Buyers (approved units)* — `src/pages/master/BuyerMaster.jsx:294-306, 453, 473, 715, 858`

- **What happens:** Adding an approved unit and its valid-till date only calls setApprovedUnits; Update (disabled until something is dirty) stays grey, so the list cannot be saved without editing an unrelated field, and Cancel closes without the discard prompt.
- **Fix:** setUnsavedChanges(true) in patchUnit, the row delete and the add handler, as the shipping-location handlers do. *(visible: Update enables and Cancel asks first)*
- **Estimate:** 0.5 h

#### U288 · P1 · correctness — Style delete is a hard delete with no in-use check, leaving orders and sample requests pointing at a missing style

*Styles (API)* — `src/pages/master/StyleMaster.jsx:294-318; erp/costing/service/StyleService.java:90-97; db/migration/V6__order.sql:75; db/migration/V20260903165410__sampling_requests.sql:34`

- **What happens:** Only BOMs, cost sheets and cutting POs have a foreign key to styles. Delete a style used by an order or a sample request (with no cost sheet or BOM yet): the delete succeeds and the order, sample request, work order or finishing PO keeps a style id that no longer exists, so its style shows blank everywhere.
- **Fix:** Check usages (orders, sample requests, work orders, finishing POs) as Buyer and Supplier do, and refuse or soft-retire. *(visible: deleting a style in use is refused with the referencing documents named)*
- **Estimate:** 2 h
- **Note:** API change (erp-purchase).

### P2

#### U289 · P2 · correctness — The QC masters have no add/update/delete permission checks and send no version on update

*Defect Types, Trims QC Criteria* — `src/pages/master/DefectTypeMaster.jsx:47-113, 138-151; src/pages/master/TrimsQCCriteriaMaster.jsx:47-113, 138-151; src/pages/master/MasterDashboard.jsx:274-292; erp/item/service/AttributeConfigService.java:42-50`

- **What happens:** Every other master gates Add/Save/Delete; these show them to anyone who can see the QC masters (the production server refuses under ENFORCE; QA/dev under AUDIT accept). Updates omit version, so concurrent edits overwrite silently; the Attribute API ignores the version it receives.
- **Fix:** Gate with hasPermission('inventory-qc', op) as ProcessMaster does, send the version, and check it in AttributeConfigService. *(visible: view-only users lose Add/Delete and get a read-only form)*
- **Estimate:** 2 h

#### U290 · P2 · correctness — A 'deleted' buyer returns as Inactive on the next load, and any edit silently reactivates it

*Buyers* — `src/pages/master/BuyerMaster.jsx:195-207, 222-224; erp/masterdata/buyer/BuyerService.java:28-31, 66, 150-161`

- **What happens:** Delete only sets active=false and the list still returns the buyer; editing it for any reason sends active: true (hard-coded), so the retired buyer is back in every picker.
- **Fix:** Send the record's current active value (or an Active switch) and word Delete as Deactivate. *(visible: 'Deactivate' wording; editing keeps it inactive)*
- **Estimate:** 1 h

#### U291 · P2 · correctness — A style switched to Inactive disappears for good and can never be reactivated

*Styles* — `src/pages/master/StyleMaster.jsx:504-506; erp/costing/service/StyleService.java:78-82`

- **What happens:** GET /styles returns active styles only, so after the next load an inactive style is gone from the master with no way to find or revive it.
- **Fix:** Let the master list request inactive styles too; keep pickers active-only. *(visible: inactive styles stay listed)*
- **Estimate:** 1.5 h

#### U292 · P2 · correctness — The client duplicate check is global, but the server allows the same style number for another buyer

*Styles* — `src/pages/master/StyleMaster.jsx:252-260; erp/costing/service/StyleService.java:47-53`

- **What happens:** Buyer A has style '1001'; creating '1001' for Buyer B is refused on the screen although the API allows it.
- **Fix:** Include buyerId in the client check. *(visible: the style is accepted for another buyer)*
- **Estimate:** 0.5 h

#### U293 · P2 · correctness — Supplier Name accepts letters and spaces only, so legal names with punctuation cannot be entered

*Suppliers* — `src/pages/master/SupplierMaster.jsx:620-633`

- **What happens:** 'K.P.R. Mill Ltd', 'Sri Murugan Textiles & Co', 'ABC Fabrics (P) Ltd' or '3M India' fail validation; the name is locked on edit, so the legal name on POs stays wrong.
- **Fix:** Allow letters, digits, spaces and . & ' ( ) - , /. *(visible: punctuation accepted)*
- **Estimate:** 0.5 h

#### U294 · P2 · rule 37 — The supplier list returns every supplier's PAN and bank account details to any caller

*Suppliers (API)* — `erp/masterdata/supplier/SupplierService.java:26-30; src/pages/master/SupplierMaster.jsx:87-94`

- **What happens:** Every screen that lists suppliers (PO pickers included) receives PAN, account number, IFSC and SWIFT for all suppliers; the Vendor release moved the same fields to a private record loaded only by id.
- **Fix:** Apply the vendor pattern: drop them from the list DTO and load them by id when editing. *(not visible)*
- **Estimate:** 3 h
- **Note:** API change (erp-purchase).

#### U295 · P2 · correctness — Dropdown/Multi-Select attribute options are silently discarded on save

*Attributes* — `src/pages/master/VariantMaster.jsx:13-20, 116-127, 260-273; erp/item/dto/AttributeConfigDTO.java:12-16; src/pages/master/ItemMaster.jsx:1418-1454`

- **What happens:** The API has no field for the options, so Red/Blue entered for a Dropdown attribute vanish after a success toast, and Item Master renders select attributes as free text anyway.
- **Fix:** Persist the options and render a Select, or stop offering the select types until built. *(visible)*
- **Estimate:** 6 h
- **Note:** Needs owner: build select attributes or remove them.

#### U296 · P2 · correctness — In-use classifier edits are not guarded: re-parenting or removing an item type's attribute corrupts existing items

*Sub Categories, Item Types (API)* — `erp/masterdata/subcategory/SubCategoryService.java:52-62; erp/item/service/ItemTypeService.java:138-151; erp/item/service/ItemService.java:476-483`

- **What happens:** Only renames are blocked. Moving a used sub-category or item type leaves items whose hierarchy no longer matches (Item Master then loads no variants); removing an attribute from a used item type erases that value from every variant on the item's next save.
- **Fix:** Refuse parent changes and attribute/UOM removals while items reference the record. *(visible: such saves are refused with a message)*
- **Estimate:** 4 h
- **Note:** API change (erp-purchase).

#### U297 · P2 · correctness — Replacing an image deletes the old file before uploading the new one, so a failed upload loses the original

*Items, Styles* — `src/pages/master/ItemMaster.jsx:306-351; src/pages/master/StyleMaster.jsx:127-152`

- **What happens:** If the upload fails after the old file was deleted, the screen keeps pointing at a deleted file and the user believes the image is still there.
- **Fix:** Upload first; delete the old file only after success. *(not visible)*
- **Estimate:** 1.5 h

#### U298 · P2 · correctness — Removing an unsaved variant tab selects a non-existent index; typing then creates a phantom variant

*Items* — `src/pages/master/ItemMaster.jsx:1024-1032, 1044-1056, 1069-1106, 2022-2095`

- **What happens:** With two unsaved variants, closing the first leaves the active index at 1 of a one-element array: the panel edits nothing, typing creates a ghost variant and Add Variant throws.
- **Fix:** Compute the next active index from the post-delete array. *(visible: the remaining variant is selected)*
- **Estimate:** 1 h

#### U299 · P2 · rule 8 — Clicking another row or Add with unsaved changes discards them without a prompt

*All MasterSplitView masters* — `src/components/MasterSplitView.jsx:83-86, 99-100; src/pages/master/UomMaster.jsx:63-74 (same handleSelect/handleAdd in the other split-view masters)`

- **What happens:** Edit a T&C body or a size preset, then click another row: handleSelect replaces the form and clears dirty at once.
- **Fix:** An isDirty prop on MasterSplitView wrapping row select and Add in the dashboard's unsaved-changes confirm. *(visible: a discard confirm)*
- **Estimate:** 1.5 h

### P3

#### U300 · P3 · correctness — After a save or delete the list shows every row while the search box still shows the filter

*All MasterSplitView masters* — `src/components/MasterSplitView.jsx:29-30, 73-82 (store-sync effects in each split-view master)`

- **What happens:** Search 'kg', edit and save a result: the list resets to all rows while the box still reads 'kg'.
- **Fix:** Re-apply the search text whenever the data changes (let MasterSplitView own filtering). *(visible: the list stays filtered)*
- **Estimate:** 1.5 h

#### U301 · P3 · correctness — GSTIN is uppercased only by CSS, so lowercase input fails the pattern while it looks correct

*Branches* — `src/pages/master/BranchMaster.jsx:215-222`

- **What happens:** '33abcde1234f1z5' displays uppercase but fails validation with a puzzling message.
- **Fix:** normalize to upper case. *(not visible)*
- **Estimate:** 0.25 h

#### U302 · P3 · rule 2 — Duplicate catch-block toasts in the master screens

*Master data* — `src/pages/master/BuyerMaster.jsx:129; SupplierMaster.jsx:96; TermsConditionsMaster.jsx:67; SizePresetMaster.jsx:244; OverheadMaster.jsx:40; PartsMaster.jsx:39; ProcessMaster.jsx:83; DefectTypeMaster.jsx:33, 89, 109; TrimsQCCriteriaMaster.jsx:33, 89, 109; BpDebitTypeMaster.jsx:36, 100, 121; BpChargeTypeMaster.jsx:36, 99, 120; BpIssueTypeMaster.jsx:36, 99, 120; MasterDashboard.jsx:459-529; ItemMaster.jsx:337, 406, 523-525, 560, 584; StyleMaster.jsx:148, 180`

- **What happens:** Any failed call shows the server's message and a generic one.
- **Fix:** toastUnlessHandled, as Courier and Branch do (WS7). *(visible: one toast)*
- **Estimate:** 1.5 h

#### U303 · P3 · rule 14, rule 33 — Un-memoised columns, and master rows that open only by mouse

*Master data* — `src/pages/master/CategoryMaster.jsx:35 (and the other split-view masters, BuyerMaster.jsx:367, SupplierMaster.jsx:313, ItemMaster.jsx:1468); src/components/MasterSplitView.jsx:99-105; src/pages/master/BuyerMaster.jsx:376; src/pages/master/SupplierMaster.jsx:322`

- **What happens:** Columns rebuild per keystroke; a keyboard user cannot focus or open a master row or the buyer/supplier name (vendorColumns already does this right).
- **Fix:** useMemo; tabIndex and Enter/Space on rows and names. *(visible: focus rings)*
- **Estimate:** 2 h

#### U304 · P3 · rule 34 — Dead Item Master code: an unused ColorPicker, unused imports and a duplicated validation loop

*Items* — `src/pages/master/ItemMaster.jsx:4, 17, 58-152, 1232-1240, 1258-1268`

- **What happens:** ColorPicker (95 lines) is never rendered; the 5-character variant-name check runs twice with different messages.
- **Fix:** Delete them. *(not visible)*
- **Estimate:** 0.5 h

## Admin (users, roles, approval flows, company profile, approvals inbox)

### P1

#### U310 · P1 · rule 10, rule 8 — Pressing Ctrl+S while editing a user, or a report in the Designer, clicks the page's Add button and wipes the edits.

*User Management / Report list (Ctrl+S inside a dialog)* — `src/hooks/useKeyboardShortcuts.js:23-29; src/pages/admin/UserManagement.jsx:98-116; src/pages/admin/UserManagement.jsx:323; src/pages/reports/ReportListPage.jsx:65-68; src/pages/reports/ReportListPage.jsx:277; src/pages/reports/components/ReportDesignerDrawer.jsx:59-66`

- **What happens:** Admin opens Edit User for Priya, changes her role and branches, presses Ctrl+S. querySelector returns the first primary button in document order, which is 'Add User' in #main-content (the modal is portaled after it), so openModal() runs: editingUser becomes null, form.resetFields() clears the changes and the dialog turns into 'Add New User'. Same on Reports: Ctrl+S in the Edit Report drawer clicks 'New Report', handleCreate nulls editingReport and the drawer resets to a blank new report.
- **Fix:** Make the shortcut act on the topmost open dialog first (query the last open .ant-modal-wrap / .ant-drawer-open, fall back to #main-content), as rule 10 requires. *(visible: Ctrl+S in a dialog saves that dialog instead of opening Add)*
- **Estimate:** 1.5 h
- **Note:** Cross-cutting (Appendix B 7); these are the two admin/report screens where the wrong click loses input. On Report Builder the same key runs Generate Report behind the Save drawer (harmless).

#### U311 · P1 · rule 9 — The admin dashboard's activity log and login count miss everything after 6:30 PM IST on the last day and include 6:30 PM onwards of the day before the range.

*Admin Dashboard (activity log)* — `src/pages/admin/AdminDashboard.jsx:74-75; erp/activity/userlog/UserActivityLogController.java:43-47; erp/activity/userlog/UserActivityLogService.java:244`

- **What happens:** Range today-7 .. today. The UI sends startOf('day').toISOString() = '...T18:30:00.000Z' of the previous day and endOf('day') = '...T18:29:59.999Z' of today. Spring parses them into LocalDateTime and drops the Z, while activity rows are stored as IST wall time (ZonedDateTime.now(IST)). So a 7 PM login today never appears, and 'Recent logins' undercounts every evening.
- **Fix:** Send local wall time: dateRange[0].startOf('day').format('YYYY-MM-DDTHH:mm:ss') and the same for the end. *(visible: today's evening activity appears and the range matches the picked dates)*
- **Estimate:** 0.5 h

### P2

#### U312 · P2 · rule 1 — The Phone field on the user form is never saved: the API has no phone field or column, so a typed number vanishes after 'User updated successfully'.

*User Management* — `src/pages/admin/UserManagement.jsx:162; src/pages/admin/UserManagement.jsx:391; src/pages/admin/UserManagement.jsx:455; erp/iam/dto/UserCreateDTO.java:12-20; erp/iam/dto/UserUpdateDTO.java:12-22; erp/iam/domain/User.java:21-56`

- **What happens:** Admin edits a user, types phone 98450 12345 (the only change, so Update is enabled), saves, gets the success toast; reopening the user shows an empty phone and the details drawer says 'Not provided'.
- **Fix:** Either add phone to sys_users and the DTOs, or remove the field from the form and drawer. *(visible: the phone either persists or the field is gone)*
- **Estimate:** 1.5 h

#### U313 · P2 · rule 1 — A non-superuser administrator can switch their own account to Inactive and is locked out at once.

*User Management* — `src/pages/admin/UserManagement.jsx:396; erp/iam/service/UserAdministrationPolicy.java:46-61; erp/iam/service/UserService.java:96-108`

- **What happens:** An HR admin (users.update, not superuser) edits their own row, flips Status to Inactive and saves. checkUpdate only protects superusers and role changes; the server revokes all the admin's refresh tokens and they cannot sign in again until someone else reactivates them.
- **Fix:** Refuse self-deactivation in UserAdministrationPolicy (as self role change is refused) and disable the Status switch on the current user's own row. *(visible: the Status switch is disabled on your own account)*
- **Estimate:** 1 h

#### U314 · P2 · rule 5 — The approval-flow update ignores the version the screen sends, so two admins editing the same flow silently overwrite each other.

*Approval Flows (edit drawer)* — `src/pages/admin/ApprovalFlowForm.jsx:108; erp/approval/service/ApprovalFlowService.java:125-178; erp/approval/dto/ApprovalFlowRequest.java:44`

- **What happens:** Admin A opens 'PO above 5 lakh' and raises the threshold; admin B, with the drawer already open, changes the second-level role and saves after A. updateFlow never compares request.version with the entity, loads fresh, and saves B's full payload, so A's threshold change is lost with no conflict dialog.
- **Fix:** Compare request.getVersion() with flow.getVersion() and throw ObjectOptimisticLockingFailureException as UserService/RoleService do; send loadedFlow.version rather than the list row's. *(visible: the second saver gets the standard conflict dialog)*
- **Estimate:** 1 h

#### U315 · P2 · rule 1 — Editing a flow that has pending requests looks allowed until Update, which then fails with a 500 and loses the edits' purpose.

*Approval Flows (edit drawer)* — `src/pages/admin/ApprovalFlowForm.jsx:35; src/pages/admin/ApprovalFlowForm.jsx:142; erp/approval/service/ApprovalFlowService.java:133-136`

- **What happens:** A PO is pending level 2. Admin opens the flow to rename it or change its priority; the drawer only locks levels for hasHistory and the banner says name, priority and conditions can still change. On Update the server refuses any edit with 'Cannot modify flow with 1 pending approval requests' (as a 500), after the admin has done the work.
- **Fix:** Use the list's pendingRequestsCount to open the drawer read-only with a banner naming the pending count (keep the Active toggle on the list, which the server allows); return the refusal as a 409 CONFLICT. *(visible: a banner and read-only fields when requests are pending)*
- **Estimate:** 1.5 h

#### U316 · P2 · rule 28 — The row Edit button renders blank and 'New Flow' renders as a bare + icon, because both pass type/label instead of action/text to ActionButton.

*Approval Flows (list)* — `src/pages/admin/ApprovalFlowList.jsx:237; src/pages/admin/ApprovalFlowList.jsx:286-291; src/components/buttons/ActionButton.jsx:195-284`

- **What happens:** <ActionButton type="edit"> falls back to action 'custom' (no icon, no text) and the spread restProps overrides antd's type with the invalid 'edit', so each row shows an empty button; <ActionButton type="add" label="New Flow" icon=+> is icon-only with no tooltip and puts a stray label attribute on the DOM button.
- **Fix:** Use action="edit" on the row and action="create" text="New Flow" on the header, as every other register does. *(visible: the edit pencil and the 'New Flow' label appear)*
- **Estimate:** 0.25 h

#### U317 · P2 · rule 1 — New approval flows default to allowing self-approval, so a submitter who also holds the approver role approves their own PO.

*Approval Flows (new flow)* — `src/pages/admin/ApprovalFlowForm.jsx:82; erp/approval/service/ApprovalRequestService.java:184`

- **What happens:** Purchase manager raises a PO for 8 lakh; the flow's level 1 is the Purchase Manager role and Prevent Self-Approval was left at its default (off). The same person opens My Approvals and approves their own PO, defeating maker-checker.
- **Fix:** Default preventSelfApproval to true for new flows (UI and ApprovalFlowRequest); keep the switch so the owner can turn it off. *(visible: the Prevent Self-Approval switch starts on for new flows)*
- **Estimate:** 0.5 h
- **Note:** Owner decision; existing flows are untouched.

#### U318 · P2 · rule 4 — The Review drawer can show another document's approval history when two rows are reviewed in quick succession.

*My Approvals (Review drawer)* — `src/pages/approvals/MyApprovals.jsx:62-74`

- **What happens:** On a slow link the approver clicks Review on PO-101, closes the drawer at once and clicks Review on PO-102. PO-101's history request resolves after PO-102's (or after the reset) and setSelectedHistory writes PO-101's timeline into the PO-102 drawer, so the approver reads the wrong remarks before approving.
- **Fix:** Ignore a history response whose record is no longer the selected one (compare ids, or an alive token as useRoleDoc does). *(not visible)*
- **Estimate:** 0.5 h

#### U319 · P2 · rule 1 — Company Profile saves any text as GSTIN, PAN, IFSC, email or state code, and even a blank company name, and every export document prints from it.

*Company Profile* — `src/pages/admin/CompanyProfile.jsx:100-124; erp/masterdata/organisation/OrganisationInfoDTO.java:20-21`

- **What happens:** Admin types GSTIN '33ABCDE1234F1Z' (14 characters) and IFSC 'SBIN00123'; both save without a word and print on every sample/commercial invoice and bank block. A first save on a fresh install with everything empty creates the profile with no company name, which removes the 'not configured' banner.
- **Fix:** Add format rules (GSTIN 15-char pattern, PAN 10, IFSC 11, email, 2-digit state code) and make Company Name required, in the form and as @Pattern/@NotBlank on the DTO. *(visible: invalid values show an inline error)*
- **Estimate:** 1.5 h
- **Note:** No logo upload exists on this screen, so there is no upload type/size check to review.

### P3

#### U324 · P3 · rule 1 — An approval-flow admin without users.view or roles.view gets error toasts on every drawer open and an empty approver list.

*Approval Flows (edit drawer)* — `src/pages/admin/ApprovalFlowForm.jsx:37-49; erp/iam/controller/UserController.java:15-25; erp/iam/controller/RoleController.java`

- **What happens:** Owner gives the Purchase Head approval-flows add/update but not Users or Role & Access. Opening New Flow calls GET /users and GET /roles; under ENFORCE both answer 403, the interceptor toasts twice, and the approver Selects are empty so no level can be configured.
- **Fix:** Serve approver options from an approval-flows-scoped endpoint (id + name of active roles/users), or document that the screen needs both view rights. *(not visible)*
- **Estimate:** 1.5 h

#### U325 · P3 · rule 2 — Catch blocks toast again after the interceptor already toasted the server's message.

*Admin screens (User Management, Admin Dashboard, Approval Flows)* — `src/pages/admin/UserManagement.jsx:64; src/pages/admin/UserManagement.jsx:184; src/pages/admin/UserManagement.jsx:220; src/pages/admin/UserManagement.jsx:242; src/pages/admin/AdminDashboard.jsx:63; src/pages/admin/AdminDashboard.jsx:81; src/pages/admin/ApprovalFlowList.jsx:53; src/pages/admin/ApprovalFlowList.jsx:80; src/pages/admin/ApprovalFlowList.jsx:90; src/pages/admin/ApprovalFlowList.jsx:109; src/pages/admin/ApprovalFlowForm.jsx:77; src/pages/admin/ApprovalFlowForm.jsx:120; src/pages/admin/components/FlowLockedBanner.jsx:237; src/components/approval/ApprovalActionBar.jsx:147`

- **What happens:** Deleting a user who has ever logged in fails on the FK to the activity log: the interceptor toasts the server's message and UserManagement toasts 'Failed to delete user' as well.
- **Fix:** Drop the catch-block message.error calls (or use toastUnlessHandled as CompanyProfile does). *(visible: one toast instead of two)*
- **Estimate:** 1 h

#### U327 · P3 · rule 30, rule 9 — console.* calls and a locale-less toLocaleString() remain in the admin and approvals screens.

*Admin screens and services* — `src/pages/admin/UserManagement.jsx:63; src/pages/admin/UserManagement.jsx:75; src/pages/admin/AdminDashboard.jsx:62; src/pages/admin/AdminDashboard.jsx:80; src/pages/admin/ApprovalFlowList.jsx:54; src/pages/admin/ApprovalFlowForm.jsx:42; src/pages/admin/ApprovalFlowForm.jsx:48; src/services/admin/organisationService.js:205; src/pages/approvals/MyApprovals.jsx:116`

- **What happens:** The axios error object (request config included) is logged to the console on every failed users load; My Approvals shows 'Submitted At' in the browser's locale instead of the app's DD-MMM-YYYY HH:mm.
- **Fix:** Route through utils/logger.js and formatDate(ts, 'DD-MMM-YYYY HH:mm'). *(visible: Submitted At uses the app's date format)*
- **Estimate:** 0.5 h

## Sample requests

### P0

#### U330 · P0 · rule 5 — Saving an edited per-colour draft (PP / Shipment sample) silently erases its colourway on the server.

*Sample Request form (edit)* — `src/pages/sample-request/SampleRequestForm.jsx:95; src/pages/sample-request/SampleRequestForm.jsx:159; src/pages/sample-request/SampleRequestForm.jsx:171; src/pages/sample-request/form/SectionDetails.jsx:181-221; erp/sampling/request/service/SampleRequestService.java:201-223; erp/sampling/request/service/SampleRequestMerger.java:75`

- **What happens:** A PP Sample (scope ORDER_PER_COLOUR) is raised for Navy, Red, Black as a batch of three drafts. The user opens SRQ-Navy from the list, changes the sample qty and presses Save as Draft (or Submit). The form loads colourName via setFieldsValue, but for this scope the only rendered identity field is `colours` (the multi-colour picker), so `colourName` is not a registered Form.Item and form.getFieldsValue() (rc-form returns registered fields only) omits it; buildPayload sends colourName:null. The server rebuilds the identity from the request, keyChanged is true, the uniqueness check passes (no other colourless PP), and applyHeader writes colourName=null. The request loses its colourway, its materials are re-materialised colour-less (largest-across-colours quantities), and the list, dispatch and invoice screens show '—' for colour. Picking a colour again in the empty 'Colourways' box does not help: that field is never read on edit.
- **Fix:** On edit, render the single-colour field for every colour-naming scope (or read colourName from draft.record when the field is absent) and send bomLineId from the record for a lab dip; never let an edit drop an identity field the user did not change. *(visible: the edit form shows the request's own colourway (one value) instead of an empty multi-colour picker; saving keeps it)*
- **Estimate:** 3 h
- **Note:** Lead-verified (antd getFieldsValue() returns mounted fields only; the edit form mounts `colours`, not `colourName`, for a per-colour scope) and reported to the coordinator at once. Fixed together with the lab-dip / revision P1 that follows it.

### P1

#### U331 · P1 · rule 5 — A lab dip / strike off draft cannot be saved from the edit form, and a revision of a PP sample or lab dip can never be saved or submitted, so a rejected sample of those types cannot be re-made.

*Sample Request form (edit)* — `src/pages/sample-request/SampleRequestForm.jsx:158-184; src/pages/sample-request/form/SectionDetails.jsx:158-178; src/pages/sample-request/view/AvailableActionsPanel.jsx:114-120; erp/sampling/request/service/SampleRequestService.java:202-215; erp/sampling/request/service/SampleRequestService.java:411-417; erp/sampling/request/service/SampleSubmitGate.java:47-49`

- **What happens:** (a) Lab dip draft: buildPayload never sends bomLineId, so update() builds an identity with bomLineId=null and requireIdentityComplete answers 400 'SRQ-x is raised against one material - choose which fabric it is for'; picking the fabric in the 'Materials' box does not help because bomLineIds is not read on edit. Every Save as Draft / Submit on an existing lab dip fails. (b) Buyer rejects PP sample SRQ-Navy; user clicks Raise Revision, lands on the edit form of the new draft whose three dates are blank by design. Saving sends colourName:null (see the P0) or bomLineId:null, keyChanged is true and the server refuses with 409 'is a revision of ... and keeps its order, sample type, colour and fabric'. The revision can never receive its dates, and the submit gate requires all three, so it can never be submitted.
- **Fix:** Same fix as the colour-wipe finding: send the record's colourName and bomLineId on edit (the identity is fixed for a revision anyway). *(visible: Save/Submit on a lab-dip draft or a PP/lab-dip revision succeeds instead of erroring)*
- **Estimate:** 1 h
- **Note:** Shares the fix with the P0; estimate is the extra lab-dip/revision verification on top.

#### U332 · P1 · rule 1 — The list's quick 'Mark as Dispatched' ships a hand delivery with no signed challan, bypassing the rule the form enforces.

*Dispatches list* — `src/pages/sample-request/dispatch/DispatchList.jsx:102-121; src/pages/sample-request/dispatch/DispatchList.jsx:242-249; src/pages/sample-request/dispatch/DispatchForm.jsx:177-186; erp/sampling/dispatch/SampleDispatchSendService.java:54-65; erp/sampling/dispatch/SampleDispatchValidator.java:92-102`

- **What happens:** A merchandiser saves a LOCAL_HAND dispatch draft (buying office, handed-over-to filled) without uploading the delivery challan, intending to add it later. Back on the Dispatches list she clicks the send icon on the row and confirms. markDispatched passes server validation (validateComplete has no document rule), the record locks irreversibly and every SR moves to Dispatched with no proof of delivery - the exact outcome DispatchForm's document check exists to prevent.
- **Fix:** Move the 'hand delivery needs at least one stored document' rule into SampleDispatchValidator.validateComplete (server) so every path enforces it; the list then shows the server's refusal. *(visible: marking a hand delivery with no document from the list is refused with a message)*
- **Estimate:** 2 h

#### U333 · P1 · rule 28 — Printing an invoice from the view dialog prints the head-office address and GSTIN instead of the exporting branch's.

*Invoices list / view dialog* — `src/pages/sample-request/invoice/SampleInvoiceList.jsx:265; src/pages/sample-request/invoice/SampleInvoiceList.jsx:82; src/pages/sample-request/invoice/SampleInvoiceForm.jsx:387; src/pages/sample-request/invoice/useCompanyProfile.js:79-88`

- **What happens:** On a multi-branch company an EXSG commercial invoice is issued with Exporting Branch = Tiruppur (its own GSTIN). The user opens it from the Invoices list (row click / view icon) and presses Print in the dialog footer. onPrint calls printSampleInvoice(inv, profile) without withExportingBranch, so the exporter block shows the company profile's address and GSTIN; the printed customs/tax document carries the wrong state GST registration. The row Print icon and the wizard's Print Preview use withExportingBranch and print correctly, so the same invoice prints two different exporters depending on the button.
- **Fix:** Pass withExportingBranch(profile, inv) in the view dialog's onPrint, as the other two print paths already do. *(visible: the dialog's print shows the branch exporter block, same as the row print)*
- **Estimate:** 0.5 h

#### U334 · P1 · rule 15 — The Customer Comments register only ever sees the newest 100 sample requests, so older dispatched samples awaiting feedback silently drop off it.

*Customer Comments* — `src/pages/sample-request/comments/CustomerCommentsPage.jsx:60-73; src/pages/sample-request/comments/CustomerCommentsPage.jsx:223`

- **What happens:** The register fetches page 0, size 100 of ALL sample requests (any status) and then filters client-side to the five comment statuses. With 140 requests raised since an SR was dispatched three weeks ago, that SR is not in the first 100 and never appears in the register (and the 'Total N' count is wrong), so its buyer feedback is never captured from this screen. Searching its exact SR number finds it, but nothing tells the user to.
- **Fix:** Send the comment statuses to the server (status list or a 'commentable' flag on SampleRequestSearchRequest) and page server-side like SampleRequestList. *(visible: older dispatched SRs appear; the table pages from the server)*
- **Estimate:** 3 h

#### U335 · P1 · rule 1 — The register's Feedback column reads 'Awaiting' for every row, including approved and rejected samples and drafts already saved.

*Customer Comments* — `src/pages/sample-request/comments/CustomerCommentsPage.jsx:161-172; erp/sampling/request/service/SampleRequestAssembler.java:36-38; erp/sampling/request/service/SampleRequestAssembler.java:72-85`

- **What happens:** The list rows come from searchSampleRequests, whose summaries deliberately omit `feedback` (assembler comment: 'A list page assembles the same shape minus ... the feedback record - no list column reads them'). This column does read it, so record.feedback is always undefined: an Approved SR shows 'Awaiting', and a Dispatched SR with a saved comment draft also shows 'Awaiting', so the merchandiser cannot see which samples still need comments.
- **Fix:** Add a light `feedbackState` (NONE/DRAFT/RECORDED) to the summary DTO (one grouped query per page, like applyRefs) and render the column from it. *(visible: the Feedback column shows Recorded / Draft saved / Awaiting correctly)*
- **Estimate:** 2 h

### P2

#### U336 · P2 · rule 5 — Retrying Submit after a failed status change sends a stale version and gets a spurious conflict.

*Sample Request form* — `src/pages/sample-request/SampleRequestForm.jsx:163; src/pages/sample-request/SampleRequestForm.jsx:195-214; src/pages/sample-request/SampleRequestForm.jsx:227-244`

- **What happens:** User edits an existing draft and clicks Submit. persist() updates the record (server version 3 -> 4) but the update branch never calls setSavedVersion, so savedVersion stays null and the form still holds draft.record.version = 3. changeStatus then fails (network drop, or a server-side refusal). User clicks Submit again: updateSampleRequest is sent version 3 and the server answers 409 OPTIMISTIC_LOCK_CONFLICT against the user's own first save. A new request hits the same thing on the third attempt.
- **Fix:** Set savedVersion from the update response too (and from the changeStatus response), so the form always adopts the version it just wrote. *(not visible)*
- **Estimate:** 0.5 h

#### U337 · P2 · rule 4, rule 14 — Fast record switching can leave the dialog on a skeleton forever, and the SR view refetches on every list re-render.

*Sample Request view / Customer Comments dialog* — `src/pages/sample-request/SampleRequestView.jsx:49-69; src/pages/sample-request/SampleRequestList.jsx:197-206; src/pages/sample-request/comments/CustomerCommentsPage.jsx:77-104`

- **What happens:** Neither load() nor loadDetail() ignores a superseded response. Open SR A, close, and open SR B within the round-trip (or click the parent-SR link in a revision's hero): B resolves first, A resolves last and overwrites state; `fresh` then fails the id check and the dialog shows the loading skeleton until it is closed. Separately, SampleRequestList passes an inline onClose, so SampleRequestView's load callback changes on every list render and its effect re-fetches the open SR each time the list renders (2-3 extra GETs after every action).
- **Fix:** Guard the fetch with a cancelled flag / request id as DispatchView and SampleInvoiceView already do, and wrap the list's onClose in useCallback. *(not visible)*
- **Estimate:** 1 h

#### U338 · P2 · rule 10 — Ctrl+S submits the sample request, and inside the comments dialog records the terminal buyer decision, instead of saving.

*Sample Request form / Comments dialog / SR view* — `src/hooks/useKeyboardShortcuts.js:23-27; src/pages/sample-request/SampleRequestForm.jsx:359-360; src/pages/sample-request/comments/CustomerCommentsPage.jsx:270-271; src/pages/sample-request/SampleRequestList.jsx:150-152; src/pages/sample-request/SampleRequestView.jsx:355-394`

- **What happens:** The shortcut clicks the first enabled .ant-btn-primary in document order. On the SR form 'Save as Draft' is a default button and 'Submit Sample Request' is primary, so Ctrl+S submits the request. On Customer Comments the page has no primary button, so Ctrl+S inside the dialog clicks 'Save Comments', which records the decision and closes the SR irreversibly when a decision is chosen. In the SR view's 'Edit instructions' modal, Ctrl+S hits the page's 'New Sample Request' button behind it and navigates away, discarding the typed instructions.
- **Fix:** Make the shortcut prefer the topmost open dialog and target an explicit save button (e.g. a data-shortcut='save' marker) rather than any primary button; do not bind it to terminal actions. *(visible: Ctrl+S saves (draft) in the topmost surface instead of submitting or navigating)*
- **Estimate:** 2 h
- **Note:** The hook is shared; the fix belongs to the programme's global Ctrl+S item, listed here for the sample-module consequences.

#### U339 · P2 · rule 8 — Leaving the SR form, the dispatch form or the comments dialog by sidebar, browser Back or Close drops unsaved input without a prompt.

*Sample Request form / Dispatch form / Comments dialog* — `src/pages/sample-request/SampleRequestForm.jsx:48; src/pages/sample-request/SampleRequestForm.jsx:246-255; src/pages/sample-request/dispatch/DispatchForm.jsx:57; src/pages/sample-request/dispatch/DispatchForm.jsx:201-210; src/pages/sample-request/comments/CustomerCommentsPage.jsx:96-101`

- **What happens:** The SR form and the dispatch form track isDirty but only consult it in their own Cancel button; neither uses useUnsavedChanges (the invoice wizard does). A user half-way through a sample request (dates, 30 material colour overrides) clicks another sidebar item and everything is lost; a dispatch with staged challan files loses them the same way. In the comments dialog, Close or the X discards typed buyer comments with no confirm.
- **Fix:** Wire useUnsavedChanges(isDirty) into both forms and confirm Close in the comments dialog when the capture form is touched. *(visible: a discard-changes prompt appears when leaving with unsaved input)*
- **Estimate:** 2 h

#### U340 · P2 · rule 9 — The printed invoice total and line amounts are float-rounded in the browser and can differ by a paisa/cent from the issued declared value.

*Sample invoice wizard / print* — `src/utils/sampleInvoicePdfGenerator.js:24; src/utils/sampleInvoicePdfGenerator.js:38; src/utils/sampleInvoicePdfGenerator.js:109; src/pages/sample-request/invoice/InvoiceStepLines.jsx:57-70; erp/sampling/invoice/SampleInvoiceAssembler.java:140-146; erp/sampling/invoice/SampleInvoiceLine.java:63-64`

- **What happens:** Rate is stored at scale 4 and the rate input has no precision cap. A line of 1 pc at USD 2.675: the server's declared value is 2.68 (BigDecimal HALF_UP) and the list, view and success toast show 2.68, but the print computes 1*2.675 in floating point and toFixed(2) gives 2.67, so the customs invoice prints 2.67 while the system records 2.68. With several such lines the printed line amounts also stop summing to the printed total.
- **Fix:** Print the server's line amounts and declaredValue (or round per line with a decimal helper in formatters.js), and cap the rate input's precision. *(visible: printed amounts match the issued declared value)*
- **Estimate:** 2 h

#### U341 · P2 · rule 1 — An issued commercial invoice can 'cover' a sample request that has no line on it, so the overseas dispatch gate passes for a sample missing from the customs document.

*Sample invoice wizard* — `src/pages/sample-request/invoice/InvoiceStepLines.jsx:76-79; src/pages/sample-request/invoice/InvoiceStepLines.jsx:99-101; erp/sampling/invoice/SampleInvoiceValidator.java:37-49`

- **What happens:** The user ticks SRQ-1 and SRQ-2, then in step 3 deletes SRQ-2's line (the screen says this does not unselect the SR). The invoice is issued with srIds [1,2] and one line. Coverage is by srIds, so the dispatch of SRQ-2 passes the INVOICE_REQUIRED gate although the commercial invoice travelling with the parcel does not list it.
- **Fix:** Either unselect the SR when its last line is removed, or have the issue validator require at least one line per covered SR. *(visible: removing an SR's only line unticks it (or issue names the uncovered SR))*
- **Estimate:** 1.5 h
- **Note:** The behaviour is flagged in the UI text, so it may be a known shortcut; the gate consequence is what makes it worth fixing.

#### U342 · P2 · rule 1 — A dispatch can be marked dispatched with a future date, which pushes the linked order's dispatch date out as a sample slip.

*Dispatch form* — `src/pages/sample-request/dispatch/DispatchFields.jsx:154-156; erp/sampling/dispatch/SampleDispatchValidator.java:92-102; erp/sampling/dispatch/SampleOrderDelayContributor.java:63-68`

- **What happens:** The Dispatched Date picker has no disabledDate and the server only checks it is present. A typo of 14-Oct-2027 instead of 2026 is accepted on Mark as Dispatched; SampleOrderDelayContributor reads that date as the actual ship date and adds a year of slip to the order, moving its dispatch date.
- **Fix:** Disable future dates in the picker and refuse a dispatchedDate after today in validateComplete. *(visible: future dates are not selectable)*
- **Estimate:** 1 h

#### U343 · P2 · rule 1 — The style picker lets the user tick sample requests of different customers, which the server only refuses at Issue.

*Sample invoice wizard* — `src/pages/sample-request/invoice/InvoiceStepStyles.jsx:31-37; src/pages/sample-request/invoice/SampleInvoiceForm.jsx:111-118; erp/sampling/invoice/SampleInvoiceValidator.java:65-73`

- **What happens:** Eligible SRs of two buyers are listed together and nothing disables the second buyer's rows once one is ticked (listEligibleSrs supports consigneeBuyerId but the form never passes it). The user builds the invoice across two buyers, fills header and rates, presses Issue and only then gets 'An invoice covers one customer only'.
- **Fix:** Once one SR is ticked, disable rows of other buyers with a reason, or pass consigneeBuyerId to listEligibleSrs. *(visible: other customers' rows grey out after the first pick)*
- **Estimate:** 1 h

#### U344 · P2 · rule 34 — The courier cost against an order is never shown because the server still returns a hard-coded 0.

*Order view - Sample Requests card* — `src/pages/sample-request/OrderSampleRequestSummaryCard.jsx:84-88; erp/sampling/request/service/SampleRequestService.java:93-97`

- **What happens:** Dispatches record a courier cost, and the order card is documented to show the total sample courier cost per order, but listByOrderNo returns totalCourierCost: 0 with the comment 'arrives in Stage 4' (Stage 4 shipped). The cost line never renders for any order.
- **Fix:** Sum courierCost once per sent dispatch of the order's SRs in listByOrderNo (or remove the dead UI line). *(visible: the order card shows the sample courier cost)*
- **Estimate:** 1.5 h

#### U345 · P2 · rule 5 — Two users saving comment drafts on the same sample overwrite each other without a conflict.

*Customer Comments* — `src/pages/sample-request/comments/useFeedbackSave.js:53-62; erp/sampling/request/service/SampleFeedbackService.java:57-64; erp/sampling/request/service/SampleFeedbackService.java:104-115`

- **What happens:** saveDraft checks the SR's version but writes only the feedback row, so the SR version never moves. User A and B both open SRQ-12's comments; A saves a draft with fit comments, B (still on the old copy) saves a draft with workmanship comments; B's save passes the version check and replaces A's comments entirely.
- **Fix:** Version the feedback row (or touch the SR) on draft save, and adopt the returned version in the dialog. *(not visible)*
- **Estimate:** 1.5 h

### P3

#### U346 · P3 · rule 1 — A comment draft with a decision picked is labelled 'Feedback recorded' while the sample is still open.

*Customer Comments dialog* — `src/pages/sample-request/comments/CustomerCommentsPage.jsx:246-248; src/pages/sample-request/comments/useFeedbackSave.js:26; erp/sampling/request/service/SampleFeedbackService.java:109`

- **What happens:** Save as Draft stores the chosen decision on the feedback row without changing status; reopening the dialog shows the green 'Feedback recorded' tag on a Dispatched SR, suggesting the decision was applied when it was not.
- **Fix:** Label by SR status (or by a recorded flag), not by feedback.decision. *(visible: a draft shows 'Draft saved')*
- **Estimate:** 0.5 h

#### U347 · P3 · rule 2 — Several catch blocks toast after an axios failure the interceptor has already toasted.

*Module-wide* — `src/pages/sample-request/comments/FeedbackAttachments.jsx:30; src/pages/sample-request/dispatch/DispatchFields.jsx:107; src/pages/sample-request/dispatch/DispatchView.jsx:57; src/pages/sample-request/invoice/SampleInvoiceForm.jsx:287; src/pages/sample-request/comments/FeedbackImportPanel.jsx:52`

- **What happens:** A failed attachment download (axios blob GET) shows the interceptor's toast plus 'Failed to download ...'; a failed eligible-SR load on type switch shows two toasts; the comment-sheet import's 503 AI_NOT_CONFIGURED shows a toast plus the inline 'Import unavailable' alert.
- **Fix:** Use toastUnlessHandled in the four catch blocks, and pass silent:true on parseCommentSheet for the AI_NOT_CONFIGURED case. *(visible: one error message instead of two)*
- **Estimate:** 0.5 h

#### U348 · P3 · rule 8 — A brand-new invoice is marked dirty on open, so Close and every type switch ask to discard changes nobody made.

*Sample invoice wizard* — `src/pages/sample-request/invoice/SampleInvoiceForm.jsx:202-212; src/pages/sample-request/invoice/SampleInvoiceForm.jsx:291-294`

- **What happens:** After load, the profile effect applies countryOfOrigin / exporterRef through patch(), which sets isDirty. Opening New Invoice and immediately switching to Sample type (or leaving) triggers the 'Unsaved Changes' confirm.
- **Fix:** Apply those defaults with setInv directly (not patch) so they do not count as user edits. *(visible: no discard prompt on an untouched invoice)*
- **Estimate:** 0.5 h

#### U349 · P3 · rule 1 — Dispatch documents are size-checked but not type-checked, and a discarded comment-sheet import is still uploaded as an attachment.

*Dispatch form / Comments dialog* — `src/pages/sample-request/dispatch/DispatchFields.jsx:89-97; src/pages/sample-request/comments/FeedbackImportPanel.jsx:48; src/pages/sample-request/comments/FeedbackImportPanel.jsx:109`

- **What happens:** accept='.pdf,image/*' is advisory, so a .heic or .docx challan is staged and only fails after the dispatch saves ('1 document failed to upload'). Separately, parsing a comment sheet stages the file, and 'Discard extraction' does not unstage it, so the wrong sheet is attached on the next save.
- **Fix:** Check the extension against the storage allow-list in beforeUpload, as FeedbackAttachments does, and unstage the source file on Discard extraction. *(visible: a wrong file type is refused at pick time)*
- **Estimate:** 0.5 h

#### U350 · P3 · rule 15, rule 9 — The Customer filter only offers customers on the current page, and costs are formatted with toLocaleString() with no locale.

*Dispatches list* — `src/pages/sample-request/dispatch/DispatchList.jsx:265-268; src/pages/sample-request/dispatch/DispatchList.jsx:204; src/pages/sample-request/dispatch/DispatchView.jsx:130; src/pages/sample-request/OrderSampleRequestSummaryCard.jsx:86`

- **What happens:** With 60 dispatches over three pages, a customer who appears only on page 3 cannot be picked in the filter; once a customer is picked, the options collapse to that one. Courier cost renders in the browser's locale rather than en-IN.
- **Fix:** Feed the filter from listDispatchableCustomers or a buyers facet, and use formatters.js for money. *(visible: all customers are listed in the filter)*
- **Estimate:** 1 h

## HR and payroll

### P1

#### U351 · P1 · rule 1 — A double-click on Save in the salary structure drawer can leave an employee with two current salary structures, after which F&F, EL encashment and the next structure all fail for that employee.

*Employee View - Salary Structure drawer* — `src/pages/hr/employee/SalaryStructureDrawer.jsx:38; src/pages/hr/employee/SalaryStructureDrawer.jsx:72; erp/hr/service/SalaryStructureService.java:48-66; erp/hr/repository/SalaryStructureRepository.java:13; erp/hr/service/FnfSettlementService.java:163; erp/hr/service/ElEncashmentService.java:112`

- **What happens:** HR adds the first salary structure for a new joiner and double-clicks Save. The Save button has no loading/disabled state, so two POSTs go out. Both find no current structure (nothing to supersede, so no optimistic-lock collision), and both insert is_current=true rows; idx_hr_salary_current is a plain, non-unique index. From then on findByEmployeeIdAndIsCurrentTrue (Optional) throws IncorrectResultSize: adding the next structure, calculating the leaver's F&F and running EL encashment all fail with a 500 for that employee, and Salary History shows two 'Active' rows.
- **Fix:** Give the Save button a saving state (loading + disabled while the request runs). On the server, add a partial unique index on hr_salary_structures(employee_id) WHERE is_current, in a new migration, so a race cannot create a second current row. *(visible: Save shows a spinner and cannot be clicked again while saving)*
- **Estimate:** 2 h
- **Note:** The superseding path (a structure already exists) is protected by @Version on the superseded row; only the first structure for an employee is exposed.

#### U352 · P1 · rule 15, rule 16 — The New Advance employee picker loads only the first 200 active employees across all units and never searches the server, so an advance cannot be recorded for anyone after them.

*Salary Advances* — `src/pages/hr/loan/AdvanceList.jsx:62-66; src/pages/hr/loan/AdvanceList.jsx:448-455; erp/hr/controller/EmployeeController.java:32-35`

- **What happens:** A factory has 320 active employees. The picker calls searchEmployees({status:'ACTIVE', size:200}), which the API sorts by employeeNo ascending, and filters only that list on the client. A recent joiner with employee number E0301 asks for an advance: typing their name or number finds nothing, so HR concludes the employee does not exist and cannot record the advance.
- **Fix:** Make the picker search the server as the user types (debounced onSearch with filterOption off, as FnfForm already does), keeping a preloaded first page for the empty dropdown. *(visible: every active employee can be found by typing in the picker)*
- **Estimate:** 1.5 h
- **Note:** The same pattern with a 500 or 1000 cap is recorded separately as P2.

#### U353 · P1 · rule 1 — The bulk attendance grid lists only employees who already have a record for the date, so it cannot mark a fresh day for a unit, although the single-entry screen tells users to use it for exactly that.

*Bulk Attendance Entry* — `src/pages/hr/attendance/AttendanceBulkEntry.jsx:284-292; src/pages/hr/attendance/AttendanceBulkEntry.jsx:493; src/pages/hr/attendance/AttendanceEntry.jsx:115-116; erp/hr/service/AttendanceService.java:415-420`

- **What happens:** A supervisor opens Mark Attendance, reads 'For a whole unit use Bulk Grid Entry', opens the grid, picks today's date and the Sewing unit. getAttendanceByDate returns only existing attendance_daily rows (findByAttendanceDateAndEmployeeUnitId), so the table is empty and Save All is disabled. Nothing explains why. On a day where some rows were imported, employees with no row (a new joiner, someone missed in the file) are not in the grid and cannot be marked from it.
- **Fix:** Build the grid from the unit's active employees (joined on or before the date) merged with the existing rows for that date, leaving status empty where none exists, and skip untouched empty rows on save. *(visible: the grid lists every active employee of the unit for the chosen date, not only those already marked)*
- **Estimate:** 4 h
- **Note:** Server change optional: the UI can merge searchEmployees({unitId}) with the by-date rows, but that inherits the 500-employee cap, so a server endpoint is the better fix.

#### U354 · P1 · rule 1 — A manual loan repayment or 'mark recovered' entered while the month's payroll is processed but not yet approved does not stop the payslip deduction, so the employee repays twice.

*Loans / Salary Advances / Payroll Run* — `src/pages/hr/loan/LoanView.jsx:187-206; src/pages/hr/loan/AdvanceList.jsx:356-362; erp/hr/service/LoanService.java:91-129; erp/hr/service/AdvanceService.java:95-107; erp/hr/service/PayrollService.java:423-441; erp/hr/service/PayrollRecoveries.java:21-27`

- **What happens:** Loan balance is 5,000 with an EMI of 1,000. October payroll is processed (the payslip deducts 1,000 and a LoanRecovery row is written for the run) and waits for approval. The employee settles the loan in cash; HR records a 5,000 repayment, which is allowed because it is not more than the balance, and the loan becomes FULLY_RECOVERED. The run is then approved: applyLoanRecovery clamps the balance at zero, but the payslip still deducts 1,000, so the employee is over-recovered by 1,000. The same happens with an advance marked Recovered between processing and approval: the payslip keeps advanceRecovery while nothing remains PENDING to allocate it to.
- **Fix:** On the server, refuse a manual repayment or 'mark recovered' while a PROCESSED run holds a recovery for that loan or advance, and say to re-process or approve the run first. Alternatively, reduce the manual amount by the pending run recovery. The LoanView hint should name the rule. *(visible: in that window the repayment is refused with a message telling the user to re-process the run first)*
- **Estimate:** 3 h
- **Note:** Money is wrong, but only if the repayment falls between processing and approval, hence P1 rather than P0.

### P2

#### U355 · P2 · rule 4, rule 5 — Save All writes back every row as it was loaded, so a miss-punch correction or single-day edit made after the grid opened is silently reverted.

*Bulk Attendance Entry* — `src/pages/hr/attendance/AttendanceBulkEntry.jsx:350-371; erp/hr/service/AttendanceService.java:159-168; erp/hr/service/MissPunchService.java:85-104`

- **What happens:** A supervisor opens the grid for 14-Oct at 10:00. At 10:05 HR approves a miss punch that sets an operator's in time to 09:00, written through applyPunchCorrection. At 10:10 the supervisor changes one other row and clicks Save All. The payload carries all rows with the in/out times loaded at 10:00, so the operator's corrected in time is overwritten with the stale value. The miss punch shows Approved, but attendance no longer reflects it.
- **Fix:** Send only rows the user changed (track dirty rows), and/or include each row's version so the server refuses a stale overwrite. *(not visible)*
- **Estimate:** 3 h

#### U356 · P2 · rule 1 — Saving the bulk grid strips the leave type and half-day session from days marked LEAVE or HALF_DAY through Mark Attendance or import.

*Bulk Attendance Entry* — `src/pages/hr/attendance/AttendanceBulkEntry.jsx:360-367; erp/hr/service/AttendanceService.java:122-145; erp/hr/service/AttendanceTally.java:86-89`

- **What happens:** On Mark Attendance a clerk records an operator as LEAVE with type CL, and another as HALF_DAY, SECOND_HALF. A supervisor later opens the bulk grid for that date and saves to fix an unrelated row. The payload has no leaveTypeId or halfDaySession. Because these days are not held by an approved leave application, markAttendance sets leaveType to null and halfDaySession to null. The calendar and summary then report the leave as 'Unspecified' and the half day loses which half was worked. The grid offers no inputs to put them back.
- **Fix:** Carry halfDaySession and leaveTypeId from the loaded row through to the payload unchanged, and show them read-only in the grid (or as editors when status is LEAVE or HALF_DAY). *(not visible)*
- **Estimate:** 2 h
- **Note:** Payable days are unaffected (LEAVE counts as payable whatever the type). The loss is in leave reporting and half-day detail.

#### U357 · P2 · rule 5 — The employee form and the salary structure drawer never send the record's version, so the server's optimistic-lock check is skipped and a concurrent edit is silently overwritten, including the whole nominee and document list.

*Employee Form / Salary Structure drawer* — `src/pages/hr/employee/EmployeeForm.jsx:225-232; src/pages/hr/employee/EmployeeForm.jsx:273-326; src/pages/hr/employee/SalaryStructureDrawer.jsx:29-49; erp/hr/service/EmployeeService.java:151-153; erp/hr/service/EmployeeService.java:221-239; erp/hr/service/SalaryStructureService.java:92-94`

- **What happens:** form.setFieldsValue({...emp}) stores version, but validateFields() returns only fields with a Form.Item, so version is never in the payload, and the server only checks it when it is non-null. HR user A opens employee E1 and adds a nominee; user B opens E1 and corrects the bank IFSC. A saves, then B saves: B's payload replaces the nominee list (delete and re-insert) without A's nominee, and nobody is told. The same applies to two people editing the current salary structure.
- **Fix:** Hold the loaded record (or its version) in state and send version: loaded.version on update. The screens reload or navigate after save, so the stale-echo trap does not arise (both services use saveAndFlush or reload via getById). *(visible: the second saver gets the existing conflict dialog instead of silently overwriting)*
- **Estimate:** 1 h

#### U358 · P2 · rule 1 — Editing an employee shows the reporting manager as a bare number, because the manager dropdown has no options until someone types a search.

*Employee Form (edit)* — `src/pages/hr/employee/EmployeeForm.jsx:187; src/pages/hr/employee/EmployeeForm.jsx:241-247; src/pages/hr/employee/EmployeeForm.jsx:572-581`

- **What happens:** HR opens Edit Employee for someone whose manager is employee id 17. managers state is empty, so the antd Select renders the raw value '17' in the Reporting Manager field. Users read it as corrupt data and clear it, which saves the employee with no manager (resolveRelationships sets null). The same raw-id display happens for a unit outside the active branch, or for a department or designation that has since been made inactive, because those option lists are filtered.
- **Fix:** On load, seed managers with {id: emp.reportingManagerId, employeeNo, fullName: emp.reportingManagerName}. For unit, department and designation, append the record's current value to the options when it is missing from the active list. *(visible: the field shows the manager's name (and the current unit, department or designation name) instead of a number)*
- **Estimate:** 1 h

#### U359 · P2 · rule 1 — A PT slab cannot be end-dated from the screen, and every edit clears any end date, so after a state revision the old and new slab tables are both in effect and payroll can deduct the wrong PT.

*HR Masters - PT Slabs* — `src/pages/hr/masters/PtSlabMaster.jsx:103-123; src/pages/hr/masters/PtSlabMaster.jsx:155-190; erp/hr/service/PtSlabService.java:40-52; erp/hr/service/StatutoryContributionCalculator.java:84-100`

- **What happens:** The calculator honours effective_from and effective_to (review F028), but the form has no Effective To field, and PtSlabService.update copies dto.effectiveTo, which is null because the field is absent, so any edit re-opens a closed slab. When Tamil Nadu revises PT, HR adds the new slabs from the revision date. The old slabs never stop, so for a given income both an old and a new slab match, and the loop takes the first by from-amount, which may be the old rate. The payslip PT is then wrong for every employee in that band.
- **Fix:** Add an optional Effective To date to the form (validated to be on or after Effective From) and send it. Server: validate that same-state slabs do not overlap in both income and date range. *(visible: the slab form gains an Effective To date field)*
- **Estimate:** 2.5 h

#### U360 · P2 · rule 1 — A state code typed in lower case is stored in lower case, because the field only looks upper case, and payroll then ignores that slab.

*HR Masters - PT Slabs* — `src/pages/hr/masters/PtSlabMaster.jsx:155-157; erp/hr/service/StatutoryContributionCalculator.java:32; erp/hr/service/StatutoryContributionCalculator.java:84`

- **What happens:** HR edits a slab and retypes the state as 'tn'. style textTransform:uppercase displays 'TN', but the value saved is 'tn'. The calculator queries findByStateCode('TN'), a case-sensitive match in PostgreSQL, so this slab is never found and employees in that income band pay no PT. Nothing on screen shows the difference.
- **Fix:** Normalise with getValueFromEvent={(e) => e.target.value.toUpperCase()} (as EmployeeForm does for PAN), and upper-case stateCode in PtSlabService.create and update. *(not visible)*
- **Estimate:** 0.5 h

#### U361 · P2 · rule 1, rule 8 — Recalculate on an F&F settlement throws away the saved manual overrides with no confirmation.

*F&F Settlement form* — `src/pages/hr/fnf/FnfForm.jsx:105-121; src/pages/hr/fnf/FnfForm.jsx:329-336; erp/hr/service/FnfSettlementService.java:118-148`

- **What happens:** HR saves overrides on a settlement: notice-period recovery waived to 0 and 4,000 of other earnings added. A week later they open Edit / Recalculate to pick up a loan instalment and click Recalculate. The server re-derives every amount ('Manual overrides are replaced'), the form is refilled, and the agreed adjustments are gone; the only feedback is 'Recalculated from current data'. If nobody notices before approval, the employee is settled on the wrong figure.
- **Fix:** Ask for confirmation before recalculating, listing the overridden amounts that will be replaced (comparing fnfData with a fresh derive, or simply whenever any amount differs from the derived value). *(visible: a confirmation dialog appears before Recalculate replaces the amounts)*
- **Estimate:** 1 h

#### U362 · P2 · rule 8 — Unsaved F&F override amounts and unsaved bulk-grid attendance edits are lost without warning on navigation, or in the grid on a simple date or unit change.

*F&F form / Bulk Attendance / Salary Structure drawer* — `src/pages/hr/fnf/FnfForm.jsx:31; src/pages/hr/fnf/FnfForm.jsx:314-322; src/pages/hr/attendance/AttendanceBulkEntry.jsx:270-303; src/pages/hr/attendance/AttendanceBulkEntry.jsx:503-519`

- **What happens:** A supervisor fills OT hours and remarks for 40 rows in the bulk grid, then changes the date picker to check yesterday: fetchData replaces the rows and every edit is gone with no prompt. On the F&F form the 'Unsaved changes' alert is shown, but clicking Back or a menu item leaves without asking.
- **Fix:** Use useUnsavedChanges on FnfForm (dirty) and on AttendanceBulkEntry (dirty rows), and in the grid confirm before a date or unit change discards edited rows. *(visible: a 'discard unsaved changes?' prompt when leaving or switching with edits pending)*
- **Estimate:** 2 h

#### U363 · P2 · rule 7 — The New Advance drawer reopens with the previous, cancelled entry still filled in, so an advance can be saved against the wrong employee.

*Salary Advances / Loan View / Payroll Run* — `src/pages/hr/loan/AdvanceList.jsx:258; src/pages/hr/loan/AdvanceList.jsx:434-447; src/pages/hr/loan/LoanView.jsx:271-286; src/pages/hr/payroll/PayrollRunView.jsx:351-363`

- **What happens:** The form instance lives in AdvanceList and is reset only after a successful save. destroyOnHidden unmounts the fields, but the form store keeps their values (preserve defaults to true), and on remount initialValues do not override stored values. HR starts an advance for employee A, cancels, and an hour later clicks New Advance for employee B: employee A and the old amount are already selected, and a quick Save records the advance against A. LoanView's Record Repayment and PayrollRunView's Mark as Paid modals do the same with amount, reference and remarks.
- **Fix:** Call form.resetFields() when the drawer or modal opens, or in afterOpenChange or afterClose, as LeaveApplyDrawer and MissPunchList already do. *(visible: the drawer opens empty (defaults only) every time)*
- **Estimate:** 0.5 h
- **Note:** Checked in node_modules/@rc-component/form: Form.js:88 calls setInitialValues(init) on remount, and useForm.js:90-105 merges initialValues under the existing store, so the stored values win for preserved fields. destroyForm keeps the store unless clearOnDestroy is set.

#### U364 · P2 · rule 4 — Switching employee or month quickly can show the previous employee's attendance and summary under the newly selected employee.

*Attendance Calendar* — `src/pages/hr/attendance/AttendanceCalendar.jsx:105-130; src/pages/hr/attendance/AttendanceCalendar.jsx:139-162`

- **What happens:** HR selects employee A, then immediately employee B. Both calendar requests are in flight with nothing cancelled or ignored; if A's response arrives last, setCalendarData shows A's days and summary while the picker says B. Someone checking B's absences before payroll reads A's record.
- **Fix:** Ignore stale responses (a request counter or AbortController in each effect), or move both fetches onto useRecord. *(not visible)*
- **Estimate:** 1 h

#### U365 · P2 · rule 15, rule 16 — Employee pickers load a fixed first page (500 company-wide, or 500 per unit) and filter on the client, so employees past that page cannot be chosen and the leave balance grid silently omits them.

*Leave apply / Miss punch / Gate pass / Attendance entry / Leave balances / Loans* — `src/pages/hr/leave/LeaveApplyDrawer.jsx:26-30; src/pages/hr/attendance/MissPunchList.jsx:36-38; src/pages/hr/attendance/GatePassList.jsx:36-38; src/pages/hr/attendance/AttendanceEntry.jsx:50; src/pages/hr/attendance/AttendanceCalendar.jsx:96; src/pages/hr/leave/LeaveBalanceView.jsx:348; src/pages/hr/loan/LoanDrawer.jsx:25`

- **What happens:** With more than 500 active employees, Apply Leave, New Miss Punch and New Gate Pass cannot find anyone after the 500th by employee number; these lists are company-wide, not per unit. In a unit of more than 500, Leave Balances shows only the first 500 rows with no sign that any are missing. LoanDrawer's cap is 1000.
- **Fix:** Use a shared server-searching employee picker (debounced onSearch, as in FnfForm). Leave Balances should page on the server instead of fetching one capped list. *(visible: every active employee can be found, and the balance grid pages through all employees)*
- **Estimate:** 4 h

#### U366 · P2 · rule 37 — Bank account numbers are shown in full on the employee view, and the employee API returns decrypted Aadhaar, PAN and account number to anyone who can view employees.

*Employee View / Employee Form* — `src/pages/hr/employee/EmployeeView.jsx:213; src/pages/hr/employee/EmployeeForm.jsx:225-232; erp/hr/service/EmployeeService.java:48-75`

- **What happens:** A user with only hr-employees view (for example a unit supervisor) opens an employee and sees the full bank account number. The network tab of GET /hr/employees/{id} carries the decrypted Aadhaar and PAN as well, although the view never displays them. The data is encrypted at rest, but every viewer receives the plaintext.
- **Fix:** Return masked values (XXXX-XXXX-1234) from getById by default, and plaintext only to callers with update rights (or from a separate audited reveal endpoint). Mask the account number on the view. *(visible: the account number shows masked (last 4 digits) on the view; the edit form is unchanged for users who can update)*
- **Estimate:** 3 h
- **Note:** Server RBAC is ENFORCE, so this is hardening, not an open hole.

### P3

#### U367 · P3 · rule 1 — Approve is offered to users who have only the update right, and they get a 403 toast when they click it.

*Payroll Run / Bonus Wizard / Bonus Run* — `src/pages/hr/payroll/PayrollRunView.jsx:236-240; src/pages/hr/bonus/BonusWizard.jsx:203-205; src/pages/hr/bonus/BonusRunView.jsx:33; src/pages/hr/bonus/BonusRunView.jsx:36`

- **What happens:** A payroll clerk with hr-payroll update but not approve opens a PROCESSED run and sees Approve beside Re-process. Clicking it confirms and then fails on the server. BonusWizard shows Approve with no permission check at all, and BonusRunView treats update as approve and cancel.
- **Fix:** Gate each Approve or Cancel on its own right (canApprove, canCancel) only, and show the 'ready for approval' note as PayrollWizard does. *(visible: users without the approve right no longer see the Approve button)*
- **Estimate:** 0.5 h

#### U368 · P3 · rule 1 — Inline Approve buttons have no in-flight state, so a double-click sends two approvals and the second shows an 'already approved' error toast.

*Leave / Miss Punch / Gate Pass / EL Encashment lists* — `src/pages/hr/leave/LeaveApplicationList.jsx:64-72; src/pages/hr/leave/LeaveApplicationList.jsx:179-183; src/pages/hr/attendance/MissPunchList.jsx:274-283; src/pages/hr/attendance/GatePassList.jsx:58-67`

- **What happens:** An approver double-clicks Approve on a pending leave. The server's HrRequestStatus guard stops a second balance deduction, but the user sees 'Leave approved' and then a red error, and wonders which one is true.
- **Fix:** Track the id being acted on and disable or spin that row's buttons until the request settles. *(visible: the Approve link spins and is disabled while the request runs)*
- **Estimate:** 1 h

#### U369 · P3 · rule 1 — A loan can be saved with an EMI larger than the loan, with instalments × EMI not matching the amount, or with an EMI start before the loan date.

*Loans* — `src/pages/hr/loan/LoanDrawer.jsx:81-95; erp/hr/service/LoanService.java:71-80`

- **What happens:** HR keys a 10,000 loan with EMI 15,000 and 12 instalments by mistake. Nothing stops it; payroll caps the EMI at the balance, so the whole loan comes out of one month's salary, and the 'Total Installments' shown on the loan no longer means anything.
- **Fix:** Validate in the drawer and in LoanService.create: EMI ≤ amount, dueStartDate ≥ loanDate, and derive or check instalments as ceil(amount / EMI). *(visible: inconsistent entries are refused with an inline message)*
- **Estimate:** 1 h

#### U370 · P3 · rule 2 — HR catch blocks still add their own error toasts on top of the interceptor's, so the user sees the same failure twice, and on statutory file downloads the first toast is a generic message.

*HR module (all screens)* — `src/pages/hr/employee/EmployeeForm.jsx:236; src/pages/hr/employee/EmployeeForm.jsx:347; src/pages/hr/fnf/FnfForm.jsx:177; src/pages/hr/loan/AdvanceList.jsx:66; src/pages/hr/loan/AdvanceList.jsx:75; src/pages/hr/attendance/AttendanceBulkEntry.jsx:334-337; src/pages/hr/attendance/AttendanceCalendar.jsx:152-153; src/pages/hr/statutory/ElEncashmentRunView.jsx:68-69; src/pages/hr/statutory/ContributionFiling.jsx:107-117; src/pages/hr/payroll/PayrollWizard.jsx:47; src/pages/hr/bonus/BonusWizard.jsx:38`

- **What happens:** Saving an employee with a duplicate employee number shows the server's message twice. FnfForm's save also toasts on a 409, on top of the conflict dialog. On Contribution Filing the ECR download failure first toasts the interceptor's generic text (the body is a Blob it cannot read) and then the real reason that the screen parses out of the Blob.
- **Fix:** Remove the catch-block message.error calls. For the blob downloads, pass silent:true and keep the screen's parsed message. *(visible: one error toast instead of two)*
- **Estimate:** 1 h

## Reports (report builder, saved reports, AI chat)

### P0

#### U309 · P0 · rule 37 — The report AI chat runs model-written SQL over the whole live database, so any logged-in user can read password hashes and bank details on api.avarshai.com today

*AI Assistant (AiChatPage)* — `erp/reporting/service/AiReportService.java:45-98; erp/reporting/service/SchemaIntrospectionService.java:45-57; erp/reporting/util/SqlValidator.java:7-24; resources/application.properties:113; resources/application-prod.properties:61; resources/application-dev.properties:32, 72; src/pages/reports/AiChatPage.jsx:280-288`

- **What happens:** erp.reporting.ai-chat.enabled is true in application.properties and false only in the prod profile, but api.avarshai.com runs the dev profile (application-dev.properties:32), whose RBAC is AUDIT and denies nothing. A user asks the AI chat to list user emails with their password hashes: Gemini writes SELECT email, password_hash FROM sys_users, SqlValidator passes it (it only blocks write keywords), and it runs read-only with a 1000-row LIMIT; the rows are also sent to Gemini in the summary prompt. The QA profile inherits enabled=true too.
- **Fix:** Now: set ERP_REPORTING_AICHAT_ENABLED=false on the live and QA services (an environment variable, no code; relaxed binding drops the dash). Then: run the AI chat only over the curated report catalog with role and branch scoping (review F006) before it is turned back on. *(visible: the AI tab answers that AI is not configured until F006 lands)*
- **Estimate:** 0.25 h
- **Note:** P0 pending the owner: it is exploitable only if GEMINI_API_KEY is set on the live Cloud Run service (nothing in the repo sets it). Reported to the coordinator at once; coordinator confirmed and raised it to P0; lane B owns the code fix. The UI field mismatch (separate P1) currently hides the answer text but not the data rows.

### P1

#### U305 · P1 · rule 1 — A report built in the Report Designer never shows a filter, so the Filterable tick does nothing and every run returns all rows.

*Report Builder (run a report)* — `src/pages/reports/ReportBuilderPage.jsx:244; src/pages/reports/components/ReportFilterBar.jsx:166; src/pages/reports/components/ReportColumnPicker.jsx:72; erp/reporting/service/ReportAuthoringService.java:118-145`

- **What happens:** Admin designs 'Pending Orders' on the orders source and ticks Filterable on Status and Order Date. The run screen passes definition.filters (rows of rpt_filters) to ReportFilterBar, but the blueprint path only writes rpt_fields (isFilterable/filterType on the field) and no migration seeds rpt_filters, so filters is [] and ReportFilterBar returns null. The user cannot narrow the report at all.
- **Fix:** Build the filter bar from definition.fields where isFilterable (fieldCode, displayName, filterType), which is what DynamicQueryBuilder.buildFieldFilter already reads; keep definition.filters for legacy raw definitions. *(visible: the Filters card appears for columns ticked Filterable)*
- **Estimate:** 3 h
- **Note:** Fix together with the filter-payload finding below, or the date and number filters will appear but be ignored.

#### U306 · P1 · rule 9 — Date-range, number-range and date filters are sent in a shape the server does not read, so they are silently ignored (or the date is a UTC timestamp).

*Report Builder (run a report)* — `src/pages/reports/components/ReportFilterBar.jsx:83-101; src/pages/reports/components/ReportFilterBar.jsx:134-153; src/pages/reports/ReportBuilderPage.jsx:92; src/pages/reports/ReportBuilderPage.jsx:122; erp/reporting/util/DynamicQueryBuilder.java:170-219; erp/reporting/util/DynamicQueryBuilder.java:232-277`

- **What happens:** User picks Order Date 01-Oct-2026 to 31-Oct-2026. The UI sends filters.order_date = [dayjs, dayjs] (serialised as UTC ISO strings such as '2026-09-30T18:30:00.000Z'); the server only looks for order_date_start / order_date_end, finds neither, adds no condition and returns orders of every month while the badge says one filter is applied. NUMBER_RANGE sends {min,max} where the server wants code_min and code_max (both required); DATE sends a UTC ISO timestamp, which in IST is the previous day, compared as text to a date column.
- **Fix:** Map values before sending: DATE_RANGE to code_start/code_end as dayjs().format('YYYY-MM-DD'), NUMBER_RANGE to code_min/code_max, DATE to 'YYYY-MM-DD'; on the server CAST the bound strings to date and accept a one-sided range. *(visible: the date and amount filters actually narrow the rows)*
- **Estimate:** 3 h
- **Note:** Reachable today only on raw-SQL definitions that carry rpt_filters rows; becomes the main path once the filter bar is built from fields. Not verified on live: the server binds the dates with toString() as varchar, and on PostgreSQL 'date BETWEEN varchar AND varchar' raises 'operator does not exist' unless the JDBC URL sets stringtype=unspecified (none of the committed URLs do).

#### U307 · P1 · rule 9, rule 27 — Every money column in a report is shown with the rupee sign, including USD order values and the column labelled 'Final Price (USD)'.

*Report Builder (results table)* — `src/pages/reports/components/ReportResultsTable.jsx:53-54; src/utils/formatters.js:12; erp/reporting/catalog/SalesDataSources.java:30; erp/reporting/catalog/StyleDataSources.java:72`

- **What happens:** An export order of USD 12,500 is run in an Orders report: the Order Value cell reads '₹ 12,500.00'. On the Cost Sheets source the 'Final Price (USD)' column also prints '₹'. A merchandiser reading the screen (or a screenshot sent to a buyer) gets the currency wrong; the Excel/PDF export has no symbol, so screen and export disagree.
- **Fix:** Format CURRENCY cells as plain en-IN numbers with two decimals (formatNumber(value, 2)), or use the row's currency column when the source carries one; never default to INR. *(visible: the ₹ prefix disappears from report money cells (or shows the row's own currency))*
- **Estimate:** 1 h

#### U308 · P1 · rule 1, rule 2 — The AI chat never shows the answer, the SQL or the server's error, because the UI reads answer/sql and the API sends naturalLanguageAnswer/generatedSql/error.

*AI Assistant (AiChatPage)* — `src/pages/reports/components/AiResultsDisplay.jsx:171; src/pages/reports/components/AiResultsDisplay.jsx:178; src/pages/reports/components/AiResultsDisplay.jsx:184; src/pages/reports/AiChatPage.jsx:292; erp/reporting/dto/AiChatResponse.java:17-21; erp/reporting/service/AiReportService.java:57-65`

- **What happens:** On QA a user asks 'Total PO amount by supplier'. The response is {naturalLanguageAnswer:'...', generatedSql:'SELECT ...', data:[...]}; AiResultsDisplay renders response.answer and response.sql, both undefined, so only the raw table shows. When the model's SQL is rejected or fails, the API answers 200 with {error:'The generated query was rejected for safety: ...', data:[]} and the bubble shows only the two generic suggestions, with no message at all.
- **Fix:** Map the response in reportService.aiChat (answer = naturalLanguageAnswer, sql = generatedSql) and render response.error as an inline Alert in the bubble. *(visible: the written answer, the SQL panel and the error text appear)*
- **Estimate:** 1.5 h
- **Note:** Production has erp.reporting.ai-chat.enabled=false (503), so this is QA/dev only until the chat is re-enabled.

### P2

#### U320 · P2 · rule 6 — Paging a report can repeat or skip rows: it sorts on one non-unique column with no id tie-breaker, and on nothing at all when the default sort column is not selected.

*Report Builder (results paging)* — `erp/reporting/util/DynamicQueryBuilder.java:313-340; src/pages/reports/ReportBuilderPage.jsx:108-114`

- **What happens:** User sorts a 300-row PO report by Status and pages through 20 at a time: PostgreSQL's LIMIT/OFFSET over 'ORDER BY status' is not deterministic within a status, so a PO can appear on page 2 and page 3 while another never shows. If the user deselects po_number (the default sort), buildOrderBy returns '' and there is no ORDER BY at all.
- **Fix:** Append the source's unique key (or the default sort column's expression) as the final ORDER BY term whether or not it is selected. *(not visible)*
- **Estimate:** 1.5 h

#### U321 · P2 · rule 1 — Exports stop silently at 10,000 rows, and CSV/Excel cells are written raw so a value starting with = runs as a formula.

*Report Builder (export)* — `erp/reporting/service/ReportExportService.java:43; erp/reporting/service/ReportExportService.java:76-87; src/pages/reports/ReportBuilderPage.jsx:116-142`

- **What happens:** A GRN report with 14,200 rows exports 10,000 with the success toast 'EXCEL export downloaded' and no hint that rows are missing. A supplier name entered as '=HYPERLINK("http://x","Click")' becomes a live formula when the CSV is opened in Excel.
- **Fix:** Return the truncation (header or row count) and warn in the UI when total > 10,000; prefix cells beginning with = + - @ with a quote in CSV/Excel. *(visible: a warning when the export is capped)*
- **Estimate:** 1.5 h

#### U322 · P2 · rule 10, rule 2 — In production the AI Assistant tab is offered to ai-assistant holders but every question fails with two error toasts, because the API is switched off there.

*AI Assistant (AiChatPage)* — `src/utils/reportConstants.js:123; src/pages/reports/AiChatPage.jsx:294-296; erp/reporting/service/AiReportService.java:45-48`

- **What happens:** A user with the AI Assistant screen opens it on app.avarshai.com, asks a question, sees the 'thinking' pipeline, then gets the interceptor's 503 'The AI report assistant is switched off on this deployment.' plus 'Failed to get AI response. Please try again.' and tries again.
- **Fix:** On a 503 AI_NOT_CONFIGURED replace the input area with a 'switched off on this deployment' notice and drop the catch-block toast. *(visible: a 'switched off' notice instead of an input that always fails)*
- **Estimate:** 1 h

#### U323 · P2 · rule 1 — An AI answer with a JSON column crashes the chat page, and true/false values render as blank cells.

*AI Assistant (AiChatPage)* — `src/pages/reports/components/AiResultsDisplay.jsx:156-167`

- **What happens:** On QA the model writes 'SELECT * FROM sys_roles'; the jsonb permissions column arrives as an object ({type,value,null}) and the cell render returns it as a React child, throwing 'Objects are not valid as a React child' and taking the route to the error boundary, losing the conversation. A boolean is_active column returns true/false, which React renders as nothing.
- **Fix:** In the cell render, String() booleans and JSON.stringify objects/arrays. *(visible: booleans show as true/false; JSON shows as text instead of a crash)*
- **Estimate:** 0.5 h
- **Note:** QA/dev only while production has the chat off.

### P3

#### U326 · P3 · rule 2 — Catch blocks toast again after the interceptor, and saving a report configuration shows two success toasts.

*Reports screens (list, builder, saved, designer, AI chat)* — `src/pages/reports/ReportListPage.jsx:57; src/pages/reports/ReportListPage.jsx:86; src/pages/reports/ReportBuilderPage.jsx:69; src/pages/reports/SavedReportsPage.jsx:32; src/pages/reports/AiChatPage.jsx:295; src/pages/reports/components/ReportDesignerDrawer.jsx:48; src/pages/reports/components/ReportDesignerDrawer.jsx:83; src/pages/reports/components/ReportDesignerDrawer.jsx:116; src/pages/reports/components/SaveReportDrawer.jsx:264; src/pages/reports/ReportBuilderPage.jsx:301`

- **What happens:** A designer save refused for a duplicate code shows the server's message twice; Save Report shows 'Report saved successfully' and 'Report configuration saved' together.
- **Fix:** Drop the catch-block toasts and one of the two success toasts. *(visible: one toast instead of two)*
- **Estimate:** 0.75 h

#### U328 · P3 · rule 7, rule 31 — Report and AI result tables key rows by index through the deprecated rowKey index argument.

*Report Builder / AI Assistant tables* — `src/pages/reports/components/ReportResultsTable.jsx:101; src/pages/reports/components/AiResultsDisplay.jsx:123`

- **What happens:** antd warns that the rowKey index parameter is deprecated; after a re-sort the index keys are reused across different rows.
- **Fix:** Stamp a monotonic __key on each row when results arrive and use rowKey="__key". *(not visible)*
- **Estimate:** 0.5 h

#### U329 · P3 · rule 37 — A failed report run returns the database exception text, which for a grammar error includes the full generated SQL, and dropdown filter options ignore the branch scope.

*Report Builder (server hardening)* — `erp/reporting/service/ReportExecutionService.java:91-92; erp/reporting/service/ReportFilterOptionsService.java:97-98; erp/reporting/service/ReportAuthoringService.java:154-160`

- **What happens:** A malformed number filter makes PostgreSQL fail; the toast reads 'Report execution failed: PreparedStatementCallback; bad SQL grammar [SELECT ... FROM po_purchase_orders p JOIN ...]'. A branch-limited user's Status dropdown lists values found only in other branches.
- **Fix:** Return a generic message with the traceId and keep the detail in the log; add the branch condition to the distinct-values query. *(visible: a shorter error message)*
- **Estimate:** 1 h

## Shared code (components, hooks, context, layout, core services, generic utils)

### P1

#### U197 · P1 · rule 10 — Ctrl+S clicks the page's first primary button even when a dialog or drawer is open

*Every screen (useKeyboardShortcuts)* — `src/hooks/useKeyboardShortcuts.js:20-30 (mounted for every route at src/layout/MainLayout.jsx:212)`

- **What happens:** querySelector over the selector list returns the first match in DOCUMENT order, and every Modal/Drawer portals to the end of <body> after #main-content (no getPopupContainer is set), so the page's button always wins. Worst cases on the batch-1 screens: on BOMForm, Ctrl+S inside the allowance or matrix dialog clicks Create/Update BOM, which releases a draft BOM, sends 'BOM finalized' notices and navigates away, dropping the dialog's edits; on the costing sheet, Ctrl+S inside any dialog (template, consumption calculators, AI review, quick-create) clicks Submit, which auto-approves the sheet when no costing flow exists; on the Cutting PO / Work Order forms it clicks Save & Submit, or 'Mark PP Approved' while the PP sample is pending (no UI undo); on Cut Panel / Garment Process POs it clicks 'Submit for Approval' on a draft, or 'Send to Vendor' behind an open Cancel/Amend dialog; on a GPR draft it submits with no confirmation; on the order, PO and BOM lists (whose views are dialogs) it clicks 'New …' and discards a half-typed reject or refer-back reason. A closed but non-destroyed dialog (POView's main Modal) also stays matchable.
- **Fix:** Pick the topmost open overlay (visible .ant-modal-wrap or .ant-drawer-open, highest z-index), query only inside it, skip .ant-btn-loading as well as [disabled], and never fall through to #main-content while an overlay is open. Owner to decide what page-level Ctrl+S should press on forms whose first primary is Submit (a data-shortcut="save" marker on Save Draft is the safe default). *(visible: Ctrl+S inside a dialog acts on that dialog; page-level target per the owner's choice)*
- **Estimate:** 3 h
- **Note:** Appendix B 'Ctrl+S may hit the page behind a dialog'. The costing sheet's own handler (sheet/hooks/useSheetShortcuts.js) defers to this one whenever an overlay is open. Also re-targets My Approvals: Ctrl+S in a Reject dialog clicks another row's Review, and the still-open dialog then posts against that row's request (give the bar key={entityType-entityId}).

#### U198 · P1 · correctness — A superuser cannot act on an approval assigned to someone else from any screen

*Approval action bar (order, PO, costing, production-PO, job-work views; My Approvals)* — `src/components/approval/ApprovalActionBar.jsx:109-118, 168-187; erp/approval/service/ApprovalRequestService.java:171-187, 289-299`

- **What happens:** userCanAct accepts only the level's named user or role and never consults isSuperuser() (src/utils/permissions.js:724), although the server lets a superuser act at any level precisely so that 'a flow whose approver has left the company' can be cleared 'from a screen', and lists every pending request in the superuser's inbox. The bar is the only UI caller of processApprovalAction, so the owner sees 'Waiting on … approver' with no buttons on the document and in My Approvals. Latent while production has no approval flows configured (zero on 2026-09-23); live with the first flow.
- **Fix:** Return true from userCanAct when currentUser.isSuperuser is true (the level's allowReject/allowReferBack filter already mirrors the server). *(visible: a superuser sees Approve/Reject/Refer Back on requests assigned to others)*
- **Estimate:** 1 h
- **Note:** The Owner Flutter app already applies this bypass; the web bar disagrees with both the server and the app.

#### U372 · P1 · rule 37, rule 38 — The idle timeout says 'You have been logged out' but logs nobody out, so pressing F5 or opening a new tab carries on as the previous user

*Session / idle timeout* — `src/hooks/useIdleTimeout.js:64-68; src/components/SessionExpiryGuard.jsx:254-292, 36-40; src/context/SessionContext.jsx:91-129; src/components/ProtectedRoute.jsx:19-38; src/services/auth/authService.js:342-371`

- **What happens:** On a shared PC user A leaves a browser tab idle for 30 minutes. The 'Session Timed Out' modal opens, but nothing is cleared: the access token stays in memory, SessionContext keeps refreshing it before it expires, the refresh cookie and the sessionActive flag stay put, and the page data stays visible behind the mask. User B presses F5 (or opens the app in a new tab): ProtectedRoute sees sessionActive, initializeSession refreshes with A's cookie, and B is working as A. Logout happens only if someone clicks 'Go to Login'.
- **Fix:** When isIdle turns true, run the logout (logoutUser, which revokes the refresh cookie and runs clearAll) straight away, then show the modal. Stop the proactive refresh while idle. *(visible: after an idle timeout, a reload lands on the login page instead of the previous user's session; the modal looks the same)*
- **Estimate:** 2 h

#### U373 · P1 · rule 1, rule 8 — After a laptop sleeps for 15-30 minutes the tab shows 'Session Expired' and its only button logs out, although the refresh cookie could have renewed the session silently

*Session / token expiry after sleep* — `src/context/SessionContext.jsx:94-103; src/components/SessionExpiryGuard.jsx:36-40, 142-182; erp/../resources/application.properties:128 (access token 15 min)`

- **What happens:** A merchandiser is halfway through a PO form and closes the lid for a 20-minute meeting (idle timeout is 30). On wake, checkSession finds the 15-minute access token already expired and calls markExpired without trying a refresh. The blocking modal offers only 'Go to Login', which calls logoutUser and revokes the still-valid refresh token. The unsaved form is lost, and any other open tab of the same user dies at its next refresh.
- **Fix:** In checkSession, when secondsLeft <= 0 (or no token) and no refresh has been tried yet, call refreshSession first and mark expired only if it fails; also re-check on visibilitychange. *(visible: no 'Session Expired' modal after a short sleep while the session is still renewable)*
- **Estimate:** 2 h

#### U385 · P1 · rule 36, rule 28 — Bullet lists in Terms & Conditions show as numbered lists (and indents/alignment are lost) in the read-only T&C viewer and on the printed PO

*RichTextEditor (T&C viewer) / PO print T&C* — `src/utils/sanitizeRichText.js:18-23; src/components/RichTextEditor.jsx:54-56, 73-86, 194-205; src/utils/poPdfGenerator.js:582, 905`

- **What happens:** A merchandiser writes T&C with a bullet list in the editor; react-quill-new 3.8.3 saves getSemanticHTML() (<ul><li>). The sanitiser added for U206 re-emits quill.root.innerHTML, which in Quill 2 is <ol><li data-list="bullet"> with indent/alignment as ql-indent-N / ql-align-* classes. Those are only styled under .ql-editor (quill.snow.css), and neither the read-only div (.rich-text-readonly) nor the print .terms-content has that class, so a user without update rights and every supplier receiving the PO see 1. 2. 3. instead of bullets and lose nesting. The .rich-text-readonly list CSS is also only injected when an editor (edit mode) is mounted.
- **Fix:** Have the sanitiser return quill.getSemanticHTML() (what the editor stores), or keep root markup but render it inside a .ql-editor container in both the viewer and the print; move the read-only CSS out of the edit-mode <style> block. *(visible: bullets, nesting and alignment render as the author typed them (restores the pre-U206 look))*
- **Estimate:** 2 h
- **Note:** Verified in node_modules: quill 2.0.3 formats/list.js ListContainer.tagName='OL' with data-list; react-quill-new lib/index.js:47 onChange passes getSemanticHTML. Commit 1bc1508 claimed byte-identical output; that holds only for HTML already in Quill root markup, not for what the current editor saves. Arguably P1 since it is on every PO print with a bulleted T&C. Raised to P1 by the lead: a regression from the U206 gate fix that shows on every printed PO with bulleted terms. Verified: react-quill-new saves getSemanticHTML() (lib/index.js:47), and sanitizeRichTextWith returns quill.root.innerHTML.

### P2

#### U199 · P2 · rule 2 — Background image and attachment reads raise error toasts because fileService cannot make them silent

*fileService previews (order, PO, BOM screens)* — `src/services/core/fileService.js:58-74; src/services/costing/costingService.js:79-82, 334-340; callers src/pages/orders/OrderForm.jsx:134-136, 907, 1124-1132; src/pages/orders/OrderView.jsx:134-142; src/pages/po/POView.jsx:258-273; src/pages/po/POForm.jsx:442-461; src/pages/po/BomLineSelectionDrawer.jsx:113-116`

- **What happens:** The callers treat these reads as non-critical (empty catches), but getFilesByEntity/downloadFileAsBlob cannot pass silent: true, so the interceptor toasts every failure. With uploads lost on container restarts while their database rows survive (recorded 2026-09-23), opening an order or PO whose image is gone stacks 'Server error occurred. Please try again later.' toasts, one per image.
- **Fix:** Give these service functions a request-config parameter and pass { silent: true } from the preview and suggestion reads. *(visible: the spurious toasts stop)*
- **Estimate:** 1 h

#### U374 · P2 · rule 8, rule 37 — An idle second tab's 'Go to Login' revokes the session the user is actively working in another tab

*Session / idle timeout across tabs* — `src/hooks/useIdleTimeout.js:33-81; src/components/SessionExpiryGuard.jsx:36-40; src/services/auth/authService.js:207-223`

- **What happens:** A user works in the PO form in tab 1 and left the PO list open in tab 2. Activity is tracked per tab, so tab 2 reaches its 30-minute idle timeout and says 'You have been logged out'. The user clicks 'Go to Login' there. That revokes the shared refresh cookie, so tab 1 gets 'Session Expired' within 15 minutes and loses unsaved input.
- **Fix:** Share last activity across tabs (a localStorage timestamp and the storage event, or a BroadcastChannel) so that idle means idle in every tab. *(visible: a background tab no longer times out while another tab is in use)*
- **Estimate:** 2 h

#### U375 · P2 · rule 38 — Logout never clears the working branch, so the next user on the browser starts in the previous user's branch

*Logout / shared PC* — `src/services/auth/sessionStore.js:111-115 (clearSessionActiveFlag, never called anywhere), 178-197 (clearAll); src/context/BranchContext.jsx:64-75`

- **What happens:** User A switches the header branch to Chennai and logs out. User B (home branch Tirupur, allowed both branches) logs in on the same PC. activeBranchId is still 'Chennai', so reconcileStored keeps it: B's lists are filtered to Chennai and B's new documents default to Chennai (effectiveBranchId). The comment at sessionStore.js:113 says the next user starts at their own home branch, but the only function that removes the key is dead code.
- **Fix:** Remove activeBranchId in clearAll (or call clearSessionActiveFlag from logout and expiry). *(visible: after another user's logout, a new login starts at the user's own home branch)*
- **Estimate:** 0.5 h

#### U376 · P2 · rule 37, rule 38 — Logging out in one tab leaves other tabs signed in, and after the next login those tabs silently switch to the new user

*Session / multiple tabs* — `src/services/auth/sessionStore.js:178-197; src/services/auth/authService.js:207-223, 273-328; erp/iam/security/JwtAuthenticationFilter.java:40-60 (stateless access token)`

- **What happens:** On a shared PC user A has two tabs open and logs out in one. Nothing listens for the storage change, so the other tab keeps A's in-memory access token and stays fully usable as A for up to 15 minutes. If user B then logs in in the first tab, A's remaining tab refreshes with B's cookie at its next refresh and carries on as B, still showing A's screens, store cache and header name.
- **Fix:** Listen for the storage event on sessionActive/currentUser (or a BroadcastChannel): on removal, clear the session and go to /login; on a different user id, reload. *(visible: other tabs go to the login page when the user logs out in one)*
- **Estimate:** 2 h

#### U377 · P2 · rule 38, rule 13 — Logout does not clear the master-data store or the remembered list queries, so the next user in the same tab is served the previous user's cached lists

*Logout / StoreContext and list memory* — `src/context/StoreContext.jsx:132-215 (clearStore has no caller); src/App.jsx:245-502 (StoreProvider sits above /login and survives logout); src/utils/listMemory.js:9-26; src/services/auth/sessionStore.js:178-197`

- **What happens:** An admin opens screens that load the users, roles, suppliers and buyers keys into StoreContext, then logs out. Logout is an SPA navigation to /login, so StoreProvider is never remounted. A clerk logs in within 5 minutes, and every screen that reads those keys uses the admin's cached arrays (isCacheValid is still true) instead of fetching under the clerk's own permissions and branch. That includes the users list, which the clerk may not hold users.view for. The sessionStorage list memory (erp:list:<path>, holding search text and filters) also survives, so the clerk's first 'back to list' from a form opens the admin's last search.
- **Fix:** Call clearStore on the authChange event when the session is cleared (or key the StoreProvider by user id), and remove the erp:list:* keys in clearAll. *(visible: the first screen after a user switch loads its masters afresh (a brief spinner))*
- **Estimate:** 1 h

#### U378 · P2 · rule 38, rule 37 — A browser's push subscription stays bound to the user who first enabled it, so after a user switch that user's notifications keep appearing on the PC and the new user gets none

*Push notifications / shared browser* — `src/hooks/usePushNotification.js:20-37; src/services/auth/authService.js:207-223; erp/notification/service/PushSubscriptionService.java:24-46`

- **What happens:** Merchandiser A enables notifications on a shared PC, then logs out; logout never unsubscribes. B logs in: usePushNotification finds the existing browser subscription, sets isSubscribed=true and never calls subscribePush for B, so the server keeps the endpoint under A. A's approval requests and PO updates (title and body) keep popping up as system notifications on that PC, and while B's app is visible they are forwarded into B's in-app notification centre (PUSH_RECEIVED). B receives no pushes on this browser at all.
- **Fix:** On logout, call unsubscribePush for the current endpoint (keep the browser subscription). On login, when a subscription exists and permission is granted, call subscribePush so the endpoint is re-registered for the new user. *(visible: notifications on a shared PC follow whoever is signed in)*
- **Estimate:** 2 h

#### U379 · P2 · rule 38, rule 4 — Transactional API GETs fall back to a copy up to 30 minutes old whenever the network takes longer than 10 seconds, with nothing on screen saying the data is stale

*Service worker / API caching* — `src/sw.js:115-128 (erp-api-data NetworkFirst, networkTimeoutSeconds 10, maxAge 30 min); src/sw.js:77-92 (users/roles in erp-master-data)`

- **What happens:** On a slow factory connection a storekeeper opens the stock register or a PO list that takes 12 s. At 10 s the service worker answers with the copy cached 25 minutes earlier. The screen shows old stock balances and statuses as if they were live, and the user acts on them (issues stock, raises a PO, approves). Only bill passing and order mapping are network-only. Rule 38 asks for transactional GETs to be network-only.
- **Fix:** Make the transactional routes NetworkOnly (or NetworkFirst with no networkTimeoutSeconds, so the cache is used only when the network actually fails) and keep only the master-data cache for offline viewing. *(visible: on a very slow network a list waits for the server instead of showing an older copy)*
- **Estimate:** 1 h
- **Note:** Commit 248224b deliberately kept offline viewing; confirm with the owner whether the 10 s timeout fallback (as opposed to offline-only fallback) is intended.

#### U380 · P2 · rule 3 — After a screen crashes, moving to another screen from the menu still shows the error, and a crash in the layout, providers or login is a white page

*Error boundary* — `src/layout/MainLayout.jsx:1039-1042; src/components/ErrorBoundary.jsx:22-39; src/App.jsx:238-505; src/main.jsx:12-16`

- **What happens:** A screen throws during render and the boundary shows 'This screen could not be displayed'. The user clicks Orders in the sidebar: the URL changes, but the boundary is not keyed by location and keeps its error state, so the same error screen stays until 'Try again' or a reload. A render error in MainLayout, a provider or /login has no boundary at all, so React unmounts the tree and the user gets a blank page.
- **Fix:** Key the boundary by location.pathname, and add an outer boundary around the providers and routes in App.jsx. *(visible: navigating away from a crashed screen opens the new screen; a shell crash shows the error card instead of a blank page)*
- **Estimate:** 1 h
- **Note:** Listed in the Appendix B baseline ('one boundary, not keyed by route') but not in the register.

#### U386 · P2 · rule 4 — A slow approval-history response for the previous document can land last, so Approve/Reject acts on the previous document's request while the dialog names the current one

*ApprovalActionBar* — `src/components/approval/ApprovalActionBar.jsx:86-105, 133-142`

- **What happens:** On CostingView (or any view whose entityId changes without remounting the bar) the user moves from cost sheet A to B while A's getApprovalHistory is still in flight; B's response arrives first, then A's overwrites request. The bar now shows A's level, and Approve sends processApprovalAction(A.request.id) while the dialog and success toast say B's number.
- **Fix:** Ignore stale responses (request token or AbortController keyed on entityType/entityId) and reset request when the entity changes. *(not visible)*
- **Estimate:** 1 h
- **Note:** Needs out-of-order responses; MyApprovals unmounts the bar on drawer close so it is safe there.

#### U387 · P2 · rule 1, rule 4 — The unread badge is fetched once per session, so without push it never shows new notifications and 'Mark all read' stays disabled while unread rows are visible

*NotificationCenter* — `src/components/NotificationCenter.jsx:93-97, 115-122, 215`

- **What happens:** A user who has not enabled push (or whose SW message is lost) keeps the app open; new approval notifications arrive on the server. The bell badge stays at its login-time value (e.g. 0). Opening the panel lists the new unread rows, but unreadCount is not recomputed from them, so the badge stays 0 and the 'Mark all read' button is disabled (disabled={unreadCount === 0}).
- **Fix:** Refresh the count when the panel opens (and on focus/visibility or a modest interval), or derive it from the loaded list when the panel is open. *(visible: the badge reflects new notifications; Mark all read enables when unread rows exist)*
- **Estimate:** 1.5 h

#### U388 · P2 · rule 22 — A quick vertical scroll of the notification list on a tablet can delete a notification with no undo

*SwipeableNotificationItem* — `src/components/SwipeableNotificationItem.jsx:99-132`

- **What happens:** On a tablet the user flicks the notification list up; the finger drifts 15 px sideways in ~25 ms. touchmove marks isDragging once |deltaX|>10 without comparing it to vertical movement, and touchend triggers when velocity |deltaX|/elapsed > 0.5 px/ms, so 15/25 = 0.6 fires the swipe-left branch and calls onDelete - the notification is deleted on the server with no confirm or undo.
- **Fix:** Lock the gesture to horizontal only when |deltaX| clearly exceeds |deltaY|, require a minimum distance alongside the velocity test, and offer undo before deleting. *(visible: scrolling no longer deletes; deliberate swipes behave as now)*
- **Estimate:** 1.5 h

#### U389 · P2 · rule 38 — Laya AI conversations survive logout in sessionStorage, so the next user in the same tab sees them and sends them to the AI as their own history

*Laya AI (GenieProvider)* — `src/components/genie/GenieProvider.jsx:7-20, 46-53; src/components/genie/useGenieChat.js:28-29, 37-42; src/services/auth/sessionStore.js:178-197; src/pages/master/genie/MasterAssistant.jsx:14`

- **What happens:** On a shared factory PC, user A asks Laya on Master Data (storageKey 'master', shared by all users) or on a costing sheet about prices and buyers, then logs out. clearAll() removes only auth keys; 'avarsh-genie-threads' stays in sessionStorage. User B logs in in the same tab, opens Master Data and Laya: A's conversation is shown, and B's next question sends the last 12 of A's messages as history to /genie.
- **Fix:** Remove 'avarsh-genie-threads' in clearAll() (and on branch change), or key the threads by user id. *(not visible)*
- **Estimate:** 0.5 h

#### U390 · P2 · rule 8 — Picking a Pantone suggestion and saving without pressing the tick stores the raw typed text instead of 'code / name'

*PantoneColorInput (Item Master colour attribute)* — `src/components/PantoneColorInput.jsx:56-63, 93-111, 187-199`

- **What happens:** In Item Master the user types '18-1662' in the colour attribute: onChange('') clears the value and the search runs. They click a suggestion; the input's blur timer (200 ms, stale closure with selectedCode=null) then calls onChange('18-1662'). The name box appears pre-filled with 'Flame Scarlet', but the user clicks the form's Save without pressing Enter or the tick, so the variant is saved with colour '18-1662' rather than '18-1662 TCX / Flame Scarlet' (and attribute-derived variant codes follow the wrong value).
- **Fix:** Commit `${code} / ${name}` as soon as a suggestion is picked (the tick only renames), and drop the stale blur write when a suggestion was chosen. *(visible: the picked colour is kept even if the user does not press the tick)*
- **Estimate:** 1.5 h
- **Note:** Blur-timer ordering read from code, not reproduced in a browser.

### P3

#### U200 · P3 · rule 2 — A failed approval action shows two toasts and never refreshes the bar

*Approval action bar* — `src/components/approval/ApprovalActionBar.jsx:96-97, 146-148`

- **What happens:** The catch toasts the same server text the interceptor already showed; after another approver acted first, retries keep hitting 'not pending' with double toasts because the bar is not reloaded. A failed history fetch renders the legacy fallback buttons while a request is actually pending.
- **Fix:** Drop the catch toast (or toastUnlessHandled), reload the request after a failure, and show an error state instead of the fallback when the history fetch fails. *(visible: one toast; the bar refreshes after a refusal)*
- **Estimate:** 0.5 h

#### U201 · P3 · rule 31 — Timeline items use the deprecated children/dot props (console warnings)

*Costing history, PO activity, order mapping, production approval history, approval timeline* — `src/pages/costing/CostingHistoryModal.jsx:541-543; src/pages/po/POView.jsx:1562-1576; src/pages/po/order-mapping/PoOrderMappingDrawer.jsx:137; src/pages/po/components/ProductionApprovalTimeline.jsx:27-28; src/components/approval/ApprovalHistoryTimeline.jsx:35-36, 55-56`

- **What happens:** antd 6.2.2 warns items.children → items.content and items.dot → items.icon (node_modules/antd/es/timeline/Timeline.js:113-114) whenever these timelines render; the route sweep did not see them because they render only inside dialogs and tabs. No visible effect.
- **Fix:** Rename children → content and dot → icon. *(not visible)*
- **Estimate:** 0.5 h
- **Note:** Reported by lane A; verified against node_modules.

#### U202 · P3 · rule 31 — The antd 6 deprecation reference lists Input addonBefore/addonAfter as valid, but antd 6.2.2 warns on them

*erp-dev reference (antd6-deprecations.md)* — `.claude/skills/erp-dev/references/antd6-deprecations.md:11-12, 155-157; node_modules/antd/es/input/Input.js:50-51`

- **What happens:** Input.js deprecates addonAfter/addonBefore in favour of Space.Compact, so a lint selector or review built from the reference would let them through. No Input addon is used in the orders, BOM, costing or PO screens (Input.Search renders its own Space.Compact and does not trip it).
- **Fix:** Move Input addonBefore/addonAfter into the deprecations table (→ Space.Compact) and re-derive the list as the reference describes. *(not visible)*
- **Estimate:** 0.25 h
- **Note:** Reported by lane A; verified against node_modules.

#### U381 · P3 · rule 2 — Clicking a system notification never marks it read, because the service worker sends the PATCH to the app's own host without a token

*Service worker / notification click* — `src/sw.js:274-277; public/_redirects:6-7; .env:2`

- **What happens:** The API lives on api.avarshai.com, but notificationclick calls fetch('/api/v1/notifications/{id}/read') relative to the app origin (Netlify), with no Authorization header. The request never reaches the API, so the notification stays unread in the bell after the user has opened it from the system tray.
- **Fix:** Leave mark-as-read to the page: open the target URL with the notification id (for example ?notificationId=) and have the app mark it read through axiosInstance. *(visible: notifications opened from the system tray show as read)*
- **Estimate:** 1 h

#### U382 · P3 · rule 1, rule 2 — A user without dashboard access who lands on '/' gets an 'Access denied' toast before being redirected

*Dashboard* — `src/pages/Dashboard.jsx:80-102; src/App.jsx:266, 498; erp/dashboard/controller/DashboardController.java:15`

- **What happens:** A storekeeper's role has no 'dashboard' key. They follow any route to '/' (the catch-all redirect, the logo, or an F5 on /login). Dashboard renders <Navigate>, but its effect has already called GET /dashboard, which the server refuses (403), so the interceptor shows 'Access denied' on the screen they are sent to.
- **Fix:** Do the access check in the route (a PermissionRoute-style redirect) or skip the summary load when hasModuleAccess('dashboard') is false. *(visible: no stray 'Access denied' toast)*
- **Estimate:** 0.5 h

#### U383 · P3 · rule 2 — A failed blob download toasts a generic message instead of the server's reason

*axiosInstance / file downloads* — `src/services/core/axiosInstance.js:179-215; src/services/core/fileService.js:66-72`

- **What happens:** For responseType 'blob' the error body arrives as a Blob, so data.message and data.error are undefined. A 403 or 404 on a file download shows 'Access denied...' or 'Resource not found.', and a 400 with a specific reason shows 'An unexpected error occurred', instead of the server's message.
- **Fix:** In the interceptor, when data is a Blob of type application/json, read its text and parse it before choosing the message. *(visible: download errors show the server's wording)*
- **Estimate:** 0.5 h

#### U384 · P3 · rule 27 — The header always shows 'User' under the name instead of the user's role

*Header / user menu* — `src/layout/MainLayout.jsx:1018; src/services/auth/authService.js:81-101`

- **What happens:** The session object built at login and refresh has `role` (the JWT role claim) but no `roleName`, so `currentUser?.roleName || 'User'` always falls back to 'User' for every account.
- **Fix:** Read currentUser.role in the header. *(visible: the header shows the role name (e.g. 'Merchandiser') instead of 'User')*
- **Estimate:** 0.25 h

#### U391 · P3 · rule 33 — Notification rows and action chips, and the FileUpload drop area, can only be used with a mouse or touch

*SwipeableNotificationItem / FileUpload* — `src/components/SwipeableNotificationItem.jsx:182-186, 217-221; src/components/FileUpload.jsx:325-371`

- **What happens:** A keyboard user cannot open a notification or press its Approve/Reject chip (div/span with onClick, no role or tabIndex), and cannot open the file picker from the FileUpload area (div onClick; the hidden input has no name/id).
- **Fix:** Give them role=button, tabIndex=0 and Enter/Space handlers (or use buttons), and an id/name on the hidden input. *(not visible)*
- **Estimate:** 1 h

#### U392 · P3 · rule 31 — The percentage and quantity variants of FormInputNumber pass addonAfter, which antd 6.2.2 deprecates on InputNumber (console warning)

*FormInputNumber* — `src/components/form/FormInputNumber.jsx:26-33; callers src/pages/po/components/MarkerUploadCard.jsx:33; src/pages/po/workorder/WorkOrderForm.jsx:249`

- **What happens:** Opening the Cutting PO marker card or the Work Order form logs 'addonAfter is deprecated, use Space.Compact' (node_modules/antd/es/input-number/index.js:150-151).
- **Fix:** Render the % / UOM suffix with Space.Compact plus an addon (or the suffix prop) so the look is unchanged. *(not visible)*
- **Estimate:** 0.5 h
- **Note:** Distinct from U202 (Input, not InputNumber).

#### U393 · P3 · rule 34 — Six shared components and two PermissionGuard exports are imported nowhere

*Unused shared components* — `src/components/FilePreviewGrid.jsx; src/components/ImagePreview.jsx; src/components/SummaryCard.jsx; src/components/InfoPopover.jsx; src/components/ComingSoon.jsx; src/components/LoadingState.jsx; src/components/PermissionGuard.jsx:37-61 (withPermission, usePermission)`

- **What happens:** grep over src/ finds no importer of these files or exports; they are maintained and reviewed for nothing (e.g. ImagePreview never resets its error state when src changes, a latent bug in dead code).
- **Fix:** Delete them (knip will keep them out). *(not visible)*
- **Estimate:** 0.5 h

#### U394 · P3 · rule 4 — Closing a quick-create drawer while it saves still runs the caller's onCreated, and also closes any drawer opened since

*QuickCreateProvider* — `src/components/quickcreate/QuickCreateProvider.jsx:16-21; src/components/quickcreate/QuickCreateDrawer.jsx:31-41`

- **What happens:** On the costing sheet the user clicks Create in New material, then closes the drawer and opens New buyer. The first save returns: done() (closed over the old request) calls the material row's onCreated and then setRequest(null), shutting the New buyer drawer the user is typing in.
- **Fix:** In done(), act only if the request id still matches the open request (otherwise just call that request's onCreated). *(not visible)*
- **Estimate:** 0.5 h

#### U395 · P3 · rule 28 — 'View All' on two dashboard cards is a plain href, so it reloads the whole app instead of navigating

*Dashboard (Pending POs, Recent Orders cards)* — `src/components/dashboard/PendingPosCard.jsx:52; src/components/dashboard/RecentOrdersCard.jsx:49`

- **What happens:** Clicking View All on Pending Supplier PO does a full page load: the in-memory access token is dropped and re-fetched via the refresh cookie, the store cache is cold and an installed PWA flashes the boot screen.
- **Fix:** Use react-router Link (or navigate) for both links. *(visible: the list opens without a full reload)*
- **Estimate:** 0.3 h

## Preview modules (production finishing, production job work, job-work bill passing)

### P1

#### U396 · P1 · rule 10 — Three Finishing tabs write real production records while the screen's Preview banner says nothing entered there is saved to the server

*Finishing - Receiving and External Process* — `src/utils/permissions.js:308-311, 573-574; src/components/PreviewBanner.jsx:15; src/pages/production/finishing/FinishingWorkspace.jsx:47; src/pages/production/finishing/ReceivingDrawer.jsx:125-133; src/pages/production/finishing/GarmentIssueDrawer.jsx:88; src/pages/production/finishing/GarmentReceiveDrawer.jsx:58; src/pages/production/finishing/GarmentCheckForm.jsx:89; src/services/production/finishingService.js:50-63; src/services/production/finishingProcessApi.js:1-5`

- **What happens:** /production/finishing is flagged preview:true, so every tab shows 'Preview: data entered here is kept in this browser only and is not saved to the server', and the header says 'design preview on sample data'. A supervisor tries things out on the tabs. (1) Receiving > Record Receiving sends PUT /sewing/garment-issues/{id}/receipt to the production API. A full receipt moves the sewing note to ACKNOWLEDGED and it is no longer offered. The finishing RCV record is held only in a module-level object (finishingMockApi.js:18-30) and is gone on the next reload. (2) External Process > Issue Garments, Receive Garments and Garment Check call POST /finishing/process-issues, /process-returns and /garment-checks. Process issues and receipts against a Garment Process PO move that PO's balances and status (GarmentIssuePoLink), and so its billing. The user was told none of this reaches the server.
- **Fix:** Narrow the banner to the mock tabs, either by tab (a per-tab preview flag) or by having PreviewBanner skip ?tab=external-process. Mark the Receiving drawer as live, or stop it posting to Sewing until Finishing receiving has its own API, and at cutover save both in one server transaction. *(visible: the banner disappears on External Process and the Receiving drawer says it posts to Sewing)*
- **Estimate:** 3 h
- **Note:** The External Process tab has been on the real API since the job-work release; it was put inside a preview workspace.

#### U410 · P1 · rule 42, rule 51 — A confirmed deduction keeps its old amount after the bill's lines change, so the debit note and net payable come out wrong

*Job-work Bill Passing* — `src/utils/jobWorkBillCalc.js:97-145, 157-189; src/services/inventory/jobWorkBill/jwbMockBills.js:98-130; src/pages/inventory/bill-passing/jobwork/JobWorkBillForm.jsx:53-60, 125`

- **What happens:** A Garment Process PO line: 500 pcs invoiced at Rs 4.50 (2,250.00), 475 accepted. Propose deductions gives REJECTION_CHARGE 112.50 + GST, and the verifier confirms it. The clerk then corrects the vendor's invoice quantity to 480 (the vendor actually billed 480), so the line's rejection amount is now 22.50. mockUpdateBill re-derives the lines but leaves the confirmed deduction at 112.50. A second 'Propose' skips that line and type because confirmed rows are 'ruled', and no exception compares confirmed system deductions with the current line figures. Net payable = 2,160 + GST - (112.50 + GST): the vendor is under-paid by Rs 90 + GST, and the VDN prints 112.50 (25 pcs) when only 5 billed pieces were rejected.
- **Fix:** Store the line figure each system deduction was proposed from, and raise a BLOCK exception (or reset the row to PROPOSED) when a save changes it. Add the case to jobWorkBillGolden.json so Stage 2's Java carries the same rule. *(visible: an edited bill asks to re-confirm the affected deductions)*
- **Estimate:** 4 h
- **Note:** Mock-backed today, but the rule is in the shared calculator that the Stage 2 Java must reproduce, so it survives the cutover.

### P2

#### U397 · P2 · rule 10, rule 1 — Finishing's mock tabs keep their data in a plain in-memory object, so every entry is lost on reload, although the banner says it is kept in this browser

*Finishing - mock tabs* — `src/services/production/finishingService.js:1-8; src/services/production/finishingMockApi.js:18-30, 52-185; src/services/production/finishingMockData.js; src/utils/permissions.js:573-574`

- **What happens:** A supervisor enters an hourly sheet, a checking sheet and a spot-wash batch. Each saves with a success toast and a document number. After a page refresh (or an app update, a logout, or a PWA restart) all of them have gone back to the seed rows. The banner said 'kept in this browser', which suggests localStorage, the way the Job Work preview behaves. Before go-live, Receiving (the RCV record), Hourly Stations, Spot Wash, Checking (and its auto-created alterations), Alterations, Metal Detection and needle log, Shade Segregation, the measurement chart (finishingMockData specPoints) and the Dashboard aggregates all need API endpoints. The seed orders and employees must be replaced by masters.
- **Fix:** Either persist the mock through createDemoStore like Job Work, or change this screen's banner to say entries are lost on reload. Plan the API cutover per tab and flip USE_MOCK_FINISHING_DATA per tab, not for the whole module. *(visible: entries survive a reload (or the banner says they will not))*
- **Estimate:** 2 h
- **Note:** One finding for the mock dependency. The cutover itself is a module build, not estimated here.

#### U398 · P2 · rule 5, rule 4 — Two finishing users receiving parts of one sewing note at the same time overwrite each other's receipt, because the receipt is sent as an absolute cumulative quantity with no version

*Finishing - Receiving* — `src/pages/production/finishing/ReceivingDrawer.jsx:38-54, 84-86, 125-128; src/services/production/sewingApi.js:292-295; erp/production/sewing/service/SewGarmentIssueService.java:149-185; erp/production/sewing/dto/SewGarmentReceiptRequest.java:11-24`

- **What happens:** Note GI-12 has 200 pcs of size M. Users A and B both open the drawer and see 0 already received. A records 120 and the UI sends receivedQty = 0 + 120. B records 50 a minute later and the UI sends 0 + 50. The server sets line.receivedQty = 50 (an absolute value, with no version check and no 'never below what was already received' check). Sewing now shows 50 of 200 received after 170 pieces arrived, and the note is offered again for 150.
- **Fix:** Send the delta received now (or the version read), and have SewGarmentIssueService add it to the stored quantity under a row lock, refusing a total above currentQty. *(not visible)*
- **Estimate:** 3 h

#### U399 · P2 · rule 15, rule 6 — External Process lists only the newest 200 issues, receipts and checks, so an open issue outside that window cannot be received or checked

*Finishing - External Process* — `src/services/production/finishingProcessApi.js:10-15, 27-30, 55-58; src/pages/production/finishing/GarmentProcessTab.jsx:38-44, 108, 128-130, 153; src/pages/production/finishing/GarmentCheckForm.jsx:39-41; erp/production/finishingroom/service/GarmentIssueService.java:54`

- **What happens:** After a busy season there are 230 process issues. The tab fetches page 0, size 200, sorted by issueDate DESC and pages it in the browser. The oldest 30 are never loaded. An embroidery lot issued in the first week that is still with the vendor is missing from the Process PO list in 'Receive Garments' (built from openIssues) and in the New Garment Check picker. The vendor's DC cannot be booked from the UI, and the job-work bill (D3) cannot follow.
- **Fix:** Page the three registers on the server (useServerList). Load the receive and check pickers with status=ISSUED,PARTIALLY_RETURNED (the API already filters by status) instead of reusing the page of 200. *(visible: the tables page on the server; old open issues appear in the pickers)*
- **Estimate:** 4 h

#### U400 · P2 · rule 42 — The Final AQL verdict counts every defect against the AQL 2.5 accept number, ignoring the critical zero-tolerance and minor AQL 4.0 rules the screen displays, and the browser sends that verdict

*Finishing - Checking* — `src/pages/production/finishing/CheckingForm.jsx:83-90, 122; src/utils/finishingConstants.js:81-86, 110-123; src/pages/production/finishing/CheckingDefectsCard.jsx:22-27`

- **What happens:** A Final check on a 500-pc lot (sample 50, Ac 3 / Re 4) logs one Critical defect (broken needle fragment). defects = 1 <= 3, so verdict = ACCEPTED, while the defect row shows 'Critical - Zero tolerance - any one rejects the lot'. The reverse also happens: 4 Minor defects (AQL 4.0 would accept) reject the lot. The client-computed verdict, sampleSize, acceptNo and rejectNo are saved as-is.
- **Fix:** Compute the verdict per severity (any critical rejects; major vs AQL 2.5; minor vs AQL 4.0), and at cutover compute it on the server from the defect rows. Add Vitest cases for aqlSample and the verdict. *(visible: some lots change from Accepted to Rejected)*
- **Estimate:** 3 h
- **Note:** Mock-backed today; the rule lives in the screen, so it survives the cutover.

#### U403 · P2 · rule 10, rule 11 — The whole Job Work workspace runs on a localStorage demo with no API behind it; this is what must change before it goes live

*Job Work (outward tracker + inward)* — `src/services/production/jobwork/jobWorkTrackerEnv.js:1-6; src/services/production/jobwork/jobWorkTrackerApi.js:1-15; src/services/production/jobwork/jobWorkInwardApi.js:1-22; src/services/production/jobwork/demoStore.js:1-40; src/pages/production/jobwork/JobWorkWorkspace.jsx:69-91; src/pages/production/jobwork/receipts/ReceiptDrawer.jsx:52; src/pages/production/jobwork/daily/DailyUpdateTab.jsx:58-66; src/utils/permissions.js:316-330`

- **What happens:** Every facade (tracker, sheet, receipts, pull-backs, materials, inward orders, party stock, returns, statements) delegates to trackerMock*/inwardMock* over localStorage, and seeds dates relative to today. It is marked as a mock clearly (banner plus a purple 'Mock - no data is saved to the server' tag), so it is unlikely to be mistaken for real data. Before go-live: (a) the /api/v1/job-work/jobs, sheets, receipts, pull-backs, inward and party-stock endpoints do not exist; (b) the 'production-job-work' permission key exists only in the web app (permissions.js:316-318), so server ENFORCE refuses everything until the key and its grant migration ship; (c) DailyUpdateTab reads mock error details from e.details, which axios puts at e.response.data; (d) the vendor receipt sends vendorDcDate = the receipt date with no DC-date input, against D1 (DC no. plus DC date mandatory); (e) remove 'Reset demo data' and the seed.
- **Fix:** Treat it as an API build. At cutover replace each facade body with axios, read error details from e.response.data, add a DC date field, ship the permission key, then remove preview:true. *(not visible)*
- **Estimate:** 2 h
- **Note:** One finding for the mock dependency; the API build itself is not estimated.

#### U404 · P2 · rule 8 — A coordinator's unsaved daily-sheet figures are thrown away without asking when the date changes, the vendor changes, or the user leaves the page

*Job Work - Daily Update* — `src/pages/production/jobwork/daily/useSheetEdits.js:11-18, 43-48; src/pages/production/jobwork/daily/DailyUpdateTab.jsx:24-25, 103-109`

- **What happens:** A coordinator types cumulative figures for 6 jobs after a vendor call, then changes the date picker to check yesterday. sheetKey (vendor|date) changes, setEdits({}) runs, and every typed figure is gone with no message. Picking another vendor shows only an info toast after the edits are already gone. Clicking another menu item unmounts the tab silently, because only beforeunload (closing the browser) is guarded.
- **Fix:** Use useUnsavedChanges(dirtyIds.length > 0) for in-app navigation, and confirm before applying a vendor or date change while edits are dirty. *(visible: a confirm dialog before edits are discarded)*
- **Estimate:** 2 h

#### U405 · P2 · rule 4 — The daily sheet and the receipt drawer keep whichever response lands last, so a save can post one vendor's or job's figures under another

*Job Work - Daily Update / Receipts* — `src/pages/production/jobwork/daily/useVendorSheet.js:11-27; src/pages/production/jobwork/daily/DailyUpdateTab.jsx:52-61; src/pages/production/jobwork/receipts/ReceiptDrawer.jsx:29-32, 52`

- **What happens:** On the live API, a coordinator picks vendor A and then quickly vendor B. If A's sheet response arrives after B's, the sheet shows A's jobs while vendorId = B, and Save posts {vendorId: B, jobs: [A's jobs]}. In ReceiptDrawer, switching the job quickly can leave job A's form and rows on screen, and postReceipt(jobId B, rows of A) then books A's colours and sizes against B. The mock's fixed latency hides this today.
- **Fix:** Guard both loads with a request id or AbortController (useRecord), and send the vendor and job ids from the loaded sheet or form, not from the picker state. *(not visible)*
- **Estimate:** 2 h

#### U409 · P2 · rule 10, rule 11 — Job-work bills, their deductions and the Vendor Debit Note are a Stage 1 browser demo; this is what must change before it goes live

*Job-work Bill Passing* — `src/services/inventory/jobWorkBill/jobWorkBillService.js:1-60; src/services/inventory/jobWorkBill/jwbDemoStore.js:1-30; src/pages/inventory/bill-passing/BillPassingList.jsx:29, 105; src/pages/inventory/bill-passing/jobwork/JobWorkBillForm.jsx:105-118; src/utils/vendorDebitNotePrint.js:72; erp/production/finishingroom/dto/GarmentReturnRequest.java:23-24`

- **What happens:** All calls run against localStorage after a 300 ms timer; the billable POs and DCs come from a demo seed, not the live CPP and GPO, and VDN numbers are demo counters. The markers are good: a 'Demo' tag on list rows, a forced Preview banner, a 'Demo data' tag, a DEMO watermark on the VDN print, and the list opens on Supplier PO. Before go-live (owner sign-off of Stage 1 first): the inventory/billpassing/jobwork API plus EntityType.JOB_WORK_BILL; checks re-anchored to one inward DC (D2), which is not true today because GarmentCheckForm checks a whole process issue; vendorDcNo @NotBlank plus vendorDcDate on /finishing/process-returns and the cutting return (D1, which the API does not enforce or store today); the default source switched to All; and the jwb* demo files and JOB_WORK_BILL_DEMO removed.
- **Fix:** Follow the Stage 2 plan (need-to-implement-the-proud-dove.md section 2); land the DC-date and DC-anchored check changes first, since the bill reads them. *(not visible)*
- **Estimate:** 2 h
- **Note:** Decided behaviour (D1-D9) is not reported as a defect. One finding for the mock dependency.

#### U411 · P2 · rule 42 — The bill calculator rounds money with the Number.EPSILON trick, which rounds some half-paisa amounts down where the PO calculator and Java HALF_UP round up

*Job-work Bill Passing* — `src/utils/jobWorkBillCalc.js:15, 43-47, 70-75, 78-97; src/utils/vendorDebitNotePrint.js:19, 46-50; src/utils/jobWorkPoCalc.js:15-25`

- **What happens:** r2 = Math.round((x + EPSILON) * 100) / 100 only corrects values below about 1. GST at 5% on a taxable value of 10,240.90 is 512.045: the bill computes 512.04, while poValue (round2) and BigDecimal HALF_UP give 512.05. So the job-work PO and its bill disagree by a paisa, TAX_MISMATCH figures are off, and the golden file the Stage 2 Java must 'reproduce' encodes binary-float rounding that HALF_UP will not match. Other cases: 25.5 units x Rs 1.49 = 37.995 becomes 37.99, and 250.5 x 1.17 = 293.085 becomes 293.08.
- **Fix:** Use round2/round3 from jobWorkPoCalc (decimal-string half-up) in jobWorkBillCalc and vendorDebitNotePrint, and add half-paisa cases to the golden file. *(visible: some amounts change by Rs 0.01)*
- **Estimate:** 1.5 h

### P3

#### U401 · P3 · rule 7 — Defect rows are keyed by array index, so deleting a row moves its inputs onto the next defect

*Finishing - Checking* — `src/pages/production/finishing/CheckingDefectsCard.jsx:41-44, 54`

- **What happens:** Three defect rows; the user deletes the first one while the second row's Count input is focused or its select is open. The keys shift (rowKey = defects.indexOf(r)) and React reuses the components for different rows, so the focused or open control now belongs to a different defect.
- **Fix:** Give each new defect row a monotonic key when it is added and use it as rowKey. *(not visible)*
- **Estimate:** 0.5 h

#### U402 · P3 · rule 2 — Catch blocks on Finishing's real-API calls add a second toast on top of the interceptor's

*Finishing (API-backed tabs)* — `src/pages/production/finishing/ReceivingDrawer.jsx:53, 137; src/pages/production/finishing/GarmentProcessTab.jsx:43, 57; src/pages/production/finishing/GarmentReceiveDrawer.jsx:69; src/pages/production/finishing/GarmentCheckForm.jsx:44; src/pages/production/finishing/GarmentIssueDrawer.jsx:38; src/pages/production/finishing/CheckingForm.jsx:75`

- **What happens:** Receive Garments is refused with 400 'Cannot receive 12 ... only 10 are still with the vendor'. The interceptor toasts it, and GarmentReceiveDrawer:69 toasts the same message again. The other locations add a generic second toast ('Failed to load ...'). The mock-backed catches (AlterationDrawer:96, CheckingForm:130, FinishingHourlyTab:55 and others) will duplicate the same way once they are cut over.
- **Fix:** Use toastUnlessHandled(message, e, fallback) in each catch, as GarmentCheckForm:97 already does. *(visible: one toast instead of two)*
- **Estimate:** 1 h

#### U406 · P3 · rule 39, rule 36 — Inward print previews render in an unsandboxed same-origin iframe

*Job Work - Inward statements / prints* — `src/pages/production/jobwork/inward/components/PrintPreviewDrawer.jsx:14; src/pages/production/jobwork/inward/statements/StatusReport.jsx:36; src/utils/jobWorkInward/inwardPrint.js:1-76`

- **What happens:** The return challan, shortage report and status report are injected via <iframe srcDoc> with no sandbox attribute, so the document runs with the app's origin, cookies and token access. Every value goes through esc() today, so there is no live XSS, but one future unescaped field (a principal name, a defect text) becomes stored XSS in the app origin.
- **Fix:** Add sandbox="allow-modals" (or an empty sandbox) to both iframes; printing already goes through openPrintWindow. *(not visible)*
- **Estimate:** 0.5 h

#### U407 · P3 · rule 42 — About 1,700 lines of pure job-work rules (stage plans, sheet and receipt validation, pull-back clamp and pay, knock-off, return charges) have no Vitest tests

*Job Work - business rules* — `src/utils/jobWorkTracker/*.js (earnings, planRules, pullBackRules, sheetRules, snapshotRules, splitFigures, workingDays); src/utils/jobWorkInward/*.js (chargeRules, knockOff, materialRules, orderRules, partyStockRules, progressRules, returnRules)`

- **What happens:** Only jobWorkBillCalc has tests (jobWorkBillCalc.test.js plus the golden JSON). At the API cutover these rules are the spec the Java must reproduce, for example clampOnApproval cutting the most-advanced lines first, splitBySize largest remainder, and knockOff oldest-challan-first. A regression in a rule that both the UI and the mock run would not be caught.
- **Fix:** Add a golden-case Vitest file per rule module, like jobWorkBillGolden.json, before the Java port. *(not visible)*
- **Estimate:** 6 h

#### U408 · P3 · rule 9 — Pull-back pay is computed in unrounded floats per piece and per line, so the line amounts shown do not add up to the 'Vendor earns' total

*Job Work - Pull-backs* — `src/utils/jobWorkTracker/earnings.js:45-81; src/services/production/jobwork/trackerMockPullBackContext.js:72-78; src/pages/production/jobwork/pullback/PullBackPayCard.jsx:36-37, 52; src/pages/production/jobwork/jwFormat.js:9`

- **What happens:** A Work Order at Rs 12.50 per piece with three finishing stages in scope earns fin x 1/3 per stage. The per-piece amounts are recurring decimals (fin share x 1/3). Each line amount is perPiece x qty, rounded only when displayed, and the total sums the unrounded values, so the displayed lines can differ from the displayed total by a paisa. When pull-back pay feeds the vendor's bill at cutover, the paise will not reconcile.
- **Fix:** Round the per-line amount to 2 dp (round2 from jobWorkPoCalc) and sum the rounded lines; pin it in the golden cases the Java will follow. *(visible: line amounts add up to the total)*
- **Estimate:** 1 h

#### U412 · P3 · rule 38 — The three preview stores in localStorage survive logout, so the next user of the browser sees the previous user's demo entries

*Job Work / Job-work Bill Passing (demo stores)* — `src/services/production/jobwork/demoStore.js:9-40; src/services/production/jobwork/jobWorkTrackerStore.js:11; src/services/production/jobwork/inwardStore.js:9; src/services/inventory/jobWorkBill/jwbDemoStore.js:10; src/services/auth/sessionStore.js:178-197`

- **What happens:** On a shared factory PC, user A enters principals (names, GSTINs, addresses) and job-work bills in the previews, then logs out. clearAll removes only currentUser and sessionActive, so user B, possibly on another branch, opens Job Work and sees A's entries. Rule 38 requires preview stores to be cleared on logout, expiry and branch change.
- **Fix:** Remove the avarsh.*.mockStore.v1 keys in sessionStore.clearAll and on branch switch; the demo reseeds on next load. *(visible: previews start from the seed after logout)*
- **Estimate:** 0.5 h

## Fixed by the test-release gate

Recorded for the scorecard. Each fix was confirmed in the code on `dev` at the commit named.

#### U203 · P0 · correctness — The Process Allowance dialog crashed on a matrix-mode BOM line (calcMatrixTotal not imported)

*ProcessAllowanceModal* — `src/pages/bom/ProcessAllowanceModal.jsx:5`

- **What happens:** Opening the dialog on a Size-wise or Variant-per-size line threw a ReferenceError and tore the screen down.
- **Fix:** Import calcMatrixTotal from utils/bomConstants. *(visible: the dialog opens)*
- **Estimate:** 0.05 h
- **Status:** fixed in `e1be641`

#### U204 · P1 · rule 6 — The BOM list could not reach page 2 (it read page/size instead of pageNumber/pageSize)

*BOMList* — `src/pages/bom/BOMList.jsx:73-76`

- **What happens:** The paginator stayed on page 1 and refetched page 1, so later BOMs were unreachable.
- **Fix:** Read the API's pageNumber/pageSize. *(visible: paging works)*
- **Estimate:** 0.1 h
- **Status:** fixed in `6519a67`

#### U205 · P0 · rule 36 — Stored XSS: the PO and order print windows wrote user text unescaped

*PO and order print windows* — `src/utils/poPdfGenerator.js; src/utils/orderPdfGenerator.js`

- **What happens:** A supplier or buyer name such as <img src=x onerror=…> ran as script in the same-origin print window. Re-checked in this review: every user-entered value in both generators now goes through escInline/escAttr.
- **Fix:** Escape every interpolation with printDoc.js esc/escInline/escAttr, keeping the layout byte-identical. *(not visible)*
- **Estimate:** 0.75 h
- **Status:** fixed in `5e4ff0b, 1bc1508`

#### U206 · P0 · rule 36 — Stored XSS: Terms & Conditions rich text was rendered raw in the PO print and the read-only viewer

*PO print T&C, T&C viewer* — `src/utils/poPdfGenerator.js; src/components/RichTextEditor.jsx; src/utils/sanitizeRichText.js`

- **What happens:** A T&C containing a script tag or an event handler ran when a PO was printed or the T&C was viewed.
- **Fix:** Round-trip the stored HTML through a detached Quill instance (sanitizeRichText) before rendering. *(not visible)*
- **Estimate:** 0.5 h
- **Status:** fixed in `5e4ff0b, 1bc1508`

#### U207 · P1 · correctness — A failed token refresh left every later request hanging

*axiosInstance (every screen)* — `src/services/core/axiosInstance.js:137-176`

- **What happens:** executeTokenRefresh resolves to null on failure, which left isRefreshing set and the queued requests unsettled, so after an in-app re-login every later 401 queued behind a refresh that never came.
- **Fix:** Treat a null token as failure, settle the queue and release the flag in finally. *(not visible)*
- **Estimate:** 0.3 h
- **Status:** fixed in `dfac9de`

## Decisions for the owner

1. **UNWIRED features (owner action 8, WS16).** This review changes the picture for three of the five:
   - *CostingForm print/PDF preview* and *CostingForm past-PO price suggestions* are moot: CostingForm.jsx was deleted in `bde52b9`. The costing sheet shows past prices (`sheet/hooks/usePastPrices.js`), and the cost-sheet view prints (Direct Print works; Preview / PDF never renders, see the costing findings).
   - *POForm "remove a BOM order" on a Combined PO*: the comment at `POForm.jsx:925` is stale. The BOM-line drawer's X already removes an order, immediately and without undo (see the PO findings). Decide whether to wire `POForm.removeOrder` behind the drawer's confirm or drop the X.
   - *BOMForm buyer-PO match panel* and *OrderForm custom sizes*: still unwired; nothing new found.
2. **Ctrl+S on forms whose first primary button is Submit** (shared finding): what should page-level Ctrl+S press? The safe default is Save Draft.
3. **Process loss on fabric lines in matrix modes** (BOM finding): apply it, or stop offering matrix modes for fabric.
4. Product calls raised by the PO findings: the dormant e-way bill UI (delete until scheduled, or wire with the listed fixes); cancel or short-close for a Partially Received PO; the duplicated variant line on the PO view.
5. **Report AI chat (batch 3 P0):** is `GEMINI_API_KEY` set on the live API (api.avarshai.com, dev profile) or on QA? If it is, set `ERP_REPORTING_AICHAT_ENABLED=false` there now. Either way, keep it off until it runs on the curated report catalog (review F006).
6. **Prevent Self-Approval** defaults to off on a new approval flow (admin finding): should it default to on?
7. **Phone on the user form** is never stored (admin finding): add the field to the API, or remove it from the form.

## Covered by other workstreams (recorded once per module here)

- **Server-side id tie-breaker** for sorted lists: A1 (lane B). The per-list UI fix (a cleared sort returning to id/desc) is listed with each list.
- **List page, sort and filters kept in the URL**: WS7 list-state work; one finding per module.
- **Duplicate catch-block toasts**: WS7 toast sweep; one finding per module, lines listed. A few catch toasts add information the server text lacks ("Cost sheet saved, but the garment image upload failed"); keep those when sweeping.
- **Locale-less `toLocaleString()`**: WS2a. **Un-memoised `columns`**: WS6. **Hot-path lookups and grid re-renders**: WS17 measures before anything changes.
- **Appendix B items outside these four modules**: the wrong date at night (`PanelIssueDrawer.jsx:55`, `ProcessReturnDrawer.jsx:91`, `inventoryService.js:1125`) and the `useIsPwa` listener leak belong to later batches. None of the antd-5-only classes is referenced in the orders, BOM, costing or PO code (the one seen, `.ant-select-selector` at `hooks/useFocusManagement.js:40`, is shared code). The header search (`db8cd3e`) and the cross-user API cache (`733fd8f`, `248224b`) were fixed by the gate.

## Dropped for want of verification

The supplier-PO form and view verifiers were stopped by the account's usage limit. The lead verified
every P1 and most P2s of those two slices directly; these reviewer candidates could not be confirmed and
were left out of batch 1. Six of them were verified and added in batch 2 (U-ids from U208 in the PO
section). Still unverified, to be re-checked with the shared batch: the 5-cell details row on a revised
PO's print, accessibility gaps in POView/POForm/the BOM drawer, the mapping drawer's per-line requests,
POForm line-grid re-render cost, and POForm dead imports.

## Checked and found sound

- **Create versus update (rule 5):** OrderForm, BOMForm, POForm and the production PO forms navigate to the list after a save, so the `/new → /edit` transition trap does not apply; their remaining duplicate-create risk is a failure between two calls (listed per module). The costing sheet and the job-work screens decide by the record in hand.
- **Version echo:** OrderService.update returns a fresh version because `resyncAfterEdit`'s JPQL `findByIdForUpdate` flushes the order first; BomService, CostSheetService, the production services and the job-work services flush (`saveAndFlush` or `flush`) before mapping.
- **Print escaping:** `poPdfGenerator.js` and `orderPdfGenerator.js` (gate fix), `workOrderPdfGenerator.js` and `jobWorkPoPrint.js` escape every user-entered value. `costingPdfGenerator.js` and the organisation address in `productionPoPdfGenerator.js` do not (see the findings).
- **Shared helpers read for this batch:** `useUnsavedChanges`, `useServerList`, `useBusyAction`, `useActionRunner`, `usePaintedWork` (every caller passes synchronous work), `useDebouncedSearch`, `useEditParam`, `formatters`, `inputHelpers`, `IsoDatePicker`, `fileService`, `download.js` (CSV formula guard present), `ViewDialog`, `ApprovalReasonDialog`, the quick-create drawer and forms, `printDoc.js` and `sanitizeRichText.js`.
- **Reports dynamic SQL (batch 3):** no injectable path. Selected fields are filtered against the definition's own fields, so SELECT and GROUP BY expressions come only from the catalog. Filter values, page and size are bound parameters. The sort column must be a selected field, and the direction maps to ASC or DESC. The blueprint path (`ReportAuthoringService`) accepts only registry source and column keys. Raw-SQL definitions need `is_superuser`, and `SqlValidator` rejects `;`, comments and write keywords. Runs are read-only, use REQUIRES_NEW and have a 30 s timeout.
- **User and role management (batch 3):**
  - Only a superuser can grant or remove superuser, or touch a superuser's account.
  - Nobody can change their own role.
  - The last active superuser cannot be deleted, demoted or deactivated.
  - An admin password reset needs `is_superuser` and revokes the target's tokens.
  - `UserDTO` has no password hash.
  - Role update uses `saveAndFlush`, and the editor leaves the page after saving.
  - `isSuperuser` is forced false on create.
- **Approval flows (batch 3):**
  - Levels and entity type lock once a flow has history.
  - Delete is blocked while requests exist.
  - Conditions are validated server-side.
  - Amounts compare as BigDecimal.
  - `ApprovalActionBar` has a submitting guard.
- **HR (batch 3):**
  - No version-echo trap: the screens reload after a save, or the services flush.
  - No create-versus-update decided from the URL.
  - Every date is sent as `YYYY-MM-DD`, so there is no IST date shift.
  - No PII in localStorage or the console.
  - No employee self-service, so payslips are reachable only by HR users.
- **Sample requests (batch 3):**
  - Every sampling update and stage move uses `saveAndFlush`, and the dispatch and invoice forms adopt the saved record, so there is no version echo.
  - `OrderScheduleImpactEvent` is published on deadline revise, mark-dispatched, and return-to-draft with the revision withdrawn.
  - Stage moves are version-checked commands, and double clicks are blocked by loading buttons and server guards.
  - Every date is sent as `YYYY-MM-DD`.
  - Invoice totals are recomputed server-side in BigDecimal.
  - The invoice generator escapes its values.
  - SampleRequestForm decides create versus update by `savedId`.
- **Shared code (batch 4, phase1):**
  - **Token refresh queue:** the flag is released on every path, and a shared lock dedupes concurrent refreshes.
  - **Logout:** the API revokes the session even when the token has expired, and `clearAll` drops the service worker's API caches.
  - **Branch switch:** clears the API caches.
  - **Login:** the redirect target comes from router state, so there is no open redirect.
  - **Sentry:** the scrub removes bodies, cookies, query strings and secret headers, and the user is sent as an id only.
  - **useServerList:** drops stale responses.
  - **chunkReload:** reloads at most once.
  - **Other helpers checked:** `sanitizeRichText` (safe, but see the bullet-list finding), `printDoc` escaping, `inertBlob`, CSV formula escaping and the `tableSort` id tie-break.
  - **Components:** the Genie panel renders model text as React nodes, quick-create cannot double-create, ApprovalReasonDialog has a loading guard, and every listener is removed on unmount.
- **Preview modules (batch 4):** which screens use the API and which use demo data:
  - **Finishing › External Process:** real API.
  - **Finishing › Receiving:** posts a real sewing receipt.
  - **Every other Finishing tab:** in-memory mock.
  - **Job Work, outward and inward:** localStorage mock.
  - **Job-work bill passing:** localStorage mock (Stage 1).
  - The garment-check save adopts the record and sends `version`.
  - The bill calculator's line arithmetic is golden-tested.
  - The prints escape user text.
- **Batch 1's unverified PO items, closed on phase1:**
  - The revised-PO print strip is verified and added.
  - POForm dead imports are refuted: lint reports none.
  - The mapping drawer's per-line requests are by design: one call per allocation.
  - POForm re-render cost and the accessibility gaps go to WS17 and the a11y pass.
- **ESLint leads:** 36 `react-hooks/exhaustive-deps` warnings in these modules. Most are the stable `message`/`modal` from `App.useApp()`; the ones with a real consequence are recorded above.
