# Community session recovery

## Diagnosis and behavior

Admin Community read queries and the local schema were healthy. A controlled reproduction of the shared API client demonstrated that simultaneous expired-access-token requests each rotated the refresh cookie separately. A rejected competing refresh then erased the token from the successful refresh. `AuthProvider` did not observe token clearing, so the administrator shell remained visible with authentication errors.

The API client now shares one refresh operation for concurrent requests and retries each original request at most once. A delayed 401 reuses the newer token. Session-generation checks reject responses belonging to an old sign-in and prevent pending login, account lookup, or refresh responses from restoring a logged-out account. Late renewal responses also cannot replace a newer token for the same session.

Browsers exposing Web Locks coordinate refresh-cookie rotation across tabs of the same frontend origin. Other browsers still receive per-tab request deduplication and stale-response protection; coordinated cross-tab rotation requires Web Locks. The backend conditionally rotates only the current, unrevoked, unexpired session of an eligible account, so concurrent rotations and revocation cannot overwrite each other.

Definitive refresh rejection (401/403) or a repeated protected-request 401 clears local authentication. Network failures, timeouts, rate limiting, and server errors propagate as retryable failures without clearing the session. Authentication and Community endpoints never return mock fallback results.

The account provider reloads verified identity on a genuine session change and clears protected state immediately on sign-out. A failed initial account lookup presents a retry state. Community requests wait for verified authentication; ordinary token renewal preserves filters and open confirmation notes. Existing membership transitions, moderator scope, and page layouts remain unchanged.

## Interfaces and rollout

No endpoint or database migration changes. `POST /api/v1/auth/refresh` retains its existing cookie and response contracts; a no-longer-current refresh cookie is rejected with 401 and no replacement cookie. Account-ineligibility checks remain in force.

Frontend context adds an authentication-restoration error for route guards. The shared client owns session-generation checks; authentication consumers use the existing session-change event. Refresh uses the existing 15-second request timeout.

Release the API and frontend together, and reload already-open frontend tabs to load the updated client. A browser already signed out by the previous bug needs one normal sign-in. Do not reset/reseed any application database or restore revoked sessions.

## Repeat verification

Run `npm --prefix frontend run test:session` for deterministic transport/concurrency regression tests. Run backend tests with `NODE_ENV=test`, `DATABASE_URL` pointing to migrated isolated MySQL, isolated `UPLOAD_STORAGE_PATH`, and external mail stubbed/disabled. `AUDIT_CAPTURE_CHECKS=1 npm --prefix backend test` also checks audit contracts.

Start an isolated API on port 5007 and frontend on 5179 with `VITE_API_BASE_URL=http://127.0.0.1:5007/api/v1`. Run `npm --prefix backend run test:community-session:browser` and `npm --prefix backend run test:member-status:browser`. Browser fixtures require a database name ending in `_test`, Playwright, and Chrome; optional overrides are `STATUS_API_URL`, `STATUS_WEB_URL`, `PLAYWRIGHT_MODULE_PATH`, `CHROME_PATH`, and `SESSION_SCREENSHOT_DIR`. Each runner removes its own fixtures.

Run root typechecks, lint and production builds. Screenshots and session-browser results default to `/private/tmp/ifsmhp-community-session-browser`.

## Actual verification — 24 September 2026

- **26 client regression tests passed:** shared refresh, delayed 401, recoverable network/429/500/503 errors, definitive rejection, bounded retry, sign-out/account-switch races, newer same-session tokens, and exclusion of authentication/Community mock fallback.
- **650 backend tests passed in all 25 suites**, with audit-contract checks enabled. Five new integration cases cover real password sign-in sessions, cookie reuse, revoked-session access/refresh, concurrent rotation, and revocation/account changes between session read and rotation.
- **9 session browser scenarios passed with no page errors:** all five Admin Community pages, real cookie renewal, saved filter/confirmation drafts, temporary refresh and initial-account-lookup failures, real interval polling, mobile reload, simultaneous expiry across two tabs, stale identity responses, sign-out during refresh, and real session revocation.
- **8 membership browser scenarios passed with no page errors:** both full restriction/restoration cycles, persistence after reload, confirmation cancellation, failed mutations, explicit conflict review, stale reads, filter/pagination reconciliation, and revocation. Existing page layouts were retained.
- Desktop (1440×1000) and mobile (390×844) screenshots were inspected. No page-level horizontal overflow; the existing wide member table scrolls within its container.
- Frontend/backend typechecks, lint and production builds passed. Existing warnings remain for `refresh` hook dependencies in `AdminMessagesPage.tsx:101` and `MessagesPage.tsx:86`, and the frontend bundle-size warning.
- An intermediate regression run encountered an existing intermittent Community setup timeout. New test-fixture cleanup and browser-selector/timing issues were corrected; the final full suite and browser runs passed.
- **Running local application smoke check passed:** all six Community read endpoints returned 200 on port 5001; Dashboard, Communities, Members, Chats and Moderation loaded in Chrome through port 5173 without page errors. This read-only check used an existing eligible stored administrator session; it created no accounts and performed no Community business mutations.

Integration/browser mutation tests used `ifsmhp_settings_test` on isolated MySQL port 3307 and `/private/tmp/ifsmhp-status-test-uploads`, with email disabled/stubbed. No application migration, reset, reseed, membership rewrite, or hosted deployment was performed. Browser connection setup was unavailable, so verification used standalone local Chrome. Final logs are `/private/tmp/community-session-client.log`, `/private/tmp/community-session-regression-final.log`, `/private/tmp/community-session-browser.log`, `/private/tmp/community-session-member-status-browser.log`, and `/private/tmp/community-session-build-final.log`.
