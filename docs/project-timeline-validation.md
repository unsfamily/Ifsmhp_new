# Project timeline validation

The Upload New Project page and member project-edit dialog use From Date and To Date inputs in the existing timeline section. Creation requires a complete range for both Save Draft and Submit Project. To Date can equal From Date but cannot precede it. Changing either date revalidates the range, errors are associated with their fields, and rejected submissions focus an invalid field. Failed requests preserve dates, other entered fields, and uploaded attachments.

The frontend and backend validate calendar components explicitly: ASCII `YYYY-MM-DD`, years `0001`–`9999`, valid month/day combinations and Gregorian leap years. There is no date rollover, timezone conversion, or additional past/future restriction. Native input bounds assist entry; application validation also protects both save actions and direct API calls.

## Compatibility and persistence

- Creation and updates use `fromDate` and `toDate`; the old free-text `timeline` mutation field is rejected. Both repository callers and their TypeScript types are updated.
- Updates either omit both dates or provide a complete valid pair. Existing text remains readable and survives unrelated edits. The editor shows legacy text without guessing dates; dates are required before submitting a legacy draft.
- Valid ranges reuse `Project.timeline` in `YYYY-MM-DD / YYYY-MM-DD` format. Member detail retains `timeline` and adds nullable `fromDate`/`toDate`, derived only from canonical valid ranges.
- Promotion reads and validates the effective timeline inside the same locked transaction as project changes, support changes, history, and audit insertion. Failure rolls everything back.
- No schema migration, reseed, or historical timeline rewrite is required. Release API and frontend together because mutation fields changed. This work was validated locally; no hosted deployment was performed.

See the [API contract](api.md#project-timelines).

## Actual verification

Tests used isolated MySQL on port 3307, database `ifsmhp_settings_test`, and `/private/tmp/ifsmhp-timeline-test-uploads`. SMTP was disabled. Browser authentication used the actual OTP-verification endpoint and stored sessions, with a delivered-code fixture instead of sending email.

- Focused project integration tests: **63 passed**. Covered invalid values/types and each missing field on both create modes and updates; all calendar boundaries; leap years and century rules; reversed/same-day/cross-year ranges; years below 100; legacy timelines; ownership/status rules; attachments/links; retry idempotency; and injected audit failure rollback. Frontend calendar helpers are checked against the same cases.
- Final complete backend regression run with audit-contract checks: **569 passed in 24 suites**.
- Browser coverage: **5 scenarios passed**, no page errors, using desktop 1440×1000 and mobile 390×844 viewports in `America/Los_Angeles`. Tested required/zero/incomplete/reversed dates, changing From Date, accessible error focus, same-day leap dates, failed-save recovery, real document upload, support/link/budget preservation, draft creation, editing/promotion, legacy preservation/correction, mobile submission, and reload persistence without date shifts.
- Frontend/backend typechecks, builds, and lint passed. Existing frontend warnings remain at `AdminMessagesPage.tsx:101` and `MessagesPage.tsx:86` for hook dependencies, plus the existing large production-bundle warning.
- An initial audit fixture still omitted the newly required dates and was updated. An intermediate full run reported a community evidence-access assertion failure and one test timeout; the final full run passed without changing community code.
- Screenshots were inspected under `/private/tmp/ifsmhp-timeline-browser`: `timeline-desktop-invalid.png`, `timeline-mobile-invalid.png`, and `timeline-mobile-saved.png`. The result file is `results.json`; layouts have no horizontal overflow.

## Repeat verification

Use a migrated isolated database, disable SMTP, and set `NODE_ENV=test`, `DATABASE_URL`, and `UPLOAD_STORAGE_PATH`. From `backend`:

```sh
npm test -- tests/member-projects.test.ts
AUDIT_CAPTURE_CHECKS=1 npm test
npm run typecheck
npm run build
npm run lint
npm run test:project-timeline:browser
```

Run typecheck, build, and lint from `frontend` too. The browser runner requires an API/frontend using the same isolated database and a database name ending in `_test`. Defaults are `http://127.0.0.1:5007/api/v1` and `http://127.0.0.1:5179`; set frontend `VITE_API_BASE_URL` accordingly. `TIMELINE_API_URL`, `TIMELINE_WEB_URL`, `TIMELINE_SCREENSHOT_DIR`, `PLAYWRIGHT_MODULE_PATH`, and `CHROME_PATH` can override test locations and browser installation. Test accounts, projects, and files are cleaned up after the run.
