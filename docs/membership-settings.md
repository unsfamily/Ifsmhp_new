# Membership settings and workflow

Admin → Settings → Membership controls the policy used for **future applications**. Existing settings revisions, optimistic concurrency, field validation, and transactional audit records remain in use. Historical applications and outstanding OTP drafts without a policy snapshot keep the legacy requirements. Existing IDs are never regenerated. The two queue review thresholds remain live settings for current applications.

## Defaults and behavior

- Automatic IDs default to `IFSMHP-YYYY-NNNNNN`. Admins can select manual issuance, change the uppercase prefix, or choose 4–10 sequence digits. The year is mandatory in automatic IDs. Manual IDs are required at approval, validated, and globally unique using the database collation. Automatic allocation skips IDs already assigned manually.
- Profile (`CV`) and Credentials (`CREDENTIAL`) documents remain required by default, with independent optional/required switches. Optional supplied files are still validated. Referrals and reference letters default to zero, with configurable counts of 0–5. Each referrer supplies a name, email, and optional organization. Letters use existing private registration uploads and their claims, up to 10 MB each.
- Fees and dues default to disabled/zero; currency defaults to INR, with USD and GBP also available. Enabled charges require positive amounts and payment instructions. Money is persisted as `DECIMAL(10,2)` and transported as decimal strings. There is no online checkout or money transfer initiated by this application.
- A new application's policy is captured server-side when its registration OTP request is accepted. Resends and verification retain it. A stale form revision returns 409; refresh the policy while preserving the entered form and valid uploads. Older clients may omit the revision, but must satisfy the current requirements when starting a new application. Clients cannot supply policy snapshots.
- New applications require an administrator's evidence-review confirmation whenever documents/referrals/letters are required. Approval also requires the application fee to be paid or waived. Historical applications do not acquire these new approval gates.
- The application charge is created at successful OTP verification. Annual dues are first charged at approval and then on each approval anniversary, due 30 days after issuance. February 29 anniversaries become February 28 in non-leap years. Snapshot amounts and currency remain fixed; changing settings does not reprice earlier applications or enrolled members. Unpaid dues never suspend member access.
- Waivers default to disabled. When enabled for that application, the applicant/member can request a full waiver with a private reason. Admins approve or reject requests and can revoke an erroneous approval. Admins record full payments with an external transaction reference and correct mistakes by reversing the record with a reason. Original records remain in history; corrections do not undo a completed membership approval.
- Automatic archival defaults to disabled, with a default delay of 90 days (configurable 1–3,650). Only newly enrolled rejected applications with this policy enabled are eligible. Archival sets `archivedAt` without changing rejection status or deleting accounts/files/history. The member directory excludes archived applications by default and provides Archived/All filters. Restoration sets an exemption; admins can explicitly re-enable archival.

Applicants now go to `/application` after registration or OTP login. They can view their own status, payment instructions, charges, and waiver decisions, but cannot access the member dashboard. Approved members view dues and request waivers in their profile. Admin member detail includes the policy, referrals, private letter downloads, evidence review, charges, waiver decisions, and manual ID entry.

## API contracts

Existing success/error envelopes are retained. New admin endpoints require an active ADMIN and a persisted session; own-membership endpoints derive ownership from the authenticated session. Private responses use `Cache-Control: private, no-store`. Validation returns 422, stale policies/invalid transitions/duplicate IDs return 409, missing or inaccessible records return 404, and authentication/authorization use 401/403.

- `GET /api/v1/public/membership-policy`: public requirements, fees, currency, payment instructions, waiver availability, and policy revision. Does not expose identity configuration, review metadata, referrals, or applicant records.
- `PATCH /api/v1/admin/settings/membership`: existing `{ expectedRevision, values }` contract. New keys: `idIssuance`, `idPrefix`, `idPadding`, `requireProfile`, `requireCredential`, `applicationFeeEnabled`, `applicationFee`, `annualDuesEnabled`, `annualDues`, `currency`, `paymentInstructions`, `waiversEnabled`, `referralCount`, `referenceLetterCount`, `autoArchive`, `archiveAfterDays`.
- Registration `POST /api/v1/auth/otp/request`: accepts optional `policyRevision`, `referrals: [{ name, email, organization }]`, `referenceLetters: [{ fileId, claimToken }]`, and `waiverReason`. Existing `documents` kinds remain unchanged. Missing optional documents normalize to an empty list; policy validation determines required evidence.
- `GET /api/v1/membership`: the authenticated applicant/member's status and charges; never arbitrary user lookup. `POST /api/v1/membership/charges/:chargeId/waivers`: `{ requestId: UUID, reason }`.
- `GET /api/v1/admin/membership/:id`: admin-only policy/evidence/charge detail. The existing `GET /api/v1/admin/members/:id` also returns this as `membership`.
- `POST /api/v1/admin/membership/:id/evidence-review`: confirm required documents and references have been reviewed.
- `POST /api/v1/admin/membership/:id/charges/:chargeId/payments`: `{ requestId: UUID, reference }`; records the full charge as paid.
- `POST /api/v1/admin/membership/:id/charges/:chargeId/corrections`: `{ recordId: paymentId, reason }`; reverses an incorrect payment record.
- `POST /api/v1/admin/membership/:id/charges/:chargeId/waivers`: `{ requestId: UUID, reason }`; an admin can record a waiver request on the member's behalf.
- `POST /api/v1/admin/membership/:id/charges/:chargeId/waiver-decision`: `{ recordId: waiverId, status: APPROVED | REJECTED | REVOKED, reason }`.
- Existing `POST /api/v1/admin/members/:id/approve` accepts optional `memberId`; it is required only for manual-policy applications. Other payload fields retain their behavior. Approved applications cannot be rejected afterward.
- `GET /api/v1/admin/members?archive=active|archived|all`: default `active` excludes archived records.
- `POST /api/v1/admin/membership/:id/restore`: `{ enableAutoArchive?: boolean }`, default false.

Amounts and currency on a charge are immutable. Repeated identical payment/waiver requests return the existing result; reusing a request ID for a different operation is rejected. Mutations lock the application **before** their first consistent read, preventing stale MySQL repeatable-read snapshots from authorizing duplicate settlements or approvals. Charge creation has an additional unique application/kind/year constraint. Settings and workflow writes roll back on audit failure. Private referral, waiver, document, payment instruction, and correction text is excluded from audit payload contents.

## Worker and deployment

The membership worker runs at startup and once per minute, uses bounded application batches, and catches up missed anniversaries for active approved accounts. Database locks and unique charge periods allow multiple API processes without duplicate charges. It logs failures, retries on its next tick, and waits for in-flight work during graceful shutdown. Set `MEMBERSHIP_WORKER_ENABLED=false` to disable it; it is automatically disabled under `NODE_ENV=test`. Tests invoke the worker directly with a controlled date. Deactivated/suspended/deleted accounts are not charged while inactive; historical periods can be caught up if their account later becomes active again.

Back up the intended database first. From the repository root:

```sh
npm --prefix backend run db:deploy
npm --prefix backend run db:generate
npm --prefix backend run build
npm --prefix frontend run build
```

If already inside `backend/`, use `npm run db:deploy` without repeating `--prefix backend`. Restart the API/worker processes with the rebuilt code and deploy the matching frontend. Migration `20261003010000_membership_policy` adds nullable policy/review/archive metadata and new evidence/charge tables. It does not rewrite historical records or enable fees, referrals, waivers, or archival. Never reset or seed an existing database. No settings initializer is required; missing keys resolve to backward-compatible defaults.

## Verification

Run `tests/membership-policy.test.ts` alongside registration, membership queue, settings, authentication, files, and audit regressions with `AUDIT_CAPTURE_CHECKS=1`. Use an isolated local MySQL database ending in `_test`, temporary `UPLOAD_STORAGE_PATH`, and disabled/stubbed SMTP. Browser coverage runs with `npm --prefix backend run test:membership:browser` against isolated frontend/API servers; optional variables are `MEMBERSHIP_WEB_URL`, `MEMBERSHIP_API_URL`, `MEMBERSHIP_SCREENSHOT_DIR`, and `CHROME_PATH`. Existing registration and settings browser suites remain regression checks.

### Current results — 2026-10-03

- Final full backend regression: **724 tests passed across 27 suites**, with audit checks enabled. This includes 35 new membership-policy tests and existing registration, authentication, file access, settings, gallery, community, events, announcements, and audit coverage. Earlier full runs encountered intermittent settings/community fixture failures; the final complete run passed without weakening those assertions.
- Membership browser checks: **5 scenario groups passed**, including every setting, failed-save recovery, policy revision changes, private letter claims, real OTP registration/login, applicant restrictions, evidence review, payment recording, manual approval, annual dues waivers, archive filtering/restoration, and desktop/mobile layout. No browser page errors. Screenshots/results: `/private/tmp/ifsmhp-membership-browser/`.
- Existing settings browser regression: **17 scenarios passed**, including revisions/conflicts, refresh, logout/login, defaults consumers, CSV audit export, and session revocation. Existing registration/profile browser regression: **2 scenario groups passed**. Frontend session tests: **26 passed**.
- Prisma validation/generation, schema-to-migration comparison, frontend/backend typechecks, builds, lint, and whitespace checks passed. The two existing Messages-page hook warnings and existing frontend bundle-size warning remain.
- All automated data mutations used isolated MySQL on port 3317 and temporary upload storage, with outbound SMTP and mail workers disabled. Browser testing used the repository's standalone Playwright runner because the in-app browser connection was unavailable. Mobile membership settings and dues screenshots were visually reviewed.

### Local rollout — 2026-10-03

The configured local application database was backed up to `/private/tmp/ifsmhp-membership-backup-2026-10-03T10-20-51-321Z/database.sql` before applying migration `20261003010000_membership_policy`. The backup is private to the local account. A before/after comparison confirmed preservation of all original columns in 10 users, 9 member profiles, 8 applications, 30 settings, and 9 revision records. No reset, seed, or settings initializer ran.

Both applications were rebuilt, Prisma Client regenerated, and the local development API reloaded. Its public membership-policy endpoint returns the backward-compatible defaults: required Profile/Credentials, INR, zero referrals/letters, and disabled fees/dues/waivers. Existing settings were retained. Hosted deployment has not been performed; no hosted target was identified.
