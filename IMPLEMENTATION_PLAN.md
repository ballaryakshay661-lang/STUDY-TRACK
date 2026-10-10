# StudyTrack Implementation Plan

**Status:** Proposed after Phase 1 inspection
**Scope:** Prioritized follow-up work; no implementation is included in this
plan.

## Phase 1 — Audit (complete)

- Inspect the existing project, architecture, source, current runtime, and
  verification limits.
- Record findings in `PROJECT_AUDIT.md`.
- Preserve existing app behavior and unrelated worktree changes.

## Phase 2 — Runtime and deployment baseline

1. Configure a valid local MongoDB connection and a strong, private
   `JWT_SECRET` in `backend/.env`; do not copy real values into Git or
   frontend files.
2. Restart the API and confirm `/api/health` reports database connectivity.
3. Confirm both configured frontend origins work with credentialed CORS and
   cookie behavior; document the chosen local and production origins.
4. Separate the frontend API URL into a clear deployment-time setting while
   keeping it public and secret-free.
5. Add a repeatable start/test workflow where useful without introducing a
   framework or unnecessary dependencies.

**Acceptance checks:** clean API restart, successful DB ping, correct
connected/degraded health status, exact-origin preflight, and repeatable
frontend/API startup.

## Phase 3 — Server-persisted planner APIs

1. Confirm the assignment and focus-session fields/retention expectations
   before schema work.
2. Add Mongoose models with required validation, indexes, timestamps, and
   ownership references.
3. Add authenticated REST APIs for assignment and focus-session CRUD.
4. Derive record ownership exclusively from verified authentication
   middleware; never accept an owner/user ID from the browser as authority.
5. Enforce ownership in each query and mutation. Return the repository's
   standard not-found/authorization response for records owned by another
   user.
6. Add pagination and validated filtering/sorting for list endpoints.
7. Add database-backed tests for CRUD, persistence, ownership isolation, and
   invalid inputs. Use an isolated test database and cleanup strategy.

**Acceptance checks:** separate users cannot read or mutate each other's
records; API data survives browser refresh and backend restart; pagination and
filters are validated and tested.

## Phase 4 — Frontend API integration

1. Replace planner localStorage reads/writes with the authenticated APIs.
2. Preserve current layout, assignment workflow, study plan, charts, timer, and
   responsive behavior.
3. Add loading, empty, validation, and retryable API-error states to planner
   operations.
4. Retain existing browser planner data until a migration/backup strategy is
   explicitly chosen; do not silently discard local data.
5. Keep auth cookies HttpOnly; do not copy authentication tokens to
   localStorage.

**Acceptance checks:** CRUD from the UI uses the API; refresh reloads database
state; failure states preserve user input and explain the next action.

## Phase 5 — UX/accessibility and public metadata

1. Review the `href="#"` brand interaction and implement an intentional
   home/top-of-page behavior.
2. Review keyboard navigation, labels, error announcements, visible focus,
   contrast, chart alternatives, and reduced-motion behavior.
3. Confirm layouts at representative desktop, tablet, and mobile viewport
   widths.
4. Keep optional search, sort, or theme work tied to user value and the actual
   planner/API scope rather than adding unrelated controls.
5. Review title, description, canonical/deployment metadata, and external
   Chart.js availability for the actual hosting setup.

**Acceptance checks:** browser interaction checks for all important buttons,
keyboard-only form/planner use, responsive layout checks, and no unexpected
console/page errors.

## Phase 6 — Security and release verification

1. Verify registration creates a normalized MongoDB user with a bcrypt hash
   and never returns a password or token.
2. Exercise duplicate registration, invalid credentials, rate limits,
   missing/expired cookies, logout, CSRF origin checks, and CORS denials.
3. Verify cookie expiry and `HttpOnly`, `SameSite`, and production `Secure`
   behavior over HTTPS.
4. Verify all planner APIs reject unauthenticated requests and isolate
   ownership, including guessed/foreign IDs.
5. Run backend tests, syntax/build checks, browser regression checks, DB
   restart-persistence checks, and the production build/deployment smoke test.
6. Update README and `.env.example` with tested deployment instructions and
   document anything still blocked.

**Acceptance checks:** release report names exact commands and outcomes; no
unverified database, privacy, persistence, or production claims.

## Open decisions before database/API implementation

- Which MongoDB deployment/instance should local development use?
- Should the app support assignments only, or focus-session records through
  the API as well?
- What pagination limits, retention rules, and account deletion behavior are
  expected?
- Should existing browser-local planner data be imported into a user's account?
  If so, how should ownership of already-shared legacy browser data be decided?
- What exact production frontend and API origins will be deployed?
