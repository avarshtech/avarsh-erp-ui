---
name: implement
description: Implement feature with full verification — research files, verify AntD props, check cross-references, implement after confirmation
---

# Implementation with Verification Skill

Implement the requested feature/fix with full pre and post verification.

## Phase 1: Research (DO NOT WRITE CODE YET)

1. **Read all related files** — understand existing patterns, imports, state
2. **Search project-wide** — find all occurrences of components/functions being modified
3. **Check API contract** — read the corresponding Controller + DTO in erp-purchase repo
4. **Identify impact scope** — list ALL files that will need changes
5. **Present plan to user** — describe what will change and where, ask for confirmation

## Phase 2: Implement (After user confirms plan)

1. Make changes following the patterns already established in the codebase
2. Use Ant Design 6.x compatible props only
3. Follow state management rules (no duplication, minimal state)
4. Handle loading/error/empty states
5. Add proper form validation where needed

## Phase 3: Verify (After implementation)

### Automated Checks
1. Search for deprecated Ant Design props in changed files:
   - `visible=` (should be `open=`)
   - `onVisibleChange` (should be `onOpenChange`)
   - `bordered=` on Input/Select (should be `variant=`)
   - `dropdownClassName` (should be `popupClassName`)
2. Check all useEffect have proper dependency arrays
3. Verify no useState duplicates Form-managed values
4. Ensure all API calls have error handling
5. Check for console.log statements (remove unless in catch blocks)

### Cross-Reference Checks
1. If a shared component was modified → search for all usages, verify they still work
2. If a constant/enum was changed → search for all imports, verify alignment
3. If a service function signature changed → find all callers, update them
4. If a route was added → verify App.jsx routing and sidebar navigation

### Ask User About
1. Places where the same pattern exists but wasn't part of the original request
2. Whether to apply consistent changes across those locations

## Phase 4: Summary

Report:
- Files changed and what was done
- Any cross-cutting concerns found and addressed
- Any remaining items the user should be aware of

## Input: $ARGUMENTS
