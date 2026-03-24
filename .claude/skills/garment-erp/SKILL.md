---
name: garment-erp
description: >
  Full-stack Garments/Apparel ERP development with React + Ant Design, Spring Boot 3.x + Java 21 + JPA,
  PostgreSQL + Flyway. Covers garment lifecycle: Tech Pack → BOM → Costing → Order → T&A → Production
  (Cut/Sew/Finish) → Shipment. Includes industry domain models, RBAC, multi-tenant, and reporting patterns.

  USE THIS SKILL whenever the user mentions: garments ERP, apparel ERP, fashion ERP, RMG, style management,
  tech pack, BOM, garment costing, T&A calendar, cut plan, sewing line, production tracking, buyer/supplier
  management, fabric/trim inventory, size-color matrix, compliance, shipment/packing list, or building modules
  for a clothing/textile manufacturing system. Also trigger for React + Ant Design + Spring Boot + PostgreSQL
  scaffolding in manufacturing/ERP context. Trigger even for single-layer requests like "create a migration
  for styles" or "build a costing form UI".
---

# Garments ERP Development Skill

## Tech Stack

| Layer        | Technology                                                          |
|-------------|----------------------------------------------------------------------|
| Frontend    | React 18+, Ant Design 5.x, @ant-design/pro-components, Axios, React Router 6 |
| Charts      | @ant-design/charts (inherits Ant theme tokens for dark/light mode)   |
| Backend     | Spring Boot 3.x, Java 21, Spring Data JPA, Hibernate                |
| Database    | PostgreSQL 15+, Flyway migrations                                    |
| Auth        | Spring Security + JWT, role-based (RBAC)                             |
| Build       | Maven (backend), Vite (frontend)                                     |
| API Style   | REST (JSON), versioned under `/api/v1/`                              |

## UI Conventions (Enforced)

| Aspect                  | Rule                                                                  |
|------------------------|------------------------------------------------------------------------|
| Theme                  | Light + dark mode via ConfigProvider + CSS tokens. Never hardcode colors |
| Forms                  | Always in a `<Drawer>` (right slide-in), never a separate page         |
| Delete / Status Change | Always confirm via `<Modal>` before executing                          |
| Breadcrumbs            | Auto-generated on every page from route config                         |
| List Page Filters      | Horizontal filter bar above table                                      |
| Production Data Entry  | Inline editable table cells with auto-calculated KPIs                  |
| Size-Color Matrix      | Editable grid embedded directly in the parent Drawer/form              |
| Complex List Pages     | Use `ProTable` (@ant-design/pro-components) for search, filters, toolbar |
| Simple/Embedded Tables | Use plain Ant Design `<Table>` for sub-tables, inline edits, grids    |

## Before You Begin

Read the relevant reference file(s) based on what the user is asking for:

| User wants...                        | Read this reference file                          |
|--------------------------------------|---------------------------------------------------|
| Domain understanding, data models    | `references/domain-models.md`                     |
| Backend API, service, entity code    | `references/backend-patterns.md`                  |
| Frontend pages, forms, tables        | `references/frontend-patterns.md`                 |
| Database migrations                  | `references/migration-patterns.md`                |
| Delete protection, edit locking, FK handling | `references/referential-integrity-patterns.md` |
| Performance, caching, N+1, memoization | `references/performance-patterns.md`            |
| BOM/Costing formulas, search, aggregation | `references/domain-algorithms.md`             |
| Full CRUD module (all layers)        | Read ALL seven reference files                    |

Always read the reference file before generating code. The reference files contain canonical patterns, naming conventions, and industry-specific field definitions.

---

## Garment Lifecycle Flow (Enforced)

Every module exists within this standard lifecycle. When generating code, respect upstream/downstream dependencies:

```
Tech Pack → BOM → Costing → Order Confirmation → T&A Calendar → Production → Shipment
   │          │       │            │                   │              │           │
   │          │       │            │                   │              │           │
 styles    materials  cost      orders/PO         time_action     cut/sew/    packing_
 tech_     bom_       sheets    order_items       calendar        finish      lists
 packs     items                buyer_pos         milestones      tracking    shipments
```

### Module Dependency Map

- **Tech Pack**: Standalone entry point. A style's technical specification (measurements, construction, artwork).
- **BOM (Bill of Materials)**: Depends on Tech Pack. Lists all fabrics, trims, accessories needed per style per size.
- **Costing**: Depends on BOM. Calculates CM (Cost of Manufacturing), FOB price, material costs, overheads.
- **Order/PO**: Depends on Costing. Buyer places purchase order referencing styles + approved costs. Contains size-color breakdown.
- **T&A Calendar**: Depends on Order. Time & Action plan with milestones (fabric in-house, cutting start, shipment date).
- **Production**: Depends on T&A + Order. Three sub-phases: Cutting → Sewing → Finishing/Packing.
- **Shipment**: Depends on Production completion. Packing lists, container booking, commercial/shipping docs.

### Cross-Cutting Modules

- **Buyer Management**: Referenced by Orders, Compliance, Shipment.
- **Supplier Management**: Referenced by BOM (fabric/trim suppliers), Purchase Orders.
- **Inventory (Fabric & Trim)**: Referenced by BOM, Production (issuance), receiving from suppliers.
- **Compliance & Audit**: Referenced by Buyer requirements, production quality checks.
- **RBAC / Auth**: All modules. Roles: `ADMIN`, `MERCHANDISER`, `PRODUCTION_MANAGER`, `CUTTING_MASTER`, `STORE_KEEPER`, `FINANCE`, `COMPLIANCE_OFFICER`, `VIEWER`.

---

## Project Structure

### Backend (Spring Boot)

```
src/main/java/com/garments/erp/
├── config/              # Security, CORS, Flyway, audit config
├── common/              # BaseEntity, ApiResponse, PageResponse, exceptions
├── auth/                # JWT, UserDetails, login/register
├── module/
│   ├── style/           # Style, TechPack
│   ├── bom/             # BOM, BOMItem
│   ├── costing/         # CostSheet, CostBreakdown
│   ├── order/           # Order, OrderItem, BuyerPO
│   ├── tna/             # TNACalendar, TNAMilestone
│   ├── production/
│   │   ├── cutting/     # CutPlan, CutDetail
│   │   ├── sewing/      # SewingLine, SewingOutput
│   │   └── finishing/   # FinishingBatch, PackingList
│   ├── shipment/        # Shipment, ShipmentDetail, ContainerBooking
│   ├── inventory/       # FabricStock, TrimStock, StockTransaction
│   ├── buyer/           # Buyer, BuyerContact, BuyerCompliance
│   ├── supplier/        # Supplier, SupplierContact
│   └── compliance/      # AuditRecord, ComplianceCheck
└── reporting/           # Dashboard DTOs, report queries
```

Each module follows this internal structure:
```
module/style/
├── Style.java                 # JPA Entity
├── StyleRepository.java       # Spring Data JPA Repository
├── StyleService.java          # Business logic (interface)
├── StyleServiceImpl.java      # Implementation
├── StyleController.java       # REST Controller
├── dto/
│   ├── StyleRequest.java      # Create/Update request DTO
│   ├── StyleResponse.java     # Response DTO
│   └── StyleSearchCriteria.java  # Filter/search params
└── mapper/
    └── StyleMapper.java       # Entity ↔ DTO mapping
```

### Frontend (React + Ant Design)

```
src/
├── api/                  # Axios instance, API functions per module
│   ├── axiosConfig.js
│   ├── styleApi.js
│   └── ...
├── features/             # Feature-based folder structure
│   ├── style/
│   │   ├── StyleListPage.jsx       # ProTable + filter bar + Drawer trigger
│   │   ├── StyleDetailPage.jsx     # Tabs: Details, Tech Pack, BOM, Costing
│   │   ├── components/
│   │   │   ├── StyleDrawerForm.jsx # Create/Edit form in Drawer
│   │   │   ├── SizeColorMatrix.jsx
│   │   │   └── TechPackViewer.jsx
│   │   └── hooks/
│   │       └── useStyles.js
│   ├── bom/
│   ├── costing/
│   ├── production/
│   │   ├── sewing/
│   │   │   └── SewingDailyPage.jsx # Inline editable table
│   │   ├── cutting/
│   │   └── finishing/
│   └── ...
├── components/           # Shared/reusable components
│   ├── AppLayout.jsx     # Ant Layout with sidebar + breadcrumbs + theme toggle
│   ├── StatusTag.jsx
│   ├── DeleteConfirmModal.jsx
│   ├── StatusChangeModal.jsx
│   └── SizeColorMatrix.jsx  # Reusable pivot grid
├── context/              # Auth context, theme context (light/dark), tenant context
│   ├── AuthContext.jsx
│   └── ThemeContext.jsx  # ConfigProvider + dark/light mode toggle
├── routes/               # React Router config with role guards + route config for breadcrumbs
├── hooks/                # Shared hooks
└── utils/                # formatters, constants, enums
```

### Flyway Migrations

```
src/main/resources/db/migration/
├── V1.0.0__create_common_tables.sql        # tenant, users, roles
├── V1.1.0__create_buyer_supplier.sql
├── V1.2.0__create_style_techpack.sql
├── V1.3.0__create_bom.sql
├── V1.4.0__create_costing.sql
├── V1.5.0__create_order.sql
├── V1.6.0__create_tna.sql
├── V1.7.0__create_inventory.sql
├── V1.8.0__create_production.sql
├── V1.9.0__create_shipment.sql
├── V1.10.0__create_compliance.sql
└── V1.11.0__seed_master_data.sql           # UOMs, statuses, garment types
```

---

## Multi-Tenant Support

All business entities include a `tenant_id` column. The backend uses a `TenantFilter` (Hibernate filter or `@Where`) to scope all queries automatically.

```java
// BaseEntity.java - all entities extend this
@MappedSuperclass
public abstract class BaseEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id", nullable = false)
    private Long tenantId;

    @CreatedDate
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;

    @CreatedBy
    private String createdBy;

    @LastModifiedBy
    private String updatedBy;

    @Column(nullable = false)
    private boolean deleted = false;  // soft delete
}
```

Tenant is resolved from the JWT token and set via a `TenantContext` (ThreadLocal).

---

## RBAC Pattern

### Roles & Permissions

| Role                | Modules Access                                        |
|---------------------|-------------------------------------------------------|
| ADMIN               | All modules, user management, tenant settings         |
| MERCHANDISER        | Style, BOM, Costing, Order, T&A, Buyer, Supplier      |
| PRODUCTION_MANAGER  | Production (all), T&A (read), Order (read), Inventory |
| CUTTING_MASTER      | Cutting, Inventory (fabric issue)                     |
| STORE_KEEPER        | Inventory (full), BOM (read)                          |
| FINANCE             | Costing, Order (read), Shipment (read), Reports       |
| COMPLIANCE_OFFICER  | Compliance, Buyer compliance, Audit                   |
| VIEWER              | Read-only across all modules                          |

Backend enforces via `@PreAuthorize` annotations. Frontend hides/disables UI elements based on roles from auth context.

---

## Reporting & Dashboard Patterns

Dashboards are built with Ant Design Charts or Recharts inside Ant Design Cards:

- **Merchandiser Dashboard**: Open orders by buyer, styles in pipeline by status, T&A milestone alerts.
- **Production Dashboard**: Daily output (cut/sew/finish), line efficiency %, WIP by order.
- **Inventory Dashboard**: Fabric stock levels, trim shortage alerts, aging stock.
- **Finance Dashboard**: FOB vs actual cost comparison, order value by buyer, margin analysis.

Backend provides dashboard data via dedicated `/api/v1/dashboard/{role}` endpoints using native queries or views for performance.

---

## Code Quality Standards (Enforced)

These are non-negotiable. Every generated file must pass these gates.

### Cognitive Complexity & File Size Limits

| Layer          | Max Lines/File | Max Method Complexity | Max Methods/Class |
|---------------|----------------|----------------------|-------------------|
| Entity         | 150            | 5                    | —                 |
| Repository     | 60             | —                    | 10                |
| Service Impl   | 200            | 10                   | 10                |
| Controller     | 120            | 5                    | 8                 |
| DTO            | 80             | —                    | —                 |
| Mapper         | 60             | —                    | —                 |
| React Page     | 150            | —                    | —                 |
| React Component| 100            | —                    | —                 |
| Custom Hook    | 60             | —                    | —                 |
| API file       | 30             | —                    | —                 |

**If a file exceeds limits → split it.** Extract hooks, sub-components, helper methods, or strategy classes.

### Design Patterns (Backend)

| Pattern                    | Where                                                            |
|---------------------------|------------------------------------------------------------------|
| **Interface Segregation**  | Service layer: interface + impl. Never call impl directly.       |
| **Strategy Pattern**       | Costing calculations, report generation — inject via interface.  |
| **Builder Pattern**        | Complex DTOs (CostSheet, Order). Use Lombok `@Builder`.         |
| **Factory Pattern**        | Notification/event creation, report builders.                    |
| **Template Method**        | Base CRUD service with abstract hooks for custom logic.          |
| **Observer/Event**         | Spring `ApplicationEvent` for cross-module side effects (e.g., order confirmed → create T&A). |
| **Specification Pattern**  | Complex dynamic queries via JPA `Specification<T>`.              |
| **DTO Pattern**            | Never expose entities to API. Always map through DTOs.           |

### Abstraction Layers for NFR Migration

Structure code so that switching infrastructure components requires zero business logic changes:

```
Controller → Service Interface → Service Impl → Repository Interface → JPA Impl
                                      ↓
                              Uses abstractions:
                              - CacheService (interface) → Redis/Caffeine impl
                              - FileStorageService (interface) → S3/Local impl  
                              - NotificationService (interface) → Email/SMS/Slack impl
                              - SearchService (interface) → DB/Elasticsearch impl
                              - EventPublisher (interface) → Spring Events/Kafka impl
```

**Rule:** Every external dependency (cache, storage, search, messaging, notifications) MUST be behind an interface. Business logic never imports implementation classes.

### Technical Debt Prevention

1. **No raw SQL in services** — Use Repository methods, `@Query`, or `Specification`. Native queries only in dedicated `*ReportRepository` classes.
2. **No string concatenation for queries** — Always use parameterized queries or Criteria API.
3. **No `@SuppressWarnings`** — Fix the warning, don't suppress it.
4. **No `@Transactional` on controllers** — Transactions belong in service layer only.
5. **No `Optional.get()` without `isPresent()`** — Use `orElseThrow()`, `map()`, `ifPresent()`.
6. **No field injection (`@Autowired`)** — Use constructor injection via `@RequiredArgsConstructor`.
7. **No `catch (Exception e) {}`** — Always log or rethrow. Never swallow exceptions.
8. **No hardcoded strings** — Constants in dedicated `Constants.java` or enum classes.
9. **No business logic in controllers** — Controllers only: validate → delegate → respond.
10. **No circular dependencies** — If module A needs module B and vice versa, extract shared logic into a common service or use events.
11. **No God classes** — If a service has more than 10 methods, split by sub-domain (e.g., `OrderService` → `OrderCreationService` + `OrderStatusService` + `OrderQueryService`).
12. **No copy-paste** — Extract shared logic into `AbstractCrudService<E, REQ, RES>` base class.

### Security Standards (Zero Vulnerability Target)

| Threat                     | Mitigation                                                        |
|---------------------------|-------------------------------------------------------------------|
| **SQL Injection**          | JPA parameterized queries only. No string concatenation in SQL.   |
| **XSS**                   | React auto-escapes. Never use `dangerouslySetInnerHTML`. Backend: sanitize all text inputs via `@SafeHtml` or custom validator. |
| **CSRF**                  | Stateless JWT = CSRF not applicable. If cookies used, enable CSRF filter. |
| **Broken Auth**           | JWT with short expiry (24h). Refresh token rotation. `@PreAuthorize` on every endpoint. |
| **IDOR**                  | Tenant scoping on every query. Never trust client-provided tenantId. Validate resource ownership in service layer. |
| **Mass Assignment**       | DTOs with explicit fields only. Never bind request directly to Entity. `@JsonIgnore` on sensitive entity fields. |
| **Sensitive Data Exposure**| Never log passwords, tokens, or PII. Response DTOs exclude `passwordHash`, `tenantId` internals. |
| **Dependency Vulnerabilities**| Pin dependency versions. No `LATEST` or `RELEASE` versions. Run `mvn dependency-check:check`. |
| **Rate Limiting**         | Add `spring-boot-starter-cache` + `@RateLimiter` on auth endpoints. |
| **Input Validation**      | Jakarta Bean Validation on ALL DTOs. Custom validators for business rules. Max lengths on all string fields. |
| **CORS**                  | Whitelist specific origins only. No `allowedOrigins("*")` in production. |
| **Error Information Leak**| Global exception handler returns generic messages in production. Stack traces only in dev profile. |

```java
// SecurityConfig.java — production-ready template
@Configuration
@EnableMethodSecurity(prePostEnabled = true)
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            .csrf(AbstractHttpConfigurer::disable) // Stateless JWT
            .cors(cors -> cors.configurationSource(corsConfig()))
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/v1/auth/**").permitAll()
                .requestMatchers("/actuator/health").permitAll()
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
            .headers(h -> h
                .contentSecurityPolicy(csp -> csp.policyDirectives("default-src 'self'"))
                .frameOptions(HeadersConfigurer.FrameOptionsConfig::deny)
                .httpStrictTransportSecurity(hsts -> hsts.includeSubDomains(true).maxAgeInSeconds(31536000))
            )
            .build();
    }
}
```

### Frontend Code Quality Standards

1. **Max 150 lines per page component, 100 lines per sub-component.** If exceeded, extract sub-components or custom hooks.
2. **No inline styles exceeding 3 properties.** Use CSS modules, styled-components, or Ant Design token-based styling.
3. **No deprecated Ant Design props.** Check Ant Design 5.x migration guide. Common deprecated props to avoid:
   - `visible` → use `open`
   - `onVisibleChange` → use `onOpenChange`
   - `dropdownClassName` → use `popupClassName`
   - `suffixIcon` on TreeSelect → use correct v5 API
   - `getPopupContainer` patterns — verify v5 compatibility
4. **No `any` type in TypeScript** (if using TS). Use proper interfaces for all API responses, props, and state.
5. **No direct DOM manipulation.** Use React refs, state, and Ant Design APIs only.
6. **Memoize expensive computations.** Use `useMemo` for derived data (especially Size-Color Matrix calculations), `useCallback` for handler functions passed as props.
7. **No prop drilling beyond 2 levels.** Use Context or compose components to avoid passing props through intermediate components.
8. **API error handling in one place** — axios interceptor. Components never have their own try-catch for API errors (except for form submission feedback).
9. **Consistent naming:**
   - Pages: `{Module}ListPage.jsx`, `{Module}DetailPage.jsx`
   - Drawer forms: `{Module}DrawerForm.jsx`
   - Hooks: `use{Module}s.js`, `use{Module}Options.js`
   - API: `{module}Api.js`
10. **Component reuse rules:**

| Component Type           | Reuse Rule                                                       |
|-------------------------|------------------------------------------------------------------|
| `StatusTag`             | Single shared component for ALL modules. Add new statuses to the color map. |
| `DeleteConfirmModal`    | Single shared component. Never write inline `Modal.confirm` in pages. |
| `StatusChangeModal`     | Single shared component for all status transitions.               |
| `SizeColorMatrix`       | Single shared component used by Orders, BOM, Cut Plan, Shipment.  |
| `DrawerForm` pattern    | Each module has its own DrawerForm, but they all follow identical structure. |
| `useTableQuery` hook    | Shared hook if using plain `<Table>`. ProTable modules use `request` prop directly. |
| Filter dropdowns        | `use{Module}Options` hooks reused wherever that dropdown appears. |

---

## Code Generation Rules

When generating code for this ERP, always follow these rules:

1. **Naming**: Use garment industry terms exactly (see `references/domain-models.md` glossary). Don't rename `BOM` to `MaterialList` or `T&A` to `Timeline`.
2. **Enums as DB values**: Statuses, garment types, UOMs stored as VARCHAR with Java enums. Define in a shared `enums/` package.
3. **Size-Color Matrix**: A recurring pattern across Order, BOM, Production. Always model as a child table with `size` and `color` columns, not as JSON.
4. **Quantities**: Use `BigDecimal` for quantities involving fabric (yards/meters), costs, and weights. Use `Integer` for piece counts.
5. **Audit trail**: All entities extend `BaseEntity` with `createdAt`, `updatedAt`, `createdBy`, `updatedBy`.
6. **Soft delete**: Default to soft delete (`deleted = true`) for all business entities.
7. **Pagination**: All list endpoints return `Page<T>`. Frontend uses ProTable with server-side pagination.
8. **Validation**: Use Jakarta Bean Validation (`@NotNull`, `@Size`, etc.) on request DTOs. Frontend uses Ant Design Form validation rules mirroring backend constraints.
9. **Error handling**: Global `@RestControllerAdvice` returns consistent `ApiResponse<T>` with error codes. Never expose stack traces.
10. **Flyway versions**: Follow `V{major}.{minor}.{patch}__{description}.sql` format. Never modify existing migrations; always add new ones.
11. **Constructor injection**: Always via `@RequiredArgsConstructor`. No `@Autowired` on fields.
12. **Interface-first**: All services have an interface. All external integrations behind interfaces.
13. **DTO isolation**: Never return entities from controllers. Map through DTOs using MapStruct.
14. **Split large files**: If any file exceeds the line limits in the table above, split it before delivering.

---

## Quick Start Commands

When the user asks to scaffold the project from scratch:

### Backend
```bash
# Generate Spring Boot project (recommend Spring Initializr or manual pom.xml)
# Dependencies: spring-boot-starter-web, spring-boot-starter-data-jpa,
# spring-boot-starter-security, spring-boot-starter-validation,
# flyway-core, flyway-database-postgresql, postgresql,
# jjwt-api, jjwt-impl, jjwt-jackson, lombok, mapstruct
```

### Frontend
```bash
npm create vite@latest garments-erp-ui -- --template react
cd garments-erp-ui
npm install antd @ant-design/icons @ant-design/charts @ant-design/pro-components \
  axios react-router-dom dayjs jwt-decode
```

---

## How to Use This Skill

Based on what the user asks, generate the appropriate layer(s):

| User says...                                    | Generate...                                    |
|-------------------------------------------------|------------------------------------------------|
| "Create the styles module"                      | Entity + Repo + Service + Controller + DTO + Migration + ProTable list page + Drawer form |
| "Add a migration for BOM tables"                | Flyway SQL migration only                      |
| "Build the costing form UI"                     | Drawer form + API file + hooks                 |
| "Set up the Spring Boot project"                | pom.xml + config classes + BaseEntity + auth    |
| "Generate the production tracking API"          | Backend layer only (entity through controller)  |
| "Show me the data model for orders"             | ER description + Entity classes + Migration     |
| "Add T&A calendar with milestone tracking"      | Full CRUD across all layers                     |
| "Build the sewing daily entry page"             | Inline editable table page + API + backend      |
| "Scaffold the entire project"                   | Project structure + core config + ThemeProvider + AuthContext + AppLayout |

Always reference the lifecycle flow to warn if the user is skipping a dependency (e.g., building Order before Style/BOM exists).