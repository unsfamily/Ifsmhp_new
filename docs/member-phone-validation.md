# Member Edit Profile phone validation

Phone numbers are strings of exactly ten ASCII digits, for example `0123456789`. Leading zeros are preserved. Empty/null values, numbers supplied as JSON numbers, letters, punctuation, spaces, country prefixes, extensions, and Unicode numerals are rejected. No additional country-specific rules apply.

The editor allows up to ten digits while typing and validates completeness on blur and submission. Invalid or overlong paste/drop operations retain the previous value rather than stripping or truncating content. Errors are associated with the input for assistive technology; invalid submission focuses the phone field. The existing dialog and other editable fields are preserved.

Existing missing or invalid numbers remain readable and unchanged in the database. The editor shows the saved value as explanatory text and leaves the replacement input empty. Members must explicitly provide a valid replacement before saving any profile changes. Cancel and failed requests preserve the stored value. No migration, backfill, or registration/admin-profile change is needed.

`PATCH /api/v1/members/me/profile` retains its existing response envelope and partial-update behavior. Supplied phones undergo strict validation; when phone is omitted, the stored value is validated inside the update transaction. Invalid requests return `422` with the `phone` field message: “Enter exactly 10 digits, without spaces or a country code.” Profile writes and audit records remain atomic; unchanged saves create no additional audit events. See [API contract](api.md#member).

## Verification results

Verification used the isolated MySQL instance on port 3307, database `ifsmhp_settings_test`, and uploads under `/private/tmp/ifsmhp-phone-test-uploads`. SMTP was disabled. Application database records were not migrated or rewritten.

- Focused integration suite: **43 passed**, including invalid formats/types, all incomplete lengths, leading zeros, legacy correction, partial updates, authorization, unchanged saves, and injected audit-write rollback.
- Full backend regression suite with `AUDIT_CAPTURE_CHECKS=1`: **526 passed across 24 suites**.
- Desktop/mobile browser checks: **7 scenarios passed**, no browser page errors. The browser uses the real OTP-verification endpoint and a stored session; a test delivered-code fixture avoids external email.
- Browser coverage includes keyboard input, selection replacement, clipboard paste, oversized autofill-style events, invalid drops, accessible errors/focus, failed-save draft preservation, database persistence, unchanged-save auditing, reload, other editable fields, missing numbers, and mobile layout.
- Frontend/backend typechecks, production builds, and lint passed. Existing frontend lint warnings remain in `AdminMessagesPage.tsx:101` and `MessagesPage.tsx:86` for missing hook dependencies. The frontend production build retains its existing bundle-size warning.
- Desktop and mobile screenshots were inspected: no horizontal overflow or broken dialog controls. Artifacts are under `/private/tmp/ifsmhp-phone-browser` (`results.json`, `phone-desktop-validation.png`, `phone-mobile-validation.png`, `phone-mobile-saved.png`).

## Repeat the checks

Use an isolated, migrated database and upload directory; do not reset or reseed the application database. From `backend`, with `DATABASE_URL`, `UPLOAD_STORAGE_PATH`, `NODE_ENV=test`, and disabled SMTP configured:

```sh
npm test -- tests/registration-documents.test.ts
AUDIT_CAPTURE_CHECKS=1 npm test
npm run typecheck
npm run build
npm run lint
```

Run the same typecheck/build/lint commands from `frontend`. For browser checks, start the API and frontend against the isolated database, then run `npm run test:member-phone:browser` from `backend`. Defaults are API `http://127.0.0.1:5007/api/v1` and frontend `http://127.0.0.1:5179`; configure the frontend's `VITE_API_BASE_URL` accordingly. The browser runner requires a database name ending in `_test`, Playwright, and Chromium/Chrome. Override `PHONE_API_URL`, `PHONE_WEB_URL`, `PHONE_SCREENSHOT_DIR`, `PLAYWRIGHT_MODULE_PATH`, or `CHROME_PATH` as needed. Fixtures are removed after the run.
