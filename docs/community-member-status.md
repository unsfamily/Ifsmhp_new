# Community member Block/Suspend recovery

## Behavior and root cause

The directory previously never offered Unblock, always offered Block, and offered Suspend for blocked memberships. The API accepted arbitrary destination states without checking the starting status. This allowed inappropriate transitions and made a stale restoration decision unsafe.

The existing membership enum is retained: ACTIVE, BLOCKED and SUSPENDED are separate, mutually exclusive community membership states. A Block/Suspend restriction denies protected content, posting and attachment access in that community until manually restored. It does not change the account's login status, credentials, other memberships or role, and does not introduce expiry timers. Community lifecycle and other authorization rules still apply after restoration.

The administrative directory shows only the status actions returned by the backend:

| Status | Actions |
| --- | --- |
| ACTIVE | Block, Suspend |
| BLOCKED | Unblock |
| SUSPENDED | Unsuspend |
| PENDING | Approve, Reject |
| REJECTED | No status actions |

Self-targeting, platform administrators and community administrator memberships remain protected. Assigned moderators retain their existing ability to manage ordinary members only in their communities. Role assignment/removal continues requiring active membership and administrator permission. Existing membership removal behavior is unchanged.

## Persistence and contract

The existing status endpoint accepts `status`, required `expectedStatus`, and optional `reason`. The same central transition table drives response eligibility and mutation validation. Requests recheck permission, protected targets and starting status inside the existing community transaction lock. Conflicts and invalid transitions return 409, malformed fields return 422, unauthorized/out-of-scope/removed records remain denied through the existing authorization rules.

Block/Suspend/Reject require a nonblank reason; restoration and approval notes are optional. Notes are trimmed and bounded to 2,000 characters. Restoration replaces the current restriction reason with the supplied note, or null when omitted/blank. It preserves the original join date (including unknown legacy dates) and community role. Approval can initialize a missing join date. The status change and existing `CommunityMembershipstatus` audit event commit together; audit failure rolls back the mutation. Audit changes retain safe before/after statuses without copying reason text into permanent audit logs. Replayed completed operations return a conflict and create no duplicate audit entries.

Reports & Moderation retains its existing enforcement policy, including escalation from Suspended to Blocked. Directory restoration does not resolve, dismiss, reopen or rewrite a report or its history.

Full wire details: [API contract](api.md#community-member-status-recovery). No migration, reseed or historical data rewrite is required. Release frontend/API together because all callers must supply `expectedStatus`. This implementation was verified locally; no hosted deployment was performed.

## Frontend handling

The existing page layout, icons, details drawer and confirmation dialog are retained. Every status action names the member/community and the reviewed starting/destination status. Block/Suspend require a reason; Unblock/Unsuspend do not. The dialog bounds notes, disables duplicate submissions, shows accessible validation/request errors, and stays open with entered notes after recoverable failures.

After a conflict, the original action is disabled while current membership is retrieved. The dialog shows the new status and requires choosing an explicit “Review …” action before confirming again; an old Unsuspend decision is never silently changed to Unblock. Notes remain intact through this review.

Successful mutation responses immediately update the directory and any open details. Shared invalidation refreshes current lists, counts and moderation views, prevents earlier reads from restoring stale rows, preserves filters, and clamps pagination when the last row no longer matches. Focus and polling refresh do not overwrite dialog drafts. Account/session changes or access revocation clear protected information and invalidate pending reads/mutation responses.

## Actual verification

Tests use isolated MySQL on port 3307, database `ifsmhp_settings_test`, and isolated storage `/private/tmp/ifsmhp-status-test-uploads`. SMTP is disabled/stubbed. Integration requests use real stored sessions; browser administrators use password sign-in and the member uses actual OTP verification with a delivered-code fixture.

- **77 focused integration tests passed:** 40 new status-recovery cases and 37 existing Community cases. Coverage includes both cycles; content/file denial and restoration; list/detail action agreement; every unsupported status pair; required/optional reason rules and 2,000-character boundaries; pending approval/rejection; preserved roles, join dates and other memberships; protected administrators; moderator scope; missing/invalid fields; anonymous/inactive/revoked sessions; removed memberships; concurrent reviewers; duplicate/lost-response retries; stale Unsuspend against Blocked; audit rollback; and restoration following report enforcement without report-history changes.
- **645 backend regression tests passed in 25 suites**, with audit-contract checks enabled.
- **8 browser scenarios passed:** desktop and mobile recovery cycles; cancellation; reload/details persistence; failed-save draft preservation/retry; focus refresh; explicit conflict review; stale polling; filter/count/page updates; and session revocation. Duplicate submission controls are checked while a real mutation response is delayed. No browser page errors. An intermediate run timed out during filter refresh and another exposed an assertion racing debounced search; the final runner waits for status and its complete action set together and passed, including reload after each restoration.
- Frontend/backend typechecks, builds and lint pass. Existing warnings remain for missing `refresh` dependencies in `AdminMessagesPage.tsx:101` and `MessagesPage.tsx:86`, plus the frontend production bundle-size warning.
- An intermediate focused run encountered an intermittent pre-existing Community setup failure retrieving conversations; the final focused and complete suites passed. Updated older test requests to supply status preconditions and made the rejection fixture a pending private-community request.
- The integrated browser connection failed during setup, so browser verification used local Chrome through the standalone runner. Screenshots were visually inspected at desktop 1440×1000 and mobile 390×844 sizes. The existing wide table remains horizontally scrollable inside its container; no page-level horizontal overflow was detected.

Screenshots and `results.json` are under `/private/tmp/ifsmhp-member-status-browser`: `member-status-unblock-desktop.png`, `member-status-suspend-mobile.png`, `member-status-unsuspend-mobile.png`, and `member-status-conflict-desktop.png`.

## Repeat verification

Use a migrated isolated MySQL database, set `DATABASE_URL`, `UPLOAD_STORAGE_PATH`, `NODE_ENV=test`, and disable SMTP. From `backend`:

```sh
npm test -- tests/community-member-status.test.ts tests/community-workflow.test.ts
AUDIT_CAPTURE_CHECKS=1 npm test
npm run test:member-status:browser
```

Run root `npm run typecheck`, `npm run build`, and `npm run lint`. The browser script requires a database ending in `_test`, a matching running API/frontend, and a Playwright/Chrome installation. Defaults are `http://127.0.0.1:5007/api/v1` and `http://127.0.0.1:5179`; configure frontend `VITE_API_BASE_URL` accordingly. Overrides: `STATUS_API_URL`, `STATUS_WEB_URL`, `STATUS_SCREENSHOT_DIR`, `PLAYWRIGHT_MODULE_PATH`, `CHROME_PATH`. Its accounts, sessions, communities, memberships and audit fixtures are removed after testing.
