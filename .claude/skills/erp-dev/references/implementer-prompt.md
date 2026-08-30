# ERP Implementer Subagent Prompt Template

Use this template when dispatching an implementer subagent for ERP tasks.

```
Agent({
  description: "Implement Task N: [task name]",
  prompt: |
    You are implementing Task N: [task name] for a Garment Export ERP system.

    ## Task Description

    [FULL TEXT of task from plan - paste it here, don't make subagent read file]

    ## Context

    [Scene-setting: where this fits in the ERP lifecycle, dependencies, architectural context]
    [Which repo: avarsh-erp-ui (React 19 + AntD 6.x) and/or erp-purchase (Spring Boot 3.4)]

    ## ERP-Specific Rules (MUST follow)

    ### Frontend (if UI work)
    - Ant Design 6.x ONLY — ZERO deprecated props allowed
    - `open` not `visible`, `onOpenChange` not `onVisibleChange`
    - `variant="borderless"` not `bordered={false}`
    - `popupClassName` not `dropdownClassName`
    - `size="middle"` not `size="default"`
    - Form.useForm() hook — never class-based forms
    - App.useApp() for message/notification/modal — never static methods
    - Memoize columns with useMemo, handlers with useCallback
    - Use StoreContext for master data — never duplicate in local state
    - Loading + error + empty states for every async operation
    - Debounce search inputs (300ms minimum)
    - Disable submit buttons during API calls
    - No React deprecated patterns: no defaultProps, no findDOMNode, no UNSAFE_ lifecycle

    ### Backend (if API work)
    - Constructor injection via @RequiredArgsConstructor (no @Autowired)
    - @Transactional on service write methods, @Transactional(readOnly=true) on reads
    - Never return entities from controllers — always map to DTO via MapStruct
    - @Valid on all controller request body parameters
    - V1-V34 Flyway migrations are IMMUTABLE — never edit them

    ### General (Karpathy Guidelines)
    - Simplicity first: minimum code that solves the problem
    - Surgical changes: touch only what you must
    - No features beyond what was asked
    - No abstractions for single-use code
    - Every changed line should trace directly to the task spec

    ## Before You Begin

    If you have questions about:
    - The requirements or acceptance criteria
    - The approach or implementation strategy
    - Dependencies or assumptions
    - ERP domain terminology
    - Anything unclear in the task description

    **Ask them now.** Raise any concerns before starting work.

    ## Your Job

    Once you're clear on requirements:
    1. Implement exactly what the task specifies
    2. Run deprecated props/CSS scan on your code (ZERO deprecated patterns allowed)
    3. Verify implementation works
    4. Self-review: completeness, quality, discipline, no overbuilding
    5. Report back

    Work from: [directory]

    ## File Size Limits
    - React Page Component: 150 lines max
    - React Sub-Component: 100 lines max
    - Custom Hook: 60 lines max
    - UI Service/API file: 30 lines max
    - Spring Controller: 120 lines max
    - Spring Service Impl: 200 lines max
    - Entity: 150 lines max / DTO: 80 lines max
    If exceeded → split before delivering.

    ## When You're in Over Your Head

    It is always OK to stop and say "this is too hard for me."

    STOP and escalate when:
    - The task requires architectural decisions with multiple valid approaches
    - You need to understand code beyond what was provided
    - You feel uncertain about whether your approach is correct
    - The task involves restructuring existing code the plan didn't anticipate

    Report back with status BLOCKED or NEEDS_CONTEXT.

    ## Before Reporting Back: Self-Review

    **Completeness:** Did I implement everything in the spec? Edge cases?
    **Quality:** Clean, maintainable code? Clear names?
    **Discipline:** No overbuilding? Only what was requested? Existing patterns followed?
    **Deprecated check:** ZERO deprecated Ant Design props or CSS classes?

    If you find issues during self-review, fix them now.

    ## Report Format

    - **Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
    - What you implemented
    - Files changed
    - Deprecated scan results (must be clean)
    - Self-review findings
    - Any issues or concerns
})
```
