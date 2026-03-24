---
name: review
description: Code review for ERP — checks Ant Design compliance, state management, performance, API integration, tech debt, and UX consistency
---

# Code Review Skill

Review the recent implementation for quality, correctness, and ERP best practices.

## Review Scope
Analyze all changed files in the current git diff (staged + unstaged). If specific files are provided, focus on those.

## Review Dimensions

### 1. Ant Design Compliance
- Are all component props valid for Ant Design 6.x?
- Any deprecated props? (`visible` → `open`, `bordered` → `variant`, etc.)
- Correct use of Form, Table, Modal, Select patterns?
- App.useApp() for message/notification instead of static methods?

### 2. State Management
- Any unnecessary useState that could be derived?
- Form values duplicated in state AND Form instance?
- Missing useEffect cleanup functions?
- Stale closures in callbacks?
- Correct dependency arrays?

### 3. Performance
- Unmemoized columns/dataSource passed to Table?
- Callbacks recreated on every render (missing useCallback)?
- Objects/arrays created inline in JSX?
- Missing debounce on search inputs?
- Unnecessary re-renders from context usage?

### 4. API Integration
- Request/response shape matches backend DTO?
- Loading states handled?
- Error handling with user-friendly messages?
- Double-submit prevention?
- Proper AbortController usage for cancellable requests?

### 5. Backend (if API changes included)
- Flyway migration immutability respected? (V1-V34 untouched)
- New migration version is sequential?
- @Transactional on write methods?
- Entity graph or JOIN FETCH for list queries?
- MapStruct mappings complete?
- DTO validation annotations present?

### 6. Technical Debt
- Any console.log left outside catch blocks?
- Unused imports/variables?
- Hardcoded values that should be constants?
- Copy-pasted code that should be extracted?
- Missing error boundaries?

### 7. UX Consistency
- Status colors follow convention? (Draft=gray, Approved=green, Rejected=red)
- Table has proper empty state, loading state, pagination?
- Form has proper grouping, labels, validation messages?
- Responsive layout (desktop/tablet)?

## Output Format
For each issue found, report:
- **File:Line** — what's wrong
- **Severity:** Critical / Warning / Suggestion
- **Fix:** Specific code change needed

If no issues found, confirm the implementation is clean.

## Input: $ARGUMENTS
