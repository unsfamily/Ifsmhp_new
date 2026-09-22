# Community workflow

The routed `/admin/community/*` and `/dashboard/community` pages use the dedicated Community domain. The earlier `/members/me/community` interest-group, connection, discussion, and direct-message APIs retain their original tables and contracts. The unused localStorage Community store and its unrouted admin screen have been removed.

## Database and deployment

Apply `20260921000000_community_workflow` and `20260922120000_community_report_evidence` before starting the updated API:

```sh
npm run db:generate
npm --prefix backend run db:deploy
npm run build
```

The migration adds Community tables and `FileObject.communityManaged`; it does not rewrite legacy data. A newly created community receives a General conversation and an administrator membership in the same transaction. Existing databases start with no new communities; create them in Admin → Community. Do not run the development seed as a deployment step.

Community deletion is terminal soft deletion. Message deletion retains a tombstone in current-content API responses; authorized reviewers can separately access the original report evidence. The underlying records and audit history are retained for administration; no undelete operation is exposed. Slugs remain reserved after deletion.

## Access rules

| Actor | Read | Write |
| --- | --- | --- |
| Active platform administrator | All nondeleted communities and moderation records | Community lifecycle, roles, memberships, messages, reports |
| Active assigned moderator | Assigned active communities; management views scoped on every request | Ordinary-member decisions, conversation locks, content/report moderation; no role or community lifecycle changes |
| Active member | Active community discovery; chats and directory only with active community membership | Join/request/cancel/leave, send/reply, edit/delete own accessible messages, report |
| Applicant, inactive account, anonymous caller | No Community access | None |

`PUBLIC` means discoverable to authenticated members and immediately joinable. `PRIVATE` means discoverable metadata with approval required for contents. `ACTIVE` publishes a community, `INACTIVE` unpublishes it, and `ARCHIVED` disables member access. Only administrators can restore inactive/archived communities. Moderators cannot act on administrators, themselves, or other moderators. Rejected/suspended/blocked memberships cannot self-reset; removed members may rejoin.

Hidden messages are omitted from member lists and quoted replies. Deleted-message text and files are absent from current-content DTOs, including current report previews. Reviewer-only original evidence remains available separately. Locked conversations reject sends/replies; members can still delete their own messages. Community file access is checked before ordinary uploader/public file permissions, including revoked memberships and hidden/deleted content. Images use discovery access; message files require contextual content access. Responses for Community files are private/no-store.

## API contracts

All endpoints are under `/api/v1`, use the existing authentication/session middleware, success/failure envelopes, and field-level validation errors. Lists return `{ items, pagination: { page, limit, total, pages } }`, with limits of 1–100 and stable ID tie-breakers. The frontend types in `frontend/src/types/community.ts` match response names.

- `/admin/community/dashboard`: live counts, newest communities, pending memberships, conversations, and reports needing review.
- `/admin/community/communities`: list/create, `/:id` details/edit/delete, `/:id/status` lifecycle. Search, category, visibility, status and allowlisted sort filters.
- `/admin/community/members`: list, `/:id` details/removal, `/:id/status`, `/:id/role`. Membership IDs differ from user IDs. Email/activity are returned only to managers.
- `/admin/community/conversations`: list; `/:id` locks; `/:id/messages` list/send. `/admin/community/messages/:id` supports pin/hide/read updates and deletion. Read state belongs to the individual viewer; polling does not mark messages read.
- `/admin/community/reports`: list/details/update and `/:id/actions`. Supports status, community, reason/reporter/subject search, and `dateFrom` (inclusive UTC day). Review assigns the acting manager. Resolution/dismissal and moderation actions record notes and history transactionally; warnings create in-app notifications.
- `/community/communities`: list, `/mine`, `/:id`, `/:id/join`, `/:id/join-request`, `/:id/membership`, `/:id/members`, `/:id/conversations`.
- `/community/conversations/:id/messages`: list/send. Newest message page is returned in chronological order; subsequent pages contain older history.
- `/community/messages/:id`: own edit/delete; `/:id/report` and `/community/members/:id/report`: report submission. Open duplicate reports by the same reporter/target are idempotent.
- `/community/capabilities`: administrator flag, moderation capability and assigned community IDs. This is a frontend affordance; backend object checks remain authoritative.
- `/community/upload-policy`: configured limits and accepted types. `/community/options` and `/admin/community/options`: categories and community choices independent of the visible result page.

### Reporting and moderation

Message reports identify the message author even when the author is an administrator without a community membership. Such reports leave `reportedMemberId` absent and derive `reportedMemberName` from the sender; they do not create artificial memberships. Accessible historical messages remain reportable after their authors leave. Direct member reports require a currently visible directory membership. Self-reporting is rejected.

Report list/detail/dashboard responses include `availableActions`, using the existing action names. The server computes these from the viewer's permissions and current target state and rechecks the same rules inside the mutation transaction. Member-only reports cannot hide/restore content; removed or protected membership targets cannot be disciplined. Visible messages offer hide, hidden messages offer restore, and deleted messages offer neither. The action modal retrieves fresh details before offering these choices and preserves notes if a stale action or network failure requires retrying.

Enforcement (`HIDE_CONTENT`, `RESTORE_CONTENT`, `WARN_MEMBER`, `SUSPEND_MEMBER`, `BLOCK_MEMBER`) advances an OPEN report to UNDER_REVIEW. It never closes a report. Resolve or Dismiss closes explicitly. Corrective enforcement on a closed report keeps its status and resolution notes. `REOPEN_REPORT`, exposed in the existing action modal, changes a closed report to OPEN and clears obsolete resolution notes. PATCH status OPEN provides the same explicit reopening. UNDER_REVIEW cannot implicitly reopen closed reports. Starting an already active review preserves the reviewer and adds no history. Suspension is available only for ACTIVE memberships; BLOCKED memberships cannot be suspended or blocked again. Restore membership access through the existing membership controls. Existing protected-member and scoped-moderator rules remain unchanged.

New reports capture an immutable JSON snapshot and attachment references inside the creation transaction. This includes original message/reply text, author, conversation, timestamps, attachment filename/type/size/checksum, or member identity and membership state. The drawer separates original evidence from current content and hidden/deleted state. Legacy reports have nullable evidence and explicitly display “Original evidence unavailable”; no historical snapshot is fabricated. Evidence retention follows report retention; ordinary message deletion does not delete report evidence. Foreign keys prevent deletion of referenced FileObjects, and gallery cleanup excludes evidence references.

`GET /admin/community/reports/:id/evidence/:attachmentId` streams retained bytes after checking the current reviewer scope on every request. Downloads use authenticated requests and private/no-store responses. Original files stay inaccessible through normal message/file routes after deletion or membership revocation. Community soft deletion still revokes all community/report access.

#### Submission and decision contracts

Member submission bodies require `submissionId` (a client-generated UUID), `reason`, optional `notes`, and `communityId` for member reports. The existing POST endpoints retain HTTP 201 and now return `{ reportId, status, created, duplicate }` in the success envelope. Different submission IDs for the same reporter and active target share one report (`created: false`). Retrying an identical ID returns its original receipt even after the report is closed or content deleted, while still checking active community access. Reusing an ID with different input returns 409. Receipts never contain reviewer evidence.

List, detail and dashboard report DTOs include `revision` (integer), `targetVersion` (opaque SHA-256 state token), `evidence` (snapshot or null), `targetMemberState`, and `availableActions`. Presence polling does not change the target token. Message edits, visibility/deletion, and relevant membership/identity changes do.

Both PATCH `/admin/community/reports/:id` and POST `/:id/actions` require these fields in addition to their existing payload:

```json
{
  "operationId": "d077fc87-2ee2-4f61-8fb1-bb918882754e",
  "expectedRevision": 0,
  "expectedTargetVersion": "<64-character token from the reviewed report>"
}
```

PATCH requires `status`, with `resolutionNotes` for RESOLVED/DISMISSED. POST requires `action` and `notes`. Repeated identical operations by the same reviewer return the current authorized report safely without repeating warnings, history, assignment, or audit writes. Reusing an operation ID with different input/actor returns 409. Missing/invalid fields return 422; stale report/target versions return 409 with instructions to review current state. All target, status, revision, assignment, notification, history, audit, and operation-receipt changes commit or roll back in one community-serialized transaction.

The client preserves input and reuses IDs for retries, including a lost response after a successful commit. Conflicts keep notes open and require the reviewer to inspect refreshed content/status and press “Review latest report” before applying a new decision. Successful actions show the resulting status. Deploy frontend and API together: older clients do not supply the now-required preconditions. Apply the additive migration first; do not backfill evidence, reseed existing databases, or roll back by dropping retained evidence tables.

Community text is plain text. Names/slugs/categories are bounded to 191 characters, descriptions/messages to 10,000, report reasons to 191, membership reasons to 2,000, and report notes to 5,000. Message text is required even with files.

Community images accept JPG/PNG/WebP up to 5 MB each. Messages accept up to five PDF, Word, spreadsheet, presentation, text/CSV or image files, bounded by `MAX_UPLOAD_MB` (default 25 MB). Extensions, MIME, signatures, nonempty bytes, and UTF-8 text are validated. Failed operations remove staged files; committed files use generated storage keys and the existing authenticated download route.

## Frontend refresh and errors

Active message/access queries refresh every eight seconds; lists, details and the dashboard every fifteen seconds. Focus, reconnect and successful mutations trigger revalidation. Hidden tabs pause periodic fetches. Requests are deduplicated per resource. Successful mutations invalidate older in-flight reads and start new requests, so stale responses cannot overwrite table, drawer, action, or dashboard data. Responses cannot update a different selection/user. The Community HTTP budget is separate from the unchanged limit on other APIs.

Existing table pagination remains. List containers load further pages as they enter view; chats open at the latest messages and load older pages on upward scroll. Loaded pages are revalidated so hidden/deleted content does not remain in older history. Polling preserves unsent input and scroll position. Authentication/not-found failures clear protected results, while network errors retain retryable data and drafts. No mock fallback is used for Community requests.

## Verification

Use a dedicated MySQL database; the project integration suite creates/deletes fixtures and expects a baseline administrator for membership-queue tests. Do not point the suite at production.

```sh
DATABASE_URL=mysql://USER:PASSWORD@HOST/ifsmhp_community_test npm --prefix backend run db:deploy
# Provision the baseline test administrator, then:
DATABASE_URL=mysql://USER:PASSWORD@HOST/ifsmhp_community_test NODE_ENV=test npm test
npm run typecheck
npm run lint
npm run build
```

`backend/tests/community-workflow.test.ts` covers lifecycle, authorization, scoped moderators, private requests, concurrency, pagination, validation, moderation, and file revocation. The legacy suites remain part of the full run.

`backend/tests/community.browser.cjs` uses real sessions and APIs with namespaced fixtures and cleanup. Start the API and frontend against the same dedicated database, then run it with `DATABASE_URL`, `COMMUNITY_API_URL`, `COMMUNITY_WEB_URL`, and an installed Playwright module (`PLAYWRIGHT_MODULE_PATH` if not locally installed). Set `CHROME_PATH` for a local Chrome binary. Optional `COMMUNITY_BASELINE_URL` compares the original frontend admin table and member panel geometry. Screenshots are written to `COMMUNITY_SCREENSHOT_DIR`, defaulting to `/private/tmp/ifsmhp-community-browser`. It does not send email.

The additional `backend/tests/community-moderation.browser.cjs` uses the same environment variables and real-session harness to verify lost-response retries, duplicate receipts/warnings, explicit reopening, conflicting edits, stale list/drawer responses, evidence separation, filtering, reload, and mobile review. It intentionally aborts responses after the real API commits, and delays older GET responses across mutations.

Verified on 2026-09-22 with isolated MySQL, stored files, and real authentication sessions:

- Full backend regression: **376 tests across 21 suites passed**, including 37 Community integration tests. One earlier run had an unrelated announcement test return an empty 404; the complete rerun passed. An initial existing chat case also timed out once; the focused rerun passed. Neither required changing unrelated application behavior.
- Community browser regression: **15 scenario groups passed**; additional moderation reliability browser coverage: **8 groups passed**. Both use namespaced fixtures and clean them up. Desktop/mobile screenshots were inspected under `/private/tmp/ifsmhp-moderation-browser` and `/private/tmp/ifsmhp-moderation-reliability`.
- Backend/frontend typechecks and production builds passed. Lint passed with two existing hook-dependency warnings in `AdminMessagesPage.tsx` and `MessagesPage.tsx`; the frontend build retains its existing large-chunk warning.
- Fixed the previously shadowed `/admin/community` index route so its existing administrator-only dashboard renders and report count refresh can be verified. Moderator scope remains unchanged.
- The additive migration was applied to isolated MySQL first, then local `ifsmhp_platform`. Local reports/history were backed up to `/private/tmp/ifsmhp-moderation-before-migration-20260922.json` (both were empty). No seed/reset was run on the local application database.

The built API/frontend must be released together for any hosted environment. This workspace has no configured deployment target; no remote deployment is implied by the local migration/build checks.
