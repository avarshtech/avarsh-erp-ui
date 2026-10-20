# avarsh-erp-ui

The web front end of Avarsh ERP, a manufacturing ERP for garment exporters: orders, costing,
BOM, purchase and job-work orders, inventory (GRN, QC, issues, adjustments, bill passing),
production (cutting, sewing, finishing), sample requests, export documents, T&A, HR and payroll,
reports, approvals and administration. It is installable as a PWA.

The API is the sibling repository **erp-purchase** (Spring Boot, PostgreSQL, Flyway).

## Stack

React 19, Vite 7, Ant Design 6, React Router 7, axios, dayjs; plain JavaScript (no TypeScript);
a service worker through vite-plugin-pwa (`src/sw.js`); Sentry when a site configures a DSN;
Vitest for unit tests and Playwright for end-to-end tests.

## Quick start

```bash
nvm use          # Node 24.21.0, from .nvmrc
npm ci
npm run dev      # http://localhost:3000
```

`npm run dev` reads `.env`, which points at the shared development API, with real data. To work
against a local, throwaway API, run the e2e stack instead: [e2e/README.md](e2e/README.md).

| Command | |
|---|---|
| `npm run lint` | ESLint; only new violations fail |
| `npm test` | Vitest unit tests |
| `npm run build` | Production build into `dist/` |
| `npx playwright test <spec> --project=<project>` | End-to-end tests, against the local e2e stack |

## Layout

```
src/
  pages/<module>/        screens, one folder per module (orders, bom, costing, po, inventory, ...)
  services/<module>/     API calls and adapters; services/core/axiosInstance.js holds the
                         interceptors (auth, token refresh, conflicts, errors)
  components/            shared components (StatusTag, FactSheet, StickyActionBar, ...)
  context/ hooks/ utils/ the store, session, branch and theme contexts; shared hooks;
                         formatters, permissions (SCREENS), print helpers
  layout/                the app shell (MainLayout)
  observability/         Sentry, off unless a site sets VITE_SENTRY_DSN
  sw.js                  the service worker
e2e/                     Playwright specs, fixtures and helpers (e2e/README.md)
docs/engineering/        the UI standard, the quality scorecard and the code review register
```

## Documentation

- [docs/engineering/ui-standards.md](docs/engineering/ui-standards.md): the rules the code
  follows, and the UX-parity rule.
- [docs/engineering/quality-scorecard.md](docs/engineering/quality-scorecard.md): how the code
  measures against them.
- [CONTRIBUTING.md](CONTRIBUTING.md): setup, scripts, where work lands, commits, testing.
- [RELEASING.md](RELEASING.md): versions, release branches, hotfixes, per-site environment,
  release-day smoke and rollback.
- [e2e/README.md](e2e/README.md): running the end-to-end tests safely, and the CI pipeline.

## Deployment

Netlify builds each site from its own branch and environment variables (RELEASING.md §5); the
committed `.env` is for local development only. The version shown in the app is
`v<MAJOR.MONTH.DAY> · <commit>`.
