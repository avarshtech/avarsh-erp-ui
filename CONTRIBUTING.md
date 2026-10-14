# Contributing to avarsh-erp-ui

How work gets into this repository. The rules the code itself follows are in
[docs/engineering/ui-standards.md](docs/engineering/ui-standards.md); releases are in
[RELEASING.md](RELEASING.md); end-to-end tests are in [e2e/README.md](e2e/README.md).

## Setup

- Node **24.21.0** (`.nvmrc`; `package.json` `engines` allows `>=24.21 <25`) and npm 11.
- `npm ci` — always `ci`, so the lockfile is what gets installed.
- `npm run dev` starts the dev server on port 3000. It reads `.env`, which points at the shared
  API (`https://api.avarshai.com/api/v1`) with **real data**. For anything that writes, use the
  local e2e stack instead (`npx vite --mode e2e`, see e2e/README.md).
- The API is the sibling repository `erp-purchase` (Spring Boot, Gradle `./gradlew`, JDK 25).

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server (port 3000, `.env`) |
| `npm run dev:e2e` | Vite dev server in e2e mode (`.env.e2e`: local API on 8088) |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve `dist/` |
| `npm run lint` | ESLint, `--max-warnings 76`; only new violations fail |
| `npm run lint:prune` | Drop suppressions for violations you fixed (commit the result) |
| `npm test` / `test:watch` / `test:coverage` | Vitest unit tests |
| `npm run test:e2e:<project>` | One Playwright project; set `E2E_BASE_URL` first (e2e/README.md) |

## Where work lands

- **Everything lands on `dev`.** There are no feature branches; `main` is stale and is not a
  merge target. Push only small, finished commits, after `git pull --rebase`.
- **Releases** are cut from `dev` by the owner as `avarsh/release/v<ver>_R<yyyy-mm-dd>`
  (RELEASING.md). A hotfix is a new release branch, and the same fix lands on `dev`.
- **A red CI on `dev` is fixed or reverted the same day, by its author**, before anyone else
  rebases onto it.
- `ci.yml` lints, runs the unit tests, builds and audits every push to `dev` and to release
  branches. `e2e.yml` runs the smoke project on every push to `dev` and the full suite nightly.

## Lanes and integration (the 2026-10 programme)

While the production-readiness programme runs, several lanes (people or Claude sessions) work at
once:

- Each lane works in its own clone or git worktree, on a branch made from the current
  integration tip, and commits locally.
- **Every shared file has one owner per phase** (see the plan's lane table). Another lane does
  not edit it; it asks the owner for the exact change.
- The coordinator merges the lanes' commits into the local integration branch `phase1`, checks
  it (`npm run lint`, `npm test`, `npm run build`, the affected specs), and pushes to `dev` when
  the owner says so.
- A lane rebases onto the integration tip before starting each batch, and reports what it did,
  what it verified, every visible change, and what it needs from other lanes.
- `eslint-suppressions.json` is regenerated, never merged by hand: after merging, run
  `npx eslint . --suppress-rule <rule>` for the rules involved, then `npm run lint:prune`.

## Commits

- One logical change per commit, staged with **explicit paths** (other work may be in the tree).
- Subject `Area: outcome sentence` — what is now true for the user or the developer, e.g.
  `Lists: master rows keep their place after an edit`.
- The body says why, what changed, **every user-visible or behavioural change** (or that there is
  none), and what was run to verify it.
- Commits written with Claude Code end with its `Co-Authored-By` line.
- Do not amend or rewrite commits that are already pushed.

## UX parity

Nothing may break, and nothing may change today's look or behaviour unless the change you are
making calls for it. Prove it — a build compared file by file, before/after screenshots, or the
affected spec run before and after — and name every visible change in the commit. The full
rule, and why it exists, is at the top of ui-standards.md.

## Testing: run what your change touches

- `npx eslint <changed files>`, then `npm run lint` before pushing. A fixed suppressed violation
  needs `npm run lint:prune` in the same commit, or CI fails on the stale suppression.
- `npm test` when you change logic that has unit tests, and add a test when you change pure
  business logic (rule 42).
- `npm run build` when you add, remove or rename files or change exports.
- The Playwright spec files of the screens you changed, on the local e2e stack
  (e2e/README.md). Whole projects and the full suite run in CI, or when they are asked for.
- A failure in a spec you did not touch: check the known failures in e2e/README.md, report it,
  and do not chase it unless asked.

## Windows notes

- Do not edit source files with PowerShell `Get-Content | Set-Content`: Windows PowerShell 5.1
  re-encodes them and corrupts UTF-8 punctuation. Use an editor.
- `git add` with the wrong filename case stages nothing on Windows; check `git status`.
- The repository stores LF; `.editorconfig` keeps editors on 2 spaces, LF and UTF-8.
