#!/usr/bin/env python3
"""ERP Prompt Enhancer - UserPromptSubmit hook for Garment ERP workflow.

Triages each user prompt:
  - Empty / slash / bang / short / pure-question -> pass through unchanged.
  - Otherwise -> inject an ERP enforcement protocol via additionalContext.
    The main agent then evaluates the prompt against ERP rules, proposes
    a rewrite when needed, and waits for the user's approval BEFORE acting.

Toggle off for one shell:  export ERP_ENHANCER=off
"""

import json
import os
import re
import sys


SKIP_PREFIXES = ("/", "!")
QUESTION_PATTERN = re.compile(
    r"^\s*(what|how|why|when|where|who|which|can|could|does|do|did|is|are|will|would|should|may|might)\b",
    re.IGNORECASE,
)
APPROVAL_PATTERN = re.compile(
    r"^\s*(yes|y|ok|okay|approve[d]?|use it|send it|go|go ahead|proceed|continue|do it|please)\b[\s.!?]*$",
    re.IGNORECASE,
)
MIN_WORDS = 10

PROTOCOL = """<ERP-PROMPT-ENHANCER>
The user is working on the Garment ERP project. Their prompt below may be vague or
missing context. Before taking any action on it, run this protocol:

  Step 1 - Evaluate the prompt against the ERP prompt-engineering rules:
    R1. NAMES the target repo, module, file, or component (when applicable).
        Repos: avarsh-erp-ui (React 19 + Vite + AntD 6.x), erp-purchase
        (Spring Boot 3.4 + Java 21 + PostgreSQL + Flyway).
    R2. STATES the user-visible outcome or business intent clearly.
    R3. SCOPE is identifiable: new feature / bug fix / refactor / read-only / spike.
    R4. DEPRECATION/MIGRATION concerns flagged: AntD 6.x deprecated props, immutable
        Flyway migrations V1-V34 must not be edited.
    R5. DEPENDENCIES named when relevant: API endpoint, master data, permissions
        (RBAC via src/utils/permissions.js), StoreContext cache, SessionContext,
        axiosInstance interceptors.
    R6. SUCCESS CRITERIA defined: "done" means what (browser works, no console
        errors, type check passes, integration test passes, etc.).
    R7. AVOIDS vague verbs ("fix it", "update X", "make it better") without a
        concrete target.

  Step 2 - Decision branch:
    A. If the prompt SATISFIES the rules well enough to act on without back-and-
       forth, proceed normally. No rewrite needed. Do not mention this protocol.
    B. If the prompt is VAGUE, ambiguous, or missing critical context, output the
       proposed rewrite in this exact form and STOP - do not call any tool yet:

         **Enhanced prompt proposal**
         > <rewritten prompt that satisfies R1-R7, preserving user intent verbatim>
         _Why:_ <one short sentence on what was missing>
         Reply `yes` to proceed, or amend / send a different prompt.

  Step 3 - When the user replies with approval (yes / ok / proceed / send it),
    treat the rewritten prompt as the actual request and execute it.
    When the user amends or sends a different prompt, restart from Step 1.

  EXCEPTIONS - skip this protocol entirely when the prompt is:
    - a follow-up reply to your own clarification question in the prior turn
    - confirming/approving something you already proposed
    - clearly continuing an in-progress task you have context on
    - going to trigger the `erp-dev` skill (full-stack feature work, new module,
      new screen, "build X", "implement Y", anything spanning UI + API repos).
      That skill enters plan mode with its own approval gate - do not double-gate.
      Hand off directly to erp-dev and let it do the structured planning.

  Do not announce that the protocol exists. Just apply it silently or ask for
  approval per Step 2B.
</ERP-PROMPT-ENHANCER>"""


def main():
    if os.environ.get("ERP_ENHANCER", "").lower() in {"off", "0", "false", "disabled"}:
        return

    raw = sys.stdin.read()
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        return

    prompt = (data.get("prompt") or "").strip()
    if not prompt:
        return

    if prompt.startswith(SKIP_PREFIXES):
        return

    if APPROVAL_PATTERN.match(prompt):
        return

    if len(prompt.split()) < MIN_WORDS:
        return

    if QUESTION_PATTERN.match(prompt):
        return

    output = {
        "hookSpecificOutput": {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": PROTOCOL,
        }
    }
    sys.stdout.write(json.dumps(output))


if __name__ == "__main__":
    main()
