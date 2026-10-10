# StudyTrack Project Audit

**Audit scope:** Phase 1 inspection only
**Audit date:** 2026-10-10
**Working directory:** `STUDY TRACK`

## Executive summary

StudyTrack is a static, single-page assignment planner built with HTML, CSS,
and browser JavaScript. A separate Node.js/Express API uses Mongoose and
MongoDB for user authentication. The frontend retains assignments and focus
sessions in account-namespaced `localStorage`; there are no assignment or
focus-session APIs, so those records are not stored in MongoDB and cannot
sync across browsers or devices.

Authentication includes registration, login, logout, a cookie-authenticated
current-user endpoint, origin checks, rate limiting, and a gated planner UI.
The API health endpoint in the current source reports database availability.
The local MongoDB URI is not configured in the inspected environment, so
database-backed authentication and persistence could not be verified.

## Architecture observed

### Frontend

- Static HTML entry point: `index.html`.
- Styles: `css/style.css`, with responsive breakpoints for desktop and smaller
  screens.
- Planner logic: `js/app.js`.
- Authentication/session UI: `js/auth.js`.
- No frontend framework, package manifest, bundler, router, or frontend test
  runner is present.
- Chart.js 4.5.1 is loaded from jsDelivr; charts degrade to explanatory text if
  the library is unavailable.
- The browser calls the API URL configured in the public
  `studytrack-api-base` meta tag (`http://localhost:5000` by default).
- Assignments and focus sessions are stored in account-specific browser
  `localStorage` keys. Pre-authentication keys are migrated to the first
  account that claims the browser data; browser-local data is not a
  server-enforced security boundary.

### Backend

- Node.js 20+ CommonJS application in `backend/`, using Express 5.
- MongoDB access uses Mongoose; authentication uses bcrypt and signed JWTs.
- Source is arranged into routes, controllers, middleware, models, config, and
  utility modules.
- Existing endpoints:
  - `GET /api/health`
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `GET /api/auth/me`
  - `POST /api/auth/logout`
- Auth uses a short-lived HttpOnly, SameSite=Lax cookie, exact-origin checks on
  state-changing auth requests, credentialed CORS, request limits, and
  authentication middleware for `/api/auth/me`.
- API error handling returns generic messages for unexpected server errors.
- No assignment/focus-session models or API routes exist. There is no
  password-recovery flow.
- Configuration examples are in `backend/.env.example`; local values belong
  only in the ignored `backend/.env`.
- Backend package scripts include `dev`, `start`, and `test`. No build script
  is configured.

## Features present in source

- Create, edit, delete, complete, and filter assignments.
- Subject and priority filtering, deadline ordering, and a study-plan view.
- Focus/break timer with custom durations and local focus-session history.
- Summary statistics and completion, subject, and weekly charts.
- Signup/login modes, client validation, busy/error states, logout, `/me`
  session checks, refresh restoration, and client-side expiry locking.
- Planner UI is hidden/inert until the authentication API confirms a session.
- Existing form labels, keyboard focus outlines, live messages, reduced-motion
  CSS, and mobile layout rules.

## Findings and risks

### High priority

1. **MongoDB is unconfigured in this environment.** A non-secret config check
   found `MONGODB_URI` missing. It also found `JWT_SECRET` missing in the
   loaded environment. The `.env.example` contains placeholders, not usable
   credentials. No MongoDB connection, real account insertion, or database
   restart-persistence check could be performed.
2. **Planner data is not protected or persisted by the server.** Per-account
   localStorage keys reduce accidental cross-account display in the UI, but
   users control browser storage. A user can alter client state, and local
   records are not backed by MongoDB or protected by API ownership checks.
   This is not equivalent to server-side authorization for private records.
3. **A fresh browser sign-in emits an expected 401 console error.** The session
   bootstrap calls `/api/auth/me`; an unauthenticated session receives 401.
   The page showed no uncaught JavaScript errors, but the browser console
   reports the normal signed-out response as an HTTP error. Consider handling
   this expected status without a console error if a clean console is required.
4. **The current process may not run the current source.** The already-running
   API returned HTTP 200 from health even though a separate smoke test against
   the inspected source, with no database connection, returned 503. Restart
   the API after configuring MongoDB and confirm the database field in the
   health response.
5. **Frontend endpoint configuration is a development default.** The API URL
   defaults to HTTP localhost. Deployment requires configuring a same-site
   HTTPS API URL and exact production frontend origin; serving the page over
   HTTPS while retaining the HTTP API URL will be blocked as mixed content.

### Medium priority

6. **No planner REST API exists.** There is no database-backed assignment CRUD,
   pagination, server filtering, or multi-device persistence.
7. **No search or explicit sort controls exist.** Existing filters cover
   status, subject, and priority; recommendations are internally ordered by
   deadline/priority.
8. **No automated frontend/browser test suite is configured.** Browser checks
   have been performed interactively, but they are not repeatable repository
   tests.
9. **Data migration is browser-local and first-account-only.** Legacy
   pre-authentication planner keys are claimed by the first authenticated
   account on that origin/browser. This migration cannot establish the
   original data owner.
10. **Backend folder is untracked in the current Git status.** Preserve and
    inspect repository/worktree state before any staging or commit. The audit
    does not assume untracked files are safe to overwrite.

### Lower priority

11. **The brand link uses `href="#"`.** It does not navigate to a distinct
    route and may jump the page to the top; the application has no router.
12. **No dark/light theme toggle is present.** Dark mode is described as a
    possible future enhancement in the README.
13. **External chart delivery is a runtime dependency.** Chart.js is pinned to
    version 4.5.1 and the UI has an unavailable-chart fallback, but an offline
    browser will not get chart visualizations.
14. **No asset directory or image assets were found.** The existing visual
    identity is implemented with CSS and inline text symbols.

## Verification actually performed

- Inspected the root, frontend, backend source, package configuration,
  environment-variable names, README, and test files. Did not print or record
  secret values.
- Confirmed the project is static HTML/CSS/JS and Express/Mongoose, not a
  frontend framework application.
- `npm.cmd test` from `backend/`: **6 tests passed, 0 failed**. The test suite
  mocks Mongoose/user methods; it does **not** verify a real database
  connection or writes.
- `node --check` was run on frontend and backend JavaScript files: passed.
- `git diff --check`: passed.
- Browser at `http://localhost:5500/`: sign-in page rendered, no uncaught
  page errors, planner stayed hidden while signed out. The expected `/me` 401
  was present in the console.
- Browser tests used an in-memory API mock for registration, login, refresh,
  expiry, and logout. These do not verify real database-backed auth.
- Browser planner checks using a mock session verified add, edit, complete,
  filter, delete, timer start/pause/reset, refresh persistence, and
  account-scoped localStorage isolation between two mock users.
- At a 390px viewport, the tested planner fit without horizontal overflow.
- The already-running API answered `/api/health` with HTTP 200. Its running
  health response did not include the database status.
- A separate ephemeral server created from the inspected backend source
  returned HTTP 503 with database unavailable, responded to a configured
  credentialed CORS preflight with HTTP 204, and returned HTTP 401 for
  unauthenticated `/api/auth/me`.
- A live API smoke check returned HTTP 400 for malformed login input and HTTP
  403 for an untrusted registration origin.
- No real MongoDB check, real-user registration, MongoDB password-hash query,
  full browser run against a database, rate-limit exhaustion test, or
  persistence check across backend process restart was performed.

## Prioritized improvements

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for a sequenced plan.
The immediate next priority is configuring and verifying MongoDB, then
designing authenticated assignment/focus-session APIs with database-level
user ownership before claiming private-record isolation or cross-device
persistence.
