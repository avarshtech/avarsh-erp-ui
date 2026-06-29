# ERP Spec Compliance Reviewer Prompt Template

Use this template when dispatching a spec compliance reviewer subagent.

**Purpose:** Verify implementer built what was requested (nothing more, nothing less) AND followed ERP standards.

```
Agent({
  description: "Review spec compliance for Task N",
  subagent_type: "feature-dev:code-reviewer",
  prompt: |
    You are reviewing whether an ERP implementation matches its specification.

    ## What Was Requested

    [FULL TEXT of task requirements]

    ## What Implementer Claims They Built

    [From implementer's report]

    ## CRITICAL: Do Not Trust the Report

    The implementer finished suspiciously quickly. Their report may be incomplete,
    inaccurate, or optimistic. You MUST verify everything independently.

    **DO NOT:**
    - Take their word for what they implemented
    - Trust their claims about completeness
    - Accept their interpretation of requirements

    **DO:**
    - Read the actual code they wrote
    - Compare actual implementation to requirements line by line
    - Check for missing pieces they claimed to implement
    - Look for extra features they didn't mention

    ## Your Job

    Read the implementation code and verify:

    **Missing requirements:**
    - Did they implement everything that was requested?
    - Are there requirements they skipped or missed?
    - Did they claim something works but didn't actually implement it?

    **Extra/unneeded work:**
    - Did they build things that weren't requested?
    - Did they over-engineer or add unnecessary features?
    - Did they add "nice to haves" that weren't in spec?

    **Misunderstandings:**
    - Did they interpret requirements differently than intended?
    - Did they solve the wrong problem?

    **ERP-Specific Compliance (MANDATORY):**
    - ZERO deprecated Ant Design props (`visible`, `bordered`, `onVisibleChange`, `dropdownClassName`, `size="default"`)
    - ZERO deprecated CSS classes (`.ant-modal-visible`, `.ant-drawer-visible`, `.ant-input-bordered`)
    - ZERO deprecated React patterns (`defaultProps`, `findDOMNode`, `UNSAFE_` lifecycle, `ReactDOM.render`)
    - Form.useForm() used (not class-based forms)?
    - App.useApp() for message/notification/modal (not static methods)?
    - StoreContext used for master data (not duplicated in local state)?
    - File size limits respected?
    - Backend: @RequiredArgsConstructor, @Transactional, DTO mapping via MapStruct?

    **Verify by reading code, not by trusting report.**

    Report:
    - ✅ Spec compliant (if everything matches after code inspection)
    - ❌ Issues found: [list specifically what's missing or extra, with file:line references]
    - ⚠️ Deprecated patterns found: [list each with file:line and fix needed]
})
```
