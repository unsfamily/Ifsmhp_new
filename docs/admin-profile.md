# Administrator Profile & Preferences

The routed administrator page uses MySQL, authenticated APIs, and the shared disk store. It has no sample account, simulated saves, browser-local persistence, or mock API fallback.

## Account and profile contract

`User` remains authoritative for login email, full name, role, and account status. `AdminProfile` stores optional personal/contact fields, a separate display name and professional designation, timezone, avatar reference, four email preferences, revision, and timestamps. A designation—including “Auditor (Read-only)”—is descriptive and never grants or removes authorization.

Existing accounts return their real full name with empty name-component fields until the administrator explicitly enters them. Reads do not create records. A profile save requires first name; last name may be empty. The combined name updates `User.fullName`. Work Email is contact information only; login, account recovery, and operational email continue using `User.email`.

Validation: first/last name up to 60 characters each, display name 120, job title/institution 200, contact email 191, phone 40, country 120, biography 600, website 2048 with HTTP(S) only, valid IANA timezone (UTC default), and ORCID format/check digit. The server supplies timezone and designation options. The API rejects unknown fields and unsupported preferences.

All endpoints below are under `/api/v1/admin/profile`, require a JWT backed by a live stored session and an active ADMIN account, and reject the development role-header shortcut. Ownership comes from the session. Responses use `{ success, data, message }`, failures use the existing error envelope, and protected responses are `private, no-store`.

| Method/path | Contract |
|---|---|
| `GET /` | `{ account, profile, preferences, defaults, revision, avatarFileId, policy, capabilities }` |
| `PATCH /` | `{ expectedRevision, profile?, preferences? }`; complete profile/preference objects when included; returns refreshed profile response |
| `GET /overview` | Actual security dates/session count, shared or personally assigned queue counts, latest three approvals from status histories, and latest six actor-scoped audit entries |
| `POST /avatar` | Multipart `file` and `expectedRevision`; returns refreshed profile response |
| `GET /avatar` | Current owned avatar, streamed without exposing storage paths or query-string credentials |
| `POST /password` | `{ currentPassword, password, confirmation }`; returns `{ changed: true }` |
| `GET /sessions` | Existing `{ items, pagination }` envelope; default 20, maximum 100; only unrevoked, unexpired owned sessions |
| `DELETE /sessions/:id` | Revoke owned session; returns `{ revoked, signedOut }`; unknown/foreign IDs return 404 |
| `POST /sessions/revoke-others` | Revoke all sessions except the verified caller’s session |

Profile/avatar mutations serialize on the account row and check the revision. Conflicts return 409. Save All commits profile and preferences together. Unchanged saves do not increment the revision or append events. Profile changes update authentication context immediately. Discard restores the saved profile; Use Defaults edits the draft and requires saving.

A conflict retains the draft, loads a separate view of current saved values, and requires explicit review before enabling saving. Loading failures offer retry. Mutations disable duplicate submissions. Requests and blob URLs are invalidated on account changes; denied access clears protected page data. Overview refreshes on focus without replacing drafts; pre-mutation responses cannot restore obsolete state.

## Avatar and security behavior

Avatars use `UPLOAD_STORAGE_PATH`, UUID storage keys, private `FileObject` records, uploader/name/type/size/checksum metadata, and an owned profile reference. `ADMIN_AVATAR_MAX_UPLOAD_MB` defaults to 5 (maximum configuration 25). The byte limit is inclusive. Extension, declared MIME, detected signature, readable pixels, and single-image metadata must agree for JPEG, PNG, or WebP.

Uploaded images are orientation-normalized, resized to fit 1024×1024 without enlargement, converted to WebP, and stripped of embedded metadata. The browser renders an authenticated blob. Replaced files are tombstoned in the profile transaction and unlinked after commit; the worker retries unpurged avatar tombstones. Failed requests remove temporary images. Generic download URLs enforce the same current-owner restriction, and avatars cannot be repurposed as project/message/document attachments or event covers.

New administrator passwords require at least 14 Unicode characters and at most 72 UTF-8 bytes, matching bcrypt’s input limit. Mixed-case/number/symbol indicators are advice. The current password is verified, unchanged passwords are rejected, and confirmation must match. Updates change the password timestamp, invalidate unused reset tokens, revoke other sessions, and record the audit event in one transaction. The current session remains valid. Administrator password-reset completion uses the same policy; existing passwords are not invalidated merely by rollout.

Password changes allow 10 requests per account per 15 minutes. Denials and throttling retain authorization failure even if security auditing fails. Session responses expose bounded user agents, recorded IPs, creation/expiry dates, and a current-session flag, never token hashes. Revocation prevents subsequent access and refresh. Password sign-in is serialized with credential changes so a verified old hash cannot mint a session after a password change commits.

Unknown historical password-change dates display as unavailable. There is no invented location, password expiry, mandatory MFA claim, or simulated token management. MFA and API tokens are explicitly unavailable.

## Notification semantics and worker

The four persisted switches add email to in-app notifications. Disabling email does not delete existing notices or suppress member-facing notifications.

| Preference | Default | Supported triggers |
|---|---|---|
| `appNewMember` | On | Committed membership application creation |
| `inquiryNew` | Off | Committed public inquiry creation |
| `supportUrgent` | On | High/Urgent support creation, assignment/priority/status changes, and replies |
| `supportAll` | Off | All relevant support updates; overlaps with urgent produce one delivery |

New applications, inquiries, and support requests notify active administrators. Subsequent support updates target the assigned administrator, or all active administrators if unassigned. The acting administrator is excluded from their own update notices. Member replies use the same assignment scope; existing member-facing notices remain intact. Email contains a generic update title and authenticated link, not private inquiry/message text.

Escalations, daily/weekly digests, assigned SAB review requests, organizer reminders, outage notices, and administrator marketing delivery are disabled with an explanation. This module does not invent those missing workflows or expand announcement audiences.

`AdminEmailJob` is an outbox and deduplication receipt. Its unique event/recipient key prevents duplicate notices for repeated originating operations. Business mutation, in-app notice, outbox job, and business audit commit together. The worker runs once per minute, claims at most 100 due jobs, recovers claims older than five minutes, rechecks recipient eligibility/preferences, and sends outside the database transaction. Delivery completion and its audit record commit together.

States are `QUEUED`, `PROCESSING`, `UNCONFIGURED`, `SENT`, `SUPPRESSED`, and `FAILED`. Failures back off 1/5/15/60 minutes and stop after five attempts. Missing SMTP remains explicitly `UNCONFIGURED`, retried after one minute. Changing a preference affects subsequent delivery eligibility; enabling a switch does not resurrect previously suppressed notices. Jobs use stable Message-IDs, but SMTP is **at-least-once**: a crash after SMTP acceptance and before recording completion can produce a duplicate.

Configuration:

- `ADMIN_EMAIL_WORKER_ENABLED=true` by default; avatar cleanup continues even when email delivery is disabled.
- Existing `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `MAIL_FROM` configure delivery.
- Links use `ANNOUNCEMENT_WEB_URL` when configured, otherwise the first `CLIENT_URL` origin.
- With SMTP or the worker unavailable, the page explains that preferences persist and in-app notices continue.

## Audit and supporting cards

The registry adds `AdminProfileUpdated`, `AdminAvatarUpdated`, `AdminPreferencesUpdated`, `AdminPasswordChanged`, `AdminPasswordChangeFailed`, `AdminSessionsRevoked`, and `AdminEmailDeliveryOutcome`. Existing `AuthenticationThrottled` records credential throttling. Profile/preferences audit metadata contains changed field names, not biography/contact values, passwords, hashes, tokens, or image contents. Successful mutations require transactional audit persistence.

`GET /admin/audit-log` and its export accept exact `actorId` filtering. Profile links initialize it from the URL; CSV uses the same filter. Activity is personal; queue scope is labeled explicitly. Membership, publication, and inquiry counts are shared. Support counts use `assignedAdminId`; publication and support SLA counts reuse the existing 10-day and 5-day definitions. No SLA is invented for membership or inquiries.

## Verification and rollout

Migration: `20260924000000_admin_profile`. It adds `AdminProfile`, `AdminEmailJob`, nullable `User.passwordChangedAt`, and the avatar ownership marker/reference. It does not reset, reseed, rename accounts, change roles/passwords, create fictional profiles, or rewrite historical events.

Before rollout, apply the migration to an isolated database containing old-schema account, session, and audit fixtures, and compare every original value. Deploy the migration, API/worker, and frontend together. Existing accounts need no backfill. Smoke-test saving a profile, inspecting the resulting audit event, receiving an operational email with SMTP configured, and revoking another real session. Hosted deployment requires the actual deployment target; local verification is not a hosted deployment.

Commands (set a dedicated test `DATABASE_URL` and `UPLOAD_STORAGE_PATH`; never run integration tests against the application database):

```sh
npm --prefix backend run db:generate
npm --prefix backend run db:deploy
NODE_ENV=test AUDIT_CAPTURE_CHECKS=1 npm --prefix backend test
npm run typecheck
npm run lint
npm run build
npm --prefix backend run test:profile:browser
```

The browser runner accepts `PROFILE_API_URL`, `PROFILE_WEB_URL`, `PROFILE_SCREENSHOT_DIR`, `PLAYWRIGHT_MODULE_PATH`, and optional `CHROME_PATH`. Run its API with SMTP disabled or stubbed. It provisions a temporary administrator, signs in through the real API, exercises actual persistence, and removes its fixtures afterward.

### Actual results

- Full backend regression: **447 tests passed across 23 suites**, including **40 profile-specific tests**, with audit-contract checks enabled.
- Profile integration covers validation, no-op saves, concurrent revisions, transactional audit failure, role/header/ownership denial, session pagination/revocation, password/reset policy, rate limiting, avatar signature/size boundaries/cleanup, actual inquiry/support/reply capture, email suppression/retry/final outcomes, and real approval history.
- Browser: **10 acceptance checks passed**, with no browser exceptions. Save/reload, defaults/discard, actual avatar upload, failed-save drafts, two-tab conflict review, stale overview responses, password/session controls, personal audit navigation, responsive layout, and access revocation were exercised.
- A fresh isolated old-schema fixture retained its account identity, credentials, session, and original audit record exactly after migration. New historical password timestamps remained null; no profiles were fabricated.
- Earlier runs exposed and fixed an inclusive upload-limit boundary, a multipart header omission, and a banner overlap hiding profile names. A delivery timing fixture now uses an explicit due time. One earlier full run also encountered an intermittent empty response in the existing Community workflow fixture; the subsequent full regression passed.
- Frontend/backend typechecks and production builds passed. Lint passed with two existing hook-dependency warnings in `AdminMessagesPage.tsx:101` and `MessagesPage.tsx:86`; Vite retains its existing main-bundle-size warning. `git diff --check` passed.
- The local `ifsmhp_platform` migration was applied after isolated validation. Hash comparisons preserved **all original columns and rows in 75 existing tables**, including **8 users, 45 sessions, and 921 historical audit events**. No reset, reseed, or historical rewrite occurred.
- Screenshots and browser results are in `/private/tmp/ifsmhp-profile-browser/`. Verification logs are `/private/tmp/profile-regression.log`, `/private/tmp/profile-types.log`, `/private/tmp/profile-lint.log`, and `/private/tmp/profile-build.log`.
- Hosted deployment was not performed: no hosting target or release credentials were provided. API, frontend, and worker changes remain together in the local working tree.
