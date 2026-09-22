# Dynamic Admin Audit Log

The Audit Log reads persisted `AuditLog` records. Audit endpoints require a verified session belonging to an active administrator; Community moderator permissions and development role-header identities do not grant access. The application exposes no arbitrary audit creation, editing, deletion, or retention-cleanup endpoint. Records are retained indefinitely.

## Event contract and privacy

`backend/domain/audit.ts` is the event registry and classification policy. `backend/services/audit.service.ts` is the only application writer. Business services must pass their Prisma transaction to `writeAudit`; an audit failure rolls back that transaction. Security denials use `securityAudit`: persistence failure emits a correlated operational error and still denies the request.

| Field | Meaning |
| --- | --- |
| `id`, `eventVersion`, `createdAt` | Unique ID, schema version 1 for new events, database/server UTC time |
| `actorId` | Verified database user when known; null for unverified attempts and workers |
| `actorLabel`, `actorEmail`, `actorMemberId`, `actorRole` | Immutable account snapshots taken when the event is written |
| `source` | `ADMINISTRATOR`, `USER`, `UNAUTHENTICATED`, `SYSTEM`, or a named worker |
| `module`, `action`, `severity`, `outcome` | Registry classification, stable action name, severity, and `SUCCEEDED` / `FAILED` / `DENIED` / `ACCESS_GRANTED` |
| `entityType`, `entityId`, `entity` | Target type, identifier when a specific target exists, readable target label |
| `description` | Server-generated action and target summary; never a submitted body or moderation note |
| `changes` | Allowlisted, changed scalar fields represented as `{ before, after }` |
| `requestId`, `ipAddress`, `userAgent` | Server correlation ID, Express trusted client IP, user-agent limited to 512 characters |
| `metadata` | Allowlisted identifiers, counts, channels, changed-field names, date bounds, and outcome codes |
| `deduplicationKey` | Optional unique key for worker outcomes; a replay does not append another event |

Passwords, hashes, OTPs, tokens, cookies, storage keys/paths, uploaded contents, private message text, inquiry replies, and free-form moderation notes are excluded. Changes to content can be recorded using field names without copying content. An unverified email attempt is recorded as Unauthenticated and does not include the supplied email. The production app retains its existing one-hop trusted-proxy configuration; the deployment must route API requests through that proxy.

Severity is determined centrally: security failures, rejections and blocks are `DANGER`; sensitive access and restrictions are `WARNING`; approvals, publication and completion are `SUCCESS`; ordinary activity is `INFO`. Status-based actions use the actual resulting status. Callers cannot lower a denial/access event's severity.

Downloads and exports are recorded as **access granted**, after authorization and file availability/export preparation. This does not claim that the client received the complete response. External SMTP delivery cannot participate in a database transaction: delivery is attempted outside membership approval's transaction, and the delivery result and its audit entry are committed together. Existing delivery retry behavior remains in place.

## Route-to-event coverage matrix

All paths below are relative to `/api/v1`. Existing action names, including their capitalization, remain supported. The registry and options include historical classifications without rewriting historical rows.

| Persisted workflow | Routes / worker | Events |
| --- | --- | --- |
| Registration | `/auth/otp/verify` with REGISTER | `MembershipApplicationSubmitted`; successful session: `LoginSucceeded` |
| Password / OTP sign-in | `/auth/login`, `/auth/otp/verify` | `LoginSucceeded`, `LoginFailed`; channel distinguishes PASSWORD / OTP |
| Security / throttling | Auth rate limits and denied authorization | `AuthenticationThrottled`, `AccessDenied`; unverified attempts use no user ID |
| Logout / password reset | `/auth/logout`, `/auth/reset-password` | `Logout`, `PasswordReset`, `PasswordResetFailed`; repeated revoked logout creates no event |
| Persisted profile edits | `PATCH /members/me/profile` | `UserProfileUpdated`; names of changed profile fields only |
| Membership decisions | `/admin/members/:id/{review,approve,reject}` | `MembershipReviewStarted`, `MembershipApproved`, `MembershipRejected`, `MemberIdIssued` |
| Membership email outcomes | Approval and `/admin/members/:id/resend-approval-email` | `MembershipApprovalEmailOutcome`, `MembershipApprovalEmailResent` |
| Projects | `/members/me/projects`, `/admin/projects/:id/{approve,reject}`, status patch | `ProjectCreated`, `ProjectUpdated`, `ProjectSubmitted`, `ProjectDeleted`, `ProjectStatusChanged` |
| Publications | `/members/me/publications`, `/admin/publications/:id/{approve,reject,publish,unpublish}`, status patch | `PublicationSubmitted`, `Publication{STATUS}` (existing names); unpublish retains `PublicationAPPROVED` with a real status diff |
| Gallery | `/admin/gallery/categories`, `/admin/gallery/photos`, item patch/delete/reorder | `GalleryCollection{Created,Updated,Deleted}`, `GalleryPhoto{Uploaded,Updated,Deleted}`, existing `GalleryReordered` |
| Community lifecycle | `/admin/community/communities` and status/deletion; member join/cancel/leave | `Community{Created,Updated,StatusChanged,Deleted,Joined,JoinCancelled,Left}` |
| Community memberships | `/admin/community/members/:id/{status,role}`, delete | `CommunityMembership{status,role,remove}` |
| Community messages / replies | Community conversation message POST, message PATCH/DELETE, lock controls | `CommunityMessage{Sent,Updated,Deleted,Read,Unread}`, `CommunityConversation{Locked,Unlocked}`; no message content stored |
| Community reports | Member report submission, `/admin/community/reports/:id`, `/actions` | `CommunityReported`, `CommunityREPORT_UNDER_REVIEW`, `CommunityHIDE_CONTENT`, `CommunityRESTORE_CONTENT`, `CommunityWARN_MEMBER`, `CommunitySUSPEND_MEMBER`, `CommunityBLOCK_MEMBER`, `CommunityRESOLVE_REPORT`, `CommunityDISMISS_REPORT`, `CommunityREOPEN_REPORT` |
| Original evidence | `/admin/community/reports/:id/evidence/:attachmentId` | `CommunityEvidenceAccessGranted`, only after current reviewer authorization and readable file checks |
| Existing interest-group workflows | `/members/me/community` connection/group/discussion routes | `CommunityConnection{Requested,Accepted,Removed}`, `CommunityGroup{Joined,Left}`, `CommunityThreadCreated`, `CommunityReplyCreated` |
| Support | Member support submission/messages; admin support assignment, priority, decisions/messages | `SupportRequest{Created,Updated,StatusChanged}`, `SupportReplySent`, `SupportInternalNoteAdded` |
| Inquiries | `POST /contact`, `/admin/inquiries/:id/{reply,close,spam}` | `InquiryCreated`, `InquiryReplied`, `InquiryStatusChanged` |
| CRO/direct messaging | Member conversation creation and member/admin replies/direct messages | `ConversationCreated`, `MessageSent`; support-linked conversations retain their support action names |
| Uploads / documents | `/files/registration`, `/files/upload`, registration removal, `/members/me/document-exchange/items` | `FileUploaded`, `FileUploadRemoved`, `DocumentExchangeSent`; the existing client request ID deduplicates document sends |
| Sensitive file access | `/files/:id/download` for private files / administrator access | `FileAccessGranted` or `CredentialAccessGranted`; ordinary hidden/deleted-file restrictions remain enforced |
| Event administration | `/admin/events`, item patch/delete, publish/cancel | `EventCreated`, `EventUpdated`, `EventPublished`, `EventCancelled`, `EventDeleted` |
| Scheduled event work | Event worker | `EventScheduledPublished`, `EventDeliveryOutcome`; unique job/outcome keys prevent duplicate events |
| Announcement administration | `/admin/announcements`, item patch, preview/sign-off/send/schedule/cancel/retry/delete | `AnnouncementSaved`, `Announcementpreview`, `AnnouncementSignOff`, `Announcementsend`, `Announcementschedule`, `Announcementcancel`, `Announcementretry`, `Announcementdelete` |
| Announcement delivery | Announcement worker | `AnnouncementExpired`, `AnnouncementDispatchStarted`, `AnnouncementDeliveryUpdated` |
| Explicit reads/preferences | `/notifications/:id/{read,unread}`, `/notifications/read-all`, member announcement read/unread, unsubscribe POST | `NotificationsRead`, `NotificationsUnread`, `AnnouncementRead`, `AnnouncementUnread`, `AnnouncementEmailUnsubscribed` |
| Report generation / exports | `/admin/reports/:reportKey/run`, `/export`, `/admin/audit-log/export` | `ReportGenerated`, `ReportExported`, `AuditLogExported` |
| Genuine development seeding | Explicit guarded development seed command | `SeedCreated`; fabricated conversation audit examples removed |

No events are fabricated for settings: the current settings API only reads values. Event registration currently uses external registration links; no implemented local registration mutation exists to capture. Routine listing, polling, session refresh, public view/download counters, automatic last-active/read receipts, upload-file purging, and internal worker claims/retry bookkeeping are not business events. No unrelated mock UI has been wired into a new mutation endpoint.

Ordering and idempotency protections remain in their owning services. Gallery and Community mutations use their existing locks; no-op gallery/Community changes do not append events. Membership decisions lock the application. Announcement operation IDs, Community report operation/submission IDs, document request IDs, and event job keys retain their existing semantics.

## API

All successful JSON routes use `{ success: true, data, message }`. Errors retain the normal failure envelope and request ID. Responses are private/no-store; there is no mock fallback.

- `GET /admin/audit-log`: `data: { items, pagination: { page, limit, total, pages } }`.
- `GET /admin/audit-log/summary`: `admin24h`, `warnings7d`, `danger7d`, `total`, `retention: "INDEFINITE"`, `asOf`. Windows are calculated from database records independently of timeline filters.
- `GET /admin/audit-log/options`: registered and distinct historical `modules`, `actions`, `actorRoles`, `severities`.
- `GET /admin/audit-log/export`: authenticated UTF-8 CSV download of **all** matches, not just the requested page.

List/export accept `search` (max 200), `actorRole`, `module`, `action`, `severity`, `from`, `to`, and `sort=newest|oldest`. List pagination defaults to page 1 / limit 20; maximum limit is 100. Exact classification filters combine with search across actor snapshots/identifiers, action, target label and description. Module filtering is classification-based, including mapped legacy actions, not action substring matching.

`from` and `to` must be real `YYYY-MM-DD` UTC calendar dates. Both calendar dates are inclusive; the upper database bound is exclusive midnight of the following day. Invalid dates, reversed bounds, unsupported severity/sort values and out-of-range pagination return 422. Ordering always uses `(createdAt, id)` in the same direction. The list is live: refresh recalculates counts and clamps an out-of-range page.

CSV uses a fixed exclusive UTC cutoff taken before the export event. Batches contain at most 500 rows and use `(createdAt, id)` keyset traversal with backpressure handling. There is no result cap. Output includes explicit UTC timestamps, escaped quotes/newlines/Unicode, and spreadsheet formula protection, including whitespace-prefixed formula characters. Export failures before streaming return an error; failures after headers terminate the response rather than silently reporting a complete download.

## Historical records and migration

`20260923000000_dynamic_audit_log` adds nullable snapshots/classifications/context plus `eventVersion DEFAULT 0`, ordering/filter indexes, and a nullable unique deduplication key. It does not rewrite, reset, reseed, or delete old audit rows.

Version 0 rows retain their original actor labels, role, action, description, severity and JSON. Missing snapshots/outcomes display as unavailable. Current-account lookup is explicitly labeled as current information. Safe scalar legacy state is displayed separately without fabricated before/after values; unsupported/private legacy keys are not rendered or exported.

Validate on an isolated migrated MySQL database first. Compare all original audit columns before/after applying the migration. Then, against the intended application database:

```sh
npm --prefix backend run db:generate
npm --prefix backend run db:deploy
npm run build
```

Release the API and frontend together. Do **not** run `db:setup`, reset, or seed for this rollout. After deployment, perform an authorized business action and confirm its actor, target, outcome and UTC time appear in the log. Hosting/deployment credentials are not part of this repository's local validation.

## Verification and acceptance

Automated integration tests use isolated MySQL, real signed sessions, temporary stored files, and mocked external email. Run the full suite with capture-contract assertions enabled:

```sh
DATABASE_URL=mysql://root@127.0.0.1:3307/ifsmhp_gallery_test \
NODE_ENV=test AUDIT_CAPTURE_CHECKS=1 \
UPLOAD_STORAGE_PATH=/private/tmp/ifsmhp-gallery-test-uploads npm test
npm run typecheck
npm run lint
npm run build
```

`tests/audit-contract.ts` checks every new event observed during those regression scenarios: registered action, module, actor snapshot, source, outcome, server timestamp, bounded user-agent and safe changes/metadata. `tests/audit-log.test.ts` adds access checks for all four endpoints, live role revocation, append-only routing, rejection of development role-header identities, combined filters, UTC boundaries, tied timestamps, both sort directions, pagination, indefinite retention, legacy JSON, summaries, 503-row export with a concurrent insert between batches, Unicode/CSV escaping/formula protection, empty exports, failed/successful authentication, repeated logout, worker deduplication, sensitive file availability, document retry capture, and injected audit failures rolling back business state.

Run the browser harness against an isolated API with SMTP explicitly disabled and a frontend pointing to that API:

```sh
# Configure DATABASE_URL and the isolated upload directory for both processes.
NODE_ENV=test PORT=5006 CLIENT_URL=http://127.0.0.1:5178 \
SMTP_HOST= SMTP_USER= SMTP_PASS= ANNOUNCEMENT_WORKER_ENABLED=false \
node backend/dist/server.js
# Run from frontend/ in a separate terminal:
VITE_API_BASE_URL=http://127.0.0.1:5006/api/v1 npm run dev -- --host 127.0.0.1 --port 5178
# Run with a locally available Playwright installation and Chrome:
npm --prefix backend run test:audit:browser
```

Optional harness settings: `PLAYWRIGHT_MODULE_PATH`, `CHROME_PATH`, `AUDIT_WEB_URL`, `AUDIT_API_URL`, `AUDIT_SCREENSHOT_DIR`. It creates namespaced test accounts, performs a gallery action in the browser, generates enough real mutations for multiple pages, verifies filtering/sorting/date validation, keyboard details, full CSV, retry preservation, stale response rejection, reload persistence, mobile overflow and revoked access; then deletes only its own fixtures.

Acceptance: no audit samples or fabricated counts; no fixed-day retention claim; working controls; immutable actor history; business/audit atomicity; no private content/secrets in new audit records; administrator-only access; exports without truncation; and preserved layout at desktop/mobile widths.

### Recorded validation — 22 September 2026

- Full backend regression suite: **407 tests passed across 22 suites** with audit capture-contract checks enabled. Observed **109 of 110 registered actions**; `SeedCreated` was deliberately not exercised because validation does not reset/reseed an existing database.
- Focused audit suite: **31 passed**, including records spanning 503 CSV rows. Audit plus account-state security checks: **45 passed** after adding unauthenticated access-denial capture.
- Desktop (1440×1000) and mobile (390×844) browser harness: **8 workflow checks passed**, zero browser exceptions, no horizontal overflow. Real collection creation, persistence, combined filters, UTC dates, sorting, pagination, keyboard expansion, complete CSV, failure/retry handling, stale response suppression and authorization revocation were exercised. Revocation was tested both during export and list refresh.
- Frontend/backend typechecks and production builds passed. Lint passed with two existing missing-`refresh` hook dependency warnings in the admin/member messaging pages. Vite retains its existing warning about the main bundle exceeding 1,000 kB.
- The isolated additive migration preserved all original audit columns. The local application migration then preserved **647 existing audit records with every original field unchanged**, with no reset, reseed or historical rewrite.
- Two earlier exploratory full-suite runs reported transient support-validation and Community-fixture failures; subsequent isolated checks and the complete passing run did not reproduce them.
- Screenshots and browser results: `/private/tmp/ifsmhp-audit-browser/` (`audit-desktop.png`, `audit-mobile.png`, `audit-access-revoked.png`, `results.json`). The harness cleans up its own fixtures after checking reload persistence.
- Hosted deployment was not performed: no hosting target or deployment credentials were provided. Local API/frontend verification and the application database migration are complete; a hosted release must deploy both builds together and repeat the post-release action check.
