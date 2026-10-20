## What and why

<!-- What is now true for the user or the developer, and why it was needed. -->

## Visible changes

<!-- Every change a user could see or feel, or "None". Rule: nothing changes today's look or
     behaviour unless this change calls for it (docs/engineering/ui-standards.md). -->

## Verified

<!-- What you ran and the result: eslint on the changed files, npm run lint, npm test,
     npm run build, the affected Playwright specs, a before/after comparison. -->

## Checklist

- [ ] `npm run lint` passes; any suppression I fixed is pruned (`npm run lint:prune`)
- [ ] `npm test` passes; changed business logic has a unit test
- [ ] `npm run build` passes (when files were added, removed or renamed)
- [ ] The Playwright specs of the screens I changed pass on the local e2e stack
- [ ] Async actions have loading, error and empty states; nothing toasts an axios error twice
- [ ] Saves decide create-vs-update from the record in hand and adopt the saved version
- [ ] A refresh after a save does not reorder the rows on screen
- [ ] No deprecated antd props, no static `message`/`notification`, no `console.*`
- [ ] Works at 1366 × 768 and at tablet width (768–1279 px), with no page-level horizontal scroll
- [ ] No API path a deployed bundle still calls is removed; the paired API change is released first
- [ ] No secret or PII in `VITE_*`, logs or Sentry
