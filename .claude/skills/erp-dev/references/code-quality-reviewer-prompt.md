# ERP Code Quality Reviewer Prompt Template

Use this template when dispatching a code quality reviewer subagent.

**Purpose:** Verify implementation is well-built (clean, tested, maintainable, ERP-compliant)

**Only dispatch after spec compliance review passes.**

```
Agent({
  description: "Review code quality for Task N",
  subagent_type: "superpowers:code-reviewer",
  prompt: |
    Review code quality for Task N implementation in a Garment Export ERP system.

    ## What Was Implemented
    [From implementer's report]

    ## Files Changed
    [List of files]

    ## ERP Quality Checks (In Addition to Standard Code Quality)

    ### Architecture & Organization
    - Does each file have one clear responsibility with a well-defined interface?
    - Are units decomposed so they can be understood independently?
    - Is the implementation following existing codebase patterns?
    - Did this implementation create files that are already large?

    ### File Size Limits
    - React Page Component: 150 lines max
    - React Sub-Component: 100 lines max
    - Custom Hook: 60 lines max
    - UI Service/API file: 30 lines max
    - Spring Controller: 120 lines max
    - Spring Service Impl: 200 lines max
    - Entity: 150 lines max / DTO: 80 lines max / Repository: 60 lines max

    ### Frontend Quality (if UI changes)
    - Memoization: columns in useMemo, handlers in useCallback?
    - No unnecessary state — derived values computed, not stored?
    - Form values managed by Form instance, not duplicated in useState?
    - useEffect dependencies complete — no missing/extra deps?
    - StoreContext data used directly — not copied to local state?
    - Debounced search inputs (300ms minimum)?
    - Disabled submit buttons during API calls?
    - Loading + error + empty states for every async operation?
    - ZERO deprecated Ant Design props or CSS classes?

    ### Backend Quality (if API changes)
    - Constructor injection via @RequiredArgsConstructor?
    - @Transactional on service write methods?
    - Never returning entities from controllers — DTO mapping via MapStruct?
    - @Valid on controller request body parameters?
    - N+1 prevention: @EntityGraph or JOIN FETCH for relationships in list queries?
    - Immutable Flyway migrations (V1-V34 untouched)?

    ### Karpathy Guidelines Compliance
    - Simplicity: minimum code that solves the problem?
    - No speculative abstractions or unused flexibility?
    - Surgical changes: every changed line traces to the task spec?
    - No "improvements" to adjacent code that wasn't part of the task?

    ### Design Quality (if new UI screens)
    - Clear visual hierarchy: page title > section headers > field labels > values?
    - Consistent spacing using Ant Design's Space/Row/Col?
    - Tables: fixed header, right-aligned numbers, status tags with correct colors?
    - Forms: logical field grouping, smart defaults, inline validation?
    - Empty states with contextual messages + CTA?
    - Loading skeletons (not just spinners) for data-heavy screens?

    Report: Strengths, Issues (Critical/Important/Minor), Assessment
})
```
