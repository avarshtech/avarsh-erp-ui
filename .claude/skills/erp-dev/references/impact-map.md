# Cross-module impact map

What fans out across screens and modules in the Garments ERP, where each seam lives, and the
grep that lists its live consumers. Paths were verified on 2026-09-24. The grep recipes are the
source of truth — run them; when prose and grep disagree, the grep wins.

Repos: UI `avarsh-erp-ui` (paths under `src/`), API `erp-purchase` (paths under
`src/main/java/com/avarsh/erp/`, written `erp/` below), owner app `avarsh-erp-apk` (Flutter).

## 1. Permission key (both repos + JWT)
- Lives: UI `src/utils/permissions.js` — permission JSON keys (`orders`, `po-approval`,
  `inventory-qc`, …) and `SECTIONS` (sidebar groups; `assertRegistryIntegrity` validates icon
  names). API: `@RequiresPermission("<key>")` or `@NoPermissionRequired(reason=…)` on every
  controller under `/api/v1/**`.
- Consumers: `src/App.jsx` (`<PermissionRoute module operation>` on 152 screen routes; a
  single `<ProtectedRoute>` handles authentication), `src/layout/MainLayout.jsx`
  (`hasModuleAccess` builds the menu), the role matrix screen (fed by the `SCREENS` registry),
  `erp/iam/permission/PermissionInterceptor` (mode `ERP_RBAC_MODE` = OFF | AUDIT | ENFORCE),
  `SuperuserCheck` bypass.
- Breaks: an endpoint without the annotation is logged `rbac_unmapped` by `RbacRegistryCheck` at
  startup and aborts boot when `ERP_RBAC_FAIL_ON_UNMAPPED=true`; renaming a key in one place
  makes menu and matrix disagree (comment at `MainLayout.jsx:437` records that incident); the
  permissions map travels inside the JWT, so every new key grows every user's token — Super
  Admin's has already collided with Tomcat's 8 KB header limit once.
- Find: `grep -rn "<key>" src/utils/permissions.js src/App.jsx src/layout/MainLayout.jsx` ·
  `grep -rn "RequiresPermission(\"<key>\")" src/main/java`
- Prove: Playwright `admin`, `rbac-soak-*`; API boot log `RBAC registry check: … unmapped=0`.

## 2. Master-data cache (UI)
- Lives: `src/context/StoreContext.jsx`. Keys: categories, subCategories, itemTypes, attributes,
  uoms, variants, suppliers, buyers, styles, termsConditions, paymentTerms, sizePresets, users,
  roles, sampleOrderNos, cuttingMasters, sewingMasters, sampleMasters, billPassingMasters.
- Breaks: a master's DTO shape or endpoint change reaches every screen reading that key; an
  edited master is invisible until the key is invalidated; transactional documents hold frozen
  snapshots of master values, so a master edit does not (and must not) rewrite history — FK and
  snapshot rules in `referential-integrity-patterns.md`.
- Find: `grep -rln "\b<key>\b" src/pages src/components src/hooks`
- Prove: Playwright `master-data` plus the project of each consuming module.

## 3. Status and enum mirrors
- Lives: the API enum in its domain package (e.g. `erp/purchaseorder/domain/PoLineItemStatus`)
  ↔ UI `src/utils/<module>Constants.js` (22 files: approvalFlow, billPassing, bom, branch,
  color, costing, cutting, expDoc, finishing, hr, inventory, openingStock, order,
  poOrderMapping, poStatus, production, report, returnToSupplier, sampleRequest, sewing, tna,
  ui) plus `src/utils/statusConfig.js`.
- Consumers: `src/utils/statusConfig.js` (badge colour/label), `src/utils/liveFeedModuleConfig.js`
  (activity-feed wording), list filters, dashboard and report aggregations (`erp/dashboard`,
  `erp/reporting`), Playwright specs that assert labels.
- Breaks: a value added on one side renders raw or is silently filtered out on the other;
  totals grouped by status shift.
- Find: `grep -rn "<VALUE>" src/utils src/pages src/services` ·
  `grep -rn "<VALUE>" src/main/java --include=*.java`
- Prove: the module's Playwright project, plus `reports` / `journey` when aggregations change.

## 4. Domain events (API)
- `erp/shared/schedule/OrderScheduleImpactEvent` — published by
  `purchaseorder/service/PurchaseOrderService`,
  `purchaseorder/ordermapping/service/PoOrderMappingService`,
  `sampling/dispatch/SampleDispatchSendService`, `sampling/request/service/SampleDeadlineService`,
  `sampling/request/service/SampleStatusService`; consumed by
  `order/service/OrderScheduleImpactListener`, which recomputes the order's dispatch shift
  (worst-wins, idempotent). Any new writer that changes a revised date or a PO/SR status must
  publish it, or the order's dispatch date silently stays wrong.
- `erp/approval/event/ApprovalOutcomeEvent`; `erp/email/event/PoApprovedEvent` →
  `PoEmailEventListener`; `erp/activity/feed/ActivityFeedEvent` / `LiveFeedEvent` — publish the
  feed event BEFORE `saveAndFlush`, or the audit listener adds a duplicate contentless row.
- Find: `grep -rln "<EventName>" src/main/java`
- Prove: `./gradlew test`; Playwright `approvals`, `orders`, `sample-requests`.

## 5. Optimistic locking / version echo
- Lives: `erp/shared/VersionGuard`, the `version` column via `BaseEntity`; UI
  `src/services/core/axiosInstance.js` conflict interceptor + `src/components/ConflictDialog.jsx`.
- Breaks: an update endpoint that echoes a stale `version` turns the user's next save into a
  false conflict — use `saveAndFlush` and make the screen adopt the saved record.
- Find: `grep -rn "version" src/pages/<module>` (the adopt step) ·
  `grep -rn "VersionGuard" src/main/java`

## 6. API ↔ UI ↔ owner-app contracts
- Lives: controllers + DTOs per package ↔ UI `src/services/<module>Service.js` ↔ pages.
  `erp/mobile`, `erp/notification` and `erp/approval` responses are also consumed by the Flutter
  owner app (`avarsh-erp-apk`) — treat those DTOs as public contracts.
- `erp/shared/PaginatedResponse` is the `/search` envelope (22 of 142 controllers); master list
  endpoints return a plain `List<DTO>`. `SizeQuantityDTO` carries every size × quantity matrix.
- Find: `grep -rn "<fieldName>" src/services src/pages` ·
  `grep -rn "<fieldName>" src/main/java --include=*DTO*.java --include=*Controller.java` ·
  in avarsh-erp-apk: `grep -rn "<fieldName>" lib/`
- Prove: the module's Playwright project; for mobile DTOs, the owner-app build.

## 7. Routes, navigation and per-section constants
- Lives: `src/App.jsx` (166 routes; each screen route wrapped in `<PermissionRoute module operation>`), `src/layout/MainLayout.jsx`
  (menu), `SECTIONS` in `permissions.js`, `src/utils/liveFeedModuleConfig.js`, per-section
  constants (`expDocConstants.js`, `productionConstants.js`, …), module descriptors such as
  `src/pages/production/packing/packingModule.js`.
- Worked example — commit `e583a38` moved Carton Packing from Export Documentation to
  Production. One screen move touched `App.jsx`, `MainLayout.jsx`, `permissions.js`,
  `liveFeedModuleConfig.js`, `expDocConstants.js` and `packingModule.js`: six files outside the
  screen's own directory.
- Find: `grep -rn "<route-path>\|<ScreenComponent>" src/App.jsx src/layout src/utils`
- Prove: Playwright project of the source AND destination section, plus `admin` (matrix).

## 8. Flyway PG ↔ H2 twin ↔ seeds
- Lives: `src/main/resources/db/migration` (new files `V<yyyyMMddHHmmss>__<desc>.sql`; the
  V1–V37 sequence is retired), `db/h2migration` (sequential mirror, below V100), `db/e2eseed`
  (V100+), `db/seed`, `db/mobileseed`, `db/rollback`, `src/test/resources/db/testmigration`.
  Conventions: `db/migration/README.md`.
- Breaks: a PG schema change without its H2 twin fails the e2e boot and Playwright `setup` times
  out; a NOT NULL column without DEFAULT breaks every seed that inserts into the table; editing
  an applied migration fails the checksum for every branch on the shared dev DB.
- Find: `grep -rln "<table_name>" src/main/resources/db src/test/resources/db`
- Prove: the static Flyway version check inside `./gradlew test`; the e2e stack boots
  (`.claude/skills/playwright-test/references/project-config.md`).

## 9. Shared building blocks
- UI: 51 components in `src/components/` (e.g. `ConflictDialog`, `GlobalMessageEmitter`,
  `ProtectedRoute`), hooks in `src/hooks/`, `src/context/BranchContext.jsx` (branch scoping).
- API: `erp/shared/` — `BaseEntity`, `PaginatedResponse`, `SizeQuantityDTO`, `VersionGuard`,
  `branch/`, `converter/`, `docnumber/` (document-number series — every new transactional
  document type needs one), `schedule/`.
- Find: `grep -rln "<Name>" src/pages src/components src/hooks` · `grep -rln "<Name>" src/main/java`
- Prove: `npm run lint && npm run build`; `./gradlew compileJava`; Playwright `journey` or
  `full-flow` when a block used by many modules changed.

## Module → Playwright project
master-data · costing · orders · bom · po · production-po · cutting · sewing · sample-requests ·
hr · admin · approvals · inventory · grn-qc · reports · branch · validation · journey ·
full-flow · rbac-soak-{merch,store,costing}. Config: `playwright.config.js` (`setup` runs first).
Run one: `npx playwright test --project=<name>`.
