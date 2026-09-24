#!/usr/bin/env python3
"""UserPromptSubmit hook: injects a prompt-precision protocol for the Garment ERP repos.

Pass-through (no injection) for empty, slash/bang, approval, short, or question prompts.
IDE-injected leading blocks such as <ide_opened_file>...</ide_opened_file> are ignored
when classifying, so they cannot defeat those filters.

Disable for one shell:  export ERP_ENHANCER=off
"""

import json
import os
import re
import sys


SKIP_PREFIXES = ("/", "!")
LEADING_TAG_BLOCK = re.compile(r"^\s*<(\w+)(?:\s[^>]*)?>.*?</\1>\s*", re.DOTALL)
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
Repos: avarsh-erp-ui (React 19, Vite 7, AntD 6, JavaScript/JSX - no TypeScript) and
erp-purchase (Spring Boot 3.4, Java 21, PostgreSQL, Flyway, Gradle).

Skip this protocol if the prompt continues an exchange you already have context on
(follow-up, approval, next step of in-progress work), or is full-stack feature work
that triggers the erp-dev skill, which owns its own plan-mode approval gate.

Otherwise, before any tool call, check whether the prompt gives:
  R1 Target - repo plus module/file/component.
  R2 Outcome - the user-visible result, stated concretely (not "fix"/"update"/"improve" X).
  R3 Scope - new feature, bug fix, refactor, read-only investigation, or spike.
  R4 Dependencies, where they exist - API endpoint, master data, permission key in
     src/utils/permissions.js, StoreContext, SessionContext,
     src/services/core/axiosInstance.js interceptors.
  R5 Done - the check that proves it. UI: `npm run lint`, `npm run build`,
     `npx playwright test --project=<name>`, screen verified in the browser.
     API: `./gradlew compileJava`, `./gradlew test`.
  R6 Constraints respected - an applied Flyway migration is never edited or renamed;
     new ones are V<yyyyMMddHHmmss>__<desc>.sql (the V1-V37 sequence is retired);
     H2 mirrors in db/h2migration stay sequential below V100; no AntD 6 deprecated props.

Proceed silently if R1-R3 and R5 are answerable from the prompt plus existing context
and the ask respects R6. Otherwise output exactly this and stop:

**Enhanced prompt proposal**
> <rewrite satisfying R1-R6, user intent kept verbatim>
_Why:_ <one sentence on what was missing>
Reply `yes` to proceed, or amend / send a different prompt.

On approval, execute the rewrite as the request. Do not mention this protocol unless
the user asks about it.
</ERP-PROMPT-ENHANCER>"""


def user_text(prompt):
    while True:
        match = LEADING_TAG_BLOCK.match(prompt)
        if not match:
            return prompt.strip()
        prompt = prompt[match.end():]


def main():
    if os.environ.get("ERP_ENHANCER", "").lower() in {"off", "0", "false", "disabled"}:
        return

    try:
        data = json.loads(sys.stdin.read())
    except (json.JSONDecodeError, ValueError):
        return

    prompt = user_text(data.get("prompt") or "")
    if (
        not prompt
        or prompt.startswith(SKIP_PREFIXES)
        or APPROVAL_PATTERN.match(prompt)
        or len(prompt.split()) < MIN_WORDS
        or QUESTION_PATTERN.match(prompt)
    ):
        return

    sys.stdout.write(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": PROTOCOL,
        }
    }))


if __name__ == "__main__":
    main()
