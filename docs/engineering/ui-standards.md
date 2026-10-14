# UI standard — avarsh-erp-ui

The rules every change to this UI follows. It is Appendix A of the UI production-readiness plan
(approved by the owner on 2026-10-12), with the browser and device matrix and the owner's
UX-parity rule. A change that breaks a rule is fixed or reverted, and a rule that turns out to be
wrong is changed here, in its own commit, rather than ignored.

Measurements against these rules are in [quality-scorecard.md](quality-scorecard.md); the code
review against them is in [ui-review-2026-10.md](ui-review-2026-10.md).

## The UX-parity rule (owner)

**Nothing may break, and nothing may change today's look or behaviour unless the change you are
making explicitly calls for it.** Prove parity; never assume it. Every user-visible or
behavioural change a commit makes is named in its message.

Why it is written down: four "harmless" changes broke parity during the 2026-10 gate. An escaping
helper turned newlines into `<br/>` in prints; a service-worker strategy change removed offline
viewing; a localStorage wipe deleted users' preview data; and a client-side sort overrode an
API's deliberate `ORDER BY`. The usual proofs are a build compared file by file, a before/after
screenshot, or the affected spec run before and after.

## Browsers and devices

| Target | Status |
|---|---|
| Desktop, 1280 px and wider (including 1366 × 768) | Supported. Chromium browsers (Chrome, Edge) are what the team uses and what Playwright runs. |
| Tablet, 768–1279 px, both orientations, touch | Supported. Playwright tablet projects (810 × 1080 and 1180 × 820) arrive with WS14. Whether the factory tablets are iPads (WebKit) or Android (Chromium) is owner action 7; an iPad project is added if they are. |
| Installed PWA (standalone and window-controls-overlay) | Supported; checked on a real install when WS14 closes. |
| Phones | Best effort: nothing may break, but no phone-specific layouts. |
| Other browsers (Firefox, Safari on macOS) | Not tested. Nothing may break. |

Breakpoints are antd's: 576 / 768 / 992 / 1200 / 1600 (rule 19).

## How a rule is enforced

| Tag | Means | Where |
|---|---|---|
| [lint] | an ESLint rule; only new violations fail, existing ones are recorded in `eslint-suppressions.json` | `eslint.config.js`, `npm run lint` |
| [style] | a stylelint rule (WS15, not yet in place) | — |
| [ci] | a pipeline gate | `.github/workflows/ci.yml`, `e2e.yml` |
| [e2e] | a Playwright fixture or project | `e2e/fixtures.js`, `playwright.config.js` |
| [build] | enforced when the bundle is built | `vite.config.js` |
| [review] | the pull request checklist | `.github/pull_request_template.md` |

Review-only rules are turned into one of the others wherever possible.

## Reliability

1. Every async action has loading, error and empty states. Anything the user waits on spins and
   is disabled while it runs (`useBusyAction`, `usePaintedWork`). [review, e2e]
2. There is one error path. The axios interceptor toasts server errors, and screens never call
   `message.error` in a `catch` for an axios failure (`toastUnlessHandled` / `errorText`).
   - Popups: transient → `message`; blocking → a modal; validation → inline.
   - User text is mapped from the API's error codes; an unexpected error shows its `traceId`.
   [ci grep gate, review]
3. Error boundaries are keyed by route; an outer boundary covers the providers, the layout and
   `/login`. Errors go to Sentry, and a chunk-load failure offers a reload. [build]
4. Fetches can be cancelled, and a stale response never wins (`useServerList`, `useRecord`).
   [review]
5. A save decides create-vs-update from the record in hand, never from `useParams().id`, and
   adopts the saved `version`. [review]
6. **A refresh never reorders rows already on screen.**
   - Every list has a deterministic order: its defined order (sort order, name, date), then the
     immutable `id` as the final tie-breaker. Plain registers default to `id` (masters ascending,
     documents descending).
   - After a save, the list reloads with the same page, sort and filters, replacing the edited
     row in place.
   - Returning from a form restores the list state from the URL. [e2e, API reflection test]
7. Hooks and React patterns:
   - Row keys come from a monotonic counter.
   - Hooks come before any early return.
   - Every component that uses `message` or `modal` takes them from its own `App.useApp()`,
     never from the static APIs. [lint: `message`/`notification` imports from antd are banned]
8. Forms with unsaved input use `useUnsavedChanges`. [review]
9. "Today" and date-only values come from `dayjs()` in local time, never
   `toISOString().slice(0, 10)`. Numbers and money go through `utils/formatters.js` (en-IN).
   [lint: both patterns, and a `toLocale*String()` without a locale, are banned]
10. Browser-only screens carry a "Preview" tag until their API cutover. Keyboard shortcuts act on
    the topmost dialog. [build, review]
11. Never remove an API path a deployed bundle still calls; a UI rollback must work against the
    current API; the UI and the API are released as a pair, API first. [review]

## Performance

12. Every route is lazy-loaded; print generators and heavy libraries are imported dynamically.
    [ci budget]
13. Context values are memoized; a store change re-renders only that key's consumers. [review]
14. `columns` in `useMemo`, handlers passed down in `useCallback`, statics outside components,
    no inline style objects in `.map` or cell renders. [lint, review]
15. Transactional lists page on the server (`useServerList`); masters load through the store's
    single fetch-or-reuse path. [ci grep gate, review]
16. Search is debounced by at least 300 ms; independent requests run in parallel. [review]
17. Budgets ratchet: initial JS ≤ 450 KB gzip, route chunk ≤ 200 KB gzip, precache ≤ 3 MB.
    At p75: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1. [ci, Sentry]

## Responsiveness (desktop + tablet + installed PWA; phones best effort)

18. Supported layouts are the matrix above. On phones nothing may break. [e2e projects]
19. One breakpoint scale, antd's (576/768/992/1200/1600), in JS (`useResponsive` on
    `Grid.useBreakpoint`) and in CSS. [style, review]
20. No page-level horizontal scroll at 768 px or wider. Every Table sets `scroll.x`, and wide line
    grids freeze their identifying columns. [e2e]
21. Form grids use responsive `Col` props, never a bare narrow `span`. [lint, planned]
22. Touch: targets ≥ 40 px on coarse pointers; menus open on click; no auto-focus on route
    change; sticky offsets from `--header-height`. [style, review]

## Styling (CSS)

23. One palette, from the `ThemeContext.jsx` tokens. No hex or rgb literals outside the tokens
    file; print CSS, garment colour data and the 3D scene are exempt. [style, lint]
24. antd is styled through theme and component tokens and the semantic `styles` prop. `.ant-*`
    and `!important` are allowed only in `styles/antd-overrides.css`; no code queries `.ant-*`.
    [style; lint: `querySelector`/`closest`/`matches` on an `.ant-*` class is banned]
25. Repeated inline styles become utility classes or shared components; inline `style` is only
    for runtime values. [review, jscpd]
26. Component styles are CSS modules. Global CSS is tokens, base, layout, utilities,
    antd-overrides and pwa only. No dead or duplicate rules. [style, review]

## Maintainability

27. Layout and naming follow `.claude/skills/erp-dev/references/codebase-map.md`. Status colours
    live only in `statusConfig.js`; enum mirrors live in `<module>Constants.js`. [review]
28. Reuse before writing: `StatusTag`, `DeleteConfirm`, `ViewDialog` / `DocumentHero` /
    `DetailCard` / `FactSheet`, `MasterSplitView`, `StickyActionBar`, `SizeColorMatrix`,
    `useServerList`, `formatters.js`, `printDoc.js`. [ci jscpd]
29. ES2022+: `const`/`let`, `===` (`== null` allowed), `async`/`await`, optional chaining.
    Prettier formats. [lint: `eqeqeq` smart, `no-var`, `prefer-const`; format]
30. No `console.*` outside `utils/logger.js`. [lint: `no-console` in `src/`]
31. Zero deprecated antd or React APIs. The list is re-derived from the runtime on each antd
    upgrade (`.claude/skills/erp-dev/references/antd6-deprecations.md`) and checked on the dev
    server. [lint: one selector per deprecated antd API; e2e: the route sweep]
32. New files ≤ 400 lines; split a touched file that passes 800. [lint: `max-lines` 400 in `src/`,
    blank lines and comments not counted]
33. Accessibility: `name`/`id` on controls outside `Form.Item`, `id` forwarded by custom inputs,
    role/aria/keyboard on clickable non-buttons. [e2e DevTools issues]
34. A clean repository: no unused files, exports or dependencies, no dead UI, no committed build
    output, reports, binaries or tool state. [ci knip, review]
35. The lint ratchet: suppressions only shrink and are pruned in the fixing commit
    (`npm run lint:prune`); `--max-warnings` caps warnings. [ci]

## Security

36. `dangerouslySetInnerHTML` only via `sanitizeRichText`; no `eval` / `new Function`; print HTML
    only via `printDoc.js` `esc` / `escAttr`. [lint: raw HTML allowed only in
    `components/RichTextEditor.jsx`, `document.write` only in `utils/printDoc.js`, `no-eval`,
    `no-implied-eval`, `no-new-func`]
37. Nothing secret in `VITE_*`; no tokens or PII in logs or Sentry. Access token in memory,
    refresh token in an httpOnly cookie. [review]
38. No user- or branch-specific API data survives a session in the service worker or
    localStorage: transactional GETs are network-only, and caches and preview stores are cleared
    on logout, expiry and branch change. [review, e2e]
39. Headers: CSP with each site's real origins, frame-ancestors, Referrer-Policy,
    Permissions-Policy, nosniff, HSTS; iframes sandboxed. [ci header probe]
40. Zero high or critical advisories (shipped dependencies at a cut; all dependencies from
    Phase 1). Renovate weekly against `dev`; OSV on every push; `npm ls --all` clean. [ci]
41. Source maps hidden, uploaded to Sentry, deleted before deploy. [build]

## Testing

42. Pure business logic has Vitest tests, and a change to it needs a test. [ci: `npm test`]
43. Every route has a smoke check (loads, no page error, no overflow at tablet width); critical
    flows have regression specs. [ci: the `smoke` project on every push to dev]
44. Specs use the fixtures (`e2e/fixtures.js`), API-seeded unique data and role or label
    selectors. No `waitForTimeout`, empty `.catch`, copied helpers, production URL or password.
    [e2e: `e2e/config/env.js` refuses a remote server; lint on `e2e/` planned]
45. Locally, run only what a change touches; CI runs smoke on every push and the full suite
    nightly. [ci]

## Release

46. Version `MAJOR.MONTH.DAY` (MAJOR increases each January), shown as `v<ver> · <commit>`
    (plus `· dev` off production); Sentry release `<ver>+<commit>`. [build]
47. Release branches `avarsh/release/v<ver>_R<yyyy-mm-dd>` are cut from `dev` after a version
    commit, and CI checks name ↔ version. A hotfix is a new release branch, cut from the one it
    fixes. Each release gets a draft GitHub release with a changelog. [ci] See `RELEASING.md`.
48. Each site's build takes its API and environment from its own settings, never from the
    committed `.env`. The production smoke and the recorded rollback deploy id are part of every
    release. [review, ci]

## Data structures and design patterns (measure before changing)

49. Lookups in render paths: a `Map`/`Set` by id via `useMemo`; never `.find` / `.filter` /
    `.includes` per row over growing arrays. [review, profiler]
50. Editable grids: normalized rows (by id plus an order array), one-row immutable updates, no
    per-keystroke deep clones, `React.memo` rows, `virtual` above about 200 rows.
    [review, profiler]
51. Complex state: `useReducer` with pure, tested reducers; derived values from memoized
    selectors, never stored; above 50 ms → incremental, or a Worker. [review, Vitest]
52. Patterns:
    - **Use:** a container hook plus presentational components; service adapters (`toPage()`);
      strategy maps for calculators; compound components for shared views; an observer store
      (`useSyncExternalStore`); command endpoints for status moves.
    - **Avoid:** new global-state libraries, HOC chains, memoization without a Profiler reading.
    [review]
53. Interaction budgets: a grid keystroke ≤ 50 ms to commit; adding a line or recalculating
    totals ≤ 100 ms, on realistic volumes (a 200-line BOM × 8 sizes). [e2e perf smoke]
