# Codebase map — where things actually are

Verified by opening the files named below on 2026-09-24. Every path is relative to its repo root;
API paths under `src/main/java/com/avarsh/erp/` are written `erp/…`. When this file and the code
disagree, the code wins — re-run the `ls`/`grep` shown rather than trusting a remembered layout.

## 1. Repos and layout

- Side-by-side checkouts: from the UI repo, `ls ..` lists `avarsh-erp-ui`, `erp-purchase` (API) and
  `avarsh-erp-apk` (owner app served by `erp/mobile/` and `db/mobileseed`). Use `../erp-purchase`;
  never assume a drive letter.
- **UI** `avarsh-erp-ui`: React 19.2, react-router-dom 7.13, antd 6.2.2, axios 1.13, Vite 7.2
  (`package.json:37-55`); plain JS/JSX, no `tsconfig`. Vite PWA plugin (`vite.config.js:3`).
  Env: `.env` (prod API), `.env.e2e` (`localhost:8088`), `.env.example` — `VITE_API_BASE_URL` only.
- UI `src/` (from `ls src`): `App.jsx` (all routes), `main.jsx`, `layout/MainLayout.jsx`,
  `components/` (51 entries: 44 files + `approval/ branch/ buttons/ form/ dashboard/ sample/ LiveActivityFeed/`),
  `context/` (Session, Store, Branch, LiveActivityFeed, Theme + `index.js`), `hooks/` (17),
  `pages/`, `services/` (104 files in 15 dirs), `utils/`, `styles/`, `assets/`, `sw.js`.
- `ls src/pages`: `Dashboard.jsx Profile.jsx admin approvals auth bom costing expdoc hr inventory
  master orders po production reports sample-request tna` (the stale `pages/sr` twin was removed
  on 2026-09-24; `App.jsx:133-139` lazy-imports the seven sample screens from `./pages/sample-request/…`).
- `ls src/services`: `admin auth bom core costing dashboard expdoc hr inventory master orders po
  production sample-request tna` (`sample-request/sampleRequestService.js` is a pass-through facade over `sampleRequestApi.js`); cross-cutting calls live in `services/core/` (axiosInstance, approvalFlowService,
  fileService, liveActivityFeedService, notificationService, reportService, aiService, activityLogService).
- **API** `erp-purchase`: Spring Boot 3.4.0, Java 21 toolchain (`build.gradle:3,13`), Gradle only
  (no `pom.xml`), Lombok + MapStruct 1.6.2 (`build.gradle:89-94`), springdoc 2.7.0 (`:120`), H2 at
  runtime for e2e (`:91`). Build: `./gradlew compileJava`, `./gradlew test`.
- `ls erp/`: `activity ai approval bom config costing dashboard email ewaybill exception exchangerate
  hr iam inventory item masterdata mobile notification order production purchaseorder reporting
  sampling shared storage system whatsapp` + `ErpPurchaseApplication.java`
  (`@EnableJpaAuditing @EnableAsync @EnableScheduling`, `:10-12`).
- Two sub-layouts coexist. Masters are **flat**: `erp/masterdata/buyer/` = `Buyer.java BuyerDTO.java
  BuyerMapper.java BuyerRepository.java BuyerService.java BuyerController.java` + child entity/DTO/repo
  (`BuyerShippingLocation*`, `BuyerApprovedUnit*`) + `BuyerUnitApprovalService.java`; `masterdata/supplier/`
  is the same six files. Transactional modules are **layered**: `erp/order/` = `controller/ domain/ dto/
  repository/ service/` (no `mapper/`; mapping is hand-written at `order/service/OrderService.java:551`);
  `erp/purchaseorder/` adds `mapper/` and a nested sub-feature `ordermapping/` with the same five dirs;
  `inventory/grn`, `hr`, `production/cutting`, `costing` follow the layered form (+ `specification/`, `util/`).
- Flyway dirs (`ls src/main/resources/db`): `migration` (93 files: 36 legacy `V1–V37` + timestamped + README),
  `h2migration` (81, head `V80`), `e2eseed` (32, `V100__…` upward), `mobileseed`, `seed` (plain SQL, not
  Flyway), `rollback` (hand-run reversals named after the PG file); tests add `src/test/resources/db/testmigration/`.

## 2. Request lifecycle (real)

1. Route: `src/App.jsx:249` — `<Route path="orders/list" element={<PermissionRoute module="orders" operation="view"><OrderList/>…`;
   every page is `lazy()`-imported (`App.jsx:27-36`). `components/ProtectedRoute.jsx:21,57` redirects to
   `/login` unless `isAuthenticated()`; `components/PermissionRoute.jsx` lets `isAdminRole` through, then
   checks `hasModuleAccess`/`hasPermission` from `utils/permissions.js:658,664`.
2. Providers: `App.jsx:218-241` nests `ConfigProvider > ConflictDialog + GlobalMessageEmitter > StoreProvider >
   LiveActivityFeedProvider > … > BranchProvider`; `SessionProvider` is mounted in `layout/MainLayout.jsx:1015`.
   The sidebar filters items with `hasModuleAccess(item.moduleId)` (`MainLayout.jsx:551-562`).
3. Page → service: `pages/orders/OrderList.jsx:12` imports `searchOrders` from `services/orders/orderService.js`,
   which builds the query string and normalises the page envelope (`orderService.js:9-31`).
4. HTTP: `services/core/axiosInstance.js:12` `baseURL = VITE_API_BASE_URL || '/api/v1'`; request interceptor adds
   `Authorization: Bearer` (`:43`) and `X-Branch-Id` (`:49`, from the localStorage key `context/BranchContext.jsx:44-49`
   writes); response interceptor turns 409 `OPTIMISTIC_LOCK_CONFLICT` into `emitConflict()` (`:85-87`,
   `components/ConflictDialog.jsx`), queues requests behind one refresh on 401 (`:102-148`), toasts other errors (`:204`).
5. Auth filter: `erp/config/SecurityConfig.java:34,46` permits `/api/v1/auth/**`, swagger, h2-console; the JWT filter
   sets the **domain `User`** as principal, not `UserDetails` (`erp/iam/security/JwtAuthenticationFilter.java:63-67`).
6. Interceptors on `/api/v1/**` (`erp/iam/permission/RbacWebConfig.java:31-36`): `PermissionInterceptor` reads
   `erp.rbac.mode` (default OFF, `PermissionInterceptor.java:48`; `RbacMode.java` = OFF/AUDIT/ENFORCE);
   `RbacRegistryCheck.java:49` logs unmapped handlers at startup and fails only when
   `erp.rbac.registry-check.fail-on-unmapped=true` (`:55`); `SuperuserCheck.java:59` reads `Role.isSuperuser`
   (column added by `db/migration/V20260909140000__rbac_server_enforcement.sql:34`). `BranchContextInterceptor.java:18,25`
   sets/clears the `X-Branch-Id` ThreadLocal in `erp/shared/branch/BranchContext.java:16-18`.
7. Controller: `erp/order/controller/OrderController.java:18-21` — `@RequestMapping("/api/v1/orders")` + class-level
   `@RequiresPermission("orders")`; verb → operation (GET view, POST add, PUT/PATCH update, DELETE delete) per the
   `RequiresPermission.java` javadoc; `/search` returns `PaginatedResponse<OrderDTO>` (`:26`).
8. Service: `erp/order/service/OrderService.java:41` is `@Transactional(readOnly = true)` with `@Transactional` on writers
   (`:106,145,208`); defaults branch from `BranchContext.currentOrNull()` (`:60`); numbers documents via
   `DocumentNumberService` (`:48`); submits to the approval engine (`:349`).
9. Repository: Spring Data JPA + Specifications (`erp/order/repository/OrderRepository.java`, `OrderSpecification.java`);
   masters use a bare `JpaRepository` (`masterdata/buyer/BuyerRepository.java`).
10. Persistence: `erp/shared/BaseEntity.java` — `@Version long version`, `Integer createdBy/updatedBy`, listeners
    `AuditingEntityListener` + `FeedAuditEntityListener` (`erp/activity/feed/FeedAuditEntityListener.java:27-33`,
    `@PostPersist/@PostUpdate/@PostRemove` → live feed). `shared/VersionGuard.java:31` compares client vs current version
    and throws `ObjectOptimisticLockingFailureException`, mapped to 409 in `erp/exception/GlobalExceptionHandler.java:382`.
11. Database: PostgreSQL via `spring.flyway.locations=classpath:db/migration` (`application.properties:41`); dev is
    `out-of-order=true` + `ignore-migration-patterns=*:missing,*:future` (`application-dev.properties:45,51`).
    e2e = H2 `db/h2migration,db/e2eseed` (`application-e2e.properties:21`); e2e-mobile restates the list + `db/mobileseed`
    (`application-e2e-mobile.properties:14`); e2e-pg = PG `db/migration,db/e2eseed` with `clean-disabled=false`
    (`application-e2e-pg.properties:22-24`); tests = `db/migration,db/testmigration` (`src/test/resources/application-test.properties:15`).

## 3. Canonical exemplars to copy

| Layer | Copy this |
|---|---|
| Master CRUD (API) | `erp/masterdata/buyer/`: `Buyer.java` (`@Table(name="mst_buyers")`, `extends BaseEntity`, `active` at `:42-43`), `BuyerDTO.java` (Lombok `@Data @Builder`, `Long version`), `BuyerMapper.java` (MapStruct `@Mapper(componentModel="spring")`), `BuyerService.java` (`softDeleteBuyer` `:151` = usage check, then `active=false`), `BuyerController.java` (`/api/v1/buyers`, `@RequiresPermission("buyer-info")`, returns `List<BuyerDTO>`) |
| Master screen (UI) | `pages/master/BuyerMaster.jsx` — one file, no List/Form/View split; `useStore().invalidateCache('buyers')` after save (`:264`); `services/master/buyerService.js` — create **and** update both `POST /buyers`, delete is `DELETE /buyers/{id}` (its comment explains the 409 `REFERENCE_CONSTRAINT` trap) |
| Transactional module (API) | `erp/order/`; approval hook = `OrderService.java:349-350` `approvalRequestService.submitForApproval(EntityType.ORDER, …)`, outcome comes back as `erp/approval/event/ApprovalOutcomeEvent` (published inside `ApprovalRequestService.processAction`, `:223`) → `order/service/OrderApprovalListener.java:23-27` → `OrderService.applyEngineOutcome` (`:403`). PO twin: `purchaseorder/service/PurchaseOrderService.java:219,321,770` + `PurchaseOrderApprovalListener.java:22-24` |
| Deferred permission | `OrderController.java:63-68` (`@RequiresPermission(deferred = true, reason = …)` on `PUT /{id}/status`) + `order/service/OrderStatusPermission.java:36-50` calling `erp/iam/permission/PermissionGuard.java:36` |
| UI page triple | `pages/orders/OrderList.jsx` (PageHeader, SearchFilterBar, `StatusTag` + `ORDER_STATUS_CONFIG`, `getTablePagination`, `useDebouncedSearch`, `App.useApp()` `:35`, `useBranch`), `OrderForm.jsx` (`useStore().invalidateCache` `:933`, adopts the saved `version` `:980,1646`, `useUnsavedChanges` `:854`), `OrderView.jsx` (`components/approval/ApprovalActionBar` + `ApprovalHistoryPanel` `:27-28`, `services/core/fileService` `:29`, `StatusSteps`, `DraftWatermark`, `utils/orderPdfGenerator` `:24`) |
| UI service file | `services/orders/orderService.js` — `const BASE = '/orders'`, default-import `axiosInstance`, returns `response.data`; `searchOrders` maps `pageNumber/pageSize` to the table shape (`:24-30`) |
| StoreContext dropdown | `pages/expdoc/shipments/ShipmentForm.jsx:61-81` (fetch-or-reuse, excerpt below); master screens read lists straight off the store: `pages/master/ItemTypeMaster.jsx:14`. Keys (`context/StoreContext.jsx:14-45`): categories subCategories itemTypes attributes uoms variants suppliers buyers styles termsConditions paymentTerms sizePresets users roles sampleOrderNos; TTL 5 min (`:124`); `useStoreData` (`:302`) has no callers under `src/pages`, `src/components`, `src/hooks` |
| Migration pair | PG `db/migration/V20260922193000__ntf_device_tokens_and_mobile_prefs.sql` ↔ H2 `db/h2migration/V80__h2_ntf_device_tokens_and_mobile_prefs.sql` (header names its PG original and lists the H2 differences) ↔ `db/rollback/V20260922193000__ntf_device_tokens_and_mobile_prefs.sql`. Re-check the heads with `ls db/migration | grep ^V2026 | sort | tail -1` and `ls db/h2migration | sort -V | tail -1` |
| Mobile / BFF controller | `erp/mobile/approvals/controller/MobileApprovalsController.java:52` (`/api/v1/mobile/approvals`, per-method `@NoPermissionRequired(reason="self-scoped…")` `:78`); one `ModuleSummaryProvider` per `EntityType` in `mobile/approvals/summary/`; decisions via `mobile/approvals/decide/DecisionDispatcher`; login `erp/iam/controller/MobileAuthController.java:30-33` (`/api/v1/auth/mobile`) |
| Domain event | `erp/shared/schedule/OrderScheduleImpactEvent.java` (record of order ids, "publish AFTER your own write has been flushed") + `OrderDelayContributor.java` (interface the PO and sampling modules implement) → `erp/order/service/OrderScheduleImpactListener.java` (`@EventListener`, synchronous, → `OrderDispatchRevisionService.recompute`). Publishers: `PurchaseOrderService.java:770`, `purchaseorder/ordermapping/service/PoOrderMappingService.java`, `sampling/dispatch/SampleDispatchSendService.java`, `sampling/request/service/SampleDeadlineService.java`, `SampleStatusService.java` |

`ShipmentForm.jsx:67-71`, the store fetch-or-reuse shape (the fetched list is written back with `setData('buyers', list)` at `:77`):
```js
      if (isCacheValid('buyers') && storeBuyers.length) {
        setBuyers(storeBuyers);
        return;
      }
      setStoreLoading('buyers', true);
```

## 4. Conventions observed

- **Table prefixes** (`grep -rhoiE 'CREATE TABLE (IF NOT EXISTS )?(public\.)?[a-z_]+' db/migration`, 16 prefixes):
  `prd_` production (57), `inv_` inventory (37), `mst_` masters (33), `hr_` (31), `sys_` iam/system (11: `sys_users
  sys_roles sys_refresh_tokens sys_user_branches sys_doc_counters sys_config sys_organisation_info sys_live_feed_events…`),
  `smp_` sampling (10), `cst_` costing (10), `po_` purchase orders (6), `ntf_` notifications (6), `rpt_` reporting (5),
  `ord_` orders (4), `eml_` email (4), `apv_` approvals (4), `bom_` (2), `stl_` styles (1), `fil_` file storage (1).
- **Active, not deleted**: masters carry `active` (`Buyer.java:42`); the only `deleted_at` columns are
  `fil_file_storage` (`V5__file_storage.sql:23`) and `rpt_definitions` (`V20260911120000__reports_role_ownership.sql:34`).
- **Entities / DTOs / enums**: masters flat (`masterdata/<x>/X.java, XDTO.java, XMapper.java`); transactional modules keep
  entities and status enums in `domain/` (`order/domain/OrderStatus.java`, `purchaseorder/domain/POStatus.java`), request/response
  in `dto/` (`OrderDTO`, `OrderSearchRequest`, `OrderStatusRequest`), specs in `repository/XSpecification.java`, and
  `service/XApprovalListener.java`, `XFeedPublisher.java` beside the service.
- **`PaginatedResponse<T>`** (`erp/shared/PaginatedResponse.java`: content, pageNumber, pageSize, totalElements, totalPages, last)
  is the `/search` envelope in 22 of 142 controller files; master list endpoints return `List<DTO>` (`BuyerController.java:20`).
- **Permission keys**: kebab-case screen keys identical in `erp/iam/permission/PermissionRegistry.java:42-51` and
  `src/utils/permissions.js:166` (`SCREENS`: `{ id, name, section, kind, path, routes, ops }`); child keys name a parent via
  `requires` (`order-actions` → `orders`, `po-approval` → `purchase-orders`); operations are `view add update delete` plus
  named ones (`refer_back cancel approve reject verify revise publish print …`, `permissions.js:88-128`). 131 controller files
  carry `@RequiresPermission`, 13 carry `@NoPermissionRequired(reason = …)`; the mapping is pinned by
  `src/test/java/com/avarsh/erp/iam/permission/ControllerPermissionMappingTest.java`, `PermissionRegistryTest.java`, `RolePermissionMatrixTest.java`.
- **UI file naming**: transactional screens `XList.jsx / XForm.jsx / XView.jsx` (orders, bom, costing, po = `POList/POForm/POView`,
  sample-request = `SampleRequestList/Form/View`); masters `XMaster.jsx` in `pages/master/` (`ls src/pages/master`); sub-features as folders
  (`pages/inventory/grn/`, `pages/production/finishing/`, `pages/hr/payroll/`); `services/<module>/xService.js`.
- **Constants**: 22 `src/utils/*Constants.js` mirror API enums (`orderConstants.js:7` `ORDER_STATUS` ↔ `order/domain/OrderStatus.java`);
  tag colours in `utils/statusConfig.js` (`ORDER_STATUS_CONFIG:33`, `PO_STATUS_CONFIG:53`, `GRN_STATUS_CONFIG:81`…);
  feed → route mapping in `utils/liveFeedModuleConfig.js:20`; error text via `utils/apiError.js` (`errorText`, `toastUnlessHandled`).
- **Document numbers**: `erp/shared/docnumber/DocumentNumberService.generate(prefix)` → `<PREFIX>/<YY-YY>/<NNNN>` from
  `sys_doc_counters`, first number 1001, FY starts 1 April, `Propagation.MANDATORY` (`:13-19,37-41`); e.g. `generate("PO")`
  at `PurchaseOrderService.java:321`.
- **Branch scoping**: header `X-Branch-Id` (`BranchContext.java:16`) is a hint, read explicitly by branch-aware services
  (`OrderService.java:60`, `shared/branch/BranchSpecs.at()` `:20`); UI stores the working branch in `context/BranchContext.jsx:44-49`,
  `axiosInstance.js:49` skips the header when it is `'all'`; `components/branch/BranchSwitcher.jsx`, `BranchField.jsx`.
- **Approval engine**: `erp/approval/domain/EntityType.java` lists the 17 document types that can carry a flow
  (PURCHASE_ORDER, COST_SHEET, ORDER, GRN, GRN_REVERSAL, QC, LEAVE, GATE_PASS, MISS_PUNCH, PAYROLL_RUN, BONUS_RUN, FNF_SETTLEMENT,
  EL_ENCASHMENT, CUTTING_PO, WORK_ORDER, FINISHING_PO, BILL_PASSING); 10 `*ApprovalListener.java` classes consume
  `ApprovalOutcomeEvent` (`grep -rl ApprovalOutcomeEvent erp/ --include='*Listener.java'`): costing, hr, billpassing, grn, qc,
  order, cutting, finishing, workorder, purchaseorder.

## 5. Mock vs API status, as of 2026-09-24

Recipe: `grep -rn "USE_MOCK" src/services` — every switch is a `USE_MOCK_*` export in a `…Env.js` or at the top of the service.

| Module | Switch | Value | Consumers |
|---|---|---|---|
| TNA | `services/tna/tnaEnv.js:5` `USE_MOCK_TNA_DATA` | **true** — `tnaService.js:10` proxies to `tnaMockApi` | 12 files under `pages/tna/` |
| Export Documentation | `services/expdoc/expDocEnv.js:7` `USE_MOCK_EXPDOC_DATA` | **true** — `expDocService.js:27` guard throws if flipped without a backend | 26 files under `pages/expdoc/` |
| Finishing (production) | `services/production/finishingService.js:8` `USE_MOCK_FINISHING_DATA` | **true** — every export delegates to `finishingMockApi` | `pages/production/finishing/*` (CheckingList, AlterationList, …) |
| Production POs (cutting/work-order/finishing PO) | `services/po/production/productionEnv.js:6` `USE_MOCK_PRODUCTION_DATA` | false (real API); `cuttingPoService`, `workOrderService`, `finishingPoService`, `productionLookupService` still branch on it | `pages/po/cutting`, `workorder`, `finishing` |
| Inventory | `services/inventory/inventoryService.js:26`, `openingStockService.js:33`, `returnToSupplierService.js:42` | all false (real API); `*MockData.js` files retained | `pages/inventory/*` |

Everything else calls the API with no switch. `services/production/sewingService.js` and `cuttingService.js` have no mock flag.

## 6. Read next

- `impact-map.md` — cross-module seams (permission keys, JWT, enums, feed, delay engine) with the grep that lists live consumers.
- `referential-integrity-patterns.md` — two-layer delete protection, FK/JSONB reference checks, status-based edit locking, approval-flow rules.
- `antd6-deprecations.md` — the `warning.deprecated` list transcribed from `node_modules/antd` 6.2.2, not the docs.
- `api-contracts.md` — UI service ↔ controller table; 29 service rows against 104 UI services / 142 controllers, so partial.
- `../erp-purchase/src/main/resources/db/migration/README.md` — the migration rules (timestamp versions, frozen files, H2 below V100, seeds V100+).
- Also here: `domain-algorithms.md` (BOM/costing formulas) and `performance-patterns.md`.
