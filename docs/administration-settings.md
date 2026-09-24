# Administration Settings

The nine administration tabs now use persisted configuration. Only supported workflows are editable. No payments, SSO, MFA, delegation, newsletters, backup jobs, or retention deletion systems are implied by saving a setting.

## API and concurrency

All endpoints use the existing success/error envelopes.

- `GET /api/v1/admin/settings`: `{ values, defaults, sections, deployment }`. Each section contains `revision`, nullable `updatedAt`/`updatedBy`, and `editable`. Deployment data contains safe mail availability/sender, actual access-token and refresh-session durations, disk storage, genuine audit count, and indefinite retention.
- `PATCH /api/v1/admin/settings/:section`: `{ expectedRevision: integer, values: { changedKey: value } }`. Returns the current settings snapshot. Unknown sections/keys, unsupported controls, malformed values, and missing preconditions return 422. Concurrent or stale section revisions return 409. Different sections can save independently.
- `GET /api/v1/public/settings`: explicit public allowlist consisting of General values plus `privacyEmail`. No revisions, updater identities, SMTP configuration, session policy, private communication settings, infrastructure paths, or secrets are included.

Administrative routes require an active ADMIN and a real stored session; development identity headers do not qualify. Administrative responses are private/no-store. Public settings responses are also no-store so notice and branding changes can refresh promptly.

`PlatformSetting` remains the value store. `SettingRevision` provides one revision per section. A MySQL insert/update locks the section before comparing the expected revision, including concurrent first saves. Setting writes, revision updates and `PlatformSettingsUpdated` audit creation share a transaction. No-op writes leave revision, timestamp and audit history unchanged. Retries after a lost response either save nothing or require reviewing the current revision; they cannot overwrite another save silently.

The audit event belongs to `SETTINGS`. It captures allowlisted scalar changes and changed field names. Signature, notice and address text are excluded from before/after audit values. Settings are read from MySQL for each operation/delivery; there is no process-local configuration cache or restart requirement.

## Setting-to-consumer registry

Definitions and validation live in `backend/domain/settings.ts`; effective-value resolution and mutation rules live in `backend/services/settings.service.ts`.

| Section / keys | Defaults | Consumer |
| --- | --- | --- |
| General: `fullName`, `shortName` | Existing application identity: International Forum of Scientists and Mental Health Professionals / IFSMHP | Shared administrator/member shell branding, public logo accessibility text and footer |
| General: `legalName`, `registrationNumber`, `address`, `contactEmail`, `contactPhone`, `homepageUrl`, `communityUrl` | Empty, never fictional company details | Public footer/contact displays and links |
| General: `locale`, `dateFormat` | `en-GB`, `long` | Settings saved dates, public event dates and calendar formatting; no interface translation |
| General: `timezone` | Existing `events.default_timezone`, otherwise UTC | New event editor and backend default; configured display dates. Existing event times retain their own timezone; date-only event labels cannot shift to another calendar day. |
| General: `maintenance`, `maintenanceMessage` | false / empty | Public notice banner only. No access restrictions or authentication changes. Enabling requires a nonempty message. |
| Membership: `pendingDays`, `reviewDays` | Existing `membership.approval_sla_days`, otherwise 5 / 5 | Application queue ageing and reports attention. Pending starts at submission; under-review starts at the latest genuine transition to UNDER_REVIEW. Missing historical transitions display unavailable. |
| Events: `capacity`, `registrationRequired`, `reminderDays` | 0 (unlimited), true, 1 | New event editor and backend create defaults. Reminder choices: 0, 1, 3, 7. Explicit overrides and existing records remain unchanged. |
| Communications: `senderName`, `replyTo`, `signature` | Empty; existing sender behavior when unset | Shared outgoing SMTP delivery, including authentication, approvals, event jobs, announcements and administrator notification jobs |
| Communications: `announcementSignoff` | false | New announcement editor and backend draft creation. Optional per-announcement override; existing drafts and sign-off behavior remain intact. |
| Review: `publicationDays`, `projectDays`, `supportDays` | 10 / 7 / 5 | Publication overview/report thresholds, project queue count/label, support queue count/label and profile overview |
| Security: `privacyEmail` | Empty | Public privacy-contact link |

Thresholds are whole elapsed calendar days, 1–365. Capacity is an integer 0–100000. Canonical IANA timezones, allowlisted formatting locales/date formats, HTTP(S) URLs, email formats and bounded strings are validated. Mail header fields reject newlines and NUL; signatures are plain text and HTML-escaped. SMTP sender **address**, transport credentials and infrastructure remain deployment-controlled. Missing SMTP retains existing explicit undelivered/error behavior. Preferences, retries, unsubscribe links and worker delivery semantics are unchanged.

Requested-by deadlines in support reports remain a distinct existing measure, not the configurable open-request-age threshold. New SLA calculations use current settings; stored historical report runs, event schedules, membership IDs and audit records are not rewritten.

## Unavailable and read-only controls

- Membership IDs remain automatically issued in the existing `IFSMHP-YYYY-NNNNNN` format; CV and credential document requirements remain unchanged. Fees, waivers, referrals, references and archival automation are unavailable.
- Automatic recording/transcription, Chatham House enforcement, event digests and public iCal feeds are unavailable.
- Newsletter/digest delivery, newsletter PDFs and automatic support acknowledgement templates are unavailable. Existing announcements remain supported.
- Escalation, double-blind review, COI checks, reviewer limits and delegation are unavailable; no fictional reviewers remain.
- Current administrator password policy (14 characters minimum, 72 UTF-8 bytes maximum), token lifetimes and indefinite audit retention are read-only. MFA, SSO enforcement, expiry/history, IP pinning, idle timeout and automatic deletion are unavailable.
- Integrations show actual SMTP availability, disk storage and externally hosted event links. No fake provider/client records or credential-management actions remain.
- Billing/budget controls and totals are unavailable; there is no accounting ledger.
- Backup schedules, archive/encryption claims, key rotation, recovery status, hash-chain checks, JSON and signed PDF exports are unavailable. The real audit count and authenticated, all-time CSV export reuse the Audit Log implementation.

## Frontend behavior

The page keeps the nine tabs, section cards and paired save/reset controls. Drafts survive tab changes and recoverable failures. Reset changes only the current draft; saving is required. Conflicts preserve inputs and require loading/reviewing current values before resubmission. Unsupported sections have no enabled save/reset action.

Saved settings refresh shared public configuration and affected data readers; other views refresh on focus. Public configuration also refreshes once per visible minute. Dirty settings drafts are not replaced by focus refresh. Aborted/stale responses cannot undo newer mutations. Account changes and access denial clear protected values. Settings routes never use mock fallback. The configuration audit link initializes the `SETTINGS` module filter. CSV export uses authenticated blob downloads and revokes object URLs.

## Migration and deployment

From `backend/`, against the intended database:

```sh
npm run db:deploy
npm run db:generate
npm run db:initialize-settings
npm run build
```

Build the frontend with its intended API origin, then release the API, frontend and existing worker processes from the same revision. Restart running API/workers to load the new code; subsequent settings changes require no restart. Do not reset or reseed the database.

Migration `20260925000000_administration_settings` only adds `SettingRevision`. The initializer inserts missing registry values/revision rows, preserving all existing rows and timestamps. It copies valid legacy timezone/approval-SLA values into the new keys, retains the old keys, and is safe to repeat. Before initialization, missing supported values resolve to documented defaults; unknown legacy keys are retained but are not returned as arbitrary public/admin configuration.

No new secret or infrastructure environment variables are required. The SMTP address remains `MAIL_FROM` (or the existing SMTP-user fallback). Unsupported infrastructure must be configured outside this page.

## Actual verification

- Full backend regression with `AUDIT_CAPTURE_CHECKS=1`: **491 tests passed, 24 suites**. Includes **44 settings integration tests** using real authentication sessions, isolated MySQL and temporary files; Nodemailer is stubbed for mail-rendering assertions.
- Settings coverage includes persistence, legacy values, section concurrency, conflicts, no-ops, audit rollback, validation, public allowlisting, role/session denial, revoked sessions, header injection/HTML escaping, per-delivery refresh, event and announcement HTTP/service defaults, stage-age handling, and actual project/support/publication SLA consumers.
- Browser suite: **12 scenarios passed**, no page errors. Covers tab drafts, reload, reset-before-save, failed requests, validation, conflict review, stale reads, new-event/announcement defaults, public consumers, unsupported controls, CSV export, audit filtering, mobile layout and access revocation.
- Desktop/mobile screenshots inspected at `/private/tmp/ifsmhp-settings-browser/`; results are in `results.json`. Browser tests use real API sessions and restore their isolated settings fixtures afterward. The in-app browser connection was unavailable, so repository-style standalone Playwright was used.
- Backend/frontend typechecks and lint pass. Frontend lint retains two existing hook-dependency warnings in the administrator/member Messages pages. Production builds pass; the existing frontend large-chunk warning remains.
- A separate migration fixture verified account/credential preservation, unchanged historical audit data, unchanged legacy setting rows, inherited overrides and repeated initialization.
- Local application migration applied successfully. Initialization inserted **27 missing values**. Before/after row hashes verified all original data across **78 existing tables** remained unchanged; only default settings, revision rows and migration bookkeeping were added.
- An earlier full regression run hit an intermittent existing community-moderation assertion; its isolated check and the final full run passed. No community moderation code was changed.

Reproduce browser checks with `npm run test:settings:browser` against a separately started isolated API/frontend. The runner accepts `SETTINGS_API_URL`, `SETTINGS_WEB_URL`, `SETTINGS_SCREENSHOT_DIR`, `PLAYWRIGHT_MODULE_PATH`, and optional `CHROME_PATH`. Disable or stub SMTP. Never point the test suites at the application database.

Hosted deployment has not been performed; no hosted deployment target is configured for this change.
