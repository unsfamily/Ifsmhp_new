# IFSMHP API Reference

Base path: `/api/v1`

Every endpoint returns the shared envelope:

```json
{ "success": true, "data": {}, "message": "Operation completed successfully" }
```

Failures return:

```json
{ "success": false, "message": "Useful error message", "errors": [], "requestId": "uuid" }
```

List endpoints use `?page=1&limit=20` and return `items` plus `pagination`.

## Authentication

Access tokens are short-lived JWTs returned in the response body. Refresh tokens are random values stored as hashed `Session` rows and sent as an httpOnly cookie.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/auth/register` | Create a pending applicant, profile, and membership application |
| `POST` | `/auth/login` | Verify password, create session, set refresh cookie |
| `POST` | `/auth/logout` | Revoke current refresh session and clear cookie |
| `POST` | `/auth/refresh` | Rotate refresh token and return a new access token |
| `GET` | `/auth/me` | Return current user/profile |
| `POST` | `/auth/forgot-password` | Create a hashed reset token record |
| `POST` | `/auth/reset-password` | Consume reset token and update password hash |

## Public

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/public/stats` | Published platform/member/content counters |
| `GET` | `/public/publications` | Published publications with `q`, `category`, and `researchType` filters |
| `GET` | `/public/publications/:slugOrId` | Published publication detail and view tracking |
| `GET` | `/public/product-reviews` | Product reviews with pagination/filtering |
| `GET` | `/public/events` | Public published/past events |
| `GET` | `/public/events/:slugOrId` | Event detail |
| `GET` | `/public/gallery` | Public gallery albums, banners, and items |
| `POST` | `/contact` | Create a contact inquiry |

## Member

All member routes require an active `MEMBER` session. Admins may pass member route checks for operational escalation.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/members/me/dashboard` | Member dashboard aggregate |
| `GET` | `/members/me/profile` | Current member profile |
| `PATCH` | `/members/me/profile` | Update phone, website URL, Scholar URL, or ORCID; returns the updated profile |
| `GET` | `/members/me/projects` | Owned projects |
| `POST` | `/members/me/projects` | Create draft/submitted project |
| `PATCH` | `/members/me/projects/:projectId` | Edit an owned draft/submitted project, or submit an owned draft |
| `GET` | `/members/me/projects/:projectId` | Owned project detail |
| `GET` | `/members/me/support` | Owned support requests |
| `POST` | `/members/me/support` | Create support request |
| `GET` | `/members/me/publications` | Member manuscripts/publications, with `status`, `category` and `q` filters plus unfiltered `stats` |
| `POST` | `/members/me/publications` | Submit a manuscript for review (goes straight to `SUBMITTED`) |
| `GET` | `/members/me/conversations` | Participating conversations |
| `POST` | `/members/me/conversations/:id/messages` | Add a message |
| `GET` | `/members/me/documents` | Attachments visible to the member |
| `GET` | `/members/me/community` | Member directory, groups, and threads |

Member profile updates accept only the editable fields `phone`, `websiteUrl`, `scholarUrl`, and `orcid`, with at least one field provided. `phone`, when supplied, must be a JSON string containing exactly ten ASCII digits (`0–9`), e.g. `"0123456789"`; leading zeros are preserved. Null, empty, whitespace, punctuation, country prefixes, Unicode numerals, and numeric JSON values return `422` with a `phone` field error: “Enter exactly 10 digits, without spaces or a country code.” No trimming or normalization is applied to phone numbers. If phone is omitted, the current stored phone must meet the same rule before any profile changes can be saved. Existing invalid or missing numbers remain readable and unchanged until explicitly corrected; no backfill is performed. Other editable fields retain their existing optional/clearing behavior. Profile changes and their audit event commit together; invalid requests change neither. This rule is specific to Member Edit Profile, not registration or administrator contact information.

### Project timelines

Project creation requires `fromDate` and `toDate` as complete ASCII `YYYY-MM-DD` calendar-date strings, including when `submit` is `false`. Supported years are `0001`–`9999`. Both dates must exist in the Gregorian calendar and `toDate >= fromDate`; same-day, past, and future ranges are accepted. Null, numeric values, zero/year zero, whitespace, incomplete dates, timestamps, impossible dates, and reversed ranges return `422` with field errors on `fromDate` or `toDate`.

Example date fields: `{ "fromDate": "2024-02-29", "toDate": "2024-03-01" }`. Existing project creation fields and response envelopes remain unchanged. Free-text `timeline` is no longer accepted in mutation payloads; deploy the frontend and API together.

For project PATCH requests, omitting both date fields preserves the current timeline. Supplying either requires both and a valid range. Unrelated edits to legacy projects remain allowed, but promoting a draft requires a valid effective range inside the update transaction. Invalid requests must not change project fields, support selections, submission history, or audit records.

The existing `Project.timeline` column stores new ranges as `YYYY-MM-DD / YYYY-MM-DD`, without timezone conversion. Member project detail retains its readable `timeline` and adds `fromDate: string | null` and `toDate: string | null`. These are derived only from a valid canonical range; arbitrary historical text is returned unchanged with both derived fields null. No migration, backfill, or inferred dates are used. See [implementation and verification](project-timeline-validation.md).

## Admin

All admin routes require an active `ADMIN` session.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/admin/stats` | CRO dashboard counters |
| `GET` | `/admin/members` | Members/applications queue |
| `GET` | `/admin/members/:id` | Application detail |
| `POST` | `/admin/members/:id/approve` | Transactionally approve application and issue `IFSMHP-YYYY-NNNNNN` |
| `POST` | `/admin/members/:id/reject` | Reject application with reason |
| `GET` | `/admin/projects` | Project review queue |
| `GET` | `/admin/projects/:id` | Project detail |
| `POST` | `/admin/projects/:id/approve` | Approve project |
| `POST` | `/admin/projects/:id/reject` | Reject project |
| `PATCH` | `/admin/projects/:id/status` | Legal project status transition |
| `GET` | `/admin/publications` | Publication queue |
| `GET` | `/admin/publications/:id` | Publication detail |
| `POST` | `/admin/publications/:id/approve` | Approve internally |
| `POST` | `/admin/publications/:id/reject` | Reject manuscript |
| `POST` | `/admin/publications/:id/publish` | Publish publicly and create slug if needed |
| `POST` | `/admin/publications/:id/unpublish` | Return to approved internal state |
| `GET` | `/admin/support` | Support queue |
| `POST` | `/admin/support/:id/approve` | Approve support request |
| `POST` | `/admin/support/:id/reject` | Reject support request |
| `POST` | `/admin/support/:id/complete` | Complete support request |
| `GET` | `/admin/conversations` | All conversations |
| `GET` | `/admin/conversations/:id` | Conversation detail |
| `POST` | `/admin/conversations/:id/messages` | CRO reply |
| `GET` | `/admin/events` | Admin event list |
| `POST` | `/admin/events` | Create event |
| `PATCH` | `/admin/events/:id` | Update event |
| `GET` | `/admin/inquiries` | Contact inquiry queue |
| `POST` | `/admin/inquiries/:id/reply` | Add inquiry reply and mark responded |
| `POST` | `/admin/inquiries/:id/close` | Close inquiry |
| `POST` | `/admin/inquiries/:id/spam` | Mark inquiry as spam |
| `GET` | `/admin/announcements` | Announcement list |
| `POST` | `/admin/announcements` | Create draft/scheduled/sent announcement |
| `GET` | `/admin/gallery` | Admin gallery view |
| `GET` | `/admin/audit-log` | Persisted audit timeline with combined search/classification/date filters, deterministic sorting and pagination |
| `GET` | `/admin/audit-log/summary` | Database counts for administrator activity (24h), warnings/danger (7d), and indefinite retention |
| `GET` | `/admin/audit-log/options` | Registered and historical actor/module/action/severity classifications |
| `GET` | `/admin/audit-log/export` | Authenticated CSV containing all matching records; separately audited as access granted |
| `GET` | `/admin/reports` | Report definitions |
| `GET` | `/admin/settings` | Platform settings |

## Files

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/files/upload` | Authenticated upload with size, MIME, and magic-byte checks |
| `GET` | `/files/:id/download` | Authorized streaming download |

Files are never served statically. Private file access is allowed to admins, uploaders, credential owners, project owners, publication authors, and conversation participants.

## Gallery management

Collection/photo CRUD, uploads, publication controls, ordering and image routes are documented in [Media Gallery Management](gallery-management.md). Existing gallery listing routes retain their response shapes.


## Routed Community reports and moderation

These endpoints are separate from the legacy `/members/me/community` discussion APIs. All paths below use `/api/v1`; authenticated administrators and assigned community moderators can review reports, while submission requires active community access.

| Method | Path | Contract |
| --- | --- | --- |
| POST | `/community/messages/:id/report` | Message, reply, and attachment report; `submissionId` UUID, `reason`, optional `notes` |
| POST | `/community/members/:id/report` | Member report; same fields plus `communityId` |
| GET | `/admin/community/reports` | Paginated reports; `search`, `status`, `communityId`, `dateFrom`, `page`, `limit` |
| GET | `/admin/community/reports/:id` | Current content, original evidence, revision, target version, eligible actions, and history |
| PATCH | `/admin/community/reports/:id` | `status`, optional `resolutionNotes` (required for closure), and decision preconditions |
| POST | `/admin/community/reports/:id/actions` | `action`, required `notes`, and decision preconditions |
| GET | `/admin/community/reports/:id/evidence/:attachmentId` | Reviewer-only retained attachment download; authorization is checked on every request |

Submission returns `{ reportId, status, created, duplicate }`. Reusing an identical submission UUID returns the original receipt; another UUID for the same active reporter/target returns a duplicate receipt. Decision preconditions are `operationId` UUID, `expectedRevision` integer, and `expectedTargetVersion` from the reviewed report. Exact operation retries do not repeat effects; stale versions or conflicting ID reuse return 409, and missing/invalid fields return 422.

Enforcement starts review without closing. Resolve/Dismiss explicitly close; `REOPEN_REPORT` explicitly reopens and clears resolution notes. Legacy reports have null original evidence. See [Community workflow](community-workflow.md#reporting-and-moderation) for eligibility, evidence retention/access, request examples, migration, coordinated deployment, and verification results.

Audit event fields, privacy rules, route coverage, query semantics, migration and verification: [Dynamic Admin Audit Log](audit-log.md).

## Administrator Profile & Preferences

See [the profile contract and rollout guide](admin-profile.md) for `/admin/profile` profile/preferences, avatar, password, session, and overview endpoints. These endpoints require a real stored active-administrator session, never accept arbitrary account IDs, and never use mock fallback. Work Email/designation are profile information; login email and authorization role remain read-only. Profile mutations require `expectedRevision`.

Audit listing and CSV export additionally support the exact `actorId` query parameter used by personal activity links.

### Administration Settings

`GET /admin/settings` now returns `{ values, defaults, sections, deployment }` rather than raw setting rows. `PATCH /admin/settings/:section` accepts `{ expectedRevision, values }` and atomically saves changed supported keys with an audit event. Both require an active administrator with a real stored session. Stale revisions return 409; invalid or unsupported fields return 422. `GET /public/settings` returns only the public branding, contact, formatting, notice and privacy-contact allowlist. See [Administration Settings](administration-settings.md) for the registry, defaults, unavailable capabilities, migration/initialization steps and verification results.
