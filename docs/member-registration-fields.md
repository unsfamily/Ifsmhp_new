# Member registration fields

The registration form now sends First Name, Last Name, Communication Address, and Permanent Address through the existing OTP flow. Professional Type remains free text so the updated choices remain compatible. Organization and document labels retain their current wording and storage meanings; document kinds remain `CV` and `CREDENTIAL`.

## API and persistence

`POST /api/v1/auth/otp/request` with `purpose: "REGISTER"` retains the existing `fullName` and document claims. It additionally accepts:

| Field | Validation/storage |
|---|---|
| `firstName`, `lastName` | Optional as a pair; trimmed strings of 1–59 characters each. Their joined value must match the trimmed `fullName`. Stored as nullable columns on `User`. |
| `communicationAddress`, `permanentAddress` | Optional, nullable strings; trim leading/trailing whitespace, preserve internal line breaks, normalize blank to null, and require 5–1,000 characters when nonblank. Stored as nullable text on `MemberProfile`. |

The current form requires both split names and both addresses. Older API requests and outstanding OTP drafts may omit all four fields. Existing full names are never split or rewritten. New fields stay in the OTP JSON draft through resends; user, profile, application and claimed documents are created using the existing transaction after verification. Validation returns field-specific 422 errors. New names and addresses are not editable through role, authentication or public endpoints.

Session responses add nullable first/last names. `GET /members/me/profile` and `GET /admin/members/:id` return all four fields. Member and admin private detail pages show `Not provided` for missing values. Public/community DTOs do not include postal addresses; session DTOs omit them too.

`PATCH /members/me/profile` accepts the two addresses alongside existing editable fields. Omission preserves a field, null/blank clears it, and nonblank values follow registration validation. Names remain read-only. The existing ten-digit phone rule still applies to every profile save, including when only addresses change; registration's existing phone rule is unchanged. Profile updates and audits commit atomically. Audits record changed field names, without address contents.

## Deployment

Back up the database first. From the repository root:

```sh
npm --prefix backend run db:deploy
npm --prefix backend run db:generate
npm --prefix backend run build
npm --prefix frontend run build
```

Restart the API using the existing process manager. If already in `backend/`, omit `--prefix backend`. The additive `20261003000000_registration_fields` migration adds nullable columns only. Never reset or seed an existing application database. Deploy the migration before starting code that reads these columns. Previously entered addresses that were never sent by the old form cannot be recovered automatically.

## Verification

Use a disposable migrated MySQL database and temporary `UPLOAD_STORAGE_PATH`, with SMTP disabled. Focused tests:

```sh
npm --prefix backend test -- tests/registration-documents.test.ts tests/otp.test.ts tests/auth-account-state.test.ts tests/membership-queue.test.ts
npm --prefix backend run test:registration:browser
npm --prefix backend run test:member-phone:browser
```

The membership queue suite requires an ADMIN fixture in the test database. Browser tests require `DATABASE_URL` to name an isolated `_test` database, built backend code and a running test API/frontend. The registration browser defaults to API port 5007 and frontend port 5179; override `REGISTRATION_API_URL`, `REGISTRATION_WEB_URL`, `REGISTRATION_SCREENSHOT_DIR`, and `CHROME_PATH` as needed. Its OTP mailbox fixture changes only the isolated OTP code hash, retaining the real submitted draft; external emails are unnecessary. Fixtures are removed afterward.

On 2026-10-03, 100 focused integration tests and nine browser scenario groups passed (two registration/address scenarios plus seven existing phone scenarios). Coverage includes real document uploads, field validation, OTP reload/resend, successful registration, admin review/approval, member access, Unicode/boundaries, legacy inputs, clearing/partial updates, failed-save recovery, audit rollback, address privacy, and desktop/mobile layouts. Prisma validation/generation, backend/frontend typechecks, builds and lint passed, with the existing two Messages hook warnings and frontend bundle-size warning.

Migration preservation was verified in the disposable database and after deployment to the configured local application database: all existing fields in its nine users and eight member profiles remained identical, with all four new fields null. A restricted-permission full SQL backup and profile snapshot were saved under `/private/tmp/ifsmhp-registration-backup-2026-10-03T06-27-04-107Z` before deployment.

The existing local `tsx watch` API was reloaded after migration; `/api/v1/health` on its configured port 5001 returned HTTP 200. Temporary browser/API test services were stopped after verification.
