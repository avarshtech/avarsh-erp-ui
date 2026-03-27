# Avarsh ERP UI — Development Context

## Project Overview
Garment export industry ERP system. UI repo (`avarsh-erp-ui`) paired with Spring Boot API (`erp-purchase`).

## Tech Stack
- **Frontend:** React 19 + Vite 7, Ant Design 6.x, React Router v7, dayjs, Axios
- **Backend:** Spring Boot 3.4, Java 21, PostgreSQL, Flyway, MapStruct, Spring Security (JWT)
- **Testing:** Playwright (E2E), Testcontainers + REST Assured (API)

## Architecture
```
UI: src/pages/{module}/      → src/services/{module}Service.js → axiosInstance.js → API
API: controller/             → service/                        → repository/      → PostgreSQL
```

## Garment Export ERP Domain Knowledge

### Core Business Flow
1. **Buyer** places inquiry → **Style/Techpack** created
2. **Costing** prepared (fabric + trims + manufacturing + overhead + margin)
3. Buyer approves → **Order** created (buyer PO, sizes, colors, quantities, destinations)
4. **BOM** (Bill of Materials) generated from order specs
5. **Purchase Orders** raised to suppliers for materials
6. **GRN** (Goods Receipt Note) against POs
7. Production → Inspection → Shipment → Invoice

### Key Domain Concepts
- **Style Number:** Unique identifier for a garment design (e.g., AV-SS25-001)
- **Techpack:** Technical specification document with measurements, construction details, BOM
- **FOB/CMT/CIF:** Pricing terms — Free On Board / Cut-Make-Trim / Cost Insurance Freight
- **Size Run:** Size breakdown (S/M/L/XL or 28/30/32/34 etc.) with ratio packs
- **Color Way:** Color variants of same style, each with Pantone references
- **Consumption:** Fabric/trim quantity needed per garment (calculated with wastage %)
- **Cut Order:** Production planning based on fabric width, marker efficiency
- **Shipping Marks:** Carton labeling for export (buyer PO, destination, size assortment)
- **Pre-shipment Inspection:** Quality check before dispatch (AQL sampling)
- **GSP/FTA:** Preferential trade certificates for duty benefits
- **LC/TT:** Payment methods — Letter of Credit / Telegraphic Transfer

### Season Codes
Spring/Summer (SS), Autumn/Winter (AW), Resort, Pre-Fall, Holiday, Cruise

### Garment Types
T-Shirts, Polo Shirts, Hoodies, Sweatshirts, Joggers, Shorts, Jackets, Dresses, Skirts, Trousers, Blouses, Knitwear

---

## Development Standards

### File & Code Organization
- One component per file, named same as export
- Services in `src/services/` — one per backend module
- Constants in `src/utils/{module}Constants.js`
- Shared components in `src/components/`
- Page components in `src/pages/{module}/`

### Ant Design Component Rules
1. **ALWAYS check the current Ant Design version (6.x) docs before using any component prop**
2. **NEVER use deprecated props** — common mistakes:
   - `visible` → use `open` (Modal, Drawer, Dropdown, Tooltip, Popover, Popconfirm)
   - `onVisibleChange` → use `onOpenChange`
   - `dropdownClassName` → use `popupClassName`
   - `dropdownMatchSelectWidth` → use `popupMatchSelectWidth`
   - `bordered` → use `variant="borderless"` (Input, Select, DatePicker)
   - `size="default"` → use `size="middle"` (Table, Button)
   - `filterDropdownVisible` → use `filterDropdownOpen` (Table column)
   - `Descriptions.Item label` with ReactNode → ensure compatibility
   - `Form.Item` with `rules` — avoid `required` alongside `rules` that already set required
3. **Table columns:** Use `key` prop on all columns, ensure `dataIndex` matches data shape
4. **Form patterns:** Use `Form.useForm()`, not class-based forms. Use `Form.useWatch()` for reactive fields
5. **Notification/Message:** Use `App.useApp()` context for `message`, `notification`, `modal` — never static methods

### State Management Rules
1. Use `useState` for local component state
2. Use `StoreContext` for cached master data (buyers, suppliers, items, etc.)
3. **NEVER duplicate StoreContext data in local state** — use it directly
4. Use `useCallback` / `useMemo` for expensive computations and callbacks passed to children
5. Avoid state for values derivable from other state (use computed values instead)
6. Form state → managed by Ant Design `Form` instance, not React state
7. **Clean up effects:** Always return cleanup function from `useEffect` when subscribing/adding listeners

### API Integration Rules
1. Use `axiosInstance` from `src/services/axiosInstance.js` — NEVER create new Axios instances
2. Handle loading, error, and empty states for every API call
3. Use `StoreContext` cache for master data (5-min TTL auto-managed)
4. Optimistic locking: pass `version` field on updates, handle 409 conflicts
5. Backend returns paginated responses for lists — use Ant Design Table pagination

### Error Handling
1. API errors: Show `message.error()` with user-friendly text, log technical details to console
2. Form validation: Use Ant Design Form validation rules — show inline errors, not alerts
3. Network errors: Show retry option, not just error message
4. 401 errors: Handled by axiosInstance interceptor (silent refresh → logout if fails)
5. 409 conflicts: Handled by ConflictDialog component

---

## Pre-Implementation Verification Checklist

Before writing ANY code, verify:

### 1. Component & Prop Verification
- [ ] All Ant Design component props exist in current version (6.x)
- [ ] No deprecated props used — check migration guide if unsure
- [ ] Component import paths are correct (`antd`, `@ant-design/icons`)

### 2. State Management Verification
- [ ] No unnecessary state — can it be derived from existing state/props?
- [ ] Form values managed by Form instance, not duplicated in useState
- [ ] useEffect dependencies are correct — no missing/extra deps
- [ ] No stale closures in callbacks

### 3. Existing Code Impact
- [ ] Search ALL occurrences of modified components/functions in the project
- [ ] Check if similar patterns exist elsewhere that need same change
- [ ] Verify imports/exports still work after changes
- [ ] Check if constants/enums used elsewhere need updating

### 4. Backend Compatibility
- [ ] API request/response shape matches backend DTO
- [ ] Field names match exactly (camelCase in JS, camelCase in Java DTOs)
- [ ] Enum values match backend enum definitions
- [ ] Required fields are sent, optional fields handled

### 5. Flyway Migration Safety
- [ ] **NEVER edit already-pushed migration files** (V1 through V34 are locked)
- [ ] New migrations must be V{next}__description.sql (increment from last)
- [ ] Test migration forward AND rollback scenarios
- [ ] Column renames need data migration, not just DDL

---

## Performance Standards

### Must-Have
- Virtualize lists > 100 items (use Ant Design Table virtual scroll or react-window)
- Debounce search inputs (300ms minimum)
- Lazy load routes with `React.lazy()` + `Suspense`
- Memoize expensive renders with `React.memo`, `useMemo`, `useCallback`
- Avoid re-renders: don't create new objects/arrays in render (move to useMemo or outside component)

### Must-Avoid
- Fetching same data multiple times — use StoreContext cache
- Unnecessary re-renders from context — split contexts if needed
- Large bundle imports — use tree-shakeable imports: `import { Button } from 'antd'`
- Inline styles in loops — use CSS classes or styled objects defined outside render

---

## UX Design Standards (Ant Design ERP)

### Layout Principles
- **Forms:** Use responsive `Row`/`Col` grid — 3 columns on desktop, 2 on tablet, 1 on mobile
- **Master-Detail:** Use split view (`MasterSplitView` component) for master data screens
- **Tables:** Fixed header, scrollable body, action column pinned right
- **Modals:** Max width 720px for forms, 1000px for complex views. Use Drawer for creation flows that need more space

### Form UX
- Group related fields in `Card` or `Collapse` sections with clear titles
- Required fields: red asterisk via Form rules, not manual `*`
- Default values: Pre-fill dates (today), currencies (USD for export), standard terms
- Inline help: Use `tooltip` prop on Form.Item label, not placeholder text for instructions
- Save draft: Auto-save or prominent "Save Draft" for long forms
- Unsaved changes: Always use `useUnsavedChanges` hook on forms with data entry

### Table UX
- Searchable columns: Include column filters for key fields
- Sortable: Enable sorting on date, number, and status columns
- Status tags: Use colored `Tag` components with consistent color mapping
- Actions: Use `Dropdown` menu for 3+ actions, inline buttons for 1-2
- Empty state: Custom empty message relevant to the module, not generic "No Data"
- Loading: Show `Skeleton` or `Spin` during data fetch, never blank screen

### Color & Status Conventions
- Draft: `default` (gray)
- Submitted/Pending: `processing` (blue)
- Approved: `success` (green)
- Rejected: `error` (red)
- Cancelled: `default` with strikethrough
- In Progress: `warning` (orange)

### Responsive Design
- Test all screens at 1024px (tablet) and 1440px (desktop) minimum
- Use `useIsTablet` hook for layout switching
- Collapse sidebar on tablet, use hamburger menu
- Stack form columns on narrow screens

---

## Common Mistakes to Avoid (Learned from Development)

### React
1. **Don't mutate state directly** — always create new arrays/objects
2. **useEffect firing twice in dev** — this is React StrictMode, not a bug. Don't add workarounds
3. **Missing keys in lists** — use unique IDs, never array index for dynamic lists
4. **Stale closures** — add all used variables to useEffect/useCallback dependency arrays
5. **Event handler recreation** — wrap with useCallback when passed to memoized children

### Ant Design
1. **Form.setFieldsValue vs form.resetFields** — setFieldsValue merges, resetFields clears all
2. **Table re-render** — memoize `columns` array and `dataSource` if computed
3. **Select/Cascader with objects** — use `labelInValue` when you need the full option object
4. **DatePicker + dayjs** — always use dayjs objects, never Date or strings
5. **Modal form** — call `form.resetFields()` in `afterClose`, not `onCancel`

### API Integration
1. **Race conditions** — cancel previous requests when filters change (AbortController)
2. **Double submit** — disable submit button during API call
3. **Stale data** — refresh list after create/update/delete, don't manually patch local state
4. **File upload** — use FormData, set correct Content-Type (or let browser set it)

### Spring Boot (API Repo)
1. **Flyway migrations are immutable once pushed** — create new V{n+1} migration instead
2. **MapStruct mapping** — ensure all DTO fields have matching entity fields or @Mapping annotations
3. **JPA N+1** — use `@EntityGraph` or `JOIN FETCH` for related entities in list queries
4. **Transaction boundaries** — @Transactional on service methods, not controllers
5. **Validation** — Use @Valid on controller parameters, define constraints on DTOs

---

## Module Status Reference

| Module | UI Status | API Status | Notes |
|--------|-----------|------------|-------|
| Auth/Login | Complete | Complete | JWT + refresh token |
| Orders | Active dev | Complete | Order CRUD with lines/colors |
| BOM | Active dev | Complete | Bill of Materials |
| Costing | Complete | Complete | Multi-size costing + approval |
| Purchase Orders | Complete | Complete | Full workflow with PDF |
| GRN | Active dev | Partial | Goods Receipt |
| Master Data | Complete | Complete | 15 master entities |
| Admin | Complete | Complete | Users + RBAC |
| Email | N/A | Complete | Template-based notifications |
| File Upload | Complete | Complete | Generic file storage |

---

## Repository Cross-Reference

| Concern | UI Repo (avarsh-erp-ui) | API Repo (erp-purchase) |
|---------|-------------------------|------------------------|
| Entry point | `src/main.jsx` | `ErpPurchaseApplication.java` |
| Routing | `src/App.jsx` | Controllers (`/api/v1/*`) |
| API calls | `src/services/*Service.js` | `controller/*Controller.java` |
| Data models | Inline / constants | `domain/*.java`, `dto/*.java` |
| Permissions | `src/utils/permissions.js` | `Role.permissions` (JSONB) |
| DB schema | N/A | `db/migration/V*.sql` |
| Config | `vite.config.js`, `.env` | `application-{profile}.properties` |

---

## Custom Skills (Slash Commands)

Use these skills during development by invoking the corresponding slash command:

| Skill | Command | When to Use |
|-------|---------|-------------|
| **ERP Dev** | `/erp-dev` | **Primary agent** — Full-stack development across UI + API repos. Auto plan mode for features (5+ files). Auto-executes builds/tests. Auto-pulls missing skills from skills.sh. Use for any task spanning both repos. |
| **Garment ERP** | `/garment-erp` | Full-stack garment ERP development — covers Tech Pack → BOM → Costing → Order → T&A → Production → Shipment. Trigger for any garment domain work: styles, tech packs, BOM, costing, T&A calendar, cut plan, sewing line, production tracking, buyer/supplier management, fabric/trim inventory, size-color matrix, compliance, shipment/packing list. |
| **Develop** | `/develop` | ERP development workflow with pre-verification, Ant Design prop checks, state management validation, and post-implementation review. |
| **Implement** | `/implement` | Research files first, verify AntD props, check cross-references, then implement after confirmation. |
| **Review** | `/review` | Code review for ERP — checks Ant Design compliance, state management, performance, API integration, tech debt, and UX consistency. |

### ERP Dev Agent — Skills Auto-Pull

The `/erp-dev` agent automatically pulls missing skills from [skills.sh](https://skills.sh/) when a task requires capabilities not available locally (e.g., Playwright testing, Docker, CI/CD, i18n, PDF generation). The agent notifies in chat when a skill is pulled.

### Garment ERP Skill Reference Files

The `/garment-erp` skill includes detailed reference guides in `.claude/skills/garment-erp/references/`:

| Reference File | Contents |
|---------------|----------|
| `domain-models.md` | Domain understanding, entity relationships, garment industry data models |
| `backend-patterns.md` | Spring Boot API, service, entity, repository patterns |
| `frontend-patterns.md` | React + Ant Design pages, forms, tables, drawer patterns |
| `migration-patterns.md` | Flyway database migration patterns and conventions |
| `referential-integrity-patterns.md` | Delete protection, edit locking, FK handling |
| `performance-patterns.md` | Caching, N+1 prevention, memoization, optimization |
| `domain-algorithms.md` | BOM/Costing formulas, search algorithms, aggregation logic |

### Garment Lifecycle (Module Dependencies)

```
Tech Pack → BOM → Costing → Order → T&A Calendar → Production → Shipment
```

- **Tech Pack**: Standalone — style specifications, measurements, construction details
- **BOM**: Depends on Tech Pack — fabrics, trims, accessories per style/size
- **Costing**: Depends on BOM — CM, FOB, material costs, overheads
- **Order/PO**: Depends on Costing — buyer PO with size-color breakdown
- **T&A Calendar**: Depends on Order — milestones from fabric in-house to shipment
- **Production**: Depends on T&A + Order — Cutting → Sewing → Finishing/Packing
- **Shipment**: Depends on Production — packing lists, container booking, docs
