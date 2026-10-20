# Releasing avarsh-erp-ui

Every change lands on `dev`. Netlify builds `dev` to `app-dev.avarshai.com` on every push. A release is a branch cut from `dev`. The target Netlify site (the QA site now, production from go-live) is switched to that branch.

## 1. Version numbers

- The version is `MAJOR.MONTH.DAY` of the release date, with no leading zeros. For example, 15 October 2026 is `1.10.15`.
- MAJOR goes up by one every January, so versions keep rising: the first 2027 release is `2.1.x`. *(The owner still has to confirm this rule.)*
- A version has no build number, so the scheme allows one release per calendar day. A second release on the same day is an open question for the owner (see section 4).
- The app shows the version as `v1.10.15 · <commit>` in the user menu and on the login page. Every site except production adds the environment: `· dev`, `· qa`.
- Sentry reports the release as `<version>+<commit>`, for example `1.10.15+e1be641`.

## 2. Cutting a release

1. Make sure `dev` is up to date and its last CI run is green.
2. Set the version on `dev` and commit only that:
   ```
   npm version 1.10.29 --no-git-tag-version
   git add package.json package-lock.json
   git commit -m "Release 1.10.29"
   git push origin dev
   ```
3. Create the release branch from that commit. The name is `avarsh/release/v<version>_R<yyyy-mm-dd>`:
   ```
   git push origin HEAD:refs/heads/avarsh/release/v1.10.29_R2026-10-29
   ```
4. CI runs on the release branch.
   - `scripts/check-release-branch.mjs` fails the run unless the branch's version equals `package.json`'s, and its month and day match the date in the name.
   - Then lint, the unit tests, the build and the audit run.
   - The `release` job then:
     - tags the commit `v1.10.29`;
     - drafts the GitHub release `v1.10.29`, with the build as a zip and a changelog of the commit subjects since the previous release tag.
   - Nothing is deployed by CI.
5. **API first.** Deploy the matching erp-purchase build to the target site's API before the UI. A UI must never call an API path its API does not have yet.
6. **Record the rollback point:** the target site's current deploy id (section 7).
7. Switch the target Netlify site to the new branch: Site configuration → Build & deploy → Branches and deploy contexts → Production branch. Then trigger a deploy.
8. Run the release-day smoke (section 6) on the site.
9. Review the draft release's notes on GitHub and publish them once the release is accepted: QA sign-off for a test release, or the go-live check for production.

One-time step: the 10-15 test release was cut before the `release` job existed. Tag its release commit as `v1.10.15`, so the next changelog starts there:
```
git tag v1.10.15 origin/avarsh/release/v1.10.15_R2026-10-15
git push origin v1.10.15
```
Until any `v*` tag exists, the draft lists the last 50 commits instead.

## 3. Rules for release branches

- Never commit to a release branch except through the hotfix flow (section 4).
- A push to a release branch whose draft is not yet published moves the tag and refreshes the draft.
- Once the release is published, its tag and notes are never changed. The `release` job fails rather than rewrite it.

## 4. Hotfixes

A fix for a release that is already out:

1. Cut a new branch from the release it fixes, named and versioned for the day of the hotfix:
   ```
   git switch -c avarsh/release/v1.10.17_R2026-10-17 origin/avarsh/release/v1.10.15_R2026-10-15
   ```
2. Commit the fix there (or cherry-pick it from `dev`). Then `npm version 1.10.17 --no-git-tag-version` and commit "Release 1.10.17".
3. Push the branch. CI checks it and drafts `v1.10.17`. Its changelog is just the fix and the version commit, because it starts from `v1.10.15`.
4. Deploy it as in section 2, steps 5–9.
5. Make sure the same fix is on `dev` (cherry-pick it). Do not cherry-pick the version commit: `dev` keeps its own version until the next cut.

**Open, for the owner:** a second release on the same day would need the same version. Today the only option is to ship it the next day, under that day's version.

## 5. Environment variables, per Netlify site

Each site builds from its own environment, never from the committed `.env`, which names the development API.

| Variable | dev site (`app-dev`) | QA site | production |
|---|---|---|---|
| `VITE_API_BASE_URL` | `https://api.avarshai.com/api/v1` | the QA API (`https://apiqa.avarshai.com/api/v1`, to confirm) | the production API (the API's prod profile names `sristi.avarshai.com`, to confirm) |
| `VITE_APP_ENV` | `development` | `qa` | `production` |
| `NODE_VERSION` | **unset** | **unset** | **unset** |
| `VITE_SENTRY_DSN` | unset | optional | the Sentry project's DSN |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | unset | optional | set (the token as a secret) |
| `NODE_OPTIONS` | unset | only with the token | `--max-old-space-size=4096` |

- **`NODE_VERSION` stays unset** so that Netlify reads `.nvmrc` (24.21.0), the same Node as CI. If it is set, it overrides `.nvmrc`.
- **`VITE_APP_ENV`:**
  - It is also the Sentry environment.
  - Only `production` hides the environment suffix next to the version.
  - Never use `e2e` on a site: that value switches Sentry off.
- **`VITE_SENTRY_DSN`:**
  - Without it, the build carries no Sentry code at all, and the app sends nothing anywhere.
  - A DSN is not a secret.
  - Nothing else in a `VITE_*` variable may be a secret, because every `VITE_*` value is compiled into the bundle that every visitor downloads.
- **`SENTRY_AUTH_TOKEN`:**
  - With it, the build makes hidden source maps and uploads them to Sentry for this release. It then deletes them, so no `.map` file is deployed.
  - Mapping this bundle needs about 4 GB of heap. Without `NODE_OPTIONS=--max-old-space-size=4096`, the build stops at once and says so.
  - Link the GitHub repository in Sentry so that each release lists its commits. Until then, the build logs a harmless error about it.
- **Other variables:** the Pantone, pincode and postal-code URLs keep the values in `.env.example` unless a site needs others.

## 6. Release-day smoke

Run this on the target site straight after publishing, in a fresh browser window. It is rehearsed at every test release and run for production at go-live.

1. **Version:** the login page and the user menu show the new `v<version> · <commit>`.
2. **Login:** sign in.
3. **Forced 401 refresh.** One API call is answered with 401, and the app must refresh the token and retry it.
   - With the Playwright MCP (run-code tool), before opening a list:
     ```js
     let forced = false;
     await page.route('**/api/v1/**', (route) => {
       if (!forced && !route.request().url().includes('/auth/')) { forced = true; return route.fulfill({ status: 401, body: '{}' }); }
       return route.continue();
     });
     ```
   - Then open any list. Expect one 401, one `POST /auth/refresh` (200) and the retried call (200). The list loads and no login screen appears.
   - Also reload the page once while signed in: you stay signed in, because the session is restored from the refresh cookie.
4. **One save in each core module:** an order, a BOM, a cost sheet, a supplier PO and a GRN.
5. **PO print:** print preview opens, with the layout unchanged.
6. **One upload,** for example an attachment on a cost sheet or a PO.
7. **Logout,** then in the DevTools console run `await caches.keys()`.
   - It must contain neither `erp-api-data` nor `erp-master-data`.
   - Only the `workbox-precache-…` cache of the app's own files remains.

## 7. Rollback

**Before publishing,** open Netlify → the site → Deploys. Note the id of the deploy that is published now (shown on its page and in its URL) and its commit, and keep them with the release notes.

**To roll back:**
1. Netlify → Deploys → open the recorded deploy → **Publish deploy**.
   - It is live at once, with no rebuild.
   - If more commits could reach the branch before the fix, use **Stop auto publishing**, so that a new build does not replace the rollback.
2. Users get the old build the way they get any build: at their next sign-in. An installed PWA shows its update prompt.
3. The API stays where it is. A UI rollback must work against the current API, which is why an API path is never removed while a deployed UI still calls it. Roll the API back only if the API itself is at fault, and after the UI.
4. Record what happened. The fix goes out as a hotfix release (section 4).
