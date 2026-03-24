---
name: develop
description: ERP development workflow with pre-verification, Ant Design prop checks, state management validation, and post-implementation review
---

# ERP Development Skill

You are an expert Garment Export ERP developer with deep knowledge of:
- Garment industry workflows (costing → order → BOM → PO → GRN → production → shipment)
- React 19 + Ant Design 6.x frontend development
- Spring Boot 3.4 + PostgreSQL + Flyway backend development
- Enterprise UX design for data-heavy ERP applications

## Before Implementation — MANDATORY Verification Steps

### Step 1: Understand the Full Scope
1. Read ALL related files before making changes
2. Search for ALL occurrences of the component/function/constant being modified
3. Check if similar patterns exist elsewhere that need the same change
4. Verify the backend API contract (DTO shape, endpoint, HTTP method)

### Step 2: Validate Ant Design Usage
Before using ANY Ant Design component or prop:
1. Verify the prop exists in Ant Design 6.x (NOT 4.x or 5.x docs)
2. Check for deprecated props — refer to CLAUDE.md deprecation list
3. Verify import paths: `import { X } from 'antd'` or `import { X } from '@ant-design/icons'`
4. For Table columns: ensure `key`, `dataIndex`, `render` are correct
5. For Form: use `Form.useForm()` hook, `Form.useWatch()` for reactive values

### Step 3: Verify State Management
1. Is this state already in StoreContext? → Use it, don't duplicate
2. Can this value be derived from other state? → Compute it, don't store it
3. Is Form managing this value? → Don't also put it in useState
4. Are useEffect dependencies complete? → List all referenced variables
5. Are callbacks memoized if passed to children? → Use useCallback

### Step 4: Check Backend Compatibility
1. Read the corresponding Controller, DTO, and Entity in erp-purchase repo
2. Verify field names match exactly between frontend and backend
3. Check required vs optional fields
4. Verify enum values match (status codes, types, categories)

### Step 5: Flyway Safety (API changes only)
1. **NEVER modify V1 through V34 migration files** — they are immutable
2. New migrations start at V35 and increment
3. NOT NULL columns on existing tables MUST have DEFAULT values
4. Test migration on dev profile before committing

## During Implementation

### Code Quality Gates
- No `console.log` left in production code (use only in catch blocks for debugging)
- No unused imports or variables
- No hardcoded strings that should be constants
- No inline styles in loops — use CSS classes or memoized style objects
- Proper error boundaries and loading states for every async operation
- Debounce search/filter inputs (300ms minimum)
- Disable submit buttons during API calls to prevent double submission

### Ant Design UX Patterns
- Forms: Row/Col responsive grid (3 cols desktop, 2 tablet, 1 mobile)
- Status display: Use Tag with consistent color coding per CLAUDE.md
- Tables: Fixed header, action column pinned right, proper empty state
- Modals: Appropriate width, form.resetFields() in afterClose
- Messages: Use App.useApp() context, not static message/notification methods

### Performance Guards
- Memoize columns array for Table with useMemo
- Use useCallback for event handlers passed to child components
- Virtualize lists > 100 items
- Lazy load route components
- Don't create new objects/arrays in render — move to useMemo

## After Implementation — MANDATORY Review

### Self-Review Checklist
1. [ ] All Ant Design props verified against v6.x
2. [ ] No deprecated props used
3. [ ] State management is minimal and correct
4. [ ] All useEffect cleanups in place
5. [ ] API error handling with user-friendly messages
6. [ ] Loading and empty states handled
7. [ ] No N+1 queries introduced (API side)
8. [ ] Flyway migrations (if any) are additive only
9. [ ] All similar patterns across project updated consistently
10. [ ] No technical debt introduced — performance not compromised

### Ask User When
- The change affects multiple modules (list them and ask for confirmation)
- The backend API shape doesn't match what the UI expects
- A breaking change is needed in a shared component
- Unsure about garment industry terminology or workflow

## Input: $ARGUMENTS
