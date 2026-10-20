# Quality scorecard — avarsh-erp-ui

The measures behind [ui-standards.md](ui-standards.md). The baseline is Appendix B of the UI
production-readiness plan (measured read-only on 2026-10-12). Each release re-measures what it
can with the same command and adds a column; a number only moves when it is measured again.

Columns: **Baseline** = 2026-10-12. **Now** = re-measured on 2026-10-14 on the integration
branch `phase1` (`5f00bc4`); "—" means not re-measured yet. **Target** = the workstream's "done
when".

## Confirmed bugs (baseline)

| # | Bug | Status on 2026-10-14 |
|---|---|---|
| 1 | Crash: `ProcessAllowanceModal` used `calcMatrixTotal` without importing it | Fixed in the 10-15 gate (e1be641) |
| 2 | Session hang: a failed token refresh left every later request waiting | Fixed in the gate (dfac9de) |
| 3 | Stored XSS in the PO and order print windows | Fixed in the gate (5e4ff0b, 1bc1508); costing print fixed in Phase 1 (U076) |
| 4 | Stored XSS in the T&C rich text (PO print, viewer) | Fixed in the gate (`sanitizeRichText`) |
| 5 | Cross-user API cache in the service worker | Fixed in the gate (733fd8f, 248224b) |
| 6 | Wrong date before 05:30 IST (`toISOString().slice(0, 10)`); 68 `toLocaleString()` without a locale | Locale calls: 0 left. Date slices: 2 left (`inventoryService.js:1125`; `tnaCalendar.js:16`, a deliberate UTC day number), both lint-suppressed |
| 7 | Smaller: BOM list paging, dead header search, Ctrl+S behind a dialog, `useIsPwa` listener leak, antd-5 classes | Paging and search fixed in the gate; the rest are in the review register |

## Lint ratchet (rule 35)

`npm run lint` = `eslint . --max-warnings 76`. Only new violations fail; the ones that existed
when a rule arrived are recorded in `eslint-suppressions.json` and must only shrink.

| Measure | Baseline | Now | Target |
|---|---|---|---|
| Errors (unsuppressed) | 0 | 0 | 0 |
| Warnings (all `react-hooks/exhaustive-deps`) | 76 | 76 | 0 (WS6) |
| `eslint-disable` comments in `src/` | 81 | 82 | 0 |
| Suppressed `no-restricted-syntax` (raw HTML, `document.write`, date and locale patterns, `.ant-*` queries, deprecated antd APIs) | 352 (added 2026-10-12) | 280 | 0 |
| — of which deprecated antd APIs (`Descriptions.Item` 250, Timeline items 4) | 254 | — | 0 (WS2e, WS8) |
| — of which `document.write` outside `printDoc.js` | 11 | 11 | 0 (WS2d) |
| — of which `.ant-*` DOM queries | 13 | 12 lines by text search | 0 (WS15) |
| Suppressed `no-console` | 93 | 93 | 0 (WS11 logger) |
| Suppressed `max-lines` (files over 400 lines) | 58 | 58 | only shrinks |
| Suppressed `prefer-const` | 4 | 3 | 0 |
| Suppressed react-hooks / react-refresh rules | 55 | 55 | 0 (WS6) |
| `eqeqeq`, `no-var`, `no-eval`, `no-implied-eval`, `no-new-func`, static `message`/`notification` imports | 0 | 0 | 0 |

## Code review (WS1)

Register: [ui-review-2026-10.md](ui-review-2026-10.md) and `.json`.

| Measure | Now | Target |
|---|---|---|
| Findings recorded | 371 | the register covers every module |
| P0 / P1 / P2 / P3 | 9 / 77 / 174 / 111 | 0 open P0 or P1 before go-live |

## Size and structure

| Measure | Baseline | Now | Target |
|---|---|---|---|
| Files / lines | 1,477 / 193,904 (as measured for the plan) | 1,509 / 198,721 (`src/` JS and JSX) | — |
| Files over 2,000 lines | 5 | 5 | split when touched (rule 32) |
| Files over 800 lines | — | 20 | only shrinks |
| `useEffect` / `AbortController` | 662 / 3 | 662 / 3 | cancellable fetches (WS7) |

## CSS (WS15)

| Measure | Baseline | Now | Target |
|---|---|---|---|
| Global sheets / lines | 8 / 5,722 | 7 / 5,696 | tokens, base, layout, utilities, overrides, pwa only |
| `!important` | 732 | 733 | only in `antd-overrides.css` |
| Inline `style={{` vs `className=` in JSX | 6,148 vs 488 | 6,151 vs 489 | inline style for runtime values only |
| Hard-coded colours (component + CSS) | 981 + 402 | — | 0 outside the tokens |

## End-to-end tests (WS4)

| Measure | Baseline | Now | Target |
|---|---|---|---|
| Playwright tests / files (main config) | 1,049 / 141 | 919 / 126 (unit and T&A-engine tests moved to Vitest; demos to `playwright.demo.config.js`) | — |
| Smoke on every push to dev | none | `smoke` project in `e2e.yml` (needs the `REPO_TOKEN` secret) | ≤ 15 min, laptop + tablet |
| `waitForTimeout` in `e2e/` | 316 | 316 | 0 (WS4b) |
| `.ant-` selectors in `e2e/` | 1,339 | 1,341 | behind helpers (WS4b) |
| Serial files | 43 | 45 | self-contained (WS4b) |
| Known failures on a clean `dev` | 6 + stale blocks | 4 (see `e2e/README.md`) | 0 |

## Pipeline

| Gate | Baseline | Now |
|---|---|---|
| Lint, unit tests, build, audit on every push to `dev` and release branches | none | `ci.yml` |
| e2e smoke on push, full suite nightly | `e2e.yml` broken | rewritten; first runs pending the secret |
| Release mechanics | none | `ci.yml` release job and `RELEASING.md` |

## Not re-measured yet

Bundle size and precache (main 948 KB gzip, precache 6.4 MB at baseline), web vitals, list-order
coverage (33 list endpoints without `ORDER BY`), responsiveness defects, duplication (jscpd),
`npm audit` totals. Each is re-measured by the workstream that changes it.
